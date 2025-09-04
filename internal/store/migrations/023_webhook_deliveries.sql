-- Create webhook_deliveries table for tracking webhook delivery attempts
CREATE TABLE webhook_deliveries (
    id VARCHAR(255) PRIMARY KEY,
    event VARCHAR(100) NOT NULL,
    repository VARCHAR(500) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'processing',
    payload TEXT NOT NULL,
    response TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for common queries
CREATE INDEX idx_webhook_deliveries_created_at ON webhook_deliveries(created_at DESC);
CREATE INDEX idx_webhook_deliveries_repository ON webhook_deliveries(repository);
CREATE INDEX idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX idx_webhook_deliveries_event ON webhook_deliveries(event);

-- Add project repo_url, branch, and image fields for webhook configuration
ALTER TABLE projects ADD COLUMN repo_url VARCHAR(500);
ALTER TABLE projects ADD COLUMN branch VARCHAR(255) DEFAULT 'main';
ALTER TABLE projects ADD COLUMN image_target VARCHAR(500);