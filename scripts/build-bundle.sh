#!/bin/bash

# GLINRDOCK Bundle Builder
# Creates optimized packages for distribution
set -e

# Configuration
VERSION=${1:-"0.1.0-beta"}
ARCH=${2:-"amd64"}
OS=${3:-"linux"}
BUILD_TYPE=${4:-"release"}

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

# Cross-platform file size functions
get_file_size_bytes() {
    local file="$1"
    if [[ "$(uname)" == "Darwin" ]]; then
        # macOS doesn't have -b flag for du, use stat instead
        stat -f%z "$file"
    else
        # Linux has du -b
        du -b "$file" | cut -f1
    fi
}

get_file_size_human() {
    local file="$1"
    if [[ "$(uname)" == "Darwin" ]]; then
        du -h "$file" | cut -f1
    else
        du -h "$file" | cut -f1
    fi
}

# Cross-platform human-readable byte formatting
format_bytes() {
    local bytes="$1"
    if command -v numfmt >/dev/null 2>&1; then
        numfmt --to=iec "$bytes"
    elif [[ "$(uname)" == "Darwin" ]] && command -v gstat >/dev/null 2>&1; then
        # GNU coreutils on macOS (brew install coreutils)
        gnumfmt --to=iec "$bytes"
    else
        # Fallback: simple conversion
        if [[ $bytes -gt 1073741824 ]]; then
            echo "$(( bytes / 1073741824 ))G"
        elif [[ $bytes -gt 1048576 ]]; then
            echo "$(( bytes / 1048576 ))M"
        elif [[ $bytes -gt 1024 ]]; then
            echo "$(( bytes / 1024 ))K"
        else
            echo "${bytes}B"
        fi
    fi
}

usage() {
    echo "GLINRDOCK Bundle Builder"
    echo ""
    echo "Usage: $0 [VERSION] [ARCH] [OS] [BUILD_TYPE]"
    echo ""
    echo "Parameters:"
    echo "  VERSION      Version string (default: 0.1.0-beta)"
    echo "  ARCH         Target architecture: amd64, arm64 (default: amd64)"
    echo "  OS           Target OS: linux, darwin, windows (default: linux)"
    echo "  BUILD_TYPE   Build type: release, debug (default: release)"
    echo ""
    echo "Examples:"
    echo "  $0                              # Default build"
    echo "  $0 1.0.0 amd64 linux release  # Production Linux build"
    echo "  $0 0.2.0-beta arm64 darwin     # Beta macOS ARM build"
}

if [[ "$1" == "-h" || "$1" == "--help" ]]; then
    usage
    exit 0
fi

# Validate parameters
if [[ ! "$ARCH" =~ ^(amd64|arm64|386)$ ]]; then
    log_error "Invalid architecture: $ARCH. Use: amd64, arm64, 386"
    exit 1
fi

if [[ ! "$OS" =~ ^(linux|darwin|windows)$ ]]; then
    log_error "Invalid OS: $OS. Use: linux, darwin, windows"
    exit 1
fi

# Set build flags based on type
if [[ "$BUILD_TYPE" == "debug" ]]; then
    LDFLAGS="-X main.version=$VERSION -X main.buildTime=$(date -u '+%Y-%m-%d_%H:%M:%S')"
    log_warn "Building debug version (larger size, includes debug info)"
else
    LDFLAGS="-s -w -X main.version=$VERSION -X main.buildTime=$(date -u '+%Y-%m-%d_%H:%M:%S')"
fi

# Set binary name
BINARY_NAME="glinrdockd"
if [[ "$OS" == "windows" ]]; then
    BINARY_NAME="glinrdockd.exe"
fi

echo -e "${BLUE}"
cat << 'EOF'
  ____  _     ___ _   _ ____  ____   ___   ____ _  __
 / ___|| |   |_ _| \ | |  _ \|  _ \ / _ \ / ___| |/ /
| |  _ | |    | ||  \| | |_) | | | | | | | |   | ' / 
| |_| || |___ | || |\  |  _ <| |_| | |_| | |___| . \ 
 \____|_____|___|_| \_|_| \_\____/ \___/ \____|_|\_\
                                                     
                Bundle Builder
EOF
echo -e "${NC}"

log_info "Building GLINRDOCK v$VERSION for $OS-$ARCH ($BUILD_TYPE)"

# Pre-build checks
log_step "1. Pre-build verification"

# Check required tools
REQUIRED_TOOLS=("go" "npm" "tar")
for tool in "${REQUIRED_TOOLS[@]}"; do
    if ! command -v $tool &> /dev/null; then
        log_error "$tool is required but not installed"
        exit 1
    fi
done

# Check Go version
GO_VERSION=$(go version | awk '{print $3}' | sed 's/go//')
if [[ "$GO_VERSION" < "1.21" ]]; then
    log_warn "Go version $GO_VERSION may be too old. Recommended: 1.21+"
fi

# Check Node.js version
NODE_VERSION=$(node --version | sed 's/v//')
if [[ "$NODE_VERSION" < "18.0" ]]; then
    log_warn "Node.js version $NODE_VERSION may be too old. Recommended: 18+"
fi

log_info "✅ All required tools available"

# Clean previous builds
log_step "2. Cleaning previous builds"
make clean || true
rm -rf dist/
mkdir -p dist/
mkdir -p bin/

# Build frontend
log_step "3. Building optimized frontend"
cd web/ui-lite

# Verify package.json exists
if [[ ! -f package.json ]]; then
    log_error "Frontend package.json not found"
    exit 1
fi

# Clean install dependencies
log_info "Installing frontend dependencies..."
npm ci --prefer-offline --no-audit

# Build production frontend (skip TypeScript compilation for now)
log_info "Building optimized frontend bundle..."
NODE_ENV=production npx vite build --mode production

# Verify build output
if [[ ! -d ../static/ui-lite || ! -f ../static/ui-lite/index.html ]]; then
    log_error "Frontend build failed - static assets not found"
    exit 1
fi

# Calculate frontend size (cross-platform)
if command -v gdu >/dev/null 2>&1; then
    FRONTEND_SIZE=$(gdu -sh ../static/ui-lite | cut -f1)
elif [[ "$(uname)" == "Darwin" ]]; then
    FRONTEND_SIZE=$(du -sh ../static/ui-lite | cut -f1)
else
    FRONTEND_SIZE=$(du -sh ../static/ui-lite | cut -f1)
fi
log_info "Frontend built successfully: $FRONTEND_SIZE"

cd ../..

# Embed frontend assets
log_step "4. Embedding frontend assets"
if [[ -f embed.go ]]; then
    log_info "Generating embedded assets..."
    go generate ./...
else
    log_warn "No embed.go found - frontend may not be embedded"
fi

# Build optimized backend
log_step "5. Building optimized backend binary"

log_info "Cross-compiling for $OS-$ARCH..."

# Set CGO based on target - SQLite requires CGO always
CGO_ENABLED=1

# For cross-compilation, we need to handle this differently
if [[ "$(uname -s)" != "$OS" ]] || [[ "$(uname -m | sed 's/x86_64/amd64/; s/aarch64/arm64/')" != "$ARCH" ]]; then
    log_warn "Cross-compilation detected. For production builds, use native compilation or Docker."
    log_warn "Building without CGO for now (SQLite will not work)"
    CGO_ENABLED=0
fi

# Build command
GOOS=$OS \
GOARCH=$ARCH \
CGO_ENABLED=$CGO_ENABLED \
go build \
    -ldflags="$LDFLAGS" \
    -trimpath \
    -buildvcs=false \
    -o bin/$BINARY_NAME \
    ./cmd/glinrdockd

if [[ ! -f bin/$BINARY_NAME ]]; then
    log_error "Backend build failed - binary not found"
    exit 1
fi

# Calculate binary size (cross-platform)
if [[ "$(uname)" == "Darwin" ]]; then
    BINARY_SIZE=$(du -sh bin/$BINARY_NAME | cut -f1)
else
    BINARY_SIZE=$(du -sh bin/$BINARY_NAME | cut -f1)
fi
log_info "Backend built successfully: $BINARY_SIZE"

# Optional: Compress with UPX (if available and not debug build)
if command -v upx &> /dev/null && [[ "$BUILD_TYPE" == "release" ]]; then
    log_info "Compressing binary with UPX..."
    upx --best --lzma bin/$BINARY_NAME 2>/dev/null || log_warn "UPX compression failed"
    if [[ "$(uname)" == "Darwin" ]]; then
        COMPRESSED_SIZE=$(du -sh bin/$BINARY_NAME | cut -f1)
    else
        COMPRESSED_SIZE=$(du -sh bin/$BINARY_NAME | cut -f1)
    fi
    log_info "Binary compressed: $COMPRESSED_SIZE"
fi

# Create package directory structure
log_step "6. Creating package structure"

PACKAGE_DIR="dist/glinrdock-$VERSION-$OS-$ARCH"
log_info "Package directory: $PACKAGE_DIR"

# Create directory structure
mkdir -p $PACKAGE_DIR/{bin,etc/glinrdock,usr/share/{doc/glinrdock,man/man1},scripts,examples}

# Copy binary
log_info "Copying optimized binary..."
cp bin/$BINARY_NAME $PACKAGE_DIR/bin/glinrdockd
chmod +x $PACKAGE_DIR/bin/glinrdockd

# Copy essential scripts
log_info "Copying utility scripts..."
ESSENTIAL_SCRIPTS=("install.sh" "setup-ssl.sh" "backup.sh" "uninstall.sh")
for script in "${ESSENTIAL_SCRIPTS[@]}"; do
    if [[ -f scripts/$script ]]; then
        cp scripts/$script $PACKAGE_DIR/scripts/
        chmod +x $PACKAGE_DIR/scripts/$script
    else
        log_warn "Script not found: scripts/$script"
    fi
done

# Copy documentation
log_info "Copying documentation..."
ESSENTIAL_DOCS=("README.md" "QUICKSTART.md" "TROUBLESHOOTING.md" "LICENSE")
for doc in "${ESSENTIAL_DOCS[@]}"; do
    if [[ -f $doc ]]; then
        cp $doc $PACKAGE_DIR/usr/share/doc/glinrdock/
    elif [[ -f docs/$doc ]]; then
        cp docs/$doc $PACKAGE_DIR/usr/share/doc/glinrdock/
    else
        log_warn "Documentation not found: $doc"
    fi
done

# Copy configuration templates
log_info "Copying configuration templates..."
if [[ -f docker-compose.prod.yml ]]; then
    cp docker-compose.prod.yml $PACKAGE_DIR/etc/glinrdock/docker-compose.yml
fi

if [[ -f nginx/nginx.conf ]]; then
    cp nginx/nginx.conf $PACKAGE_DIR/etc/glinrdock/nginx-template.conf
fi

# Copy example configurations
log_info "Copying examples..."
if [[ -d examples ]]; then
    cp -r examples/* $PACKAGE_DIR/examples/ 2>/dev/null || true
fi

# Create systemd service file
log_info "Creating systemd service file..."
cat > $PACKAGE_DIR/etc/glinrdock/glinrdock.service << 'EOF'
[Unit]
Description=GLINRDOCK Container Management System
Documentation=https://github.com/glincker/glinrdock-core
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=glinrdock
Group=glinrdock
ExecStart=/usr/local/bin/glinrdockd
ExecReload=/bin/kill -HUP $MAINPID
KillMode=process
Restart=on-failure
RestartSec=5s

# Security settings
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ProtectHome=yes
ReadWritePaths=/var/lib/glinrdock /var/log/glinrdock

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=multi-user.target
EOF

# Create installation script
log_step "7. Creating installation script"
cat > $PACKAGE_DIR/install.sh << 'EOF'
#!/bin/bash
# GLINRDOCK Installation Script

set -e

echo "Installing GLINRDOCK..."

# Check if running as root
if [[ $EUID -eq 0 ]]; then
    echo "Please don't run as root. Use a regular user with sudo privileges."
    exit 1
fi

# Create user and directories
sudo useradd -r -s /bin/false glinrdock || true
sudo mkdir -p /opt/glinrdock /var/lib/glinrdock /var/log/glinrdock
sudo chown -R glinrdock:glinrdock /var/lib/glinrdock /var/log/glinrdock

# Install binary
sudo cp bin/glinrdockd /usr/local/bin/
sudo chmod +x /usr/local/bin/glinrdockd

# Install configuration
sudo mkdir -p /etc/glinrdock
sudo cp -r etc/glinrdock/* /etc/glinrdock/

# Install scripts
sudo mkdir -p /opt/glinrdock
sudo cp -r scripts /opt/glinrdock/
sudo chmod +x /opt/glinrdock/scripts/*.sh

# Install systemd service
if command -v systemctl &> /dev/null; then
    sudo cp etc/glinrdock/glinrdock.service /etc/systemd/system/
    sudo systemctl daemon-reload
    sudo systemctl enable glinrdock
    echo "✅ GLINRDOCK installed successfully!"
    echo "   Start with: sudo systemctl start glinrdock"
else
    echo "✅ GLINRDOCK installed successfully!"
    echo "   Manual start: /usr/local/bin/glinrdockd"
fi

echo ""
echo "Next steps:"
echo "1. Configure: /etc/glinrdock/config.yml"
echo "2. Start service: sudo systemctl start glinrdock"
echo "3. Check status: sudo systemctl status glinrdock"
EOF

chmod +x $PACKAGE_DIR/install.sh

# Create uninstall script
cat > $PACKAGE_DIR/uninstall.sh << 'EOF'
#!/bin/bash
# GLINRDOCK Uninstallation Script

set -e

echo "Uninstalling GLINRDOCK..."

# Stop service
sudo systemctl stop glinrdock || true
sudo systemctl disable glinrdock || true

# Remove files
sudo rm -f /usr/local/bin/glinrdockd
sudo rm -rf /etc/glinrdock
sudo rm -rf /opt/glinrdock
sudo rm -f /etc/systemd/system/glinrdock.service

# Reload systemd
sudo systemctl daemon-reload || true

# Optional: Remove user and data
echo ""
echo "Remove user and data directories? (y/N)"
read -r REMOVE_DATA
if [[ "$REMOVE_DATA" =~ ^[Yy]$ ]]; then
    sudo userdel glinrdock || true
    sudo rm -rf /var/lib/glinrdock /var/log/glinrdock
    echo "✅ Complete removal finished"
else
    echo "✅ GLINRDOCK uninstalled (data preserved)"
fi
EOF

chmod +x $PACKAGE_DIR/uninstall.sh

# Create compressed archive
log_step "8. Creating compressed archive"

cd dist
ARCHIVE_NAME="glinrdock-$VERSION-$OS-$ARCH.tar.gz"

# Use .packageignore rules for exclusions
log_info "Creating compressed archive: $ARCHIVE_NAME"
tar --exclude-from=../.packageignore \
    -czf $ARCHIVE_NAME \
    glinrdock-$VERSION-$OS-$ARCH/

cd ..

# Generate checksums and metadata
log_step "9. Generating checksums and metadata"

cd dist
sha256sum $ARCHIVE_NAME > $ARCHIVE_NAME.sha256
md5sum $ARCHIVE_NAME > $ARCHIVE_NAME.md5

# Create metadata JSON
cat > glinrdock-$VERSION-$OS-$ARCH.json << EOF
{
    "name": "glinrdock",
    "version": "$VERSION",
    "os": "$OS",
    "arch": "$ARCH",
    "build_type": "$BUILD_TYPE",
    "build_time": "$(date -u -Iseconds)",
    "archive": "$ARCHIVE_NAME",
    "size_compressed": "$(get_file_size_bytes $ARCHIVE_NAME)",
    "size_human": "$(get_file_size_human $ARCHIVE_NAME)",
    "checksums": {
        "sha256": "$(cat $ARCHIVE_NAME.sha256 | cut -d' ' -f1)",
        "md5": "$(cat $ARCHIVE_NAME.md5 | cut -d' ' -f1)"
    },
    "contents": {
        "binary": "bin/glinrdockd",
        "install_script": "install.sh",
        "uninstall_script": "uninstall.sh",
        "documentation": "usr/share/doc/glinrdock/",
        "configuration": "etc/glinrdock/",
        "scripts": "scripts/"
    }
}
EOF

cd ..

# Final validation
log_step "10. Bundle validation"

FINAL_SIZE=$(get_file_size_human dist/$ARCHIVE_NAME)
FINAL_SIZE_BYTES=$(get_file_size_bytes dist/$ARCHIVE_NAME)

# Size check
if [[ $FINAL_SIZE_BYTES -gt 52428800 ]]; then  # 50MB
    log_warn "Bundle size $FINAL_SIZE exceeds 50MB target"
else
    log_info "✅ Bundle size $FINAL_SIZE is within target"
fi

# Test archive integrity
if tar -tzf dist/$ARCHIVE_NAME > /dev/null 2>&1; then
    log_info "✅ Archive integrity verified"
else
    log_error "❌ Archive integrity check failed"
    exit 1
fi

# Success summary
echo ""
log_info "🎉 Bundle created successfully!"
echo ""
echo -e "${BLUE}Bundle Information:${NC}"
echo "  📦 Package: dist/$ARCHIVE_NAME"
echo "  📊 Size: $FINAL_SIZE ($(format_bytes $FINAL_SIZE_BYTES))"
echo "  🏗️  Version: $VERSION"
echo "  🖥️  Platform: $OS-$ARCH"
echo "  🔧 Build Type: $BUILD_TYPE"
echo ""
echo -e "${BLUE}Installation:${NC}"
echo "  1. Extract: tar -xzf $ARCHIVE_NAME"
echo "  2. Install: cd glinrdock-$VERSION-$OS-$ARCH && sudo ./install.sh"
echo ""
echo -e "${BLUE}Verification:${NC}"
echo "  SHA256: $(cat dist/$ARCHIVE_NAME.sha256 | cut -d' ' -f1)"
echo "  MD5: $(cat dist/$ARCHIVE_NAME.md5 | cut -d' ' -f1)"

# Next steps
echo ""
log_info "Next steps:"
echo "  • Test installation on clean system"
echo "  • Upload to distribution channels"
echo "  • Update release notes"
echo "  • Notify users of new release"

log_info "Bundle build completed successfully! 🚀"