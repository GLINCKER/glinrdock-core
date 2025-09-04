-- Add system configuration table for onboarding and other system-wide settings
CREATE TABLE IF NOT EXISTS system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert default onboarding needed flag (true initially)
INSERT OR REPLACE INTO system_config (key, value) VALUES ('onboarding_completed', 'false');