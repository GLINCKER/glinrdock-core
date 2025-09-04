-- Add health_path column to services table for health check endpoints
ALTER TABLE services ADD COLUMN health_path TEXT;