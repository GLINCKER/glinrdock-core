#!/bin/bash

# Local ARM64 Docker build script for Mac
# GitHub Actions ARM64 emulation takes 6+ hours, but Mac native takes ~30 seconds

set -e

VERSION=${1:-"latest"}
REGISTRY="ghcr.io"
IMAGE_NAME="glincker/glinrdock"

echo "🏗️  Building ARM64 image locally (fast on Mac native ARM64)"
echo "Version: $VERSION"

# Build ARM64 image locally
docker buildx build \
    --platform linux/arm64 \
    -f Dockerfile.builder \
    --build-arg VERSION="$VERSION" \
    -t ${REGISTRY}/${IMAGE_NAME}:${VERSION}-arm64 \
    --push \
    .

echo "✅ ARM64 build complete in ~30 seconds!"
echo "📦 Image: ${REGISTRY}/${IMAGE_NAME}:${VERSION}-arm64"

# If you want to create multi-platform manifest:
echo "🔄 To create multi-platform manifest, run:"
echo "docker buildx imagetools create \\"
echo "  --tag ${REGISTRY}/${IMAGE_NAME}:${VERSION} \\"
echo "  --tag ${REGISTRY}/${IMAGE_NAME}:latest \\"
echo "  ${REGISTRY}/${IMAGE_NAME}:${VERSION}-amd64 \\"
echo "  ${REGISTRY}/${IMAGE_NAME}:${VERSION}-arm64"