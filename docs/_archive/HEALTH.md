# Health and Crash-Loop Protection

GlinrDock includes comprehensive health monitoring and crash-loop protection to ensure service reliability and prevent resource drain from failing services.

## Overview

The health monitoring system provides:

- **Automatic Health Checks**: Lightweight probes to verify service health
- **Crash-Loop Detection**: Automatic detection and protection from repeatedly failing services  
- **Manual Health Checks**: On-demand health verification through the UI
- **Debug Tools**: Comprehensive troubleshooting information for health issues

## Health Check Types

GlinrDock supports multiple health check types, automatically selected based on the service image:

### HTTP Health Checks

**When Used**: Default for most web services and applications

**How It Works**: 
- Sends HTTP GET requests to the service's health endpoint
- Uses external routes if available, otherwise uses host ports
- Accepts status codes 200-499 as healthy (service is responding)
- Only 5xx errors are considered unhealthy

**Configuration**:
- Set `health_path` in service configuration (defaults to `/health`)  
- Requires at least one port mapping or external route
- Timeout: 5 seconds

### TCP Health Checks

**When Used**: For services without HTTP endpoints or as fallback

**How It Works**:
- Attempts TCP connection to the service's first mapped port
- Connection success = healthy, connection failure = unhealthy
- Timeout: 3 seconds

### Database-Specific Health Checks

**PostgreSQL**: Auto-detected for images containing "postgres"
**MySQL/MariaDB**: Auto-detected for images containing "mysql" or "mariadb"  
**Redis**: Auto-detected for images containing "redis"

*Note: Currently implemented as TCP checks, can be enhanced with actual database connection tests*

## Health Status Values

| Status | Description | UI Display |
|--------|-------------|------------|
| `ok` | Service is healthy and responding | ✅ Healthy (green) |
| `fail` | Service is not responding or returning errors | ❌ Unhealthy (red) |
| `unknown` | Health status cannot be determined | ❓ Unknown (gray) |

## Crash-Loop Protection

### Detection Criteria

A service enters crash-loop protection when:
- **5 or more restarts** within a **10-minute window**
- **Non-zero exit codes** (exit code 0 is considered graceful shutdown)

### Protection Actions

When crash-loop is detected:
1. Service `desired_state` is set to `stopped`
2. Service `crash_looping` flag is set to `true` 
3. Automatic restart attempts are disabled
4. Audit log entry is created: `service.crashloop.stop`

### Recovery

To recover from crash-loop:
1. **Fix the underlying issue** (check logs, configuration, etc.)
2. **Unlock the service** via UI or API (requires deployer+ role)
3. **Manually start the service**

Unlocking resets:
- `crash_looping` flag to `false`
- `desired_state` to `running`
- Restart count and window

## API Reference

### Health Check Endpoints

#### Run Manual Health Check
```http
POST /v1/services/{id}/health-check/run
```

**Response**:
```json
{
  "message": "health check completed",
  "service_id": 123,
  "health_status": "ok",
  "last_probe_at": "2024-01-01T12:00:00Z"
}
```

#### Set Health Check Path
```http
POST /v1/services/{id}/health-check
Content-Type: application/json

{
  "path": "/actuator/health"
}
```

#### Debug Health Check
```http
GET /v1/services/{id}/health-check/debug
```

**Response**: Comprehensive debugging information including:
- Service configuration
- Generated health URLs
- Probe results
- Troubleshooting tips

### Crash-Loop Endpoints

#### Unlock Service
```http
POST /v1/services/{id}/unlock
```

**Requirements**: Deployer+ role

**Response**:
```json
{
  "message": "service unlocked successfully",
  "service_id": 123,
  "service_name": "my-service"
}
```

### Service Detail Response

Service details now include health and crash-loop fields:

```json
{
  "id": 123,
  "name": "my-service",
  "status": "running",
  "health_status": "ok",
  "last_probe_at": "2024-01-01T12:00:00Z",
  "crash_looping": false,
  "desired_state": "running",
  "restart_count": 2,
  "last_exit_code": 0,
  "restart_window_at": "2024-01-01T11:50:00Z"
}
```

## UI Features

### Service Detail Page

**Health Status Badge**: Shows current health status with timestamp
- ✅ Healthy (green) - Service is responding normally
- ❌ Unhealthy (red) - Service has health check failures  
- ❓ Unknown (gray) - Health status cannot be determined

**Manual Health Check Button**: Run on-demand health checks
- Available to all authenticated users
- Shows loading state during execution
- Updates health status immediately

### Crash-Loop Banner

Appears when `crash_looping` is `true`:

- **Warning Message**: Clear explanation of the crash-loop state
- **Restart Count**: Number of failed restart attempts
- **Exit Code**: Last exit code that triggered the crash-loop
- **Unlock Button**: Available to deployer+ users to recover the service

### Enhanced Logs Tab

When a service is crash-looping:
- **Automatic 200-line tail**: Increases default log lines for troubleshooting
- **Warning Indicator**: Visual indicator that service is in crash-loop
- **Context Message**: Explains why more logs are shown

## Troubleshooting

Use the debug API endpoint to get detailed information:

```bash
curl -H "Authorization: Bearer $TOKEN" \
  GET /v1/services/{id}/health-check/debug
```

This provides:
- Service configuration details
- Generated health check URLs
- Probe results and errors
- Specific troubleshooting tips

## Configuration Examples

### Spring Boot
```bash
# Enable actuator health endpoint
MANAGEMENT_ENDPOINT_HEALTH_ENABLED=true
MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE=health
```

### Node.js/Express
```javascript
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'UP', 
    timestamp: new Date().toISOString() 
  });
});
```

This system ensures reliable service operation with automatic failure detection and recovery mechanisms.