# GlinrDock Installation Guide

GlinrDock is a Docker container management platform that provides a web interface for managing containers, projects, and deployments. This guide covers multiple installation methods to get GlinrDock running on your system.

## Table of Contents

1. [Quick Start](#quick-start)
2. [System Requirements](#system-requirements)
3. [Installation Methods](#installation-methods)
   - [Systemd Installation (Recommended for Production)](#systemd-installation)
   - [Docker Compose Installation](#docker-compose-installation)
   - [Manual Installation](#manual-installation)
4. [Configuration](#configuration)
5. [Security Setup](#security-setup)
6. [Reverse Proxy Configuration](#reverse-proxy-configuration)
7. [Firewall Configuration](#firewall-configuration)
8. [Troubleshooting](#troubleshooting)
9. [Upgrading](#upgrading)
10. [Uninstallation](#uninstallation)

## Quick Start

The fastest way to get GlinrDock running is with our one-liner installer:

```bash
# Install with systemd service (recommended for production)
curl -fsSL https://github.com/GLINCKER/glinrdock/releases/latest/download/install.sh | sudo bash

# Or with wget
wget -qO- https://github.com/GLINCKER/glinrdock/releases/latest/download/install.sh | sudo bash
```

This will:
- Install GlinrDock as a systemd service
- Create necessary users and directories
- Configure firewall rules (if ufw is available)
- Generate a secure admin token
- Start the service automatically

After installation, access the web interface at `http://localhost:8080`.

## System Requirements

### Minimum Requirements
- **OS**: Linux (Ubuntu 18.04+, Debian 10+, CentOS 7+, RHEL 7+, or compatible)
- **Architecture**: x86_64 (amd64), ARM64, or ARM (Raspberry Pi)
- **RAM**: 512 MB (1 GB recommended)
- **Disk**: 100 MB for application + space for container data
- **Docker**: Version 20.10+ (required for container management)
- **systemd**: For service management (systemd installation method)

### Recommended Requirements
- **RAM**: 2 GB or more
- **Disk**: 10 GB or more free space
- **CPU**: 2+ cores
- **Network**: Reliable internet connection for Docker image pulling

### Supported Operating Systems
- Ubuntu 18.04, 20.04, 22.04, 24.04
- Debian 10, 11, 12
- CentOS 7, 8 (Stream)
- RHEL 7, 8, 9
- Rocky Linux 8, 9
- AlmaLinux 8, 9
- Fedora 35+
- Amazon Linux 2

## Installation Methods

### Systemd Installation

**Recommended for production servers**

The systemd installation method installs GlinrDock as a system service with automatic startup, logging, and management capabilities.

#### 1. One-Line Installation

```bash
curl -fsSL https://github.com/GLINCKER/glinrdock/releases/latest/download/install.sh | sudo bash
```

#### 2. Manual Download and Install

```bash
# Download the installer
curl -fsSL -o install.sh https://github.com/GLINCKER/glinrdock/releases/latest/download/install.sh
chmod +x install.sh

# Review the script (recommended)
less install.sh

# Run the installer
sudo ./install.sh
```

#### 3. Custom Installation Options

The installer supports several customization options:

```bash
# Dry run to see what would happen
DRY_RUN=true ./install.sh

# Custom installation directory and port
sudo GLINRDOCK_HOME=/usr/local/glinrdock GLINRDOCK_PORT=9080 ./install.sh

# Custom data directory
sudo GLINRDOCK_DATA_DIR=/srv/glinrdock ./install.sh

# Specify admin token
sudo ADMIN_TOKEN=your-secure-token ./install.sh
```

#### 4. Service Management

After installation, manage GlinrDock using systemctl:

```bash
# Start the service
sudo systemctl start glinrdockd

# Stop the service
sudo systemctl stop glinrdockd

# Restart the service
sudo systemctl restart glinrdockd

# Enable auto-start on boot (enabled by default)
sudo systemctl enable glinrdockd

# Check service status
sudo systemctl status glinrdockd

# View logs
sudo journalctl -fu glinrdockd
```

#### 5. Configuration Files

- **Service file**: `/etc/systemd/system/glinrdockd.service`
- **Binary**: `/opt/glinrdock/glinrdockd`
- **Data directory**: `/var/lib/glinrdock`
- **Logs**: `journalctl -u glinrdockd`
- **Admin token**: `/opt/glinrdock/.admin_token`

### Docker Compose Installation

**Recommended for development and containerized environments**

Docker Compose provides a complete stack with reverse proxy, SSL termination, and optional services like PostgreSQL and monitoring.

#### 1. Download Compose Files

```bash
# Create deployment directory
mkdir glinrdock-deploy
cd glinrdock-deploy

# Download compose files
curl -fsSL -o docker-compose.yml https://github.com/GLINCKER/glinrdock/releases/latest/download/docker-compose.yml
curl -fsSL -o deploy.sh https://github.com/GLINCKER/glinrdock/releases/latest/download/deploy.sh
curl -fsSL -o .env.example https://github.com/GLINCKER/glinrdock/releases/latest/download/.env.example
curl -fsSL -o Caddyfile https://github.com/GLINCKER/glinrdock/releases/latest/download/Caddyfile

# Make deploy script executable
chmod +x deploy.sh
```

#### 2. Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit configuration
nano .env
```

Required settings in `.env`:
```env
DOMAIN=your-domain.com
EMAIL=admin@your-domain.com
ADMIN_TOKEN=your-super-secure-admin-token-here
```

#### 3. Deploy Basic Stack

```bash
# Deploy with SQLite and Caddy reverse proxy
./deploy.sh deploy

# Or manually with docker-compose
docker-compose up -d
```

#### 4. Deploy with Additional Services

```bash
# Deploy with PostgreSQL database
./deploy.sh deploy --profile postgres

# Deploy with monitoring (Prometheus + Grafana)
./deploy.sh deploy --profile monitoring

# Deploy with everything
./deploy.sh deploy --profile postgres --profile redis --profile monitoring --profile logging
```

#### 5. Manage Deployment

```bash
# View status
./deploy.sh status

# View logs
./deploy.sh logs

# Update to latest version
./deploy.sh update --pull

# Backup data
./deploy.sh backup

# Stop services
./deploy.sh stop
```

### Manual Installation

**For advanced users who want full control**

#### 1. Install Docker

```bash
# Install Docker (if not already installed)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

#### 2. Download GlinrDock Binary

```bash
# Create directories
sudo mkdir -p /opt/glinrdock
sudo mkdir -p /var/lib/glinrdock

# Download binary (replace with your architecture)
ARCH=amd64  # or arm64, arm
VERSION=latest
curl -fsSL -o /opt/glinrdock/glinrdockd \
  "https://github.com/GLINCKER/glinrdock/releases/download/${VERSION}/glinrdockd-linux-${ARCH}"

# Make executable
sudo chmod +x /opt/glinrdock/glinrdockd
```

#### 3. Create System User

```bash
sudo useradd --system --no-create-home --home-dir /opt/glinrdock --shell /bin/false glinrdock
sudo usermod -aG docker glinrdock
sudo chown -R glinrdock:glinrdock /opt/glinrdock /var/lib/glinrdock
```

#### 4. Run GlinrDock

```bash
# Set environment variables
export ADMIN_TOKEN="your-secure-admin-token"
export GLINRDOCK_DATA_DIR="/var/lib/glinrdock"
export GLINRDOCK_HTTP_ADDR=":8080"

# Run as the glinrdock user
sudo -u glinrdock /opt/glinrdock/glinrdockd
```

## Configuration

### Environment Variables

GlinrDock is configured through environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `GLINRDOCK_HTTP_ADDR` | `:8080` | HTTP server bind address |
| `GLINRDOCK_DATA_DIR` | `./data` | Data directory path |
| `GLINRDOCK_LOG_LEVEL` | `info` | Log level (debug, info, warn, error) |
| `ADMIN_TOKEN` | *required* | Admin authentication token |
| `GLINRDOCK_CORS_ORIGINS` | | Comma-separated CORS origins |
| `WEBHOOK_SECRET` | | HMAC secret for GitHub/GitLab webhooks |
| `DATABASE_URL` | | PostgreSQL connection string (optional) |

### Configuration File

For systemd installations, edit the service file to add environment variables:

```bash
sudo systemctl edit glinrdockd
```

Add environment variables in the override file:

```ini
[Service]
Environment=GLINRDOCK_LOG_LEVEL=debug
Environment=WEBHOOK_SECRET=your-webhook-secret
```

Then reload and restart:

```bash
sudo systemctl daemon-reload
sudo systemctl restart glinrdockd
```

## Security Setup

### 1. Generate Secure Admin Token

```bash
# Generate a secure token
openssl rand -hex 32
```

### 2. Configure HTTPS

For production deployments, always use HTTPS. The Docker Compose setup includes Caddy with automatic Let's Encrypt certificates.

### 3. Webhook Security

If using webhooks, configure a secret:

```bash
# Generate webhook secret
openssl rand -hex 32

# Set in environment
export WEBHOOK_SECRET="your-generated-secret"
```

### 4. Firewall Configuration

The installer automatically configures basic firewall rules if `ufw` is available. For manual setups:

```bash
# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow GlinrDock port (if not behind reverse proxy)
sudo ufw allow 8080/tcp

# Enable firewall
sudo ufw enable
```

### 5. User Permissions

Ensure the GlinrDock user has minimal required permissions:

```bash
# Add to docker group (required for container management)
sudo usermod -aG docker glinrdock

# Verify permissions
sudo -u glinrdock docker ps
```

## Reverse Proxy Configuration

### Caddy (Included in Docker Compose)

The Docker Compose setup includes Caddy with automatic HTTPS:

```caddy
your-domain.com {
    reverse_proxy glinrdock:8080
    encode gzip
    
    header {
        X-Content-Type-Options nosniff
        X-Frame-Options DENY
        X-XSS-Protection "1; mode=block"
    }
}
```

### Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### Apache

```apache
<VirtualHost *:80>
    ServerName your-domain.com
    Redirect permanent / https://your-domain.com/
</VirtualHost>

<VirtualHost *:443>
    ServerName your-domain.com
    
    SSLEngine on
    SSLCertificateFile /path/to/cert.pem
    SSLCertificateKeyFile /path/to/key.pem
    
    ProxyPreserveHost On
    ProxyRequests Off
    
    ProxyPass / http://127.0.0.1:8080/
    ProxyPassReverse / http://127.0.0.1:8080/
    
    # WebSocket support
    RewriteEngine on
    RewriteCond %{HTTP:Upgrade} websocket [NC]
    RewriteCond %{HTTP:Connection} upgrade [NC]
    RewriteRule ^/?(.*) "ws://127.0.0.1:8080/$1" [P,L]
</VirtualHost>
```

## Firewall Configuration

### UFW (Ubuntu/Debian)

```bash
# Reset firewall (optional)
sudo ufw --force reset

# Default policies
sudo ufw default deny incoming
sudo ufw default allow outgoing

# SSH (adjust port as needed)
sudo ufw allow 22/tcp

# HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# GlinrDock (if not using reverse proxy)
sudo ufw allow 8080/tcp

# Enable firewall
sudo ufw enable

# Check status
sudo ufw status verbose
```

### firewalld (CentOS/RHEL/Fedora)

```bash
# Add HTTP and HTTPS
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https

# Add GlinrDock port (if needed)
sudo firewall-cmd --permanent --add-port=8080/tcp

# Reload firewall
sudo firewall-cmd --reload

# Check status
sudo firewall-cmd --list-all
```

### iptables (Manual)

```bash
# Allow established connections
iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow loopback
iptables -A INPUT -i lo -j ACCEPT

# Allow SSH
iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# Allow HTTP and HTTPS
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow GlinrDock (if needed)
iptables -A INPUT -p tcp --dport 8080 -j ACCEPT

# Default drop
iptables -A INPUT -j DROP

# Save rules
iptables-save > /etc/iptables/rules.v4
```

## Troubleshooting

### Common Issues

#### Service Won't Start

```bash
# Check service status
sudo systemctl status glinrdockd

# Check logs
sudo journalctl -fu glinrdockd

# Common issues:
# - Port already in use
# - Missing Docker daemon
# - Insufficient permissions
```

#### Permission Denied Errors

```bash
# Check user permissions
sudo -u glinrdock docker ps

# Add user to docker group
sudo usermod -aG docker glinrdock

# Restart service
sudo systemctl restart glinrdockd
```

#### Database Connection Errors

```bash
# Check data directory permissions
ls -la /var/lib/glinrdock

# Fix permissions
sudo chown -R glinrdock:glinrdock /var/lib/glinrdock
```

#### Port Already in Use

```bash
# Find process using port 8080
sudo lsof -i :8080

# Kill process (if safe to do so)
sudo kill -9 PID

# Or change GlinrDock port
sudo systemctl edit glinrdockd
```

#### Cannot Connect to Docker

```bash
# Check Docker daemon status
sudo systemctl status docker

# Start Docker if not running
sudo systemctl start docker

# Check Docker socket permissions
ls -la /var/run/docker.sock
```

### Log Analysis

#### Systemd Logs

```bash
# Follow logs in real-time
sudo journalctl -fu glinrdockd

# View recent logs
sudo journalctl -u glinrdockd --since "1 hour ago"

# Export logs
sudo journalctl -u glinrdockd > glinrdock.log
```

#### Container Logs (Docker Compose)

```bash
# View all service logs
docker-compose logs

# Follow specific service
docker-compose logs -f glinrdock

# View logs with timestamps
docker-compose logs -t
```

### Performance Tuning

#### System Resources

```bash
# Check memory usage
free -h

# Check disk space
df -h

# Check CPU usage
top -p $(pgrep glinrdockd)
```

#### Database Optimization

For high-load installations, consider:

1. **Use PostgreSQL** instead of SQLite
2. **Enable connection pooling**
3. **Configure appropriate memory settings**
4. **Regular database maintenance**

## Upgrading

### Systemd Installation

```bash
# Backup data (recommended)
sudo tar -czf glinrdock-backup-$(date +%Y%m%d).tar.gz -C /var/lib glinrdock

# Download and run installer (will upgrade in place)
curl -fsSL https://github.com/GLINCKER/glinrdock/releases/latest/download/install.sh | sudo bash

# Service will restart automatically
```

### Docker Compose Installation

```bash
# Backup data
./deploy.sh backup

# Pull latest images and update
./deploy.sh update --pull

# Or manually
docker-compose pull
docker-compose up -d
```

### Manual Upgrade

```bash
# Stop service
sudo systemctl stop glinrdockd

# Backup data
sudo tar -czf glinrdock-backup-$(date +%Y%m%d).tar.gz -C /var/lib glinrdock

# Download new binary
ARCH=amd64
VERSION=latest
curl -fsSL -o /opt/glinrdock/glinrdockd.new \
  "https://github.com/GLINCKER/glinrdock/releases/download/${VERSION}/glinrdockd-linux-${ARCH}"

# Replace binary
sudo mv /opt/glinrdock/glinrdockd /opt/glinrdock/glinrdockd.old
sudo mv /opt/glinrdock/glinrdockd.new /opt/glinrdock/glinrdockd
sudo chmod +x /opt/glinrdock/glinrdockd
sudo chown glinrdock:glinrdock /opt/glinrdock/glinrdockd

# Start service
sudo systemctl start glinrdockd
```

## Uninstallation

### Systemd Installation

```bash
# Stop and disable service
sudo systemctl stop glinrdockd
sudo systemctl disable glinrdockd

# Remove service file
sudo rm /etc/systemd/system/glinrdockd.service
sudo systemctl daemon-reload

# Remove binary and data (optional)
sudo rm -rf /opt/glinrdock
sudo rm -rf /var/lib/glinrdock
sudo rm -rf /var/log/glinrdock

# Remove user (optional)
sudo userdel glinrdock

# Remove from docker group
sudo gpasswd -d glinrdock docker
```

### Docker Compose Installation

```bash
# Stop and remove containers
./deploy.sh down

# Remove volumes (this will delete all data!)
docker-compose down -v

# Remove images
docker-compose down --rmi all
```

## Getting Help

- **Documentation**: [https://github.com/GLINCKER/glinrdock/docs](https://github.com/GLINCKER/glinrdock/docs)
- **Issues**: [https://github.com/GLINCKER/glinrdock/issues](https://github.com/GLINCKER/glinrdock/issues)
- **Discussions**: [https://github.com/GLINCKER/glinrdock/discussions](https://github.com/GLINCKER/glinrdock/discussions)

## Next Steps

After successful installation:

1. **Access the Web Interface**: Navigate to your GlinrDock URL
2. **Login**: Use your admin token to authenticate
3. **Create Your First Project**: Set up a project with repository integration
4. **Deploy Services**: Start managing your Docker containers
5. **Configure Webhooks**: Set up automatic deployments from Git pushes
6. **Monitor**: Use the built-in monitoring or integrate with external tools

Congratulations! You now have GlinrDock running and ready to manage your containers.