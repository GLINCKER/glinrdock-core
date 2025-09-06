# Repository Secrets Configuration Guide

This document provides step-by-step instructions for configuring the required repository secrets to enable automated package publishing in your GLINRDOCK deployment pipeline.

## Required Secrets

### 1. RELEASE_PAT (Required)

The `RELEASE_PAT` is a Personal Access Token that allows the GitHub Actions workflow to:
- Create releases in the public `GLINCKER/glinrdock` repository
- Push release files and commits to that repository
- Access the repository from the private `glinrdock-core` repository

**Required Permissions:**
- `public_repo` - Access to public repositories
- `write:packages` - Upload packages to GitHub Package Registry
- `contents:write` - Create releases and push commits

## Setup Instructions

### Step 1: Create Personal Access Token

1. **Go to GitHub Settings:**
   - Navigate to https://github.com/settings/tokens
   - Or: GitHub Profile → Settings → Developer settings → Personal access tokens → Tokens (classic)

2. **Generate New Token:**
   - Click "Generate new token" → "Generate new token (classic)"
   - **Note:** Enter a descriptive name like "GLINRDOCK Release Automation"
   - **Expiration:** Set to "No expiration" or a long-term date (recommended: 1 year)

3. **Select Required Scopes:**
   ```
   ☑ public_repo
       ☑ Access public repositories
   
   ☑ write:packages
       ☑ Upload packages to GitHub Package Registry
   
   ☑ repo (if you need private repo access)
       ☑ Full control of private repositories
       ☑ repo:status
       ☑ repo_deployment
       ☑ public_repo
   ```

4. **Generate and Copy Token:**
   - Click "Generate token"
   - **IMPORTANT:** Copy the token immediately - you won't see it again
   - Store it securely (recommended: use a password manager)

### Step 2: Configure Repository Secret

1. **Navigate to Repository Settings:**
   - Go to your `glinrdock-core` repository
   - Click "Settings" tab
   - In the left sidebar, click "Secrets and variables" → "Actions"

2. **Add New Repository Secret:**
   - Click "New repository secret"
   - **Name:** `RELEASE_PAT`
   - **Secret:** Paste the Personal Access Token you created
   - Click "Add secret"

### Step 3: Verify Target Repository Access

1. **Ensure GLINCKER/glinrdock Repository Exists:**
   - The public repository `GLINCKER/glinrdock` must exist
   - The Personal Access Token owner must have write access to this repository
   - If the repository doesn't exist, create it first

2. **Test Token Permissions:**
   You can verify the token works by testing it with curl:
   ```bash
   curl -H "Authorization: token YOUR_TOKEN_HERE" \
        -H "Accept: application/vnd.github.v3+json" \
        https://api.github.com/repos/GLINCKER/glinrdock
   ```

## Automated Package Manager Secrets (Optional)

The following secrets are optional and can be added later when you want to enable automated publishing to package managers:

### HOMEBREW_TOKEN
- **Purpose:** Automated Homebrew formula publishing
- **How to get:** Contact Homebrew maintainers or use GitHub App
- **Scope:** Used for `brew` package publishing

### SNAPCRAFT_TOKEN  
- **Purpose:** Automated Snap Store publishing
- **How to get:** `snapcraft export-login --snaps=glinrdock --channels=stable,beta`
- **Scope:** Used for `snap` package publishing

### FLATHUB_TOKEN
- **Purpose:** Automated Flathub publishing  
- **How to get:** Contact Flathub maintainers
- **Scope:** Used for Flatpak publishing

### DOCKER_HUB_TOKEN (Optional)
- **Purpose:** Docker Hub publishing (alternative to GitHub Container Registry)
- **How to get:** Docker Hub → Account Settings → Security → New Access Token
- **Scope:** Used for additional Docker registry publishing

## Security Best Practices

### Token Security
- ✅ Use tokens with minimal required permissions
- ✅ Set reasonable expiration dates (1 year maximum)
- ✅ Rotate tokens regularly
- ✅ Never commit tokens to code or logs
- ✅ Use repository secrets, not environment variables in code

### Access Control
- ✅ Only add collaborators who need release access
- ✅ Use separate tokens for different purposes
- ✅ Monitor token usage in GitHub audit logs
- ✅ Revoke tokens immediately if compromised

### Monitoring
- ✅ Enable security alerts for the repository
- ✅ Review GitHub Actions logs for unusual activity  
- ✅ Set up notifications for release workflow failures
- ✅ Audit token permissions quarterly

## Verification Steps

### 1. Test Manual Workflow Trigger

After setting up the secrets, test the release workflow:

1. **Go to Actions Tab:**
   - Navigate to your repository → Actions
   - Select "Build & Release" workflow

2. **Run Workflow Manually:**
   - Click "Run workflow"
   - Enter version: `0.1.0-test`
   - Click "Run workflow"

3. **Monitor Execution:**
   - Watch each job complete successfully
   - Check that artifacts are uploaded
   - Verify release is created in GLINCKER/glinrdock

### 2. Test Automatic Trigger

Create a test release tag:

```bash
git tag v0.1.0-test
git push origin v0.1.0-test
```

The workflow should trigger automatically and complete all steps.

### 3. Verify Published Assets

Check the GLINCKER/glinrdock repository for:
- ✅ New release directory under `releases/0.1.0-test/`
- ✅ Binary packages (.tar.gz files)
- ✅ Checksums (.sha256 files)
- ✅ Updated `latest` symlink
- ✅ GitHub release with proper description

## Troubleshooting

### Common Issues

**Error: "Resource not accessible by integration"**
- Solution: Personal Access Token lacks required permissions
- Fix: Add `public_repo` and `contents:write` permissions

**Error: "Repository not found"**
- Solution: Target repository doesn't exist or token lacks access
- Fix: Create GLINCKER/glinrdock repository or fix permissions

**Error: "Authentication failed"**
- Solution: Token expired or invalid
- Fix: Generate new token and update secret

**Error: "Rate limit exceeded"**
- Solution: GitHub API rate limits
- Fix: Wait or use GitHub App instead of Personal Access Token

### Debug Commands

Check token validity:
```bash
curl -H "Authorization: token $RELEASE_PAT" \
     https://api.github.com/user
```

Check repository access:
```bash
curl -H "Authorization: token $RELEASE_PAT" \
     https://api.github.com/repos/GLINCKER/glinrdock
```

## Next Steps

Once secrets are configured and tested:

1. **Enable Package Manager Publishing:**
   - Add optional tokens for Homebrew, Snap, etc.
   - Change `if: false` to `if: true` in package-managers job

2. **Set Up Monitoring:**
   - Configure GitHub notifications for workflow failures
   - Set up status badges for release health
   - Monitor download statistics

3. **Documentation:**
   - Update README with installation instructions
   - Create user documentation for releases
   - Document the release process for team members

## Support

If you encounter issues:
1. Check GitHub Actions logs for specific error messages
2. Verify all required secrets are present and valid
3. Test token permissions with curl commands
4. Review GitHub API documentation for rate limits

For additional help, refer to:
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GitHub REST API Documentation](https://docs.github.com/en/rest)
- [Personal Access Token Guide](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)