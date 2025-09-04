#!/bin/sh
set -eu

# GlinrDock Release Staging Script
# Builds cross-compiled binaries and stages them for public release

# Configuration
BINARY_NAME="glinrdockd"
BUILD_DIR="build"
STAGING_BASE="../glinrdock-release/_staging"

# Target platforms
PLATFORMS="linux/amd64 linux/arm64 darwin/amd64 darwin/arm64"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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
GlinrDock Release Staging Script

USAGE:
    $0 VERSION

ARGUMENTS:
    VERSION     Version to build (required, e.g. v0.1.0)

ENVIRONMENT:
    DEBUG           Enable debug output (set to 1)
    COSIGN_PASSWORD Private key password for signing
    COSIGN_KEY      Private key for signing artifacts
    
EXAMPLES:
    $0 v0.1.0
    DEBUG=1 $0 v0.0.0-dev

EOF
}

# Validate arguments
if [ $# -ne 1 ]; then
    usage
    error "VERSION argument is required"
fi

VERSION="$1"

# Validate version format
case "$VERSION" in
    v[0-9]*) ;;
    *) error "VERSION must start with 'v' (e.g. v0.1.0)";;
esac

log "Starting release staging for version: $VERSION"

# Check if we're in the right directory
if [ ! -f "go.mod" ] || [ ! -f "cmd/glinrdockd/main.go" ]; then
    error "Must run from project root directory with go.mod and cmd/glinrdockd/main.go"
fi

# Check required tools
check_tools() {
    log "Checking required tools..."
    
    if ! command -v go >/dev/null 2>&1; then
        error "Go is not installed or not in PATH"
    fi
    
    GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
    log "Go version: $GO_VERSION"
    
    if ! command -v tar >/dev/null 2>&1; then
        error "tar is not installed or not in PATH"
    fi
    
    if ! command -v sha256sum >/dev/null 2>&1; then
        if command -v shasum >/dev/null 2>&1; then
            CHECKSUM_CMD="shasum -a 256"
            log "Using shasum for checksums"
        else
            error "Neither sha256sum nor shasum found"
        fi
    else
        CHECKSUM_CMD="sha256sum"
        log "Using sha256sum for checksums"
    fi
    
    # Check for syft (optional)
    if command -v syft >/dev/null 2>&1; then
        SYFT_AVAILABLE=1
        SYFT_VERSION=$(syft version --output json 2>/dev/null | grep -o '"version":"[^"]*' | cut -d'"' -f4 || echo "unknown")
        log "Syft available: $SYFT_VERSION"
    else
        SYFT_AVAILABLE=0
        warn "Syft not found - SBOM generation will be skipped"
        warn "Install with: curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin"
    fi
    
    # Check for cosign (optional)
    if command -v cosign >/dev/null 2>&1; then
        COSIGN_AVAILABLE=1
        COSIGN_VERSION=$(cosign version --short 2>/dev/null || echo "unknown")
        log "Cosign available: $COSIGN_VERSION"
        
        # Check for signing environment variables
        if [ -n "${COSIGN_PASSWORD:-}" ] && [ -n "${COSIGN_KEY:-}" ]; then
            COSIGN_SIGNING=1
            log "Cosign signing enabled (COSIGN_PASSWORD and COSIGN_KEY set)"
        else
            COSIGN_SIGNING=0
            log "Cosign signing disabled (COSIGN_PASSWORD or COSIGN_KEY not set)"
        fi
    else
        COSIGN_AVAILABLE=0
        COSIGN_SIGNING=0
        warn "Cosign not found - artifact signing will be skipped"
        warn "Install with: go install github.com/sigstore/cosign/v2/cmd/cosign@latest"
    fi
}

# Clean and create build directory
setup_build_dir() {
    log "Setting up build directory..."
    
    rm -rf "$BUILD_DIR"
    mkdir -p "$BUILD_DIR"
    debug "Created build directory: $BUILD_DIR"
}

# Build binary for specific platform
build_binary() {
    local platform="$1"
    local goos="${platform%/*}"
    local goarch="${platform#*/}"
    local output_name="${BINARY_NAME}_${goos}_${goarch}"
    local binary_path="$BUILD_DIR/$output_name"
    
    log "Building $output_name..."
    debug "GOOS=$goos GOARCH=$goarch"
    
    # Set build variables
    BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
    GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
    GIT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
    
    # Build with static linking and stripped symbols
    env GOOS="$goos" GOARCH="$goarch" CGO_ENABLED=0 go build \
        -ldflags "-s -w -X main.version=$VERSION -X main.buildTime=$BUILD_TIME -X main.gitCommit=$GIT_COMMIT -X main.gitBranch=$GIT_BRANCH" \
        -o "$binary_path" \
        ./cmd/glinrdockd
    
    if [ ! -f "$binary_path" ]; then
        error "Failed to build binary: $binary_path"
    fi
    
    debug "Binary size: $(wc -c < "$binary_path") bytes"
    log "Built: $output_name"
}

# Create tarball for binary
create_tarball() {
    local platform="$1"
    local goos="${platform%/*}"
    local goarch="${platform#*/}"
    local binary_name="${BINARY_NAME}_${goos}_${goarch}"
    local binary_path="$BUILD_DIR/$binary_name"
    local tarball_name="${binary_name}.tar.gz"
    local tarball_path="$BUILD_DIR/$tarball_name"
    
    log "Creating tarball: $tarball_name"
    
    # Create tarball with flat structure (just the binary)
    cd "$BUILD_DIR"
    tar -czf "$tarball_name" -C . "$binary_name"
    cd - >/dev/null
    
    if [ ! -f "$tarball_path" ]; then
        error "Failed to create tarball: $tarball_path"
    fi
    
    debug "Tarball size: $(wc -c < "$tarball_path") bytes"
    log "Created: $tarball_name"
}

# Generate checksums
generate_checksums() {
    log "Generating checksums..."
    
    cd "$BUILD_DIR"
    
    # Generate individual checksums
    for file in *.tar.gz; do
        if [ -f "$file" ]; then
            $CHECKSUM_CMD "$file" > "$file.sha256"
            debug "Generated checksum for $file"
        fi
    done
    
    # Generate combined checksum file
    $CHECKSUM_CMD *.tar.gz > SHA256SUMS
    log "Generated SHA256SUMS file"
    
    cd - >/dev/null
}

# Generate SBOM files
generate_sbom() {
    if [ "$SYFT_AVAILABLE" = "0" ]; then
        warn "Skipping SBOM generation - syft not available"
        return
    fi
    
    log "Generating SBOM files..."
    
    cd "$BUILD_DIR"
    
    for binary in glinrdockd_*; do
        if [ -f "$binary" ] && [ ! -f "$binary.tar.gz" ]; then
            local sbom_file="${binary}.sbom.spdx.json"
            log "Generating SBOM for $binary..."
            
            # Generate SBOM for the binary
            if syft "$binary" -o spdx-json > "$sbom_file" 2>/dev/null; then
                debug "Generated SBOM: $sbom_file"
            else
                warn "Failed to generate SBOM for $binary"
                rm -f "$sbom_file"
            fi
        fi
    done
    
    cd - >/dev/null
}

# Sign artifacts with cosign
sign_artifacts() {
    if [ "$COSIGN_SIGNING" = "0" ]; then
        if [ "$COSIGN_AVAILABLE" = "0" ]; then
            warn "Skipping artifact signing - cosign not available"
        else
            warn "Skipping artifact signing - COSIGN_PASSWORD or COSIGN_KEY not set"
        fi
        return
    fi
    
    log "Signing artifacts with cosign..."
    
    cd "$BUILD_DIR"
    
    # Sign SHA256SUMS file
    if [ -f "SHA256SUMS" ]; then
        log "Signing SHA256SUMS..."
        if cosign sign-blob --key env://COSIGN_KEY --output-signature SHA256SUMS.sig SHA256SUMS; then
            debug "Generated signature: SHA256SUMS.sig"
        else
            warn "Failed to sign SHA256SUMS"
        fi
    fi
    
    # Sign each tarball
    for file in *.tar.gz; do
        if [ -f "$file" ]; then
            local sig_file="${file}.sig"
            log "Signing $file..."
            if cosign sign-blob --key env://COSIGN_KEY --output-signature "$sig_file" "$file"; then
                debug "Generated signature: $sig_file"
            else
                warn "Failed to sign $file"
            fi
        fi
    done
    
    cd - >/dev/null
    
    log "Artifact signing completed"
}

# Create staging directory and copy artifacts
stage_artifacts() {
    local staging_dir="$STAGING_BASE/$VERSION"
    
    log "Staging artifacts to: $staging_dir"
    
    # Create staging directory
    mkdir -p "$staging_dir"
    
    # Copy all artifacts
    cp "$BUILD_DIR"/*.tar.gz "$staging_dir"/
    cp "$BUILD_DIR"/*.sha256 "$staging_dir"/
    cp "$BUILD_DIR"/SHA256SUMS "$staging_dir"/
    
    # Copy signature files if they exist
    if ls "$BUILD_DIR"/*.sig >/dev/null 2>&1; then
        cp "$BUILD_DIR"/*.sig "$staging_dir"/
        log "Copied signature files"
    fi
    
    # Copy SBOM files if they exist
    if ls "$BUILD_DIR"/*.sbom.spdx.json >/dev/null 2>&1; then
        cp "$BUILD_DIR"/*.sbom.spdx.json "$staging_dir"/
        log "Copied SBOM files"
    fi
    
    log "Artifacts staged successfully"
}

# Print staged files
print_staged_files() {
    local staging_dir="$STAGING_BASE/$VERSION"
    
    log "Staged files:"
    for file in "$staging_dir"/*; do
        if [ -f "$file" ]; then
            echo "$(cd "$(dirname "$file")" && pwd)/$(basename "$file")"
        fi
    done
}

# Verify artifacts
verify_artifacts() {
    local staging_dir="$STAGING_BASE/$VERSION"
    
    log "Verifying artifacts..."
    
    cd "$staging_dir"
    
    # Verify checksums
    if sha256sum -c SHA256SUMS >/dev/null 2>&1 || shasum -a 256 -c SHA256SUMS >/dev/null 2>&1; then
        log "Checksum verification passed"
    else
        error "Checksum verification failed"
    fi
    
    # Test each tarball
    for tarball in *.tar.gz; do
        if [ -f "$tarball" ]; then
            debug "Testing tarball: $tarball"
            if tar -tzf "$tarball" >/dev/null 2>&1; then
                debug "Tarball OK: $tarball"
            else
                error "Corrupted tarball: $tarball"
            fi
        fi
    done
    
    cd - >/dev/null
    
    log "Artifact verification completed"
}

# Main execution
main() {
    log "GlinrDock Release Staging - Version $VERSION"
    
    check_tools
    setup_build_dir
    
    # Build binaries for all platforms
    for platform in $PLATFORMS; do
        build_binary "$platform"
        create_tarball "$platform"
    done
    
    generate_checksums
    generate_sbom
    sign_artifacts
    stage_artifacts
    verify_artifacts
    
    echo
    echo "======================================"
    echo "    Release Staging Complete"
    echo "======================================"
    echo
    echo "Version: $VERSION"
    echo "Artifacts: $(ls "$BUILD_DIR"/*.tar.gz | wc -l) tarballs"
    echo "Checksums: Generated"
    if [ "$SYFT_AVAILABLE" = "1" ]; then
        echo "SBOM: Generated"
    else
        echo "SBOM: Skipped (syft not available)"
    fi
    if [ "$COSIGN_SIGNING" = "1" ]; then
        echo "Signatures: Generated"
    else
        echo "Signatures: Skipped (cosign not configured)"
    fi
    echo
    
    print_staged_files
    
    echo
    echo "Next steps:"
    echo "1. Review staged artifacts in: $STAGING_BASE/$VERSION"
    echo "2. Test binaries on target platforms"
    echo "3. Create GitHub release and upload artifacts"
    echo
}

# Run main function
main