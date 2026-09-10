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
  created_at TEXT NOT NULL
);

CREATE INDEX idx_feedback_kind ON feedback(kind);
CREATE INDEX idx_feedback_detected ON feedback(detected, corrected);
CREATE INDEX idx_feedback_created ON feedback(created_at);
