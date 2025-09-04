CREATE TABLE IF NOT EXISTS certificates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  domain TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'uploaded',  -- 'uploaded'|'letsencrypt'|'self-signed'
  cert_data TEXT,  -- PEM (nullable for letsencrypt until provisioned)
  key_data TEXT,   -- PEM (nullable for letsencrypt until provisioned)
  expires_at DATETIME,
  auto_renew BOOLEAN NOT NULL DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);