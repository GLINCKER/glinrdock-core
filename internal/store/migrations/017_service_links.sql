-- Add service links table for internal networking relationships
CREATE TABLE IF NOT EXISTS service_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    service_id INTEGER NOT NULL,
    target_id INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign key constraints
    FOREIGN KEY (service_id) REFERENCES services (id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES services (id) ON DELETE CASCADE,
    
    -- Unique constraint to prevent duplicate links
    UNIQUE (service_id, target_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_links_service_id ON service_links (service_id);
CREATE INDEX IF NOT EXISTS idx_service_links_target_id ON service_links (target_id);