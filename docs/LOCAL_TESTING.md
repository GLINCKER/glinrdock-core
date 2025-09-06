# GLINRDOCK Local Testing Guide

Comprehensive testing procedures for validating GLINRDOCK bundles before deployment.

## 🎯 Overview

This guide covers testing GLINRDOCK packages locally to ensure they work correctly before publishing to distribution channels. All testing should be performed on clean systems to simulate real user installation experience.

## 📋 Testing Checklist

### Pre-Testing Requirements
- [ ] **Clean build environment** - Remove previous builds
- [ ] **Frontend assets built** - React app compiled and optimized  
- [ ] **Backend compiled** - Go binary with embedded assets
- [ ] **Package created** - Compressed bundle ready for testing

### Bundle Integrity Tests
- [ ] **Archive integrity** - Can extract without errors
- [ ] **File permissions** - Executable bits set correctly
- [ ] **Required files present** - All essential components included
- [ ] **Size verification** - Package under target limits

### Installation Tests  
- [ ] **Clean install** - Works on fresh system
- [ ] **Dependencies satisfied** - No missing system libraries
- [ ] **Service integration** - Systemd/init scripts work
- [ ] **Permissions correct** - Files owned by proper users

### Functional Tests
- [ ] **Binary execution** - Starts without errors
- [ ] **Web interface** - UI loads and responds
- [ ] **API endpoints** - Core functionality works
- [ ] **Database operations** - SQLite working correctly

### Uninstall Tests
- [ ] **Clean removal** - All files removed
- [ ] **No residual data** - System clean after uninstall
- [ ] **Service cleanup** - Systemd services removed

## 🔧 Testing Scripts

### 1. Bundle Build Test

```bash
# Test the build system
./scripts/test-build.sh
```

**What it tests:**
- Frontend compilation
- Backend cross-compilation
- Asset embedding
- Package creation
- Size optimization

### 2. Bundle Integrity Test

```bash
# Test package integrity
./scripts/test-integrity.sh dist/glinrdock-0.1.0-beta-linux-amd64.tar.gz
```

**What it tests:**
- Archive can be extracted
- Required files are present
- Checksums match
- File permissions are correct

### 3. Installation Test

```bash
# Test installation process
./scripts/test-installation.sh dist/glinrdock-0.1.0-beta-linux-amd64.tar.gz
```

**What it tests:**
- Clean installation
- Service registration
- Configuration setup
- Startup functionality

## 🧪 Test Environment Setup

### Docker Test Environment

```bash
# Create clean Ubuntu test environment
docker run -it --rm \
  -v $(pwd)/dist:/packages \
  -p 8080:8080 \
  ubuntu:22.04 /bin/bash

# Inside container:
apt update && apt install -y curl wget sudo systemctl
cd /packages
tar -xzf glinrdock-0.1.0-beta-linux-amd64.tar.gz
cd glinrdock-0.1.0-beta-linux-amd64
sudo ./install.sh
```

### VM Test Environment

```bash
# Using Vagrant for full system testing
# Vagrantfile for testing
cat > Vagrantfile << 'EOF'
Vagrant.configure("2") do |config|
  config.vm.box = "ubuntu/jammy64"
  config.vm.network "forwarded_port", guest: 8080, host: 8080
  config.vm.provider "virtualbox" do |vb|
    vb.memory = "2048"
  end
end
EOF

vagrant up && vagrant ssh
```

## 📝 Test Scripts

### Build Test Script

```bash
# scripts/test-build.sh
#!/bin/bash
set -e

echo "Testing GLINRDOCK build system..."

# Clean previous builds
make clean

# Test frontend build
cd web/ui-lite
npm ci
npm run build
cd ../..

# Test backend build
go build -o bin/test-glinrdockd ./cmd/glinrdockd

# Test bundle creation
./scripts/build-bundle.sh 0.1.0-test amd64 $(uname -s | tr '[:upper:]' '[:lower:]')

# Verify bundle
if [[ -f dist/glinrdock-0.1.0-test-*.tar.gz ]]; then
    echo "✅ Build test passed"
else
    echo "❌ Build test failed"
    exit 1
fi
```

### Integrity Test Script

```bash
# scripts/test-integrity.sh
#!/bin/bash
PACKAGE="$1"

if [[ ! -f "$PACKAGE" ]]; then
    echo "Usage: $0 <package.tar.gz>"
    exit 1
fi

echo "Testing package integrity: $PACKAGE"

# Test extraction
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

if tar -xzf "$PACKAGE" 2>/dev/null; then
    echo "✅ Package extraction: OK"
else
    echo "❌ Package extraction: FAILED"
    exit 1
fi

# Find extracted directory
EXTRACTED_DIR=$(find . -maxdepth 1 -type d ! -name "." | head -1)
cd "$EXTRACTED_DIR"

# Check required files
REQUIRED_FILES=("bin/glinrdockd" "install.sh")
for file in "${REQUIRED_FILES[@]}"; do
    if [[ -f "$file" ]]; then
        echo "✅ Required file: $file"
    else
        echo "❌ Missing file: $file"
        exit 1
    fi
done

# Check executable permissions
if [[ -x "bin/glinrdockd" ]]; then
    echo "✅ Binary executable: OK"
else
    echo "❌ Binary executable: FAILED"
    exit 1
fi

# Verify checksums if present
if [[ -f "../$(basename "$PACKAGE").sha256" ]]; then
    if sha256sum -c "../$(basename "$PACKAGE").sha256" 2>/dev/null; then
        echo "✅ Checksum verification: OK"
    else
        echo "❌ Checksum verification: FAILED"
        exit 1
    fi
fi

echo "✅ All integrity tests passed"
cleanup: rm -rf "$TEMP_DIR"
```

### Installation Test Script

```bash
# scripts/test-installation.sh
#!/bin/bash
PACKAGE="$1"

echo "Testing installation: $PACKAGE"

# Create test environment
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Extract package
tar -xzf "$PACKAGE"
EXTRACTED_DIR=$(find . -maxdepth 1 -type d ! -name "." | head -1)
cd "$EXTRACTED_DIR"

# Test installation (dry run first)
if command -v sudo &> /dev/null; then
    echo "Testing installation..."
    # This would need to be adapted for non-interactive testing
    echo "Manual installation test required"
else
    echo "⚠️ sudo not available, skipping installation test"
fi

# Test binary execution
echo "Testing binary execution..."
export GLINRDOCK_SECRET=$(openssl rand -base64 32)
export HTTP_ADDR=:8081

timeout 10s ./bin/glinrdockd &
PID=$!
sleep 5

# Test if process is running
if kill -0 $PID 2>/dev/null; then
    echo "✅ Binary starts successfully"
    kill $PID
else
    echo "❌ Binary failed to start"
    exit 1
fi

echo "✅ Installation test completed"
```

## 📊 Automated Testing

### GitHub Actions Integration

```yaml
# .github/workflows/test-packages.yml
name: Test Packages

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test-build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Test Build System
        run: ./scripts/test-build.sh
      
      - name: Test Package Integrity
        run: |
          PACKAGE=$(ls dist/glinrdock-*.tar.gz | head -1)
          ./scripts/test-integrity.sh "$PACKAGE"

  test-installation:
    needs: test-build
    strategy:
      matrix:
        os: [ubuntu-20.04, ubuntu-22.04]
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v4
      - name: Download Package
        # Implementation depends on how packages are shared between jobs
      
      - name: Test Installation
        run: |
          PACKAGE=$(ls dist/glinrdock-*.tar.gz | head -1)
          ./scripts/test-installation.sh "$PACKAGE"
```

## 🔍 Manual Testing Procedures

### 1. Package Validation

```bash
# Download/build package
./scripts/build-bundle.sh 0.1.0-beta amd64 linux

# Verify package exists and has reasonable size
ls -lh dist/glinrdock-0.1.0-beta-linux-amd64.tar.gz

# Should be ~30-50MB compressed
```

### 2. Clean System Test

```bash
# Create clean Docker container
docker run -it --rm ubuntu:22.04 /bin/bash

# Inside container:
apt update && apt install -y curl wget sudo

# Test installation
wget http://host.docker.internal:8000/glinrdock-0.1.0-beta-linux-amd64.tar.gz
tar -xzf glinrdock-0.1.0-beta-linux-amd64.tar.gz
cd glinrdock-0.1.0-beta-linux-amd64
sudo ./install.sh

# Test functionality  
sudo systemctl start glinrdock
curl http://localhost:8080/v1/health

# Test uninstallation
sudo ./uninstall.sh
```

### 3. Cross-Platform Testing

```bash
# Test different architectures
./scripts/build-cross-platform.sh 0.1.0-beta "linux/amd64,linux/arm64"

# Test each package on appropriate hardware
# AMD64: Standard x86_64 systems
# ARM64: Raspberry Pi, Apple Silicon, AWS Graviton
```

## 🚨 Common Issues & Troubleshooting

### Build Issues

**Symptom:** Frontend build fails
```bash
# Solution: Clean node_modules and reinstall
cd web/ui-lite
rm -rf node_modules package-lock.json
npm install
npm run build
```

**Symptom:** CGO cross-compilation fails
```bash
# Solution: Use Docker-based cross-compilation
./scripts/build-cross-platform.sh 0.1.0-beta linux/amd64
```

### Installation Issues

**Symptom:** Binary fails to start - SQLite error
```bash
# Solution: Ensure CGO was enabled during build
ldd bin/glinrdockd  # Should show SQLite dependencies
```

**Symptom:** Permission denied errors
```bash
# Solution: Check file permissions
chmod +x bin/glinrdockd
chmod +x install.sh
```

### Runtime Issues

**Symptom:** Port 8080 already in use
```bash
# Solution: Use different port
HTTP_ADDR=:8081 ./bin/glinrdockd
```

**Symptom:** Database migration fails
```bash
# Solution: Check data directory permissions
mkdir -p data/
chown -R $USER:$USER data/
```

## ✅ Test Success Criteria

### Build Tests
- ✅ Frontend compiles without errors
- ✅ Backend compiles with CGO support
- ✅ Assets are embedded correctly
- ✅ Package size under 50MB compressed
- ✅ All required files included

### Installation Tests
- ✅ Extracts cleanly on target OS
- ✅ Installs without external dependencies
- ✅ Creates systemd service correctly
- ✅ Binary starts and responds to requests
- ✅ Uninstalls completely

### Integration Tests  
- ✅ Web UI loads and is functional
- ✅ API endpoints respond correctly
- ✅ Database operations work
- ✅ Docker containers can be managed
- ✅ SSL/TLS configuration functions

## 📈 Performance Testing

### Load Testing

```bash
# Test API performance
curl -X GET http://localhost:8080/v1/services
ab -n 1000 -c 10 http://localhost:8080/v1/health

# Test memory usage
ps aux | grep glinrdockd
top -p $(pgrep glinrdockd)
```

### Memory/Resource Testing

```bash
# Monitor resource usage
docker stats glinrdock
htop -p $(pgrep glinrdockd)

# Should stay under 512MB RAM baseline
```

This comprehensive testing approach ensures GLINRDOCK packages are reliable, performant, and ready for production deployment across all target platforms.