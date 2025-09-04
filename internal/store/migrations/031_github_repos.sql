-- GitHub repositories table
CREATE TABLE IF NOT EXISTS github_repos (
    id INTEGER PRIMARY KEY, -- GitHub repository ID
    full_name TEXT NOT NULL UNIQUE, -- owner/repo
    installation_id INTEGER NOT NULL,
    active BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (installation_id) REFERENCES github_installations(id) ON DELETE CASCADE
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_github_repos_installation ON github_repos (installation_id);
CREATE INDEX IF NOT EXISTS idx_github_repos_full_name ON github_repos (full_name);
CREATE INDEX IF NOT EXISTS idx_github_repos_active ON github_repos (active);

-- Trigger to update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_github_repos_updated_at 
AFTER UPDATE ON github_repos
BEGIN
    UPDATE github_repos SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;