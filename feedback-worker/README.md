# Workout Vision Feedback Worker

Cloudflare Worker + D1. One job, and a read-only remainder:

- **Usage counts** (since 3 October 2026): anonymous daily totals of what the app's screens and analyses are used for, so David knows how many people use the app and how far they get (`usage.js`, `usage-schema.js`).
- **Feedback** (closed): `POST /ingest` was removed on 3 October 2026 (WP0.4, `docs/SPEC-production.md`) and answers 404 like any unknown path. It was open to anyone, stored free text and a hash of the IP salted with a constant written in this repository, with no notice and no consent. The app's only sender, `src/components/FeedbackPanel.jsx`, is inert since the same day (it posts nowhere, whatever the build). The `feedback` table stays in `schema.sql` and in any deployed database, readable through `GET /feedback`: exporting then dropping it is David's decision D24 (below).

## What the usage counts keep, and what they do not

The app (`src/lib/events.js`) sends, only when its build names this worker (`VITE_EVENTS_URL`):
an event name from the list in `usage-schema.js`, the lift and its tier where the event carries them, a visit's length in one of four buckets (`<1`, `1-5`, `5-15`, `>15` minutes), the app version and the language (`fr` or `en`).

The worker keeps one row per UTC day and combination of those fields, holding a count (`usage_daily`). It never reads the user agent or the referrer. It keeps:

- no IP address, no user or device id, no cookie, no time finer than the day, no row per event;
- for the rate limit only, a salted, one-way hash of the IP and the day, with its hits in one minute (`usage_rate`), never joined to the counts, and deleted within three minutes: each event deletes the minutes before the last one, and so does a job that runs every minute (`scheduled` in `worker.js`, `[triggers] crons` in `wrangler.toml`), so a hash is deleted even when no event follows it.

Anything else in a request (an unknown event, an extra field, a value outside its list) is refused whole with 422, and nothing of it is stored. The app sends nothing, the first `open` included, when the browser sends Global Privacy Control or Do Not Track, or after the person taps "Désactiver" / "Turn off" under the choice of lift or in the notice (`#comptage`, `src/components/experience/UsageNotice.jsx`).

The counts are of events, not of people: no row can be tied to a person or a phone, so "people" can only be estimated from `open` (one per page load) and `session_end` (one per visit).

## CNIL audience-measurement exemption (WP2.3)

The CNIL exempts audience measurement from consent (article 82 of the loi Informatique et Libertés; its guidelines and recommendation on cookies and other trackers, and its page "Cookies : solutions pour les outils de mesure d'audience") when it meets conditions, of which the four below are the ones WP2.3 names (`docs/SPEC-production.md`). Each is checked against this repository; the evidence is the code and its tests, not a statement.

- [x] **Purpose limited to audience measurement, for the publisher only.** The worker keeps daily totals per event, lift, tier, visit length, version and language (`usage.js`, table `usage_daily`), readable only with `STATS_TOKEN` (`GET /stats`, `/dashboard`). No other endpoint writes anything (`POST /ingest` is 404 since 3 October). Evidence: `usage.test.js` ("adds the events to daily counts, and keeps nothing else"; "answer only with the token, in the Authorization header"), `worker.test.js` (`/ingest` answers 404 and writes nothing).
- [x] **No cross-referencing with other processing, nothing passed to third parties.** The events carry no identifier (`usage-schema.js` `validEvent` refuses any field outside the list; the app stores nothing to tell one phone from another), so a row cannot be joined to anything. The rate limit's salted hash of the IP and the day lives in its own table (`usage_rate`), is never joined to the counts and is deleted within three minutes. The app sends with `credentials: 'omit'` and no referrer (`events.js`). Evidence: `usage.test.js` ("refuses … and stores nothing"; "deletes the rate keys within three minutes with no event after them"), `src/lib/__tests__/events.test.js` ("stores no identifier", "sends only the listed events, with only their listed fields").
- [x] **The person is informed and can object.** The notice (`#comptage`, French and English) lists every field, generated from `usage-schema.js`, says that no video, image, name, IP address or device id is kept, names the host, and holds the switch; it is reached from the line under the choice of lift and from the Choice footer. The opt-out (`wv_count_off`), Global Privacy Control and Do Not Track each stop every event, the first `open` included (PRIV-4). The deploy job fails when the variable is set and the built notice does not name its host (PRIV-3, `scripts/check-dist-events.mjs`). Evidence: `src/components/experience/__tests__/usage-notice.test.jsx` (notice against schema, host, switch), `src/lib/__tests__/events.test.js` ("no event at all, the first opening included…"), `scripts/__tests__/check-dist-events.test.js`, `e2e/events.spec.js`.
- [x] **IP address not kept.** The worker never stores the IP: only, for the rate limit, a salted one-way hash of the IP and the day, deleted within three minutes by each event and by the job every minute (`scheduled` in `worker.js`). No geolocation is derived. Evidence: `usage.test.js` ("limits the events per IP per minute, without storing the IP"; "forgets the rate keys of past minutes at each event, and hashes an IP differently every day"), `schema.sql` (no IP column in `usage_daily`).

Not covered by this list, and open: the other conditions of the CNIL's guidelines (among them how long the totals are kept; the totals have no deletion job today), the hosting terms and transfers of Cloudflare as processor, the DPIA and the lawyer's review (WP2.1), and the full legal notice (WP2.2, `Legal.jsx`). The exemption is the CNIL's reading of French law; whether these counts fall within it is for the lawyer's review, not for this list.

## Endpoints

| Method and path | Who | What |
|---|---|---|
| `POST /event` | the app | One event, or `{ "events": [ ... ] }` with 1 to 20. Body read as JSON whatever its content type (the app sends `text/plain`, so no preflight). 204 on success; 400, 413, 422 or 429 otherwise. At most 120 events per IP per minute. |
| `GET /stats?days=30` | `STATS_TOKEN` | The daily counts of the last 1 to 366 days, as JSON: `{ from, to, rows: [{ day, event, lift, tier, durationBucket, appVersion, lang, count }] }`. |
| `GET /dashboard?days=30` | `STATS_TOKEN` | Without the token: a form that asks for it (401). With it, the same counts as HTML tables: by day (opens, lifts chosen, videos chosen, analyses started, counted, not counted, refused, failed, cancelled, kept, corrected, reports, shares), by lift, visit length, opens by version and language. |
| `POST /dashboard` | `STATS_TOKEN` | The form's answer: `token` and `days` in an `application/x-www-form-urlencoded` body (at most 1 KB); the dashboard, or the form again with "Wrong token." (401). |
| `GET /feedback` | `STATS_TOKEN` | The aggregates of the old `feedback` table (open to anyone before 3 October). |
| `POST /ingest` | nobody | Removed on 3 October 2026 (WP0.4): 404, nothing stored. |

The token goes in `Authorization: Bearer <token>`, and only there: since 3 October a `?token=` in the address is refused, even when right, since an address is kept in the browser's history and its sync, and in proxy and access logs. In a browser, open `/dashboard` and type the token in its form: it is posted in the request's body, never put in the address (a password manager may offer to keep it). The pages are not cached, send no referrer, post only to the worker and cannot be framed. With no `STATS_TOKEN` set, or one shorter than 16 characters, the three reading endpoints answer 401 to everyone.

## Deploy (David)

Once, from this folder, with a Cloudflare account:

```bash
npm install -g wrangler
npx wrangler login
npx wrangler d1 create workout-vision-feedback          # copy the database_id into wrangler.toml
npx wrangler d1 execute workout-vision-feedback --remote --file=schema.sql
npx wrangler secret put STATS_TOKEN                     # a long random string, e.g. from: openssl rand -hex 24
npx wrangler secret put RATE_SALT                       # another one; without it each worker copy makes its own in memory
npx wrangler deploy                                     # prints https://workout-vision-feedback.<you>.workers.dev
```

`./deploy.sh` does the database, schema and deploy steps; the two secrets are still set by hand.

`npx wrangler deploy` also sets the job that runs every minute to delete the rate limit's hashes (`[triggers] crons` in `wrangler.toml`); `npx wrangler triggers deploy` sets it alone. Cron triggers are part of Cloudflare's free plan.

A database created before 3 October gets the new tables with:

```bash
npx wrangler d1 execute workout-vision-feedback --remote --file=migrations/0001_usage.sql
```

Then the app, so it sends the counts:

1. In GitHub, Settings, Secrets and variables, Actions, Variables: add `VITE_EVENTS_URL` = `https://workout-vision-feedback.<you>.workers.dev/event`. The deploy workflow (`.github/workflows/deploy.yml`) passes it to the build (`VITE_EVENTS_URL: ${{ vars.VITE_EVENTS_URL }}`, D6 of 15 October 2026). Unset, the app sends nothing and a deploy step (`scripts/check-dist-events.mjs`) fails if the built site holds any events URL. Set, the same step fails if the site holds any other events origin, or if the built notice (`UsageNotice.jsx`) does not name the variable's host (PRIV-3).
2. Push to main (or re-run the deploy). The build adds the worker's origin to the page's `connect-src` (`vite.config.js`, `eventsCspPlugin`); a value that is not https fails the build. Without the variable, the app sends nothing and its policy is unchanged.
3. On the iPhone: open the app, check the line under the choice of lift and its notice ("Ce qui est compté"), then open `https://workout-vision-feedback.<you>.workers.dev/dashboard` and type the token in the form: today's row shows one Open.

Check from a terminal:

```bash
curl -i -X POST https://workout-vision-feedback.<you>.workers.dev/event -H 'Content-Type: text/plain' \
  -d '{"event":"open","appVersion":"deploy-test","lang":"en"}'     # 204
curl -H "Authorization: Bearer $STATS_TOKEN" 'https://workout-vision-feedback.<you>.workers.dev/stats?days=1'
curl -H "Authorization: Bearer $STATS_TOKEN" 'https://workout-vision-feedback.<you>.workers.dev/dashboard?days=30' > usage.html   # the dashboard, to open from a file
```

To stop the counts: remove the `VITE_EVENTS_URL` variable and deploy the app again. To erase them: `npx wrangler d1 execute workout-vision-feedback --remote --command "DELETE FROM usage_daily"`.

## The old feedback table: what David must do (D24)

No wrangler command is run by the code or by an agent. If the worker was ever deployed:

1. In the Cloudflare dashboard, check whether `workout-vision-feedback` is deployed, and redeploy it from this folder (`npx wrangler deploy`) so the live copy no longer accepts `/ingest`.
2. See whether the `feedback` table holds rows: `npx wrangler d1 execute workout-vision-feedback --remote --command "SELECT COUNT(*), MIN(created_at), MAX(created_at) FROM feedback"`.
3. Under D24 (R5: his explicit approval), export it (`npx wrangler d1 export workout-vision-feedback --remote --table=feedback --output=feedback-export.sql`, kept off the repository), then drop it (`--command "DROP TABLE feedback"`). Removing the table from `schema.sql` and `GET /feedback` is a later commit, after that decision.

## Tests

`npx vitest run feedback-worker` runs the worker against SQLite (`node:sqlite`), as D1 runs it: `worker.test.js` (`/ingest` answers 404 and writes nothing, the `feedback` table is left as it is, the usage endpoints still answer) and `usage.test.js` (usage counts: what is kept, what is refused, the rate limit and the job every minute that deletes its hashes, the token in the header only, the dashboard's form, the schema).

## Schema

`schema.sql` creates every table; `migrations/0001_usage.sql` adds the usage tables to an existing database (a test checks the two match). The `feedback` table (kinds: correction, crash, feedback, rating) is no longer written by anything; it is kept until David decides D24.
