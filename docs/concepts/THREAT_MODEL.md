# Threat Model

## System Context

```
Internet → Nginx → glinrdock → Docker Socket
                      ↓
                   SQLite DB
```

## Trust Boundaries

1. **Host System**: Full trust - glinrdock runs with host privileges
2. **Docker Socket**: Trusted interface - direct access to container runtime  
3. **Nginx**: Semi-trusted - reverse proxy with basic auth/filtering
4. **Internet**: Untrusted - external client requests

## Assets

### Critical Assets
- **ADMIN_TOKEN**: Grants full system control
- **SQLite Database**: Contains container metadata and configurations
- **Docker Socket**: Access to container lifecycle management

### Sensitive Assets  
- **Container Logs**: May contain application secrets
- **Nginx Configs**: Routing and access control rules
- **System Metrics**: Resource usage and performance data

## Top Risks & Mitigations

### 1. Token Compromise
**Risk**: Admin token leaked or brute-forced  
**Impact**: Full system compromise  
**Mitigations**:
- Minimum 32-character random tokens
- Rate limiting on auth endpoints
- Token rotation capabilities
- Audit logging for admin actions

### 2. Docker Socket Abuse  
**Risk**: Container escape via privileged containers
**Impact**: Host system compromise
**Mitigations**:
- Input validation on container configs
- Blacklist dangerous capabilities
- Monitor container creation events
- Resource limits on all containers

### 3. SQL Injection
**Risk**: Malicious input in container names/labels
**Impact**: Database compromise  
**Mitigations**:
- Parameterized queries only
- Input sanitization and validation
- Principle of least privilege for DB operations

### 4. Resource Exhaustion
**Risk**: DoS via excessive container creation
**Impact**: Service availability  
**Mitigations**:
- Rate limiting on container operations
- Maximum container limits per client
- Resource monitoring and alerting

### 5. Information Disclosure
**Risk**: Sensitive data in logs or API responses  
**Impact**: Data leakage
**Mitigations**:
- Structured logging with field redaction  
- Sanitize API responses
- Secure log storage and rotation