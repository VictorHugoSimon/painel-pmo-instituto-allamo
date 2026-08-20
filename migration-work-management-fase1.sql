ALTER TABLE issues ADD COLUMN type TEXT DEFAULT 'task';
ALTER TABLE issues ADD COLUMN description TEXT;
ALTER TABLE issues ADD COLUMN parent_id TEXT;
ALTER TABLE issues ADD COLUMN sprint_id INTEGER;
ALTER TABLE issues ADD COLUMN release_id INTEGER;
ALTER TABLE issues ADD COLUMN start_date TEXT;
ALTER TABLE issues ADD COLUMN story_points REAL;
ALTER TABLE issues ADD COLUMN rank_order REAL DEFAULT 0;
ALTER TABLE issues ADD COLUMN reporter TEXT;
ALTER TABLE issues ADD COLUMN created_at TEXT;
ALTER TABLE issues ADD COLUMN archived_at TEXT;

CREATE TABLE IF NOT EXISTS sprints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT NOT NULL,
  project TEXT NOT NULL,
  name TEXT NOT NULL,
  goal TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  start_date TEXT,
  end_date TEXT,
  capacity REAL,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

CREATE TABLE IF NOT EXISTS issue_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT NOT NULL,
  issue_id TEXT NOT NULL,
  linked_issue_id TEXT NOT NULL,
  link_type TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (issue_id) REFERENCES issues(id),
  FOREIGN KEY (linked_issue_id) REFERENCES issues(id)
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

CREATE TABLE IF NOT EXISTS issue_checklist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT NOT NULL,
  issue_id TEXT NOT NULL,
  label TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 0,
  rank_order REAL DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT,
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (issue_id) REFERENCES issues(id)
);

CREATE TABLE IF NOT EXISTS work_event_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company_id TEXT,
  actor TEXT,
  event_name TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  project TEXT,
  metadata_json TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_issues_sprint ON issues(sprint_id);
CREATE INDEX IF NOT EXISTS idx_issues_parent ON issues(parent_id);
CREATE INDEX IF NOT EXISTS idx_issues_rank ON issues(company_id, project, rank_order);
CREATE INDEX IF NOT EXISTS idx_sprints_company_project ON sprints(company_id, project, status);
CREATE INDEX IF NOT EXISTS idx_issue_links_issue ON issue_links(issue_id);
CREATE INDEX IF NOT EXISTS idx_issue_comments_issue ON issue_comments(issue_id, id DESC);
CREATE INDEX IF NOT EXISTS idx_issue_checklist_issue ON issue_checklist_items(issue_id, rank_order);
CREATE INDEX IF NOT EXISTS idx_work_event_company_created ON work_event_log(company_id, id DESC);
