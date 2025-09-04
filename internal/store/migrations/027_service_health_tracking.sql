-- Add health tracking and crash loop detection fields to services table
ALTER TABLE services ADD COLUMN desired_state TEXT DEFAULT 'running';
ALTER TABLE services ADD COLUMN last_exit_code INTEGER;
ALTER TABLE services ADD COLUMN restart_count INTEGER DEFAULT 0;
ALTER TABLE services ADD COLUMN restart_window_at DATETIME;
ALTER TABLE services ADD COLUMN crash_looping BOOLEAN DEFAULT FALSE;
ALTER TABLE services ADD COLUMN health_status TEXT DEFAULT 'unknown';
ALTER TABLE services ADD COLUMN last_probe_at DATETIME;