#!/bin/bash

# GLINRDOCK SSL Certificate Setup Script
set -e

DOMAIN=""
EMAIL=""
STAGING=false
DATA_PATH="./data/certbot"
NGINX_CONF_PATH="./nginx/generated"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

usage() {
    echo "Usage: $0 -d DOMAIN -e EMAIL [OPTIONS]"
    echo ""
    echo "Required:"
    echo "  -d, --domain DOMAIN     Domain name for SSL certificate"
    echo "  -e, --email EMAIL       Email address for Let's Encrypt"
    echo ""
    echo "Options:"
    echo "  -s, --staging          Use Let's Encrypt staging environment (for testing)"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Example:"
    echo "  $0 -d example.com -e admin@example.com"
    echo "  $0 -d example.com -e admin@example.com --staging"
}

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--domain)
            DOMAIN="$2"
            shift 2
            ;;
        -e|--email)
            EMAIL="$2"
            shift 2
            ;;
        -s|--staging)
            STAGING=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            usage
            exit 1
            ;;
    esac
done

# Validate required arguments
if [[ -z "$DOMAIN" ]]; then
    log_error "Domain is required"
    usage
    exit 1
fi

if [[ -z "$EMAIL" ]]; then
    log_error "Email is required"
    usage
    exit 1
fi

log_info "Setting up SSL certificate for domain: $DOMAIN"

# Create directories
mkdir -p "$DATA_PATH"
mkdir -p "$NGINX_CONF_PATH"
mkdir -p "./certs"

# Set staging flag
STAGING_FLAG=""
if [[ "$STAGING" == true ]]; then
    STAGING_FLAG="--staging"
    log_warn "Using Let's Encrypt staging environment (test certificates)"
fi

# Generate nginx configuration for the domain
log_info "Generating nginx configuration for $DOMAIN"

cat > "$NGINX_CONF_PATH/$DOMAIN.conf" << EOF
# HTTP server for $DOMAIN
server {
    listen 80;
    server_name $DOMAIN;
    
    # Let's Encrypt challenge location
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
        try_files \$uri =404;
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://\$host\$request_uri;
    }
}

# HTTPS server for $DOMAIN
server {
    listen 443 ssl http2;
    server_name $DOMAIN;
    
    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Rate limiting for API calls
    location /v1/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://glinrdock:8080;
        include /etc/nginx/proxy_params;
    }
    
    # Rate limiting for login
    location /v1/auth/login {
        limit_req zone=login burst=5 nodelay;
        proxy_pass http://glinrdock:8080;
        include /etc/nginx/proxy_params;
    }
    
    # WebSocket support
    location /ws/ {
        proxy_pass http://glinrdock:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }
    
    # Main application
    location / {
        proxy_pass http://glinrdock:8080;
        include /etc/nginx/proxy_params;
    }
}
EOF

# Function to wait for nginx to be ready
wait_for_nginx() {
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if docker-compose -f docker-compose.prod.yml exec nginx nginx -t > /dev/null 2>&1; then
            log_info "Nginx is ready"
            return 0
        fi
        
        log_info "Waiting for nginx to be ready (attempt $attempt/$max_attempts)"
        sleep 2
        ((attempt++))
    done
    
    log_error "Nginx failed to become ready"
    return 1
}

# Check if docker-compose.prod.yml exists
if [[ ! -f "docker-compose.prod.yml" ]]; then
    log_error "docker-compose.prod.yml not found. Please ensure you're in the GLINRDOCK directory."
    exit 1
fi

# Start nginx service first (for ACME challenge)
log_info "Starting nginx service for ACME challenge"
docker-compose -f docker-compose.prod.yml up -d nginx

# Wait for nginx to be ready
wait_for_nginx

# Request SSL certificate
log_info "Requesting SSL certificate from Let's Encrypt"
docker-compose -f docker-compose.prod.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    $STAGING_FLAG \
    -d "$DOMAIN" \
    --non-interactive

if [[ $? -eq 0 ]]; then
    log_info "SSL certificate obtained successfully!"
    
    # Reload nginx to use the new certificate
    log_info "Reloading nginx with new SSL certificate"
    docker-compose -f docker-compose.prod.yml exec nginx nginx -s reload
    
    if [[ "$STAGING" == true ]]; then
        log_warn "Remember: You used staging certificates. For production, run without --staging flag."
    else
        log_info "Production SSL certificate is now active for $DOMAIN"
    fi
    
    # Show certificate info
    log_info "Certificate information:"
    docker-compose -f docker-compose.prod.yml run --rm certbot certificates
    
else
    log_error "Failed to obtain SSL certificate"
    log_error "Check the logs above for details"
    exit 1
fi

# Create renewal test script
cat > "scripts/test-ssl-renewal.sh" << 'EOF'
#!/bin/bash
# Test SSL certificate renewal

echo "Testing SSL certificate renewal (dry run)..."
docker-compose -f docker-compose.prod.yml run --rm certbot renew --dry-run

if [[ $? -eq 0 ]]; then
    echo "SSL certificate renewal test: SUCCESS"
    echo "Auto-renewal is working correctly"
else
    echo "SSL certificate renewal test: FAILED"
    echo "Please check your configuration"
    exit 1
fi
EOF

chmod +x "scripts/test-ssl-renewal.sh"

log_info "SSL setup complete!"
log_info "Your GLINRDOCK installation is now secured with SSL"
log_info ""
log_info "Next steps:"
log_info "1. Test your site: https://$DOMAIN"
log_info "2. Test SSL renewal: ./scripts/test-ssl-renewal.sh"
log_info "3. Configure your DNS to point to this server"
log_info ""
log_info "Certificate auto-renewal is handled by the certbot container"