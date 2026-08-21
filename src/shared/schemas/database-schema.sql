CREATE TABLE IF NOT EXISTS JIRA_ISSUES (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL,
  project TEXT,
  issuetype TEXT,
  issuetype_icon_url TEXT,
  summary TEXT,
  description TEXT,
  status TEXT,
  reporter TEXT,
  assignee TEXT,
  created TEXT,
  updated TEXT,
  resolutiondate TEXT,
  parent TEXT,
  timeestimate INTEGER,
  timespent INTEGER,
  timeremaining INTEGER NOT NULL DEFAULT 0,
  issuelinks TEXT
);

CREATE TABLE IF NOT EXISTS JIRA_PROJECT_GROUPS (
  id TEXT PRIMARY KEY,
  root_issue_id TEXT,
  root_issue_key TEXT,
  estado_general TEXT,
  created TEXT,
  updated TEXT
);

CREATE TABLE IF NOT EXISTS JIRA_PROJECT_GROUP_ISSUES (
  project_group_id TEXT NOT NULL,
  issue_id TEXT NOT NULL,
  is_root INTEGER NOT NULL DEFAULT 0,
  depth INTEGER NOT NULL DEFAULT 0,
  relation_type TEXT,
  created TEXT,
  PRIMARY KEY (project_group_id, issue_id)
);

CREATE TABLE IF NOT EXISTS JIRA_RELATIONSHIPS (
  id TEXT PRIMARY KEY,
  project_group_id TEXT NOT NULL,
  from_issue_id TEXT NOT NULL,
  to_issue_id TEXT NOT NULL,
  relation_type TEXT,
  link_type TEXT,
  created TEXT
);

CREATE TABLE IF NOT EXISTS ALERT_RULES (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sql TEXT NOT NULL,
  toast_text TEXT,
  toast_image TEXT,
  condition_config TEXT,
  retry_syncs INTEGER NOT NULL DEFAULT 0,
  retry_minutes INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created TEXT,
  updated TEXT
);

CREATE TABLE IF NOT EXISTS ALERTS (
  id TEXT PRIMARY KEY,
  rule_id TEXT NOT NULL,
  issue_id TEXT NOT NULL,
  project_group_id TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created TEXT,
  updated TEXT,
  last_notified_at TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  next_retry_sync INTEGER NOT NULL DEFAULT 0,
  next_retry_at TEXT,
  payload_json TEXT
);

CREATE TABLE IF NOT EXISTS SETTINGS (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated TEXT
);

CREATE TABLE IF NOT EXISTS GRID_DEFINITIONS (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  page_size INTEGER NOT NULL DEFAULT 25,
  columns_json TEXT NOT NULL,
  conditions_json TEXT NOT NULL,
  is_visible INTEGER NOT NULL DEFAULT 1,
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS SYNC_STATUS (
  id TEXT PRIMARY KEY,
  last_status TEXT,
  last_started_at TEXT,
  last_finished_at TEXT,
  last_success_at TEXT,
  last_error_message TEXT,
  is_running INTEGER NOT NULL DEFAULT 0,
  is_canceling INTEGER NOT NULL DEFAULT 0,
  next_sync_at TEXT
);

CREATE TABLE IF NOT EXISTS SYNC_CHANGES (
  sync_id TEXT NOT NULL,
  project_group_id TEXT,
  issue_id TEXT NOT NULL,
  issue_key TEXT NOT NULL,
  change_type TEXT NOT NULL,
  changed_fields TEXT,
  before_json TEXT,
  after_json TEXT,
  created TEXT NOT NULL,
  PRIMARY KEY (sync_id, project_group_id, issue_id, change_type)
);
