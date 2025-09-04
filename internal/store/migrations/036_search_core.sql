-- Search document store (source of truth)
CREATE TABLE IF NOT EXISTS search_docs (
  id INTEGER PRIMARY KEY,                -- auto rowid (used by FTS content_rowid)
  entity_type TEXT NOT NULL,             -- 'project'|'service'|'route'|'setting'
  entity_id   INTEGER NOT NULL,          -- FK to specific table (when applicable)
  title       TEXT NOT NULL,             -- e.g., 'redis-cache', 'api-gateway'
  subtitle    TEXT,                      -- short detail (image, domain, etc.)
  body        TEXT,                      -- safe text (description, notes); no secrets
  tags        TEXT,                      -- space-delimited or CSV tag string
  project_id  INTEGER,                   -- optional for scoping/filters
  url_path    TEXT NOT NULL,             -- SPA route to open (/app/services/:id)
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(entity_type, entity_id)
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_search_docs_entity ON search_docs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_search_docs_project ON search_docs(project_id);
CREATE INDEX IF NOT EXISTS idx_search_docs_updated ON search_docs(updated_at DESC);

-- Note: FTS5 virtual table and triggers will be created dynamically by Go code
-- if FTS5 is available. This migration only creates the base search_docs table.