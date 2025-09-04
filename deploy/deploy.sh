#!/bin/bash
set -euo pipefail

# GlinrDock Docker Compose Deployment Script
# This script helps deploy GlinrDock using Docker Compose with various profiles

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.yml"
ENV_FILE="$SCRIPT_DIR/.env"
ENV_EXAMPLE="$SCRIPT_DIR/.env.example"

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

# Show help
show_help() {
    cat << EOF
GlinrDock Docker Compose Deployment Script

USAGE:
    $0 [COMMAND] [OPTIONS]

COMMANDS:
    deploy              Deploy GlinrDock (default)
    start               Start services
    stop                Stop services
    restart             Restart services
    down                Stop and remove containers
    logs                Show logs
    status              Show service status
    update              Pull latest images and restart
    backup              Backup data directory
    restore [BACKUP]    Restore from backup
    shell               Open shell in GlinrDock container
    help                Show this help

OPTIONS:
    --profile PROFILE   Additional profile(s) to include
                        Available: postgres, redis, monitoring, logging
                        Can be specified multiple times
    --env FILE          Use specific .env file
    --force             Skip confirmation prompts
    --pull              Pull latest images before deploy

PROFILES:
    default             GlinrDock with SQLite and Caddy
    postgres            Add PostgreSQL database
    redis               Add Redis cache
    monitoring          Add Prometheus and Grafana
    logging             Add Loki log aggregation

EXAMPLES:
    # Basic deployment
    $0 deploy

    # Deploy with PostgreSQL and monitoring
    $0 deploy --profile postgres --profile monitoring

    # Deploy with all optional services
    $0 deploy --profile postgres --profile redis --profile monitoring --profile logging

    # Update to latest version
    $0 update --pull

    # View logs
    $0 logs --follow

    # Backup data
    $0 backup
EOF
}

# Check dependencies
check_dependencies() {
    if ! command -v docker >/dev/null 2>&1; then
        error "Docker is required but not installed"
    fi
    
    if ! command -v docker-compose >/dev/null 2>&1 && ! docker compose version >/dev/null 2>&1; then
        error "Docker Compose is required but not installed"
    fi
}

# Get docker compose command (handle both docker-compose and docker compose)
get_compose_cmd() {
    if command -v docker-compose >/dev/null 2>&1; then
        echo "docker-compose"
    else
        echo "docker compose"
    fi
}

# Setup environment file
setup_env() {
    if [[ ! -f "$ENV_FILE" ]]; then
        if [[ -f "$ENV_EXAMPLE" ]]; then
            log "Creating .env file from example..."
            cp "$ENV_EXAMPLE" "$ENV_FILE"
            warn "Please edit $ENV_FILE with your configuration before deploying"
            
            # Generate secure admin token if not set
            if grep -q "your-super-secure-admin-token-change-this" "$ENV_FILE"; then
                local admin_token
                admin_token=$(openssl rand -hex 32 2>/dev/null || dd if=/dev/urandom bs=32 count=1 2>/dev/null | xxd -p -c 64)
                sed -i.bak "s/your-super-secure-admin-token-change-this/$admin_token/" "$ENV_FILE"
                rm -f "$ENV_FILE.bak"
                log "Generated secure admin token"
            fi
            
            echo "Please review and edit $ENV_FILE before continuing."
            read -p "Press Enter to continue or Ctrl+C to exit..."
        else
            error ".env file not found and no example available"
        fi
    fi
}

# Create data directory
create_data_dir() {
    local data_dir
    data_dir=$(grep "^DATA_DIR=" "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "./data")
    
    if [[ ! -d "$data_dir" ]]; then
        log "Creating data directory: $data_dir"
        mkdir -p "$data_dir"
    fi
}

# Deploy services
deploy() {
    local profiles=()
    local force=false
    local pull=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --profile)
                profiles+=("$2")
                shift 2
                ;;
            --force)
                force=true
                shift
                ;;
            --pull)
                pull=true
                shift
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done
    
    check_dependencies
    setup_env
    create_data_dir
    
    local compose_cmd
    compose_cmd=$(get_compose_cmd)
    
    local profile_args=""
    for profile in "${profiles[@]}"; do
        profile_args+="--profile $profile "
    done
    
    if [[ "$pull" == true ]]; then
        log "Pulling latest images..."
        eval "$compose_cmd -f $COMPOSE_FILE --env-file $ENV_FILE $profile_args pull"
    fi
    
    if [[ "$force" == false ]]; then
        echo
        echo -e "${BLUE}Deployment Configuration:${NC}"
        echo "  Compose file: $COMPOSE_FILE"
        echo "  Environment:  $ENV_FILE"
        echo "  Profiles:     ${profiles[*]:-default}"
        echo
        read -p "Continue with deployment? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log "Deployment cancelled"
            exit 0
        fi
    fi
    
    log "Deploying GlinrDock..."
    eval "$compose_cmd -f $COMPOSE_FILE --env-file $ENV_FILE $profile_args up -d"
    
    log "Deployment completed!"
    
    # Show useful info
    local domain
    domain=$(grep "^DOMAIN=" "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "localhost")
    
    echo
    echo -e "${GREEN}╭─────────────────────────────────────────────────╮${NC}"
    echo -e "${GREEN}│              GlinrDock Deployed!                │${NC}"
    echo -e "${GREEN}╰─────────────────────────────────────────────────╯${NC}"
    echo
    echo -e "  ${BLUE}Web Interface:${NC} https://$domain"
    echo -e "  ${BLUE}Health Check:${NC}  https://$domain/health"
    if [[ " ${profiles[*]} " =~ " monitoring " ]]; then
        echo -e "  ${BLUE}Grafana:${NC}       https://$domain/grafana"
        echo -e "  ${BLUE}Prometheus:${NC}    https://$domain/prometheus"
    fi
    echo
}

# Show logs
show_logs() {
    local compose_cmd
    compose_cmd=$(get_compose_cmd)
    
    local args=""
    if [[ "${1:-}" == "--follow" ]] || [[ "${1:-}" == "-f" ]]; then
        args="--follow"
    fi
    
    eval "$compose_cmd -f $COMPOSE_FILE --env-file $ENV_FILE logs $args"
}

# Update deployment
update() {
    local pull=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --pull)
                pull=true
                shift
                ;;
            *)
                error "Unknown option: $1"
                ;;
        esac
    done
    
    local compose_cmd
    compose_cmd=$(get_compose_cmd)
    
    if [[ "$pull" == true ]]; then
        log "Pulling latest images..."
        eval "$compose_cmd -f $COMPOSE_FILE --env-file $ENV_FILE pull"
    fi
    
    log "Updating deployment..."
    eval "$compose_cmd -f $COMPOSE_FILE --env-file $ENV_FILE up -d"
    
    log "Update completed!"
}

# Backup data
backup() {
    local data_dir
    data_dir=$(grep "^DATA_DIR=" "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "./data")
    
    local backup_name="glinrdock-backup-$(date +%Y%m%d-%H%M%S)"
    local backup_path="$backup_name.tar.gz"
    
    log "Creating backup: $backup_path"
    tar -czf "$backup_path" -C "$(dirname "$data_dir")" "$(basename "$data_dir")"
    
    log "Backup created: $backup_path"
}

# Restore from backup
restore() {
    local backup_file="${1:-}"
    
    if [[ -z "$backup_file" ]]; then
        error "Backup file required. Usage: $0 restore <backup-file>"
    fi
    
    if [[ ! -f "$backup_file" ]]; then
        error "Backup file not found: $backup_file"
    fi
    
    local data_dir
    data_dir=$(grep "^DATA_DIR=" "$ENV_FILE" 2>/dev/null | cut -d= -f2 || echo "./data")
    
    warn "This will overwrite existing data in $data_dir"
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Restore cancelled"
        exit 0
    fi
    
    log "Restoring from backup: $backup_file"
    tar -xzf "$backup_file" -C "$(dirname "$data_dir")"
    
    log "Restore completed!"
}

# Open shell in container
open_shell() {
    local compose_cmd
    compose_cmd=$(get_compose_cmd)
    
    eval "$compose_cmd -f $COMPOSE_FILE --env-file $ENV_FILE exec glinrdock sh"
}

# Show status
show_status() {
    local compose_cmd
    compose_cmd=$(get_compose_cmd)
    
    eval "$compose_cmd -f $COMPOSE_FILE --env-file $ENV_FILE ps"
}

# Main script logic
main() {
    local command="${1:-deploy}"
    shift || true
    
    case "$command" in
        deploy)
            deploy "$@"
            ;;
        start)
            $(get_compose_cmd) -f "$COMPOSE_FILE" --env-file "$ENV_FILE" start
            ;;
        stop)
            $(get_compose_cmd) -f "$COMPOSE_FILE" --env-file "$ENV_FILE" stop
            ;;
        restart)
            $(get_compose_cmd) -f "$COMPOSE_FILE" --env-file "$ENV_FILE" restart
            ;;
        down)
            $(get_compose_cmd) -f "$COMPOSE_FILE" --env-file "$ENV_FILE" down
            ;;
        logs)
            show_logs "$@"
            ;;
        status)
            show_status
            ;;
        update)
            update "$@"
            ;;
        backup)
            backup
            ;;
        restore)
            restore "$@"
            ;;
        shell)
            open_shell
            ;;
        help|--help|-h)
            show_help
            ;;
        *)
            error "Unknown command: $command. Use 'help' for usage information."
            ;;
    esac
}

# Run main function
main "$@"