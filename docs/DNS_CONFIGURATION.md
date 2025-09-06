# DNS Configuration Guide for GLINRDOCK

This guide covers DNS setup requirements for GLINRDOCK VPS deployment with SSL certificates.

## 🎯 Quick Setup Checklist

For your GLINRDOCK installation to work properly, you need:

- [ ] Domain pointing to your VPS IP address
- [ ] DNS propagation completed (15 minutes to 48 hours)
- [ ] Ports 80 and 443 open on your VPS firewall
- [ ] Valid email address for Let's Encrypt notifications

## 📋 DNS Record Requirements

### Required DNS Records

| Record Type | Name | Value | TTL | Purpose |
|-------------|------|-------|-----|---------|
| **A** | `@` | `YOUR_VPS_IP` | 3600 | Main domain |
| **A** | `www` | `YOUR_VPS_IP` | 3600 | WWW subdomain |

### Optional Records (Recommended)

| Record Type | Name | Value | TTL | Purpose |
|-------------|------|-------|-----|---------|
| **CNAME** | `api` | `your-domain.com` | 3600 | API endpoint |
| **CNAME** | `admin` | `your-domain.com` | 3600 | Admin interface |

## 🏗️ DNS Provider Configuration

### Cloudflare

1. **Log into Cloudflare Dashboard**
2. **Select your domain**
3. **Go to DNS section**
4. **Add A records:**
   ```
   Type: A
   Name: @ 
   IPv4 Address: YOUR_VPS_IP
   TTL: Auto
   Proxy Status: Proxied (🟠) or DNS only (Gray cloud)
   ```
5. **Add WWW record:**
   ```
   Type: A
   Name: www
   IPv4 Address: YOUR_VPS_IP  
   TTL: Auto
   Proxy Status: Same as main record
   ```

**Note:** If using Cloudflare proxy (orange cloud), SSL certificates are handled by Cloudflare. For Let's Encrypt certificates, use "DNS only" mode (gray cloud).

### Namecheap

1. **Login to Namecheap account**
2. **Go to Domain List → Manage**
3. **Advanced DNS tab**
4. **Add/Edit records:**
   ```
   Type: A Record
   Host: @
   Value: YOUR_VPS_IP
   TTL: Automatic
   ```
   ```
   Type: A Record  
   Host: www
   Value: YOUR_VPS_IP
   TTL: Automatic
   ```

### GoDaddy

1. **Login to GoDaddy account**
2. **My Products → DNS**
3. **Manage DNS**
4. **Add records:**
   ```
   Type: A
   Name: @
   Value: YOUR_VPS_IP
   TTL: 1 Hour
   ```
   ```
   Type: A
   Name: www  
   Value: YOUR_VPS_IP
   TTL: 1 Hour
   ```

### Google Domains (Cloud DNS)

1. **Go to Cloud DNS Console**
2. **Select your zone**
3. **Add record set:**
   ```
   DNS Name: your-domain.com.
   Resource Record Type: A
   IPv4 Address: YOUR_VPS_IP
   TTL: 300
   ```

## 🔍 DNS Verification

### Check DNS Propagation

Use these tools to verify DNS propagation:

```bash
# Check A record
dig your-domain.com A

# Check from multiple locations
nslookup your-domain.com

# Online tools
# https://www.whatsmydns.net/
# https://dnschecker.org/
```

### Expected Output
```bash
$ dig example.com A
;; ANSWER SECTION:
example.com.    3600    IN      A       YOUR_VPS_IP
```

### Test Domain Connectivity

```bash
# Test HTTP connectivity
curl -I http://your-domain.com

# Test if ports are open
telnet your-domain.com 80
telnet your-domain.com 443
```

## ⚡ Quick DNS Setup Commands

### Using Domain Registrar API (Example)

For automation, many providers offer APIs:

```bash
# Cloudflare API example
DOMAIN="example.com"
VPS_IP="1.2.3.4"
API_TOKEN="your-api-token"

# Add A record
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/dns_records" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"type":"A","name":"@","content":"'$VPS_IP'","ttl":3600}'
```

## 🚨 Common DNS Issues

### Issue: "Domain doesn't resolve"

**Symptoms:**
- `dig your-domain.com` returns no A record
- Browser shows "This site can't be reached"

**Solutions:**
1. Check DNS record syntax
2. Verify VPS IP address is correct
3. Wait for DNS propagation (up to 48 hours)
4. Test with different DNS servers: `dig @8.8.8.8 your-domain.com`

### Issue: "SSL certificate generation fails"

**Symptoms:**
- Let's Encrypt error: "Invalid response from http://your-domain.com/.well-known/acme-challenge/"
- certbot fails with DNS resolution errors

**Solutions:**
1. Ensure DNS points to your VPS
2. Check firewall allows port 80
3. Verify nginx is running and serving ACME challenges
4. Test: `curl http://your-domain.com/.well-known/acme-challenge/test`

### Issue: "WWW doesn't work"

**Symptoms:**
- `your-domain.com` works but `www.your-domain.com` doesn't
- Mixed content warnings

**Solutions:**
1. Add CNAME or A record for `www`
2. Update nginx configuration for both domains
3. Include both domains in SSL certificate

## 📊 DNS Health Check Script

Save this as `scripts/check-dns.sh`:

```bash
#!/bin/bash

DOMAIN="$1"

if [[ -z "$DOMAIN" ]]; then
    echo "Usage: $0 your-domain.com"
    exit 1
fi

echo "DNS Health Check for $DOMAIN"
echo "================================"

# Check A record
echo -n "A record: "
dig +short "$DOMAIN" A | head -1

# Check WWW record  
echo -n "WWW record: "
dig +short "www.$DOMAIN" A | head -1

# Check nameservers
echo "Nameservers:"
dig +short "$DOMAIN" NS

# Test HTTP response
echo -n "HTTP status: "
curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN" || echo "Failed"

# Test HTTPS response  
echo -n "HTTPS status: "
curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN" || echo "Failed"

# Check SSL certificate
echo "SSL certificate:"
echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates
```

## 🔧 Advanced DNS Configuration

### Subdomains for Services

You can create subdomains for different services:

```bash
# Examples
api.your-domain.com    → GLINRDOCK API
admin.your-domain.com  → Admin interface  
app1.your-domain.com   → First Spring Boot app
app2.your-domain.com   → Second Spring Boot app
```

### DNS Record for Each Subdomain:
```
Type: CNAME
Name: api
Value: your-domain.com
TTL: 3600
```

### Load Balancing (Advanced)

For multiple VPS instances:

```bash
# Multiple A records for load balancing
your-domain.com  A  1.2.3.4
your-domain.com  A  1.2.3.5  
your-domain.com  A  1.2.3.6
```

## 📚 DNS Provider Documentation Links

- **Cloudflare:** https://developers.cloudflare.com/dns/
- **Namecheap:** https://www.namecheap.com/support/knowledgebase/article.aspx/434/2237/how-do-i-set-up-host-records-for-a-domain
- **GoDaddy:** https://www.godaddy.com/help/manage-dns-680
- **AWS Route 53:** https://docs.aws.amazon.com/route53/
- **Google Cloud DNS:** https://cloud.google.com/dns/docs

## 🎯 Pre-Installation DNS Checklist

Before running GLINRDOCK installation:

- [ ] Domain registered and active
- [ ] DNS A record points to VPS IP
- [ ] DNS propagation completed (test with `dig your-domain.com`)
- [ ] No existing web server on ports 80/443
- [ ] Firewall allows HTTP (80) and HTTPS (443)
- [ ] Valid email for Let's Encrypt notifications
- [ ] Domain doesn't redirect to other services

## ✅ Post-Installation Verification

After GLINRDOCK deployment:

```bash
# Test domain resolution
./scripts/check-dns.sh your-domain.com

# Test SSL certificate
./scripts/test-ssl-renewal.sh

# Test GLINRDOCK access
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" https://your-domain.com/v1/system
```

Your DNS configuration is complete when:
- ✅ Domain resolves to your VPS IP
- ✅ HTTP redirects to HTTPS
- ✅ SSL certificate is valid and auto-renewing
- ✅ GLINRDOCK web interface is accessible

## 🆘 Getting Help

If you encounter DNS issues:

1. **Check Status:** Use online DNS propagation checkers
2. **Test Locally:** Use `dig`, `nslookup`, `ping` commands
3. **Review Logs:** Check GLINRDOCK and nginx logs
4. **Contact Support:** Reach out to your DNS provider
5. **Community:** Check GLINRDOCK documentation and issues

Remember: DNS changes can take up to 48 hours to fully propagate worldwide!