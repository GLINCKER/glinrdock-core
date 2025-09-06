#!/bin/bash

# GLINRDOCK Restore Script
# Restore from backup created by backup.sh
set -e

# Configuration
GLINRDOCK_DIR="/opt/glinrdock"
BACKUP_DIR=""
FORCE_RESTORE=false

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

usage() {
    echo "GLINRDOCK Restore Script"
    echo ""
    echo "Usage: $0 BACKUP_DIRECTORY [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -d, --dir DIRECTORY     GLINRDOCK installation directory (default: /opt/glinrdock)"
    echo "  -f, --force            Force restore without confirmation"
    echo "  -h, --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 /opt/backups/glinrdock/backup-20240127_143022"
    echo "  $0 /opt/backups/glinrdock/latest"
    echo "  $0 /path/to/backup --force"
}

# Parse command line arguments
BACKUP_DIR="$1"
shift || true

while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--dir)
            GLINRDOCK_DIR="$2"
            shift 2
            ;;
        -f|--force)
            FORCE_RESTORE=true
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

# Validate arguments
if [[ -z "$BACKUP_DIR" ]]; then
    log_error "Backup directory is required"
    usage
    exit 1
fi

if [[ ! -d "$BACKUP_DIR" ]]; then
    log_error "Backup directory not found: $BACKUP_DIR"
    exit 1
fi

if [[ ! -f "$BACKUP_DIR/backup_info.json" ]]; then
    log_error "Invalid backup directory: backup_info.json not found"
    log_error "Please ensure this is a valid GLINRDOCK backup"
    exit 1
fi

echo -e "${BLUE}"
cat << 'EOF'
  ____  _     ___ _   _ ____  ____   ___   ____ _  __
 / ___|| |   |_ _| \ | |  _ \|  _ \ / _ \ / ___| |/ /
| |  _ | |    | ||  \| | |_) | | | | | | | |   | ' / 
| |_| || |___ | || |\  |  _ <| |_| | |_| | |___| . \ 
 \____|_____|___|_| \_|_| \_\____/ \___/ \____|_|\_\
                                                     
              Backup Restore System
EOF
echo -e "${NC}"

log_info "Starting GLINRDOCK restore process..."
log_info "Backup source: $BACKUP_DIR"
log_info "Restore target: $GLINRDOCK_DIR"

# Read backup metadata
if command -v jq &> /dev/null; then
    BACKUP_TIMESTAMP=$(jq -r '.timestamp' "$BACKUP_DIR/backup_info.json")
    BACKUP_TYPE=$(jq -r '.backup_type' "$BACKUP_DIR/backup_info.json")
    ORIGINAL_DIR=$(jq -r '.glinrdock_dir' "$BACKUP_DIR/backup_info.json")
    
    log_info "Backup information:"
    log_info "  Created: $BACKUP_TIMESTAMP"
    log_info "  Type: $BACKUP_TYPE"
    log_info "  Original directory: $ORIGINAL_DIR"
else
    log_warn "jq not available, skipping detailed backup info"
fi

# Show backup contents
log_step "Backup contents verification"
log_info "Available backup files:"
ls -la "$BACKUP_DIR" | grep -E '\.(tar\.gz|db)$' | while read line; do
    echo "  • $(echo "$line" | awk '{print $9, "(" $5 " bytes)"}')"
done

# Confirmation prompt
if [[ "$FORCE_RESTORE" != true ]]; then
    echo ""
    log_warn "⚠️  WARNING: This will replace your current GLINRDOCK installation!"
    log_warn "   Current data and configuration will be backed up first."
    echo ""
    echo -n "Continue with restore? (yes/no): "
    read -r CONFIRM
    if [[ "$CONFIRM" != "yes" ]]; then
        log_info "Restore cancelled by user"
        exit 0
    fi
fi

# Pre-restore backup of current installation
log_step "1. Creating pre-restore backup"
if [[ -d "$GLINRDOCK_DIR" ]]; then
    PRE_RESTORE_BACKUP="$GLINRDOCK_DIR/../glinrdock-pre-restore-$(date +%Y%m%d_%H%M%S)"
    log_info "Backing up current installation to: $PRE_RESTORE_BACKUP"
    
    sudo cp -r "$GLINRDOCK_DIR" "$PRE_RESTORE_BACKUP" 2>/dev/null || \
        cp -r "$GLINRDOCK_DIR" "$PRE_RESTORE_BACKUP"
    
    log_info "Pre-restore backup created successfully"
else
    log_info "No existing installation found, skipping pre-restore backup"
fi

# Stop services
log_step "2. Stopping GLINRDOCK services"
if [[ -f "$GLINRDOCK_DIR/docker-compose.prod.yml" ]]; then
    cd "$GLINRDOCK_DIR"
    if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        log_info "Stopping services..."
        docker-compose -f docker-compose.prod.yml down
        log_info "Services stopped"
    else
        log_info "Services were not running"
    fi
else
    log_warn "docker-compose.prod.yml not found, skipping service shutdown"
fi

# Create installation directory if needed
sudo mkdir -p "$GLINRDOCK_DIR"
sudo chown -R $USER:$USER "$GLINRDOCK_DIR" 2>/dev/null || true

# Restore configuration files
log_step "3. Restoring configuration files"
if [[ -f "$BACKUP_DIR/config.tar.gz" ]]; then
    log_info "Extracting configuration files..."
    tar -xzf "$BACKUP_DIR/config.tar.gz" -C "$GLINRDOCK_DIR"
    log_info "Configuration files restored"
else
    log_error "Configuration backup not found"
    exit 1
fi

# Restore application data
log_step "4. Restoring application data"
if [[ -f "$BACKUP_DIR/data.tar.gz" ]]; then
    log_info "Extracting application data..."
    tar -xzf "$BACKUP_DIR/data.tar.gz" -C "$GLINRDOCK_DIR"
    log_info "Application data restored"
else
    log_warn "Data backup not found, skipping"
fi

# Restore database
log_step "5. Restoring database"
if [[ -f "$BACKUP_DIR/database.db" ]]; then
    log_info "Restoring SQLite database..."
    mkdir -p "$GLINRDOCK_DIR/data"
    cp "$BACKUP_DIR/database.db" "$GLINRDOCK_DIR/data/glinrdock.db"
    
    # Verify database integrity
    if sqlite3 "$GLINRDOCK_DIR/data/glinrdock.db" "PRAGMA integrity_check;" | grep -q "ok"; then
        log_info "Database restored and verified"
    else
        log_error "Database integrity check failed after restore"
    fi
else
    log_warn "Database backup not found, skipping"
fi

# Restore SSL certificates
log_step "6. Restoring SSL certificates"
if [[ -f "$BACKUP_DIR/certs.tar.gz" ]]; then
    log_info "Extracting SSL certificates..."
    tar -xzf "$BACKUP_DIR/certs.tar.gz" -C "$GLINRDOCK_DIR"
    
    # Set correct permissions for certificates
    if [[ -d "$GLINRDOCK_DIR/certs" ]]; then
        find "$GLINRDOCK_DIR/certs" -name "*.pem" -exec chmod 644 {} \;
        find "$GLINRDOCK_DIR/certs" -name "privkey.pem" -exec chmod 600 {} \;
    fi
    
    log_info "SSL certificates restored"
else
    log_warn "SSL certificates backup not found, skipping"
fi

# Restore nginx configuration
log_step "7. Restoring nginx configuration"
if [[ -f "$BACKUP_DIR/nginx.tar.gz" ]]; then
    log_info "Extracting nginx configuration..."
    tar -xzf "$BACKUP_DIR/nginx.tar.gz" -C "$GLINRDOCK_DIR"
    
    # Create directories for nginx logs and cache
    mkdir -p "$GLINRDOCK_DIR/nginx/logs" "$GLINRDOCK_DIR/nginx/cache"
    
    log_info "Nginx configuration restored"
else
    log_warn "Nginx configuration backup not found, skipping"
fi

# Restore Docker images (if available)
log_step "8. Restoring Docker images"
DOCKER_IMAGES=$(find "$BACKUP_DIR" -name "docker_*.tar.gz" 2>/dev/null || true)
if [[ -n "$DOCKER_IMAGES" ]]; then
    log_info "Found Docker image backups, loading..."
    echo "$DOCKER_IMAGES" | while read image_backup; do
        log_info "Loading: $(basename "$image_backup")"
        docker load < "$image_backup"
    done
    log_info "Docker images restored"
else
    log_warn "Docker image backups not found, skipping"
fi

# Set correct permissions
log_step "9. Setting permissions"
cd "$GLINRDOCK_DIR"

# Ensure correct ownership
sudo chown -R $USER:$USER . 2>/dev/null || chown -R $USER:$USER .

# Make scripts executable
find scripts/ -name "*.sh" -exec chmod +x {} \; 2>/dev/null || true

# Set secure permissions for sensitive files
chmod 600 .env 2>/dev/null || true
chmod 600 .admin-token 2>/dev/null || true

log_info "Permissions set correctly"

# Verify configuration
log_step "10. Verifying configuration"
if [[ -f "docker-compose.prod.yml" ]] && [[ -f ".env" ]]; then
    # Test docker-compose configuration
    if docker-compose -f docker-compose.prod.yml config > /dev/null 2>&1; then
        log_info "✅ Docker Compose configuration is valid"
    else
        log_error "❌ Docker Compose configuration validation failed"
        log_error "Check docker-compose.prod.yml and .env files"
    fi
else
    log_error "Critical configuration files missing"
    exit 1
fi

# Start services
log_step "11. Starting GLINRDOCK services"
log_info "Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to start
log_info "Waiting for services to initialize..."
sleep 15

# Check service health
if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    log_info "✅ Services started successfully"
    
    # Show service status
    echo ""
    log_info "Service status:"
    docker-compose -f docker-compose.prod.yml ps
    
else
    log_error "❌ Some services failed to start"
    log_error "Check logs: docker-compose -f docker-compose.prod.yml logs"
fi

# Final verification
log_step "12. Final verification"

# Check if admin token exists
if [[ -f ".admin-token" ]]; then
    ADMIN_TOKEN=$(cat .admin-token)
    log_info "Admin token restored: ${ADMIN_TOKEN:0:8}..."
elif grep -q "ADMIN_TOKEN" .env; then
    log_info "Admin token found in .env file"
else
    log_warn "Admin token not found - you may need to set it manually"
fi

# Test API connectivity (if services are running)
sleep 5
if curl -s -f http://localhost:8080/v1/health > /dev/null 2>&1; then
    log_info "✅ GLINRDOCK API is responding"
else
    log_warn "⚠️  GLINRDOCK API not yet available (may still be starting)"
fi

# Create restore report
cat > "restore_report.txt" << EOF
GLINRDOCK Restore Report
========================
Restore Date: $(date)
Backup Source: $BACKUP_DIR
Restore Target: $GLINRDOCK_DIR
$(test -n "$BACKUP_TIMESTAMP" && echo "Backup Created: $BACKUP_TIMESTAMP")
$(test -n "$BACKUP_TYPE" && echo "Backup Type: $BACKUP_TYPE")

Restored Components:
- Configuration files: ✓
- Application data: $(test -f "$BACKUP_DIR/data.tar.gz" && echo "✓" || echo "⚠")
- Database: $(test -f "$BACKUP_DIR/database.db" && echo "✓" || echo "⚠")
- SSL certificates: $(test -f "$BACKUP_DIR/certs.tar.gz" && echo "✓" || echo "⚠")
- Nginx configuration: $(test -f "$BACKUP_DIR/nginx.tar.gz" && echo "✓" || echo "⚠")
- Docker images: $(test -n "$DOCKER_IMAGES" && echo "✓" || echo "⚠")

Pre-restore Backup: $(test -n "$PRE_RESTORE_BACKUP" && echo "$PRE_RESTORE_BACKUP" || echo "N/A")

Next Steps:
1. Verify your domain still points to this server
2. Check SSL certificate status: ./scripts/test-ssl-renewal.sh
3. Test application functionality
4. Remove pre-restore backup when confirmed working
EOF

echo ""
log_info "🎉 GLINRDOCK restore completed!"
log_info ""
log_info "Summary:"
log_info "  ✅ Configuration restored"
log_info "  ✅ Services restarted"
log_info "  ✅ Restore report created: restore_report.txt"

if [[ -n "$PRE_RESTORE_BACKUP" ]]; then
    log_info "  📁 Pre-restore backup: $PRE_RESTORE_BACKUP"
    log_info "     (Remove when restore is confirmed working)"
fi

echo ""
log_info "Next steps:"
echo "  1. Test your application: https://your-domain.com"
echo "  2. Check logs: docker-compose -f docker-compose.prod.yml logs"
echo "  3. Verify SSL: ./scripts/test-ssl-renewal.sh"
echo "  4. Monitor services: docker-compose -f docker-compose.prod.yml ps"

log_info "Restore process completed successfully! 🚀"