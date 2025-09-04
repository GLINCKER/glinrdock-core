# Certificate Management Guide

This guide covers HTTPS certificate automation, issuance, renewal, and troubleshooting in glinrdock.

## Overview

glinrdock provides automated TLS certificate management using Let's Encrypt ACME protocol. Features include:

- **Automatic issuance** via HTTP-01 challenge
- **Daily renewal checks** for certificates expiring within 30 days  
- **Safe nginx reloads** with backup and rollback capability
- **Manual certificate management** via API endpoints
- **Comprehensive monitoring** and status tracking

## Prerequisites

### DNS Configuration
- Domain must point to your glinrdock server's IP address
- DNS propagation must be complete before certificate issuance
- Wildcard certificates are not supported (use HTTP-01 challenge only)

### Network Requirements
- Port 80 must be open and accessible from the internet
- No other web servers should be running on port 80
- Firewall must allow HTTP traffic for ACME challenges

### Server Requirements
- nginx must be installed and accessible via command line
- Sufficient disk space in DATA_DIR for certificate storage
- System permissions to reload nginx (typically requires sudo)

## Directory Structure

Certificates are stored under `DATA_DIR/certs/` with the following structure:

```
DATA_DIR/certs/
├── challenges/           # ACME HTTP-01 challenge responses
├── example.com/          # Domain-specific certificate directory
│   ├── fullchain.pem    # Certificate + intermediate chain
│   └── privkey.pem      # Private key (mode 0600)
└── api.example.com/
    ├── fullchain.pem
    └── privkey.pem
```

## API Usage

### Issue New Certificate

```bash
curl -X POST http://localhost:8080/v1/certs/issue \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "domain": "api.example.com",
    "email": "admin@example.com"
  }'
```

Response:
```json
{
  "domain": "api.example.com",
  "email": "admin@example.com", 
  "status": "queued",
  "expires_at": null,
  "job_id": "1640995200000000000"
}
```

### List All Certificates

```bash
curl -X GET http://localhost:8080/v1/certs \
  -H "Authorization: Bearer <token>"
```

Response:
```json
[
  {
    "id": 1,
    "domain": "api.example.com",
    "email": "admin@example.com",
    "status": "issued",
    "last_issued_at": "2024-01-01T12:00:00Z",
    "expires_at": "2024-04-01T12:00:00Z",
    "created_at": "2024-01-01T11:55:00Z"
  }
]
```

### Force Certificate Renewal

```bash
curl -X POST http://localhost:8080/v1/certs/api.example.com/renew \
  -H "Authorization: Bearer <token>"
```

### Get Certificate Status

```bash
curl -X GET http://localhost:8080/v1/certs/api.example.com/status \
  -H "Authorization: Bearer <token>"
```

Response:
```json
{
  "domain": "api.example.com",
  "email": "admin@example.com",
  "status": "issued", 
  "expires_at": "2024-04-01T12:00:00Z",
  "last_issued_at": "2024-01-01T12:00:00Z",
  "created_at": "2024-01-01T11:55:00Z",
  "cert_path": "/data/certs/api.example.com/fullchain.pem",
  "key_path": "/data/certs/api.example.com/privkey.pem"
}
```

### Manual Nginx Reload

```bash
curl -X POST http://localhost:8080/v1/system/nginx/reload \
  -H "Authorization: Bearer <token>"
```

## Automatic Renewal

### Daily Job
glinrdock runs a daily background job that:
1. Checks all certificates for expiration within 30 days
2. Attempts renewal for expiring certificates
3. Reloads nginx only if any certificates were renewed
4. Logs all operations with structured logging

### Renewal Process
1. **Validation**: Domain and email format validation
2. **ACME Challenge**: HTTP-01 challenge setup at `/.well-known/acme-challenge/`
3. **Certificate Request**: Submit CSR to Let's Encrypt
4. **Storage**: Save fullchain.pem and privkey.pem to disk
5. **Database Update**: Record issuance and expiry dates
6. **Nginx Reload**: Safe reload with backup and rollback

## Nginx Integration

### Challenge Directory
Nginx must serve ACME challenges from `DATA_DIR/certs/challenges/`:

```nginx
server {
    listen 80;
    server_name _;
    
    location /.well-known/acme-challenge/ {
        root /path/to/DATA_DIR/certs/challenges;
        try_files $uri =404;
    }
    
    # Redirect other HTTP traffic to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}
```

### Certificate Paths
Use the certificate files in your HTTPS server blocks:

```nginx
server {
    listen 443 ssl http2;
    server_name api.example.com;
    
    ssl_certificate /path/to/DATA_DIR/certs/api.example.com/fullchain.pem;
    ssl_certificate_key /path/to/DATA_DIR/certs/api.example.com/privkey.pem;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
    ssl_prefer_server_ciphers off;
    
    location / {
        proxy_pass http://upstream_backend;
    }
}
```

### Safe Reload Process
When nginx reload is triggered:
1. **Backup**: Current config backed up to `.backup` file
2. **Process Info**: Log nginx master PID and start time
3. **Validation**: Run `nginx -t` to validate configuration
4. **Reload**: Execute `nginx -s reload`
5. **Rollback**: On failure, restore backup and retry reload
6. **Cleanup**: Remove temporary files on success

## Monitoring and Logging

### Certificate Status
Monitor certificate status via API endpoints or database queries:

```sql
SELECT domain, status, expires_at, 
       CASE 
         WHEN expires_at <= datetime('now', '+30 days') THEN 'EXPIRING_SOON'
         WHEN expires_at <= datetime('now') THEN 'EXPIRED' 
         ELSE 'VALID'
       END as health_status
FROM certs 
ORDER BY expires_at ASC;
```

### Log Analysis
Certificate operations are logged with structured fields:

```bash
# Filter certificate issuance logs
grep "certificate issued successfully" /var/log/glinrdock.log

# Monitor renewal job runs
grep "daily certificate renewal" /var/log/glinrdock.log

# Check nginx reload status
grep "nginx reload" /var/log/glinrdock.log
```

### Job Monitoring
Track background job progress:

```bash
curl -X GET http://localhost:8080/v1/cicd/jobs/<job_id> \
  -H "Authorization: Bearer <token>"
```

## Troubleshooting

### Common Issues

#### Certificate Issuance Failed
**Symptoms**: Status remains "failed", no certificate files created

**Causes & Solutions**:
- **DNS not resolved**: Verify domain points to server IP
  ```bash
  dig +short api.example.com
  nslookup api.example.com
  ```
- **Port 80 blocked**: Check firewall and port accessibility
  ```bash
  sudo netstat -tlnp | grep :80
  curl -I http://api.example.com/.well-known/acme-challenge/test
  ```
- **Challenge directory permissions**: Ensure nginx can read challenge files
  ```bash
  sudo chown -R nginx:nginx /data/certs/challenges/
  sudo chmod -R 755 /data/certs/challenges/
  ```

#### Rate Limit Exceeded
**Symptoms**: Error message contains "too many certificates already issued"

**Solutions**:
- Let's Encrypt has rate limits: 50 certificates per domain per week
- Use staging server for testing: set `ACME_URL=https://acme-staging-v02.api.letsencrypt.org/directory`
- Wait for rate limit window to reset (typically 1 week)

#### Nginx Reload Failed
**Symptoms**: Certificate issued but nginx reload fails

**Debugging**:
```bash
# Test nginx configuration manually
sudo nginx -t

# Check nginx process status
sudo systemctl status nginx

# Review nginx error logs
sudo tail -f /var/log/nginx/error.log
```

**Common fixes**:
- Fix nginx configuration syntax errors
- Ensure certificate files exist and are readable
- Check nginx has permission to access certificate files
- Restart nginx service if stuck: `sudo systemctl restart nginx`

#### Permission Issues
**Symptoms**: "failed to write certificate files" or similar permission errors

**Solutions**:
```bash
# Ensure glinrdock has write access to DATA_DIR
sudo chown -R glinrdock:glinrdock /data/certs/
sudo chmod -R 755 /data/certs/

# Ensure nginx can read certificate files  
sudo chmod 644 /data/certs/*/fullchain.pem
sudo chmod 600 /data/certs/*/privkey.pem
```

### Debugging Commands

#### Check Certificate Expiry
```bash
# Check certificate expiration date
openssl x509 -in /data/certs/api.example.com/fullchain.pem -noout -dates

# Verify certificate chain
openssl verify -CAfile /etc/ssl/certs/ca-certificates.crt /data/certs/api.example.com/fullchain.pem
```

#### Test ACME Challenge
```bash
# Manually test challenge endpoint
echo "test-challenge-response" > /data/certs/challenges/test-challenge
curl http://api.example.com/.well-known/acme-challenge/test-challenge
```

#### Database Inspection
```bash
# Connect to database
sqlite3 /data/glinrdock.db

# Check certificate records
.mode column
.headers on
SELECT * FROM certs ORDER BY created_at DESC;

# Find expiring certificates
SELECT domain, expires_at FROM certs 
WHERE expires_at <= datetime('now', '+30 days') 
ORDER BY expires_at;
```

#### Manual Renewal Test
```bash
# Force renewal via API
curl -X POST http://localhost:8080/v1/certs/api.example.com/renew \
  -H "Authorization: Bearer <token>"

# Monitor job progress  
curl -X GET http://localhost:8080/v1/cicd/jobs/<job_id> \
  -H "Authorization: Bearer <token>"
```

## Configuration

### Environment Variables
- `ACME_URL`: ACME server URL (default: Let's Encrypt production)
- `DATA_DIR`: Base directory for certificate storage
- `NGINX_CONFIG_PATH`: Path to nginx configuration file
- `CERT_RENEWAL_DAYS`: Days before expiry to trigger renewal (default: 30)

### Staging vs Production
For testing, use Let's Encrypt staging server:

```bash
export ACME_URL=https://acme-staging-v02.api.letsencrypt.org/directory
```

Staging certificates:
- ✅ No rate limits for testing
- ✅ Same API and process as production  
- ❌ Not trusted by browsers (testing only)
- ❌ Must be replaced with production certificates

### Security Considerations

#### Private Key Protection
- Private keys stored with mode 0600 (owner read/write only)
- Keys never transmitted or logged
- Separate key per domain for isolation

#### API Security  
- All certificate endpoints require authentication
- No webhook endpoints (certificates only via authenticated API)
- Rate limiting recommended for certificate issuance endpoints

#### Nginx Security
- Keep nginx updated for security patches
- Use modern TLS configuration (TLS 1.2+ only)
- Implement proper SSL ciphers and headers
- Regular security scanning of TLS configuration

## Backup and Recovery

### Certificate Backup
Include certificate directory in regular backups:

```bash
# Backup certificates
tar -czf certs-backup-$(date +%Y%m%d).tar.gz /data/certs/

# Backup certificate database records
sqlite3 /data/glinrdock.db ".dump certs" > certs-db-backup-$(date +%Y%m%d).sql
```

### Disaster Recovery
1. **Restore certificate files** from backup
2. **Restore database records** to track expiry dates
3. **Verify nginx configuration** references correct certificate paths
4. **Test certificate validity** with openssl commands
5. **Force renewal** if certificates are near expiry

### High Availability
For HA setups:
- Use shared storage for certificate files (NFS, distributed filesystem)
- Replicate certificate database records across instances
- Coordinate renewal jobs to avoid conflicts
- Load balance HTTP-01 challenges appropriately

## Best Practices

### Operational
- Monitor certificate expiry dates proactively
- Set up alerting for failed renewals
- Test nginx configuration before reloads  
- Keep logs for audit and troubleshooting
- Use staging environment for testing changes

### Security
- Rotate API tokens regularly
- Limit certificate issuance API access
- Monitor for unauthorized certificate requests
- Keep private keys secure and backed up
- Use short-lived certificates where possible

### Performance
- Batch certificate renewals during low-traffic periods
- Use nginx `ssl_session_cache` for better performance
- Monitor renewal job duration and resource usage
- Clean up old certificate files periodically