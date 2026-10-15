# Putting the physiotherapist's reference videos online

The physiotherapist's workspace (`#kine`) and the patient's programme (`#kine-p=…`) play Olivier's videos and compare each patient attempt with them.
The videos are not in this public repository.
The app reads them from one address, the repository variable `VITE_KINE_MEDIA_URL`, set by David.
Unset, the workspace says the videos are not online yet; the programme link, the PDF sheet and the note d'honoraires work without them.

## The four files, named exactly

| Olivier's file (WhatsApp, 15 October 2026) | Name online |
|---|---|
| `VIDEO-2026-10-15-19-22-04.mp4` | `olivier-1-mains-jointes.mp4` |
| `VIDEO-2026-10-15-19-22-04_2.mp4` | `olivier-2-rotation-externe.mp4` |
| `VIDEO-2026-10-15-19-22-04_3.mp4` | `olivier-3-abduction-horizontale.mp4` |
| `VIDEO-2026-10-15-19-22-04_4.mp4` | `olivier-4-elevation-paliers.mp4` |

Optional, beside each video: a poster `<same name>.jpg`, and the pose read beforehand `<same name>.pose.json`.
Without the pose file, each phone reads the reference from the video once (about a minute) and keeps it.

## Steps (Cloudflare R2, the account of the feedback worker)

1. Cloudflare dashboard, R2, Create bucket: `workout-vision-kine`.
2. In the bucket, Settings, Public access: allow the r2.dev subdomain (or connect a custom domain). Copy its address, `https://pub-….r2.dev`.
3. In the bucket, Settings, CORS policy: allow `GET` and `HEAD` from `https://david-dabert.github.io`.
4. Upload the four videos under the names above.
5. GitHub, the repository, Settings, Secrets and variables, Actions, Variables, New repository variable: `VITE_KINE_MEDIA_URL` = the address of step 2.
6. The next deployment of `main` builds with it: the page's security policy then allows that address, and only it (`vite.config.js`, `kineMediaCspPlugin`).

Any other static host serving https with CORS for `GET` works the same way; a `*.workers.dev` address is refused by the events check (`scripts/check-dist-events.mjs`).
