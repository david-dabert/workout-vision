# Workout Vision Feedback Worker

Cloudflare Worker + D1. Two jobs:

- **Usage counts** (since 3 October 2026): anonymous daily totals of what the app's screens and analyses are used for, so David knows how many people use the app and how far they get (`usage.js`, `usage-schema.js`).
- **Feedback** (dormant): structured feedback through `POST /ingest`. The app does not call it.

## What the usage counts keep, and what they do not

The app (`src/lib/events.js`) sends, only when its build names this worker (`VITE_EVENTS_URL`):
an event name from the list in `usage-schema.js`, the lift and its tier where the event carries them, a visit's length in one of four buckets (`<1`, `1-5`, `5-15`, `>15` minutes), the app version and the language (`fr` or `en`).

The worker keeps one row per UTC day and combination of those fields, holding a count (`usage_daily`). It never reads the user agent or the referrer. It keeps:

- no IP address, no user or device id, no cookie, no time finer than the day, no row per event;
- for the rate limit only, a salted, one-way hash of the IP and the day, with its hits in one minute (`usage_rate`), deleted after two minutes and never joined to the counts.

Anything else in a request (an unknown event, an extra field, a value outside its list) is refused whole with 422, and nothing of it is stored. The app sends nothing when the browser sends Global Privacy Control or Do Not Track, or after the person taps "Désactiver" / "Turn off" under the choice of lift.

The counts are of events, not of people: no row can be tied to a person or a phone, so "people" can only be estimated from `open` (one per page load) and `session_end` (one per visit).

## Endpoints

| Method and path | Who | What |
|---|---|---|
| `POST /event` | the app | One event, or `{ "events": [ ... ] }` with 1 to 20. Body read as JSON whatever its content type (the app sends `text/plain`, so no preflight). 204 on success; 400, 413, 422 or 429 otherwise. At most 120 events per IP per minute. |
| `GET /stats?days=30` | `STATS_TOKEN` | The daily counts of the last 1 to 366 days, as JSON: `{ from, to, rows: [{ day, event, lift, tier, durationBucket, appVersion, lang, count }] }`. |
| `GET /dashboard?days=30` | `STATS_TOKEN` | The same as HTML tables: by day (opens, lifts chosen, videos chosen, analyses started, counted, not counted, refused, failed, cancelled, kept, corrected, reports, shares), by lift, visit length, opens by version and language. |
| `GET /feedback` | `STATS_TOKEN` | The feedback aggregates (open to anyone before 3 October). |
| `POST /ingest` | (dormant) | Feedback, max 4 KB, no landmarks, video or frames. |

The token goes in `Authorization: Bearer <token>`, or, for the dashboard in a browser, `?token=<token>` (the page sends no referrer and is not cached). With no `STATS_TOKEN` set, or one shorter than 16 characters, the three reading endpoints answer 401 to everyone.

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

A database created before 3 October gets the new tables with:

```bash
npx wrangler d1 execute workout-vision-feedback --remote --file=migrations/0001_usage.sql
```

Then the app, so it sends the counts:

1. In GitHub, Settings, Secrets and variables, Actions, Variables: add `VITE_EVENTS_URL` = `https://workout-vision-feedback.<you>.workers.dev/event`. The deploy workflow (`.github/workflows/deploy.yml`) passes it to the build.
2. Push to main (or re-run the deploy). The build adds the worker's origin to the page's `connect-src` (`vite.config.js`, `eventsCspPlugin`); a value that is not https fails the build. Without the variable, the app sends nothing and its policy is unchanged.
3. On the iPhone: open the app, check the line under the choice of lift, then open `https://workout-vision-feedback.<you>.workers.dev/dashboard?token=<token>`: today's row shows one Open.

Check from a terminal:

```bash
curl -i -X POST https://workout-vision-feedback.<you>.workers.dev/event -H 'Content-Type: text/plain' \
  -d '{"event":"open","appVersion":"deploy-test","lang":"en"}'     # 204
curl -H "Authorization: Bearer $STATS_TOKEN" 'https://workout-vision-feedback.<you>.workers.dev/stats?days=1'
```

To stop the counts: remove the `VITE_EVENTS_URL` variable and deploy the app again. To erase them: `npx wrangler d1 execute workout-vision-feedback --remote --command "DELETE FROM usage_daily"`.

## Tests

`npx vitest run feedback-worker` runs the worker against SQLite (`node:sqlite`), as D1 runs it: `rate-limit.test.js` (feedback) and `usage.test.js` (usage counts: what is kept, what is refused, the rate limit, the token, the schema).

## Schema

`schema.sql` creates every table; `migrations/0001_usage.sql` adds the usage tables to an existing database (a test checks the two match). Feedback kinds: correction, crash, feedback, rating.
