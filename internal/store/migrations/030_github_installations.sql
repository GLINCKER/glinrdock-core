-- GitHub App installations table
CREATE TABLE IF NOT EXISTS github_installations (
    id INTEGER PRIMARY KEY, -- GitHub installation ID
    account_login TEXT NOT NULL,
    account_type TEXT NOT NULL, -- 'User' or 'Organization'
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_github_installations_account ON github_installations (account_login, account_type);

-- Trigger to update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_github_installations_updated_at 
AFTER UPDATE ON github_installations
BEGIN
    UPDATE github_installations SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;