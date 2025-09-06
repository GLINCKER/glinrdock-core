#!/bin/bash

# DNS Health Check for GLINRDOCK
# Usage: ./scripts/check-dns.sh your-domain.com

DOMAIN="$1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[⚠]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

if [[ -z "$DOMAIN" ]]; then
    echo "Usage: $0 your-domain.com"
    echo ""
    echo "Example:"
    echo "  $0 glinrdock.example.com"
    exit 1
fi

echo -e "${BLUE}"
echo "DNS Health Check for $DOMAIN"
echo "================================"
echo -e "${NC}"

# Check A record
log_step "Checking A record..."
A_RECORD=$(dig +short "$DOMAIN" A | head -1)
if [[ -n "$A_RECORD" ]]; then
    log_info "A record: $A_RECORD"
else
    log_error "A record: NOT FOUND"
fi

# Check WWW record
log_step "Checking WWW record..."
WWW_RECORD=$(dig +short "www.$DOMAIN" A | head -1)
if [[ -n "$WWW_RECORD" ]]; then
    log_info "WWW record: $WWW_RECORD"
else
    log_warn "WWW record: NOT FOUND (optional)"
fi

# Check nameservers
log_step "Checking nameservers..."
echo "Nameservers:"
dig +short "$DOMAIN" NS | while read ns; do
    echo "  • $ns"
done

# Test connectivity to ports
log_step "Testing connectivity..."

# Test port 80
if timeout 5 bash -c "</dev/tcp/$DOMAIN/80" 2>/dev/null; then
    log_info "Port 80 (HTTP): Open"
else
    log_error "Port 80 (HTTP): Closed or filtered"
fi

# Test port 443
if timeout 5 bash -c "</dev/tcp/$DOMAIN/443" 2>/dev/null; then
    log_info "Port 443 (HTTPS): Open"
else
    log_error "Port 443 (HTTPS): Closed or filtered"
fi

# Test HTTP response
log_step "Testing HTTP response..."
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "http://$DOMAIN" 2>/dev/null)
if [[ "$HTTP_STATUS" =~ ^[23] ]]; then
    log_info "HTTP status: $HTTP_STATUS"
elif [[ "$HTTP_STATUS" == "301" || "$HTTP_STATUS" == "302" ]]; then
    log_info "HTTP status: $HTTP_STATUS (redirecting to HTTPS)"
else
    log_error "HTTP status: $HTTP_STATUS or timeout"
fi

# Test HTTPS response
log_step "Testing HTTPS response..."
HTTPS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -m 10 "https://$DOMAIN" 2>/dev/null)
if [[ "$HTTPS_STATUS" =~ ^2 ]]; then
    log_info "HTTPS status: $HTTPS_STATUS"
else
    log_error "HTTPS status: $HTTPS_STATUS or timeout"
fi

# Check SSL certificate
log_step "Checking SSL certificate..."
SSL_INFO=$(echo | openssl s_client -servername "$DOMAIN" -connect "$DOMAIN:443" -verify_return_error 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)

if [[ -n "$SSL_INFO" ]]; then
    log_info "SSL certificate:"
    echo "$SSL_INFO" | sed 's/^/  /'
    
    # Check certificate validity
    NOT_AFTER=$(echo "$SSL_INFO" | grep "notAfter" | cut -d= -f2)
    if [[ -n "$NOT_AFTER" ]]; then
        EXPIRY_DATE=$(date -d "$NOT_AFTER" +%s 2>/dev/null || gdate -d "$NOT_AFTER" +%s 2>/dev/null)
        CURRENT_DATE=$(date +%s)
        DAYS_LEFT=$(( (EXPIRY_DATE - CURRENT_DATE) / 86400 ))
        
        if [[ $DAYS_LEFT -gt 30 ]]; then
            log_info "Certificate expires in $DAYS_LEFT days"
        elif [[ $DAYS_LEFT -gt 7 ]]; then
            log_warn "Certificate expires in $DAYS_LEFT days (renewal recommended)"
        else
            log_error "Certificate expires in $DAYS_LEFT days (urgent renewal needed)"
        fi
    fi
else
    log_error "SSL certificate: NOT FOUND or invalid"
fi

# DNS propagation check
log_step "Checking DNS propagation..."

# Check with different DNS servers
DNS_SERVERS=("8.8.8.8" "1.1.1.1" "9.9.9.9" "208.67.222.222")
CONSISTENT=true

FIRST_RESULT=""
for dns_server in "${DNS_SERVERS[@]}"; do
    RESULT=$(dig +short "@$dns_server" "$DOMAIN" A | head -1)
    if [[ -z "$FIRST_RESULT" ]]; then
        FIRST_RESULT="$RESULT"
    elif [[ "$RESULT" != "$FIRST_RESULT" ]]; then
        CONSISTENT=false
    fi
    echo "  $dns_server: $RESULT"
done

if [[ "$CONSISTENT" == true ]]; then
    log_info "DNS propagation: Consistent across servers"
else
    log_warn "DNS propagation: Inconsistent results (may still be propagating)"
fi

# Check GLINRDOCK API if accessible
log_step "Testing GLINRDOCK API..."
API_RESPONSE=$(curl -s -m 5 "https://$DOMAIN/v1/health" 2>/dev/null)
if [[ $? -eq 0 ]] && [[ -n "$API_RESPONSE" ]]; then
    log_info "GLINRDOCK API: Accessible"
else
    log_warn "GLINRDOCK API: Not accessible (may require authentication)"
fi

echo ""
echo -e "${BLUE}Summary:${NC}"
if [[ -n "$A_RECORD" ]] && [[ "$HTTPS_STATUS" =~ ^2 ]]; then
    log_info "Domain configuration: READY"
    log_info "Your domain is properly configured for GLINRDOCK!"
elif [[ -n "$A_RECORD" ]] && [[ -z "$SSL_INFO" ]]; then
    log_warn "Domain configuration: PARTIAL"
    log_warn "Domain resolves but SSL certificate not yet configured"
    log_step "Run GLINRDOCK installation to set up SSL"
else
    log_error "Domain configuration: INCOMPLETE"
    log_error "Please check DNS records and try again"
    
    echo ""
    log_step "Troubleshooting steps:"
    echo "1. Verify DNS A record points to your VPS IP"
    echo "2. Wait for DNS propagation (up to 48 hours)"
    echo "3. Check firewall allows ports 80 and 443"
    echo "4. Ensure no other web server is running"
fi

echo ""
log_step "Useful commands:"
echo "• Test again: ./scripts/check-dns.sh $DOMAIN"
echo "• Monitor propagation: https://www.whatsmydns.net/#A/$DOMAIN"
echo "• Check SSL: https://www.ssllabs.com/ssltest/analyze.html?d=$DOMAIN"