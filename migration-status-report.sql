CREATE TABLE IF NOT EXISTS project_reports (
  company_id   TEXT PRIMARY KEY,
  ref          TEXT,
  data_json    TEXT,
  updated_at   TEXT,
  updated_by   TEXT
);
CREATE TABLE IF NOT EXISTS report_snapshots (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id   TEXT,
  ref          TEXT,
  data_json    TEXT,
  taken_at     TEXT
);
CREATE INDEX IF NOT EXISTS idx_snap_company ON report_snapshots(company_id, id DESC);
