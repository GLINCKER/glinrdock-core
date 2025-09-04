CREATE TABLE routes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,                          -- Domain name (e.g., "api.example.com")
    port INTEGER NOT NULL,                         -- Target port on the service
    tls BOOLEAN NOT NULL DEFAULT FALSE,            -- Whether to enable TLS/HTTPS
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Ensure unique domain per service
CREATE UNIQUE INDEX ux_routes_service_domain ON routes(service_id, domain);

-- Index for fast domain lookups  
CREATE INDEX ix_routes_domain ON routes(domain);