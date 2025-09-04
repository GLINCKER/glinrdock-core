# GLINRDOCK Networking Architecture Analysis & Nginx Integration Plan

## Implementation Checklist

Track implementation progress of the networking architecture plan:

- [x] **Migrations**: Database schema for certificates and nginx configs
- [x] **Store**: Certificate and nginx configuration storage layer
- [x] **Generator**: Nginx configuration template generation system
- [x] **Manager**: Nginx lifecycle and reconciliation management
- [x] **API**: Certificate and nginx management API endpoints
- [ ] **UI Routes**: Route creation and management interface
- [ ] **UI Certs**: Certificate management interface 
- [x] **Reconcile**: Automatic nginx configuration reconciliation
- [ ] **Help page**: Documentation and user guidance
- [x] **Tests**: Integration tests for nginx proxy functionality

## Overview
This document provides a comprehensive analysis of GLINRDOCK's current networking, port management, service configuration, and routes implementation. It serves as a foundation for planning nginx integration, certificate management, and advanced proxying capabilities.

## Current Architecture Summary

### 1. Service Architecture

**Service Model (store/models.go:Service)**
```go
type Service struct {
    ID               int64              `json:"id"`
    ProjectID        int64              `json:"project_id"`
    Name             string             `json:"name"`
    Description      *string            `json:"description,omitempty"`
    Image            string             `json:"image"`
    ContainerID      *string            `json:"container_id,omitempty"`
    Status           string             `json:"status,omitempty"`
    Env              map[string]string  `json:"env"`
    Ports            []PortMap          `json:"ports"`              // Host->Container port mappings
    Volumes          []VolumeMap        `json:"volumes,omitempty"`
    RegistryID       *string            `json:"registry_id,omitempty"`
    HealthPath       *string            `json:"health_path,omitempty"`
    DesiredState     string             `json:"desired_state"`      // running|stopped
    HealthStatus     string             `json:"health_status"`      // ok|fail|unknown
    Network          *ServiceNetwork    `json:"network,omitempty"`  // Runtime networking info
    // Additional state management fields...
}
```

**Port Mapping Structure**
```go
type PortMap struct {
    Container int `json:"container"`  // Internal container port
    Host      int `json:"host"`       // External host port
}
```

**Current Port Management:**
- **Direct Host Port Binding**: Services expose ports directly on the Docker host
- **1:1 Mapping**: Each service port maps to a unique host port
- **Manual Port Assignment**: Users manually specify host ports
- **No Load Balancing**: Direct container access only

### 2. Route Architecture

**Route Model (store/models.go:Route)**
```go
type Route struct {
    ID        int64     `json:"id"`
    ServiceID int64     `json:"service_id"`    // Links to specific service
    Domain    string    `json:"domain"`        // External domain/hostname
    Port      int       `json:"port"`          // Service container port
    TLS       bool      `json:"tls"`           // TLS enablement flag
    CreatedAt time.Time `json:"created_at"`
}

type RouteSpec struct {
    Domain string `json:"domain" binding:"required"`
    Port   int    `json:"port" binding:"required,min=1,max=65535"`
    TLS    bool   `json:"tls"`
}
```

**Current Route Management:**
- **Simple Domain Mapping**: Routes map domains to service:port combinations
- **Basic TLS Flag**: Boolean flag for TLS enablement (not yet implemented)
- **No SSL Certificate Management**: TLS handling not implemented
- **No Reverse Proxy**: Routes are conceptual only, not actively proxied

### 3. Networking Architecture

**Service Networking Model**
```go
type ServiceNetwork struct {
    ProjectNetwork string                `json:"project_network"`  // Docker network name
    Aliases        []string              `json:"aliases"`          // DNS aliases
    Networks       []NetworkConnection   `json:"networks"`         // Network connections
    IPv4           *string               `json:"ipv4,omitempty"`   // Container IP
    PortsInternal  []InternalPortMapping `json:"ports_internal"`   // Internal mappings
    DNSHint        string                `json:"dns_hint"`         // Usage examples
    CurlHint       string                `json:"curl_hint"`        // Testing commands
}
```

**Current Network Implementation:**
- **Project-Scoped Networks**: Each project gets its own Docker network
- **DNS Resolution**: Services can communicate via service names
- **Network Isolation**: Projects are network-isolated by default
- **Service Linking**: Basic service-to-service connectivity within projects

## Current Limitations & Pain Points

### 1. Port Management Issues
- **Port Conflicts**: Manual port assignment leads to collisions
- **Scaling Limitations**: Can't easily scale services (each needs unique port)
- **Port Exhaustion**: Limited host port range
- **Management Overhead**: Users must track and assign ports manually

### 2. Route/TLS Limitations
- **No Actual Proxying**: Routes exist in database but don't function
- **No Certificate Management**: TLS flag exists but no SSL/certificate handling
- **No Load Balancing**: Single container per service, no distribution
- **No Path-Based Routing**: Only domain-based routing supported

### 3. Networking Gaps
- **No Reverse Proxy**: Direct container access only
- **Limited SSL/TLS**: No certificate provisioning or management
- **No CDN Integration**: No caching or edge optimization
- **No Rate Limiting**: No traffic management capabilities

## Required Nginx Integration Architecture

### 1. Nginx Reverse Proxy Layer

**Components Needed:**
```
[Client] → [Nginx Reverse Proxy] → [Service Containers]
```

**Nginx Configuration Structure:**
```nginx
# Main nginx.conf
upstream service_1_backend {
    server 127.0.0.1:3001;  # Service container port
}

server {
    listen 80;
    listen 443 ssl http2;
    server_name example.com;
    
    # SSL Certificate Management
    ssl_certificate /etc/nginx/certs/example.com.crt;
    ssl_certificate_key /etc/nginx/certs/example.com.key;
    
    # Reverse proxy configuration
    location / {
        proxy_pass http://service_1_backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Certificate Management System

**Required Components:**
1. **Certificate Store Models**
   ```go
   type Certificate struct {
       ID          int64     `json:"id"`
       Domain      string    `json:"domain"`
       Type        string    `json:"type"`        // "letsencrypt", "uploaded", "self-signed"
       CertData    string    `json:"cert_data"`   // PEM certificate
       KeyData     string    `json:"key_data"`    // PEM private key
       ExpiresAt   time.Time `json:"expires_at"`
       AutoRenew   bool      `json:"auto_renew"`
       CreatedAt   time.Time `json:"created_at"`
       UpdatedAt   time.Time `json:"updated_at"`
   }
   ```

2. **ACME/Let's Encrypt Integration**
   - Automatic certificate provisioning
   - Renewal management
   - DNS-01 and HTTP-01 challenge support

3. **Certificate Upload Support**
   - Manual certificate upload
   - Certificate validation
   - Chain certificate handling

### 3. Enhanced Route System

**Extended Route Model:**
```go
type Route struct {
    ID            int64     `json:"id"`
    ServiceID     int64     `json:"service_id"`
    Domain        string    `json:"domain"`
    Path          *string   `json:"path,omitempty"`      // Path-based routing
    Port          int       `json:"port"`
    TLS           bool      `json:"tls"`
    CertificateID *int64    `json:"certificate_id,omitempty"`
    ProxyConfig   *ProxyConfig `json:"proxy_config,omitempty"`
    CreatedAt     time.Time `json:"created_at"`
    UpdatedAt     time.Time `json:"updated_at"`
}

type ProxyConfig struct {
    Timeout       *int      `json:"timeout,omitempty"`        // Proxy timeout
    BufferSize    *string   `json:"buffer_size,omitempty"`    // Buffer configuration
    Headers       map[string]string `json:"headers,omitempty"` // Custom headers
    RateLimiting  *RateLimit `json:"rate_limiting,omitempty"`
    Caching       *CacheConfig `json:"caching,omitempty"`
}
```

## Implementation Phases

### Phase 1: Nginx Container Integration
**Objective:** Deploy nginx as a system container managed by GLINRDOCK

**Tasks:**
1. **Nginx Container Management**
   - Create nginx service template in GLINRDOCK
   - Configure nginx container with volume mounts for config/certs
   - Set up nginx container networking to access all service containers

2. **Configuration Template System**
   - Create nginx config templates
   - Implement config generation from route definitions
   - Add nginx reload mechanism for config changes

3. **API Extensions**
   - Extend route handlers to generate nginx configs
   - Add nginx management endpoints (reload, status)
   - Implement config validation

### Phase 2: Certificate Management
**Objective:** Implement SSL/TLS certificate provisioning and management

**Tasks:**
1. **Certificate Models & Store**
   - Add certificate database models
   - Implement CRUD operations for certificates
   - Add certificate-route associations

2. **Let's Encrypt Integration**
   - Integrate ACME client for automatic certificates
   - Implement HTTP-01 challenge handling
   - Add automatic renewal system

3. **Manual Certificate Support**
   - Add certificate upload endpoints
   - Implement certificate validation
   - Support for certificate chains

### Phase 3: Advanced Proxy Features
**Objective:** Add advanced reverse proxy capabilities

**Tasks:**
1. **Path-Based Routing**
   - Extend route model for path patterns
   - Implement path-based nginx config generation
   - Add path priority handling

2. **Load Balancing**
   - Support multiple service instances
   - Implement upstream configuration
   - Add health checks for backends

3. **Performance Features**
   - HTTP/2 support
   - Compression configuration
   - Static asset optimization

### Phase 4: Monitoring & Management
**Objective:** Add monitoring, analytics, and management tools

**Tasks:**
1. **Nginx Monitoring**
   - Nginx status monitoring
   - Traffic analytics integration
   - Performance metrics collection

2. **Certificate Monitoring**
   - Certificate expiry tracking
   - Renewal status monitoring
   - Alert system for certificate issues

3. **Route Management UI**
   - Enhanced route creation/editing
   - Certificate management interface
   - Nginx configuration preview

## Database Schema Extensions

### New Tables Required:

```sql
-- Certificates table
CREATE TABLE certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL DEFAULT 'letsencrypt',
    cert_data TEXT NOT NULL,
    key_data TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    auto_renew BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Enhanced routes table (migration needed)
ALTER TABLE routes ADD COLUMN path VARCHAR(255);
ALTER TABLE routes ADD COLUMN certificate_id INTEGER;
ALTER TABLE routes ADD COLUMN proxy_config TEXT; -- JSON blob
ALTER TABLE routes ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE routes ADD FOREIGN KEY (certificate_id) REFERENCES certificates(id);

-- Nginx configuration tracking
CREATE TABLE nginx_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_hash VARCHAR(64) NOT NULL,
    config_content TEXT NOT NULL,
    active BOOLEAN DEFAULT false,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## API Extensions Required

### New API Endpoints:

```
# Certificate Management
POST   /v1/certificates              # Create/upload certificate
GET    /v1/certificates              # List certificates  
GET    /v1/certificates/:id          # Get certificate details
DELETE /v1/certificates/:id          # Delete certificate
POST   /v1/certificates/:id/renew    # Trigger renewal

# Enhanced Route Management  
PUT    /v1/routes/:id                # Update route (add path, cert, proxy config)
GET    /v1/routes/:id/config         # Preview nginx config for route

# Nginx Management
POST   /v1/nginx/reload              # Reload nginx configuration
GET    /v1/nginx/status              # Get nginx status
GET    /v1/nginx/config              # Get current nginx config
POST   /v1/nginx/validate            # Validate nginx config
```

## Security Considerations

### 1. Certificate Security
- **Private Key Protection**: Encrypt private keys at rest
- **Access Control**: Restrict certificate access to admin users
- **Audit Logging**: Log all certificate operations

### 2. Nginx Security
- **Configuration Validation**: Prevent malicious nginx configs
- **File System Isolation**: Restrict nginx container file access
- **Rate Limiting**: Implement request rate limiting

### 3. Route Security
- **Domain Validation**: Validate domain ownership for certificates
- **TLS Enforcement**: Option to force HTTPS redirects
- **Header Security**: Security headers (HSTS, CSP, etc.)

## Performance Considerations

### 1. Nginx Optimization
- **Worker Configuration**: Optimize worker processes/connections
- **Caching**: Implement proxy caching for static content
- **Compression**: Enable gzip/brotli compression

### 2. Certificate Performance
- **OCSP Stapling**: Implement OCSP stapling for certificates
- **Session Resumption**: Configure TLS session resumption
- **HTTP/2**: Enable HTTP/2 for better performance

### 3. Configuration Management
- **Config Caching**: Cache generated nginx configs
- **Incremental Reloads**: Minimize nginx reload frequency
- **Background Processing**: Async certificate operations

## Migration Strategy

### 1. Backward Compatibility
- **Existing Routes**: Maintain compatibility with current route definitions
- **Port Mappings**: Continue supporting direct port access during transition
- **Gradual Migration**: Allow mixed nginx/direct access during rollout

### 2. Data Migration
- **Route Enhancement**: Migrate existing routes to new schema
- **Service Discovery**: Update service networking for nginx integration
- **Configuration Backup**: Backup existing configurations before migration

## Testing Strategy

### 1. Nginx Integration Testing
- **Configuration Generation**: Test nginx config generation from routes
- **SSL Certificate Testing**: Test certificate provisioning and renewal
- **Proxy Functionality**: Test reverse proxy behavior

### 2. Performance Testing
- **Load Testing**: Test nginx performance under load
- **SSL Performance**: Test TLS handshake performance
- **Failover Testing**: Test behavior when services are unavailable

## Conclusion

The current GLINRDOCK architecture provides a solid foundation for service and route management, but lacks the sophisticated networking layer needed for production deployments. The proposed nginx integration will add:

1. **Professional Reverse Proxy**: Industry-standard nginx reverse proxy
2. **Automated SSL/TLS**: Let's Encrypt integration with automatic renewal
3. **Advanced Routing**: Path-based routing and load balancing
4. **Enterprise Features**: Rate limiting, caching, and monitoring

This architecture will transform GLINRDOCK from a development tool into a production-ready container platform while maintaining its ease-of-use and developer-friendly approach.

**Next Steps:**
1. Review this architecture analysis with the development team
2. Create detailed implementation specifications for Phase 1
3. Set up development environment for nginx integration testing
4. Begin implementation of nginx container management system

## Design Notes

This section records any deviations from the original plan, with date stamps for tracking.

### 2025-01-05: Certificate Security Implementation
- **Enhancement**: Implemented AES-GCM encryption for private keys at rest
- **Deviation**: Added key_data_nonce field to certificates table for secure encryption
- **Rationale**: Addresses security requirement beyond original plan specification
- **Impact**: Certificate private keys are now encrypted in database storage

### 2025-01-05: API Response Security
- **Enhancement**: Added key redaction in certificate API responses
- **Implementation**: GET responses show only SHA-256 fingerprint and length instead of full keys
- **Rationale**: Prevents accidental key exposure in API responses and logs
- **Impact**: Certificate management UI must handle redacted key responses

### 2025-01-05: Enhanced Route Creation UI
- **Enhancement**: Implemented glassmorphism design for route wizard
- **Features**: Horizontal progress steps, organized form sections, live route preview
- **Deviation**: More sophisticated UI than originally planned
- **Impact**: Improved user experience for route configuration workflow

### 2025-01-05: Nginx E2E Testing Framework
- **Addition**: Created comprehensive end-to-end testing for nginx proxy functionality
- **Implementation**: Build-tag protected tests with dynamic port allocation
- **Rationale**: Ensures nginx proxy functionality works correctly in different environments
- **Impact**: Provides confidence in proxy routing and certificate management features