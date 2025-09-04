---
title: Managing Services
section: Using
slug: using/services
tags: services, containers, deployment, management
version: v1
audience: user
---

# Managing Services

Services are the core of GLINRDOCK - they represent your deployed applications running in containers.

## What is a Service?

A service in GLINRDOCK is a containerized application that includes:

- A container image (your application code)
- Port configuration for network access
- Environment variables for configuration
- Resource limits and scaling settings
- Health check configuration

## Creating a New Service

### Using the Quick Start Wizard

1. Navigate to **Services** in the dashboard
2. Click **Add Service** or **Quick Start**
3. Choose from available options:
   - **From Template** - Use pre-configured service templates
   - **From Container Image** - Deploy any Docker image
   - **From GitHub** - Connect a GitHub repository

### Manual Service Configuration

For custom deployments:

1. Click **Add Service** > **Custom Configuration**
2. Fill in the basic information:
   - **Service Name** - Unique identifier for your service
   - **Container Image** - Docker image (e.g., `nginx:latest`)
   - **Port** - Internal port your application listens on

3. Configure optional settings:
   - **Environment Variables** - Configuration values
   - **Resource Limits** - CPU and memory constraints
   - **Health Check** - Endpoint to verify service health

4. Click **Deploy** to start your service

## Managing Existing Services

### Service Dashboard

The Services page shows all your deployed applications with:

- **Status** - Running, stopped, or error state
- **Resource Usage** - CPU, memory, and network activity
- **Uptime** - How long the service has been running
- **Quick Actions** - Start, stop, restart, or delete

### Service Details

Click any service name to view detailed information:

- **Logs** - Real-time application logs
- **Configuration** - Current service settings
- **Metrics** - Performance graphs and statistics
- **Events** - Recent service activity

### Common Service Actions

**Start/Stop a Service**:
- Click the service name
- Use the **Start** or **Stop** button in the service details

**Restart a Service**:
- Go to service details
- Click **Restart** to stop and start the service

**Update Service Configuration**:
- Click **Edit** in the service details
- Modify settings as needed
- Click **Save** to apply changes

**View Logs**:
- Go to service details
- Click the **Logs** tab
- Use filters to find specific log entries

## Environment Variables

Configure your application using environment variables:

### Adding Environment Variables

1. Edit your service configuration
2. Go to the **Environment** section
3. Click **Add Variable**
4. Enter the variable name and value
5. Save your changes

### Common Use Cases

- **Database URLs** - Connection strings for databases
- **API Keys** - Third-party service credentials  
- **Feature Flags** - Enable/disable application features
- **Configuration Values** - Application-specific settings

### Security Note

Sensitive values like passwords and API keys are automatically encrypted and masked in the interface.

## Scaling and Resources

### Resource Limits

Set CPU and memory limits to:
- Prevent services from consuming all server resources
- Ensure predictable performance
- Enable better resource planning

### Scaling Options

- **Manual Scaling** - Adjust resource allocations as needed
- **Health Checks** - Automatically restart failed services
- **Load Balancing** - Distribute traffic across service instances (enterprise feature)

## Service Templates

Use pre-configured templates for common applications:

### Available Templates

- **Web Applications** - Node.js, Python Flask, Ruby on Rails
- **Databases** - PostgreSQL, MySQL, Redis
- **Monitoring** - Grafana, Prometheus
- **Reverse Proxies** - Nginx, Traefik

### Using Templates

1. Click **Add Service** > **From Template**
2. Browse available templates
3. Select your desired template
4. Customize configuration values
5. Deploy with one click

## Best Practices

### Naming Services

- Use descriptive names (e.g., "blog-frontend", "api-server")
- Include environment if running multiple (e.g., "api-prod", "api-staging")
- Avoid spaces and special characters

### Configuration Management

- Use environment variables for configuration
- Keep sensitive data separate from your code
- Document your service configurations
- Use templates for consistent deployments

### Monitoring Services

- Enable health checks for critical services
- Monitor resource usage regularly
- Set up alerts for service failures
- Review logs regularly for issues

## Troubleshooting Services

### Service Won't Start

Common issues:
- Invalid container image name
- Port already in use
- Insufficient resources
- Missing required environment variables

### Service Keeps Restarting

Check for:
- Application errors in logs
- Resource limit exceeded
- Failed health checks
- Configuration problems

### Cannot Access Service

Verify:
- Service is running
- Port configuration is correct
- Route is properly configured
- Firewall allows traffic

For more troubleshooting help, see our [troubleshooting guide](../guides/troubleshoot.md).