# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| 0.x     | :x:                |

## Reporting a Vulnerability

To report a security vulnerability, please email: **security@glincker.dev**

- Include detailed reproduction steps
- Provide impact assessment 
- Allow 48 hours for initial response
- Security issues receive priority handling

## Runtime Hardening

### Production Build Checklist

- [ ] Build with `make pack` for static binary
- [ ] Run with non-root user (UID 1000+)
- [ ] Set read-only filesystem where possible
- [ ] Limit file descriptors and processes
- [ ] Configure memory limits via cgroups

### Systemd Service Hardening

```ini
[Service]
User=glinrdock
Group=glinrdock
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/glinrdock
CapabilityBoundingSet=
SystemCallFilter=@system-service
```

## Secrets Handling

### Token Security Rules

- **ADMIN_TOKEN**: Minimum 32 characters, cryptographically random
- **Storage**: Never log tokens in plaintext
- **Transport**: HTTPS only in production
- **Rotation**: Implement token rotation capability
- **Validation**: Constant-time comparison only

### Database Security

- **SQLite**: Set file permissions 600 (owner read/write only)
- **Location**: Store in dedicated DATA_DIR with restricted access
- **Backups**: Encrypt database backups at rest

## OAuth Authentication Security

### Configuration Security

**Environment Variables**:
- `GITHUB_OAUTH_CLIENT_SECRET`: Store securely, never log
- `GLINRDOCK_SECRET`: 32-byte base64-encoded key for CSRF/sessions
- `EXTERNAL_BASE_URL`: Must match registered OAuth callback

**Key Generation**:
```bash
# Generate secure HMAC key
openssl rand -base64 32
```

### CSRF Protection

OAuth flows use comprehensive CSRF protection:

**State Token Security**:
- Cryptographically random values with timestamps
- HMAC-SHA256 signed using `GLINRDOCK_SECRET`
- 10-minute expiration window
- Stored in HttpOnly, Secure, SameSite=Lax cookies

**Implementation**:
```
state = timestamp:random_bytes
signature = HMAC-SHA256(state, GLINRDOCK_SECRET)
csrf_token = state.signature
```

### Session Management

**Cookie Security**:
- `HttpOnly`: Prevents XSS access
- `Secure`: HTTPS-only transmission  
- `SameSite=Lax`: CSRF protection
- `MaxAge=24h`: Short session lifetime

**Session Token Structure**:
- JSON payload with user info and timestamps
- HMAC-SHA256 signature for integrity
- Base64 encoding for transport
- Automatic expiration handling

### GitHub OAuth App Security

**Required Settings**:
- **Homepage URL**: Match your `EXTERNAL_BASE_URL`
- **Callback URL**: Exactly `https://your-domain.com/v1/auth/github/callback`
- **Application Type**: Web application
- **Request user authorization**: Read user profile and email

**Secret Management**:
- Rotate OAuth secrets when team members leave
- Monitor OAuth app access logs in GitHub
- Use organization-owned apps for team deployments
- Restrict OAuth app permissions to minimum required

### Rate Limiting

**Authentication Limits**:
- 5 failed attempts per IP per minute
- Exponential backoff: 1→2→4→8→16 minutes
- Automatic reset on successful authentication
- Per-IP memory-based tracking

### Audit Trail

**OAuth Events Logged**:
- OAuth login attempts and results
- User account creation and updates
- Session establishment and termination
- Role changes and permission grants
- CSRF token validation failures

### Security Headers

**Recommended Headers**:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```