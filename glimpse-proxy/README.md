# Glimpse proxy

A Vercel project that holds Elorian's API key for the patient's AI commentary (`src/lib/kine/glimpse.js`, `src/components/kine/AiCommentary.jsx`).
David, 17 October 2026: "Can we implement their API?", then "Vercel" as the host of the key.

## What it does

1. `POST /api/upload`: gives the phone a token for one upload into the Blob store's `attempts/` folder (a video, at most 200 MB, valid ten minutes, random name).
2. The phone puts the attempt's video into the store directly (Vercel Blob client upload), so the video never passes through the function's 4.5 MB body limit.
3. `POST /api/glimpse`: with the video's address and the exercise's own text (the physiotherapist's title, position, steps, dosage and holds), calls Elorian (`elorian-1-agent`) with the fixed prompt of `lib/commentary.js`, returns the commentary cut to its fields, and deletes the video whatever Elorian answered.
4. `GET /api/sweep`: Vercel's cron, daily at 04:17 UTC, deletes any attempt older than 30 minutes (a phone closed mid-call).

The prompt is fixed on the server: the app cannot use the key as a general-purpose model.
Only the app's origins are answered (`lib/guard.js`, `ALLOWED_ORIGINS` to change them), at most ten calls per address in ten minutes per function instance.
The key is read from the environment and sent to Elorian only; no response carries it (`proxy.test.js`).

## What it keeps

Nothing of its own: no log of videos, names or answers.
The video stays in the Blob store for the length of the call, then is deleted.
Elorian may keep what it receives under its own privacy policy; the app's notice says so before the patient sends anything.

## Set up (once, in Vercel's dashboard)

1. Add New, Project, import `david-dabert/workout-vision`, Root Directory `glimpse-proxy`, Framework Preset "Other". Deploy.
2. Storage, Create, Blob, then connect it to this project: Vercel adds `BLOB_READ_WRITE_TOKEN`.
3. Settings, Environment Variables, Production:
   - `ELORIAN_API_KEY`: the key, marked Sensitive;
   - `CRON_SECRET`: a long random string (`openssl rand -hex 24`).
4. Deployments, Redeploy, so the variables reach the functions.
5. In the GitHub repository, Settings, Secrets and variables, Actions, Variables: `VITE_GLIMPSE_URL` = the project's production address (`https://<project>.vercel.app`). The next deploy of the site offers the commentary.

To switch the commentary off: delete `VITE_GLIMPSE_URL` (the site stops offering it at its next deploy), or remove `ELORIAN_API_KEY` (the proxy answers 503 at once).

## Tests

`npx vitest run glimpse-proxy` from the repository root: the prompt, the cleaning of the answer, the origin, store and rate checks, the deletion of the video, the sweep. Elorian and the Blob store are stand-ins; no test calls the network.
