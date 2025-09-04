# Role-Based Access Control (RBAC)

This document describes the Role-Based Access Control (RBAC) system implemented in glinrdock for secure multi-user API access.

## Overview

glinrdock implements a hierarchical role-based access control system with three distinct roles:
- **Admin**: Full access to all resources and operations
- **Deployer**: Can manage services, builds, deployments, and routes but cannot manage tokens or certificates  
- **Viewer**: Read-only access to all resources

## Role Hierarchy

The roles are hierarchical, meaning higher-level roles inherit permissions from lower-level roles:

```
Admin (full access)
 └── Deployer (manage services/builds/routes)
     └── Viewer (read-only access)
```

## Roles and Permissions

### Admin Role (`admin`)
- **Full system access** including:
  - Create, list, and delete API tokens
  - Manage SSL certificates (issue, renew, list)  
  - System operations (nginx reload)
  - All deployer and viewer permissions

### Deployer Role (`deployer`)
- **Service lifecycle management**:
  - Create, update, delete projects and services
  - Start, stop, restart services
  - Create and delete routes
  - Trigger builds and deployments
  - Rollback deployments
- **Read access** to all resources
- **Cannot access**: Token management, certificate management, system operations

### Viewer Role (`viewer`)  
- **Read-only access** to all resources:
  - View projects, services, routes
  - View service logs and statistics
  - View system metrics
  - View build and deployment history
- **Cannot perform** any create, update, delete operations

## Authentication

### Token-Based Authentication
All API requests must include a Bearer token in the Authorization header:

```
Authorization: Bearer <your-token>
```

### Bootstrap Admin Token
On first startup, if no tokens exist in the database, glinrdock will automatically create an admin token using the `ADMIN_TOKEN` environment variable:

```bash
export ADMIN_TOKEN="your-secure-token-here"
./glinrdockd
```

This bootstrap token will be named "admin" with full admin privileges.

## API Endpoints and Permissions

### Token Management (`/v1/tokens`) - **Admin Only**
```bash
# Create new token (admin only)
POST /v1/tokens
{
  "name": "deployer-token",
  "plain": "secret-value", 
  "role": "deployer"
}

# List all tokens (admin only)
GET /v1/tokens

# Delete token (admin only) 
DELETE /v1/tokens/:name
```

### Project Management (`/v1/projects`)
- `POST /v1/projects` - **Deployer+** (create projects)
- `GET /v1/projects` - **Viewer+** (list projects)
- `GET /v1/projects/:id` - **Viewer+** (get project details)
- `DELETE /v1/projects/:id` - **Deployer+** (delete projects)

### Service Management (`/v1/services`)
- `POST /v1/projects/:id/services` - **Deployer+** (create services)
- `GET /v1/projects/:id/services` - **Viewer+** (list services)  
- `GET /v1/services/:id` - **Viewer+** (get service details)
- `DELETE /v1/services/:id` - **Deployer+** (delete services)
- `POST /v1/services/:id/{start,stop,restart}` - **Deployer+** (lifecycle)
- `GET /v1/services/:id/{logs,stats}` - **Viewer+** (observability)

### Route Management (`/v1/routes`) 
- `POST /v1/projects/:id/routes` - **Deployer+** (create routes)
- `GET /v1/projects/:id/routes` - **Viewer+** (list project routes)
- `GET /v1/routes` - **Viewer+** (list all routes)
- `GET /v1/routes/:id` - **Viewer+** (get route details) 
- `DELETE /v1/routes/:id` - **Deployer+** (delete routes)

### CI/CD Operations (`/v1/cicd`)
- `POST /v1/cicd/services/:id/build` - **Deployer+** (trigger builds)
- `POST /v1/cicd/services/:id/deploy` - **Deployer+** (trigger deployments)
- `POST /v1/cicd/services/:id/rollback` - **Deployer+** (rollback deployments)
- `GET /v1/cicd/services/:id/{builds,deployments}` - **Viewer+** (view history)
- `GET /v1/cicd/{builds,deployments,jobs}/:id` - **Viewer+** (view details)

### Certificate Management (`/v1/certs`) - **Admin Only**
```bash  
# Issue new certificate (admin only)
POST /v1/certs/issue

# List certificates (admin only)
GET /v1/certs

# Renew certificate (admin only)
POST /v1/certs/:domain/renew

# Get certificate details (admin only) 
GET /v1/certs/:domain

# Get certificate status (admin only)
GET /v1/certs/:domain/status
```

### System Operations (`/v1/system`) - **Admin Only**
```bash
# Reload nginx configuration (admin only)
POST /v1/system/nginx/reload
```

### Metrics (`/v1/metrics`) - **Viewer+**
```bash
# Get system metrics (all authenticated users)
GET /v1/metrics
```

## Usage Examples

### Creating Tokens with Different Roles

```bash
# Admin creates a deployer token
curl -X POST http://localhost:8080/v1/tokens \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ci-deployer",
    "plain": "secure-deployer-secret", 
    "role": "deployer"
  }'

# Admin creates a viewer token for monitoring
curl -X POST http://localhost:8080/v1/tokens \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "monitoring-viewer",
    "plain": "readonly-secret",
    "role": "viewer" 
  }'
```

### Role-Based API Access

```bash
# Deployer can create services
curl -X POST http://localhost:8080/v1/projects/1/services \
  -H "Authorization: Bearer ci-deployer" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "web-app",
    "image": "nginx:alpine",
    "ports": [{"container": 80, "host": 8080}]
  }'

# Deployer CANNOT create tokens (403 Forbidden)
curl -X POST http://localhost:8080/v1/tokens \
  -H "Authorization: Bearer ci-deployer" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test", 
    "plain": "secret",
    "role": "viewer"
  }'

# Viewer can read services
curl -X GET http://localhost:8080/v1/services/1 \
  -H "Authorization: Bearer monitoring-viewer"

# Viewer CANNOT delete services (403 Forbidden) 
curl -X DELETE http://localhost:8080/v1/services/1 \
  -H "Authorization: Bearer monitoring-viewer"
```

## Security Considerations

### Token Security
- **Store tokens securely**: Never commit tokens to version control
- **Use environment variables**: Store tokens in secure environment variables
- **Rotate tokens regularly**: Replace tokens periodically for security
- **Use principle of least privilege**: Assign the minimum role required

### Role Assignment Best Practices
- **Admin role**: Reserve for system administrators only
- **Deployer role**: Assign to CI/CD systems and deployment tools  
- **Viewer role**: Use for monitoring systems and read-only access

### Network Security
- **Use HTTPS**: Always use TLS encryption in production
- **Network isolation**: Restrict network access to glinrdock API
- **Firewall rules**: Configure firewalls to limit access sources

## Database Schema

The RBAC system adds a `role` column to the existing tokens table:

```sql
ALTER TABLE tokens ADD COLUMN role TEXT NOT NULL DEFAULT 'admin';
CREATE INDEX idx_tokens_role ON tokens(role);
```

## Implementation Details

### Middleware Chain
1. **Authentication Middleware**: Validates Bearer token and loads user role
2. **Authorization Middleware**: Checks if user role has required permissions
3. **Handler**: Processes the request if authorized

### Role Validation
- Roles are case-sensitive strings: `"admin"`, `"deployer"`, `"viewer"`
- Invalid roles are rejected during token creation
- Role hierarchy is enforced in permission checks

### Error Responses
- `401 Unauthorized`: Missing or invalid token
- `403 Forbidden`: Valid token but insufficient permissions
- `400 Bad Request`: Invalid role in token creation request

## Testing

Comprehensive tests verify RBAC functionality:

```bash
# Run RBAC-specific tests
go test ./internal/store -v -run "Role\|RBAC"
go test ./internal/auth -v  
go test ./internal/api -v -run "RBAC"
```

## Migration Notes

When upgrading from pre-RBAC versions:
1. Existing tokens will be assigned the default "admin" role
2. No breaking changes to existing API endpoints
3. New role-based restrictions will be enforced immediately
4. Use the bootstrap admin token feature for smooth transitions

## Troubleshooting

### Common Issues

**403 Forbidden on previously working endpoints**:
- Check if your token has the required role for the endpoint
- Admin tokens can access all endpoints
- Deployer tokens cannot access token/cert management  
- Viewer tokens are read-only

**Token creation fails with "invalid role"**:
- Valid roles are: `admin`, `deployer`, `viewer` (case-sensitive)
- Empty role defaults to `admin`
- Only admin tokens can create new tokens

**Bootstrap admin token not working**:
- Ensure `ADMIN_TOKEN` environment variable is set
- Bootstrap only works when no tokens exist in database
- Check logs for bootstrap success message