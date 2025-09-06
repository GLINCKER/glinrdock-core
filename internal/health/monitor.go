package health

import (
	"context"
	"sync"
	"time"

	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/rs/zerolog/log"
)

// Monitor handles periodic health checking for all services
type Monitor struct {
	store    ServiceStore
	prober   *Prober
	interval time.Duration
	ctx      context.Context
	cancel   context.CancelFunc
	wg       sync.WaitGroup
	running  bool
	mu       sync.RWMutex
}

// NewMonitor creates a new health monitor
func NewMonitor(store ServiceStore, interval time.Duration) *Monitor {
	if interval < 30*time.Second {
		interval = 30 * time.Second // Minimum 30 seconds between checks
	}

	return &Monitor{
		store:    store,
		prober:   NewProber(store),
		interval: interval,
	}
}

// Start begins the periodic health monitoring
func (m *Monitor) Start() {
	m.mu.Lock()
	defer m.mu.Unlock()

	if m.running {
		return
	}

	m.ctx, m.cancel = context.WithCancel(context.Background())
	m.running = true

	m.wg.Add(1)
	go m.monitorLoop()

	log.Info().
		Dur("interval", m.interval).
		Msg("health monitor started")
}

// Stop gracefully shuts down the health monitor
func (m *Monitor) Stop() {
	m.mu.Lock()
	defer m.mu.Unlock()

	if !m.running {
		return
	}

	m.cancel()
	m.running = false

	// Wait for monitor loop to finish
	m.wg.Wait()

	log.Info().Msg("health monitor stopped")
}

// monitorLoop runs the main monitoring loop
func (m *Monitor) monitorLoop() {
	defer m.wg.Done()

	ticker := time.NewTicker(m.interval)
	defer ticker.Stop()

	// Run initial health check after a short delay to allow services to start
	initialDelay := time.NewTimer(10 * time.Second)
	defer initialDelay.Stop()

	for {
		select {
		case <-m.ctx.Done():
			return

		case <-initialDelay.C:
			m.probeAllServices()
			initialDelay.Stop() // Disable the initial timer after first run

		case <-ticker.C:
			m.probeAllServices()
		}
	}
}

// probeAllServices checks the health of all services that should be monitored
func (m *Monitor) probeAllServices() {
	log.Debug().Msg("starting health check cycle")

	// For now, we don't have a ListAllServices method, so we'll need to implement one
	// or modify this to work with the existing API structure
	// This is a simplified implementation that would need to be extended

	services := m.getMonitorableServices()
	if len(services) == 0 {
		log.Debug().Msg("no services to monitor")
		return
	}

	probeCount := 0
	successCount := 0
	failCount := 0
	unknownCount := 0

	for _, serviceID := range services {
		select {
		case <-m.ctx.Done():
			return
		default:
		}

		if err := m.prober.ProbeAndUpdate(m.ctx, serviceID); err != nil {
			log.Debug().Err(err).Int64("service_id", serviceID).Msg("health probe failed")
			failCount++
		} else {
			// Get the service to check the updated health status
			if service, err := m.store.GetService(m.ctx, serviceID); err == nil {
				switch service.HealthStatus {
				case store.HealthStatusOK:
					successCount++
				case store.HealthStatusFail:
					failCount++
				default:
					unknownCount++
				}
			}
		}
		probeCount++

		// Small delay between probes to avoid overwhelming the system
		time.Sleep(100 * time.Millisecond)
	}

	log.Info().
		Int("total_probed", probeCount).
		Int("healthy", successCount).
		Int("unhealthy", failCount).
		Int("unknown", unknownCount).
		Msg("health check cycle completed")
}

// getMonitorableServices returns a list of service IDs that should be health monitored
// This is a placeholder implementation - in a real system, you might want to:
// 1. Only monitor running services
// 2. Only monitor services with health check configured
// 3. Respect service-specific monitoring settings
func (m *Monitor) getMonitorableServices() []int64 {
	// This is a simplified implementation
	// In practice, you would need a method to list all services or projects
	// and filter for services that should be monitored

	// For now, return an empty slice since we don't have a ListAllServices method
	// This would need to be implemented based on your specific store interface
	return []int64{}
}

// GetStatus returns the current status of the health monitor
func (m *Monitor) GetStatus() MonitorStatus {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return MonitorStatus{
		Running:  m.running,
		Interval: m.interval,
	}
}

// MonitorStatus represents the current status of the health monitor
type MonitorStatus struct {
	Running  bool          `json:"running"`
	Interval time.Duration `json:"interval"`
}

// MonitorableServiceStore extends ServiceStore with methods needed for monitoring
type MonitorableServiceStore interface {
	ServiceStore
	// ListAllServices would return all services across all projects
	// This method doesn't exist yet but would be needed for comprehensive monitoring
	// ListAllServices(ctx context.Context) ([]store.Service, error)
}
