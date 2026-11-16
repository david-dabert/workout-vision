CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT NOT NULL,
  app_version TEXT,
  device_class TEXT,
  detected TEXT,
  corrected TEXT,
  confidence REAL,
  rep_count INTEGER,
  rep_expected INTEGER,
  message TEXT,
  diag TEXT,
  ip_hash TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_kind ON feedback(kind);
CREATE INDEX IF NOT EXISTS idx_feedback_detected ON feedback(detected, corrected);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_ratelimit ON feedback(ip_hash, created_at);

-- Usage counts: the same as migrations/0001_usage.sql (a test checks they match).
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

-- Usage per phone: the same as migrations/0002_cohort.sql (a test checks they match).
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
