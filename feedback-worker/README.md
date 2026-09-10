# Workout Vision Feedback Worker

Cloudflare Worker + D1 that receives anonymous structured feedback from the app.

## Setup

1. Install wrangler: `npm install -g wrangler`
2. Login: `npx wrangler login`
3. Create D1 database: `npx wrangler d1 create workout-vision-feedback`
4. Copy the database_id into wrangler.toml
5. Run schema: `npx wrangler d1 execute workout-vision-feedback --file=schema.sql`
6. Deploy: `npx wrangler deploy`

## Endpoints

- `POST /ingest` - submit feedback (max 4KB, no landmarks/video/frames allowed)
- `GET /dashboard` - read-only aggregate stats

## Schema

See schema.sql. Feedback kinds: correction, crash, feedback, rating.
