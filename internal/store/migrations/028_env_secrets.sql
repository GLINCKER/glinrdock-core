-- Migration 028: Add env_vars table for encrypted environment variable storage
-- This table stores both plain text and encrypted environment variables for services

CREATE TABLE IF NOT EXISTS env_vars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    is_secret BOOLEAN NOT NULL DEFAULT FALSE,
    value TEXT NULL,              -- For non-secret values (plain text)
    nonce BLOB NULL,              -- For secret values (AES-GCM nonce)
    ciphertext BLOB NULL,         -- For secret values (encrypted data)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_service_key UNIQUE (service_id, key),
    CONSTRAINT fk_env_vars_service FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE,
    CONSTRAINT check_secret_fields CHECK (
        (is_secret = FALSE AND value IS NOT NULL AND nonce IS NULL AND ciphertext IS NULL) OR
        (is_secret = TRUE AND value IS NULL AND nonce IS NOT NULL AND ciphertext IS NOT NULL)
    )
);

-- Index for efficient lookups by service
CREATE INDEX IF NOT EXISTS idx_env_vars_service_id ON env_vars(service_id);

-- Index for efficient lookups by key
CREATE INDEX IF NOT EXISTS idx_env_vars_key ON env_vars(key);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_env_vars_updated_at
    AFTER UPDATE ON env_vars
    FOR EACH ROW
BEGIN
    UPDATE env_vars SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;