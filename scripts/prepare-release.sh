#!/bin/bash

# GLINRDOCK Release Preparation Script
# Called by semantic-release to prepare a new release
set -e

VERSION=$1

if [[ -z "$VERSION" ]]; then
    echo "Usage: $0 <version>"
    exit 1
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

echo -e "${BLUE}"
echo "GLINRDOCK Release Preparation v$VERSION"
echo "======================================"
echo -e "${NC}"

# Update VERSION file
log_step "1. Updating VERSION file"
echo "$VERSION" > VERSION
log_info "VERSION file updated to $VERSION"

# Update package.json version
log_step "2. Updating frontend package.json"
cd web/ui-lite
npm version "$VERSION" --no-git-tag-version
cd ../..
log_info "Frontend package.json updated to $VERSION"

# Update Go version variables
log_step "3. Updating Go version variables"
if [[ -f cmd/glinrdockd/main.go ]]; then
    # Update version in main.go if it exists
    sed -i.bak "s/version = \".*\"/version = \"$VERSION\"/" cmd/glinrdockd/main.go 2>/dev/null || true
    rm -f cmd/glinrdockd/main.go.bak
fi

# Create version.go file
cat > internal/version/version.go << EOF
package version

// Version information
var (
    Version   = "$VERSION"
    GitCommit = ""
    BuildTime = ""
)

// GetVersion returns the current version
func GetVersion() string {
    return Version
}

// GetBuildInfo returns build information
func GetBuildInfo() map[string]string {
    return map[string]string{
        "version":   Version,
        "commit":    GitCommit,
        "buildTime": BuildTime,
    }
}
EOF

mkdir -p internal/version
log_info "Go version file created"

# Build assets
log_step "4. Building release assets"
log_info "Building frontend..."
cd web/ui-lite
npm ci --prefer-offline --no-audit
npm run build
cd ../..

# Embed frontend assets
log_info "Embedding frontend assets..."
go generate ./... 2>/dev/null || true

# Test build
log_info "Testing build..."
go build -o bin/glinrdockd-test ./cmd/glinrdockd
rm -f bin/glinrdockd-test

log_info "✅ Release preparation completed for v$VERSION"

# Summary
echo ""
echo -e "${BLUE}Release Summary:${NC}"
echo "  Version: $VERSION"
echo "  Frontend: $(cd web/ui-lite && npm list --depth=0 | head -1)"
echo "  Go: $(go version)"
echo ""
echo -e "${BLUE}Files Updated:${NC}"
echo "  ✅ VERSION"
echo "  ✅ web/ui-lite/package.json"
echo "  ✅ internal/version/version.go"
echo "  ✅ Frontend built and embedded"
echo ""

log_info "Ready for release build! 🚀"