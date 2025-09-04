-- Drop existing domains table and recreate with new schema
DROP TABLE IF EXISTS domains;

CREATE TABLE domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',          -- pending|verifying|verified|active|error
  provider TEXT,                                   -- 'cloudflare'|'manual'|NULL
  zone_id TEXT,                                    -- provider zone identifier
  verification_token TEXT NOT NULL,                -- random token
  verification_checked_at DATETIME,
  certificate_id INTEGER,                          -- nullable FK to certificates
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_domains_status ON domains(status);