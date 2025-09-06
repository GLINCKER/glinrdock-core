# Domain API Testing Guide

This document provides curl commands to test the domain lifecycle API endpoints.

## Prerequisites

1. Start the server with admin token:
```bash
ADMIN_TOKEN=test-token GLINRDOCK_SECRET=$(openssl rand -base64 32) ./bin/glinrdockd
```

2. Set environment variables for testing:
```bash
export ADMIN_TOKEN="test-token"
export API_BASE="http://localhost:8080"
```

## Test Scenarios

### 1. Create Domain (Happy Path)

```bash
# Create a new domain
curl -X POST "$API_BASE/v1/domains" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"name": "example.com"}' \
  | jq '.'
```

**Expected Response:**
```json
{
  "id": 1,
  "name": "example.com",
  "status": "pending",
  "provider": "cloudflare",
  "zone_id": "zone123",
  "verification_token": "abc123...",
  "created_at": "2025-01-01T10:00:00Z",
  "updated_at": "2025-01-01T10:00:00Z",
  "next_action": "configure_dns",
  "instructions": {
    "txt_record": {
      "type": "TXT",
      "name": "_glinr-verify.example.com",
      "value": "abc123...",
      "purpose": "Domain verification"
    },
    "cname_record": {
      "type": "CNAME",
      "name": "example.com",
      "value": "glinr.example.com",
      "purpose": "Route traffic to GLINR"
    },
    "message": "Create both TXT and CNAME records, then use auto-configure or verify."
  },
  "provider_hints": {
    "type": "cloudflare",
    "auto_configure": true,
    "dashboard_url": "https://dash.cloudflare.com"
  }
}
```

### 2. Auto-Configure Domain (Cloudflare)

```bash
# Auto-configure DNS records (requires CF_API_TOKEN)
curl -X POST "$API_BASE/v1/domains/1/auto-configure" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.'
```

**Expected Response:**
```json
{
  "id": 1,
  "name": "example.com",
  "status": "verifying",
  "next_action": "verify_dns",
  "provider_hints": {
    "type": "cloudflare",
    "auto_configure": true
  }
}
```

### 3. Verify Domain

```bash
# Check for TXT record and verify domain
curl -X POST "$API_BASE/v1/domains/1/verify" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.'
```

**Expected Response (if verified):**
```json
{
  "id": 1,
  "name": "example.com",
  "status": "verified",
  "next_action": "activate",
  "last_checked": "2025-01-01T10:05:00Z"
}
```

### 4. Activate Domain

```bash
# Trigger certificate issuance
curl -X POST "$API_BASE/v1/domains/1/activate" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.'
```

**Expected Response:**
```json
{
  "id": 1,
  "name": "example.com",
  "status": "active",
  "next_action": "manage",
  "certificate_id": 1
}
```

### 5. Get Domain Details

```bash
# Get single domain
curl "$API_BASE/v1/domains/1" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.'
```

### 6. List Domains

```bash
# List all domains
curl "$API_BASE/v1/domains" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.'

# List domains by status
curl "$API_BASE/v1/domains?status=pending,verifying" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.'
```

**Expected Response:**
```json
{
  "domains": [
    {
      "id": 1,
      "name": "example.com",
      "status": "active",
      "next_action": "manage"
    }
  ],
  "count": 1
}
```

## Error Cases

### 1. Invalid Request Body

```bash
# Missing required field
curl -X POST "$API_BASE/v1/domains" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{}' \
  | jq '.'
```

**Expected Response:**
```json
{
  "error": "invalid request: Key: 'CreateDomainRequest.Name' Error:Tag: 'required'"
}
```

### 2. Unauthorized Access

```bash
# Missing auth token
curl -X POST "$API_BASE/v1/domains" \
  -H "Content-Type: application/json" \
  -d '{"name": "test.com"}' \
  | jq '.'
```

**Expected Response:**
```json
{
  "error": "Unauthorized"
}
```

### 3. Domain Not Found

```bash
# Non-existent domain ID
curl "$API_BASE/v1/domains/999" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.'
```

**Expected Response:**
```json
{
  "error": "domain not found"
}
```

### 4. Invalid Status Transition

```bash
# Try to activate unverified domain
curl -X POST "$API_BASE/v1/domains/1/activate" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.'
```

**Expected Response (if domain is not verified):**
```json
{
  "error": "domain must be verified before activation"
}
```

### 5. Auto-Configure Not Available

```bash
# Try to auto-configure non-Cloudflare domain
curl -X POST "$API_BASE/v1/domains/1/auto-configure" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  | jq '.'
```

**Expected Response:**
```json
{
  "error": "auto-configuration only available for Cloudflare domains"
}
```

## Domain Lifecycle States

1. **pending** → DNS records need to be created
   - Next action: `configure_dns`
   - Instructions provided for manual setup
   - Auto-configure available if Cloudflare + credentials

2. **verifying** → DNS records created, waiting for verification
   - Next action: `verify_dns`
   - Can retry verification multiple times

3. **verified** → Domain verified, ready for certificate
   - Next action: `activate`
   - Can proceed to certificate issuance

4. **active** → Certificate issued and active
   - Next action: `manage`
   - Domain fully operational

5. **error** → Something went wrong
   - Next action: `retry`
   - Check logs for error details

## Authentication Requirements

- **Admin only**: POST /v1/domains, POST /v1/domains/:id/auto-configure, POST /v1/domains/:id/verify, POST /v1/domains/:id/activate
- **Authenticated users**: GET /v1/domains, GET /v1/domains/:id