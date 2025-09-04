# GitHub OAuth Setup Guide

This guide walks you through setting up GitHub OAuth authentication for GLINR Dock, allowing users to sign in with their GitHub accounts.

## Overview

GLINR Dock supports optional GitHub OAuth authentication alongside traditional API token authentication. When configured, users can:

- Sign in with their GitHub account using OAuth
- Maintain existing API token authentication for programmatic access
- Have roles automatically assigned (first user becomes admin, subsequent users become viewers)
- See their GitHub profile information in settings

## Prerequisites

- A running GLINR Dock instance with an accessible external URL
- Administrative access to create a GitHub OAuth App
- Access to GLINR Dock's environment configuration

## Step 1: Create GitHub OAuth App

1. **Navigate to GitHub Developer Settings**
   - Go to [GitHub Developer Settings](https://github.com/settings/developers)
   - Click "OAuth Apps" in the left sidebar
   - Click "New OAuth App"

2. **Configure OAuth App Settings**
   - **Application name**: `GLINR Dock` (or your preferred name)
   - **Homepage URL**: Your GLINR Dock external URL (e.g., `https://dock.example.com`)
   - **Application description**: Optional description
   - **Authorization callback URL**: `https://your-domain.com/v1/auth/github/callback`
     
     ⚠️ **Important**: The callback URL must be exact: `https://your-domain.com/v1/auth/github/callback`

3. **Save Application**
   - Click "Register application"
   - Note down the **Client ID** (displayed immediately)
   - Click "Generate a new client secret"
   - Note down the **Client Secret** (⚠️ save this securely - it won't be shown again)

## Step 2: Configure Environment Variables

Add the following environment variables to your GLINR Dock configuration:

```bash
# GitHub OAuth Configuration
GITHUB_OAUTH_CLIENT_ID="your-client-id-here"
GITHUB_OAUTH_CLIENT_SECRET="your-client-secret-here"
EXTERNAL_BASE_URL="https://dock.example.com"

# HMAC Secret for CSRF protection and session signing
# Generate with: openssl rand -base64 32
GLINRDOCK_SECRET="your-base64-encoded-secret-here"
```

### Environment Variable Details

| Variable | Description | Required | Example |
|----------|-------------|----------|---------|
| `GITHUB_OAUTH_CLIENT_ID` | GitHub OAuth App Client ID | Yes | `1234567890abcdef` |
| `GITHUB_OAUTH_CLIENT_SECRET` | GitHub OAuth App Client Secret | Yes | `secret123...` |
| `EXTERNAL_BASE_URL` | Your GLINR Dock external URL | Yes | `https://dock.example.com` |
| `GLINRDOCK_SECRET` | Base64-encoded 32-byte secret for CSRF/sessions | Yes | `dGVzdC1zZWNyZXQ...` |

### Generating the GLINRDOCK_SECRET

```bash
# Generate a secure 32-byte secret
openssl rand -base64 32
```

## Step 3: Restart GLINR Dock

After configuring the environment variables, restart GLINR Dock:

```bash
# If running directly
./glinrdockd

# If using Docker
docker restart glinrdock

# If using systemd
sudo systemctl restart glinrdockd
```

## Step 4: Verify Configuration

1. **Check Logs**
   Look for this message in the startup logs:
   ```
   GitHub OAuth authentication enabled
   ```
   
   If you see this instead, check your configuration:
   ```
   GitHub OAuth not configured - using token authentication only
   ```

2. **Test Login Page**
   - Navigate to your GLINR Dock instance
   - Go to `/app/login`
   - You should see a "Sign in with GitHub" button above the token input

3. **Test OAuth Flow**
   - Click "Sign in with GitHub"
   - You should be redirected to GitHub for authorization
   - After approving, you should be redirected back and logged in

## Step 5: Role Management

### Automatic Role Assignment

- **First User**: Automatically becomes `admin`
- **Subsequent Users**: Automatically become `viewer`

### Manual Role Management

Admins can change user roles through the existing token management interface or by directly updating the database:

```sql
-- List all users
SELECT id, login, name, role FROM users;

-- Update a user's role
UPDATE users SET role = 'deployer' WHERE login = 'username';
```

Valid roles: `admin`, `deployer`, `viewer`

## Security Considerations

### CSRF Protection

- All OAuth requests are protected against CSRF attacks using HMAC-signed state tokens
- State tokens expire after 10 minutes
- State validation includes both signature and timestamp verification

### Session Security

- Session cookies are:
  - `HttpOnly`: Cannot be accessed via JavaScript
  - `Secure`: Only sent over HTTPS connections
  - `SameSite=Lax`: Basic CSRF protection
  - Short-lived: 24-hour expiration

### Secret Management

- Store `GITHUB_OAUTH_CLIENT_SECRET` and `GLINRDOCK_SECRET` securely
- Rotate secrets regularly
- Use environment variables, not configuration files
- Ensure secrets are not logged or exposed in error messages

## Troubleshooting

### Common Issues

1. **"GitHub OAuth not configured" message**
   - Verify all required environment variables are set
   - Check for typos in variable names
   - Ensure `EXTERNAL_BASE_URL` doesn't have trailing slash

2. **"Invalid redirect_uri" from GitHub**
   - Verify the callback URL in your GitHub OAuth App settings
   - Must be: `https://your-domain.com/v1/auth/github/callback`
   - Check for trailing slashes or typos

3. **"CSRF failed" during callback**
   - Check that `GLINRDOCK_SECRET` is properly set
   - Ensure cookies are being accepted by the browser
   - Verify system clock is accurate (affects token timestamps)

4. **Users redirected to login after GitHub auth**
   - Check that session cookies are being set
   - Verify `EXTERNAL_BASE_URL` matches the actual domain
   - Check browser console for cookie-related errors

### Debug Steps

1. **Check Configuration**
   ```bash
   # Verify environment variables are set
   env | grep -E "(GITHUB_OAUTH|EXTERNAL_BASE_URL|GLINRDOCK_SECRET)"
   ```

2. **Test OAuth App Settings**
   - Ensure GitHub OAuth App is configured correctly
   - Test callback URL manually: `https://your-domain.com/v1/auth/github/callback`

3. **Check Network Connectivity**
   ```bash
   # Test GitHub API access
   curl -H "Accept: application/json" https://api.github.com/user
   ```

4. **Review Logs**
   - Look for OAuth-related error messages
   - Check for network connectivity issues
   - Verify database migration success

## Migration from Token-Only Auth

OAuth authentication is additive - existing token authentication continues to work:

- **Existing API tokens**: Continue working unchanged
- **Existing workflows**: No disruption to CI/CD or API integrations
- **Mixed authentication**: Some users can use OAuth, others can use tokens
- **Role mapping**: OAuth users get roles separately from token-based auth

## API Reference

### New Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/v1/auth/github/login` | GET | Initiates GitHub OAuth flow |
| `/v1/auth/github/callback` | GET | Handles GitHub OAuth callback |
| `/v1/auth/oauth/logout` | POST | Logs out OAuth session |
| `/v1/auth/me` | GET | Returns current user info (supports both auth methods) |

### Response Examples

**GET /v1/auth/me** (OAuth user):
```json
{
  "authenticated": true,
  "user": {
    "id": 1,
    "login": "username",
    "name": "Display Name",
    "avatar_url": "https://avatars.githubusercontent.com/u/123456",
    "role": "admin"
  },
  "auth_method": "session"
}
```

**GET /v1/auth/me** (Token user):
```json
{
  "authenticated": true,
  "user": {
    "login": "api-token-name",
    "role": "deployer"
  },
  "auth_method": "token"
}
```

## Next Steps

After setting up GitHub OAuth:

1. **Test the complete flow** with a test GitHub account
2. **Configure role assignments** for your team
3. **Update your documentation** to include OAuth login instructions
4. **Consider disabling** less secure authentication methods if desired
5. **Set up monitoring** for OAuth-related errors and usage

For additional security hardening, see [SECURITY.md](./SECURITY.md).