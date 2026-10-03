-- Anonymous usage counts (analytics, 3 October 2026). Apply to the existing database:
--   npx wrangler d1 execute workout-vision-feedback --remote --file=migrations/0001_usage.sql
-- One row per day and combination of fields, holding a count: no IP, no identifier, no time finer than the day.
CREATE TABLE IF NOT EXISTS usage_daily (
  day TEXT NOT NULL,                       -- UTC day, YYYY-MM-DD
  event TEXT NOT NULL,                     -- a name from usage-schema.js
  lift TEXT NOT NULL DEFAULT '',
  tier TEXT NOT NULL DEFAULT '',
  duration_bucket TEXT NOT NULL DEFAULT '',
  app_version TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL DEFAULT '',
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, event, lift, tier, duration_bucket, app_version, lang)
);

-- The rate limit: a salted daily hash of the IP and its hits in one minute, deleted after two minutes, never joined to
-- usage_daily.
CREATE TABLE IF NOT EXISTS usage_rate (
  key TEXT NOT NULL,
  minute INTEGER NOT NULL,
  hits INTEGER NOT NULL,
  PRIMARY KEY (key, minute)
);
CREATE INDEX IF NOT EXISTS idx_usage_rate_minute ON usage_rate(minute);
