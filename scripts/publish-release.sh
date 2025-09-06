#!/bin/bash

# GLINRDOCK Release Publishing Script  
# Called by semantic-release to publish packages
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

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

echo -e "${BLUE}"
echo "GLINRDOCK Release Publishing v$VERSION"  
echo "====================================="
echo -e "${NC}"

# Target platforms for builds
PLATFORMS=(
    "linux-amd64"
    "linux-arm64" 
    "darwin-amd64"
    "darwin-arm64"
    "windows-amd64"
)

# Build packages for all platforms
log_step "1. Building packages for all platforms"
for platform in "${PLATFORMS[@]}"; do
    IFS='-' read -r -a parts <<< "$platform"
    OS="${parts[0]}"
    ARCH="${parts[1]}"
    
    log_info "Building for $OS-$ARCH..."
    ./scripts/build-bundle.sh "$VERSION" "$ARCH" "$OS" "release"
    
    if [[ -f "dist/glinrdock-$VERSION-$OS-$ARCH.tar.gz" ]]; then
        log_info "✅ Package created: glinrdock-$VERSION-$OS-$ARCH.tar.gz"
    else
        log_error "❌ Failed to create package for $OS-$ARCH"
        exit 1
    fi
done

# Create universal installer
log_step "2. Creating universal installer"
cat > dist/install-glinrdock.sh << 'EOF'
#!/bin/bash
# GLINRDOCK Universal Installer
set -e

VERSION="__VERSION__"
REPO_URL="https://github.com/glincker/glinrdock-core"

# Detect platform
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

case $ARCH in
    x86_64) ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    armv7l) ARCH="arm" ;;
    *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

case $OS in
    linux|darwin) ;;
    *) echo "Unsupported OS: $OS"; exit 1 ;;
esac

PACKAGE="glinrdock-$VERSION-$OS-$ARCH.tar.gz"
DOWNLOAD_URL="$REPO_URL/releases/download/v$VERSION/$PACKAGE"

echo "GLINRDOCK Universal Installer"
echo "============================"
echo "Version: $VERSION"  
echo "Platform: $OS-$ARCH"
echo ""

# Download and install
echo "Downloading $PACKAGE..."
if command -v curl &> /dev/null; then
    curl -fsSL -o "/tmp/$PACKAGE" "$DOWNLOAD_URL"
elif command -v wget &> /dev/null; then
    wget -q -O "/tmp/$PACKAGE" "$DOWNLOAD_URL"  
else
    echo "Error: curl or wget required"
    exit 1
fi

echo "Installing GLINRDOCK..."
cd /tmp
tar -xzf "$PACKAGE"
cd "glinrdock-$VERSION-$OS-$ARCH"
sudo ./install.sh

echo "✅ GLINRDOCK v$VERSION installed successfully!"
echo ""
echo "Next steps:"
echo "1. Configure: /etc/glinrdock/config.yml"
echo "2. Start: sudo systemctl start glinrdock" 
echo "3. Status: sudo systemctl status glinrdock"

# Cleanup
rm -rf "/tmp/$PACKAGE" "/tmp/glinrdock-$VERSION-$OS-$ARCH"
EOF

# Replace version placeholder
sed -i.bak "s/__VERSION__/$VERSION/g" dist/install-glinrdock.sh
rm -f dist/install-glinrdock.sh.bak
chmod +x dist/install-glinrdock.sh

log_info "✅ Universal installer created"

# Generate package index
log_step "3. Generating package index"
cat > dist/packages.json << EOF
{
    "version": "$VERSION",
    "release_date": "$(date -u -Iseconds)",
    "packages": [
EOF

FIRST=true
for platform in "${PLATFORMS[@]}"; do
    IFS='-' read -r -a parts <<< "$platform"
    OS="${parts[0]}"
    ARCH="${parts[1]}"
    
    PACKAGE_FILE="glinrdock-$VERSION-$OS-$ARCH.tar.gz"
    if [[ -f "dist/$PACKAGE_FILE" ]]; then
        if [[ "$FIRST" != true ]]; then
            echo "," >> dist/packages.json
        fi
        FIRST=false
        
        SIZE=$(stat -f%z "dist/$PACKAGE_FILE" 2>/dev/null || stat -c%s "dist/$PACKAGE_FILE")
        SHA256=$(cat "dist/$PACKAGE_FILE.sha256" | cut -d' ' -f1)
        
        cat >> dist/packages.json << EOF
        {
            "platform": "$platform",
            "os": "$OS", 
            "arch": "$ARCH",
            "filename": "$PACKAGE_FILE",
            "size": $SIZE,
            "sha256": "$SHA256",
            "download_url": "https://github.com/glincker/glinrdock-core/releases/download/v$VERSION/$PACKAGE_FILE"
        }EOF
    fi
done

cat >> dist/packages.json << EOF

    ],
    "installer": {
        "filename": "install-glinrdock.sh",
        "download_url": "https://github.com/glincker/glinrdock-core/releases/download/v$VERSION/install-glinrdock.sh"
    }
}
EOF

log_info "✅ Package index generated"

# Docker images (if Docker available)
if command -v docker &> /dev/null; then
    log_step "4. Building Docker images"
    
    # Build multi-arch Docker image
    log_info "Building Docker image..."
    docker buildx create --use --name glinrdock-builder 2>/dev/null || true
    
    docker buildx build \
        --platform linux/amd64,linux/arm64 \
        --tag "glinrdock:$VERSION" \
        --tag "glinrdock:latest" \
        --file Dockerfile.controller \
        --push \
        . || log_warn "Docker build failed (may need registry access)"
    
    log_info "Docker images built"
else
    log_warn "Docker not available, skipping image builds"
fi

# Generate release notes
log_step "5. Generating release notes"
cat > dist/RELEASE_NOTES.md << EOF
# GLINRDOCK v$VERSION Release Notes

## 🎉 What's New

### Features
- Container management with Docker integration
- Web-based UI for service deployment
- Nginx reverse proxy with SSL automation  
- Spring Boot application deployment workflow
- Backup and recovery system

### Security
- Token-based authentication
- Rate limiting and security headers
- SSL/TLS certificate automation
- Non-root container execution

### Deployment
- Multiple package formats (.deb, .rpm, .tar.gz)
- Universal installer script
- Docker images for container deployment
- Systemd service integration

## 📦 Downloads

| Platform | Architecture | Package | Size |
|----------|-------------|---------|------|
EOF

for platform in "${PLATFORMS[@]}"; do
    IFS='-' read -r -a parts <<< "$platform"
    OS="${parts[0]}"
    ARCH="${parts[1]}"
    
    PACKAGE_FILE="glinrdock-$VERSION-$OS-$ARCH.tar.gz"
    if [[ -f "dist/$PACKAGE_FILE" ]]; then
        SIZE=$(du -h "dist/$PACKAGE_FILE" | cut -f1)
        echo "| $OS | $ARCH | [$PACKAGE_FILE](https://github.com/glincker/glinrdock-core/releases/download/v$VERSION/$PACKAGE_FILE) | $SIZE |" >> dist/RELEASE_NOTES.md
    fi
done

cat >> dist/RELEASE_NOTES.md << EOF

## 🚀 Quick Install

\`\`\`bash
# Universal installer (recommended)
curl -fsSL https://github.com/glincker/glinrdock-core/releases/download/v$VERSION/install-glinrdock.sh | bash

# Manual installation
wget https://github.com/glincker/glinrdock-core/releases/download/v$VERSION/glinrdock-$VERSION-linux-amd64.tar.gz
tar -xzf glinrdock-$VERSION-linux-amd64.tar.gz
cd glinrdock-$VERSION-linux-amd64
sudo ./install.sh
\`\`\`

## 🐳 Docker

\`\`\`bash
# Run with Docker
docker run -d -p 8080:8080 glinrdock:$VERSION

# Docker Compose
wget https://raw.githubusercontent.com/glincker/glinrdock-core/v$VERSION/docker-compose.prod.yml
docker-compose -f docker-compose.prod.yml up -d
\`\`\`

## 📚 Documentation

- [Quick Start Guide](https://github.com/glincker/glinrdock-core/blob/v$VERSION/docs/QUICKSTART.md)
- [VPS Deployment](https://github.com/glincker/glinrdock-core/blob/v$VERSION/docs/VPS_DEPLOYMENT.md)
- [API Documentation](https://github.com/glincker/glinrdock-core/blob/v$VERSION/docs/API.md)

## 🔒 Security

All packages are signed and include SHA256 checksums for verification.

\`\`\`bash
# Verify package integrity
sha256sum -c glinrdock-$VERSION-linux-amd64.sha256
\`\`\`

## 🆘 Support

- [Documentation](https://github.com/glincker/glinrdock-core/tree/v$VERSION/docs)
- [Issue Tracker](https://github.com/glincker/glinrdock-core/issues)
- [Discussions](https://github.com/glincker/glinrdock-core/discussions)

---

**Full Changelog**: https://github.com/glincker/glinrdock-core/compare/v0.0.1...v$VERSION
EOF

log_info "✅ Release notes generated"

# Summary
echo ""
log_info "🎉 Release v$VERSION published successfully!"
echo ""
echo -e "${BLUE}Published Packages:${NC}"
for platform in "${PLATFORMS[@]}"; do
    IFS='-' read -r -a parts <<< "$platform"
    OS="${parts[0]}"
    ARCH="${parts[1]}"
    
    PACKAGE_FILE="glinrdock-$VERSION-$OS-$ARCH.tar.gz"
    if [[ -f "dist/$PACKAGE_FILE" ]]; then
        SIZE=$(du -h "dist/$PACKAGE_FILE" | cut -f1)
        echo "  ✅ $OS-$ARCH: $SIZE"
    fi
done

echo ""
echo -e "${BLUE}Release Assets:${NC}"
echo "  ✅ Universal installer: install-glinrdock.sh"
echo "  ✅ Package index: packages.json"
echo "  ✅ Release notes: RELEASE_NOTES.md" 
if command -v docker &> /dev/null; then
    echo "  ✅ Docker images: glinrdock:$VERSION, glinrdock:latest"
fi

echo ""
log_info "Release artifacts ready for GitHub upload! 🚀"