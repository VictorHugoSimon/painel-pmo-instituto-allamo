CREATE TABLE IF NOT EXISTS audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           TEXT,
  actor        TEXT,
  role         TEXT,
  company_id   TEXT,
  action       TEXT,
  target       TEXT,
  detail       TEXT
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(id DESC);
