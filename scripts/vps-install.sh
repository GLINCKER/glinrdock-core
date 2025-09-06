#!/bin/bash

# GLINRDOCK VPS Installation Script
# Automated setup for production deployment
set -e

# Configuration
INSTALL_DIR="/opt/glinrdock"
REPO_URL="https://github.com/GLINCKER/glinrdock-core.git"
DOMAIN=""
EMAIL=""
ADMIN_TOKEN=""
USE_STAGING=false

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
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

usage() {
    echo "GLINRDOCK VPS Installation Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -d, --domain DOMAIN     Domain name for SSL certificate"
    echo "  -e, --email EMAIL       Email address for Let's Encrypt"
    echo "  -t, --token TOKEN       Admin token (will be generated if not provided)"
    echo "  -s, --staging           Use Let's Encrypt staging environment"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  # Interactive installation"
    echo "  $0"
    echo ""
    echo "  # Non-interactive with parameters"
    echo "  $0 -d example.com -e admin@example.com"
    echo ""
    echo "  # With custom admin token"
    echo "  $0 -d example.com -e admin@example.com -t my-secure-token"
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
        -t|--token)
            ADMIN_TOKEN="$2"
            shift 2
            ;;
        -s|--staging)
            USE_STAGING=true
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

# Banner
echo -e "${BLUE}"
cat << 'EOF'
  ____  _     ___ _   _ ____  ____   ___   ____ _  __
 / ___|| |   |_ _| \ | |  _ \|  _ \ / _ \ / ___| |/ /
| |  _ | |    | ||  \| | |_) | | | | | | | |   | ' / 
| |_| || |___ | || |\  |  _ <| |_| | |_| | |___| . \ 
 \____|_____|___|_| \_|_| \_\____/ \___/ \____|_|\_\
                                                     
         VPS Production Deployment Installer
EOF
echo -e "${NC}"

log_info "Starting GLINRDOCK VPS installation..."

# Interactive prompts if parameters not provided
if [[ -z "$DOMAIN" ]]; then
    echo -n "Enter your domain name (e.g., glinrdock.example.com): "
    read DOMAIN
fi

if [[ -z "$EMAIL" ]]; then
    echo -n "Enter your email for Let's Encrypt notifications: "
    read EMAIL
fi

if [[ -z "$ADMIN_TOKEN" ]]; then
    log_info "Generating secure admin token..."
    ADMIN_TOKEN=$(openssl rand -base64 32)
fi

# Validate inputs
if [[ -z "$DOMAIN" || -z "$EMAIL" ]]; then
    log_error "Domain and email are required"
    exit 1
fi

log_info "Configuration:"
log_info "  Domain: $DOMAIN"
log_info "  Email: $EMAIL" 
log_info "  Install Directory: $INSTALL_DIR"
log_info "  Staging SSL: $USE_STAGING"

echo ""
echo -n "Proceed with installation? (y/N): "
read -r CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    log_info "Installation cancelled"
    exit 0
fi

# System requirements check
log_step "1/8 Checking system requirements"

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    log_error "Please don't run this script as root. Use a regular user with sudo privileges."
    exit 1
fi

# Check sudo access
if ! sudo -n true 2>/dev/null; then
    log_error "This script requires sudo privileges. Please ensure your user can use sudo."
    exit 1
fi

# Check OS
if [[ ! -f /etc/os-release ]]; then
    log_error "Cannot determine OS version"
    exit 1
fi

source /etc/os-release
if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
    log_warn "This script is tested on Ubuntu/Debian. Your OS: $ID"
    echo -n "Continue anyway? (y/N): "
    read -r CONTINUE
    if [[ ! "$CONTINUE" =~ ^[Yy]$ ]]; then
        exit 0
    fi
fi

log_info "OS: $PRETTY_NAME"

# Update system
log_step "2/8 Updating system packages"
sudo apt-get update -qq
sudo apt-get upgrade -y -qq

# Install dependencies
log_step "3/8 Installing system dependencies"
sudo apt-get install -y curl wget git build-essential software-properties-common apt-transport-https ca-certificates gnupg lsb-release

# Install Docker
log_step "4/8 Installing Docker"
if command -v docker &> /dev/null; then
    log_info "Docker already installed: $(docker --version)"
else
    log_info "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    log_info "Docker installed successfully"
fi

# Install Docker Compose
if command -v docker-compose &> /dev/null; then
    log_info "Docker Compose already installed: $(docker-compose --version)"
else
    log_info "Installing Docker Compose..."
    DOCKER_COMPOSE_VERSION=$(curl -s https://api.github.com/repos/docker/compose/releases/latest | grep -Po '"tag_name": "\K.*?(?=")')
    sudo curl -L "https://github.com/docker/compose/releases/download/$DOCKER_COMPOSE_VERSION/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    log_info "Docker Compose installed successfully"
fi

# Install Go
log_step "5/8 Installing Go"
if command -v go &> /dev/null; then
    log_info "Go already installed: $(go version)"
else
    log_info "Installing Go..."
    GO_VERSION="1.21.5"
    wget -q "https://golang.org/dl/go${GO_VERSION}.linux-amd64.tar.gz"
    sudo rm -rf /usr/local/go
    sudo tar -C /usr/local -xzf "go${GO_VERSION}.linux-amd64.tar.gz"
    rm "go${GO_VERSION}.linux-amd64.tar.gz"
    
    # Add Go to PATH
    if ! grep -q "/usr/local/go/bin" ~/.bashrc; then
        echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
    fi
    export PATH=$PATH:/usr/local/go/bin
    
    log_info "Go installed successfully: $(go version)"
fi

# Install Node.js
if command -v node &> /dev/null; then
    log_info "Node.js already installed: $(node --version)"
else
    log_info "Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt-get install -y nodejs
    log_info "Node.js installed successfully"
fi

# Clone and setup GLINRDOCK
log_step "6/8 Setting up GLINRDOCK"

if [[ -d "$INSTALL_DIR" ]]; then
    log_warn "Directory $INSTALL_DIR already exists"
    echo -n "Remove and reinstall? (y/N): "
    read -r REMOVE
    if [[ "$REMOVE" =~ ^[Yy]$ ]]; then
        sudo rm -rf "$INSTALL_DIR"
    else
        log_info "Using existing directory"
    fi
fi

if [[ ! -d "$INSTALL_DIR" ]]; then
    log_info "Cloning GLINRDOCK repository..."
    sudo git clone "$REPO_URL" "$INSTALL_DIR"
    sudo chown -R $USER:$USER "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

# Build application
log_info "Building GLINRDOCK..."
export CGO_ENABLED=1
make build

# Build frontend
log_info "Building frontend..."
cd web/ui-lite
npm install
npm run build
cd ../..

# Create production environment
log_step "7/8 Configuring production environment"

# Create directories
sudo mkdir -p "$INSTALL_DIR"/{data,certs,nginx/{logs,cache},certbot-webroot}
sudo chown -R $USER:$USER "$INSTALL_DIR"

# Generate secrets
GLINRDOCK_SECRET=$(openssl rand -base64 32)

# Create .env file
cat > .env << EOF
# GLINRDOCK Production Configuration
# Generated: $(date)

# Core settings
ADMIN_TOKEN=$ADMIN_TOKEN
GLINRDOCK_SECRET=$GLINRDOCK_SECRET

# Network settings
EXTERNAL_BASE_URL=https://$DOMAIN
CORS_ORIGINS=https://$DOMAIN
HTTP_ADDR=:8080

# Database
DATA_DIR=/app/data

# Production settings  
GIN_MODE=release
LOG_LEVEL=info

# Nginx proxy
NGINX_PROXY_ENABLED=true

# SSL/TLS
DOMAIN=$DOMAIN
EMAIL=$EMAIL
EOF

log_info "Environment configuration created"

# Setup SSL certificate
log_step "8/8 Setting up SSL certificate"

# Start services for SSL setup
log_info "Starting GLINRDOCK services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be ready
sleep 10

# Setup SSL certificate
STAGING_FLAG=""
if [[ "$USE_STAGING" == true ]]; then
    STAGING_FLAG="--staging"
fi

log_info "Requesting SSL certificate..."
./scripts/setup-ssl.sh -d "$DOMAIN" -e "$EMAIL" $STAGING_FLAG

# Create systemd service
log_info "Creating systemd service..."
sudo tee /etc/systemd/system/glinrdock.service > /dev/null << EOF
[Unit]
Description=GLINRDOCK Container Management System
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
User=$USER
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable glinrdock
sudo systemctl start glinrdock

# Final status check
log_info "Checking service status..."
sleep 5
sudo systemctl status glinrdock --no-pager

# Success message
echo ""
echo -e "${GREEN}🎉 GLINRDOCK Installation Complete! 🎉${NC}"
echo ""
echo -e "${BLUE}Installation Summary:${NC}"
echo "  • Domain: https://$DOMAIN"
echo "  • Admin Token: $ADMIN_TOKEN"  
echo "  • Install Directory: $INSTALL_DIR"
echo "  • Service: glinrdock.service"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Visit your domain: https://$DOMAIN"
echo "  2. Login with your admin token"
echo "  3. Start deploying Spring Boot applications!"
echo ""
echo -e "${BLUE}Management Commands:${NC}"
echo "  • Status: sudo systemctl status glinrdock"
echo "  • Restart: sudo systemctl restart glinrdock"  
echo "  • Logs: docker-compose -f $INSTALL_DIR/docker-compose.prod.yml logs -f"
echo "  • Update: cd $INSTALL_DIR && git pull && make build && sudo systemctl restart glinrdock"
echo ""
echo -e "${YELLOW}Important:${NC} Save your admin token securely!"
echo "Admin Token: $ADMIN_TOKEN"

# Save admin token to file
echo "$ADMIN_TOKEN" > "$INSTALL_DIR/.admin-token"
chmod 600 "$INSTALL_DIR/.admin-token"
log_info "Admin token saved to $INSTALL_DIR/.admin-token"

# Suggest reboot if Docker was just installed
if ! groups | grep -q docker; then
    echo ""
    log_warn "You may need to log out and back in (or reboot) for Docker group changes to take effect"
fi

log_info "GLINRDOCK is ready for production deployment! 🚀"