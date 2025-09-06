# GLINRDOCK Bundle Optimization Guide

Comprehensive guide for creating lightweight, optimized packages for distribution across multiple channels.

## 🎯 Bundle Size Targets

### Size Goals
- **Compressed Package**: <50MB (target: 30-40MB)
- **Uncompressed Binary**: <80MB (target: 60-70MB)
- **Memory Footprint**: <512MB RAM (target: 256-384MB)
- **Disk Usage**: <200MB after installation (target: 150MB)

### Current Size Analysis
```bash
# Analyze current build
./scripts/analyze-bundle-size.sh

# Expected breakdown:
# - Go binary: ~40MB (with embedded assets)
# - Frontend assets: ~15MB (minified)
# - Documentation: ~2MB
# - Scripts and configs: ~1MB
# Total: ~58MB uncompressed → ~25MB compressed
```

## 📦 What Gets Included in Bundles

### ✅ Production Essentials
```
bin/
├── glinrdockd                    # Main binary (Linux)
├── glinrdockd.exe               # Windows binary
└── glinrdockd-darwin            # macOS binary

configs/
├── default.yml                  # Default configuration
├── docker-compose.prod.yml      # Production Docker setup
└── nginx-template.conf          # Nginx template

scripts/
├── install.sh                   # Installation script
├── setup-ssl.sh                # SSL setup
├── backup.sh                    # Backup utility
└── uninstall.sh                # Clean uninstall

docs/
├── README.md                    # User documentation
├── QUICKSTART.md               # Getting started
└── TROUBLESHOOTING.md          # Common issues

LICENSE                          # Software license
CHANGELOG.md                    # Version history
```

### ❌ Development Files Excluded
```
# Build and development
node_modules/                    # 200MB+ of dependencies
web/ui-lite/src/                # Source TypeScript files
web/ui-lite/node_modules/       # Frontend dependencies
.git/                           # Version control (50MB+)
coverage/                       # Test coverage reports
test/                          # Test files and data

# Temporary and cache files
*.log                          # Log files
*.tmp                          # Temporary files
.cache/                        # Build caches
dev-data/                      # Development database

# IDE and editor files
.vscode/                       # VSCode settings
.idea/                         # IntelliJ settings
*.swp, *.swo                   # Vim swap files

# CI/CD files
.github/workflows/             # GitHub Actions
docker-compose.dev.yml         # Development Docker
Dockerfile.dev                 # Development containers
```

## 🔧 Build Optimization Strategies

### 1. Go Binary Optimization

#### Compiler Flags
```bash
# Production build with optimization
go build -ldflags="-s -w -X main.version=${VERSION}" \
  -trimpath \
  -buildmode=pie \
  -o bin/glinrdockd \
  ./cmd/glinrdockd

# Flags explanation:
# -s: Strip symbol table and debug info
# -w: Strip DWARF debug info  
# -trimpath: Remove build path from binary
# -buildmode=pie: Position Independent Executable
```

#### UPX Compression (Optional)
```bash
# Further compress binary (use with caution)
upx --best --lzma bin/glinrdockd
# Can reduce size by 30-50% but may impact startup time
```

### 2. Frontend Asset Optimization

#### Build Configuration
```javascript
// vite.config.ts optimization
export default defineConfig({
  build: {
    target: 'es2020',
    minify: 'terser',
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: undefined, // Single chunk for embedding
      }
    },
    terserOptions: {
      compress: {
        drop_console: true,    // Remove console.logs
        drop_debugger: true,   // Remove debuggers
        pure_funcs: ['console.log', 'console.debug']
      }
    }
  }
})
```

#### Asset Optimization
```bash
# Optimize images and static assets
imagemin "web/ui-lite/public/**/*.{png,jpg,jpeg}" \
  --out-dir="web/ui-lite/dist/optimized"

# Gzip static assets for embedding
gzip -9 web/ui-lite/dist/assets/*.js
gzip -9 web/ui-lite/dist/assets/*.css
```

### 3. Dependency Pruning

#### Go Dependencies
```bash
# Clean up unused dependencies
go mod tidy
go mod vendor # Optional: vendor for air-gapped builds

# Analyze dependency sizes
go list -m -f '{{.Path}} {{.Version}}' all | sort
```

#### Frontend Dependencies
```bash
# Audit and remove unused packages
npm audit --audit-level=high
npm run depcheck  # Check for unused dependencies
npm prune --production
```

## 🗂️ Package Structure Layout

### Directory Structure
```
glinrdock-1.0.0/
├── bin/
│   └── glinrdockd                 # Main executable
├── etc/
│   ├── glinrdock/
│   │   ├── config.yml            # Default config
│   │   └── templates/            # Configuration templates
│   └── systemd/
│       └── glinrdock.service     # Systemd service
├── usr/
│   ├── share/
│   │   ├── doc/
│   │   │   └── glinrdock/        # Documentation
│   │   └── man/
│   │       └── man1/
│   │           └── glinrdock.1   # Man page
│   └── local/
│       └── bin/
│           └── glinrdock -> /bin/glinrdockd
├── var/
│   └── lib/
│       └── glinrdock/            # Data directory
├── opt/
│   └── glinrdock/
│       ├── scripts/              # Utility scripts
│       └── examples/             # Example configurations
└── install.sh                    # Installation script
```

### FHS Compliance
Following Filesystem Hierarchy Standard for Linux compatibility:
- **Binaries**: `/usr/local/bin/` or `/opt/glinrdock/bin/`
- **Configuration**: `/etc/glinrdock/`
- **Data**: `/var/lib/glinrdock/`
- **Documentation**: `/usr/share/doc/glinrdock/`
- **Logs**: `/var/log/glinrdock/`

## ✅ Pre-packaging Checklist

### Build Verification
- [ ] **Frontend Built**: React app compiled and optimized
- [ ] **Backend Compiled**: Go binary built for target architecture
- [ ] **Assets Embedded**: Frontend assets embedded in Go binary
- [ ] **No Debug Info**: Debug symbols stripped from binary
- [ ] **Dependencies Bundled**: All dependencies included or vendored

### Security Checks
- [ ] **No Secrets**: No hardcoded credentials or API keys
- [ ] **No Dev Files**: Development-only files excluded
- [ ] **Permissions Set**: Correct file permissions (755 for executables)
- [ ] **Signature Ready**: Binary ready for code signing
- [ ] **SBOM Generated**: Software Bill of Materials created

### Size Optimization
- [ ] **Size Target Met**: Package under target size limits
- [ ] **Compression Applied**: Gzip/compression used where appropriate
- [ ] **Unused Code Removed**: Dead code elimination performed
- [ ] **Asset Optimization**: Images and static files optimized
- [ ] **Documentation Minimal**: Only essential docs included

### Functionality Testing
- [ ] **Clean Install**: Installs without external dependencies
- [ ] **Default Config**: Runs with default configuration
- [ ] **Service Integration**: Systemd/init scripts work correctly
- [ ] **Uninstall Clean**: Removes all files on uninstall
- [ ] **Upgrade Path**: Can upgrade from previous versions

## 🚀 Automated Bundle Creation

### Build Script Template
```bash
#!/bin/bash
# scripts/build-bundle.sh

set -e

VERSION=${1:-"0.1.0-beta"}
ARCH=${2:-"amd64"}
OS=${3:-"linux"}

echo "Building GLINRDOCK v$VERSION for $OS-$ARCH"

# Clean previous builds
make clean

# Build frontend
echo "Building frontend..."
cd web/ui-lite
npm ci --production
npm run build
cd ../..

# Embed frontend assets
echo "Embedding assets..."
go generate ./...

# Build optimized binary
echo "Building optimized binary..."
CGO_ENABLED=1 \
GOOS=$OS \
GOARCH=$ARCH \
go build \
  -ldflags="-s -w -X main.version=$VERSION -X main.buildTime=$(date -u '+%Y-%m-%d_%H:%M:%S')" \
  -trimpath \
  -o bin/glinrdockd-$OS-$ARCH \
  ./cmd/glinrdockd

# Create package directory structure
echo "Creating package structure..."
PACKAGE_DIR="dist/glinrdock-$VERSION-$OS-$ARCH"
mkdir -p $PACKAGE_DIR/{bin,etc/glinrdock,usr/share/doc/glinrdock,scripts}

# Copy files following .packageignore
echo "Copying package files..."
cp bin/glinrdockd-$OS-$ARCH $PACKAGE_DIR/bin/glinrdockd
cp scripts/{install,setup-ssl,backup,uninstall}.sh $PACKAGE_DIR/scripts/
cp docs/{README,QUICKSTART,TROUBLESHOOTING}.md $PACKAGE_DIR/usr/share/doc/glinrdock/
cp docker-compose.prod.yml $PACKAGE_DIR/etc/glinrdock/

# Set permissions
chmod +x $PACKAGE_DIR/bin/glinrdockd
chmod +x $PACKAGE_DIR/scripts/*.sh

# Create archive
echo "Creating compressed archive..."
cd dist
tar -czf glinrdock-$VERSION-$OS-$ARCH.tar.gz glinrdock-$VERSION-$OS-$ARCH/
cd ..

# Generate checksums
echo "Generating checksums..."
cd dist
sha256sum glinrdock-$VERSION-$OS-$ARCH.tar.gz > glinrdock-$VERSION-$OS-$ARCH.sha256
cd ..

echo "✅ Bundle created: dist/glinrdock-$VERSION-$OS-$ARCH.tar.gz"
echo "📊 Size: $(du -h dist/glinrdock-$VERSION-$OS-$ARCH.tar.gz | cut -f1)"
```

### Size Analysis Script
```bash
#!/bin/bash
# scripts/analyze-bundle-size.sh

echo "GLINRDOCK Bundle Size Analysis"
echo "=============================="

if [[ ! -f bin/glinrdockd ]]; then
    echo "❌ Binary not found. Run 'make build' first."
    exit 1
fi

echo "Binary Analysis:"
echo "  Size: $(du -h bin/glinrdockd | cut -f1)"
echo "  Stripped: $(file bin/glinrdockd | grep -q 'not stripped' && echo '❌ No' || echo '✅ Yes')"

if command -v objdump &> /dev/null; then
    echo "  Sections:"
    objdump -h bin/glinrdockd | grep -E '\.(text|data|rodata)' | while read line; do
        section=$(echo $line | awk '{print $2}')
        size=$(echo $line | awk '{print $3}')
        size_mb=$((0x$size / 1024 / 1024))
        printf "    %-10s %s (%d MB)\n" $section "0x$size" $size_mb
    done
fi

echo ""
echo "Frontend Assets:"
if [[ -d web/ui-lite/dist ]]; then
    find web/ui-lite/dist -name "*.js" -o -name "*.css" | while read file; do
        echo "  $(basename $file): $(du -h $file | cut -f1)"
    done
else
    echo "  ❌ Frontend not built"
fi

echo ""
echo "Package Contents:"
if [[ -d dist ]]; then
    find dist -name "*.tar.gz" | head -3 | while read archive; do
        echo "  $(basename $archive): $(du -h $archive | cut -f1)"
    done
else
    echo "  ❌ No packages built"
fi

echo ""
echo "Optimization Suggestions:"
if [[ $(stat -f%z bin/glinrdockd 2>/dev/null || stat -c%s bin/glinrdockd) -gt 52428800 ]]; then
    echo "  ⚠️  Binary >50MB - consider UPX compression"
fi

if file bin/glinrdockd | grep -q 'not stripped'; then
    echo "  ⚠️  Binary not stripped - use -ldflags='-s -w'"
fi

echo "  ✅ Current build looks optimized"
```

## 📋 Platform-Specific Considerations

### Linux Packages (.deb/.rpm)
```bash
# Additional optimizations for native packages
# - Split into multiple packages (glinrdock, glinrdock-docs)
# - Use package manager compression
# - Include post-install scripts
# - Set up proper file ownership
```

### Snap Packages
```yaml
# snapcraft.yaml optimizations
parts:
  glinrdock:
    plugin: dump
    source: ./dist/
    stage:
      - -usr/share/doc  # Docs handled separately
    organize:
      bin/glinrdock: bin/glinrdockd
```

### Docker Images
```dockerfile
# Multi-stage Dockerfile for minimal image
FROM alpine:latest AS final
RUN apk --no-cache add ca-certificates
COPY --from=builder /app/bin/glinrdockd /usr/local/bin/
EXPOSE 8080
USER 1000:1000
ENTRYPOINT ["/usr/local/bin/glinrdockd"]
```

## 🎯 Bundle Quality Gates

### Automated Checks
```bash
# Pre-release validation
scripts/validate-bundle.sh dist/glinrdock-*.tar.gz

# Checks:
# ✅ Size under 50MB
# ✅ No debug symbols
# ✅ All required files present
# ✅ Executable permissions correct
# ✅ No development files included
# ✅ Documentation complete
# ✅ Installation script works
# ✅ Uninstall script clean
```

### Manual Verification
1. **Fresh System Test**: Install on clean OS instance
2. **Dependency Check**: Ensure no missing system libraries
3. **Performance Test**: Verify startup time <10 seconds
4. **Memory Check**: Baseline memory usage <512MB
5. **Cleanup Test**: Complete removal via uninstall script

This optimization strategy ensures GLINRDOCK packages are lightweight, secure, and ready for distribution across all target platforms.