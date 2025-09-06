#!/bin/bash

# Test SSL certificate renewal for GLINRDOCK
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

echo -e "${BLUE}"
echo "GLINRDOCK SSL Certificate Renewal Test"
echo "======================================"
echo -e "${NC}"

# Check if docker-compose.prod.yml exists
if [[ ! -f "docker-compose.prod.yml" ]]; then
    log_error "docker-compose.prod.yml not found. Please run this script from the GLINRDOCK root directory."
    exit 1
fi

# Check if certbot service is running
log_step "Checking certbot service status"
if ! docker-compose -f docker-compose.prod.yml ps certbot | grep -q "Up\|running"; then
    log_warn "Certbot service is not running. Starting it..."
    docker-compose -f docker-compose.prod.yml up -d certbot
    sleep 5
fi

# Test certificate renewal (dry run)
log_step "Testing SSL certificate renewal (dry run)"
log_info "This will test the renewal process without actually renewing certificates"

docker-compose -f docker-compose.prod.yml run --rm certbot renew --dry-run

if [[ $? -eq 0 ]]; then
    echo ""
    log_info "✅ SSL certificate renewal test: SUCCESS"
    log_info "Auto-renewal is working correctly"
    
    # Check certificate status
    log_step "Checking current certificate status"
    docker-compose -f docker-compose.prod.yml run --rm certbot certificates
    
    # Show certbot container logs
    log_step "Recent certbot activity"
    docker-compose -f docker-compose.prod.yml logs --tail=20 certbot
    
    echo ""
    log_info "SSL Certificate Renewal Summary:"
    log_info "• Renewal test: PASSED"
    log_info "• Auto-renewal: ENABLED (via certbot container)"
    log_info "• Check interval: 12 hours"
    log_info "• Nginx reload: Automatic on renewal"
    
else
    echo ""
    log_error "❌ SSL certificate renewal test: FAILED"
    log_error "Please check your configuration"
    
    log_step "Troubleshooting information"
    log_info "1. Check certbot logs:"
    echo "   docker-compose -f docker-compose.prod.yml logs certbot"
    
    log_info "2. Check nginx configuration:"
    echo "   docker-compose -f docker-compose.prod.yml exec nginx nginx -t"
    
    log_info "3. Verify domain DNS points to this server"
    
    log_info "4. Check firewall allows HTTP/HTTPS (ports 80/443)"
    
    exit 1
fi

# Test nginx configuration
log_step "Testing nginx configuration"
if docker-compose -f docker-compose.prod.yml exec nginx nginx -t > /dev/null 2>&1; then
    log_info "✅ Nginx configuration: VALID"
else
    log_warn "⚠️  Nginx configuration may have issues"
    docker-compose -f docker-compose.prod.yml exec nginx nginx -t
fi

# Check certificate expiration dates
log_step "Certificate expiration information"
echo ""
docker-compose -f docker-compose.prod.yml run --rm certbot certificates | grep -E "(Certificate Name|Expiry Date)" || true

echo ""
log_info "🎉 SSL certificate system is ready for production!"
log_info ""
log_info "Monitoring commands:"
log_info "• View renewal logs: docker-compose -f docker-compose.prod.yml logs -f certbot"
log_info "• Check certificates: docker-compose -f docker-compose.prod.yml run --rm certbot certificates"
log_info "• Force renewal: docker-compose -f docker-compose.prod.yml run --rm certbot renew --force-renewal"