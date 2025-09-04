-- Create clients table for tracking connected clients and integrations
CREATE TABLE clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    token_id INTEGER REFERENCES tokens(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'active',  -- 'active'|'idle'|'disconnected'
    last_ip TEXT,
    last_seen_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient status queries
CREATE INDEX idx_clients_status ON clients(status);

-- Index for efficient token lookups
CREATE INDEX idx_clients_token_id ON clients(token_id);

-- Index for last seen queries
CREATE INDEX idx_clients_last_seen ON clients(last_seen_at);

-- Trigger to update updated_at timestamp
CREATE TRIGGER clients_updated_at
    AFTER UPDATE ON clients
    FOR EACH ROW
BEGIN
    UPDATE clients SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;