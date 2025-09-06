#!/bin/bash

# GLINRDOCK Cross-Platform Builder
# Uses Docker for proper CGO cross-compilation
set -e

VERSION=${1:-"0.1.0-beta"}
PLATFORMS=${2:-"linux/amd64,linux/arm64,darwin/amd64,darwin/arm64,windows/amd64"}

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
    echo "GLINRDOCK Cross-Platform Builder"
    echo ""
    echo "Usage: $0 [VERSION] [PLATFORMS]"
    echo ""
    echo "Parameters:"
    echo "  VERSION     Version string (default: 0.1.0-beta)"
    echo "  PLATFORMS   Comma-separated list of OS/ARCH (default: linux/amd64,linux/arm64,...)"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Build all platforms"
    echo "  $0 1.0.0                             # Build v1.0.0 for all platforms"
    echo "  $0 0.2.0-beta linux/amd64            # Build specific version and platform"
}

if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    usage
    exit 0
fi

echo -e "${BLUE}"
cat << 'EOF'
  ____  _     ___ _   _ ____  ____   ___   ____ _  __
 / ___|| |   |_ _| \ | |  _ \|  _ \ / _ \ / ___| |/ /
| |  _ | |    | ||  \| | |_) | | | | | | | |   | ' / 
| |_| || |___ | || |\  |  _ <| |_| | |_| | |___| . \ 
 \____|_____|___|_| \_|_| \_\____/ \___/ \____|_|\_\
                                                     
        Cross-Platform Bundle Builder
EOF
echo -e "${NC}"

log_info "Building GLINRDOCK v$VERSION for platforms: $PLATFORMS"

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    log_error "Docker is required for cross-platform building"
    log_error "Install Docker and try again"
    exit 1
fi

# Check if Docker BuildKit is available
if ! docker buildx version &> /dev/null; then
    log_error "Docker BuildKit (buildx) is required for cross-platform building"
    log_error "Enable BuildKit: export DOCKER_BUILDKIT=1"
    exit 1
fi

# Setup buildx
log_step "1. Setting up Docker buildx"
docker buildx create --use --name glinrdock-builder 2>/dev/null || \
    docker buildx use glinrdock-builder 2>/dev/null || true

# Clean previous builds
log_step "2. Cleaning previous builds"
rm -rf dist/
mkdir -p dist/

# Build frontend first (platform independent)
log_step "3. Building frontend assets"
log_info "Building optimized React frontend..."
cd web/ui-lite
npm ci --prefer-offline --no-audit
npx vite build --mode production
cd ../..

# Convert platform list to array
IFS=',' read -r -a PLATFORM_ARRAY <<< "$PLATFORMS"

# Build each platform using Docker
log_step "4. Building binaries for each platform"

for platform in "${PLATFORM_ARRAY[@]}"; do
    IFS='/' read -r -a parts <<< "$platform"
    OS="${parts[0]}"
    ARCH="${parts[1]}"
    
    log_info "Building for $OS-$ARCH..."
    
    # Special handling for different OS types
    case $OS in
        linux)
            DOCKERFILE="Dockerfile.builder"
            ;;
        darwin|windows)
            # For macOS and Windows, we'll use a different approach
            log_warn "Using fallback build for $OS (CGO disabled)"
            DOCKERFILE="Dockerfile.builder"
            ;;
        *)
            log_error "Unsupported OS: $OS"
            continue
            ;;
    esac
    
    # Build using Docker
    docker buildx build \
        --platform "$platform" \
        --target go-builder-linux \
        --build-arg VERSION="$VERSION" \
        --build-arg TARGETOS="$OS" \
        --build-arg TARGETARCH="$ARCH" \
        --output type=local,dest=./build-output/ \
        -f "$DOCKERFILE" \
        . || {
            log_error "Build failed for $OS-$ARCH"
            continue
        }
    
    # Extract binary and create package
    BINARY_NAME="glinrdockd"
    if [[ "$OS" == "windows" ]]; then
        BINARY_NAME="glinrdockd.exe"
    fi
    
    if [[ -f "build-output/bin/glinrdockd-$OS-$ARCH" ]]; then
        # Create package directory
        PACKAGE_DIR="dist/glinrdock-$VERSION-$OS-$ARCH"
        mkdir -p "$PACKAGE_DIR/bin"
        
        # Copy binary
        cp "build-output/bin/glinrdockd-$OS-$ARCH" "$PACKAGE_DIR/bin/$BINARY_NAME"
        chmod +x "$PACKAGE_DIR/bin/$BINARY_NAME"
        
        # Copy essential files
        cp scripts/vps-install.sh "$PACKAGE_DIR/install.sh" 2>/dev/null || true
        cp scripts/backup.sh "$PACKAGE_DIR/" 2>/dev/null || true
        cp docker-compose.prod.yml "$PACKAGE_DIR/" 2>/dev/null || true
        
        # Create archive
        cd dist
        tar -czf "glinrdock-$VERSION-$OS-$ARCH.tar.gz" "glinrdock-$VERSION-$OS-$ARCH/"
        
        # Generate checksums
        sha256sum "glinrdock-$VERSION-$OS-$ARCH.tar.gz" > "glinrdock-$VERSION-$OS-$ARCH.sha256"
        
        cd ..
        
        # Show size
        SIZE=$(du -h "dist/glinrdock-$VERSION-$OS-$ARCH.tar.gz" | cut -f1)
        log_info "✅ Package created: glinrdock-$VERSION-$OS-$ARCH.tar.gz ($SIZE)"
    else
        log_error "❌ Binary not found for $OS-$ARCH"
    fi
done

# Clean up build output
rm -rf build-output/

# Build Docker images
log_step "5. Building Docker images"
log_info "Building multi-platform Docker image..."

docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --build-arg VERSION="$VERSION" \
    --tag "glinrdock:$VERSION" \
    --tag "glinrdock:latest" \
    -f Dockerfile.builder \
    --load \
    . || log_warn "Docker image build failed"

# Generate release summary
log_step "6. Generating release summary"
echo ""
log_info "🎉 Cross-platform build completed!"
echo ""
echo -e "${BLUE}Build Summary:${NC}"
echo "  Version: $VERSION"
echo "  Platforms Built:"

for platform in "${PLATFORM_ARRAY[@]}"; do
    IFS='/' read -r -a parts <<< "$platform"
    OS="${parts[0]}"
    ARCH="${parts[1]}"
    
    PACKAGE_FILE="dist/glinrdock-$VERSION-$OS-$ARCH.tar.gz"
    if [[ -f "$PACKAGE_FILE" ]]; then
        SIZE=$(du -h "$PACKAGE_FILE" | cut -f1)
        echo "    ✅ $OS-$ARCH: $SIZE"
    else
        echo "    ❌ $OS-$ARCH: Build failed"
    fi
done

echo ""
echo -e "${BLUE}Available Packages:${NC}"
ls -la dist/*.tar.gz 2>/dev/null | awk '{print "  " $9 " (" $5 " bytes)"}' || echo "  No packages created"

echo ""
echo -e "${BLUE}Docker Images:${NC}"
docker images glinrdock:$VERSION 2>/dev/null || echo "  No Docker images created"

log_info "Cross-platform build completed! 🚀"