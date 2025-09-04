# GLINR Dock Plans & Pricing

GLINR Dock offers three subscription tiers to meet different needs, from individual development to enterprise deployment.

## Plan Comparison

| Feature | Free | Pro | Premium |
|---------|------|-----|---------|
| **API Tokens** | 3 tokens | 10 tokens | Unlimited |
| **Client Connections** | 2 active | 10 active | Unlimited |
| **Admin Users** | 1 | 10 | Unlimited |
| **Projects/Services** | ✅ Unlimited | ✅ Unlimited | ✅ Unlimited |
| **Container Routes** | ✅ Unlimited | ✅ Unlimited | ✅ Unlimited |
| **Basic Metrics** | ✅ | ✅ | ✅ |
| **System Logs** | ✅ | ✅ | ✅ |
| **Emergency Controls** | ✅ Lockdown/Restart | ✅ Lockdown/Restart | ✅ Lockdown/Restart |
| **SMTP Email Alerts** | ❌ | ✅ | ✅ |
| **CI Integrations Dashboard** | ❌ | ✅ | ✅ |
| **Multi-Node Support** | ❌ | ✅ | ✅ |
| **Priority Updates** | ❌ | ✅ | ✅ |
| **SSO/SAML** | ❌ | ❌ | ✅ |
| **Audit Logs** | ❌ | ❌ | ✅ |
| **Multi-Environment** | ❌ | ❌ | ✅ |
| **Advanced Dashboards** | ❌ | ❌ | ✅ |

## Plan Details

### Free Plan
**Perfect for individual developers and small projects**

- **Token Limit**: 3 API tokens total
- **Client Connections**: Up to 2 active tracked clients
- **Users**: 1 admin user only
- **Core Features**: Full access to projects, services, routes, logs, basic metrics
- **Security**: Complete lockdown mode and emergency restart capabilities
- **Ideal for**: Personal projects, development, learning Docker orchestration

### Pro Plan
**Designed for growing teams and production deployments**

- **Token Limit**: 10 API tokens
- **Client Connections**: Up to 10 active tracked clients  
- **Users**: Up to 10 admin/user accounts
- **Enhanced Features**: 
  - SMTP email alerts for service failures
  - CI integrations dashboard with GitHub webhooks
  - Multi-node container orchestration
  - Priority support and updates
- **All Free features** included
- **Ideal for**: Small to medium teams, production environments, CI/CD workflows

### Premium Plan
**Enterprise-grade features for large organizations**

- **Token Limit**: Unlimited API tokens
- **Client Connections**: Unlimited active tracked clients
- **Users**: Unlimited admin/user accounts
- **Enterprise Features**:
  - Single Sign-On (SSO) and SAML integration
  - Comprehensive audit logging and compliance
  - Multi-environment management (dev/staging/prod)
  - Advanced metrics dashboards and analytics
  - Custom integrations and webhooks
- **All Pro features** included
- **Ideal for**: Large teams, enterprise deployments, regulated industries

## Configuration

### Setting Your Plan

Configure your plan using the `GLINRDOCK_PLAN` environment variable:

```bash
# Free plan (default)
export GLINRDOCK_PLAN=FREE

# Pro plan
export GLINRDOCK_PLAN=PRO

# Premium plan  
export GLINRDOCK_PLAN=PREMIUM
```

### Custom Limits

You can customize plan limits using environment variables:

```bash
# Free plan token limits
export FREE_MAX_TOKENS=3
export FREE_MAX_CLIENTS=2

# Pro plan token limits
export PRO_MAX_TOKENS=10
export PRO_MAX_CLIENTS=10
```

### Restart Required

Plan changes require a server restart to take effect:

```bash
# After changing GLINRDOCK_PLAN
systemctl restart glinrdock
# or
docker restart glinrdock
```

## Upgrading

### From Free to Pro
```bash
export GLINRDOCK_PLAN=PRO
systemctl restart glinrdock
```

### From Pro to Premium
```bash
export GLINRDOCK_PLAN=PREMIUM
systemctl restart glinrdock
```

### Downgrading
When downgrading plans, existing resources exceeding the new limits will continue to work but no new resources can be created until usage falls below the limit.

**Example**: Downgrading from Pro (10 tokens) to Free (3 tokens) with 5 existing tokens:
- All 5 existing tokens continue to work
- No new tokens can be created until 2 tokens are deleted
- UI will show "5/3 tokens (over limit)" with upgrade prompts

## API Integration

### Check Current Plan
```bash
GET /api/v1/system/plan
```

**Response**:
```json
{
  "plan": "FREE",
  "limits": {
    "max_tokens": 3,
    "max_clients": 2,
    "max_users": 1
  },
  "usage": {
    "tokens": 2,
    "clients": 1,
    "users": 1
  },
  "features": {
    "projects": true,
    "services": true,
    "routes": true,
    "logs": true,
    "basic_metrics": true,
    "lockdown": true,
    "emergency_restart": true,
    "smtp_alerts": false,
    "ci_integrations": false,
    "multi_env": false,
    "sso": false,
    "audit_logs": false,
    "advanced_dashboards": false
  }
}
```

### Quota Exceeded Responses
When API calls exceed plan limits, you'll receive a `403 Forbidden` response:

```json
{
  "error": "quota_exceeded",
  "type": "token",
  "message": "Token quota exceeded for current plan",
  "current": 3,
  "limit": 3,
  "plan": "FREE",
  "upgrade_hint": "Set GLINRDOCK_PLAN=PRO to increase limits"
}
```

## Security & Compliance

### Plan Enforcement
- Plan limits are enforced server-side and cannot be bypassed from the UI
- All quota checks happen at the API level before resource creation
- Existing resources remain functional even when over-limit after downgrades

### Feature Flags
Features are controlled by plan-based feature flags:
- Core features (projects, services, routes) available in all plans
- Advanced features require Pro or Premium plans
- Feature availability is checked on every API request

### Audit Trail
Premium plans include comprehensive audit logging:
- All API calls with user identification
- Plan changes and limit modifications
- Security events and authentication failures
- Compliance reporting for SOC2/GDPR requirements

## Troubleshooting

### Common Issues

**"Token quota exceeded" errors**:
- Check current usage: `GET /api/v1/system/plan`
- Upgrade plan or delete unused tokens
- Verify environment variables are set correctly

**"Feature not available" errors**:
- Ensure your plan includes the required feature
- Check feature availability in `/api/v1/system/plan` response
- Upgrade to appropriate plan for advanced features

**Plan changes not taking effect**:
- Restart the GLINR Dock service after changing environment variables
- Verify `GLINRDOCK_PLAN` environment variable is set correctly
- Check system logs for configuration errors

### Support

- **Free Plan**: Community support via GitHub issues
- **Pro Plan**: Priority email support with 48-hour response
- **Premium Plan**: Dedicated support team with 24-hour response

## FAQ

**Q: What happens to existing tokens when downgrading?**  
A: Existing tokens continue to work but no new tokens can be created until usage is below the new limit.

**Q: Can I mix different token roles in my quota?**  
A: Yes, the token limit applies to total tokens regardless of role (admin, user, viewer, client).

**Q: Do client connections count active API usage?**  
A: Yes, client connections track active integrations and API clients, helping prevent abuse.

**Q: Is there a trial period for paid plans?**  
A: You can test Pro/Premium features by setting the environment variable - no payment required for self-hosted installations.

**Q: What's the difference between users and tokens?**  
A: Users are human accounts with login capabilities (future feature). Tokens are API keys for programmatic access (current implementation).

---

*Last updated: August 2025*  
*For the latest information, visit: https://github.com/GLINCKER/glinrdock*