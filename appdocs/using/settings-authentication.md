# Authentication Settings

The Authentication Settings page provides comprehensive management of user authentication, API tokens, and session security. Access this page from the Settings hub or navigate directly to `/settings/auth`.

## Overview

Authentication in GLINR Dock supports two primary methods:
- **GitHub OAuth**: Secure, session-based authentication for interactive users
- **API Tokens**: Long-lived credentials for programmatic access and automation

## GitHub OAuth Configuration

OAuth provides secure, session-based authentication using your GitHub account, ideal for team members who need interactive access to GLINR Dock.

### Setting Up GitHub OAuth

#### Prerequisites
- GitHub account with appropriate permissions
- Access to GitHub OAuth Apps settings
- Admin role in GLINR Dock

#### Step-by-Step Setup

**1. Create GitHub OAuth App**
1. Go to GitHub Settings > Developer settings > OAuth Apps
2. Click "New OAuth App"
3. Fill in application details:
   - **Application name**: "GLINR Dock" (or your preferred name)
   - **Homepage URL**: Your GLINR Dock instance URL
   - **Authorization callback URL**: `https://your-domain.com/auth/github/callback`

**2. Configure OAuth in GLINR Dock**
1. Navigate to Settings > Authentication
2. Locate the "GitHub OAuth Integration" section
3. Click "Configure" to expand the configuration form
4. Fill in the OAuth configuration:
   - **OAuth Status**: Set to "Enabled"
   - **Client ID**: Copy from your GitHub OAuth App
   - **Client Secret**: Copy from your GitHub OAuth App
   - **Redirect URL**: Must match the callback URL in GitHub

**3. Save and Test**
1. Click "Save OAuth Config"
2. Test the configuration by logging out and attempting OAuth login
3. Verify users can authenticate successfully

### OAuth Configuration Fields

**OAuth Status**
- **Disabled**: OAuth authentication is not available
- **Enabled**: OAuth authentication is active and available to users

**Client ID**
- Public identifier for your GitHub OAuth App
- Safe to share and visible in client-side code
- Must match exactly with GitHub OAuth App configuration

**Client Secret** 
- Private key for your GitHub OAuth App
- Never share or expose in client-side code
- Stored securely and not displayed after saving

**Redirect URL**
- URL GitHub redirects to after successful authentication
- Must be registered in your GitHub OAuth App
- Format: `https://your-domain.com/auth/github/callback`

### OAuth Security Features

**Session Management**
- Automatic session expiration for security
- Secure session cookies with proper flags
- Session invalidation on logout

**PKCE Support**
- Proof Key for Code Exchange for enhanced security
- Protection against authorization code interception
- Automatic implementation in GLINR Dock

**State Verification**
- CSRF protection through state parameter
- Prevents cross-site request forgery attacks
- Automatic validation during OAuth flow

## API Token Management

API tokens provide programmatic access to GLINR Dock, ideal for automation, CI/CD pipelines, and integrations.

### Creating API Tokens

**1. Access Token Creation**
1. Navigate to Settings > Authentication
2. Click "Create Token" in the header or from the empty state
3. Fill in the token creation form

**2. Token Configuration**
- **Token Name**: Descriptive identifier (e.g., "ci-deployer", "monitoring-bot")
- **Token Value**: The actual credential string (store securely)
- **Role**: Permission level for the token

**3. Save and Secure**
1. Click "Create Token" to generate
2. Copy the token value immediately (not displayed again)
3. Store in secure credential management system

### Token Roles and Permissions

**Admin Role**
- Full system access and control
- Can manage all resources and settings
- Emergency system controls
- User and token management
- Recommended for: System administrators, DevOps leads

**Deployer Role**
- Application deployment and management
- Service creation and updates
- Route configuration
- Integration management
- Recommended for: CI/CD systems, deployment automation

**Viewer Role**
- Read-only access to most resources
- Cannot modify system configuration
- Cannot create or delete resources
- Can view status and monitoring information
- Recommended for: Monitoring systems, read-only integrations

### Token Management

**Viewing Active Tokens**
- All active tokens are listed with metadata:
  - Token name and role
  - Creation timestamp
  - Last used timestamp
  - Expiration date (if applicable)

**Token Security Information**
- Creation date for audit purposes
- Last activity tracking
- Role-based permission indicators
- Expiration status monitoring

**Deleting Tokens**
1. Click the delete button (trash icon) next to the token
2. Confirm deletion in the prompt
3. Token is immediately revoked and cannot be used

### Token Best Practices

**Naming Conventions**
- Use descriptive names that indicate purpose
- Include environment or system identifier
- Examples: "prod-ci-deployer", "staging-monitor", "backup-service"

**Role Assignment**
- Use least privilege principle
- Assign minimum role needed for intended function
- Regular review of token permissions

**Rotation Strategy**
- Rotate tokens regularly (quarterly or semi-annually)
- Update credentials in all systems using the token
- Delete old tokens after successful rotation

**Secure Storage**
- Store tokens in dedicated credential management systems
- Never commit tokens to version control
- Use environment variables in deployment systems
- Enable audit logging for token usage

## Session Management

### Current Session Information

The Authentication page displays comprehensive information about your current session:

**Authentication Method**
- Visual indicator showing OAuth or API Token authentication
- Method-specific security information and warnings

**User Information** (OAuth Sessions)
- GitHub username and profile information
- User avatar from GitHub profile
- Full name if available in GitHub profile

**Role and Permissions**
- Current role assignment with visual indicator
- Color-coded role badges for quick identification
- Permission implications for current role

**Security Context**
- Session type and security features
- Expiration and timeout information
- Security recommendations based on authentication method

### Session Security Features

**OAuth Session Security**
- Secure HTTP-only cookies
- Automatic expiration for idle sessions
- CSRF protection with state validation
- Secure logout functionality

**API Token Security**
- Stateless authentication
- No session storage required
- Token-based request validation
- Audit trail for token usage

### Sign-Out Process

**OAuth Users**
1. Click "Sign Out" button in session information
2. Confirm sign-out action
3. Session cookie is cleared
4. Redirect to login page

**API Token Users**
- No sign-out process (stateless)
- Remove token from client application
- Delete token from GLINR Dock if no longer needed

## Security Considerations

### OAuth Security

**Redirect URL Security**
- Must use HTTPS in production
- Exact match required with GitHub configuration
- No wildcards or multiple URLs supported

**Client Secret Protection**
- Store securely on server side only
- Never expose in client-side code
- Rotate periodically for enhanced security

**Session Security**
- Sessions automatically expire for security
- Use secure, HTTP-only cookies
- CSRF protection through state parameter

### API Token Security

**Token Storage**
- Use dedicated credential management systems
- Environment variables for deployment systems
- Never store in version control or logs

**Network Security**
- Always use HTTPS for API requests
- Include tokens in Authorization header
- Monitor for token usage anomalies

**Access Control**
- Regular audit of active tokens
- Prompt removal of unused tokens
- Role-based access principle enforcement

### Common Security Issues

**OAuth Misconfiguration**
- Incorrect redirect URLs
- Exposed client secrets
- Missing HTTPS enforcement

**Token Management Issues**
- Tokens in version control
- Overprivileged tokens
- Stale tokens not removed

**Session Hijacking Prevention**
- Secure cookie configuration
- HTTPS enforcement
- Regular session invalidation

## Troubleshooting

### OAuth Issues

**Login Failures**
1. Verify OAuth is enabled in settings
2. Check client ID and secret accuracy
3. Confirm redirect URL matches GitHub configuration
4. Test network connectivity to GitHub

**Redirect Errors**
1. Ensure redirect URL uses HTTPS
2. Verify exact URL match in GitHub OAuth App
3. Check for trailing slashes or path differences

**Permission Errors**
1. Verify GitHub account has necessary permissions
2. Check if organization requires OAuth approval
3. Confirm user is member of required organizations

### API Token Issues

**Authentication Failures**
1. Verify token is active and not deleted
2. Check token role has necessary permissions
3. Confirm correct Authorization header format
4. Validate token hasn't expired

**Permission Errors**
1. Review token role assignments
2. Check resource-specific permissions
3. Verify admin actions require admin role

**Token Management Issues**
1. Ensure secure token storage
2. Check token rotation procedures
3. Verify audit trail for token usage

### General Authentication Issues

**Access Denied Errors**
1. Check current user role and permissions
2. Verify authentication method is appropriate
3. Confirm resource access requirements

**Session Timeout Issues**
1. Check session expiration settings
2. Verify user activity patterns
3. Consider token-based auth for long-running processes

## Integration Examples

### CI/CD Pipeline Integration

```bash
# Using API token in GitHub Actions
- name: Deploy to GLINR Dock
  env:
    GLINR_TOKEN: ${{ secrets.GLINR_DEPLOYER_TOKEN }}
  run: |
    curl -H "Authorization: Bearer $GLINR_TOKEN" \\
         -H "Content-Type: application/json" \\
         -d '{"image": "myapp:latest"}' \\
         https://glinrdock.example.com/api/v1/services/deploy
```

### Monitoring Integration

```python
import requests

# Read-only monitoring token
headers = {
    'Authorization': f'Bearer {GLINR_VIEWER_TOKEN}',
    'Content-Type': 'application/json'
}

# Get system status
response = requests.get(
    'https://glinrdock.example.com/api/v1/system/status',
    headers=headers
)

if response.status_code == 200:
    status = response.json()
    # Process system status
```

### Webhook Authentication

```javascript
// Webhook endpoint with API token validation
app.post('/webhook', (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!isValidGlinrToken(token)) {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  // Process webhook payload
});
```

## Related Topics

- [Settings Overview](settings) - Main settings documentation
- [System Administration](settings-system-admin) - System management features
- [GitHub Integration Setup](integrations/github-oauth) - Detailed OAuth setup
- [API Reference](../reference/api) - Complete API documentation
- [Security Best Practices](../security/best-practices) - Comprehensive security guide