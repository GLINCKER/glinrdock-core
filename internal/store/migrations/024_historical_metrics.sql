-- Historical system resource metrics storage
CREATE TABLE historical_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cpu_percent REAL NOT NULL DEFAULT 0,      -- CPU usage percentage (0-100)
    memory_used BIGINT NOT NULL DEFAULT 0,    -- Memory used in bytes
    memory_total BIGINT NOT NULL DEFAULT 0,   -- Total memory in bytes
    disk_used BIGINT NOT NULL DEFAULT 0,      -- Disk used in bytes
    disk_total BIGINT NOT NULL DEFAULT 0,     -- Total disk in bytes
    network_rx BIGINT NOT NULL DEFAULT 0,     -- Network bytes received
    network_tx BIGINT NOT NULL DEFAULT 0      -- Network bytes transmitted
);

-- Index for efficient time-range queries
CREATE INDEX ix_historical_metrics_timestamp ON historical_metrics(timestamp);

-- Index for cleanup operations
CREATE INDEX ix_historical_metrics_timestamp_desc ON historical_metrics(timestamp DESC);