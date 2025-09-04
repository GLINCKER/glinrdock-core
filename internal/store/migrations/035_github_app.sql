-- GitHub App Integration Tables
-- Migration: 035_github_app.sql

-- GitHub App installations (tracked automatically via webhooks)
CREATE TABLE IF NOT EXISTS github_installations (
    id INTEGER PRIMARY KEY,
    installation_id INTEGER NOT NULL UNIQUE,
    account_login TEXT NOT NULL,
    account_id INTEGER NOT NULL,
    account_type TEXT NOT NULL, -- 'Organization' or 'User'
    permissions TEXT, -- JSON blob of permissions
    events TEXT, -- JSON array of subscribed events
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    suspended_at DATETIME,
    suspended_by TEXT
);

-- GitHub repositories available through installations
CREATE TABLE IF NOT EXISTS github_repositories (
    id INTEGER PRIMARY KEY,
    repository_id INTEGER NOT NULL,
    installation_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    full_name TEXT NOT NULL,
    owner_login TEXT NOT NULL,
    private INTEGER NOT NULL DEFAULT 0,
    default_branch TEXT NOT NULL DEFAULT 'main',
    clone_url TEXT NOT NULL,
    ssh_url TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(repository_id, installation_id),
    FOREIGN KEY(installation_id) REFERENCES github_installations(installation_id) ON DELETE CASCADE
);

-- Repository activation mappings (admin-configured)
CREATE TABLE IF NOT EXISTS github_repo_mappings (
    id INTEGER PRIMARY KEY,
    repository_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    branch_filter TEXT, -- regex pattern for branches to build (default: all)
    build_context TEXT, -- dockerfile path or build context
    build_args TEXT, -- JSON object of build args
    auto_deploy INTEGER NOT NULL DEFAULT 0, -- auto-deploy on successful build
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL, -- user who activated
    
    UNIQUE(repository_id, project_id),
    FOREIGN KEY(repository_id) REFERENCES github_repositories(repository_id) ON DELETE CASCADE,
    FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- GitHub App webhook events log (for debugging and audit)
CREATE TABLE IF NOT EXISTS github_webhook_events (
    id INTEGER PRIMARY KEY,
    event_type TEXT NOT NULL,
    event_action TEXT,
    installation_id INTEGER,
    repository_id INTEGER,
    payload_hash TEXT NOT NULL, -- SHA256 of payload for deduplication
    processed_at DATETIME,
    error_message TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for github_webhook_events table
CREATE INDEX IF NOT EXISTS idx_github_webhook_events_type ON github_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_github_webhook_events_installation ON github_webhook_events(installation_id);
CREATE INDEX IF NOT EXISTS idx_github_webhook_events_repo ON github_webhook_events(repository_id);
CREATE INDEX IF NOT EXISTS idx_github_webhook_events_hash ON github_webhook_events(payload_hash);

-- Update triggers for timestamps
CREATE TRIGGER IF NOT EXISTS github_installations_updated_at
    AFTER UPDATE ON github_installations
    FOR EACH ROW
    BEGIN
        UPDATE github_installations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS github_repositories_updated_at
    AFTER UPDATE ON github_repositories
    FOR EACH ROW
    BEGIN
        UPDATE github_repositories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS github_repo_mappings_updated_at
    AFTER UPDATE ON github_repo_mappings
    FOR EACH ROW
    BEGIN
        UPDATE github_repo_mappings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;