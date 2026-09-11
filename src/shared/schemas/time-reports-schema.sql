CREATE TABLE IF NOT EXISTS TIME_REPORTS (
  id TEXT PRIMARY KEY,
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL,
  user_account_id TEXT NOT NULL,
  user_display_name TEXT NOT NULL,
  status TEXT NOT NULL,
  pdf_file TEXT,
  error TEXT,
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS TIME_REPORT_ISSUES (
  report_id TEXT NOT NULL,
  issue_id TEXT NOT NULL,
  issue_key TEXT NOT NULL,
  project TEXT,
  issue_type TEXT,
  summary TEXT,
  status TEXT,
  reporter TEXT,
  assignee TEXT,
  created TEXT,
  resolutiondate TEXT,
  range_seconds INTEGER NOT NULL DEFAULT 0,
  total_seconds INTEGER NOT NULL DEFAULT 0,
  planned_seconds INTEGER,
  spent_seconds INTEGER,
  remaining_seconds INTEGER,
  assigned_at TEXT,
  started_at TEXT,
  closed_at TEXT,
  selected INTEGER NOT NULL DEFAULT 1,
  data_json TEXT NOT NULL,
  PRIMARY KEY (report_id, issue_id)
);

CREATE TABLE IF NOT EXISTS TIME_REPORT_CORRECTIONS (
  report_id TEXT NOT NULL,
  issue_key TEXT NOT NULL,
  correction_key TEXT NOT NULL,
  summary TEXT,
  status TEXT,
  project_group_id TEXT,
  PRIMARY KEY (report_id, issue_key, correction_key, project_group_id)
);

CREATE TABLE IF NOT EXISTS TIME_REPORT_IMPROVEMENTS (
  report_id TEXT NOT NULL,
  issue_id TEXT NOT NULL,
  issue_key TEXT NOT NULL,
  memo TEXT NOT NULL,
  created TEXT NOT NULL,
  updated TEXT NOT NULL,
  PRIMARY KEY (report_id, issue_id)
);
