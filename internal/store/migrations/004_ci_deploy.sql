PRAGMA foreign_keys = ON;

CREATE TABLE builds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    git_url TEXT NOT NULL,
    git_ref TEXT NOT NULL,
    context_path TEXT NOT NULL DEFAULT '.',
    dockerfile TEXT NOT NULL DEFAULT 'Dockerfile',
    image_tag TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued',
    log_path TEXT,
    started_at DATETIME,
    finished_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_builds_service ON builds(service_id, created_at DESC);

CREATE TABLE deployments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    image_tag TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_deployments_service ON deployments(service_id, created_at DESC);