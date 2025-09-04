-- 015_audit.sql: Add audit logging table
CREATE TABLE IF NOT EXISTS audit_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    meta TEXT NOT NULL DEFAULT '{}',
    
    CONSTRAINT check_action CHECK (action IN (
        'token_create', 'token_delete',
        'service_start', 'service_stop', 'service_restart', 'service_deploy', 'service_scale',
        'system_lockdown', 'system_restart',
        'license_activate', 'license_deactivate',
        'project_create', 'project_delete',
        'route_create', 'route_delete',
        'client_register'
    ))
);

-- Index for efficient querying by timestamp (most recent first)
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_entries(timestamp DESC);

-- Index for querying by actor
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_entries(actor);

-- Index for querying by action type
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_entries(action);