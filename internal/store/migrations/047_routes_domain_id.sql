-- Add domain_id column to routes table for domain attachment
ALTER TABLE routes ADD COLUMN domain_id INTEGER REFERENCES domains(id);

-- Create index for fast domain_id lookups
CREATE INDEX idx_routes_domain_id ON routes(domain_id);