package health

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"time"

	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/rs/zerolog/log"
)

// ServiceStore interface for health operations
type ServiceStore interface {
	GetService(ctx context.Context, id int64) (store.Service, error)
	ListRoutes(ctx context.Context, serviceID int64) ([]store.Route, error)
	UpdateServiceHealth(ctx context.Context, serviceID int64, healthStatus string) error
}

// Prober handles health checks for services
type Prober struct {
    store  ServiceStore
    client *http.Client
}

// NewProber creates a new health prober
func NewProber(store ServiceStore) *Prober {
    return &Prober{
        store: store,
        client: &http.Client{
            Timeout: 5 * time.Second, // Increased to 5s for better reliability
            Transport: &http.Transport{
                DisableKeepAlives:     true,
                IdleConnTimeout:       30 * time.Second,
                TLSHandshakeTimeout:   10 * time.Second,
                ResponseHeaderTimeout: 10 * time.Second,
            },
        },
    }
}

// ProbeResult represents the result of a health check
type ProbeResult struct {
	Status string
	Error  error
}

// ProbeService performs a health check on a service
func (p *Prober) ProbeService(ctx context.Context, service *store.Service, routes []store.Route) ProbeResult {
    // Skip probing if service is crash looping
    if service.CrashLooping {
        return ProbeResult{Status: store.HealthStatusUnknown}
    }

    // Skip if service is not intended to be running.
    // Note: service.Status is populated at runtime and may be empty when loaded from DB.
    // Fall back to DesiredState to decide whether to probe.
    if !(service.Status == store.ServiceStateRunning || service.DesiredState == store.ServiceStateRunning) {
        return ProbeResult{Status: store.HealthStatusUnknown}
    }

	// Determine health check type
	healthType := service.GetHealthCheckType()
	
	switch healthType {
	case store.HealthCheckHTTP:
		return p.probeHTTP(ctx, service, routes)
	case store.HealthCheckTCP:
		return p.probeTCP(ctx, service)
	case store.HealthCheckPostgres:
		return p.probePostgres(ctx, service)
	case store.HealthCheckMySQL:
		return p.probeMySQL(ctx, service)
	case store.HealthCheckRedis:
		return p.probeRedis(ctx, service)
	default:
		return ProbeResult{Status: store.HealthStatusUnknown}
	}
}

// ProbeAndUpdate performs a health check and updates the service status
func (p *Prober) ProbeAndUpdate(ctx context.Context, serviceID int64) error {
	service, err := p.store.GetService(ctx, serviceID)
	if err != nil {
		return fmt.Errorf("failed to get service: %w", err)
	}

	// Get routes for the service to determine probe URL
	routes, err := p.store.ListRoutes(ctx, serviceID)
	if err != nil {
		// Routes are optional, continue with empty slice
		routes = []store.Route{}
	}

	result := p.ProbeService(ctx, &service, routes)
	
	// Log error if health check failed
	if result.Error != nil {
		log.Error().Err(result.Error).Int64("service_id", serviceID).Str("status", result.Status).Msg("health check failed")
	}
	
	// Update health status in store
	if updateErr := p.store.UpdateServiceHealth(ctx, serviceID, result.Status); updateErr != nil {
		return fmt.Errorf("failed to update service health: %w", updateErr)
	}

	return nil
}

// probeHTTP performs HTTP health check with improved error handling
func (p *Prober) probeHTTP(ctx context.Context, service *store.Service, routes []store.Route) ProbeResult {
	url := service.GetHealthProbeURL(routes)
	
	if url == "" {
		log.Debug().Int64("service_id", service.ID).Msg("no health URL available for HTTP probe")
		return ProbeResult{Status: store.HealthStatusUnknown}
	}

	log.Debug().Int64("service_id", service.ID).Str("url", url).Msg("probing HTTP health endpoint")

	// Try GET first (more widely supported than HEAD)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return ProbeResult{
			Status: store.HealthStatusFail,
			Error:  fmt.Errorf("failed to create health request: %w", err),
		}
	}

	// Set user agent to identify health check requests
	req.Header.Set("User-Agent", "GLINR-HealthCheck/1.0")
	req.Header.Set("Accept", "application/json, text/plain, */*")

	resp, err := p.client.Do(req)
	if err != nil {
		log.Debug().Err(err).Int64("service_id", service.ID).Str("url", url).Msg("HTTP health check failed")
		return ProbeResult{
			Status: store.HealthStatusFail,
			Error:  fmt.Errorf("health check failed: %w", err),
		}
	}
	defer resp.Body.Close()

	log.Debug().
		Int64("service_id", service.ID).
		Str("url", url).
		Int("status_code", resp.StatusCode).
		Msg("HTTP health check completed")

	// Accept a wider range of status codes as healthy
	if resp.StatusCode >= 200 && resp.StatusCode < 500 {
		// 2xx, 3xx, 4xx are considered healthy (service is responding)
		// Only 5xx are considered unhealthy
		if resp.StatusCode >= 200 && resp.StatusCode < 300 {
			return ProbeResult{Status: store.HealthStatusOK}
		} else if resp.StatusCode >= 300 && resp.StatusCode < 500 {
			// Redirects and client errors indicate service is up but may have issues
			return ProbeResult{Status: store.HealthStatusOK}
		}
	}

	return ProbeResult{
		Status: store.HealthStatusFail,
		Error:  fmt.Errorf("health check returned status %d", resp.StatusCode),
	}
}

// probeTCP performs TCP connectivity check
func (p *Prober) probeTCP(ctx context.Context, service *store.Service) ProbeResult {
	if len(service.Ports) == 0 {
		return ProbeResult{Status: store.HealthStatusUnknown}
	}

	address := fmt.Sprintf("localhost:%d", service.Ports[0].Host)
	
	dialer := net.Dialer{Timeout: 3 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", address)
	if err != nil {
		return ProbeResult{
			Status: store.HealthStatusFail,
			Error:  fmt.Errorf("TCP connection failed: %w", err),
		}
	}
	defer conn.Close()

	return ProbeResult{Status: store.HealthStatusOK}
}

// probePostgres performs PostgreSQL-specific health check
func (p *Prober) probePostgres(ctx context.Context, service *store.Service) ProbeResult {
	// For now, use TCP connectivity as PostgreSQL health check
	// This could be enhanced with actual PostgreSQL connection test
	return p.probeTCP(ctx, service)
}

// probeMySQL performs MySQL-specific health check  
func (p *Prober) probeMySQL(ctx context.Context, service *store.Service) ProbeResult {
	// For now, use TCP connectivity as MySQL health check
	// This could be enhanced with actual MySQL connection test
	return p.probeTCP(ctx, service)
}

// probeRedis performs Redis-specific health check
func (p *Prober) probeRedis(ctx context.Context, service *store.Service) ProbeResult {
	// For now, use TCP connectivity as Redis health check  
	// This could be enhanced with Redis PING command
	return p.probeTCP(ctx, service)
}
