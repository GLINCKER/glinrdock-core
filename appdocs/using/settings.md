# Settings Overview

The Settings system provides centralized configuration management for your GLINR Dock installation. Access Settings through the Configuration section of the main navigation or by using the search command palette (Cmd/Ctrl+K and searching for "settings").

## Settings Categories

### Authentication & Security
Manage user authentication methods, API tokens, and security settings.

**Key Features:**
- Configure GitHub OAuth for user authentication
- Create and manage API tokens for programmatic access
- View current session information and security details
- Control authentication methods and session management

**When to Use:**
- Setting up user login methods for your team
- Creating API tokens for CI/CD pipelines or automated tools
- Monitoring active sessions and authentication security
- Configuring OAuth integration with GitHub

### Plan & Licensing
Monitor your current subscription plan, resource limits, and license status.

**Key Features:**
- View current plan status and limits
- Monitor resource usage and quotas
- Activate and manage licenses
- Track subscription details

**When to Use:**
- Checking resource limits and usage
- Activating new licenses
- Understanding plan constraints
- Monitoring quota consumption

### System Administration
Administrative controls for system maintenance, emergency operations, and monitoring.

**Key Features:**
- Emergency system controls (lockdown, restart)
- System status monitoring and health checks
- Backup and restore operations
- Support bundle generation
- Advanced system configuration

**When to Use:**
- Performing system maintenance
- Creating backups before major changes
- Monitoring system health and performance
- Emergency system operations
- Generating support bundles for troubleshooting

### Integrations
Configure external service connections and platform integrations.

**Key Features:**
- GitHub App integration for repository automation
- DNS provider configuration
- Nginx proxy settings
- Webhook management for CI/CD

**When to Use:**
- Connecting repositories for automated deployments
- Setting up DNS automation
- Configuring reverse proxy settings
- Managing deployment webhooks

### Environment Templates
Create and manage reusable environment variable templates for deployments.

**Key Features:**
- Create variable templates for different environments
- Manage template configurations
- Apply templates to new deployments
- Version control for environment configurations

**When to Use:**
- Standardizing environment configurations across projects
- Creating reusable deployment templates
- Managing environment variables at scale
- Ensuring consistent configuration patterns

## Navigation

### Settings Hub
The main Settings page (`/settings`) provides a centralized hub with cards for each category. Each card shows:
- Current status and configuration state
- Quick access to configuration pages
- Visual indicators for active/inactive features
- Summary information for each category

### Individual Setting Pages
Each category has its own dedicated page:
- `/settings/auth` - Authentication & Security
- `/settings/plan-limits` - Plan & Licensing  
- `/settings/system-admin` - System Administration
- `/settings/integrations` - External Integrations
- `/settings/environment-templates` - Environment Templates
- `/settings/certificates` - DNS & Certificates

### Breadcrumb Navigation
All settings pages include breadcrumb navigation for easy navigation back to the main Settings hub or other sections of the application.

## Security Considerations

### Authentication Methods
GLINR Dock supports two primary authentication methods:

**OAuth Sessions (Recommended for Interactive Use)**
- Secure session-based authentication via GitHub OAuth
- Automatic session expiration for security
- Profile information integration
- Secure logout functionality

**API Tokens (For Programmatic Access)**
- Long-lived tokens for CI/CD and automation
- Role-based access control (Admin, Deployer, Viewer)
- Token management with creation and deletion
- Secure token storage and handling

### Role-Based Access Control

**Admin Role**
- Full access to all settings and system administration
- Can create and delete API tokens
- Emergency system controls access
- License and plan management

**Deployer Role**
- Access to deployment-related settings
- Limited system administration features
- Can manage own API tokens
- Integration configuration access

**Viewer Role**
- Read-only access to most settings
- Cannot modify critical system configurations
- Can view status information
- Limited token management

## Best Practices

### Authentication Setup
1. **Configure OAuth First**: Set up GitHub OAuth for team members before relying on API tokens
2. **Use Strong Secrets**: Ensure OAuth client secrets are securely generated and stored
3. **Regular Token Rotation**: Periodically rotate API tokens for security
4. **Role Assignment**: Assign appropriate roles based on team member responsibilities

### System Administration
1. **Regular Backups**: Create system backups before major configuration changes
2. **Monitor Resources**: Keep track of resource usage and plan limits
3. **Test Integrations**: Verify external integrations are working correctly
4. **Documentation**: Document custom configurations and changes

### Integration Management
1. **Separate Concerns**: Use different integration types for their intended purposes
   - OAuth for user authentication
   - GitHub App for repository automation
2. **Webhook Security**: Secure webhook endpoints with proper secrets
3. **DNS Automation**: Configure DNS providers for automated certificate management

## Troubleshooting

### Common Issues

**OAuth Login Problems**
- Verify OAuth client ID and secret are correct
- Check redirect URL matches GitHub OAuth App configuration
- Ensure OAuth is enabled in Authentication settings

**API Token Access Issues**
- Confirm token has appropriate role permissions
- Verify token hasn't expired or been deleted
- Check token is included in API requests correctly

**Integration Failures**
- Verify webhook secrets match between services
- Check network connectivity to external services
- Confirm API credentials are valid and haven't expired

**System Performance Issues**
- Monitor resource usage in Plan & Limits
- Check system status in System Administration
- Generate support bundle for detailed diagnostics

### Getting Help

1. **System Status**: Check System Administration for health indicators
2. **Support Bundle**: Generate support bundle for technical issues
3. **Logs**: Review audit logs for authentication and access issues
4. **Documentation**: Refer to specific category help documents for detailed guidance

## Related Topics

- [Authentication Settings](settings-authentication) - Detailed authentication configuration
- [System Administration](settings-system-admin) - System maintenance and monitoring
- [GitHub Integration Setup](integrations/github-oauth) - OAuth configuration guide
- [API Token Management](guides/api-tokens) - Token creation and usage
- [Security Best Practices](security/best-practices) - Comprehensive security guidance

## Quick Start Checklist

### Initial Setup
- [ ] Configure GitHub OAuth for team authentication
- [ ] Create initial API tokens for automation
- [ ] Set up system backup schedule
- [ ] Configure DNS providers for certificate automation
- [ ] Test all authentication methods

### Regular Maintenance  
- [ ] Monitor resource usage and plan limits
- [ ] Review and rotate API tokens
- [ ] Update integration configurations as needed
- [ ] Create backups before major changes
- [ ] Monitor system health and performance

### Security Review
- [ ] Audit active API tokens and sessions
- [ ] Review OAuth configuration security
- [ ] Check integration webhook security
- [ ] Verify role assignments are appropriate
- [ ] Test emergency system controls access