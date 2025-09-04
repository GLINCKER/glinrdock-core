---
title: Working with Templates
section: Using
slug: using/templates
tags: templates, deployment, quickstart, presets
version: v1
audience: user
---

# Working with Templates

Service templates provide pre-configured setups for common applications, making deployment faster and easier.

## What are Templates?

Templates are pre-built configurations that include:

- **Container specifications** - Pre-selected Docker images
- **Port configurations** - Standard port mappings
- **Environment variables** - Common configuration options
- **Resource settings** - Appropriate CPU and memory limits
- **Health checks** - Built-in monitoring configuration

## Using Templates

### Accessing Templates

1. Go to **Services** in the navigation
2. Click **Add Service**
3. Select **From Template**
4. Browse available template categories

### Deploying from Template

1. **Choose a template** - Browse by category or search
2. **Customize settings** - Modify configuration as needed
3. **Review configuration** - Check all settings before deployment
4. **Deploy** - Click deploy to create your service

## Template Categories

### Web Applications

**Node.js Applications**:
- Express.js web servers
- React/Vue.js frontends
- Next.js full-stack applications

**Python Applications**:
- Django web applications
- Flask APIs and microservices
- FastAPI backends

**PHP Applications**:
- WordPress websites
- Laravel applications
- Basic PHP web servers

### Databases

**SQL Databases**:
- PostgreSQL with optimized settings
- MySQL with standard configuration
- MariaDB for compatibility

**NoSQL Databases**:
- MongoDB document databases
- Redis for caching and sessions
- InfluxDB for time-series data

### Development Tools

**Version Control**:
- Gitea lightweight Git hosting
- GitLab CE for team collaboration

**CI/CD Tools**:
- Jenkins automation server
- GitHub Actions runners

**Monitoring**:
- Grafana dashboards
- Prometheus monitoring
- Uptime monitoring tools

### Content Management

**CMS Platforms**:
- WordPress with MySQL
- Ghost blogging platform
- Strapi headless CMS

**Static Site Generators**:
- Nginx for static sites
- Hugo site generator
- Jekyll blog platform

## Customizing Templates

### Common Customizations

**Application Settings**:
- Change service name and description
- Modify port mappings
- Update container image version
- Set custom environment variables

**Resource Allocation**:
- Adjust memory limits
- Set CPU constraints  
- Configure disk space requirements

**Networking**:
- Add custom domains
- Configure SSL settings
- Set up load balancer options

### Environment Variables

Templates include common environment variables:

**Database Templates**:
- Database name and credentials
- Connection pool settings
- Backup configuration options

**Web Application Templates**:
- Application URLs and ports
- API keys and secrets
- Feature flags and debug settings

**Monitoring Templates**:
- Data retention policies
- Alert notification settings
- Dashboard configuration

## Creating Custom Templates

### Template Structure

While you can't create templates through the UI, you can save service configurations as templates by:

1. **Deploy and configure** a service perfectly
2. **Export configuration** using the service settings
3. **Document the setup** for future reference
4. **Share configurations** with your team

### Best Practices for Template Use

**Before Deployment**:
- Read template descriptions carefully
- Understand resource requirements
- Check compatibility with your setup
- Plan your domain and routing strategy

**During Configuration**:
- Use meaningful service names
- Set appropriate resource limits
- Configure environment variables properly
- Enable health checks when available

**After Deployment**:
- Test service functionality
- Monitor resource usage
- Set up appropriate routing
- Configure backups if needed

## Popular Templates

### Spring Boot Template

Perfect for Java applications:
- Pre-configured JVM settings
- Standard Spring Boot ports
- Health check endpoints
- Production-ready logging

**Customization Options**:
- Java version selection
- Memory heap size
- Application profiles (dev, prod)
- Database connection settings

### WordPress Template

Complete WordPress setup:
- WordPress with MySQL database
- Pre-configured PHP settings
- File upload optimization
- Security hardening

**Customization Options**:
- WordPress version
- PHP memory limits
- Database credentials
- Plugin pre-installation

### PostgreSQL Template

Production-ready database:
- Optimized PostgreSQL settings
- Automated backup configuration
- Connection pooling setup
- Performance monitoring

**Customization Options**:
- Database version
- Memory allocation
- Connection limits
- Backup schedule

### Redis Template

High-performance caching:
- Memory-optimized Redis setup
- Persistence configuration
- Security settings
- Performance tuning

**Customization Options**:
- Memory limits
- Persistence options
- Security passwords
- Connection settings

## Template Management

### Template Updates

Templates are regularly updated with:
- Latest container image versions
- Security patches and improvements
- New configuration options
- Performance optimizations

### Version Control

When deploying templates:
- **Pin versions** for production deployments
- **Use latest** for development and testing
- **Document versions** used in different environments
- **Plan updates** carefully to avoid disruptions

## Troubleshooting Templates

### Template Won't Deploy

Common issues:
- **Resource constraints** - Not enough memory or CPU
- **Port conflicts** - Port already in use
- **Image issues** - Container image not available
- **Configuration errors** - Invalid environment variables

### Template Deployed But Not Working

Check these areas:
- **Service logs** - Look for application errors
- **Health checks** - Verify health check endpoints
- **Network configuration** - Check port and routing setup
- **Environment variables** - Verify all required variables are set

### Performance Issues

Optimize template performance:
- **Adjust resource limits** - Increase memory or CPU if needed
- **Check dependencies** - Ensure required services are available
- **Monitor metrics** - Use built-in monitoring to identify bottlenecks
- **Review configuration** - Optimize application-specific settings

## Advanced Template Usage

### Multi-Service Templates

Some templates deploy multiple related services:
- **LAMP Stack** - Linux, Apache, MySQL, PHP
- **Mean Stack** - MongoDB, Express, Angular, Node.js
- **WordPress + Redis** - WordPress with caching layer

### Environment-Specific Templates

Use different templates for different environments:
- **Development** - Debug-enabled, resource-light versions
- **Staging** - Production-like but with test data
- **Production** - Optimized, secure, monitored versions

### Template Dependencies

Some templates require other services:
- **Web apps** may need databases
- **Monitoring tools** may need data sources
- **Caches** may need backing stores

Plan your deployment order to satisfy dependencies.

For more information about deploying services, see our [services management guide](./services.md).