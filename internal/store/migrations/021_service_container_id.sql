-- Add container_id column to services table to store the actual Docker container ID
ALTER TABLE services ADD COLUMN container_id TEXT;

-- Create index on container_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_services_container_id ON services(container_id);