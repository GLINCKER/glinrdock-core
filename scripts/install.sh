#!/bin/bash
set -euo pipefail

# GlinrDock Installation Script
# Installs GlinrDock with systemd service on Linux systems
# Usage: curl -fsSL https://github.com/GLINCKER/glinrdock/releases/latest/download/install.sh | sudo bash
# Or: wget -qO- https://github.com/GLINCKER/glinrdock/releases/latest/download/install.sh | sudo bash

# Configuration
GLINRDOCK_USER="${GLINRDOCK_USER:-glinrdock}"
GLINRDOCK_GROUP="${GLINRDOCK_GROUP:-glinrdock}"
GLINRDOCK_HOME="${GLINRDOCK_HOME:-/opt/glinrdock}"
GLINRDOCK_DATA_DIR="${GLINRDOCK_DATA_DIR:-/var/lib/glinrdock}"
GLINRDOCK_LOG_DIR="${GLINRDOCK_LOG_DIR:-/var/log/glinrdock}"
GLINRDOCK_PORT="${GLINRDOCK_PORT:-8080}"
ADMIN_TOKEN="${ADMIN_TOKEN:-$(openssl rand -hex 32)}"
DRY_RUN="${DRY_RUN:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${GREEN}[INFO]${NC} $*"
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $*" >&2
}

error() {
    echo -e "${RED}[ERROR]${NC} $*" >&2
    exit 1
}

# Check if running with sudo/root
check_root() {
    if [[ $EUID -ne 0 ]] && [[ "$DRY_RUN" != "true" ]]; then
        error "This script must be run as root. Use: sudo $0"
    fi
}

# Detect system architecture and OS
detect_system() {
    local arch
    local os
    
    # Detect architecture
    case "$(uname -m)" in
        x86_64|amd64)
            arch="amd64"
            ;;
        aarch64|arm64)
            arch="arm64"
            ;;
        armv7l)
            arch="arm"
            ;;
        *)
            error "Unsupported architecture: $(uname -m)"
            ;;
    esac
    
    # Detect OS
    if [[ -f /etc/os-release ]]; then
        . /etc/os-release
        case "$ID" in
            ubuntu|debian)
                os="linux"
                ;;
            centos|rhel|fedora|rocky|alma)
                os="linux"
                ;;
            *)
                warn "Untested OS: $ID. Proceeding with generic Linux installation..."
                os="linux"
                ;;
        esac
    else
        warn "Cannot detect OS. Proceeding with generic Linux installation..."
        os="linux"
    fi
    
    BINARY_NAME="glinrdockd-${os}-${arch}"
    log "Detected system: ${os} ${arch}"
}

# Get latest release version from GitHub
get_latest_version() {
    # Allow override via environment variable for development/testing
    if [[ -n "${GLINRDOCK_VERSION:-}" ]]; then
        VERSION="$GLINRDOCK_VERSION"
        log "Using specified version: $VERSION"
        return
    fi
    
    local api_response
    if command -v curl >/dev/null 2>&1; then
        api_response=$(curl -fsSL https://api.github.com/repos/GLINCKER/glinrdock/releases/latest 2>/dev/null || echo "")
    elif command -v wget >/dev/null 2>&1; then
        api_response=$(wget -qO- https://api.github.com/repos/GLINCKER/glinrdock/releases/latest 2>/dev/null || echo "")
    else
        error "Neither curl nor wget found. Please install one of them."
    fi
    
    if [[ -n "$api_response" ]]; then
        VERSION=$(echo "$api_response" | grep '"tag_name"' | cut -d'"' -f4 || echo "")
    else
        VERSION=""
    fi
    
    if [[ -z "$VERSION" ]]; then
        warn "No releases found on GitHub. Using development version..."
        VERSION="dev"
    fi
    
    # Remove 'v' prefix if present
    VERSION=${VERSION#v}
    log "Latest version: $VERSION"
}

# Check system requirements
check_requirements() {
    log "Checking system requirements..."
    
    # Check if systemd is available
    if [[ "$DRY_RUN" != "true" ]] && ! command -v systemctl >/dev/null 2>&1; then
        error "systemd is required but not found"
    fi
    
    # Check if Docker is installed
    if ! command -v docker >/dev/null 2>&1; then
        warn "Docker not found. GlinrDock requires Docker to manage containers."
        echo "Install Docker with: curl -fsSL https://get.docker.com | sh"
    else
        log "Docker found: $(docker --version)"
    fi
    
    # Check available disk space (need at least 100MB)
    local available_space
    available_space=$(df / | awk 'NR==2 {print $4}')
    if [[ $available_space -lt 102400 ]]; then
        error "Insufficient disk space. Need at least 100MB free."
    fi
}

# Create system user and group
create_user() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY RUN] Would create user $GLINRDOCK_USER:$GLINRDOCK_GROUP"
        return
    fi
    
    if ! id "$GLINRDOCK_USER" >/dev/null 2>&1; then
        log "Creating system user $GLINRDOCK_USER..."
        useradd --system --no-create-home --home-dir "$GLINRDOCK_HOME" --shell /bin/false "$GLINRDOCK_USER"
    else
        log "User $GLINRDOCK_USER already exists"
    fi
    
    # Add user to docker group if docker is installed
    if command -v docker >/dev/null 2>&1 && getent group docker >/dev/null; then
        usermod -aG docker "$GLINRDOCK_USER"
        log "Added $GLINRDOCK_USER to docker group"
    fi
}

# Create directories
create_directories() {
    local dirs=("$GLINRDOCK_HOME" "$GLINRDOCK_DATA_DIR" "$GLINRDOCK_LOG_DIR")
    
    for dir in "${dirs[@]}"; do
        if [[ "$DRY_RUN" == "true" ]]; then
            log "[DRY RUN] Would create directory $dir"
            continue
        fi
        
        if [[ ! -d "$dir" ]]; then
            log "Creating directory $dir..."
            mkdir -p "$dir"
        fi
        chown "$GLINRDOCK_USER:$GLINRDOCK_GROUP" "$dir"
        chmod 755 "$dir"
    done
}

# Download and install GlinrDock binary
install_binary() {
    local download_url="https://github.com/GLINCKER/glinrdock/releases/download/v${VERSION}/${BINARY_NAME}"
    local temp_file="/tmp/glinrdockd"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY RUN] Would download binary from $download_url"
        return
    fi
    
    # Handle development/testing case
    if [[ "$VERSION" == "dev" ]]; then
        if [[ -n "${GLINRDOCK_BINARY_PATH:-}" ]] && [[ -f "$GLINRDOCK_BINARY_PATH" ]]; then
            log "Using local binary from $GLINRDOCK_BINARY_PATH"
            cp "$GLINRDOCK_BINARY_PATH" "$GLINRDOCK_HOME/glinrdockd"
        else
            error "Development version specified but no binary found. Set GLINRDOCK_BINARY_PATH to a local binary file."
        fi
    else
        log "Downloading GlinrDock binary from $download_url..."
        
        if command -v curl >/dev/null 2>&1; then
            if ! curl -fsSL "$download_url" -o "$temp_file"; then
                error "Failed to download binary from $download_url"
            fi
        elif command -v wget >/dev/null 2>&1; then
            if ! wget -qO "$temp_file" "$download_url"; then
                error "Failed to download binary from $download_url"
            fi
        else
            error "Neither curl nor wget found"
        fi
        
        # Verify download
        if [[ ! -f "$temp_file" ]] || [[ ! -s "$temp_file" ]]; then
            error "Downloaded binary is empty or missing"
        fi
        
        # Move to final location
        mv "$temp_file" "$GLINRDOCK_HOME/glinrdockd"
    fi
    
    # Make executable and set ownership
    chmod +x "$GLINRDOCK_HOME/glinrdockd"
    chown "$GLINRDOCK_USER:$GLINRDOCK_GROUP" "$GLINRDOCK_HOME/glinrdockd"
    
    log "Binary installed to $GLINRDOCK_HOME/glinrdockd"
}

# Create systemd service file
create_systemd_service() {
    local service_file="/etc/systemd/system/glinrdockd.service"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY RUN] Would create systemd service at $service_file"
        return
    fi
    
    log "Creating systemd service..."
    
    cat > "$service_file" << EOF
[Unit]
Description=GlinrDock - Docker Container Management Platform
Documentation=https://github.com/GLINCKER/glinrdock
After=network.target docker.service
Requires=network.target
Wants=docker.service

[Service]
Type=simple
User=$GLINRDOCK_USER
Group=$GLINRDOCK_GROUP
ExecStart=$GLINRDOCK_HOME/glinrdockd
WorkingDirectory=$GLINRDOCK_HOME
Environment=GLINRDOCK_DATA_DIR=$GLINRDOCK_DATA_DIR
Environment=GLINRDOCK_HTTP_ADDR=:$GLINRDOCK_PORT
Environment=ADMIN_TOKEN=$ADMIN_TOKEN
Environment=GLINRDOCK_LOG_LEVEL=info
StandardOutput=journal
StandardError=journal
SyslogIdentifier=glinrdockd
Restart=always
RestartSec=10
KillMode=mixed
KillSignal=SIGTERM

# Security settings
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$GLINRDOCK_DATA_DIR $GLINRDOCK_LOG_DIR
PrivateTmp=true
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true

# Resource limits
LimitNOFILE=1048576
LimitNPROC=1048576

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable glinrdockd
    
    log "Systemd service created and enabled"
}

# Configure firewall (if ufw is installed)
configure_firewall() {
    if ! command -v ufw >/dev/null 2>&1; then
        log "ufw not found, skipping firewall configuration"
        return
    fi
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY RUN] Would configure firewall rules for port $GLINRDOCK_PORT"
        return
    fi
    
    log "Configuring firewall..."
    ufw allow "$GLINRDOCK_PORT/tcp" comment "GlinrDock HTTP"
    ufw allow 80/tcp comment "HTTP"
    ufw allow 443/tcp comment "HTTPS"
    ufw --force enable 2>/dev/null || true
    
    log "Firewall configured (allowed ports: $GLINRDOCK_PORT, 80, 443)"
}

# Start the service
start_service() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log "[DRY RUN] Would start glinrdockd service"
        return
    fi
    
    log "Starting GlinrDock service..."
    systemctl start glinrdockd
    
    # Wait for service to start
    sleep 5
    
    if systemctl is-active --quiet glinrdockd; then
        log "GlinrDock service started successfully"
    else
        error "Failed to start GlinrDock service. Check logs: journalctl -u glinrdockd"
    fi
}

# Display installation summary
show_summary() {
    echo
    echo -e "${GREEN}╭─────────────────────────────────────────────────╮${NC}"
    echo -e "${GREEN}│              GlinrDock Installed!               │${NC}"
    echo -e "${GREEN}╰─────────────────────────────────────────────────╯${NC}"
    echo
    echo -e "  ${BLUE}Version:${NC} $VERSION"
    echo -e "  ${BLUE}Install Path:${NC} $GLINRDOCK_HOME"
    echo -e "  ${BLUE}Data Directory:${NC} $GLINRDOCK_DATA_DIR"
    echo -e "  ${BLUE}Web Interface:${NC} http://localhost:$GLINRDOCK_PORT"
    echo -e "  ${BLUE}Admin Token:${NC} $ADMIN_TOKEN"
    echo
    echo -e "${YELLOW}Next Steps:${NC}"
    echo "  1. Access the web interface at http://localhost:$GLINRDOCK_PORT"
    echo "  2. Login with the admin token shown above"
    echo "  3. Create your first project and services"
    echo
    echo -e "${YELLOW}Useful Commands:${NC}"
    echo "  • View logs: journalctl -fu glinrdockd"
    echo "  • Restart:   sudo systemctl restart glinrdockd"
    echo "  • Stop:      sudo systemctl stop glinrdockd"
    echo "  • Status:    sudo systemctl status glinrdockd"
    echo
    echo -e "${YELLOW}Configuration:${NC}"
    echo "  • Service file: /etc/systemd/system/glinrdockd.service"
    echo "  • Data: $GLINRDOCK_DATA_DIR"
    echo "  • Logs: journalctl -u glinrdockd"
    echo
}

# Cleanup on error
cleanup() {
    if [[ -f /tmp/glinrdockd ]]; then
        rm -f /tmp/glinrdockd
    fi
}

# Main installation function
main() {
    echo -e "${BLUE}╭─────────────────────────────────────────────────╮${NC}"
    echo -e "${BLUE}│              GlinrDock Installer                │${NC}"
    echo -e "${BLUE}│     Docker Container Management Platform        │${NC}"
    echo -e "${BLUE}╰─────────────────────────────────────────────────╯${NC}"
    echo
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Run installation steps
    check_root
    detect_system
    get_latest_version
    check_requirements
    create_user
    create_directories
    install_binary
    create_systemd_service
    configure_firewall
    start_service
    show_summary
    
    # Save admin token for reference
    if [[ "$DRY_RUN" != "true" ]]; then
        echo "$ADMIN_TOKEN" > "$GLINRDOCK_HOME/.admin_token"
        chown "$GLINRDOCK_USER:$GLINRDOCK_GROUP" "$GLINRDOCK_HOME/.admin_token"
        chmod 600 "$GLINRDOCK_HOME/.admin_token"
    fi
    
    log "Installation completed successfully!"
}

# Help function
show_help() {
    cat << EOF
GlinrDock Installation Script

USAGE:
    $0 [OPTIONS]

OPTIONS:
    --help                  Show this help message
    --dry-run              Show what would be done without making changes
    --user USER            System user for GlinrDock (default: glinrdock)
    --home PATH            Installation directory (default: /opt/glinrdock)
    --data PATH            Data directory (default: /var/lib/glinrdock)
    --port PORT            HTTP port (default: 8080)
    --admin-token TOKEN    Admin token (default: randomly generated)

ENVIRONMENT VARIABLES:
    GLINRDOCK_USER         System user (default: glinrdock)
    GLINRDOCK_HOME         Install directory (default: /opt/glinrdock)
    GLINRDOCK_DATA_DIR     Data directory (default: /var/lib/glinrdock)
    GLINRDOCK_PORT         HTTP port (default: 8080)
    ADMIN_TOKEN            Admin authentication token
    DRY_RUN               Set to 'true' for dry run mode

EXAMPLES:
    # Standard installation
    sudo $0

    # Dry run to see what would happen
    DRY_RUN=true $0

    # Custom port and directory
    sudo GLINRDOCK_PORT=9080 GLINRDOCK_HOME=/usr/local/glinrdock $0

    # One-liner from GitHub
    curl -fsSL https://github.com/GLINCKER/glinrdock/releases/latest/download/install.sh | sudo bash
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --help|-h)
            show_help
            exit 0
            ;;
        --dry-run)
            DRY_RUN="true"
            shift
            ;;
        --user)
            GLINRDOCK_USER="$2"
            shift 2
            ;;
        --home)
            GLINRDOCK_HOME="$2"
            shift 2
            ;;
        --data)
            GLINRDOCK_DATA_DIR="$2"
            shift 2
            ;;
        --port)
            GLINRDOCK_PORT="$2"
            shift 2
            ;;
        --admin-token)
            ADMIN_TOKEN="$2"
            shift 2
            ;;
        *)
            error "Unknown option: $1. Use --help for usage information."
            ;;
    esac
done

# Run main installation
main