package api

import (
	"net/http"
	"strconv"

	"github.com/GLINCKER/glinrdock/internal/health"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// DebugServiceHealth provides detailed health check information for debugging
func (h *Handlers) DebugServiceHealth(c *gin.Context) {
	serviceIDStr := c.Param("id")
	serviceID, err := strconv.ParseInt(serviceIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	ctx := c.Request.Context()

	// Get service details
	service, err := h.serviceStore.GetService(ctx, serviceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "service not found"})
		return
	}

	// Get routes for the service
	routes, err := h.serviceStore.ListRoutes(ctx, serviceID)
	if err != nil {
		routes = []store.Route{} // Continue with empty routes
	}

	// Create a prober for testing
	prober := health.NewProber(h.serviceStore)

	// Generate health probe URL
	healthURL := service.GetHealthProbeURL(routes)
	healthCheckType := service.GetHealthCheckType()

	// Perform the actual probe
	probeResult := prober.ProbeService(ctx, &service, routes)

	debugInfo := map[string]interface{}{
		"service_id":        serviceID,
		"service_name":      service.Name,
		"service_status":    service.Status,
		"desired_state":     service.DesiredState,
		"crash_looping":     service.CrashLooping,
		"current_health":    service.HealthStatus,
		"last_probe_at":     service.LastProbeAt,
		"health_path":       service.HealthPath,
		"health_check_type": healthCheckType,
		"generated_url":     healthURL,
		"ports":             service.Ports,
		"routes":            routes,
		"probe_result": map[string]interface{}{
			"status": probeResult.Status,
			"error":  nil,
		},
		"troubleshooting": generateTroubleshootingTips(service, routes, healthURL, probeResult),
	}

	if probeResult.Error != nil {
		debugInfo["probe_result"].(map[string]interface{})["error"] = probeResult.Error.Error()
	}

	log.Debug().
		Int64("service_id", serviceID).
		Str("health_url", healthURL).
		Str("probe_status", probeResult.Status).
		Msg("debug health check performed")

	c.JSON(http.StatusOK, debugInfo)
}

// generateTroubleshootingTips provides helpful debugging information
func generateTroubleshootingTips(service store.Service, routes []store.Route, healthURL string, result health.ProbeResult) []string {
	tips := []string{}

	// Check if service is running
	if service.Status != "running" {
		tips = append(tips, "🔍 Service is not running - health checks will fail until service is started")
	}

	// Check if service is crash looping
	if service.CrashLooping {
		tips = append(tips, "🔄 Service is in crash loop - health checks are disabled")
	}

	// Check if health path is configured
	if service.HealthPath == nil {
		tips = append(tips, "⚕️ No health path configured - using default '/health' endpoint")
	}

	// Check if service has ports
	if len(service.Ports) == 0 {
		tips = append(tips, "🚪 No ports configured - cannot perform HTTP health checks")
	}

	// Check if health URL was generated
	if healthURL == "" {
		tips = append(tips, "🌐 No health URL could be generated - check port configuration")
	} else {
		if len(routes) > 0 {
			tips = append(tips, "🔗 Using external route for health check: "+healthURL)
		} else {
			tips = append(tips, "🏠 Using localhost port for health check: "+healthURL)
		}
	}

	// Provide tips based on probe result
	if result.Error != nil {
		tips = append(tips, "❌ Health probe failed: "+result.Error.Error())

		if len(service.Ports) > 0 {
			port := service.Ports[0].Host
			tips = append(tips, "💡 Try testing manually: curl -v http://localhost:"+strconv.Itoa(port)+"/health")
		}
	}

	// Health check type specific tips
	healthType := service.GetHealthCheckType()
	switch healthType {
	case store.HealthCheckHTTP:
		tips = append(tips, "🌐 HTTP health check - ensure service responds to HTTP requests")
	case store.HealthCheckTCP:
		tips = append(tips, "🔌 TCP health check - checking if port accepts connections")
	case store.HealthCheckPostgres:
		tips = append(tips, "🐘 PostgreSQL health check - checking database connectivity")
	case store.HealthCheckMySQL:
		tips = append(tips, "🐬 MySQL health check - checking database connectivity")
	case store.HealthCheckRedis:
		tips = append(tips, "🔴 Redis health check - checking cache connectivity")
	}

	if len(tips) == 0 {
		tips = append(tips, "✅ Configuration looks good - health checks should work")
	}

	return tips
}
