#!/bin/bash
set -e

LEFTHOOK_VERSION="1.5.2"
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

# Map architecture names
case $ARCH in
    x86_64) ARCH="x86_64" ;;
    arm64|aarch64) ARCH="arm64" ;;
    *) echo "Unsupported architecture: $ARCH"; exit 1 ;;
esac

# Download URL
URL="https://github.com/evilmartians/lefthook/releases/download/v${LEFTHOOK_VERSION}/lefthook_${LEFTHOOK_VERSION}_${OS}_${ARCH}"

# Download to /usr/local/bin
echo "📥 Downloading lefthook v${LEFTHOOK_VERSION} for ${OS}/${ARCH}..."
if command -v curl >/dev/null 2>&1; then
    sudo curl -L "$URL" -o /usr/local/bin/lefthook
elif command -v wget >/dev/null 2>&1; then
    sudo wget "$URL" -O /usr/local/bin/lefthook
else
    echo "❌ Neither curl nor wget found. Please install one of them."
    exit 1
fi

# Make executable
sudo chmod +x /usr/local/bin/lefthook

# Verify installation
if lefthook version >/dev/null 2>&1; then
    echo "✅ lefthook installed successfully: $(lefthook version)"
else
    echo "❌ lefthook installation failed"
    exit 1
fi

# Install hooks
echo "🔗 Installing git hooks..."
lefthook install

echo "🎉 Setup complete! Git hooks are now active."
echo ""
echo "Next steps:"
echo "  - Commit messages will be validated automatically"
echo "  - Pre-commit hooks will run fmt, vet, and lint"
echo "  - Pre-push hooks will run tests with race detection"