-- Migration: Create container registry credentials table
-- Description: Add support for private registry authentication (pull-only)

-- Create registries table
CREATE TABLE registries (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL, -- ghcr, ecr, dockerhub, generic
    server VARCHAR(255) NOT NULL, -- registry.example.com, ghcr.io, etc
    username VARCHAR(255) NOT NULL,
    secret_enc BLOB NOT NULL, -- AES-GCM encrypted password/token
    nonce BLOB NOT NULL, -- AES-GCM nonce for encryption
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add registry reference to services table
ALTER TABLE services ADD COLUMN registry_id VARCHAR(255);

-- Create indexes for performance
CREATE INDEX idx_registries_type ON registries(type);
CREATE INDEX idx_registries_server ON registries(server);
CREATE INDEX idx_services_registry_id ON services(registry_id);

-- Add foreign key constraint
-- Note: We don't add FOREIGN KEY constraint to allow soft deletes and flexibility
-- The application will handle referential integrity