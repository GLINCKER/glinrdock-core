-- Backfill search documents from existing tables
-- This will be populated by the application during migration

-- Note: The actual backfill will be done in Go code to properly handle
-- data transformation and ensure no secrets are indexed.
-- This file ensures the migration exists in sequence.

-- Placeholder to ensure migration ordering
SELECT 1 as migration_034_complete;