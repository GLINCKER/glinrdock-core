# GLINRDOCK API Documentation

## Routes API

### List All Routes

Retrieves all routes across all services.

```http
GET /v1/routes
Authorization: Bearer {token}
```

**Response:**
```json
{
  "routes": [
    {
      "id": 1,
      "service_id": 1,
      "domain": "api.example.com",
      "path": "/",
      "port": 3000,
      "tls": true,
      "created_at": "2023-01-01T00:00:00Z"
    }
  ]
}
```

### List Service Routes

Retrieves all routes for a specific service.

```http
GET /v1/services/{serviceId}/routes
Authorization: Bearer {token}
```

**Response:**
```json
{
  "routes": [
    {
      "id": 1,
      "service_id": 1,
      "domain": "service.example.com",
      "path": "/api",
      "port": 8080,
      "tls": false,
      "created_at": "2023-01-01T00:00:00Z"
    }
  ]
}
```

### Create Route

Creates a new route for a service.

```http
POST /v1/services/{serviceId}/routes
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "domain": "new.example.com",
  "path": "/",
  "port": 80,
  "tls": false
}
```

**Response:**
```json
{
  "id": 2,
  "service_id": 1,
  "domain": "new.example.com", 
  "path": "/",
  "port": 80,
  "tls": false,
  "created_at": "2023-01-01T00:00:00Z"
}
```

**Validation Rules:**
- `domain`: Required, valid domain format (RFC 1123)
- `path`: Optional, defaults to "/", must start with "/"
- `port`: Required, integer between 1-65535
- `tls`: Optional, boolean, defaults to false

### Delete Route

Deletes an existing route.

```http
DELETE /v1/routes/{routeId}
Authorization: Bearer {token}
```

**Response:**
```
200 OK (empty body)
```

### Nginx Reload

Reloads nginx configuration (admin only).

```http
POST /v1/system/nginx/reload
Authorization: Bearer {token}
Content-Type: application/json
```

**Response:**
```json
{
  "message": "Nginx configuration reloaded successfully"
}
```

## Route Object Schema

```typescript
interface Route {
  id: number
  service_id: number
  domain: string
  path: string
  port: number
  tls: boolean
  created_at: string // ISO 8601 timestamp
}
```

## Error Responses

All endpoints may return these error formats:

**Client Errors (4xx):**
```json
{
  "error": "Domain already exists"
}
```

**Server Errors (5xx):**
```json
{
  "error": "Internal server error"
}
```

**Quota Errors:**
```json
{
  "error": "quota_exceeded",
  "limit": 5,
  "plan": "FREE",
  "resource": "routes",
  "message": "Route quota exceeded"
}
```

## RBAC Requirements

- **Admin**: Full access to all operations including nginx reload
- **Deployer**: Can create/delete routes for services they have access to
- **Viewer**: Read-only access to routes

Routes operations respect project-level permissions - users can only manage routes for services in projects they have access to.