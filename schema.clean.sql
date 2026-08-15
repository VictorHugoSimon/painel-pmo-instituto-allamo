CREATE TABLE companies (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  city         TEXT,
  system       TEXT,          
  own_system   INTEGER DEFAULT 0,  
  lead         TEXT,          
  start_date   TEXT,
  status       TEXT,          
  status_text  TEXT,
  pmo_mode     TEXT,          
  progress     INTEGER,       
  summary      TEXT
);

CREATE TABLE projects (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  company_id   TEXT REFERENCES companies(id),
  status       TEXT,          
  badge        TEXT,
  urgency      TEXT,
  summary      TEXT,
  lead         TEXT,
  start_date   TEXT,
  meta_date    TEXT,
  pmo_read     TEXT,          
  note         TEXT,
  linear_url   TEXT
);

CREATE TABLE issues (
  id           TEXT PRIMARY KEY,   
  title        TEXT NOT NULL,
  project      TEXT,
  company_id   TEXT REFERENCES companies(id),
  status       TEXT,
  priority     TEXT,
  owner        TEXT,
  due_date     TEXT,
  flag         TEXT,
  flag_type    TEXT            
);

CREATE TABLE gmud (
  id           TEXT PRIMARY KEY,   
  title        TEXT NOT NULL,
  company_id   TEXT REFERENCES companies(id),
  type         TEXT,          
  risk         TEXT,          
  status       TEXT,          
  requester    TEXT,
  approver     TEXT,
  window_txt   TEXT,
  affects      TEXT,
  rollback     TEXT,
  client_visible INTEGER DEFAULT 1,
  created_at   TEXT DEFAULT (datetime('now')),
  decided_by   TEXT,
  decided_at   TEXT
);

CREATE TABLE releases (   
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  rel_date     TEXT,
  weekday      TEXT,
  company_id   TEXT REFERENCES companies(id),
  title        TEXT NOT NULL,
  description  TEXT,
  tags         TEXT           
);

CREATE TABLE documents (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id   TEXT REFERENCES companies(id),
  name         TEXT NOT NULL,
  doc_type     TEXT,
  doc_date     TEXT,
  ext          TEXT,          
  url          TEXT
);

CREATE TABLE users (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  email        TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, 
  role         TEXT NOT NULL,  
  company_id   TEXT REFERENCES companies(id),  
  status       TEXT DEFAULT 'Ativo',  
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  token        TEXT PRIMARY KEY,
  user_id      INTEGER REFERENCES users(id),
  expires_at   TEXT NOT NULL
);

CREATE INDEX idx_issues_company ON issues(company_id);
CREATE INDEX idx_gmud_company   ON gmud(company_id);
CREATE INDEX idx_projects_company ON projects(company_id);
CREATE INDEX idx_users_company  ON users(company_id);

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
