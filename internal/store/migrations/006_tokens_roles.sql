-- Add role column to tokens table for RBAC support
ALTER TABLE tokens ADD COLUMN role TEXT NOT NULL DEFAULT 'admin';

-- Create index on role for efficient role-based queries
CREATE INDEX idx_tokens_role ON tokens(role);

-- Validate that only supported roles are allowed
-- SQLite doesn't support CHECK constraints on existing tables, so validation will be done at application level