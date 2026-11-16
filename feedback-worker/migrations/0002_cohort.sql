-- Usage per phone (16 November 2026; David: "Yes to the tracking, build it"). Apply to the existing database:
--   npx wrangler d1 execute workout-vision-feedback --remote --file=migrations/0002_cohort.sql
-- aid is an HMAC of the phone's random id keyed with the AID_PEPPER secret, cut to 64 bits (usage.js storedAid); no IP,
-- no time finer than the day. Rows older than 25 months are deleted by the worker's job (usage.js purgeCohorts). The
-- kiné path is never written here (usage-schema.js AGGREGATE_ONLY).
CREATE TABLE IF NOT EXISTS usage_event (
  aid TEXT NOT NULL,
  day TEXT NOT NULL,                       -- UTC day, YYYY-MM-DD
  sess INTEGER NOT NULL,                   -- the visit's number on the phone
  seq INTEGER NOT NULL,                    -- the step's order in the visit
  event TEXT NOT NULL,
  lift TEXT NOT NULL DEFAULT '',
  tier TEXT NOT NULL DEFAULT '',
  duration_bucket TEXT NOT NULL DEFAULT '',
  app_version TEXT NOT NULL DEFAULT '',
  lang TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (aid, sess, seq)
);
CREATE INDEX IF NOT EXISTS idx_usage_event_day ON usage_event(day, event);
CREATE TABLE IF NOT EXISTS usage_active (
  aid TEXT NOT NULL,
  day TEXT NOT NULL,
  PRIMARY KEY (aid, day)
);
CREATE INDEX IF NOT EXISTS idx_usage_active_day ON usage_active(day);
CREATE TABLE IF NOT EXISTS usage_device (
  aid TEXT PRIMARY KEY,
  first_day TEXT NOT NULL,
  last_day TEXT NOT NULL
);
