# GlinrDock Release Process

Simple three-command release workflow for staging artifacts to the public repository.

> **Note:** For comprehensive release documentation including cosign signing, see [RELEASE.md](RELEASE.md).

## Quick Start

```bash
make tools
make release-stage VERSION=v0.1.0
ls ../glinrdock-release/_staging/v0.1.0
```

## Process Overview

The release staging pipeline builds statically-linked binaries for multiple platforms and packages them for public distribution.

### Supported Platforms
- linux/amd64
- linux/arm64  
- darwin/amd64
- darwin/arm64

### Generated Artifacts
- `glinrdockd_linux_amd64.tar.gz`
- `glinrdockd_linux_arm64.tar.gz`
- `glinrdockd_darwin_amd64.tar.gz`
- `glinrdockd_darwin_arm64.tar.gz`
- Individual `.sha256` checksum files
- Combined `SHA256SUMS` file
- SBOM files (`.sbom.spdx.json`) if syft is available

## Commands

### Check Tools
Verify all required tools are installed:
```bash
make tools
```

Required tools:
- Go compiler
- tar archiver
- sha256sum or shasum
- syft (optional, for SBOM generation)

### Stage Release
Build and stage artifacts for a specific version:
```bash
make release-stage VERSION=v0.1.0
```

Artifacts are staged to: `../glinrdock-release/_staging/v0.1.0/`

### Verify Staging
Check the staged artifacts:
```bash
ls -la ../glinrdock-release/_staging/v0.1.0/
```

Test checksum verification:
```bash
cd ../glinrdock-release/_staging/v0.1.0/
sha256sum -c SHA256SUMS
```

## Artifact Details

### Binary Compilation
- Static linking with `CGO_ENABLED=0`
- Symbol stripping with `-ldflags "-s -w"`
- Version metadata embedded in binary
- Git commit and build time included

### Archive Format
Each tarball contains a single flat binary:
```
glinrdockd_linux_amd64.tar.gz
└── glinrdockd_linux_amd64  # Static binary
```

### Checksums
- Individual `.sha256` files for each tarball
- Combined `SHA256SUMS` file for batch verification
- Compatible with `sha256sum -c` and `shasum -a 256 -c`

### SBOM Generation
Software Bill of Materials (SBOM) files are generated if syft is available:
- Format: SPDX JSON
- Filename: `glinrdockd_[os]_[arch].sbom.spdx.json`
- Contains dependency and license information

## Next Steps

After staging artifacts:

1. Review generated files
2. Test binaries on target platforms
3. Create GitHub release
4. Upload artifacts to GitHub release
5. Update installation scripts with new version
6. Publish release notes

## Troubleshooting

### Permission Errors
Ensure the sibling repository exists and is writable:
```bash
ls -la ../glinrdock-release/
mkdir -p ../glinrdock-release/_staging
```

### Missing Tools
Install missing dependencies:
```bash
# Install syft for SBOM generation
curl -sSfL https://raw.githubusercontent.com/anchore/syft/main/install.sh | sh -s -- -b /usr/local/bin
```

### Build Failures
Check Go environment and dependencies:
```bash
go version
go mod verify
go mod tidy
```