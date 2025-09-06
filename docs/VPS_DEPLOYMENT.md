# GLINRDOCK VPS Production Deployment Guide

## 🎯 Quick Start for VPS Deployment

This guide will get GLINRDOCK running on your VPS with nginx proxy, SSL automation, and Spring Boot deployment capabilities.

## Prerequisites

### Server Requirements
- **Ubuntu 20.04 LTS or newer** (recommended)
- **2GB RAM minimum** (4GB recommended for multiple Spring Boot apps)
- **20GB disk space minimum**
- **Docker & Docker Compose installed**
- **Domain name** pointing to your VPS IP

### Required Ports
- **80** (HTTP - redirects to HTTPS)
- **443** (HTTPS - main application)  
- **8080** (GLINRDOCK API - internal, can be firewalled)

## 📦 1. Server Preparation

### Install Docker & Docker Compose
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again for docker group changes
```

### Install Build Dependencies
```bash
# Install Go 1.21+ for building GLINRDOCK
sudo apt install -y git build-essential

# Install Go
curl -fsSL https://golang.org/dl/go1.21.0.linux-amd64.tar.gz -o go.tar.gz
sudo rm -rf /usr/local/go && sudo tar -C /usr/local -xzf go.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc

# Verify installation
go version
docker --version
docker-compose --version
```

## 🏗️ 2. Deploy GLINRDOCK

### Clone and Build
```bash
# Clone repository
cd /opt
sudo git clone https://github.com/GLINCKER/glinrdock-core.git glinrdock
sudo chown -R $USER:$USER /opt/glinrdock
cd /opt/glinrdock

# Build application
make build

# Build frontend
cd web/ui-lite && npm install && npm run build && cd ../..
```

### Create Production Configuration
```bash
# Create data directory
sudo mkdir -p /opt/glinrdock/data
sudo chown -R $USER:$USER /opt/glinrdock/data

# Generate encryption key for secrets
export GLINRDOCK_SECRET=$(openssl rand -base64 32)
echo "GLINRDOCK_SECRET=$GLINRDOCK_SECRET" >> /opt/glinrdock/.env

# Generate admin token
export ADMIN_TOKEN=$(openssl rand -base64 32)
echo "ADMIN_TOKEN=$ADMIN_TOKEN" >> /opt/glinrdock/.env

# Set your domain
echo "EXTERNAL_BASE_URL=https://yourdomain.com" >> /opt/glinrdock/.env
echo "CORS_ORIGINS=https://yourdomain.com" >> /opt/glinrdock/.env
```

## 🐳 3. Production Docker Compose Setup

### Create docker-compose.prod.yml
```bash
cat > /opt/glinrdock/docker-compose.prod.yml << 'EOF'
version: '3.8'

services:
  glinrdock:
    build: 
      context: .
      dockerfile: Dockerfile.controller
    restart: unless-stopped
    environment:
      - DATA_DIR=/app/data
      - HTTP_ADDR=:8080
      - NGINX_PROXY_ENABLED=true
      - LOG_LEVEL=info
    env_file:
      - .env
    volumes:
      - ./data:/app/data
      - /var/run/docker.sock:/var/run/docker.sock
      - ./certs:/app/certs
    networks:
      - glinrdock
    ports:
      - "127.0.0.1:8080:8080"
    depends_on:
      - nginx

  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/conf.d:/etc/nginx/conf.d:ro
      - ./certs:/etc/nginx/certs:ro
      - ./data/nginx:/var/cache/nginx
    networks:
      - glinrdock
    depends_on:
      - certbot

  certbot:
    image: certbot/certbot
    restart: "no"
    volumes:
      - ./certs:/etc/letsencrypt
      - ./certbot-webroot:/var/www/certbot
    entrypoint: "/bin/sh -c 'trap exit TERM; while :; do certbot renew; sleep 12h & wait $${!}; done;'"

networks:
  glinrdock:
    driver: bridge

volumes:
  glinrdock-data:
EOF
```

## 🔧 4. Nginx Configuration

### Create Nginx Configuration
```bash
# Create nginx directories
sudo mkdir -p /opt/glinrdock/nginx/conf.d
sudo mkdir -p /opt/glinrdock/certs
sudo mkdir -p /opt/glinrdock/certbot-webroot

# Main nginx.conf
cat > /opt/glinrdock/nginx/nginx.conf << 'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
    use epoll;
    multi_accept on;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                   '$status $body_bytes_sent "$http_referer" '
                   '"$http_user_agent" "$http_x_forwarded_for"';
    access_log /var/log/nginx/access.log main;
    
    # Performance
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;
    
    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private must-revalidate auth;
    gzip_types text/plain text/css text/xml text/javascript
               application/javascript application/xml+rss application/json;
    
    # Include site configurations
    include /etc/nginx/conf.d/*.conf;
}
EOF

# GLINRDOCK main site configuration
cat > /opt/glinrdock/nginx/conf.d/glinrdock.conf << 'EOF'
# HTTP to HTTPS redirect
server {
    listen 80;
    server_name _;
    
    # Let's Encrypt challenge location
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }
    
    # Redirect all other traffic to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name yourdomain.com;  # Replace with your domain
    
    # SSL configuration
    ssl_certificate /etc/nginx/certs/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/nginx/certs/live/yourdomain.com/privkey.pem;
    
    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    # Proxy to GLINRDOCK
    location / {
        proxy_pass http://glinrdock:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
    }
    
    # WebSocket support for logs
    location /ws/ {
        proxy_pass http://glinrdock:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
```

## 🔐 5. SSL Certificate Setup

### Get Initial SSL Certificate
```bash
# Replace yourdomain.com with your actual domain
DOMAIN="yourdomain.com"

# Get initial certificate
sudo docker run --rm \
  -v /opt/glinrdock/certs:/etc/letsencrypt \
  -v /opt/glinrdock/certbot-webroot:/var/www/certbot \
  certbot/certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email your-email@domain.com \
  --agree-tos \
  --no-eff-email \
  -d $DOMAIN

# Update nginx configuration with your domain
sed -i "s/yourdomain.com/$DOMAIN/g" /opt/glinrdock/nginx/conf.d/glinrdock.conf
```

## 🚀 6. Start Production Services

### Start GLINRDOCK
```bash
cd /opt/glinrdock

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f glinrdock
```

### Test Installation
```bash
# Test HTTP redirect
curl -I http://yourdomain.com

# Test HTTPS
curl -I https://yourdomain.com

# Test API with admin token
curl -H "Authorization: Bearer $ADMIN_TOKEN" https://yourdomain.com/v1/system
```

## 🔄 7. Systemd Service (Optional)

### Create systemd service for auto-start
```bash
sudo tee /etc/systemd/system/glinrdock.service << EOF
[Unit]
Description=GLINRDOCK Container Management System
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/glinrdock
ExecStart=/usr/local/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/local/bin/docker-compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
sudo systemctl enable glinrdock
sudo systemctl start glinrdock
sudo systemctl status glinrdock
```

## 📊 8. Monitoring & Maintenance

### Log Monitoring
```bash
# Application logs
docker-compose -f docker-compose.prod.yml logs -f glinrdock

# Nginx logs
docker-compose -f docker-compose.prod.yml logs -f nginx

# System resource usage
docker stats
```

### SSL Certificate Renewal
```bash
# Test renewal (dry run)
docker run --rm \
  -v /opt/glinrdock/certs:/etc/letsencrypt \
  -v /opt/glinrdock/certbot-webroot:/var/www/certbot \
  certbot/certbot renew --dry-run

# Certificates auto-renew via the certbot container
```

### Backup Strategy
```bash
# Create backup script
cat > /opt/glinrdock/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/opt/backups/glinrdock"
mkdir -p $BACKUP_DIR

# Stop services
cd /opt/glinrdock
docker-compose -f docker-compose.prod.yml down

# Backup data
tar -czf $BACKUP_DIR/glinrdock-data-$DATE.tar.gz data/
tar -czf $BACKUP_DIR/glinrdock-certs-$DATE.tar.gz certs/

# Restart services
docker-compose -f docker-compose.prod.yml up -d

echo "Backup completed: $BACKUP_DIR/glinrdock-data-$DATE.tar.gz"
EOF

chmod +x /opt/glinrdock/backup.sh

# Add to crontab for daily backups
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/glinrdock/backup.sh") | crontab -
```

## 🎯 9. Access Your GLINRDOCK Installation

1. **Navigate to your domain**: `https://yourdomain.com`
2. **Login with your admin token**: Use the `$ADMIN_TOKEN` from your `.env` file
3. **Navigate to Deploy**: Go to `/app/deploy` to start deploying Spring Boot apps
4. **First deployment**: Test with a sample Spring Boot repository

## 🔧 Troubleshooting

### Common Issues

**Container won't start**:
```bash
# Check Docker daemon
sudo systemctl status docker

# Check logs
docker-compose -f docker-compose.prod.yml logs
```

**SSL certificate issues**:
```bash
# Check certificate status
sudo docker run --rm -v /opt/glinrdock/certs:/etc/letsencrypt certbot/certbot certificates

# Renew manually
sudo docker run --rm -v /opt/glinrdock/certs:/etc/letsencrypt -v /opt/glinrdock/certbot-webroot:/var/www/certbot certbot/certbot renew --force-renewal
```

**Domain access issues**:
- Verify DNS points to your VPS IP
- Check firewall allows ports 80 and 443
- Verify nginx configuration syntax: `docker exec nginx nginx -t`

## 📚 Next Steps

Once deployed successfully:
1. Deploy your first Spring Boot application via the UI
2. Set up DNS providers in Settings → Certificates
3. Configure GitHub integration for webhook deployments
4. Set up monitoring and alerts for your services

Your GLINRDOCK installation is now production-ready for rapid Spring Boot deployments! 🚀