# System Administration Settings

The System Administration page provides comprehensive tools for system maintenance, monitoring, emergency operations, and administrative functions. This page is accessible only to users with Admin role and can be found at `/settings/system-admin`.

## Overview

System Administration centralizes critical operational tools including:
- Emergency system controls (lockdown, restart)
- System status monitoring and health checks
- Backup and restore operations
- Support bundle generation for troubleshooting
- Advanced system configuration and maintenance

## Emergency Controls

Emergency controls provide immediate system protection and recovery options for critical situations.

### System Lockdown

System lockdown restricts access to admin users only, preventing normal operations while allowing emergency maintenance.

**When to Use Lockdown:**
- Security incident response
- Critical system maintenance
- Database migration or major upgrades
- Investigating system anomalies
- Preventing access during vulnerability patching

**Lockdown Process:**
1. Navigate to System Administration
2. Click "Emergency Lockdown" in the Emergency Controls section
3. Provide a reason for the lockdown (logged for audit purposes)
4. Confirm the lockdown action
5. System immediately restricts access to admin users only

**During Lockdown:**
- Only admin users can access the system
- All API endpoints return lockdown status to non-admin users
- Normal operations are suspended
- Emergency controls remain available to admins
- Audit logs continue recording all activities

**Lifting Lockdown:**
1. Navigate to System Administration (admin access required)
2. Click "Lift Lockdown" button
3. Confirm the action to restore normal operations
4. System immediately resumes normal access for all users

### Emergency Restart

Emergency restart provides immediate system restart capability for critical issues that require full system reset.

**When to Use Emergency Restart:**
- System performance degradation
- Memory leaks or resource exhaustion
- Configuration issues requiring restart
- Service connectivity problems
- After critical security updates

**Restart Process:**
1. Navigate to System Administration
2. Click "Emergency Restart" in the Emergency Controls section
3. Confirm restart action (system will be briefly unavailable)
4. System performs graceful shutdown and restart
5. Services automatically resume after restart

**Restart Behavior:**
- Graceful shutdown of running services
- Database connections properly closed
- In-flight requests completed where possible
- System automatically restarts all components
- Services resume normal operation after restart

## System Status Monitoring

Comprehensive monitoring provides visibility into system health, performance, and operational status.

### System Health Overview

**Docker Engine Status**
- Container runtime health and version
- Available and used container resources
- Docker daemon connectivity status
- Container orchestration health

**System Information**
- Operating system and architecture details
- Go runtime version and performance
- System uptime and availability
- Process and resource utilization

**Performance Metrics**
- CPU usage and load averages
- Memory utilization and availability  
- Disk space and I/O performance
- Network connectivity and throughput

### Real-Time Monitoring

**Resource Usage Tracking**
- Live CPU, memory, and disk utilization
- Process monitoring and performance metrics
- Network connection status and latency
- Service health and availability checks

**Alert Indicators**
- Visual indicators for system issues
- Resource threshold warnings
- Service availability status
- Performance degradation alerts

**Historical Trends**
- Resource usage over time
- Performance pattern analysis
- Capacity planning insights
- Issue correlation and trending

## Backup and Restore Operations

Comprehensive backup and restore capabilities protect system configuration, data, and operational state.

### Creating System Backups

**Manual Backup Process:**
1. Navigate to System Administration
2. Click "Create Backup" in the Backup & Restore section
3. System generates comprehensive backup including:
   - Database schema and data
   - Configuration files and settings
   - Certificate and security data
   - User accounts and permissions
   - Service definitions and routes
4. Backup file automatically downloads to your device

**Backup Contents:**
- Complete SQLite database backup
- System configuration and settings
- TLS certificates and private keys
- User authentication and session data
- Service definitions and routing rules
- Integration configurations and secrets
- Environment templates and variables

**Backup File Format:**
- Compressed tar.gz archive
- Timestamped filename for organization
- Encrypted sensitive data for security
- Includes manifest for backup verification

### Restoring from Backups

**Restore Process:**
1. Navigate to System Administration
2. Click "Restore from Backup" in the Backup & Restore section
3. Drag and drop backup file or click to select
4. System validates backup file integrity
5. Confirm restore operation (will replace current data)
6. System performs complete restoration and restart

**Restore Validation:**
- Backup file format verification
- Data integrity checking
- Version compatibility validation
- Required permissions confirmation

**Restore Operations:**
- Database replacement with backup data
- Configuration file restoration
- Certificate and key deployment
- Service definition reloading
- User account recreation
- Permission and role restoration

**Post-Restore Actions:**
- Automatic system restart
- Service health verification
- Integration connectivity testing
- User notification of restoration completion

### Backup Best Practices

**Regular Backup Schedule:**
- Daily backups for production systems
- Pre-maintenance backups before changes
- Post-upgrade backups after updates
- Monthly archive backups for long-term retention

**Backup Storage:**
- Store backups in secure, separate location
- Use encrypted storage for backup files
- Maintain multiple backup versions
- Test backup restoration regularly

**Backup Security:**
- Protect backup files with appropriate permissions
- Encrypt backups containing sensitive data
- Audit backup access and usage
- Secure backup transfer and storage

## Support Bundle Generation

Support bundles provide comprehensive diagnostic information for troubleshooting and technical support.

### Support Bundle Contents

**System Information:**
- Operating system and hardware details
- Software versions and configurations
- Environment variables and settings
- Process and service status

**Logs and Diagnostics:**
- Application logs with error details
- System logs and kernel messages
- Service-specific diagnostic information
- Performance metrics and statistics

**Configuration Data:**
- Sanitized configuration files (secrets removed)
- Database schema and statistics
- Network configuration and routing
- Security and certificate information

**Runtime State:**
- Active service definitions
- Resource utilization snapshots
- Connection and integration status
- Current system health metrics

### Generating Support Bundles

**Bundle Generation Process:**
1. Navigate to System Administration
2. Click "Download Support Bundle" in the Support section
3. System collects diagnostic information
4. Sensitive data is automatically sanitized
5. Bundle is compressed and prepared for download
6. Bundle file automatically downloads to your device

**Bundle Security:**
- Automatic sanitization of secrets and passwords
- Removal of personal and sensitive information
- Encryption of remaining sensitive diagnostic data
- Audit trail of bundle generation events

### Using Support Bundles

**Internal Troubleshooting:**
- Analyze logs for error patterns
- Review configuration for issues
- Monitor resource utilization trends
- Identify service connectivity problems

**Technical Support:**
- Provide comprehensive diagnostic information
- Enable remote troubleshooting assistance
- Accelerate issue resolution process
- Ensure complete problem context

**Issue Documentation:**
- Archive diagnostic state for future reference
- Document system state during issues
- Create baseline for performance comparison
- Support incident post-mortem analysis

## Advanced Configuration

Advanced configuration options provide fine-tuned control over system behavior and operational parameters.

### System Configuration Options

**Performance Tuning:**
- Database connection pooling
- Cache configuration and sizing
- Request timeout and retry settings
- Resource allocation and limits

**Security Hardening:**
- Session timeout and security settings
- Authentication method restrictions
- API rate limiting and throttling
- Audit logging configuration

**Integration Settings:**
- External service timeout configuration
- Webhook retry and failure handling
- Certificate renewal automation
- DNS provider connection settings

### Debug and Development Options

**Debug Mode:**
- Enhanced logging for troubleshooting
- Detailed request and response logging
- Performance profiling and metrics
- Development tool integration

**Maintenance Mode:**
- Controlled system maintenance windows
- User notification during maintenance
- Service availability during updates
- Graceful degradation handling

## Monitoring and Alerting

### Health Check Endpoints

System provides automated health checking for monitoring integration:

**System Health Endpoint:**
```
GET /api/v1/health
```

**Response includes:**
- Overall system status
- Component health details
- Resource utilization metrics
- Integration connectivity status

### External Monitoring Integration

**Metrics Export:**
- Prometheus-compatible metrics endpoint
- Custom metric collection and export
- Performance data aggregation
- Historical metric storage

**Alert Configuration:**
- Resource threshold monitoring
- Service availability checking
- Performance degradation detection
- Security incident alerting

## Security and Compliance

### Audit Logging

All system administration actions are automatically logged:

**Logged Activities:**
- Emergency control usage (lockdown, restart)
- Backup and restore operations
- Support bundle generation
- Configuration changes
- Administrative access and actions

**Audit Trail Information:**
- User identification and role
- Action timestamp and duration
- Affected system components
- Outcome and error details

### Access Control

**Role-Based Access:**
- System Administration requires Admin role
- Emergency controls restricted to admins
- Backup operations require appropriate permissions
- Audit log access controlled by role

**Session Security:**
- Admin session monitoring
- Privileged action confirmation
- Session timeout for sensitive operations
- Multi-factor authentication support (where configured)

## Troubleshooting

### Common Issues

**System Performance Problems:**
1. Check system resource utilization
2. Review active service resource consumption
3. Analyze database performance metrics
4. Consider system restart if needed

**Backup and Restore Issues:**
1. Verify sufficient disk space for backup operations
2. Check backup file integrity and format
3. Ensure proper permissions for backup files
4. Test backup restoration in non-production environment

**Emergency Control Problems:**
1. Confirm admin role and permissions
2. Check system connectivity and responsiveness
3. Review audit logs for previous emergency actions
4. Verify no conflicting maintenance operations

### Diagnostic Steps

**System Health Assessment:**
1. Review system status dashboard
2. Check resource utilization trends
3. Analyze error logs and patterns
4. Test external integration connectivity

**Performance Analysis:**
1. Generate support bundle for analysis
2. Review performance metrics and trends
3. Identify resource bottlenecks
4. Analyze service response times

**Emergency Response:**
1. Assess severity and impact of issues
2. Consider lockdown for security incidents
3. Use emergency restart for critical failures
4. Document all emergency actions taken

## Integration Examples

### Automated Monitoring

```bash
#!/bin/bash
# System health monitoring script

GLINR_URL="https://glinrdock.example.com"
ADMIN_TOKEN="your-admin-token"

# Check system health
health_status=$(curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \\
                    "$GLINR_URL/api/v1/health" | jq -r '.status')

if [ "$health_status" != "healthy" ]; then
    echo "System health check failed: $health_status"
    # Send alert or take corrective action
fi
```

### Automated Backup

```python
import requests
import schedule
import time
from datetime import datetime

def create_backup():
    headers = {
        'Authorization': f'Bearer {ADMIN_TOKEN}',
        'Content-Type': 'application/json'
    }
    
    response = requests.post(
        f'{GLINR_URL}/api/v1/system/backup',
        headers=headers
    )
    
    if response.status_code == 200:
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        with open(f'backup_{timestamp}.tar.gz', 'wb') as f:
            f.write(response.content)
        print(f"Backup created successfully: backup_{timestamp}.tar.gz")
    else:
        print(f"Backup failed: {response.status_code}")

# Schedule daily backups
schedule.every().day.at("02:00").do(create_backup)

while True:
    schedule.run_pending()
    time.sleep(60)
```

### Emergency Response Automation

```javascript
// Emergency lockdown automation
async function emergencyLockdown(reason) {
    const response = await fetch(`${GLINR_URL}/api/v1/system/lockdown`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${ADMIN_TOKEN}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason })
    });
    
    if (response.ok) {
        console.log('Emergency lockdown activated');
        // Notify administrators
        await sendAlert('System locked down due to: ' + reason);
    } else {
        console.error('Failed to activate lockdown:', response.statusText);
    }
}

// Security incident response
async function handleSecurityIncident(incident) {
    await emergencyLockdown(`Security incident: ${incident.type}`);
    await generateSupportBundle();
    await notifySecurityTeam(incident);
}
```

## Related Topics

- [Settings Overview](settings) - Main settings documentation
- [Authentication Settings](settings-authentication) - User authentication management
- [Security Best Practices](../security/best-practices) - Comprehensive security guide
- [API Reference](../reference/api) - System administration API endpoints
- [Monitoring and Metrics](../reference/metrics) - Performance monitoring details