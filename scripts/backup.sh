#!/bin/bash

# GLINRDOCK Backup Script
# Comprehensive backup solution for production deployments
set -e

# Configuration
BACKUP_ROOT="/opt/backups"
GLINRDOCK_DIR="/opt/glinrdock"
MAX_BACKUPS=7  # Keep 7 days of backups
COMPRESS_LEVEL=6

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
    echo "GLINRDOCK Backup Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -d, --dir DIRECTORY     GLINRDOCK installation directory (default: /opt/glinrdock)"
    echo "  -o, --output DIRECTORY  Backup output directory (default: /opt/backups/glinrdock)"
    echo "  -k, --keep NUMBER       Number of backups to keep (default: 7)"
    echo "  -f, --full              Full backup including Docker images"
    echo "  -q, --quick             Quick backup (data only, no service restart)"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Standard backup"
    echo "  $0 --quick                          # Quick backup without restart"
    echo "  $0 --full --keep 14                # Full backup, keep 14 days"
    echo "  $0 -d /home/user/glinrdock         # Custom installation directory"
}

# Parse command line arguments
FULL_BACKUP=false
QUICK_BACKUP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--dir)
            GLINRDOCK_DIR="$2"
            shift 2
            ;;
        -o|--output)
            BACKUP_ROOT="$2"
            shift 2
            ;;
        -k|--keep)
            MAX_BACKUPS="$2"
            shift 2
            ;;
        -f|--full)
            FULL_BACKUP=true
            shift
            ;;
        -q|--quick)
            QUICK_BACKUP=true
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

# Validate directories
if [[ ! -d "$GLINRDOCK_DIR" ]]; then
    log_error "GLINRDOCK directory not found: $GLINRDOCK_DIR"
    exit 1
fi

if [[ ! -f "$GLINRDOCK_DIR/docker-compose.prod.yml" ]]; then
    log_error "docker-compose.prod.yml not found in $GLINRDOCK_DIR"
    log_error "Please ensure this is a valid GLINRDOCK installation directory"
    exit 1
fi

# Setup backup directories
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$BACKUP_ROOT/glinrdock"
CURRENT_BACKUP="$BACKUP_DIR/backup-$DATE"

sudo mkdir -p "$CURRENT_BACKUP"
sudo chown -R $USER:$USER "$BACKUP_DIR" 2>/dev/null || true

echo -e "${BLUE}"
cat << 'EOF'
  ____  _     ___ _   _ ____  ____   ___   ____ _  __
 / ___|| |   |_ _| \ | |  _ \|  _ \ / _ \ / ___| |/ /
| |  _ | |    | ||  \| | |_) | | | | | | | |   | ' / 
| |_| || |___ | || |\  |  _ <| |_| | |_| | |___| . \ 
 \____|_____|___|_| \_|_| \_\____/ \___/ \____|_|\_\
                                                     
              Backup & Recovery System
EOF
echo -e "${NC}"

log_info "Starting GLINRDOCK backup..."
log_info "Backup directory: $CURRENT_BACKUP"
log_info "Installation directory: $GLINRDOCK_DIR"

cd "$GLINRDOCK_DIR"

# Pre-backup checks
log_step "1. Pre-backup verification"

if ! command -v docker-compose &> /dev/null; then
    log_error "docker-compose not found"
    exit 1
fi

# Check if services are running
if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
    log_info "GLINRDOCK services are running"
    SERVICES_RUNNING=true
else
    log_warn "GLINRDOCK services are not running"
    SERVICES_RUNNING=false
fi

# Create backup metadata
log_step "2. Creating backup metadata"
cat > "$CURRENT_BACKUP/backup_info.json" << EOF
{
    "timestamp": "$(date -Iseconds)",
    "backup_type": "$([[ "$FULL_BACKUP" == true ]] && echo "full" || echo "standard")",
    "quick_backup": $QUICK_BACKUP,
    "glinrdock_dir": "$GLINRDOCK_DIR",
    "services_running": $SERVICES_RUNNING,
    "hostname": "$(hostname)",
    "version": "$(git rev-parse HEAD 2>/dev/null || echo "unknown")",
    "disk_usage": "$(du -sh . | cut -f1)"
}
EOF

log_info "Backup metadata created"

# Stop services for consistent backup (unless quick backup)
if [[ "$SERVICES_RUNNING" == true ]] && [[ "$QUICK_BACKUP" != true ]]; then
    log_step "3. Stopping services for consistent backup"
    docker-compose -f docker-compose.prod.yml down
    log_info "Services stopped"
else
    log_step "3. Skipping service shutdown (quick backup mode)"
fi

# Backup application data
log_step "4. Backing up application data"
if [[ -d "data" ]]; then
    log_info "Backing up data directory..."
    tar -czf "$CURRENT_BACKUP/data.tar.gz" -C . data/
    log_info "Data backup: $(du -sh "$CURRENT_BACKUP/data.tar.gz" | cut -f1)"
else
    log_warn "Data directory not found"
fi

# Backup SSL certificates
log_step "5. Backing up SSL certificates"
if [[ -d "certs" ]]; then
    log_info "Backing up SSL certificates..."
    tar -czf "$CURRENT_BACKUP/certs.tar.gz" -C . certs/
    log_info "Certificate backup: $(du -sh "$CURRENT_BACKUP/certs.tar.gz" | cut -f1)"
else
    log_warn "Certificates directory not found"
fi

# Backup nginx configuration
log_step "6. Backing up nginx configuration"
if [[ -d "nginx" ]]; then
    log_info "Backing up nginx configuration..."
    tar --exclude='nginx/logs/*' --exclude='nginx/cache/*' \
        -czf "$CURRENT_BACKUP/nginx.tar.gz" -C . nginx/
    log_info "Nginx backup: $(du -sh "$CURRENT_BACKUP/nginx.tar.gz" | cut -f1)"
else
    log_warn "Nginx directory not found"
fi

# Backup configuration files
log_step "7. Backing up configuration files"
log_info "Backing up configuration files..."
tar -czf "$CURRENT_BACKUP/config.tar.gz" \
    --exclude='*.log' --exclude='*.tmp' --exclude='node_modules' \
    --exclude='.git' --exclude='web/ui-lite/node_modules' \
    --exclude='web/ui-lite/dist' --exclude='bin/' \
    -C . \
    docker-compose.prod.yml \
    .env \
    scripts/ \
    $(find . -maxdepth 1 -name "*.md" -o -name "*.yml" -o -name "*.yaml" -o -name "*.json" | grep -v node_modules) \
    2>/dev/null || log_warn "Some config files may not exist"

log_info "Configuration backup: $(du -sh "$CURRENT_BACKUP/config.tar.gz" | cut -f1)"

# Backup database (if SQLite is in data directory)
log_step "8. Backing up database"
if [[ -f "data/glinrdock.db" ]]; then
    log_info "Creating database backup with consistency check..."
    sqlite3 data/glinrdock.db ".backup '$CURRENT_BACKUP/database.db'"
    
    # Verify database integrity
    if sqlite3 "$CURRENT_BACKUP/database.db" "PRAGMA integrity_check;" | grep -q "ok"; then
        log_info "Database backup verified: $(du -sh "$CURRENT_BACKUP/database.db" | cut -f1)"
    else
        log_error "Database backup verification failed"
    fi
else
    log_warn "SQLite database not found in data directory"
fi

# Full backup: include Docker images
if [[ "$FULL_BACKUP" == true ]]; then
    log_step "9. Creating full backup (Docker images)"
    log_info "Backing up Docker images..."
    
    # Save GLINRDOCK images
    IMAGES=$(docker-compose -f docker-compose.prod.yml config | grep 'image:' | awk '{print $2}' | sort -u)
    for image in $IMAGES; do
        if docker images | grep -q "$image"; then
            image_name=$(echo "$image" | tr '/' '_' | tr ':' '_')
            log_info "Saving image: $image"
            docker save "$image" | gzip > "$CURRENT_BACKUP/docker_image_${image_name}.tar.gz"
        fi
    done
    
    # Save custom built images
    docker images --format "table {{.Repository}}:{{.Tag}}" | grep glinrdock | while read image; do
        if [[ "$image" != "REPOSITORY:TAG" ]]; then
            image_name=$(echo "$image" | tr '/' '_' | tr ':' '_')
            log_info "Saving custom image: $image"
            docker save "$image" | gzip > "$CURRENT_BACKUP/docker_custom_${image_name}.tar.gz"
        fi
    done
else
    log_step "9. Skipping Docker images (use --full for complete backup)"
fi

# Restart services (unless quick backup)
if [[ "$SERVICES_RUNNING" == true ]] && [[ "$QUICK_BACKUP" != true ]]; then
    log_step "10. Restarting services"
    docker-compose -f docker-compose.prod.yml up -d
    
    # Wait for services to be healthy
    sleep 10
    if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        log_info "Services restarted successfully"
    else
        log_error "Services failed to restart properly"
        log_error "Check logs: docker-compose -f docker-compose.prod.yml logs"
    fi
else
    log_step "10. Services not restarted (quick backup or services were not running)"
fi

# Create backup summary
log_step "11. Creating backup summary"
BACKUP_SIZE=$(du -sh "$CURRENT_BACKUP" | cut -f1)
cat > "$CURRENT_BACKUP/backup_summary.txt" << EOF
GLINRDOCK Backup Summary
========================
Date: $(date)
Backup Type: $([[ "$FULL_BACKUP" == true ]] && echo "Full" || echo "Standard")
Total Size: $BACKUP_SIZE
Location: $CURRENT_BACKUP

Files Included:
- Application data (data/)
- SSL certificates (certs/)
- Nginx configuration (nginx/)
- Application configuration (docker-compose.prod.yml, .env, scripts/)
- Database (SQLite)
$([[ "$FULL_BACKUP" == true ]] && echo "- Docker images" || echo "")

Restoration Command:
./scripts/restore.sh $CURRENT_BACKUP

Notes:
- Backup created with services $([[ "$SERVICES_RUNNING" == true ]] && [[ "$QUICK_BACKUP" != true ]] && echo "stopped for consistency" || echo "running (quick backup)")
- Verify backup integrity before relying on it
- Store backups in a secure, off-site location
EOF

log_info "Backup summary created"

# Cleanup old backups
log_step "12. Cleaning up old backups"
if [[ -d "$BACKUP_DIR" ]]; then
    OLD_BACKUPS=$(find "$BACKUP_DIR" -name "backup-*" -type d | sort -r | tail -n +$((MAX_BACKUPS + 1)))
    if [[ -n "$OLD_BACKUPS" ]]; then
        echo "$OLD_BACKUPS" | while read old_backup; do
            log_info "Removing old backup: $(basename "$old_backup")"
            rm -rf "$old_backup"
        done
    else
        log_info "No old backups to clean up"
    fi
fi

# Create latest symlink
log_step "13. Creating convenience symlink"
ln -sfn "$CURRENT_BACKUP" "$BACKUP_DIR/latest"

# Final verification
log_step "14. Backup verification"
if [[ -f "$CURRENT_BACKUP/data.tar.gz" ]] && [[ -f "$CURRENT_BACKUP/config.tar.gz" ]]; then
    log_info "✅ Backup completed successfully"
    log_info "✅ Backup size: $BACKUP_SIZE"
    log_info "✅ Location: $CURRENT_BACKUP"
    
    echo ""
    log_info "Backup contents:"
    ls -la "$CURRENT_BACKUP"
    
    echo ""
    log_info "To restore this backup:"
    echo "  ./scripts/restore.sh $CURRENT_BACKUP"
    
    echo ""
    log_info "To test backup integrity:"
    echo "  tar -tzf $CURRENT_BACKUP/data.tar.gz > /dev/null && echo 'Data backup OK'"
    echo "  tar -tzf $CURRENT_BACKUP/config.tar.gz > /dev/null && echo 'Config backup OK'"
    
else
    log_error "❌ Backup verification failed"
    log_error "Some critical files may be missing"
    exit 1
fi

# Show disk usage
echo ""
log_info "Disk usage summary:"
echo "  Current backup: $BACKUP_SIZE"
echo "  All backups: $(du -sh "$BACKUP_DIR" | cut -f1)"
echo "  Available space: $(df -h "$BACKUP_ROOT" | awk 'NR==2 {print $4}')"

log_info "🎉 GLINRDOCK backup completed successfully!"