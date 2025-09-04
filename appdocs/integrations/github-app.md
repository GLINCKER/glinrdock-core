---
title: GitHub App Integration
section: Integrations
slug: integrations/github-app
tags: github, integration, automation, deployment, git
version: v1
audience: user
---

# GitHub App Integration

Connect GLINRDOCK to your GitHub repositories for automated deployments and seamless development workflows.

## What is GitHub Integration?

GitHub integration allows you to:

- **Auto-deploy** from GitHub repositories
- **Sync configurations** with your codebase
- **Trigger deployments** on code pushes
- **Manage secrets** and environment variables
- **Monitor deployments** and track changes

## Setting Up GitHub Integration

### Prerequisites

Before setting up GitHub integration:
- Have admin access to your GitHub repository
- Ensure GLINRDOCK is accessible from the internet
- Have your GLINRDOCK external URL configured correctly

### Installation Steps

1. **Access Integration Settings**:
   - Go to **Settings** in GLINRDOCK
   - Click **Integrations**
   - Select **GitHub App**

2. **Install GitHub App**:
   - Click **Install GitHub App**
   - You'll be redirected to GitHub
   - Select repositories to grant access to
   - Click **Install**

3. **Configure Integration**:
   - Return to GLINRDOCK
   - Verify the integration is connected
   - Configure deployment settings

## Repository Setup

### Supported Repository Types

GLINRDOCK works with:
- **Public repositories** - Open source projects
- **Private repositories** - With proper permissions
- **Organization repositories** - Team and company repos
- **Fork repositories** - Personal forks of projects

### Project Structure

For optimal integration, organize your repository:

```
your-repo/
├── Dockerfile          # Container build instructions
├── docker-compose.yml  # Multi-service setup (optional)
├── .glinrdock/         # GLINRDOCK-specific configuration
│   ├── config.yml      # Service configuration
│   └── secrets.yml     # Environment variables template
└── src/                # Your application code
```

### Configuration File

Create `.glinrdock/config.yml` in your repository:

```yaml
services:
  web:
    name: "my-web-app"
    port: 3000
    healthcheck: "/health"
    env:
      - NODE_ENV=production
      - PORT=3000
    
  database:
    name: "my-database"
    template: "postgresql"
    env:
      - POSTGRES_DB=myapp
```

## Automated Deployments

### Deployment Triggers

Automatic deployments trigger on:
- **Push to main branch** - Deploy production updates
- **Pull request merge** - Update after code review
- **Tag creation** - Release-based deployments
- **Manual trigger** - On-demand deployments

### Deployment Process

When a deployment triggers:
1. **Code checkout** - GLINRDOCK pulls latest code
2. **Build container** - Creates container image from Dockerfile
3. **Update service** - Deploys new version to running service
4. **Health check** - Verifies deployment success
5. **Rollback** - Automatic rollback on failure

### Branch Management

Configure different branches for different environments:
- **main/master** - Production deployments
- **develop** - Staging environment
- **feature branches** - Development deployments

## Managing Deployments

### Deployment Dashboard

View deployment status and history:
- **Current deployments** - Active deployment status
- **Deployment history** - Previous deployments and their status
- **Rollback options** - Quick rollback to previous versions
- **Build logs** - Detailed deployment information

### Deployment Status

Track deployment progress:
- **Queued** - Waiting for deployment slot
- **Building** - Creating container image
- **Deploying** - Updating running service
- **Success** - Deployment completed successfully
- **Failed** - Deployment encountered errors

### Manual Deployments

Trigger deployments manually:
1. Go to **Services** and select your GitHub-connected service
2. Click **Deploy** or **Redeploy**
3. Select branch or commit to deploy
4. Monitor deployment progress

## Environment Variables and Secrets

### Repository Secrets

Store sensitive configuration in GitHub:
1. Go to your GitHub repository
2. Click **Settings** > **Secrets and variables** > **Actions**
3. Add secrets like database passwords, API keys
4. Reference in your `.glinrdock/config.yml`

### Environment Configuration

Manage environment-specific settings:
- **Development** - Debug enabled, local databases
- **Staging** - Production-like but with test data
- **Production** - Optimized, secure, monitored

### Secret Management

Best practices for secrets:
- **Never commit secrets** to your repository
- **Use GitHub secrets** for sensitive values
- **Rotate secrets regularly** for security
- **Limit secret access** to necessary services only

## Monitoring and Troubleshooting

### Build Logs

Access detailed deployment information:
- **Build output** - Container creation logs
- **Deployment logs** - Service update information
- **Error messages** - Specific failure reasons
- **Performance metrics** - Build and deployment times

### Common Issues

**Deployment Fails**:
- Check Dockerfile syntax and instructions
- Verify all required dependencies are available
- Review environment variable configuration
- Check service port settings

**Build Takes Too Long**:
- Optimize Dockerfile for layer caching
- Use smaller base images when possible
- Minimize installed packages
- Consider multi-stage builds

**Service Won't Start**:
- Review application logs for errors
- Verify health check endpoint works
- Check environment variable values
- Confirm port configuration matches application

### Webhooks and Notifications

Configure deployment notifications:
- **Slack integration** - Deployment status in team channels
- **Email notifications** - Success/failure alerts
- **Custom webhooks** - Integration with external tools
- **GitHub status checks** - Deployment status in pull requests

## Advanced Features

### Multi-Service Deployments

Deploy complex applications:
- **Microservices** - Multiple related services
- **Database migrations** - Automated schema updates
- **Background workers** - Queue processors and schedulers
- **Load balancers** - Traffic distribution across instances

### Rollback Strategies

Handle deployment issues:
- **Automatic rollback** - On health check failure
- **Manual rollback** - User-initiated rollback to previous version
- **Blue-green deployment** - Zero-downtime deployments
- **Canary releases** - Gradual rollout to subset of traffic

### Custom Build Scripts

Extend build process with custom scripts:
- **Pre-build hooks** - Run tests, linting, security scans
- **Post-build hooks** - Database migrations, cache warming
- **Custom build steps** - Complex build processes
- **Artifact management** - Store and manage build outputs

## Security Best Practices

### Repository Security

Protect your repositories:
- **Enable branch protection** - Require reviews for main branch
- **Use signed commits** - Verify commit authenticity
- **Scan for vulnerabilities** - Regular security audits
- **Limit repository access** - Minimum necessary permissions

### Deployment Security

Secure your deployment process:
- **Use private registries** - Store container images securely
- **Scan container images** - Check for vulnerabilities
- **Network segmentation** - Isolate services appropriately
- **Audit deployment logs** - Monitor for suspicious activity

### Access Control

Manage integration permissions:
- **Limit GitHub app permissions** - Only necessary access
- **Rotate access tokens** - Regular token rotation
- **Monitor integration usage** - Track API calls and access
- **Revoke unused access** - Clean up old integrations

## Getting Help

### Documentation Resources

For more detailed setup information:
- [GitHub OAuth Setup Guide](../../docs/guides/SETUP_GITHUB_OAUTH.md) - Technical setup details
- [API Documentation](../../docs/reference/API.md) - Integration API reference
- [Security Documentation](../../docs/reference/SECURITY.md) - Security best practices

### Community Support

If you need help:
- [GLINRDOCK Community](https://github.com/GLINCKER/glinrdock-release) - Community discussions
- [Issue Tracker](https://github.com/GLINCKER/glinrdock-release/issues) - Bug reports and feature requests
- [Documentation](../README.md) - Complete help documentation

For troubleshooting deployment issues, see our [troubleshooting guide](../guides/troubleshoot.md).