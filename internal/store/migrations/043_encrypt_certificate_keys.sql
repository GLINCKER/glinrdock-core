-- Add columns for encrypting certificate private keys
ALTER TABLE certificates ADD COLUMN key_data_nonce TEXT;

-- Note: After this migration, key_data will store encrypted data (base64 encoded)
-- and key_data_nonce will store the AES-GCM nonce (base64 encoded)
-- Existing unencrypted key_data will need to be migrated separately