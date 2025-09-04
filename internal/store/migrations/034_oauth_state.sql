-- OAuth state storage for CSRF protection and PKCE verifiers
CREATE TABLE IF NOT EXISTS oauth_state (
    state TEXT PRIMARY KEY,
    verifier_hash BLOB, -- Encrypted PKCE code_verifier (null for confidential mode)
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NOT NULL
);

-- Index for cleanup of expired states
CREATE INDEX IF NOT EXISTS idx_oauth_state_expires_at ON oauth_state (expires_at);

-- Cleanup trigger to remove expired states
CREATE TRIGGER IF NOT EXISTS cleanup_expired_oauth_state
AFTER INSERT ON oauth_state
BEGIN
    DELETE FROM oauth_state WHERE expires_at < datetime('now');
END;