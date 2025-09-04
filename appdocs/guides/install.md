---
title: Installation Guide
section: Guides
slug: guides/install
tags: installation, setup, deployment
version: v1
audience: user
---

# Installing GLINRDOCK

This guide covers the basic installation of GLINRDOCK for end users. For detailed system administration, see the [technical installation guide](../../docs/guides/INSTALL.md).

## System Requirements

- **Operating System**: Linux (Ubuntu 20.04+ recommended)
- **Memory**: 2GB RAM minimum, 4GB recommended
- **Storage**: 20GB available space minimum
- **Network**: Internet connection for downloading containers and certificates

## Quick Installation

### Using the Install Script

The easiest way to install GLINRDOCK is using our installation script:

```bash
curl -fsSL https://install.glinrdock.com | bash
```

This script will:
- Download the latest GLINRDOCK binary
- Create necessary directories and configuration
- Set up the systemd service
- Start GLINRDOCK automatically

### Manual Installation

If you prefer manual installation:

1. **Download GLINRDOCK**:
   ```bash
   wget https://github.com/GLINCKER/glinrdock/releases/latest/download/glinrdock-linux-amd64.tar.gz
   tar -xzf glinrdock-linux-amd64.tar.gz
   sudo mv glinrdock /usr/local/bin/
   ```

2. **Create configuration directory**:
   ```bash
   sudo mkdir -p /etc/glinrdock
   sudo mkdir -p /var/lib/glinrdock
   ```

3. **Start GLINRDOCK**:
   ```bash
   sudo glinrdock
   ```

## First Time Setup

### 1. Access the Dashboard

Once installed, open your web browser and go to:
- `http://your-server-ip:8080` (replace with your server's IP address)

### 2. Initial Configuration

On first access, you'll be prompted to:
- Set up an admin password
- Configure basic system settings
- Optionally set up a custom domain

### 3. Verify Installation

Check that GLINRDOCK is running properly:
- The dashboard loads without errors
- System status shows "Healthy"
- Docker integration is working (if you have Docker installed)

## Configuration Options

### Environment Variables

Key configuration options you can set:

- `GLINRDOCK_PORT` - Web interface port (default: 8080)
- `GLINRDOCK_DATA_DIR` - Data storage directory (default: /var/lib/glinrdock)
- `GLINRDOCK_LOG_LEVEL` - Logging level (debug, info, warn, error)

### Custom Domain Setup

To use a custom domain:

1. Point your domain's DNS to your server's IP address
2. In the GLINRDOCK dashboard, go to Settings
3. Update the "External URL" setting
4. Enable automatic HTTPS if desired

## Updating GLINRDOCK

To update to the latest version:

```bash
curl -fsSL https://install.glinrdock.com | bash
```

The installer will automatically handle the update process and restart services.

## Uninstalling

To remove GLINRDOCK:

```bash
sudo systemctl stop glinrdock
sudo rm /usr/local/bin/glinrdock
sudo rm -rf /etc/glinrdock
sudo rm -rf /var/lib/glinrdock
```

## Next Steps

- Complete the [getting started guide](./getting-started.md)
- Deploy your first application
- Set up [GitHub integration](../integrations/github-app.md)

## Troubleshooting

If you encounter issues during installation, see our [troubleshooting guide](./troubleshoot.md).