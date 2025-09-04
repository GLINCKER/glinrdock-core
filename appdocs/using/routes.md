---
title: Configuring Routes
section: Using
slug: using/routes
tags: routes, domains, https, networking, ssl
version: v1
audience: user
---

# Configuring Routes

Routes connect your services to the internet, making them accessible via custom domains with automatic HTTPS.

## What are Routes?

A route in GLINRDOCK:

- Maps a domain name to one of your services
- Handles incoming web traffic
- Automatically obtains and manages SSL certificates
- Provides load balancing and traffic routing

## Creating Your First Route

### Basic Route Setup

1. Go to **Routes** in the navigation
2. Click **Add Route**
3. Fill in the route information:
   - **Domain** - Your domain name (e.g., `myapp.com`)
   - **Service** - Select which service to route traffic to
   - **Port** - Service port to forward traffic to (usually 80 or 3000)

4. Click **Create Route**

Your route will be created and SSL certificates will be automatically requested.

### DNS Setup

Before your route works, you need to point your domain to your GLINRDOCK server:

1. Log into your domain registrar (GoDaddy, Namecheap, etc.)
2. Update DNS settings:
   - **A Record**: Point your domain to your server's IP address
   - **CNAME Record** (for subdomains): Point to your main domain

3. Wait for DNS propagation (can take up to 24 hours)

## Route Types

### Domain Routes

Route traffic for specific domains:
- `example.com` - Main domain
- `www.example.com` - WWW subdomain
- `api.example.com` - API subdomain

### Path-Based Routes

Route different paths to different services:
- `example.com/app` → Frontend service
- `example.com/api` → Backend service
- `example.com/admin` → Admin panel service

## HTTPS and SSL Certificates

### Automatic HTTPS

GLINRDOCK automatically:
- Obtains SSL certificates from Let's Encrypt
- Renews certificates before they expire
- Redirects HTTP traffic to HTTPS
- Uses modern security protocols

### Certificate Status

Monitor certificate status in the Routes dashboard:
- **Valid** - Certificate is active and current
- **Pending** - Certificate is being requested
- **Failed** - Certificate request failed
- **Expiring** - Certificate needs renewal soon

### Troubleshooting HTTPS

If certificates fail to generate:
1. Verify DNS points to your server
2. Ensure ports 80 and 443 are accessible from the internet
3. Check domain ownership
4. Wait and try again (rate limits may apply)

## Managing Routes

### Route Dashboard

The Routes page shows:
- **Domain** - The domain name
- **Service** - Target service
- **Status** - Route health and SSL status
- **Traffic** - Recent request volume
- **Actions** - Edit, disable, or delete routes

### Editing Routes

To modify an existing route:
1. Click the route name or **Edit** button
2. Update configuration:
   - Change target service
   - Modify port mapping
   - Update SSL settings
   - Add custom headers

3. Click **Save Changes**

### Route Health

Monitor route performance:
- **Response Time** - How quickly requests are handled
- **Success Rate** - Percentage of successful requests
- **Error Rate** - Failed requests and errors
- **Traffic Volume** - Requests per minute/hour

## Advanced Routing

### Custom Headers

Add HTTP headers to requests:
- **Security Headers** - HSTS, CSP, X-Frame-Options
- **CORS Headers** - Cross-origin resource sharing
- **Custom Headers** - Application-specific headers

### Traffic Rules

Configure advanced traffic handling:
- **Rate Limiting** - Limit requests per IP address
- **IP Filtering** - Allow or block specific IP ranges
- **Geographic Filtering** - Block traffic from specific countries

### Load Balancing

Distribute traffic across multiple service instances:
- **Round Robin** - Distribute requests evenly
- **Health Checks** - Route only to healthy instances
- **Failover** - Automatic fallback to backup services

## Multiple Domains

### Adding Additional Domains

Route multiple domains to the same service:
1. Create separate routes for each domain
2. Point all domains to the same service
3. Configure redirects if needed (e.g., www → non-www)

### Subdomain Management

Organize services with subdomains:
- `blog.example.com` → Blog service
- `shop.example.com` → E-commerce service
- `api.example.com` → API service

## Best Practices

### Domain Management

- Use descriptive subdomains for different services
- Set up both www and non-www versions
- Consider using a CDN for static content
- Monitor SSL certificate expiration dates

### Security

- Always use HTTPS in production
- Enable security headers
- Implement rate limiting for public services
- Use strong SSL ciphers and protocols

### Performance

- Choose servers geographically close to your users
- Enable compression when possible
- Monitor response times and error rates
- Use caching strategies for better performance

## Common Issues

### Route Not Working

Check these items:
1. **DNS Configuration** - Verify A/CNAME records point to your server
2. **Service Status** - Ensure target service is running
3. **Port Configuration** - Check service is listening on correct port
4. **Firewall** - Verify ports 80/443 are open

### SSL Certificate Issues

Common causes:
- **DNS Not Propagated** - Wait for DNS changes to take effect
- **Port 80 Blocked** - Let's Encrypt needs access to port 80
- **Rate Limits** - Too many certificate requests for same domain
- **Domain Validation Failed** - Domain doesn't point to your server

### Slow Response Times

Investigate:
- Service performance and resource usage
- Network connectivity between components
- Database query performance
- External API response times

For more help with routing issues, see our [troubleshooting guide](../guides/troubleshoot.md).