# GitHub Integrations

This document explains the GitHub integration capabilities in GLINR Dock, including OAuth login and GitHub App repository access.

## Overview

GLINR Dock supports two types of GitHub integrations:

1. **GitHub OAuth Login** - Allows users to authenticate using their GitHub account
2. **GitHub App Integration** - Enables repository access, webhooks, and CI/CD features

Both integrations store sensitive credentials using AES-GCM encryption at rest.

## OAuth Login Modes

### Off Mode
- **Description**: No GitHub OAuth integration
- **Configuration**: Mode set to `"off"`
- **Usage**: Users can only authenticate with API tokens

### PKCE Mode (Public Client)
- **Description**: OAuth with Proof Key for Code Exchange, suitable for SPAs and mobile apps
- **Configuration**: 
  - Mode: `"pkce"`
  - Client ID: Required (GitHub OAuth App Client ID)
  - Client Secret: Not required (handled by PKCE flow)
- **Security**: Uses code challenge/verifier instead of client secret
- **Usage**: Recommended for frontend-only applications

### Confidential Mode (Private Client)
- **Description**: Traditional OAuth with client secret
- **Configuration**:
  - Mode: `"confidential"`
  - Client ID: Required (GitHub OAuth App Client ID) 
  - Client Secret: Required (GitHub OAuth App Client Secret)
- **Security**: Client secret encrypted using AES-GCM with master key
- **Usage**: Recommended for server-side applications with secure storage

## GitHub App Integration

### Configuration
- **App ID**: Numeric GitHub App ID (required)
- **Private Key**: RSA private key in PEM format (required)
  - Supports both PKCS#1 (`-----BEGIN RSA PRIVATE KEY-----`) and PKCS#8 (`-----BEGIN PRIVATE KEY-----`) formats
  - Must be a valid RSA private key for JWT signing

### Features Enabled
- Repository access and file operations
- Webhook delivery for push events, deployments, etc.
- CI/CD pipeline triggers
- Installation management across organizations

## Storage and Encryption

### Database Schema
Settings are stored in the `settings` table with the following structure:
```sql
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value BLOB NOT NULL,
    is_secret BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Encryption at Rest
- **Algorithm**: AES-GCM with 256-bit keys
- **Key Source**: `GLINRDOCK_SECRET` environment variable (base64 encoded 32-byte key)
- **Nonce**: 12-byte random nonce per encryption operation
- **Storage Format**: `[nonce][ciphertext]` concatenated in database

#### Encrypted Fields
- GitHub OAuth client secret (`github.oauth.client_secret`)
- GitHub App private key (`github.app.private_key`)

#### Plaintext Fields  
- OAuth configuration (mode, client_id)
- App configuration (app_id)

## Key Rotation Flows

### OAuth Client Secret Rotation
1. Update OAuth configuration with new client secret
2. Previous secret is automatically overwritten with new encrypted value
3. Active sessions may need re-authentication depending on GitHub's token lifecycle

### GitHub App Private Key Rotation
1. Generate new private key in GitHub App settings
2. Update App configuration with new private key PEM
3. Previous key is automatically overwritten with new encrypted value
4. New JWT tokens will be signed with the new key immediately

### Master Key Rotation
1. Export current settings to secure location
2. Update `GLINRDOCK_SECRET` environment variable
3. Decrypt settings with old key, re-encrypt with new key
4. Restart application to use new master key

**Note**: Master key rotation requires manual intervention and service restart.

## API Endpoints

### GET /v1/settings/integrations
- **Auth**: All authenticated users (admin, deployer, viewer)
- **Purpose**: Retrieve current integration configuration
- **Response**: Configuration with secrets masked (never returned)
- **Audit**: Read access sampled at 1:10 ratio

### PUT /v1/settings/integrations  
- **Auth**: Admin only
- **Purpose**: Update integration configuration
- **Validation**: Comprehensive validation of all fields
- **Audit**: All updates logged with configuration summary
- **Response**: Updated configuration with secrets masked

### GET /v1/settings/github/install-url
- **Auth**: Admin only  
- **Purpose**: Generate GitHub App installation URL
- **Response**: Installation URL and App ID for GitHub App setup

## Setup Wizard

The setup wizard provides a guided configuration experience for first-time setup:

1. **OAuth Configuration Step**
   - Mode selection (off/pkce/confidential)
   - Client ID input
   - Client secret input (if confidential mode)
   
2. **GitHub App Configuration Step**  
   - App ID input with validation
   - Private key upload or paste
   - PEM format validation

3. **Verification Step**
   - Configuration summary
   - Installation URL generation (if App configured)

## Security Considerations

### Access Control
- **Read Access**: All authenticated users can view masked configuration
- **Write Access**: Only admin users can modify integration settings
- **Secret Access**: Secrets never returned in API responses

### Input Validation
- OAuth modes restricted to `["off", "pkce", "confidential"]`
- Client IDs and App IDs validated for required fields
- App IDs validated as numeric values
- Private keys validated as proper RSA PEM format

### Audit Logging
- All configuration reads sampled at 1:10 ratio to reduce log volume
- All configuration updates logged with full metadata
- Actor identification from authentication context
- Timestamp and target resource tracking

### Error Handling
- Validation errors return detailed field-specific messages
- Encryption/decryption errors logged but not exposed to users
- Database errors handled gracefully with generic error messages
- File upload errors provide user-friendly feedback

## Integration Examples

### Setting up OAuth PKCE Mode
```bash
curl -X PUT /v1/settings/integrations \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "github_oauth": {
      "mode": "pkce",
      "client_id": "Iv1.1234567890abcdef"
    }
  }'
```

### Setting up GitHub App Integration
```bash
curl -X PUT /v1/settings/integrations \
  -H "Authorization: Bearer admin-token" \
  -H "Content-Type: application/json" \
  -d '{
    "github_app": {
      "app_id": "123456",
      "private_key_pem": "-----BEGIN RSA PRIVATE KEY-----\nMIIE...content...\n-----END RSA PRIVATE KEY-----"
    }
  }'
```

### Getting Installation URL
```bash
curl /v1/settings/github/install-url \
  -H "Authorization: Bearer admin-token"
```

## Troubleshooting

### Common Issues
1. **Invalid private key format**: Ensure PEM headers/footers are correct
2. **Numeric App ID validation**: App ID must be numeric, not app slug
3. **Missing client secret**: Confidential mode requires client secret
4. **Encryption failures**: Check `GLINRDOCK_SECRET` is properly set

### Diagnostics
- Check application logs for encryption/decryption errors
- Verify `GLINRDOCK_SECRET` environment variable is set
- Validate PEM format using `openssl rsa -in key.pem -check`
- Test GitHub App credentials with GitHub's API

### Recovery
- If encryption key is lost, settings must be reconfigured manually
- Database corruption requires restoration from backup
- GitHub App/OAuth credentials can be regenerated in GitHub settings