# API Reference

## Authentication

All protected operations require authentication via Bearer token in the `Authorization` header:

```
Authorization: Bearer <your-token>
```

## Role-Based Access Control (RBAC)

glinrdock implements a hierarchical role-based access control system. See [RBAC.md](RBAC.md) for complete documentation.

**Roles:**
- **Admin**: Full access to all resources and operations
- **Deployer**: Can manage services, builds, and deployments but not tokens/certificates
- **Viewer**: Read-only access to all resources

**Permission levels in endpoint descriptions:**
- **Admin only**: Requires admin role
- **Deployer+**: Requires deployer or admin role  
- **Viewer+**: Requires viewer, deployer, or admin role

## Endpoints

### Health and System

#### GET /v1/health
Returns server health status (public endpoint).

**Response:**
```json
{
  "ok": true,
  "uptime": "1h2m3s",
  "version": "v1.0.0"
}
```

#### GET /v1/system
Returns system information (public endpoint).

**Response:**
```json
{
  "go_version": "go1.24.5",
  "os": "linux",
  "arch": "amd64",
  "docker_status": "connected",
  "uptime": "1h2m3s"
}
```

### Token Management

#### POST /v1/tokens
Creates a new API token. **Admin only.**

**Request:**
```json
{
  "name": "ci-token",
  "plain": "your-secret-token-here",
  "role": "deployer"
}
```

**Response:**
```json
{
  "id": 1,
  "name": "ci-token",
  "role": "deployer", 
  "created_at": "2025-01-15T10:30:00Z"
}
```

**Notes:**
- The `plain` token value is never stored or returned
- Token is hashed with bcrypt before storage
- Token name must be unique and 1-64 characters
- Valid roles: `admin`, `deployer`, `viewer` (defaults to `admin` if omitted)
- Only admin tokens can create new tokens

#### GET /v1/tokens  
Lists all tokens. **Admin only.**

**Response:**
```json
{
  "tokens": [
    {
      "id": 1,
      "name": "admin",
      "role": "admin",
      "created_at": "2025-01-15T09:00:00Z",
      "last_used_at": "2025-01-15T10:25:00Z"
    },
    {
      "id": 2,
      "name": "ci-token",
      "role": "deployer", 
      "created_at": "2025-01-15T10:30:00Z",
      "last_used_at": null
    }
  ]
}
```

#### DELETE /v1/tokens/:name
Deletes a token by name. **Admin only.**

**Response:**
```json
{
  "message": "token deleted successfully"
}
```

### Project Management

#### POST /v1/projects
Creates a new project. **Deployer+.**

**Request:**
```json
{
  "name": "my-app"
}
```

**Response:**
```json
{
  "id": 1,
  "name": "my-app",
  "created_at": "2025-01-15T10:35:00Z"
}
```

**Notes:**
- Requires deployer role or higher
- Generates audit log entry with actor and project details
- Project name must be unique and 1-64 characters
- Returns 201 Created with project details

#### GET /v1/projects
Lists all projects. **Viewer+.**

**Response:**
```json
{
  "projects": [
    {
      "id": 1,
      "name": "my-app",
      "network_name": "glinr_proj_1",
      "created_at": "2025-01-15T10:35:00Z"
    },
    {
      "id": 2,
      "name": "api-service",
      "network_name": "glinr_proj_2",
      "created_at": "2025-01-15T11:00:00Z"
    }
  ]
}
```

#### GET /v1/projects/:id
Gets a single project by ID. **Viewer+.**

**Response:**
```json
{
  "id": 1,
  "name": "my-app",
  "network_name": "glinr_proj_1",
  "created_at": "2025-01-15T10:35:00Z"
}
```

#### DELETE /v1/projects/:id
Deletes a project by ID. **Deployer+.**

**Response:**
```json
{
  "message": "project deleted successfully"
}
```

**Notes:**
- Requires deployer role or higher
- Generates audit log entry with actor and project details
- Returns 404 if project not found
- Cascades to delete associated services and routes

### Service Management

#### POST /v1/projects/:id/services
Creates a new service within a project and its Docker container. **Deployer+.**

**Request:**
```json
{
  "name": "api",
  "image": "nginx:alpine",
  "env": {
    "DATABASE_URL": "postgres://localhost/db",
    "DEBUG": "true"
  },
  "ports": [
    {"container": 8080, "host": 8081},
    {"container": 80, "host": 8080}
  ]
}
```

**Response:**
```json
{
  "id": 1,
  "project_id": 1,
  "name": "api",
  "image": "nginx:alpine",
  "env": {
    "DATABASE_URL": "postgres://localhost/db",
    "DEBUG": "true"
  },
  "ports": [
    {"container": 8080, "host": 8081},
    {"container": 80, "host": 8080}
  ],
  "status": "stopped",
  "created_at": "2025-01-15T10:40:00Z"
}
```

**Notes:**
- Service name must be DNS-label friendly (lowercase, alphanumeric, hyphens)
- Pulls Docker image before creating container
- Creates stopped container with labels for management
- Environment variables and port mappings are optional

#### GET /v1/projects/:id/services
Lists all services for a project. **Viewer+.**

**Response:**
```json
{
  "services": [
    {
      "id": 1,
      "project_id": 1,
      "name": "api",
      "image": "nginx:alpine",
      "env": {"DEBUG": "true"},
      "ports": [{"container": 8080, "host": 8081}],
      "status": "running",
      "created_at": "2025-01-15T10:40:00Z"
    },
    {
      "id": 2,
      "project_id": 1,
      "name": "worker",
      "image": "alpine:latest",
      "env": {},
      "ports": [],
      "status": "stopped",
      "created_at": "2025-01-15T10:45:00Z"
    }
  ]
}
```

**Notes:**
- Status field shows real-time container status from Docker events
- Possible status values: `running`, `stopped`, `starting`, `stopping`, `error`
- Status defaults to `stopped` if container state is unknown

#### GET /v1/services/:id
Gets detailed information about a single service by ID. **Viewer+.**

This endpoint provides comprehensive service information including runtime details, networking configuration, and volume mappings. Includes a sampled audit event (1:10 sampling) for service view tracking.

**Response:**
```json
{
  "id": 1,
  "project_id": 1,
  "name": "api",
  "description": "Main API service",
  "image": "nginx:1.21-alpine",
  "status": "running",
  "created_at": "2025-01-15T10:40:00Z",
  "updated_at": "2025-01-15T12:30:00Z",
  "ports": [
    {
      "host": 8081,
      "container": 8080
    },
    {
      "host": 8443,
      "container": 443
    }
  ],
  "volumes": [
    {
      "host": "/host/data",
      "container": "/app/data",
      "ro": false
    },
    {
      "host": "/host/config",
      "container": "/app/config",
      "ro": true
    }
  ],
  "env_summary_count": 12,
  "last_deploy_at": "2025-01-15T12:30:00Z",
  "container_id": "abc123def456",
  "state_reason": null,
  "network": {
    "name": "glinr_proj_1",
    "alias": "api",
    "dns_hint": "api:8080",
    "curl_hint": "curl http://api:8080/health",
    "ports_internal": [
      {
        "container": 8080,
        "protocol": "tcp"
      }
    ]
  },
  "aliases": [
    "api",
    "api.myproject.local"
  ],
  "desired_state": "running",
  "last_exit_code": null,
  "restart_count": 2,
  "restart_window_at": "2025-01-15T12:00:00Z",
  "crash_looping": false,
  "health_status": "ok",
  "health_path": "/health",
  "last_probe_at": "2025-01-15T12:35:15Z"
}
```

**New Fields in Service Detail Response:**
- `description` (string, optional): Service description
- `updated_at` (string, optional): Last update timestamp
- `volumes` (array): Volume mount configuration
  - `host` (string): Host path
  - `container` (string): Container path  
  - `ro` (boolean): Read-only flag
- `env_summary_count` (integer): Count of environment variables (values hidden for security)
- `last_deploy_at` (string, optional): Timestamp of last deployment
- `container_id` (string, optional): Short Docker container ID
- `state_reason` (string, optional): Additional context about container state
- `network` (object, optional): Network configuration and connection details
  - `name` (string): Docker network name
  - `alias` (string): Primary service alias
  - `dns_hint` (string): DNS connection example
  - `curl_hint` (string): Curl command example
  - `ports_internal` (array): Internal port mappings
- `aliases` (array, optional): List of all DNS aliases for inter-service communication
- `desired_state` (string): Target service state, either "running" or "stopped"
- `last_exit_code` (integer, optional): Exit code from last container termination
- `restart_count` (integer): Number of restarts in current 10-minute window
- `restart_window_at` (string, optional): Start time of current restart counting window
- `crash_looping` (boolean): True if service is in crash loop protection state
- `health_status` (string): Current health status: "ok", "fail", or "unknown"
- `health_path` (string, optional): Configured health check endpoint path
- `last_probe_at` (string, optional): Timestamp of most recent health probe

**Notes:**
- Environment variable values are not returned for security; only the count is provided
- Container ID is truncated to 12 characters for display purposes
- Status reflects real-time container state from Docker events
- Includes audit logging with 1:10 sampling rate

#### DELETE /v1/services/:id
Deletes a service and removes its Docker container. **Deployer+.**

**Response:**
```json
{
  "message": "service deleted successfully"
}
```

**Notes:**
- Removes the Docker container first, then deletes the database record
- Container removal is best-effort (continues if container doesn't exist)

### Service Networking

#### GET /v1/services/:id/network
Retrieves networking information for a service, including its internal alias and connection hints. **Viewer+.**

**Response:**
```json
{
  "alias": "api",
  "aliases": ["api", "api.myproject.local"],
  "project_network": "glinr_proj_123",
  "network": "glinr_proj_123",
  "ipv4": null,
  "ports_internal": [
    {"container": 8080, "protocol": "tcp"},
    {"container": 3000, "protocol": "tcp"}
  ],
  "dns_hint": "api:8080",
  "curl_hint": "curl http://api:8080/health"
}
```

**Notes:**
- `alias` is the primary service alias (service name)
- `aliases` contains all DNS aliases: short name and fully qualified (`<service>.<project_slug>.local`)
- `project_network` and `network` are the per-project Docker network name (`glinr_proj_<projectID>`)
- `ports_internal` lists all container ports that can be accessed internally
- `dns_hint` and `curl_hint` provide examples for connecting to the service using the short alias

#### GET /v1/services/:id/links
Retrieves linked services for a service. **Viewer+.**

**Response:**
```json
{
  "links": [
    {
      "id": 2,
      "name": "database",
      "alias": "database"
    },
    {
      "id": 3,
      "name": "redis-cache", 
      "alias": "redis-cache"
    }
  ]
}
```

**Notes:**
- Returns empty array if service has no links
- Each linked service includes its ID, name, and networking alias (short name format)
- Services can also be reached using the fully qualified format: `<alias>.<project_slug>.local`

#### POST /v1/services/:id/links
Creates or updates service links. **Deployer+.**

**Request:**
```json
{
  "target_ids": [2, 3, 5]
}
```

**Response:**
```json
{
  "message": "service links updated successfully"
}
```

**Notes:**
- Replaces all existing links with the provided target IDs
- Provide empty array to remove all links
- Self-links are automatically filtered out
- Non-existent target services will cause validation errors
- Audit logged with service IDs and link changes

### Service Lifecycle

#### POST /v1/services/:id/start
Starts a service container. **Deployer+.**

**Response:**
```json
{
  "message": "service started successfully"
}
```

#### POST /v1/services/:id/stop
Stops a service container. **Deployer+.**

**Response:**
```json
{
  "message": "service stopped successfully"
}
```

#### POST /v1/services/:id/restart
Restarts a service container. **Deployer+.**

**Response:**
```json
{
  "message": "service restarted successfully"
}
```

**Notes:**
- All lifecycle operations update the service status in real-time
- Status changes are broadcast to connected WebSocket clients
- Operations may take a few seconds to complete depending on container size
- Each operation generates an audit log entry with actor details and metadata
- Supports Docker containers with proper labeling for identification

### Health Monitoring

#### POST /v1/services/:id/health-check/run
Runs an immediate health check probe on a service. **Viewer+.**

**Response:**
```json
{
  "service_id": 1,
  "health_status": "ok",
  "last_probe_at": "2025-01-15T10:45:30Z",
  "response_time_ms": 45
}
```

**Possible health_status values:**
- `ok` - Service responded successfully (2xx status code)
- `fail` - Service returned error or is unreachable
- `unknown` - Health status cannot be determined (e.g., service in crash loop)

**Notes:**
- Probes are performed using HTTP HEAD request with GET fallback
- 1-second timeout per probe attempt
- Health checks are automatically skipped for services in crash loop state
- Probe results update the service's health status and last_probe_at timestamp

#### POST /v1/services/:id/unlock
Unlocks a service that is in crash loop state, allowing it to restart normally. **Deployer+.**

**Response:**
```json
{
  "message": "service unlocked successfully",
  "service_id": 1,
  "unlocked_by": "admin-user"
}
```

**Notes:**
- Only services in crash loop state can be unlocked
- Requires elevated permissions (deployer role or higher)
- Resets the crash loop flag and restart counters
- All unlock operations are recorded in the audit log
- Service must still be manually started after unlocking if desired

#### GET /v1/services/:id/health-check/debug
Returns comprehensive health check debugging information for troubleshooting. **Viewer+.**

**Response:**
```json
{
  "service_id": 1,
  "service_name": "my-service",
  "service_status": "running",
  "desired_state": "running",
  "crash_looping": false,
  "current_health": "unknown",
  "last_probe_at": null,
  "health_path": "/health",
  "health_check_type": "http",
  "generated_url": "http://localhost:8080/health",
  "ports": [{"container": 80, "host": 8080}],
  "routes": [],
  "probe_result": {
    "status": "fail",
    "error": "connection refused"
  },
  "troubleshooting": [
    "🔍 Service is running but health check failed",
    "💡 Try testing manually: curl -v http://localhost:8080/health"
  ]
}
```

**Notes:**
- Provides detailed information for troubleshooting health check issues
- Shows generated health URLs and probe configuration
- Includes specific troubleshooting tips based on the service configuration
- Performs a live health check as part of the debug process

### Route Management

#### POST /v1/services/:id/routes
Creates a new route for a service, exposing it externally via nginx. **Requires authentication.**

**Request:**
```json
{
  "domain": "api.example.com",
  "port": 8080,
  "tls": true
}
```

**Response:**
```json
{
  "id": 1,
  "service_id": 1,
  "domain": "api.example.com",
  "port": 8080,
  "tls": true,
  "created_at": "2025-01-15T10:50:00Z"
}
```

**Notes:**
- Domain must be unique per service
- Port must be positive integer
- TLS flag determines if HTTPS is enabled (auto-generates HTTP->HTTPS redirect)
- Automatically regenerates and reloads nginx configuration

#### GET /v1/services/:id/routes
Lists all routes for a specific service. **Requires authentication.**

**Response:**
```json
{
  "routes": [
    {
      "id": 1,
      "service_id": 1,
      "domain": "api.example.com",
      "port": 8080,
      "tls": true,
      "created_at": "2025-01-15T10:50:00Z"
    },
    {
      "id": 2,
      "service_id": 1,
      "domain": "www.example.com",
      "port": 80,
      "tls": false,
      "created_at": "2025-01-15T10:55:00Z"
    }
  ]
}
```

#### GET /v1/routes/:id
Gets a single route by ID. **Requires authentication.**

**Response:**
```json
{
  "id": 1,
  "service_id": 1,
  "domain": "api.example.com",
  "port": 8080,
  "tls": true,
  "created_at": "2025-01-15T10:50:00Z"
}
```

#### GET /v1/routes
Lists all routes across all services. **Requires authentication.**

**Response:**
```json
{
  "routes": [
    {
      "id": 1,
      "service_id": 1,
      "domain": "api.example.com",
      "port": 8080,
      "tls": true,
      "created_at": "2025-01-15T10:50:00Z"
    },
    {
      "id": 2,
      "service_id": 2,
      "domain": "admin.example.com",
      "port": 3000,
      "tls": true,
      "created_at": "2025-01-15T11:00:00Z"
    }
  ]
}
```

#### DELETE /v1/routes/:id
Deletes a route by ID and regenerates nginx configuration. **Requires authentication.**

**Response:**
```json
{
  "message": "route deleted successfully"
}
```

#### POST /v1/system/nginx/reload
Manually regenerates and reloads nginx configuration. **Requires authentication.**

**Response:**
```json
{
  "message": "nginx configuration reloaded successfully"
}
```

**Notes:**
- This endpoint is useful for manual nginx config regeneration
- Automatically called when routes are created/deleted
- Returns error if nginx is not available or validation fails

### Certificate Management

> **⚠️ Feature Flag Required**: Certificate management endpoints require nginx proxy to be enabled (`NGINX_PROXY_ENABLED=true`) and are only available to admin users.

#### POST /v1/certificates {#certificates-create}
Creates/uploads a new TLS certificate. **Admin only.**

**Request:**
```json
{
  "domain": "api.example.com",
  "type": "manual",
  "cert_data": "-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----",
  "key_data": "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----",
  "auto_renew": false
}
```

**Response:**
```json
{
  "id": 1,
  "domain": "api.example.com",
  "type": "manual",
  "has_cert": true,
  "has_key": true,
  "expires_at": "2025-04-15T10:30:00Z",
  "auto_renew": false,
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T10:30:00Z"
}
```

**Notes:**
- Admin role required for all certificate operations
- Certificate types: `manual`, `letsencrypt`, `custom`
- Private key data is encrypted at rest using AES-GCM
- Certificate validation is performed before storage
- Audit logged with domain and type metadata

#### GET /v1/certificates {#certificates-list}
Lists all certificates. **Admin only.**

**Response:**
```json
[
  {
    "id": 1,
    "domain": "api.example.com",
    "type": "manual",
    "has_cert": true,
    "has_key": true,
    "expires_at": "2025-04-15T10:30:00Z",
    "auto_renew": false,
    "created_at": "2025-01-15T10:30:00Z",
    "updated_at": "2025-01-15T10:30:00Z"
  },
  {
    "id": 2,
    "domain": "www.example.com",
    "type": "letsencrypt",
    "has_cert": true,
    "has_key": true,
    "expires_at": "2025-04-20T15:45:00Z",
    "auto_renew": true,
    "created_at": "2025-01-20T15:45:00Z",
    "updated_at": "2025-01-20T15:45:00Z"
  }
]
```

**Security Notes:**
- Private key data is never returned in API responses
- Only SHA-256 fingerprint and length are shown for security
- Example: `[REDACTED: length=1679, fingerprint=a1b2c3d4]`

#### GET /v1/certificates/:id {#certificates-get}
Gets a certificate by ID. **Admin only.**

**Response:**
```json
{
  "id": 1,
  "domain": "api.example.com",
  "type": "manual",
  "has_cert": true,
  "has_key": true,
  "expires_at": "2025-04-15T10:30:00Z",
  "auto_renew": false,
  "created_at": "2025-01-15T10:30:00Z",
  "updated_at": "2025-01-15T10:30:00Z"
}
```

#### DELETE /v1/certificates/:id {#certificates-delete}
Deletes a certificate by ID. **Admin only.**

**Response:**
```json
{
  "message": "certificate deleted successfully"
}
```

**Notes:**
- Removes certificate and private key from storage
- Audit logged with certificate details
- Does not affect nginx configuration automatically

#### POST /v1/certificates/:id/renew {#certificates-renew}
Initiates certificate renewal (returns 501 for manual certificates). **Admin only.**

**Response (Let's Encrypt certificates):**
```json
{
  "message": "Certificate renewed successfully for domain api.example.com"
}
```

**Response (Manual certificates):**
```json
{
  "error": "ACME certificate renewal not implemented - upload certificates manually or configure ACME provider"
}
```

**Notes:**
- Only Let's Encrypt certificates support automatic renewal
- Manual/custom certificates must be renewed by uploading new certificate data
- Returns HTTP 501 for unsupported certificate types

### Nginx Proxy Management

> **⚠️ Feature Flag Required**: Nginx management endpoints require nginx proxy to be enabled (`NGINX_PROXY_ENABLED=true`) and are only available to admin users.

#### POST /v1/nginx/reload {#nginx-reload}
Manually reloads nginx configuration. **Admin only.**

**Response:**
```json
{
  "message": "nginx reloaded successfully"
}
```

**Error Response:**
```json
{
  "error": "nginx proxy not enabled"
}
```

**Notes:**
- Triggers nginx configuration reload using current routes and certificates
- Returns HTTP 503 if nginx proxy is not enabled
- Audit logged with success/failure status
- Safe to call repeatedly

#### GET /v1/nginx/status {#nginx-status}
Gets nginx proxy health status. **Admin only.**

**Response:**
```json
{
  "status": "healthy",
  "last_apply_time": "2025-01-15T10:30:00Z",
  "last_error": null,
  "config_hash": "sha256:a1b2c3d4..."
}
```

**Error Response:**
```json
{
  "status": "error",
  "last_error": "nginx: configuration file test failed"
}
```

**Status Values:**
- `healthy`: Nginx is running and configuration is valid
- `error`: Nginx configuration validation failed

#### GET /v1/nginx/config {#nginx-config}
Returns the current nginx configuration rendered from database routes. **Admin only.**

**Response:**
```json
{
  "config": "# Generated nginx configuration\nserver {\n  listen 80;\n  server_name api.example.com;\n  # ...\n}",
  "hash": "sha256:a1b2c3d4e5f6...",
  "generated_at": "2025-01-15T10:30:00Z",
  "routes": [
    {
      "route": {
        "id": 1,
        "service_id": 1,
        "domain": "api.example.com",
        "port": 8080,
        "tls": true,
        "created_at": "2025-01-15T10:00:00Z"
      },
      "service_name": "api-service",
      "project_name": "my-project"
    }
  ]
}
```

**Notes:**
- Shows the actual nginx configuration that would be applied
- Includes route context for debugging
- Configuration is generated from current database state
- Hash can be used to detect configuration changes

#### POST /v1/nginx/validate {#nginx-validate}
Validates current nginx configuration without applying changes. **Admin only.**

**Response:**
```json
{
  "valid": true,
  "config": "# Generated nginx configuration\nserver {\n  # ...\n}",
  "hash": "sha256:a1b2c3d4e5f6..."
}
```

**Error Response:**
```json
{
  "valid": false,
  "error": "nginx: [emerg] invalid location in server block",
  "config": "# Generated nginx configuration\nserver {\n  # ...\n}",
  "hash": "sha256:a1b2c3d4e5f6..."
}
```

**Notes:**
- Performs dry-run validation using `nginx -t`
- Returns full configuration and validation results
- Audit logged with validation status
- Safe to call for configuration preview


### System Administration

#### POST /v1/system/backup

Creates and downloads a system backup containing the database, certificates, and configuration files. **Admin only**.

**Request**: POST (no body required)

**Response**: Binary tar.gz file (application/octet-stream)

The backup contains:
- `db.sqlite` - Complete system database
- `certs/` - SSL/TLS certificates and configuration
- `nginx/` - Nginx proxy configuration
- `config/` - System configuration files
- `manifest.json` - Backup metadata

**Example**:
```bash
curl -X POST \
  -H "Authorization: Bearer admin-token" \
  -o "glinrdock-backup-$(date +%Y%m%d-%H%M%S).tar.gz" \
  http://localhost:8080/v1/system/backup
```

#### POST /v1/system/restore

Restores system from a backup archive. **Admin only**.

**Request**: Multipart form upload with `backup` field containing the tar.gz file

**Response**:
```json
{
  "message": "Backup restore completed successfully",
  "status": "success"
}
```

**Behavior**:
- Validates backup archive structure and manifest
- Creates backup of existing files before restoration
- Restores all files from the backup archive
- System may restart automatically after successful restore

**Example**:
```bash
curl -X POST \
  -H "Authorization: Bearer admin-token" \
  -F "backup=@glinrdock-backup-20240827-123456.tar.gz" \
  http://localhost:8080/v1/system/restore
```

**Error Responses**:
- `400 Bad Request` - Invalid backup file format or missing backup field
- `403 Forbidden` - Insufficient permissions (admin required)
- `422 Unprocessable Entity` - Backup file validation failed

### Metrics

#### GET /v1/metrics
Returns Prometheus-compatible metrics for monitoring. **Requires authentication.**

**Response Format**: Prometheus text format (text/plain)

**Example Response:**
```
# HELP glinrdock_uptime_seconds Number of seconds since glinrdock server started
# TYPE glinrdock_uptime_seconds gauge
glinrdock_uptime_seconds 3600.5

# HELP glinrdock_services_running_total Total number of currently running containers
# TYPE glinrdock_services_running_total gauge
glinrdock_services_running_total 5

# HELP glinrdock_jobs_active Number of active background jobs in the queue
# TYPE glinrdock_jobs_active gauge
glinrdock_jobs_active 2

# HELP glinrdock_builds_total Total number of builds by status
# TYPE glinrdock_builds_total counter
glinrdock_builds_total{status="success"} 45
glinrdock_builds_total{status="failed"} 3

# HELP glinrdock_deployments_total Total number of deployments by status
# TYPE glinrdock_deployments_total counter
glinrdock_deployments_total{status="success"} 128
glinrdock_deployments_total{status="failed"} 2
```

**Notes:**
- Compatible with Prometheus scraping
- Includes system health, service status, and operational metrics
- See [docs/METRICS.md](METRICS.md) for complete metrics documentation

### Service Observability

#### GET /v1/services/:id/logs
Streams container logs via WebSocket. **Viewer+.**

**Protocol:** WebSocket  
**Response:** Continuous stream of log lines as text messages

**Example usage:**
```javascript
const ws = new WebSocket('ws://localhost:8080/v1/services/1/logs');
ws.onmessage = (event) => {
  console.log('Log:', event.data);
};
```

#### GET /v1/services/:id/logs/tail
Gets the last N lines of container logs via REST. **Viewer+.**

**Query Parameters:**
- `tail` (integer, optional): Number of lines to return. Default: 50, Max: 1000

**Response:**
```json
{
  "service_id": 1,
  "container": "glinr_1_api-service",
  "tail_lines": 50,
  "total_lines": 3,
  "logs": [
    "2025-01-15T10:00:00Z INFO: Service started successfully",
    "2025-01-15T10:00:01Z INFO: Processing request from 192.168.1.100",
    "2025-01-15T10:00:02Z ERROR: Database connection timeout"
  ]
}
```

**Example usage:**
```bash
# Get last 50 lines (default)
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/v1/services/1/logs/tail"

# Get last 100 lines
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:8080/v1/services/1/logs/tail?tail=100"
```

**Notes:**
- Suitable for polling-based log viewers and REST clients
- Automatically filters out empty lines
- Returns logs with line numbers for better readability
- Includes service and container metadata for context

#### GET /v1/services/:id/stats
Streams container resource statistics via WebSocket. **Requires authentication.**

**Protocol:** WebSocket  
**Response:** JSON objects containing container stats

**Response format:**
```json
{
  "cpu_percent": 15.5,
  "memory_usage": 134217728,
  "memory_limit": 536870912,
  "memory_percent": 25.0,
  "network_rx": 1024,
  "network_tx": 512,
  "block_read": 2048,
  "block_write": 1024
}
```

**Example usage:**
```javascript
const ws = new WebSocket('ws://localhost:8080/v1/services/1/stats');
ws.onmessage = (event) => {
  const stats = JSON.parse(event.data);
  console.log('CPU:', stats.cpu_percent + '%');
  console.log('Memory:', (stats.memory_usage / 1024 / 1024).toFixed(2) + 'MB');
};
```

## Error Responses

All errors return a consistent JSON structure:

```json
{
  "error": "error message description"
}
```

Common HTTP status codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing or invalid token)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error

## Examples

### Bootstrap First Token

Set the admin token via environment variable on first run:

```bash
ADMIN_TOKEN=your-strong-secret glinrdockd
```

This creates an "admin" token automatically if no tokens exist.

### Create a New Token

```bash
curl -X POST http://localhost:8080/v1/tokens \
  -H "Authorization: Bearer your-strong-secret" \
  -H "Content-Type: application/json" \
  -d '{"name": "ci", "plain": "ci-secret-token"}'
```

### Create a Project

```bash
curl -X POST http://localhost:8080/v1/projects \
  -H "Authorization: Bearer ci-secret-token" \
  -H "Content-Type: application/json" \
  -d '{"name": "demo-app"}'
```

### List Projects

```bash
curl -H "Authorization: Bearer ci-secret-token" \
  http://localhost:8080/v1/projects
```

### Create a Service

```bash
curl -X POST http://localhost:8080/v1/projects/1/services \
  -H "Authorization: Bearer ci-secret-token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "web",
    "image": "nginx:alpine",
    "env": {"ENV": "production"},
    "ports": [{"container": 80, "host": 8080}]
  }'
```

### Start a Service

```bash
curl -X POST http://localhost:8080/v1/services/1/start \
  -H "Authorization: Bearer ci-secret-token"
```

### Stop a Service

```bash
curl -X POST http://localhost:8080/v1/services/1/stop \
  -H "Authorization: Bearer ci-secret-token"
```

### Restart a Service

```bash
curl -X POST http://localhost:8080/v1/services/1/restart \
  -H "Authorization: Bearer ci-secret-token"
```

### Stream Service Logs

```bash
# Using wscat (install with: npm install -g wscat)
wscat -c "ws://localhost:8080/v1/services/1/logs" \
  -H "Authorization: Bearer ci-secret-token"
```

### Monitor Service Stats

```bash
# Using wscat to monitor real-time stats
wscat -c "ws://localhost:8080/v1/services/1/stats" \
  -H "Authorization: Bearer ci-secret-token"
```

### Create a Route (Expose Service Externally)

```bash
# Create HTTPS route for API service
curl -X POST http://localhost:8080/v1/services/1/routes \
  -H "Authorization: Bearer ci-secret-token" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "api.example.com",
    "port": 8080,
    "tls": true
  }'
```

```bash
# Create HTTP route for web service
curl -X POST http://localhost:8080/v1/services/1/routes \
  -H "Authorization: Bearer ci-secret-token" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "www.example.com", 
    "port": 80,
    "tls": false
  }'
```

### List Service Routes

```bash
# List all routes for service ID 1
curl -H "Authorization: Bearer ci-secret-token" \
  http://localhost:8080/v1/services/1/routes
```

### List All Routes

```bash
# List all routes across all services
curl -H "Authorization: Bearer ci-secret-token" \
  http://localhost:8080/v1/routes
```

### Delete a Route

```bash
# Delete route by ID
curl -X DELETE http://localhost:8080/v1/routes/1 \
  -H "Authorization: Bearer ci-secret-token"
```

### Manual Nginx Reload

```bash
# Manually regenerate and reload nginx configuration
curl -X POST http://localhost:8080/v1/system/nginx/reload \
  -H "Authorization: Bearer ci-secret-token"
```

### Certificate and Nginx Management Examples

#### Upload a Certificate

```bash
# Upload manual certificate (admin only)
curl -X POST http://localhost:8080/v1/certificates \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "api.example.com",
    "type": "manual",
    "cert_data": "-----BEGIN CERTIFICATE-----\nMIID...\n-----END CERTIFICATE-----",
    "key_data": "-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----",
    "auto_renew": false
  }'
```

#### List All Certificates

```bash
# Get all certificates with redacted keys (admin only)
curl -H "Authorization: Bearer admin-token" \
  http://localhost:8080/v1/certificates
```

#### Get Certificate Details

```bash
# Get detailed certificate information (admin only)
curl -H "Authorization: Bearer admin-token" \
  http://localhost:8080/v1/certificates/1
```

#### Delete Certificate

```bash
# Delete certificate by ID (admin only)
curl -X DELETE http://localhost:8080/v1/certificates/1 \
  -H "Authorization: Bearer admin-token"
```

#### Check Nginx Status

```bash
# Check nginx proxy health (admin only)
curl -H "Authorization: Bearer admin-token" \
  http://localhost:8080/v1/nginx/status
```

#### Reload Nginx Configuration

```bash
# Manually reload nginx config (admin only)
curl -X POST http://localhost:8080/v1/nginx/reload \
  -H "Authorization: Bearer admin-token"
```

#### Validate Nginx Configuration

```bash
# Validate nginx config without applying (admin only)
curl -X POST http://localhost:8080/v1/nginx/validate \
  -H "Authorization: Bearer admin-token"
```

### System Administration Examples

#### Create and Download System Backup

```bash
# Create a timestamped backup file
curl -X POST \
  -H "Authorization: Bearer admin-token" \
  -o "glinrdock-backup-$(date +%Y%m%d-%H%M%S).tar.gz" \
  http://localhost:8080/v1/system/backup

# Verify backup contents
tar -tzf glinrdock-backup-*.tar.gz
```

#### Restore from Backup

```bash
# Restore system from backup archive
curl -X POST \
  -H "Authorization: Bearer admin-token" \
  -F "backup=@glinrdock-backup-20240827-123456.tar.gz" \
  http://localhost:8080/v1/system/restore

# Response indicates success
# {
#   "message": "Backup restore completed successfully", 
#   "status": "success"
# }
```

#### Automated Backup Scripting

```bash
#!/bin/bash
# backup-glinrdock.sh - Automated backup script

BACKUP_DIR="/backups/glinrdock"
ADMIN_TOKEN="your-admin-token"
DATE=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/glinrdock-backup-$DATE.tar.gz"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Create backup
echo "Creating backup..."
curl -X POST \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -o "$BACKUP_FILE" \
  http://localhost:8080/v1/system/backup

if [ $? -eq 0 ]; then
    echo "Backup created successfully: $BACKUP_FILE"
    
    # Keep only last 7 backups
    find "$BACKUP_DIR" -name "glinrdock-backup-*.tar.gz" -mtime +7 -delete
    
    echo "Backup rotation complete"
else
    echo "Backup failed"
    exit 1
fi
```

### Search

#### GET /v1/search/status
Returns the current search capabilities. **Viewer+**

**Response:**
```json
{
  "fts5": true,
  "mode": "fts5"
}
```

#### GET /v1/search
Performs a global search across all indexed entities. **Viewer+**

**Query Parameters:**
- `q` (required): Search query string (supports operators, see below)
- `type` (optional): Filter by entity type (`project`, `service`, `route`, `registry`, `env_template`, `page`)
- `project_id` (optional): Filter by project ID
- `limit` (optional): Maximum results (default: 10, max: 50)
- `offset` (optional): Results offset (default: 0)

**Rate Limiting:**
- 10 requests per second per IP/token
- Burst limit of 20 requests
- Returns HTTP 429 with `Retry-After: 1` header when exceeded

**Search Operators:**
You can use operators within the search query to filter results:
- `type:page` - Filter by entity type
- `project:myproject` - Filter by project name (partial match)
- `status:running` - Filter by service status (for services only)

Operators can be combined with regular search terms:
- `type:service redis` - Search for "redis" within services only
- `project:api nginx` - Search for "nginx" within projects matching "api"
- `type:page dashboard` - Search for "dashboard" within pages only

**Response:**
```json
{
  "hits": [
    {
      "id": 1,
      "type": "page",
      "entity_id": 12345,
      "title": "Settings",
      "subtitle": "System configuration",
      "url_path": "/app/settings",
      "score": 1.2,
      "badges": [
        {"k": "type", "v": "page"}
      ]
    }
  ],
  "took_ms": 15,
  "fts5": true,
  "total": 1
}
```

**Supported Entity Types:**
- `project`: GLINR projects with services and metadata
- `service`: Container services with images and descriptions  
- `route`: Network routes with domains and ports
- `registry`: Docker registries with credentials
- `env_template`: Environment variable templates
- `page`: Navigation pages for quick access

**Example Searches:**
```bash
# Basic search for settings
curl -H "Authorization: Bearer token" \
  "http://localhost:8080/v1/search?q=settings"

# Search only pages using query parameter
curl -H "Authorization: Bearer token" \
  "http://localhost:8080/v1/search?q=dashboard&type=page"

# Search only pages using operator syntax
curl -H "Authorization: Bearer token" \
  "http://localhost:8080/v1/search?q=type:page dashboard"

# Search for running services
curl -H "Authorization: Bearer token" \
  "http://localhost:8080/v1/search?q=status:running redis"

# Search within a specific project using operator
curl -H "Authorization: Bearer token" \
  "http://localhost:8080/v1/search?q=project:api nginx"

# Complex query with multiple operators
curl -H "Authorization: Bearer token" \
  "http://localhost:8080/v1/search?q=type:service status:running"
```

#### GET /v1/search/suggest
Returns autocomplete suggestions for search queries. **Viewer+**

**Query Parameters:**
- `q` (required): Search prefix (minimum 2 characters)
- `type` (optional): Filter by entity type (`project`, `service`, `route`, `registry`, `env_template`, `page`)
- `project_id` (optional): Filter by project ID
- `limit` (optional): Maximum suggestions (default: 8, max: 15)

**Rate Limiting:**
- 10 requests per second per IP/token
- Burst limit of 20 requests
- Returns HTTP 429 with `Retry-After: 1` header when exceeded

**Response:**
```json
{
  "suggestions": [
    {
      "q": "Services",
      "label": "Services",
      "type": "page",
      "url_path": "/app/services"
    },
    {
      "q": "postgres-2792",
      "label": "postgres-2792 — service",
      "type": "service", 
      "url_path": "/app/services/123"
    }
  ],
  "took_ms": 3,
  "fts5": true
}
```

**Example Requests:**
```bash
# Basic autocomplete
curl -H "Authorization: Bearer token" \
  "http://localhost:8080/v1/search/suggest?q=ser"

# Filter by page type only
curl -H "Authorization: Bearer token" \
  "http://localhost:8080/v1/search/suggest?q=set&type=page"

# Limit to 5 suggestions
curl -H "Authorization: Bearer token" \
  "http://localhost:8080/v1/search/suggest?q=proj&limit=5"
```

#### POST /v1/search/reindex
Triggers a full search index rebuild. **Admin only**

**Response:**
```json
{
  "message": "reindex started",
  "started_at": "2025-01-15T10:30:00Z"
}
```

### Monitoring Examples

#### Get Prometheus Metrics

```bash
# Fetch all metrics for Prometheus scraping
curl -H "Authorization: Bearer ci-secret-token" \
  http://localhost:8080/v1/metrics
```