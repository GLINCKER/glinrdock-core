---
title: Networking & Reverse Proxy
section: Using
slug: using/networking
tags: networking, proxy, nginx, ssl, certificates, routing
version: v1
audience: user
---

# Networking & Reverse Proxy

GLINRDOCK offers flexible networking options to suit different deployment scenarios, from simple development setups to production-ready configurations with advanced reverse proxy capabilities.

## Networking Modes

### Host-Bound Port Mode (Default)

In the default configuration, services are exposed directly through host ports:

- **Simple Setup**: Each service maps to a unique port on the Docker host
- **Direct Access**: Services are accessible at `http://your-server:port`
- **No SSL Termination**: HTTPS must be handled by individual services
- **Basic Routing**: Routes store domain mappings but don't actively proxy traffic

This mode is ideal for:
- Development environments
- Internal services that don't need external access
- Simple deployments with minimal networking requirements

### Nginx Reverse Proxy Mode

When enabled, nginx acts as a reverse proxy with advanced features:

- **Domain-Based Routing**: Access services via custom domains
- **Automatic SSL/TLS**: Let's Encrypt certificate provisioning and renewal
- **Load Balancing**: Distribute traffic across multiple service instances
- **Advanced Routing**: Path-based routing, headers, and traffic management
- **Security**: Rate limiting, security headers, and centralized access control

This mode is ideal for:
- Production deployments
- Public-facing applications
- Services requiring SSL certificates
- Complex routing requirements

## Enabling Nginx Reverse Proxy

### Environment Variable Configuration

To enable nginx reverse proxy, set the following environment variable:

```bash
NGINX_PROXY_ENABLED=true
```

### Full Configuration Example

```bash
# Basic configuration
NGINX_PROXY_ENABLED=true
DATA_DIR=/data/glinrdock
HTTP_ADDR=:8080

# Optional: Master secret for certificate encryption
GLINRDOCK_SECRET=$(openssl rand -base64 32)

# Start GLINRDOCK
./glinrdockd
```

### Docker Compose Configuration

```yaml
version: '3.8'
services:
  glinrdock:
    image: glinrdock:latest
    ports:
      - "80:80"     # HTTP traffic
      - "443:443"   # HTTPS traffic  
      - "8080:8080" # Management interface
    environment:
      - NGINX_PROXY_ENABLED=true
      - GLINRDOCK_SECRET=${GLINRDOCK_SECRET}
    volumes:
      - ./data:/data
      - /var/run/docker.sock:/var/run/docker.sock
```

## Feature Comparison

| Feature | Host-Bound Ports | Nginx Reverse Proxy |
|---------|------------------|---------------------|
| **Setup Complexity** | Simple | Moderate |
| **Custom Domains** | Manual DNS only | ✅ Automatic routing |
| **SSL Certificates** | Manual setup | ✅ Auto Let's Encrypt |
| **Load Balancing** | ❌ | ✅ Built-in |
| **Path Routing** | ❌ | ✅ Advanced patterns |
| **Rate Limiting** | ❌ | ✅ Built-in |
| **Security Headers** | ❌ | ✅ Automatic |
| **Performance** | Direct connection | Optimized proxy |

## SSL Certificate Management

### Automatic Certificates (Nginx Mode Only)

When nginx reverse proxy is enabled:

1. **Domain Validation**: Ensure your domain points to your server's IP
2. **Automatic Issuance**: Certificates are automatically requested from Let's Encrypt
3. **Auto-Renewal**: Certificates renew automatically before expiration
4. **Security**: Private keys are encrypted at rest using AES-GCM

### Manual Certificates

Upload your own certificates for:
- Internal domains
- Custom certificate authorities
- Wildcard certificates

```bash
# Upload a certificate via API
curl -X POST /v1/certificates \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "domain": "api.example.com",
    "type": "manual",
    "cert_data": "-----BEGIN CERTIFICATE-----\n...",
    "key_data": "-----BEGIN PRIVATE KEY-----\n...",
    "auto_renew": false
  }'
```

## Troubleshooting

### Nginx Proxy Not Working

1. **Check Environment Variable**:
   ```bash
   echo $NGINX_PROXY_ENABLED
   ```

2. **Verify Nginx Status**:
   ```bash
   curl -H "Authorization: Bearer admin-token" \
        http://localhost:8080/v1/nginx/status
   ```

3. **Check Configuration**:
   ```bash
   curl -H "Authorization: Bearer admin-token" \
        http://localhost:8080/v1/nginx/validate
   ```

### Certificate Issues

1. **Domain Not Pointing to Server**:
   - Verify DNS with `nslookup your-domain.com`
   - Ensure A record points to correct IP

2. **Port 80 Blocked**:
   - Let's Encrypt requires port 80 for HTTP challenges
   - Check firewall settings

3. **Rate Limiting**:
   - Let's Encrypt has rate limits per domain
   - Wait before retrying failed certificate requests

### Migration Between Modes

**From Host-Bound to Nginx Proxy**:
1. Set `NGINX_PROXY_ENABLED=true`
2. Restart GLINRDOCK
3. Update DNS to point to ports 80/443
4. Existing routes will automatically use nginx

**From Nginx Proxy to Host-Bound**:
1. Set `NGINX_PROXY_ENABLED=false`
2. Restart GLINRDOCK
3. Routes become informational only
4. Access services directly via host ports

## Best Practices

### Development

- Use host-bound ports for rapid iteration
- Enable nginx proxy when testing domains
- Use self-signed certificates for internal testing

### Staging

- Enable nginx proxy for production-like testing
- Use Let's Encrypt staging environment first
- Test certificate renewal processes

### Production

- Always enable nginx proxy for public services
- Monitor certificate expiration dates
- Set up alerting for nginx configuration errors
- Use redundant deployments for high availability

## Security Considerations

### Network Security

- **Firewall Configuration**: Only expose necessary ports (80, 443, 8080)
- **Access Control**: Restrict admin API access to trusted networks
- **Regular Updates**: Keep nginx and GLINRDOCK updated

### Certificate Security

- **Private Key Protection**: Keys are encrypted at rest automatically
- **Access Logging**: All certificate operations are audit logged
- **Rotation**: Certificates auto-renew every 60 days

### Monitoring

- **Health Checks**: Monitor nginx proxy health status
- **Certificate Expiry**: Set alerts 30 days before expiration
- **Rate Limits**: Monitor Let's Encrypt usage against limits

## Advanced Configuration

### Custom Nginx Configuration

For advanced use cases, nginx configuration can be customized:

1. **Headers**: Add custom security headers
2. **Rate Limiting**: Configure per-route rate limits
3. **Caching**: Set up proxy caching rules
4. **Upstream**: Configure multiple backend servers

### Load Balancing

When nginx proxy is enabled, you can:
- Deploy multiple instances of the same service
- Configure health checks for backend services  
- Use different load balancing algorithms
- Handle service failover automatically

## Getting Help

If you encounter issues with networking configuration:

1. Check the **Routes** page for the status banner
2. Review nginx logs in the GLINRDOCK interface
3. Use the nginx validation endpoint to check configuration
4. Consult the troubleshooting section above

The networking mode can be changed at any time by restarting with different environment variables, making it easy to adapt your deployment as requirements evolve.