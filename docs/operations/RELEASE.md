# GlinrDock Release Process

This document describes the complete release process for GlinrDock, including artifact signing with cosign for supply chain security.

## Quick Start

For standard releases without signing:
```bash
make tools
make release-stage VERSION=v0.1.0
```

For signed releases:
```bash
# Setup cosign keys (see below)
export COSIGN_PASSWORD="your-private-key-password"
export COSIGN_KEY="$(cat cosign.key)"

make tools
make release-stage VERSION=v0.1.0
```

## Signing with Cosign

### Key Generation

Generate a cosign key pair for signing releases:

```bash
# Generate key pair
cosign generate-key-pair

# This creates:
# - cosign.key (private key - keep secure)
# - cosign.pub (public key - distribute for verification)
```

Store the private key securely and never commit it to version control.

### Environment Setup

For signing, set these environment variables:

```bash
export COSIGN_PASSWORD="your-private-key-password"
export COSIGN_KEY="$(cat path/to/cosign.key)"
```

### Signing Process

When both environment variables are set, the release process will automatically:

1. Sign the `SHA256SUMS` file creating `SHA256SUMS.sig`
2. Sign each tarball creating `.sig` files:
   - `glinrdockd_linux_amd64.tar.gz.sig`
   - `glinrdockd_linux_arm64.tar.gz.sig`
   - `glinrdockd_darwin_amd64.tar.gz.sig`
   - `glinrdockd_darwin_arm64.tar.gz.sig`

## Verification

### Verify Signatures

Users can verify signatures using your public key:

```bash
# Verify SHA256SUMS
cosign verify-blob --key cosign.pub --signature SHA256SUMS.sig SHA256SUMS

# Verify individual tarballs
cosign verify-blob --key cosign.pub --signature glinrdockd_linux_amd64.tar.gz.sig glinrdockd_linux_amd64.tar.gz
```

### Verify Checksums

After signature verification, verify file integrity:

```bash
# Verify all files at once
sha256sum -c SHA256SUMS

# Or verify individual files
sha256sum -c glinrdockd_linux_amd64.tar.gz.sha256
```

## Complete Release Workflow

### 1. Prerequisites

Install required tools:

```bash
# Check tools
make tools

# Install missing tools if needed
go install github.com/sigstore/cosign/v2/cmd/cosign@latest
curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin
```

### 2. Prepare Signing Keys

If you haven't already, generate cosign keys:

```bash
cosign generate-key-pair
# Enter password when prompted
# Save cosign.key securely, distribute cosign.pub for verification
```

### 3. Set Environment

```bash
export COSIGN_PASSWORD="your-private-key-password"
export COSIGN_KEY="$(cat cosign.key)"
```

### 4. Stage Release

```bash
make release-stage VERSION=v1.0.0
```

### 5. Verify Artifacts

```bash
cd ../glinrdock-release/_staging/v1.0.0/
ls -la  # Check all files are present

# Verify signatures
cosign verify-blob --key ../../cosign.pub --signature SHA256SUMS.sig SHA256SUMS

# Verify checksums
sha256sum -c SHA256SUMS
```

### 6. Distribute

Upload artifacts to GitHub releases or your distribution platform:

- All `.tar.gz` files (platform binaries)
- `SHA256SUMS` (checksums file)
- All `.sig` files (signatures)
- `cosign.pub` (public key for verification)
- `.sbom.spdx.json` files (if generated)

## Generated Artifacts

### With Signing Enabled

```
glinrdockd_linux_amd64.tar.gz
glinrdockd_linux_amd64.tar.gz.sig
glinrdockd_linux_amd64.tar.gz.sha256
glinrdockd_linux_arm64.tar.gz
glinrdockd_linux_arm64.tar.gz.sig
glinrdockd_linux_arm64.tar.gz.sha256
glinrdockd_darwin_amd64.tar.gz
glinrdockd_darwin_amd64.tar.gz.sig
glinrdockd_darwin_amd64.tar.gz.sha256
glinrdockd_darwin_arm64.tar.gz
glinrdockd_darwin_arm64.tar.gz.sig
glinrdockd_darwin_arm64.tar.gz.sha256
SHA256SUMS
SHA256SUMS.sig
*.sbom.spdx.json (if syft available)
```

### Without Signing

Same as above but without `.sig` files.

## Security Considerations

### Private Key Security

- Never commit private keys to version control
- Store private keys in secure key management systems
- Use strong passwords for key encryption
- Rotate keys regularly
- Consider using hardware security modules (HSMs) for production

### Distribution

- Distribute public keys through secure channels
- Consider publishing public key fingerprints on your website
- Use HTTPS for all artifact distribution
- Implement artifact retention policies

### Verification Instructions

Always provide clear verification instructions to users:

```bash
# Example verification workflow for users
wget https://releases.example.com/glinrdock/v1.0.0/glinrdockd_linux_amd64.tar.gz
wget https://releases.example.com/glinrdock/v1.0.0/glinrdockd_linux_amd64.tar.gz.sig
wget https://releases.example.com/glinrdock/v1.0.0/SHA256SUMS
wget https://releases.example.com/glinrdock/v1.0.0/SHA256SUMS.sig
wget https://releases.example.com/glinrdock/cosign.pub

# Verify signature
cosign verify-blob --key cosign.pub --signature glinrdockd_linux_amd64.tar.gz.sig glinrdockd_linux_amd64.tar.gz

# Verify checksum
grep glinrdockd_linux_amd64.tar.gz SHA256SUMS | sha256sum -c
```

## Troubleshooting

### Signing Failures

```bash
# Check cosign installation
cosign version

# Check environment variables
echo $COSIGN_PASSWORD  # Should show password
echo $COSIGN_KEY | head -1  # Should show "-----BEGIN ENCRYPTED COSIGN PRIVATE KEY-----"

# Test key manually
echo "test" | cosign sign-blob --key env://COSIGN_KEY --output-signature test.sig -
```

### Key Issues

```bash
# Test key can be loaded
cosign load-key --key cosign.key

# Generate new key pair if needed
cosign generate-key-pair --output-key-prefix mykey
```

### Verification Issues

```bash
# Check public key format
cat cosign.pub | head -1  # Should show "-----BEGIN PUBLIC KEY-----"

# Test verification manually
echo "test" > test.txt
cosign sign-blob --key env://COSIGN_KEY --output-signature test.sig test.txt
cosign verify-blob --key cosign.pub --signature test.sig test.txt
```

## CI/CD Integration

For automated releases, store keys securely:

### GitHub Actions Example

```yaml
env:
  COSIGN_PASSWORD: ${{ secrets.COSIGN_PASSWORD }}
  COSIGN_KEY: ${{ secrets.COSIGN_PRIVATE_KEY }}

steps:
  - name: Install cosign
    uses: sigstore/cosign-installer@v3
    
  - name: Stage release
    run: make release-stage VERSION=${{ github.ref_name }}
```

Store `COSIGN_PASSWORD` and `COSIGN_PRIVATE_KEY` as repository secrets.

## Migration from GPG

If migrating from GPG signing:

1. Generate cosign keys
2. Sign a test release with both GPG and cosign
3. Update documentation and verification instructions
4. Announce the transition with a reasonable overlap period
5. Eventually phase out GPG signatures

The current Makefile supports both cosign (preferred) and GPG (fallback) for compatibility.