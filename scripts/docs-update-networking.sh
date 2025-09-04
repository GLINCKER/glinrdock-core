#!/bin/bash
set -e

# GLINRDOCK Networking Architecture Documentation Update Script
# Updates the implementation checklist in NETWORKING_ARCHITECTURE_ANALYSIS.md

DOCS_FILE="docs/plans/NETWORKING_ARCHITECTURE_ANALYSIS.md"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$ROOT_DIR"

# Check if the documentation file exists
if [[ ! -f "$DOCS_FILE" ]]; then
    echo "❌ Error: $DOCS_FILE not found"
    exit 1
fi

# Function to display usage
usage() {
    cat << EOF
Usage: $0 [OPTION] ITEM

Update implementation checklist items in the networking architecture documentation.

OPTIONS:
    -c, --check ITEM     Mark item as completed [x]
    -u, --uncheck ITEM   Mark item as incomplete [ ]
    -l, --list          List all available checklist items
    -h, --help          Show this help message

ITEMS:
    migrations          Database schema for certificates and nginx configs
    store              Certificate and nginx configuration storage layer
    generator          Nginx configuration template generation system
    manager            Nginx lifecycle and reconciliation management
    api                Certificate and nginx management API endpoints
    ui-routes          Route creation and management interface
    ui-certs           Certificate management interface
    reconcile          Automatic nginx configuration reconciliation
    help               Documentation and user guidance
    tests              Integration tests for nginx proxy functionality

EXAMPLES:
    $0 --check migrations     Mark migrations as completed
    $0 --uncheck api          Mark API as incomplete
    $0 --list                List all checklist items

EOF
}

# Function to list all checklist items
list_items() {
    echo "📋 Available checklist items:"
    echo ""
    grep -E "^- \[.\] \*\*.*\*\*:" "$DOCS_FILE" | sed 's/^- \[.\] \*\*\(.*\)\*\*:.*/  \1/' | while read item; do
        # Convert display name to script name
        case "$item" in
            "Migrations") echo "  migrations          - $item" ;;
            "Store") echo "  store               - $item" ;;
            "Generator") echo "  generator           - $item" ;;
            "Manager") echo "  manager             - $item" ;;
            "API") echo "  api                 - $item" ;;
            "UI Routes") echo "  ui-routes           - $item" ;;
            "UI Certs") echo "  ui-certs            - $item" ;;
            "Reconcile") echo "  reconcile           - $item" ;;
            "Help page") echo "  help                - $item" ;;
            "Tests") echo "  tests               - $item" ;;
        esac
    done
    echo ""
    echo "Use these names with --check or --uncheck options."
}

# Function to update checklist item
update_item() {
    local action="$1"
    local item="$2"
    local checkbox=""
    local item_pattern=""
    
    # Set checkbox based on action
    if [[ "$action" == "check" ]]; then
        checkbox="[x]"
    elif [[ "$action" == "uncheck" ]]; then
        checkbox="[ ]"
    else
        echo "❌ Error: Invalid action '$action'"
        exit 1
    fi
    
    # Map script names to document patterns
    case "$item" in
        "migrations")
            item_pattern="Migrations"
            ;;
        "store")
            item_pattern="Store"
            ;;
        "generator")
            item_pattern="Generator"
            ;;
        "manager")
            item_pattern="Manager"
            ;;
        "api")
            item_pattern="API"
            ;;
        "ui-routes")
            item_pattern="UI Routes"
            ;;
        "ui-certs")
            item_pattern="UI Certs"
            ;;
        "reconcile")
            item_pattern="Reconcile"
            ;;
        "help")
            item_pattern="Help page"
            ;;
        "tests")
            item_pattern="Tests"
            ;;
        *)
            echo "❌ Error: Unknown item '$item'"
            echo "Use --list to see available items"
            exit 1
            ;;
    esac
    
    # Create backup
    cp "$DOCS_FILE" "${DOCS_FILE}.backup"
    
    # Update the checklist item using sed
    if sed -i.tmp "s/^- \[.\] \*\*${item_pattern}\*\*:/- ${checkbox} **${item_pattern}**:/" "$DOCS_FILE"; then
        rm "${DOCS_FILE}.tmp" 2>/dev/null || true
        
        # Verify the change was made
        if grep -q "^- ${checkbox} \*\*${item_pattern}\*\*:" "$DOCS_FILE"; then
            if [[ "$action" == "check" ]]; then
                echo "✅ Marked '${item_pattern}' as completed"
            else
                echo "⏹️  Marked '${item_pattern}' as incomplete"
            fi
        else
            echo "⚠️  Warning: Item '${item_pattern}' may not have been updated"
            echo "Check the file manually: $DOCS_FILE"
        fi
    else
        echo "❌ Error: Failed to update '$item'"
        # Restore from backup
        mv "${DOCS_FILE}.backup" "$DOCS_FILE"
        exit 1
    fi
    
    # Remove backup
    rm "${DOCS_FILE}.backup" 2>/dev/null || true
    
    echo "📄 Updated: $DOCS_FILE"
}

# Parse command line arguments
if [[ $# -eq 0 ]]; then
    usage
    exit 1
fi

case "$1" in
    -c|--check)
        if [[ -z "$2" ]]; then
            echo "❌ Error: Item name required"
            usage
            exit 1
        fi
        update_item "check" "$2"
        ;;
    -u|--uncheck)
        if [[ -z "$2" ]]; then
            echo "❌ Error: Item name required"
            usage
            exit 1
        fi
        update_item "uncheck" "$2"
        ;;
    -l|--list)
        list_items
        ;;
    -h|--help)
        usage
        ;;
    *)
        echo "❌ Error: Unknown option '$1'"
        usage
        exit 1
        ;;
esac