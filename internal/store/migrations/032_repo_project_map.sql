-- Repo-to-project mapping for quickstart templates
CREATE TABLE IF NOT EXISTS repo_project_map (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    repo_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    dockerfile TEXT DEFAULT 'Dockerfile',
    context TEXT DEFAULT '.',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (repo_id) REFERENCES github_repos(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    UNIQUE(repo_id, project_id)
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_repo_project_map_repo ON repo_project_map (repo_id);
CREATE INDEX IF NOT EXISTS idx_repo_project_map_project ON repo_project_map (project_id);

-- Trigger to update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_repo_project_map_updated_at 
AFTER UPDATE ON repo_project_map
BEGIN
    UPDATE repo_project_map SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;