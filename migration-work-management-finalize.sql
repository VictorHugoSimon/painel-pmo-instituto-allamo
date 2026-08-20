CREATE TABLE IF NOT EXISTS sprints (
  id TEXT PRIMARY KEY,
  company_id TEXT NOT NULL,
  project_id INTEGER,
  name TEXT NOT NULL,
  goal TEXT,
  status TEXT NOT NULL DEFAULT 'PLANEJADA',
  start_date TEXT,
  end_date TEXT,
  capacity_points REAL,
  capacity_hours REAL,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  cancelled_at TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (project_id) REFERENCES projects(id)
);
CREATE TABLE IF NOT EXISTS issue_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT NOT NULL,
  source_issue_id TEXT NOT NULL,
  target_issue_id TEXT NOT NULL,
  link_type TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (source_issue_id) REFERENCES issues(id),
  FOREIGN KEY (target_issue_id) REFERENCES issues(id)
);
CREATE TABLE IF NOT EXISTS issue_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT NOT NULL,
  issue_id TEXT NOT NULL,
  author TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (issue_id) REFERENCES issues(id)
);
CREATE TABLE IF NOT EXISTS issue_checklist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT NOT NULL,
  issue_id TEXT NOT NULL,
  text TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  rank REAL DEFAULT 0,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,
  deleted_at TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (issue_id) REFERENCES issues(id)
);
CREATE TABLE IF NOT EXISTS work_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT,
  project_id INTEGER,
  issue_id TEXT,
  event_type TEXT,
  event_name TEXT NOT NULL,
  actor TEXT,
  session_id TEXT,
  screen TEXT,
  element TEXT,
  metadata_json TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (issue_id) REFERENCES issues(id)
);
CREATE INDEX IF NOT EXISTS idx_issues_sprint ON issues(sprint_id);
CREATE INDEX IF NOT EXISTS idx_issues_parent ON issues(parent_id);
CREATE INDEX IF NOT EXISTS idx_issues_rank ON issues(company_id, project_id, rank);
CREATE INDEX IF NOT EXISTS idx_issues_archived ON issues(archived_at);
CREATE INDEX IF NOT EXISTS idx_sprints_company_project ON sprints(company_id, project_id, status);
CREATE INDEX IF NOT EXISTS idx_issue_links_source ON issue_links(source_issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_links_target ON issue_links(target_issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_comments_issue ON issue_comments(issue_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_issue_checklist_issue ON issue_checklist(issue_id, rank);
CREATE INDEX IF NOT EXISTS idx_work_events_company_created ON work_events(company_id, id DESC);
UPDATE issues SET item_type='TASK' WHERE item_type IS NULL OR item_type='';
UPDATE issues SET source=CASE WHEN linear_url IS NOT NULL AND linear_url<>'' THEN 'linear' ELSE 'allamo' END WHERE source IS NULL OR source='';
UPDATE issues SET rank=CAST(strftime('%s','now') AS REAL) WHERE rank IS NULL OR rank=0;
UPDATE issues SET created_at=COALESCE(created_at,updated_at,datetime('now'));
