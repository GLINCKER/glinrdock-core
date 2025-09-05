-- Extend existing DNS providers table for storing API credentials
-- Add new columns for specific credential storage instead of generic config_json

ALTER TABLE dns_providers ADD COLUMN label TEXT;
ALTER TABLE dns_providers ADD COLUMN email TEXT;
ALTER TABLE dns_providers ADD COLUMN api_token TEXT; -- Encrypted API token
ALTER TABLE dns_providers ADD COLUMN api_token_nonce TEXT; -- Encryption nonce for API token  
ALTER TABLE dns_providers ADD COLUMN settings TEXT; -- JSON blob for additional provider-specific settings
ALTER TABLE dns_providers ADD COLUMN active BOOLEAN DEFAULT TRUE;

-- Create unique index on label (only after column exists)
CREATE UNIQUE INDEX IF NOT EXISTS idx_dns_providers_label ON dns_providers(label);

-- Index on active for filtering
CREATE INDEX IF NOT EXISTS idx_dns_providers_active ON dns_providers(active);