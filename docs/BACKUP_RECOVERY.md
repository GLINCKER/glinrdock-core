# GLINRDOCK Backup & Recovery Guide

Comprehensive backup and disaster recovery procedures for GLINRDOCK production deployments.

## 🎯 Quick Start

### Create Backup
```bash
# Standard backup (recommended for daily use)
./scripts/backup.sh

# Quick backup (no service restart)
./scripts/backup.sh --quick

# Full backup with Docker images
./scripts/backup.sh --full
```

### Restore Backup
```bash
# Restore from specific backup
./scripts/restore.sh /opt/backups/glinrdock/backup-20240127_143022

# Restore from latest backup
./scripts/restore.sh /opt/backups/glinrdock/latest

# Force restore without confirmation
./scripts/restore.sh /path/to/backup --force
```

## 📋 What Gets Backed Up

### Standard Backup Includes:
- ✅ **Application Data** (`data/` directory)
  - SQLite database
  - User uploads and files
  - Application state
  
- ✅ **Configuration Files**
  - `docker-compose.prod.yml`
  - `.env` environment variables
  - All scripts in `scripts/` directory
  
- ✅ **SSL Certificates** (`certs/` directory)
  - Let's Encrypt certificates
  - Private keys
  - Certificate chains
  
- ✅ **Nginx Configuration** (`nginx/` directory)
  - Main nginx.conf
  - Site configurations
  - Proxy settings
  - (Excludes logs and cache)

- ✅ **Database Consistency**
  - SQLite backup with integrity checks
  - Atomic backup operations

### Full Backup Adds:
- ✅ **Docker Images**
  - All service images
  - Custom built images
  - Complete environment recreation

## 🔄 Backup Types

### Standard Backup (`./scripts/backup.sh`)
- **When**: Daily automated backups
- **Downtime**: 30-60 seconds (services restart)
- **Size**: Small (data + config only)
- **Speed**: Fast
- **Best for**: Regular scheduled backups

### Quick Backup (`./scripts/backup.sh --quick`)
- **When**: Before updates or changes
- **Downtime**: None (services keep running)
- **Size**: Small
- **Speed**: Fastest
- **Best for**: Pre-maintenance snapshots
- **Note**: May have minor consistency issues with active writes

### Full Backup (`./scripts/backup.sh --full`)
- **When**: Before major updates or migrations
- **Downtime**: 2-5 minutes
- **Size**: Large (includes Docker images)
- **Speed**: Slower
- **Best for**: Complete disaster recovery

## ⚙️ Automated Backup Setup

### Daily Backup Cron Job
```bash
# Create daily backup at 2 AM
(crontab -l 2>/dev/null; echo "0 2 * * * cd /opt/glinrdock && ./scripts/backup.sh --quick >> /var/log/glinrdock-backup.log 2>&1") | crontab -

# Weekly full backup on Sundays at 3 AM
(crontab -l 2>/dev/null; echo "0 3 * * 0 cd /opt/glinrdock && ./scripts/backup.sh --full >> /var/log/glinrdock-backup.log 2>&1") | crontab -
```

### Systemd Service (Alternative)
```bash
# Create backup service
sudo tee /etc/systemd/system/glinrdock-backup.service > /dev/null << 'EOF'
[Unit]
Description=GLINRDOCK Backup Service
Wants=glinrdock-backup.timer

[Service]
Type=oneshot
User=glinrdock
WorkingDirectory=/opt/glinrdock
ExecStart=/opt/glinrdock/scripts/backup.sh --quick
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Create timer for daily backup
sudo tee /etc/systemd/system/glinrdock-backup.timer > /dev/null << 'EOF'
[Unit]
Description=Daily GLINRDOCK Backup
Requires=glinrdock-backup.service

[Timer]
OnCalendar=daily
Persistent=true

[Install]
WantedBy=timers.target
EOF

# Enable and start
sudo systemctl enable glinrdock-backup.timer
sudo systemctl start glinrdock-backup.timer
```

## 🗂️ Backup Organization

### Directory Structure
```
/opt/backups/glinrdock/
├── backup-20240127_143022/          # Timestamped backup
│   ├── backup_info.json             # Metadata
│   ├── backup_summary.txt           # Human-readable summary  
│   ├── data.tar.gz                  # Application data
│   ├── config.tar.gz               # Configuration files
│   ├── certs.tar.gz                # SSL certificates
│   ├── nginx.tar.gz                # Nginx configuration
│   ├── database.db                 # SQLite database
│   └── docker_*.tar.gz             # Docker images (full backup)
├── backup-20240126_143022/          # Previous backup
├── latest -> backup-20240127_143022/  # Symlink to latest
└── restore_scripts/                 # Restoration utilities
```

### Backup Metadata
Each backup includes `backup_info.json` with:
```json
{
    "timestamp": "2024-01-27T14:30:22-05:00",
    "backup_type": "standard",
    "quick_backup": false,
    "glinrdock_dir": "/opt/glinrdock",
    "services_running": true,
    "hostname": "glinrdock-prod",
    "version": "a1b2c3d4",
    "disk_usage": "2.3G"
}
```

## 🔧 Backup Configuration Options

### Command Line Options

#### Backup Script
```bash
./scripts/backup.sh [OPTIONS]

Options:
  -d, --dir DIRECTORY     GLINRDOCK installation directory
  -o, --output DIRECTORY  Backup output directory
  -k, --keep NUMBER       Number of backups to keep (default: 7)
  -f, --full              Full backup including Docker images
  -q, --quick             Quick backup (no service restart)
  -h, --help              Show help message

Examples:
  ./scripts/backup.sh                           # Standard backup
  ./scripts/backup.sh --quick                  # Quick backup
  ./scripts/backup.sh --full --keep 14         # Full backup, keep 14 days
  ./scripts/backup.sh -d /home/user/glinrdock  # Custom directory
```

#### Restore Script
```bash
./scripts/restore.sh BACKUP_DIRECTORY [OPTIONS]

Options:
  -d, --dir DIRECTORY     GLINRDOCK installation directory
  -f, --force            Force restore without confirmation
  -h, --help             Show help message

Examples:
  ./scripts/restore.sh /opt/backups/glinrdock/backup-20240127_143022
  ./scripts/restore.sh /opt/backups/glinrdock/latest
  ./scripts/restore.sh /path/to/backup --force
```

## 🚨 Disaster Recovery Scenarios

### Complete Server Loss

1. **Provision New Server**
   ```bash
   # On new server, install GLINRDOCK prerequisites
   curl -fsSL https://raw.githubusercontent.com/GLINCKER/glinrdock-core/main/scripts/vps-install.sh -o install.sh
   chmod +x install.sh
   ```

2. **Restore from Backup**
   ```bash
   # Transfer backup to new server
   scp -r user@backup-server:/backups/glinrdock/latest /opt/backups/glinrdock/

   # Restore
   cd /opt/glinrdock
   ./scripts/restore.sh /opt/backups/glinrdock/latest
   ```

3. **Update DNS** (if IP changed)
   ```bash
   # Update DNS A records to point to new server IP
   # Wait for propagation, then test
   ./scripts/check-dns.sh your-domain.com
   ```

### Corrupted Installation

1. **Create Emergency Backup**
   ```bash
   # Quick backup of current state
   ./scripts/backup.sh --quick
   ```

2. **Restore from Known Good Backup**
   ```bash
   # Choose backup from before corruption
   ./scripts/restore.sh /opt/backups/glinrdock/backup-YYYYMMDD_HHMMSS
   ```

### Database Corruption

1. **Stop Services**
   ```bash
   docker-compose -f docker-compose.prod.yml down
   ```

2. **Restore Database Only**
   ```bash
   # From backup directory
   cp /opt/backups/glinrdock/latest/database.db /opt/glinrdock/data/glinrdock.db
   
   # Verify integrity
   sqlite3 /opt/glinrdock/data/glinrdock.db "PRAGMA integrity_check;"
   ```

3. **Restart Services**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

### SSL Certificate Issues

1. **Restore Certificates**
   ```bash
   # Extract certificates from backup
   tar -xzf /opt/backups/glinrdock/latest/certs.tar.gz -C /opt/glinrdock/
   
   # Restart nginx
   docker-compose -f docker-compose.prod.yml restart nginx
   ```

2. **Re-generate if Needed**
   ```bash
   ./scripts/setup-ssl.sh -d your-domain.com -e your-email@domain.com
   ```

## 🔍 Backup Verification

### Manual Verification
```bash
# Check backup contents
ls -la /opt/backups/glinrdock/latest/

# Verify archive integrity
tar -tzf /opt/backups/glinrdock/latest/data.tar.gz > /dev/null
tar -tzf /opt/backups/glinrdock/latest/config.tar.gz > /dev/null

# Check database backup
sqlite3 /opt/backups/glinrdock/latest/database.db "PRAGMA integrity_check;"
```

### Automated Verification Script
```bash
#!/bin/bash
# Save as scripts/verify-backup.sh

BACKUP_DIR="$1"
if [[ -z "$BACKUP_DIR" ]]; then
    echo "Usage: $0 /path/to/backup"
    exit 1
fi

echo "Verifying backup: $BACKUP_DIR"

# Check required files exist
REQUIRED_FILES=("backup_info.json" "data.tar.gz" "config.tar.gz")
for file in "${REQUIRED_FILES[@]}"; do
    if [[ -f "$BACKUP_DIR/$file" ]]; then
        echo "✓ $file exists"
    else
        echo "✗ $file missing"
        exit 1
    fi
done

# Verify archive integrity
for archive in data.tar.gz config.tar.gz certs.tar.gz nginx.tar.gz; do
    if [[ -f "$BACKUP_DIR/$archive" ]]; then
        if tar -tzf "$BACKUP_DIR/$archive" > /dev/null 2>&1; then
            echo "✓ $archive integrity OK"
        else
            echo "✗ $archive corrupted"
            exit 1
        fi
    fi
done

# Verify database
if [[ -f "$BACKUP_DIR/database.db" ]]; then
    if sqlite3 "$BACKUP_DIR/database.db" "PRAGMA integrity_check;" | grep -q "ok"; then
        echo "✓ Database integrity OK"
    else
        echo "✗ Database corrupted"
        exit 1
    fi
fi

echo "✅ Backup verification passed"
```

## 📊 Monitoring & Alerting

### Backup Status Monitoring
```bash
#!/bin/bash
# Save as scripts/backup-status.sh

BACKUP_DIR="/opt/backups/glinrdock"
MAX_AGE_HOURS=25  # Alert if backup older than 25 hours

# Check if latest backup exists
if [[ ! -L "$BACKUP_DIR/latest" ]]; then
    echo "ERROR: No backup found"
    exit 1
fi

# Check backup age
LATEST_BACKUP=$(readlink "$BACKUP_DIR/latest")
BACKUP_TIME=$(stat -c %Y "$LATEST_BACKUP")
CURRENT_TIME=$(date +%s)
AGE_HOURS=$(( (CURRENT_TIME - BACKUP_TIME) / 3600 ))

if [[ $AGE_HOURS -gt $MAX_AGE_HOURS ]]; then
    echo "WARNING: Latest backup is $AGE_HOURS hours old"
    exit 1
else
    echo "OK: Latest backup is $AGE_HOURS hours old"
    exit 0
fi
```

### Integration with Monitoring Systems
```bash
# Nagios/Icinga check
./scripts/backup-status.sh

# Prometheus metrics (create backup_age.prom)
echo "glinrdock_backup_age_hours $(( ($(date +%s) - $(stat -c %Y /opt/backups/glinrdock/latest)) / 3600 ))" > /var/lib/prometheus/node-exporter/backup_age.prom

# Send alert via webhook on failure
./scripts/backup.sh || curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"GLINRDOCK backup failed on '$(hostname)'"}' \
  YOUR_SLACK_WEBHOOK_URL
```

## 📡 Off-site Backup Storage

### AWS S3 Sync
```bash
#!/bin/bash
# Save as scripts/sync-to-s3.sh

BUCKET="your-glinrdock-backups"
BACKUP_DIR="/opt/backups/glinrdock"

# Install AWS CLI if needed
# pip install awscli

# Sync backups to S3
aws s3 sync "$BACKUP_DIR" "s3://$BUCKET/$(hostname)/" \
  --exclude "*.log" \
  --storage-class STANDARD_IA \
  --delete

# Lifecycle policy recommended:
# - Transition to Glacier after 30 days
# - Delete after 365 days
```

### rsync to Remote Server
```bash
#!/bin/bash
# Save as scripts/sync-to-remote.sh

REMOTE_HOST="backup-server.example.com"
REMOTE_USER="backup"
REMOTE_DIR="/backups/glinrdock/$(hostname)"
LOCAL_DIR="/opt/backups/glinrdock"

# Sync via rsync over SSH
rsync -avz --delete \
  -e "ssh -i /home/glinrdock/.ssh/backup_key" \
  "$LOCAL_DIR/" \
  "$REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/"
```

## ✅ Best Practices

### Backup Schedule
- **Daily**: Quick backups for rapid recovery
- **Weekly**: Full backups for complete restoration
- **Monthly**: Archive backups for long-term retention

### Testing
- **Monthly**: Test restore procedure on staging environment
- **Quarterly**: Full disaster recovery drill
- **Before Updates**: Always create backup before major changes

### Security
- **Encrypt**: Sensitive backups should be encrypted at rest
- **Access**: Limit backup access to necessary personnel only
- **Offsite**: Store critical backups off-site (different datacenter/cloud)

### Retention Policy
- **Local**: Keep 7 daily + 4 weekly backups locally
- **Remote**: Keep 12 monthly backups remotely
- **Archive**: Annual backups for compliance (if required)

### Documentation
- **Playbook**: Maintain disaster recovery procedures
- **Contacts**: Keep emergency contact list updated
- **Testing**: Document test results and lessons learned

## 🆘 Emergency Procedures

### Emergency Contacts Checklist
- [ ] System administrator contact
- [ ] DNS provider support
- [ ] Domain registrar support  
- [ ] Hosting provider support
- [ ] SSL certificate authority

### Recovery Time Objectives (RTO)
- **Database corruption**: < 30 minutes
- **Configuration issues**: < 15 minutes
- **SSL certificate problems**: < 1 hour
- **Complete server loss**: < 4 hours (depending on DNS propagation)

### Recovery Point Objectives (RPO)
- **Standard backup**: < 24 hours data loss
- **Quick backup**: < 1 hour data loss
- **Real-time replication**: < 5 minutes data loss

Remember: Regular backups are only useful if you can successfully restore from them. Test your restore procedures regularly!