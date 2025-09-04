#!/bin/sh
set -e

# GlinrDock Public Release Publisher
# Copies staged artifacts to public repo and optionally creates PR
#
# Copyright (c) 2025 GLINCKER LLC
# Licensed under MIT License

# Configuration
PRIVATE_REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_REPO_ROOT="$(cd "$PRIVATE_REPO_ROOT/../glinrdock-release" && pwd)"
STAGING_DIR="_staging"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Logging functions
log() {
    printf "${GREEN}[INFO]${NC} %s\n" "$1"
}

warn() {
    printf "${YELLOW}[WARN]${NC} %s\n" "$1" >&2
}

error() {
    printf "${RED}[ERROR]${NC} %s\n" "$1" >&2
    exit 1
}

debug() {
    if [ "${DEBUG:-}" = "1" ]; then
        printf "${BLUE}[DEBUG]${NC} %s\n" "$1" >&2
    fi
}

# Print usage
usage() {
    cat << EOF
GlinrDock Public Release Publisher

USAGE:
    $0 VERSION [OPTIONS]

ARGUMENTS:
    VERSION         Version to publish (required, e.g. v1.0.0)

OPTIONS:
    --open-pr       Create PR in public repo to update documentation
    --branch NAME   Custom branch name for PR (default: release/VERSION)
    --help          Show this help message

ENVIRONMENT VARIABLES:
    GH_TOKEN        GitHub token for PR creation (required for --open-pr)
    DEBUG           Enable debug output (set to 1)

EXAMPLES:
    # Copy staged artifacts only
    $0 v1.0.0
    
    # Copy artifacts and create PR  
    GH_TOKEN=ghp_xxx $0 v1.0.0 --open-pr
    
    # Use custom branch name
    GH_TOKEN=ghp_xxx $0 v1.0.0 --open-pr --branch hotfix/v1.0.1

WORKFLOW:
    1. Verify _staging/VERSION exists in private repo
    2. Copy to ../glinrdock-release/_staging/VERSION
    3. If --open-pr: create branch and update docs/QUICKSTART.md
    4. If --open-pr: open PR with standard description

EOF
}

# Parse arguments
parse_args() {
    VERSION=""
    OPEN_PR=0
    BRANCH_NAME=""
    
    while [ $# -gt 0 ]; do
        case "$1" in
            --open-pr)
                OPEN_PR=1
                shift
                ;;
            --branch)
                if [ $# -lt 2 ]; then
                    error "Option --branch requires an argument"
                fi
                BRANCH_NAME="$2"
                shift 2
                ;;
            --help|-h)
                usage
                exit 0
                ;;
            -*)
                error "Unknown option: $1"
                ;;
            *)
                if [ -z "$VERSION" ]; then
                    VERSION="$1"
                else
                    error "Multiple versions specified. Use --help for usage."
                fi
                shift
                ;;
        esac
    done
    
    if [ -z "$VERSION" ]; then
        error "VERSION argument is required. Use --help for usage."
    fi
    
    # Validate version format
    case "$VERSION" in
        v[0-9]*) ;;
        *) error "VERSION must start with 'v' (e.g. v1.0.0)";;
    esac
    
    # Set default branch name
    if [ -z "$BRANCH_NAME" ]; then
        BRANCH_NAME="release/$VERSION"
    fi
    
    debug "Parsed arguments: VERSION=$VERSION, OPEN_PR=$OPEN_PR, BRANCH_NAME=$BRANCH_NAME"
}

# Verify required tools and environment
check_environment() {
    log "Checking environment..."
    
    # Check if we're in the right directory
    if [ ! -f "$PRIVATE_REPO_ROOT/go.mod" ] || [ ! -f "$PRIVATE_REPO_ROOT/cmd/glinrdockd/main.go" ]; then
        error "Must run from private glinrdock repository root"
    fi
    
    # Check if public repo exists
    if [ ! -d "$PUBLIC_REPO_ROOT" ]; then
        error "Public repository not found at: $PUBLIC_REPO_ROOT"
    fi
    
    if [ ! -f "$PUBLIC_REPO_ROOT/README.md" ]; then
        error "Public repository doesn't appear to be glinrdock-release repo"
    fi
    
    # If opening PR, check for GitHub CLI and token
    if [ "$OPEN_PR" = "1" ]; then
        if ! command -v gh >/dev/null 2>&1; then
            error "GitHub CLI (gh) is required for --open-pr. Install from: https://cli.github.com/"
        fi
        
        if [ -z "${GH_TOKEN:-}" ]; then
            error "GH_TOKEN environment variable is required for --open-pr"
        fi
        
        # Test GitHub authentication
        if ! gh auth status >/dev/null 2>&1; then
            error "GitHub CLI authentication failed. Check GH_TOKEN or run 'gh auth login'"
        fi
        
        log "GitHub CLI authenticated successfully"
    fi
    
    debug "Environment check passed"
}

# Verify staging directory exists
verify_staging() {
    local staging_path="$PUBLIC_REPO_ROOT/$STAGING_DIR/$VERSION"
    
    log "Verifying staged artifacts for $VERSION..."
    
    if [ ! -d "$staging_path" ]; then
        error "Staging directory not found: $staging_path"
    fi
    
    # Check for required files
    local required_files="SHA256SUMS"
    local found_tarballs=0
    
    for file in $required_files; do
        if [ ! -f "$staging_path/$file" ]; then
            error "Required file missing: $staging_path/$file"
        fi
        debug "Found required file: $file"
    done
    
    # Count tarballs
    for file in "$staging_path"/*.tar.gz; do
        if [ -f "$file" ]; then
            found_tarballs=$((found_tarballs + 1))
            debug "Found tarball: $(basename "$file")"
        fi
    done
    
    if [ "$found_tarballs" -eq 0 ]; then
        error "No tarball artifacts found in staging directory"
    fi
    
    log "Verified $found_tarballs tarball(s) and required files"
}

# Copy artifacts to public repo
copy_artifacts() {
    local source_staging="$PUBLIC_REPO_ROOT/$STAGING_DIR/$VERSION"
    local dest_staging="$PUBLIC_REPO_ROOT/$STAGING_DIR/$VERSION"
    
    log "Artifacts already staged in public repo at: $dest_staging"
    log "No copy needed - artifacts are already in correct location"
    
    # Just verify the destination exists and has content
    verify_staging
}

# Get current version from QUICKSTART.md
get_current_version() {
    local quickstart_file="$PUBLIC_REPO_ROOT/docs/QUICKSTART.md"
    
    if [ ! -f "$quickstart_file" ]; then
        error "QUICKSTART.md not found: $quickstart_file"
    fi
    
    # Look for version references in download URLs
    local current_version
    current_version=$(grep -o 'download/v[0-9][^/]*/' "$quickstart_file" | head -1 | sed 's|download/||' | sed 's|/||' || echo "")
    
    if [ -n "$current_version" ]; then
        echo "$current_version"
    else
        warn "Could not detect current version in QUICKSTART.md"
        echo "v0.0.0"
    fi
}

# Update documentation with new version
update_documentation() {
    local quickstart_file="$PUBLIC_REPO_ROOT/docs/QUICKSTART.md"
    local current_version
    current_version=$(get_current_version)
    
    log "Updating documentation: $current_version → $VERSION"
    
    if [ "$current_version" = "$VERSION" ]; then
        log "Documentation already references $VERSION - no update needed"
        return
    fi
    
    # Create backup
    cp "$quickstart_file" "$quickstart_file.backup"
    
    # Update version references in QUICKSTART.md
    if [ "$current_version" != "v0.0.0" ]; then
        sed -i.tmp "s|$current_version|$VERSION|g" "$quickstart_file"
        rm -f "$quickstart_file.tmp"
        log "Updated version references from $current_version to $VERSION"
    else
        warn "Could not automatically update version references - manual review may be needed"
    fi
    
    # Show changes
    if command -v diff >/dev/null 2>&1; then
        log "Documentation changes:"
        diff -u "$quickstart_file.backup" "$quickstart_file" || true
    fi
    
    rm -f "$quickstart_file.backup"
}

# Create PR in public repository
create_pull_request() {
    log "Creating pull request in public repository..."
    
    cd "$PUBLIC_REPO_ROOT"
    
    # Get current branch to return to later
    local original_branch
    original_branch=$(git branch --show-current 2>/dev/null || echo "main")
    
    # Ensure we're on main and up to date
    git checkout main
    git pull origin main
    
    # Create and checkout new branch
    log "Creating branch: $BRANCH_NAME"
    git checkout -b "$BRANCH_NAME"
    
    # Update documentation
    update_documentation
    
    # Check if there are any changes to commit
    if git diff --quiet; then
        warn "No changes to commit - documentation may already be up to date"
        git checkout "$original_branch"
        git branch -D "$BRANCH_NAME"
        return
    fi
    
    # Stage and commit changes
    git add docs/QUICKSTART.md
    git commit -m "Release $VERSION

Update documentation references to $VERSION

- Update download URLs in QUICKSTART.md
- Prepare for $VERSION release"
    
    # Push branch
    log "Pushing branch to origin..."
    git push origin "$BRANCH_NAME"
    
    # Create PR
    local pr_title="Release $VERSION"
    local pr_body="## Release $VERSION

This PR updates documentation to reference the new $VERSION release.

### Changes
- Updated version references in \`docs/QUICKSTART.md\`
- Updated download URLs to point to $VERSION assets

### Checklist
- [ ] Release artifacts staged in \`_staging/$VERSION\`
- [ ] Documentation updated with correct version references
- [ ] Ready for release publication

### Next Steps
1. Review and approve this PR
2. Merge to main
3. Create GitHub release using staged artifacts
4. Verify release pipeline completion

---
*Auto-generated by publish_to_public.sh*"
    
    log "Creating pull request..."
    gh pr create \
        --title "$pr_title" \
        --body "$pr_body" \
        --base main \
        --head "$BRANCH_NAME"
    
    local pr_url
    pr_url=$(gh pr view --json url --jq .url)
    
    log "Pull request created successfully!"
    log "PR URL: $pr_url"
    
    # Return to original branch
    git checkout "$original_branch"
    
    return 0
}

# Print summary
print_summary() {
    local staging_path="$PUBLIC_REPO_ROOT/$STAGING_DIR/$VERSION"
    
    echo
    echo "======================================"
    echo "    Public Release Publisher"
    echo "======================================"
    echo
    echo "Version: $VERSION"
    echo "Staged artifacts: $staging_path"
    echo "Artifact count: $(ls "$staging_path"/*.tar.gz 2>/dev/null | wc -l) tarballs"
    
    if [ "$OPEN_PR" = "1" ]; then
        echo "Pull request: Created"
        echo "Branch: $BRANCH_NAME"
    else
        echo "Pull request: Skipped"
    fi
    
    echo
    echo "Staged files:"
    for file in "$staging_path"/*; do
        if [ -f "$file" ]; then
            printf "  %s\n" "$(basename "$file")"
        fi
    done
    
    echo
    echo "Next steps:"
    if [ "$OPEN_PR" = "1" ]; then
        echo "1. Review and approve the pull request"
        echo "2. Merge PR to main branch"
        echo "3. Create GitHub release"
        echo "4. Upload staged artifacts to release"
    else
        echo "1. Create GitHub release manually"
        echo "2. Upload staged artifacts from: $staging_path"
        echo "3. Update documentation references"
    fi
    echo
}

# Main execution
main() {
    log "GlinrDock Public Release Publisher"
    
    parse_args "$@"
    check_environment
    verify_staging
    copy_artifacts
    
    if [ "$OPEN_PR" = "1" ]; then
        create_pull_request
    fi
    
    print_summary
    
    log "Public release preparation completed successfully"
}

# Run main function with all arguments
main "$@"