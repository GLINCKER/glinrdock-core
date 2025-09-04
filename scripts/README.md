# Scripts Directory

This directory contains utility scripts for GlinrDock development and release management.

## Release Scripts

### publish_to_public.sh

**Purpose**: Copies staged release artifacts to the public glinrdock-release repository and optionally creates a PR to update documentation references.

**Usage**:
```bash
# Stage artifacts first
make release-stage VERSION=v1.0.0

# Copy to public repo (artifacts only)
./scripts/publish_to_public.sh v1.0.0

# Copy to public repo and create PR with version updates
GH_TOKEN=ghp_xxx ./scripts/publish_to_public.sh v1.0.0 --open-pr
```

**Workflow**:
1. Verifies that `_staging/VERSION` exists in the public repo (created by `make release-stage`)
2. Validates staged artifacts (tarballs, checksums, etc.)
3. If `--open-pr` is specified:
   - Creates a branch in the public repo
   - Updates `docs/QUICKSTART.md` with new version references
   - Opens a PR with a standard description

**Requirements**:
- For basic operation: Staged artifacts in `../glinrdock-release/_staging/VERSION`
- For `--open-pr`: GitHub CLI (`gh`) and `GH_TOKEN` environment variable

## Development Scripts

### install.sh
Legacy installation script (see public repo for current version)

### Other Scripts
- `commit_msg_lint.sh` - Git commit message linting
- `install_lefthook.sh` - Git hooks installation
- `short_run.sh` - Quick development run helper

## Typical Release Workflow

```bash
# 1. Stage release artifacts from private repo
make release-stage VERSION=v1.0.0

# 2. Copy to public repo and create PR
GH_TOKEN=ghp_xxx ./scripts/publish_to_public.sh v1.0.0 --open-pr

# 3. Review and merge PR in public repo

# 4. Create GitHub release and upload artifacts
# (This step is typically done through GitHub UI or separate automation)
```

This workflow provides a clean handoff from private development to public release distribution.