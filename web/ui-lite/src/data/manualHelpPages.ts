import { HelpDocument, HelpManifestEntry } from '../api'

// Manual help page content that integrates with the help system
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
  
  'guides/install': {
    slug: 'guides/install',
    markdown: `# Installation Guide

This guide covers the basic installation of GLINRDOCK for end users.

## System Requirements

Before installing GLINRDOCK, ensure your system meets the following requirements:

### Operating System
- Linux (Ubuntu 20.04+ recommended)
- macOS (Intel or Apple Silicon)  
- Windows 10/11 with WSL2

### Memory
- 2GB RAM minimum
- 4GB RAM recommended

### Storage
- 20GB available space minimum

### Network
- Internet connection for downloading containers and certificates

## Quick Installation

The easiest way to install GLINRDOCK is using our installation script.

### Using the Install Script

Download and run the installation script:

\`\`\`bash
curl -fsSL https://get.glinrdock.com/install.sh | bash
\`\`\`

This script will automatically:
- Detect your operating system
- Install required dependencies
- Download the latest GLINRDOCK binary
- Set up system services
- Create initial configuration

### Verification

After installation, verify GLINRDOCK is working:

\`\`\`bash
# Check service status
sudo systemctl status glinrdock

# Test API endpoint
curl http://localhost:8080/v1/health
\`\`\`

## Manual Installation

For advanced users who prefer manual installation.

### Download Binary

Download the latest binary for your platform:

\`\`\`bash
# Linux x64
wget https://github.com/glincker/glinrdock/releases/latest/download/glinrdock-linux-amd64.tar.gz

# macOS Intel
wget https://github.com/glincker/glinrdock/releases/latest/download/glinrdock-darwin-amd64.tar.gz

# macOS Apple Silicon  
wget https://github.com/glincker/glinrdock/releases/latest/download/glinrdock-darwin-arm64.tar.gz
\`\`\`

### Extract and Install

\`\`\`bash
# Extract the archive
tar -xzf glinrdock-*.tar.gz

# Move to system location
sudo mv glinrdock /usr/local/bin/

# Make executable
sudo chmod +x /usr/local/bin/glinrdock
\`\`\`

## Initial Configuration

After installation, configure GLINRDOCK for first use.

### Set Admin Token

Set an initial admin token for authentication:

\`\`\`bash
export ADMIN_TOKEN="your-secure-admin-token"
\`\`\`

### Start GLINRDOCK

Start the GLINRDOCK daemon:

\`\`\`bash
# If installed as service
sudo systemctl start glinrdock

# If running manually
glinrdock
\`\`\`

### Access Web Interface

Open your browser and navigate to:

- **Local**: http://localhost:8080
- **Network**: http://your-server-ip:8080

Log in with your admin token to complete the setup.

## Docker Requirements

GLINRDOCK requires Docker to manage containers.

### Install Docker

#### On Ubuntu/Debian:

\`\`\`bash
# Update package index
sudo apt update

# Install Docker
sudo apt install docker.io

# Start and enable Docker
sudo systemctl start docker
sudo systemctl enable docker

# Add user to docker group
sudo usermod -aG docker $USER
\`\`\`

#### On macOS:

1. Download Docker Desktop from docker.com
2. Install and start Docker Desktop
3. Verify installation: \`docker --version\`

### Verify Docker Installation

Test Docker installation:

\`\`\`bash
docker run hello-world
\`\`\`

## Next Steps

After successful installation:

1. **Configure SSL** - Set up SSL certificates for HTTPS
2. **Add Services** - Deploy your first applications  
3. **Configure Routes** - Set up domain routing
4. **Set up Monitoring** - Configure metrics and alerts

## Troubleshooting

Common installation issues and solutions:

### Permission Issues
- Ensure Docker is installed and accessible
- Add user to docker group: \`sudo usermod -aG docker $USER\`
- Restart session after adding to group

### Port Conflicts
- Default port is 8080, change with \`--port\` flag
- Check for conflicting services: \`sudo netstat -tulpn | grep 8080\`

### Service Won't Start
- Check system requirements
- Verify Docker is running
- Review logs for error messages
- Ensure admin token is set

For additional help, visit the troubleshooting guide or contact support.`,
    updated_at: '2025-01-14T00:00:00Z'
  },
  
  'guides/getting-started': {
    slug: 'guides/getting-started',
    markdown: `# Getting Started Guide

Welcome to GLINRDOCK! This guide will help you get up and running quickly with container management and deployment.

## What is GLINRDOCK?

GLINRDOCK is a comprehensive container platform that simplifies Docker container management, service deployment, and infrastructure orchestration. It provides an intuitive web interface for managing your containerized applications.

### Key Features

- **Container Management** - Deploy and manage Docker containers with ease
- **Service Discovery** - Automatic service registration and discovery
- **Reverse Proxy** - Built-in Nginx proxy for routing traffic
- **SSL/TLS Management** - Automated certificate management with Let's Encrypt
- **Project Organization** - Group related services into projects
- **Real-time Monitoring** - Monitor container health and performance

## Quick Start

Follow these steps to deploy your first application:

### Step 1: Create a Project

Projects help organize related services together:

1. Navigate to **Projects** in the sidebar
2. Click **Create Project**
3. Enter a project name (e.g., "my-web-app")
4. Choose a Git branch or leave as "main"
5. Click **Create**

### Step 2: Deploy a Service

Deploy your first container service:

1. Open your newly created project
2. Click **Add Service**
3. Configure your service:
   - **Name**: Choose a descriptive name
   - **Image**: Docker image (e.g., "nginx:latest")
   - **Port**: Internal container port (e.g., 80)
   - **Environment Variables**: Add any required env vars
4. Click **Deploy**

### Step 3: Create a Route

Expose your service to the internet:

1. Go to **Routes** in the sidebar
2. Click **Add Route**
3. Configure the route:
   - **Domain**: Your domain name (e.g., "myapp.example.com")
   - **Service**: Select your deployed service
   - **Port**: Port to route traffic to
   - **TLS**: Enable HTTPS if you have SSL configured
4. Click **Create Route**

### Step 4: Verify Deployment

Check that everything is working:

1. Visit your domain in a browser
2. Check service status in the **Services** page
3. Monitor logs if needed

## Core Concepts

Understanding these concepts will help you use GLINRDOCK effectively:

### Projects
Projects are containers for related services. They provide:
- **Isolation** - Services in different projects are isolated
- **Organization** - Group related services together
- **Networking** - Automatic container networking within projects

### Services
Services are containerized applications that:
- **Run Docker images** - Deploy any Docker container
- **Scale automatically** - Handle traffic spikes
- **Communicate** - Connect to other services in the same project

### Routes
Routes expose your services to the internet:
- **Domain-based** - Route traffic based on hostname
- **Path-based** - Route traffic based on URL paths
- **SSL/TLS** - Automatically handle HTTPS certificates

### Environment Variables
Configure your applications with environment variables:
- **Secrets** - Securely store sensitive data
- **Configuration** - Pass runtime configuration
- **Templates** - Reuse common configurations

## Common Workflows

### Deploying a Web Application

1. **Prepare your application** - Ensure it's containerized
2. **Create a project** - Organize your services
3. **Deploy application service** - Your main application
4. **Deploy database** (if needed) - PostgreSQL, MySQL, etc.
5. **Configure environment** - Set database URLs, API keys
6. **Create routes** - Expose your application to users

### Setting up a Database

1. **Deploy database service** - Choose your database image
2. **Configure persistent storage** - Ensure data persists
3. **Set environment variables** - Database credentials
4. **Create internal route** (optional) - For service-to-service communication
5. **Configure backups** - Protect your data

### Managing SSL Certificates

1. **Configure Let's Encrypt** - Automatic certificate management
2. **Add domains** - Register domains for certificates
3. **Enable TLS on routes** - Secure your traffic
4. **Monitor expiration** - Automatic renewal

## Next Steps

Now that you're familiar with the basics:

1. **Explore Templates** - Use pre-built service configurations
2. **Set up Monitoring** - Monitor your applications
3. **Configure Integrations** - Connect GitHub, registries
4. **Learn Advanced Features** - Load balancing, scaling
5. **Read Documentation** - Dive deeper into specific features

## Getting Help

If you need assistance:

- **Documentation** - Browse the help sections
- **FAQ** - Check frequently asked questions
- **Troubleshooting** - Solve common issues
- **Community** - Join our community forums
- **Support** - Contact our support team

Welcome to GLINRDOCK! Happy deploying! 🚀`,
    updated_at: '2025-01-14T00:00:00Z'
  },
  
  'faq': {
    slug: 'faq',
    markdown: `# Frequently Asked Questions

Find answers to common questions about GLINRDOCK.

## General Questions

### What is GLINRDOCK?

GLINRDOCK is a container platform that simplifies Docker container management, deployment, and orchestration through an intuitive web interface.

### Is GLINRDOCK free to use?

GLINRDOCK offers both free and paid plans. The free plan includes basic container management for small deployments.

### What operating systems does GLINRDOCK support?

GLINRDOCK supports:
- Linux (Ubuntu 20.04+ recommended)
- macOS (Intel and Apple Silicon)
- Windows 10/11 with WSL2

### Can I use GLINRDOCK with existing Docker containers?

Yes! GLINRDOCK can manage existing Docker containers and integrate with your current Docker setup.

## Installation and Setup

### How do I install GLINRDOCK?

The easiest way is using our installation script:

\`\`\`bash
curl -fsSL https://get.glinrdock.com/install.sh | bash
\`\`\`

For manual installation, see the [Installation Guide](/app/help/guides/install).

### What are the system requirements?

- **Memory**: 2GB RAM minimum, 4GB recommended
- **Storage**: 20GB available space minimum
- **Network**: Internet connection for downloads
- **Docker**: Docker 20.10+ required

### How do I configure SSL certificates?

GLINRDOCK supports automatic Let's Encrypt certificates. See the [SSL Certificates guide](/app/help/ssl-certificates) for setup instructions.

### Can I use custom domains?

Yes! You can configure custom domains through the Routes section. Ensure your DNS points to your GLINRDOCK server.

## Container Management

### How do I deploy a new service?

1. Create or select a project
2. Click "Add Service"
3. Configure your Docker image and settings
4. Click "Deploy"

### Can I use private Docker registries?

Yes! Configure your registry credentials in **Settings → Registries** and use private images in your services.

### How do I scale services?

Service scaling can be configured in the service settings. Adjust the replica count based on your needs.

### What happens if a container crashes?

GLINRDOCK automatically restarts crashed containers and provides crash loop detection to prevent infinite restart cycles.

## Networking and Routes

### How do I expose services to the internet?

Create routes in the **Routes** section to expose services externally. Configure domains and SSL as needed.

### Can services communicate with each other?

Yes! Services within the same project can communicate using service names as hostnames.

### How does load balancing work?

GLINRDOCK includes built-in load balancing across service replicas with health checks and failover.

### Can I use path-based routing?

Yes! Configure path-based routes to serve different applications on the same domain using URL paths.

## Projects and Organization

### What are projects used for?

Projects group related services together, providing isolation and organization for your applications.

### Can services in different projects communicate?

By default, no. Projects provide network isolation. Cross-project communication requires explicit configuration.

### How many projects can I create?

The number of projects depends on your plan. Free plans have limitations, while paid plans offer unlimited projects.

### Can I delete projects?

Yes, but deleting a project will also delete all services and data within that project. This action cannot be undone.

## Monitoring and Logs

### How do I view service logs?

Click on any service to view real-time logs and historical log data.

### What monitoring metrics are available?

GLINRDOCK provides CPU, memory, network, and disk usage metrics for all services.

### Can I set up alerts?

Yes! Configure alerts for service failures, resource usage, and other events in the monitoring section.

### How long are logs retained?

Log retention depends on your plan and configuration. Logs are typically retained for 30 days on free plans.

## Security

### Is GLINRDOCK secure?

GLINRDOCK follows security best practices including:
- Encrypted communication (HTTPS)
- Secure container isolation
- Regular security updates
- Access control and authentication

### How do I manage user access?

Configure user roles and permissions in **Settings → Users**. Create different access levels for team members.

### Can I use single sign-on (SSO)?

SSO is available on paid plans through integrations with popular identity providers.

### How are secrets managed?

Secrets are encrypted at rest and in transit. Use environment variables with secret management for sensitive data.

## Troubleshooting

### My service won't start. What should I do?

1. Check service logs for error messages
2. Verify Docker image exists and is accessible
3. Check resource limits and availability
4. Review environment variable configuration

### Routes are not working. How do I fix this?

1. Verify DNS records point to your server
2. Check nginx proxy configuration
3. Ensure services are running and healthy
4. Verify SSL certificate status

### How do I backup my data?

Configure automated backups in **Settings → Backups**. Back up both service data and GLINRDOCK configuration.

### Performance is slow. How can I optimize?

1. Monitor resource usage in the dashboard
2. Adjust service resource limits
3. Scale services horizontally
4. Check network connectivity
5. Optimize Docker images

## Billing and Plans

### How does billing work?

Billing is based on resource usage and features enabled. See our pricing page for current rates.

### Can I upgrade or downgrade my plan?

Yes! Change your plan anytime in **Settings → Billing**. Changes take effect immediately.

### What happens if I exceed plan limits?

Services may be throttled or stopped if you exceed plan limits. Upgrade your plan to avoid interruptions.

### Do you offer student discounts?

Yes! Students can apply for educational discounts through our support team.

## Support

### How do I get help?

- Browse this FAQ and documentation
- Join our community forums
- Contact support through the help widget
- Email support for urgent issues

### What support is included?

Free plans include community support. Paid plans include email support with guaranteed response times.

### Can I schedule a demo?

Yes! Contact our sales team to schedule a personalized demo of GLINRDOCK features.

### How do I report bugs?

Report bugs through:
- GitHub issues (for open source components)
- Support tickets (for priority support)
- Community forums (for general issues)

Still have questions? Contact our support team or browse the detailed documentation.`,
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

// Manual help page manifest entries
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
    slug: 'guides/install',
    title: 'Installation Guide', 
    section: 'Guides',
    rel_path: 'manual/install.md',
    tags: ['install', 'installation', 'setup', 'getting-started', 'docker'],
    version: '1.0.0',
    word_count: 650,
    updated_at: '2025-01-14T00:00:00Z',
    etag: 'install-v1'
  },
  {
    slug: 'guides/getting-started',
    title: 'Getting Started Guide',
    section: 'Guides',
    rel_path: 'manual/getting-started.md',
    tags: ['getting-started', 'quickstart', 'tutorial', 'guide', 'basics'],
    version: '1.0.0',
    word_count: 850,
    updated_at: '2025-01-14T00:00:00Z',
    etag: 'getting-started-v1'
  },
  {
    slug: 'faq',
    title: 'Frequently Asked Questions',
    section: 'Support',
    rel_path: 'manual/faq.md',
    tags: ['faq', 'questions', 'answers', 'help', 'support'],
    version: '1.0.0',
    word_count: 1200,
    updated_at: '2025-01-14T00:00:00Z',
    etag: 'faq-v1'
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