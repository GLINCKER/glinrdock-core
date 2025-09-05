import { HelpDocument, HelpManifestEntry } from '../api'

// Manual help page content that integrates with the help system
// NOTE: Only keep pages here that don't exist in appdocs/ to avoid duplication
export const MANUAL_HELP_PAGES: Record<string, HelpDocument> = {
  'nginx-setup': {
    slug: 'nginx-setup',
    markdown: `# Nginx Setup

Enable reverse proxy in GLINRDOCK with Docker Compose configuration.

## Overview

GLINRDOCK includes an integrated reverse proxy system built on Nginx that allows you to expose your containerized services with custom domains and path-based routing. This system provides a unified entry point for all your services.

### Key Features

- **Automatic service discovery** - Services are automatically detected and configured
- **Path-based and domain-based routing** - Route traffic based on URL paths or domains
- **SSL/TLS certificate management** - Integrated certificate handling
- **Load balancing and health checks** - Built-in load balancing capabilities

## Enabling proxy feature

To enable the nginx proxy feature, you need to set the appropriate feature flag in your environment configuration.

### Environment variables

Add the following environment variable to your \`.env\` file:

\`\`\`bash
NGINX_PROXY_ENABLED=true
\`\`\`

> **Important**: Restart GLINRDOCK after enabling the proxy feature for changes to take effect.

## Docker Compose configuration

Update your \`docker-compose.yml\` file to include the nginx proxy service and configure the required networking.

### Nginx service

Add the nginx service to your compose file:

\`\`\`yaml
services:
  nginx-proxy:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./nginx/certs:/etc/nginx/certs:ro
    networks:
      - glinrdock
    depends_on:
      - glinrdockd

networks:
  glinrdock:
    driver: bridge
\`\`\`

### Service networking

Ensure all your services are connected to the same network:

\`\`\`yaml
  your-service:
    image: your-app:latest
    networks:
      - glinrdock
    labels:
      - "glinrdock.enable=true"
      - "glinrdock.port=3000"
      - "glinrdock.path=/api"
\`\`\`

## Testing the setup

After configuring the nginx proxy, verify that it's working correctly.

### Verify nginx status

Check that the nginx container is running:

\`\`\`bash
docker ps | grep nginx
\`\`\`

### Test proxy functionality

Test that requests are being proxied correctly:

\`\`\`bash
curl -H "Host: your-domain.com" http://localhost/
\`\`\`

### Next Steps

Once nginx is running, proceed to configure SSL certificates for secure HTTPS access.`,
    updated_at: '2025-01-14T00:00:00Z'
  },
  
  'ssl-certificates': {
    slug: 'ssl-certificates',
    markdown: `# SSL Certificates

Manage TLS certificates for secure HTTPS connections in GLINRDOCK.

## Overview

GLINRDOCK provides comprehensive SSL/TLS certificate management with automatic Let's Encrypt integration and support for custom certificates. Secure your services with industry-standard encryption.

### Certificate Features

- **Automatic Let's Encrypt certificate generation** - Zero-config SSL certificates
- **Custom certificate upload and management** - Support for corporate certificates
- **Automatic certificate renewal** - Never worry about expired certificates
- **Wildcard certificate support** - Single certificate for multiple subdomains

## Let's Encrypt automation

GLINRDOCK can automatically generate and manage SSL certificates using Let's Encrypt's ACME protocol.

### Automatic certificate generation

Enable automatic certificate generation for your domains:

\`\`\`bash
# Environment configuration
LETSENCRYPT_ENABLED=true
LETSENCRYPT_EMAIL=your-email@domain.com
LETSENCRYPT_STAGING=false
\`\`\`

### Domain validation

Let's Encrypt uses HTTP-01 challenge for domain validation. Ensure your domain points to your server's public IP:

\`\`\`bash
nslookup your-domain.com
\`\`\`

### Certificate renewal

Certificates are automatically renewed 30 days before expiration. Check renewal status:

\`\`\`bash
docker logs glinrdock-certbot
\`\`\`

## Manual certificate upload

For custom or corporate certificates, you can manually upload certificate files through the web interface.

### Certificate requirements

Ensure your certificate files meet these requirements:

- **Certificate file (.crt)** - Must include the full certificate chain
- **Private key file (.key)** - Must be unencrypted
- **Certificate format** - PEM format only

### Upload process

To upload certificates:

1. Navigate to **Settings → Certificates**
2. Click **Upload Certificate**
3. Select your certificate and key files
4. Enter the domain name
5. Click **Save** to upload

> **Security Note**: Private keys are stored securely and encrypted at rest. Never share your private key files.

## Route configuration with TLS

Configure routes to use SSL certificates for secure HTTPS access to your services.

### Creating secure routes

When creating a new route, enable TLS and select a certificate:

1. Go to **Routes → Add Route**
2. Enter your domain name
3. Set the target service and port
4. Enable **TLS/SSL**
5. Select an available certificate or create a new one

### Automatic HTTPS redirect

Enable automatic HTTP to HTTPS redirection for secure routes:

\`\`\`bash
# Route configuration
FORCE_HTTPS=true
HSTS_ENABLED=true
HSTS_MAX_AGE=31536000
\`\`\`

## Troubleshooting SSL issues

Common SSL certificate problems and their solutions.

### Certificate not trusted

**Problem**: Browser shows "Certificate not trusted" error  
**Solution**: Ensure certificate chain is complete and domain name matches

### Certificate expired

**Problem**: Certificate has expired  
**Solution**: Check auto-renewal logs and manually renew if needed

### Let's Encrypt rate limits

**Problem**: Hit Let's Encrypt rate limits  
**Solution**: Use staging environment for testing, wait for rate limit reset

### Useful commands

Debug SSL issues with these commands:

\`\`\`bash
# Test SSL certificate
openssl s_client -connect your-domain.com:443 -servername your-domain.com

# Check certificate expiration
openssl x509 -in certificate.crt -noout -dates

# Verify certificate chain
openssl verify -CAfile ca-bundle.crt certificate.crt
\`\`\``,
    updated_at: '2025-01-14T00:00:00Z'
  },
  
  'route-management': {
    slug: 'route-management',
    markdown: `# Route Management

Create and manage routes to expose your services through the nginx proxy.

## Overview

Once you have nginx proxy set up and SSL certificates configured, you can create routes to expose your containerized services. Routes define how external traffic reaches your applications.

### Route Features

- **Path-based routing** - Route based on URL paths (/api, /app, etc.)
- **Domain-based routing** - Route based on hostnames (api.domain.com, app.domain.com)
- **Service discovery** - Automatic detection of container services
- **Load balancing** - Distribute traffic across multiple service instances

## Creating routes

Create new routes through the web interface or by configuring service labels.

### Using the web interface

1. Navigate to **Routes → Add Route**
2. Configure the route settings:
   - **Domain/Path**: Set the external URL pattern
   - **Target Service**: Select the destination container
   - **Port**: Specify the service port
   - **TLS**: Enable SSL/TLS if configured

### Using Docker labels

Configure routes directly in your \`docker-compose.yml\`:

\`\`\`yaml
services:
  my-app:
    image: my-app:latest
    networks:
      - glinrdock
    labels:
      - "glinrdock.enable=true"
      - "glinrdock.http.routers.my-app.rule=Host(\`app.example.com\`)"
      - "glinrdock.http.services.my-app.loadbalancer.server.port=3000"
      - "glinrdock.http.routers.my-app.tls=true"
\`\`\`

## Route types

Different routing strategies for different use cases.

### Path-based routing

Route traffic based on URL paths:

\`\`\`yaml
# Route /api/* to api service
- "glinrdock.http.routers.api.rule=PathPrefix(\`/api\`)"

# Route /admin/* to admin service  
- "glinrdock.http.routers.admin.rule=PathPrefix(\`/admin\`)"
\`\`\`

### Domain-based routing

Route traffic based on hostnames:

\`\`\`yaml
# Route api.example.com to api service
- "glinrdock.http.routers.api.rule=Host(\`api.example.com\`)"

# Route app.example.com to frontend service
- "glinrdock.http.routers.app.rule=Host(\`app.example.com\`)"
\`\`\`

### Mixed routing

Combine path and domain routing:

\`\`\`yaml
# Route api.example.com/v1/* to v1 API service
- "glinrdock.http.routers.api-v1.rule=Host(\`api.example.com\`) && PathPrefix(\`/v1\`)"
\`\`\`

## Route configuration

Advanced route configuration options.

### Health checks

Configure health checks for your services:

\`\`\`yaml
labels:
  - "glinrdock.http.services.my-app.loadbalancer.healthcheck.path=/health"
  - "glinrdock.http.services.my-app.loadbalancer.healthcheck.interval=30s"
  - "glinrdock.http.services.my-app.loadbalancer.healthcheck.timeout=10s"
\`\`\`

### Load balancing

Configure load balancing across multiple instances:

\`\`\`yaml
labels:
  - "glinrdock.http.services.my-app.loadbalancer.sticky=true"
  - "glinrdock.http.services.my-app.loadbalancer.sticky.cookie.name=glinrdock"
\`\`\`

### Request modification

Modify requests before forwarding:

\`\`\`yaml
# Strip path prefix
- "glinrdock.http.middlewares.api-strip.stripprefix.prefixes=/api"
- "glinrdock.http.routers.api.middlewares=api-strip"

# Add headers
- "glinrdock.http.middlewares.api-headers.headers.customrequestheaders.X-Forwarded-Proto=https"
\`\`\`

## Monitoring routes

Monitor route performance and health.

### Route status

Check route status in the web interface:

1. Go to **Routes** page
2. View route status indicators
3. Check health check results
4. Monitor traffic metrics

### Log analysis

Monitor route logs for debugging:

\`\`\`bash
# View nginx access logs
docker logs nginx-proxy

# View specific service logs
docker logs your-service-name

# View GLINRDOCK proxy logs
docker logs glinrdockd
\`\`\`

## Troubleshooting routes

Common route issues and solutions.

### Route not responding

**Problem**: Route returns 404 or connection errors  
**Solutions**:
- Verify service is running and healthy
- Check service port configuration
- Confirm network connectivity
- Review nginx configuration

### SSL/TLS issues

**Problem**: HTTPS routes show certificate errors  
**Solutions**:
- Verify certificate is valid and matches domain
- Check certificate installation
- Confirm TLS configuration in route
- Review SSL certificate logs

### Load balancing issues

**Problem**: Uneven traffic distribution  
**Solutions**:
- Check service health status
- Review load balancing configuration
- Monitor service resource usage
- Verify sticky session configuration

### Performance issues

**Problem**: Slow response times  
**Solutions**:
- Monitor service metrics
- Check resource constraints
- Review caching configuration
- Optimize service performance

## Best practices

Follow these practices for reliable route management:

- **Use health checks** - Always configure health checks for services
- **Monitor metrics** - Set up monitoring and alerting
- **Test routes** - Verify routes work in staging before production
- **Document configuration** - Maintain clear documentation
- **Regular updates** - Keep services and configurations current`,
    updated_at: '2025-01-14T00:00:00Z'
  }
}

// Manual help page manifest entries - only for pages not in appdocs/
export const MANUAL_HELP_MANIFEST: HelpManifestEntry[] = [
  {
    slug: 'nginx-setup',
    title: 'Nginx Setup',
    section: 'Configuration',
    rel_path: 'manual/nginx-setup.md',
    tags: ['nginx', 'proxy', 'setup', 'docker'],
    version: '1.0.0',
    word_count: 450,
    updated_at: '2025-01-14T00:00:00Z',
    etag: 'nginx-setup-v1'
  },
  {
    slug: 'ssl-certificates', 
    title: 'SSL Certificates',
    section: 'Configuration',
    rel_path: 'manual/ssl-certificates.md',
    tags: ['ssl', 'tls', 'certificates', 'security', 'https'],
    version: '1.0.0',
    word_count: 520,
    updated_at: '2025-01-14T00:00:00Z',
    etag: 'ssl-certificates-v1'
  },
  {
    slug: 'route-management',
    title: 'Route Management', 
    section: 'Configuration',
    rel_path: 'manual/route-management.md',
    tags: ['routes', 'management', 'configuration', 'domains', 'paths'],
    version: '1.0.0',
    word_count: 890,
    updated_at: '2025-01-14T00:00:00Z',
    etag: 'route-management-v1'
  }
]