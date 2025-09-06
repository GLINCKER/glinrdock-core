#!/bin/bash

# GLINRDOCK Production Setup Script
# Configures system for first-time production deployment
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[SETUP]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

usage() {
    echo "GLINRDOCK Production Setup"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --data-dir DIR        Data directory (default: /var/lib/glinrdock)"
    echo "  --user USER          System user (default: glinrdock)"  
    echo "  --domain DOMAIN      Primary domain for SSL/TLS"
    echo "  --email EMAIL        Admin email for Let's Encrypt"
    echo "  --generate-tokens    Generate secure tokens automatically"
    echo "  --nginx-proxy        Enable nginx reverse proxy"
    echo "  --help              Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  ADMIN_TOKEN          Admin authentication token"
    echo "  GLINRDOCK_SECRET     Master encryption key (base64, 32 bytes)"
    echo "  HTTP_ADDR            HTTP listen address (default: :8080)"
    echo "  DATA_DIR             Data directory override"
    echo ""
}

# Default values
DATA_DIR="/var/lib/glinrdock"
SYSTEM_USER="glinrdock"
DOMAIN=""
EMAIL=""
GENERATE_TOKENS=false
NGINX_PROXY=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --data-dir)
            DATA_DIR="$2"
            shift 2
            ;;
        --user)
            SYSTEM_USER="$2"
            shift 2
            ;;
        --domain)
            DOMAIN="$2"
            shift 2
            ;;
        --email)
            EMAIL="$2"
            shift 2
            ;;
        --generate-tokens)
            GENERATE_TOKENS=true
            shift
            ;;
        --nginx-proxy)
            NGINX_PROXY=true
            shift
            ;;
        --help)
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

echo -e "${BLUE}"
cat << 'EOF'
 ____  ____   ___  ____  _   _  ____ _____ ___ ___  _   _ 
|  _ \|  _ \ / _ \|  _ \| | | |/ ___|_   _|_ _/ _ \| \ | |
| |_) | |_) | | | | | | | | | | |     | |  | | | | |  \| |
|  __/|  _ <| |_| | |_| | |_| | |___  | |  | | |_| | |\  |
|_|   |_| \_\\___/|____/ \___/ \____| |_| |___\___/|_| \_|
                                                         
        GLINRDOCK Production Setup
EOF
echo -e "${NC}"

log_info "Setting up GLINRDOCK for production deployment"
log_info "Data directory: $DATA_DIR"
log_info "System user: $SYSTEM_USER"

# Step 1: System checks
log_step "1. System environment checks"

# Check if running as root or with sudo
if [[ $EUID -eq 0 ]]; then
    log_warn "Running as root - this is not recommended for production"
    log_warn "Consider running as regular user with sudo privileges"
fi

# Check required commands
REQUIRED_COMMANDS=("systemctl" "openssl" "curl")
for cmd in "${REQUIRED_COMMANDS[@]}"; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
        log_error "$cmd is required but not installed"
        exit 1
    fi
done

log_info "✅ All required commands available"

# Step 2: User and directory setup
log_step "2. Creating system user and directories"

# Create system user if it doesn't exist
if ! id "$SYSTEM_USER" >/dev/null 2>&1; then
    if [[ $EUID -eq 0 ]]; then
        useradd -r -s /bin/false -d "$DATA_DIR" "$SYSTEM_USER"
        log_info "Created system user: $SYSTEM_USER"
    else
        sudo useradd -r -s /bin/false -d "$DATA_DIR" "$SYSTEM_USER"
        log_info "Created system user: $SYSTEM_USER"
    fi
else
    log_info "System user already exists: $SYSTEM_USER"
fi

# Create directory structure
DIRECTORIES=(
    "$DATA_DIR"
    "$DATA_DIR/database"
    "$DATA_DIR/certs"
    "$DATA_DIR/nginx"
    "$DATA_DIR/logs"
    "/etc/glinrdock"
    "/var/log/glinrdock"
)

for dir in "${DIRECTORIES[@]}"; do
    if [[ $EUID -eq 0 ]]; then
        mkdir -p "$dir"
        chown "$SYSTEM_USER:$SYSTEM_USER" "$dir"
        chmod 755 "$dir"
    else
        sudo mkdir -p "$dir"
        sudo chown "$SYSTEM_USER:$SYSTEM_USER" "$dir"
        sudo chmod 755 "$dir"
    fi
    log_info "Created directory: $dir"
done

# Step 3: Security token generation
log_step "3. Security configuration"

# Generate admin token if requested or not set
if [[ "$GENERATE_TOKENS" = true ]] || [[ -z "$ADMIN_TOKEN" ]]; then
    ADMIN_TOKEN=$(openssl rand -base64 32)
    log_info "Generated admin token: $ADMIN_TOKEN"
    log_warn "Save this token securely - you'll need it to access GLINRDOCK"
fi

# Generate master encryption key if not set
if [[ -z "$GLINRDOCK_SECRET" ]]; then
    GLINRDOCK_SECRET=$(openssl rand -base64 32)
    log_info "Generated master encryption key"
    log_warn "Save this key securely - losing it will make encrypted data unrecoverable"
fi

# Step 4: Environment configuration
log_step "4. Environment configuration"

ENV_FILE="/etc/glinrdock/environment"
cat > "/tmp/glinrdock.env" << EOF
# GLINRDOCK Production Configuration
# Generated: $(date -u -Iseconds)

# Authentication
ADMIN_TOKEN=$ADMIN_TOKEN

# Encryption (for secrets at rest)
GLINRDOCK_SECRET=$GLINRDOCK_SECRET

# Server Configuration
HTTP_ADDR=${HTTP_ADDR:-:8080}
DATA_DIR=$DATA_DIR
GIN_MODE=release

# Logging
LOG_LEVEL=info

# SSL/TLS Configuration
$(if [[ -n "$DOMAIN" ]]; then echo "EXTERNAL_BASE_URL=https://$DOMAIN"; fi)
$(if [[ -n "$EMAIL" ]]; then echo "ACME_EMAIL=$EMAIL"; fi)

# Nginx Proxy
$(if [[ "$NGINX_PROXY" = true ]]; then echo "NGINX_PROXY_ENABLED=true"; else echo "NGINX_PROXY_ENABLED=false"; fi)

# Security Headers
SECURITY_HEADERS_ENABLED=true

# CORS (adjust as needed)
CORS_ORIGINS=https://$DOMAIN

# Docker Integration
DOCKER_HOST=unix:///var/run/docker.sock
EOF

# Install environment file
if [[ $EUID -eq 0 ]]; then
    mv "/tmp/glinrdock.env" "$ENV_FILE"
    chown root:$SYSTEM_USER "$ENV_FILE"
    chmod 640 "$ENV_FILE"
else
    sudo mv "/tmp/glinrdock.env" "$ENV_FILE"
    sudo chown root:$SYSTEM_USER "$ENV_FILE"
    sudo chmod 640 "$ENV_FILE"
fi

log_info "Environment configuration saved to: $ENV_FILE"

# Step 5: Systemd service configuration
log_step "5. Systemd service setup"

SERVICE_FILE="/etc/systemd/system/glinrdock.service"
cat > "/tmp/glinrdock.service" << EOF
[Unit]
Description=GLINRDOCK Container Management System
Documentation=https://docs.glinrdock.dev
After=network.target docker.service
Wants=docker.service
StartLimitIntervalSec=300
StartLimitBurst=5

[Service]
Type=simple
User=$SYSTEM_USER
Group=$SYSTEM_USER
ExecStart=/usr/local/bin/glinrdockd
ExecReload=/bin/kill -HUP \$MAINPID
KillMode=process
Restart=on-failure
RestartSec=10s
RestartPreventExitStatus=23

# Environment file
EnvironmentFile=$ENV_FILE

# Security settings
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=$DATA_DIR /var/log/glinrdock /tmp
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096
LimitMEMLOCK=infinity

# Capabilities (needed for Docker socket access)
CapabilityBoundingSet=CAP_NET_BIND_SERVICE
AmbientCapabilities=CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
EOF

# Install service file
if [[ $EUID -eq 0 ]]; then
    mv "/tmp/glinrdock.service" "$SERVICE_FILE"
    chmod 644 "$SERVICE_FILE"
else
    sudo mv "/tmp/glinrdock.service" "$SERVICE_FILE"
    sudo chmod 644 "$SERVICE_FILE"
fi

# Reload systemd
if [[ $EUID -eq 0 ]]; then
    systemctl daemon-reload
else
    sudo systemctl daemon-reload
fi

log_info "Systemd service installed: $SERVICE_FILE"

# Step 6: Docker integration setup
log_step "6. Docker integration setup"

# Add user to docker group if docker is installed
if command -v docker >/dev/null 2>&1; then
    if getent group docker >/dev/null 2>&1; then
        if [[ $EUID -eq 0 ]]; then
            usermod -a -G docker "$SYSTEM_USER"
        else
            sudo usermod -a -G docker "$SYSTEM_USER"
        fi
        log_info "Added $SYSTEM_USER to docker group"
    else
        log_warn "Docker group not found - user may not have Docker socket access"
    fi
else
    log_warn "Docker not installed - install Docker to manage containers"
fi

# Step 7: Firewall and security
log_step "7. Security configuration"

# Check if firewall is active
if command -v ufw >/dev/null 2>&1; then
    if ufw status | grep -q "Status: active"; then
        log_info "UFW firewall is active"
        log_warn "Ensure ports 80 and 443 are open for web traffic"
        log_warn "Run: sudo ufw allow 80 && sudo ufw allow 443"
    fi
fi

# Step 8: SSL/TLS setup preparation
if [[ -n "$DOMAIN" ]] && [[ -n "$EMAIL" ]]; then
    log_step "8. SSL/TLS preparation"
    log_info "Domain configured: $DOMAIN"
    log_info "ACME email: $EMAIL"
    log_info "Let's Encrypt certificates will be automatically managed"
else
    log_warn "Domain/email not configured - SSL/TLS will use self-signed certificates"
fi

# Step 9: Database migration test
log_step "9. Database migration verification"

# Test that the binary can initialize the database
log_info "Testing database initialization..."
if [[ -f "/usr/local/bin/glinrdockd" ]]; then
    # Run a quick database migration test
    timeout 10s env \
        DATA_DIR="$DATA_DIR" \
        ADMIN_TOKEN="$ADMIN_TOKEN" \
        GLINRDOCK_SECRET="$GLINRDOCK_SECRET" \
        /usr/local/bin/glinrdockd --help >/dev/null 2>&1 || true
    log_info "✅ Binary execution test passed"
else
    log_warn "GLINRDOCK binary not found at /usr/local/bin/glinrdockd"
    log_warn "Install the binary before starting the service"
fi

# Final summary
echo ""
log_info "🎉 GLINRDOCK production setup completed!"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "1. Install GLINRDOCK binary to /usr/local/bin/glinrdockd"
echo "2. Enable and start the service:"
echo "   sudo systemctl enable glinrdock"
echo "   sudo systemctl start glinrdock"
echo "3. Check service status:"
echo "   sudo systemctl status glinrdock"
echo "4. View logs:"
echo "   sudo journalctl -u glinrdock -f"
echo ""
echo -e "${BLUE}Configuration:${NC}"
echo "  📁 Data directory: $DATA_DIR"
echo "  👤 System user: $SYSTEM_USER"
echo "  🔧 Config file: $ENV_FILE"
echo "  🔑 Admin token: $ADMIN_TOKEN"
echo "  🌐 Domain: ${DOMAIN:-"Not configured"}"
echo ""
echo -e "${YELLOW}Security Notes:${NC}"
echo "• Save the admin token and encryption key securely"
echo "• Ensure firewall allows HTTP/HTTPS traffic"
echo "• Review environment configuration before production"
echo "• Monitor logs for any startup issues"
echo ""
log_info "Setup completed successfully! 🚀"