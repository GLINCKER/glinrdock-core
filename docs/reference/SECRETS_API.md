# Encrypted Secrets-at-Rest API Documentation

GLINRDOCK now supports encrypted environment variables that are stored securely at rest using AES-GCM encryption. This feature provides end-to-end encryption for sensitive configuration data.

## Overview

The encrypted secrets feature provides:
- **AES-GCM encryption** with 256-bit keys for maximum security
- **Role-based access control** with different visibility levels for different user roles
- **Transparent encryption/decryption** - secrets are encrypted when stored and decrypted when accessed by authorized users
- **Mixed storage** - both plain text and encrypted variables in the same service
- **Bulk operations** for efficient management of multiple environment variables

## Configuration

### Setting Up Encryption Key

Before using encrypted environment variables, you must configure a master encryption key:

```bash
# Generate a 32-byte base64-encoded key
export GLINRDOCK_SECRET=$(openssl rand -base64 32)

# Or set it directly
export GLINRDOCK_SECRET="AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8="
```

⚠️ **CRITICAL**: Store this key securely! If lost, encrypted environment variables cannot be recovered.

### Key Requirements

- Must be exactly 32 bytes when base64-decoded
- Should be cryptographically random
- Must be set before starting GLINRDOCK
- Should be stored in a secure secrets management system in production

## Role-Based Access Control

Different user roles have different access levels to environment variables:

| Role | Plain Variables | Secret Variables |
|------|-----------------|------------------|
| **Viewer** | ✅ Full access | 🔒 Masked (`******`) |
| **Deployer** | ✅ Full access | ✅ Decrypted values |
| **Admin** | ✅ Full access | ✅ Decrypted values |

## API Endpoints

### Base URL
All environment variable endpoints are under `/v1/services/{service_id}/`

### Authentication
All endpoints require authentication via `Authorization: Bearer <token>` header.

---

### GET `/v1/services/{service_id}/env-vars`

Retrieve all environment variables for a service.

**Permissions**: All authenticated users (with role-based masking)

**Response**:
```json
{
  "env_vars": [
    {
      "key": "PLAIN_VAR",
      "value": "visible_value",
      "is_secret": false,
      "created_at": "2024-01-01T10:00:00Z",
      "updated_at": "2024-01-01T10:00:00Z"
    },
    {
      "key": "SECRET_VAR",
      "value": "******",  // Masked for viewers
      "is_secret": true,
      "created_at": "2024-01-01T10:00:00Z",
      "updated_at": "2024-01-01T10:00:00Z"
    }
  ]
}
```

**Example**:
```bash
curl -H "Authorization: Bearer $TOKEN" \
     "http://localhost:5173/v1/services/1/env-vars"
```

---

### PUT `/v1/services/{service_id}/env-vars`

Create or update a single environment variable.

**Permissions**: Deployer, Admin

**Request Body**:
```json
{
  "key": "API_KEY",
  "value": "secret_api_key_123",
  "is_secret": true
}
```

**Fields**:
- `key` (string, required): Variable name (must be valid environment variable name)
- `value` (string, required): Variable value
- `is_secret` (boolean): Whether to encrypt the value

**Response**:
```json
{
  "message": "environment variable set successfully"
}
```

**Example**:
```bash
curl -X PUT \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"key":"DB_PASSWORD","value":"super_secret","is_secret":true}' \
     "http://localhost:5173/v1/services/1/env-vars"
```

---

### POST `/v1/services/{service_id}/env-vars/bulk`

Set multiple environment variables in a single request.

**Permissions**: Deployer, Admin

**Request Body**:
```json
{
  "env_vars": [
    {
      "key": "API_URL",
      "value": "https://api.example.com",
      "is_secret": false
    },
    {
      "key": "API_KEY",
      "value": "secret_key_456",
      "is_secret": true
    },
    {
      "key": "DB_URL",
      "value": "postgresql://user:pass@db:5432/app",
      "is_secret": true
    }
  ]
}
```

**Response**:
```json
{
  "message": "environment variables updated successfully"
}
```

**Example**:
```bash
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d @bulk_env_vars.json \
     "http://localhost:5173/v1/services/1/env-vars/bulk"
```

---

### DELETE `/v1/services/{service_id}/env-vars/{key}`

Delete a specific environment variable.

**Permissions**: Deployer, Admin

**Response**:
```json
{
  "message": "environment variable deleted successfully"
}
```

**Example**:
```bash
curl -X DELETE \
     -H "Authorization: Bearer $TOKEN" \
     "http://localhost:5173/v1/services/1/env-vars/OLD_API_KEY"
```

## Security Considerations

### Encryption Details

- **Algorithm**: AES-GCM (Galois/Counter Mode)
- **Key Size**: 256 bits (32 bytes)
- **Nonce Size**: 96 bits (12 bytes)
- **Authentication**: Built-in AEAD (Authenticated Encryption with Associated Data)

### Security Features

1. **Authenticated Encryption**: AES-GCM provides both confidentiality and authenticity
2. **Unique Nonces**: Each encryption uses a cryptographically random nonce
3. **No Key Derivation**: Direct use of master key (ensure key is high-entropy)
4. **Role-Based Masking**: Secrets are masked for unauthorized users
5. **Audit Logging**: All operations are logged for security monitoring

### Best Practices

1. **Key Management**:
   - Generate keys with `openssl rand -base64 32`
   - Store master key in a secure secrets management system
   - Rotate keys regularly
   - Never commit keys to version control

2. **Access Control**:
   - Use principle of least privilege
   - Assign appropriate roles to users
   - Regularly audit user access

3. **Monitoring**:
   - Monitor access to environment variables
   - Set up alerts for sensitive operations
   - Review audit logs regularly

## Error Handling

### Common Error Responses

**Missing Secret Key** (500):
```json
{
  "error": "encryption not available"
}
```

**Invalid Service ID** (404):
```json
{
  "error": "service not found"
}
```

**Insufficient Permissions** (403):
```json
{
  "error": "insufficient permissions"
}
```

**Invalid Request** (400):
```json
{
  "error": "environment variable key cannot be empty"
}
```

### Troubleshooting

1. **"encryption not available"**: Ensure `GLINRDOCK_SECRET` is set correctly
2. **"invalid base64"**: Verify the secret key is properly base64 encoded
3. **"invalid key size"**: Ensure the decoded key is exactly 32 bytes
4. **"service not found"**: Verify the service ID exists and is accessible

## Migration Guide

### From Plain Environment Variables

If you have existing plain text environment variables that need to be encrypted:

1. Retrieve current variables:
   ```bash
   curl -H "Authorization: Bearer $TOKEN" \
        "http://localhost:5173/v1/services/1/env-vars"
   ```

2. Update sensitive variables with `is_secret: true`:
   ```bash
   curl -X PUT \
        -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"key":"EXISTING_SECRET","value":"current_value","is_secret":true}' \
        "http://localhost:5173/v1/services/1/env-vars"
   ```

### Backup and Recovery

1. **Before Migration**: Backup your database
2. **Key Backup**: Securely store the master encryption key
3. **Test Recovery**: Verify you can decrypt secrets with the backup key

## Examples

### Complete Workflow Example

```bash
#!/bin/bash

# Set up environment
export GLINRDOCK_SECRET=$(openssl rand -base64 32)
export TOKEN="your-admin-token"
export SERVICE_ID="1"

# Set plain text configuration
curl -X PUT \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"key":"APP_ENV","value":"production","is_secret":false}' \
     "http://localhost:5173/v1/services/$SERVICE_ID/env-vars"

# Set encrypted secrets
curl -X PUT \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"key":"DB_PASSWORD","value":"super_secret_db_pass","is_secret":true}' \
     "http://localhost:5173/v1/services/$SERVICE_ID/env-vars"

# Bulk set mixed variables
curl -X POST \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "env_vars": [
         {"key":"REDIS_URL","value":"redis://cache:6379","is_secret":false},
         {"key":"JWT_SECRET","value":"jwt-signing-key-123","is_secret":true},
         {"key":"API_TOKEN","value":"api-token-xyz-789","is_secret":true}
       ]
     }' \
     "http://localhost:5173/v1/services/$SERVICE_ID/env-vars/bulk"

# Retrieve all variables (secrets will be visible for admin/deployer)
curl -H "Authorization: Bearer $TOKEN" \
     "http://localhost:5173/v1/services/$SERVICE_ID/env-vars"

# Clean up sensitive variable
curl -X DELETE \
     -H "Authorization: Bearer $TOKEN" \
     "http://localhost:5173/v1/services/$SERVICE_ID/env-vars/OLD_TOKEN"
```

## Changelog

### Version 1.0.0
- Initial implementation of encrypted secrets-at-rest
- AES-GCM encryption with 256-bit keys
- Role-based access control for environment variables
- CRUD operations for environment variables
- Bulk operations support
- Migration from plain text environment variables