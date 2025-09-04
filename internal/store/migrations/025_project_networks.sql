-- Add network_name column to projects table for per-project Docker networks
ALTER TABLE projects ADD COLUMN network_name TEXT;

-- Update existing projects with network names based on their ID
UPDATE projects SET network_name = 'glinr_proj_' || id WHERE network_name IS NULL;

-- Create index on network_name for faster lookups
CREATE INDEX idx_projects_network_name ON projects(network_name);