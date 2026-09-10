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
