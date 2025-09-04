PRAGMA foreign_keys = ON;

CREATE TABLE certs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    status TEXT NOT NULL,            -- issued, failed, renewing
    last_issued_at DATETIME,
    expires_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_certs_domain ON certs(domain);
CREATE INDEX ix_certs_expires_at ON certs(expires_at);
CREATE INDEX ix_certs_status ON certs(status);