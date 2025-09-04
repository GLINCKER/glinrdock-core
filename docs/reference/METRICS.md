# Metrics Documentation

glinrdock exposes Prometheus-compatible metrics for monitoring system health, service status, and operational statistics.

## Overview

The metrics system provides observability into:
- **System health**: Uptime and running services count
- **Background jobs**: Active job queue size and processing
- **Build operations**: Success rates and duration
- **Deployment operations**: Success rates and duration

All metrics are exposed via the `/v1/metrics` endpoint in Prometheus text format, compatible with standard monitoring tools.

## Metrics Endpoint

### GET /v1/metrics

Returns metrics in Prometheus text format. Requires Bearer token authentication.

**Authentication**: Required (Bearer token)  
**Content-Type**: `text/plain; version=0.0.4; charset=utf-8`

**Example Usage:**
```bash
curl -H "Authorization: Bearer <your-token>" \
  http://localhost:8080/v1/metrics
```

## Available Metrics

### System Metrics

#### glinrdock_uptime_seconds
- **Type**: Gauge
- **Description**: Number of seconds since glinrdock server started
- **Labels**: None
- **Update Frequency**: Every 5 seconds

**Example:**
```
# HELP glinrdock_uptime_seconds Number of seconds since glinrdock server started
# TYPE glinrdock_uptime_seconds gauge
glinrdock_uptime_seconds 3600.5
```

#### glinrdock_services_running_total
- **Type**: Gauge  
- **Description**: Total number of currently running containers
- **Labels**: None
- **Update Frequency**: On container state changes (via Docker events)

**Example:**
```
# HELP glinrdock_services_running_total Total number of currently running containers
# TYPE glinrdock_services_running_total gauge
glinrdock_services_running_total 5
```

### Job Queue Metrics

#### glinrdock_jobs_active
- **Type**: Gauge
- **Description**: Number of active background jobs in the queue
- **Labels**: None
- **Update Frequency**: On job enqueue/dequeue

**Example:**
```
# HELP glinrdock_jobs_active Number of active background jobs in the queue
# TYPE glinrdock_jobs_active gauge
glinrdock_jobs_active 2
```

### Build Metrics

#### glinrdock_builds_total
- **Type**: Counter
- **Description**: Total number of builds by status
- **Labels**: 
  - `status`: `success` or `failed`
- **Update Frequency**: On build completion

**Example:**
```
# HELP glinrdock_builds_total Total number of builds by status
# TYPE glinrdock_builds_total counter
glinrdock_builds_total{status="success"} 45
glinrdock_builds_total{status="failed"} 3
```

#### glinrdock_build_duration_seconds
- **Type**: Histogram
- **Description**: Duration of build operations in seconds
- **Labels**: None
- **Buckets**: Exponential buckets from 1 second to ~1 hour
- **Update Frequency**: On build completion

**Example:**
```
# HELP glinrdock_build_duration_seconds Duration of build operations in seconds
# TYPE glinrdock_build_duration_seconds histogram
glinrdock_build_duration_seconds_bucket{le="1"} 2
glinrdock_build_duration_seconds_bucket{le="2"} 5
glinrdock_build_duration_seconds_bucket{le="4"} 12
glinrdock_build_duration_seconds_bucket{le="8"} 18
glinrdock_build_duration_seconds_bucket{le="16"} 25
glinrdock_build_duration_seconds_bucket{le="32"} 38
glinrdock_build_duration_seconds_bucket{le="64"} 42
glinrdock_build_duration_seconds_bucket{le="128"} 45
glinrdock_build_duration_seconds_bucket{le="+Inf"} 48
glinrdock_build_duration_seconds_sum 1250.5
glinrdock_build_duration_seconds_count 48
```

### Deployment Metrics

#### glinrdock_deployments_total
- **Type**: Counter
- **Description**: Total number of deployments by status
- **Labels**:
  - `status`: `success` or `failed`
- **Update Frequency**: On deployment completion

**Example:**
```
# HELP glinrdock_deployments_total Total number of deployments by status
# TYPE glinrdock_deployments_total counter
glinrdock_deployments_total{status="success"} 128
glinrdock_deployments_total{status="failed"} 2
```

#### glinrdock_deploy_duration_seconds
- **Type**: Histogram
- **Description**: Duration of deployment operations in seconds
- **Labels**: None
- **Buckets**: Default Prometheus buckets (0.005s to 10s)
- **Update Frequency**: On deployment completion

**Example:**
```
# HELP glinrdock_deploy_duration_seconds Duration of deployment operations in seconds
# TYPE glinrdock_deploy_duration_seconds histogram
glinrdock_deploy_duration_seconds_bucket{le="0.005"} 0
glinrdock_deploy_duration_seconds_bucket{le="0.01"} 0
glinrdock_deploy_duration_seconds_bucket{le="0.025"} 0
glinrdock_deploy_duration_seconds_bucket{le="0.05"} 0
glinrdock_deploy_duration_seconds_bucket{le="0.1"} 2
glinrdock_deploy_duration_seconds_bucket{le="0.25"} 15
glinrdock_deploy_duration_seconds_bucket{le="0.5"} 45
glinrdock_deploy_duration_seconds_bucket{le="1"} 89
glinrdock_deploy_duration_seconds_bucket{le="2.5"} 120
glinrdock_deploy_duration_seconds_bucket{le="5"} 128
glinrdock_deploy_duration_seconds_bucket{le="10"} 130
glinrdock_deploy_duration_seconds_bucket{le="+Inf"} 130
glinrdock_deploy_duration_seconds_sum 245.8
glinrdock_deploy_duration_seconds_count 130
```

## Prometheus Integration

### Scrape Configuration

Add the following to your `prometheus.yml` configuration:

```yaml
scrape_configs:
  - job_name: 'glinrdock'
    static_configs:
      - targets: ['localhost:8080']
    metrics_path: /v1/metrics
    bearer_token: '<your-glinrdock-token>'
    scrape_interval: 30s
    scrape_timeout: 10s
```

### Service Discovery

For multiple glinrdock instances, use Prometheus service discovery:

```yaml
scrape_configs:
  - job_name: 'glinrdock'
    consul_sd_configs:
      - server: 'consul.example.com:8500'
        services: ['glinrdock']
    relabel_configs:
      - source_labels: [__meta_consul_service_port]
        target_label: __address__
        regex: (.+)
        replacement: ${1}:8080
    metrics_path: /v1/metrics
    bearer_token: '<your-glinrdock-token>'
```

## Grafana Dashboards

### System Overview Panel

Monitor system health and service status:

```json
{
  "title": "System Overview",
  "type": "stat",
  "targets": [
    {
      "expr": "glinrdock_uptime_seconds",
      "legendFormat": "Uptime (seconds)"
    },
    {
      "expr": "glinrdock_services_running_total", 
      "legendFormat": "Running Services"
    },
    {
      "expr": "glinrdock_jobs_active",
      "legendFormat": "Active Jobs"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "unit": "short"
    },
    "overrides": [
      {
        "matcher": {"id": "byName", "options": "Uptime (seconds)"},
        "properties": [
          {"id": "unit", "value": "dtdurations"}
        ]
      }
    ]
  }
}
```

### Build Success Rate Panel

Track build performance over time:

```json
{
  "title": "Build Success Rate",
  "type": "stat", 
  "targets": [
    {
      "expr": "rate(glinrdock_builds_total{status=\"success\"}[5m]) / rate(glinrdock_builds_total[5m]) * 100",
      "legendFormat": "Success Rate %"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "unit": "percent",
      "min": 0,
      "max": 100,
      "thresholds": {
        "steps": [
          {"color": "red", "value": 0},
          {"color": "yellow", "value": 80},
          {"color": "green", "value": 95}
        ]
      }
    }
  }
}
```

### Build Duration Histogram Panel

Visualize build performance distribution:

```json
{
  "title": "Build Duration Distribution",
  "type": "histogram",
  "targets": [
    {
      "expr": "increase(glinrdock_build_duration_seconds_bucket[5m])",
      "legendFormat": "{{le}}"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "unit": "s"
    }
  }
}
```

### Deployment Timeline Panel

Monitor deployment activity:

```json
{
  "title": "Deployments Over Time",
  "type": "timeseries",
  "targets": [
    {
      "expr": "rate(glinrdock_deployments_total{status=\"success\"}[5m])",
      "legendFormat": "Successful Deployments/sec"
    },
    {
      "expr": "rate(glinrdock_deployments_total{status=\"failed\"}[5m])",
      "legendFormat": "Failed Deployments/sec"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "unit": "ops"
    }
  }
}
```

## Alerting Rules

### Prometheus Alert Rules

Create alerts for critical conditions:

```yaml
groups:
  - name: glinrdock
    rules:
      - alert: GlinrdockDown
        expr: up{job="glinrdock"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "glinrdock instance is down"
          description: "glinrdock instance {{ $labels.instance }} has been down for more than 1 minute."

      - alert: HighBuildFailureRate
        expr: rate(glinrdock_builds_total{status="failed"}[5m]) / rate(glinrdock_builds_total[5m]) > 0.1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High build failure rate"
          description: "Build failure rate is {{ $value | humanizePercentage }} over the last 5 minutes."

      - alert: LongRunningBuilds
        expr: histogram_quantile(0.95, rate(glinrdock_build_duration_seconds_bucket[5m])) > 300
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Builds taking too long"
          description: "95th percentile build duration is {{ $value }}s over the last 5 minutes."

      - alert: JobQueueBacklog
        expr: glinrdock_jobs_active > 10
        for: 3m
        labels:
          severity: warning
        annotations:
          summary: "Job queue backlog"
          description: "Job queue has {{ $value }} active jobs, indicating potential processing issues."

      - alert: NoRunningServices
        expr: glinrdock_services_running_total == 0
        for: 2m
        labels:
          severity: warning  
        annotations:
          summary: "No services running"
          description: "No services are currently running on glinrdock instance {{ $labels.instance }}."
```

## Query Examples

### Useful PromQL Queries

**Average build duration over time:**
```promql
rate(glinrdock_build_duration_seconds_sum[5m]) / rate(glinrdock_build_duration_seconds_count[5m])
```

**Build success rate percentage:**
```promql
rate(glinrdock_builds_total{status="success"}[5m]) / rate(glinrdock_builds_total[5m]) * 100
```

**95th percentile build duration:**
```promql
histogram_quantile(0.95, rate(glinrdock_build_duration_seconds_bucket[5m]))
```

**Deployment frequency (per hour):**
```promql
rate(glinrdock_deployments_total[1h]) * 3600
```

**Services availability percentage:**
```promql
glinrdock_services_running_total / on() (glinrdock_services_running_total + glinrdock_services_stopped_total) * 100
```

## Resource Usage

The metrics collection system is designed to be lightweight:

- **Memory overhead**: < 2MB for metrics collection and storage
- **CPU overhead**: < 1% additional CPU usage
- **Storage**: Metrics are stored in memory only; no persistent storage required
- **Network**: Minimal impact, only when `/v1/metrics` endpoint is scraped

## Security Considerations

### Authentication
- All metrics endpoints require Bearer token authentication
- Use dedicated monitoring tokens with read-only permissions
- Rotate tokens regularly according to your security policy

### Sensitive Information
- No sensitive data (secrets, keys, passwords) is included in metrics
- Container names and service IDs are included but considered non-sensitive
- Build logs and deployment details are not exposed via metrics

### Access Control
- Metrics endpoint follows the same authentication as other API endpoints
- Consider using separate tokens for monitoring systems
- Monitor access to metrics endpoints for unauthorized usage

## Troubleshooting

### Metrics Not Updating

**Issue**: Metrics show stale or zero values
**Solutions**:
- Check that metrics collection is initialized: `metrics.InitGlobal()` called on startup
- Verify Docker event monitoring is running for service count metrics
- Check application logs for metric collection errors

### High Memory Usage

**Issue**: Metrics collection consuming too much memory
**Solutions**:
- Histograms retain data in memory; adjust bucket configuration if needed
- Consider reducing metrics retention if using custom scrapers
- Monitor Prometheus scrape frequency to avoid excessive metric generation

### Authentication Failures

**Issue**: Prometheus can't scrape metrics (401/403 errors)
**Solutions**:
- Verify Bearer token is valid and has appropriate permissions
- Check token hasn't expired
- Ensure token is correctly configured in Prometheus scrape config

### Missing Metrics

**Issue**: Some metrics not appearing in Prometheus
**Solutions**:
- Check that the corresponding features are active (e.g., builds for build metrics)
- Verify metrics are being recorded by checking `/v1/metrics` endpoint directly
- Check Prometheus scrape configuration and target status

## Performance Tips

### Scraping Frequency
- Default 30-second scrape interval is recommended
- Higher frequency may increase resource usage without significant benefit
- Lower frequency may miss short-lived job queue spikes

### Retention
- Configure appropriate retention in Prometheus based on your monitoring needs
- Build and deployment histograms can accumulate significant data over time
- Consider using recording rules for frequently-queried complex expressions

### Capacity Planning
- Plan for ~1KB of metrics data per scrape
- Account for histogram bucket expansion in storage calculations
- Monitor Prometheus WAL and storage growth over time