package api

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/GLINCKER/glinrdock/internal/nginx"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// NginxHandlers contains nginx management API handlers
type NginxHandlers struct {
	nginxManager *nginx.Manager
	nginxGen     *nginx.Generator
	store        *store.Store
	auditLogger  *audit.Logger
}

// NginxStatusResponse represents nginx health status
type NginxStatusResponse struct {
	Status        string    `json:"status"`
	LastApplyTime *time.Time `json:"last_apply_time,omitempty"`
	LastError     *string    `json:"last_error,omitempty"`
	ConfigHash    *string    `json:"config_hash,omitempty"`
}

// NginxConfigResponse represents the current nginx config
type NginxConfigResponse struct {
	Config     string `json:"config"`
	Hash       string `json:"hash"`
	GeneratedAt time.Time `json:"generated_at"`
	Routes     []store.RouteWithService `json:"routes"`
}

// ValidateResponse represents validation result
type ValidateResponse struct {
	Valid  bool   `json:"valid"`
	Error  string `json:"error,omitempty"`
	Config string `json:"config,omitempty"`
	Hash   string `json:"hash,omitempty"`
}

// NewNginxHandlers creates new nginx handlers
func NewNginxHandlers(nginxManager *nginx.Manager, nginxGen *nginx.Generator, store *store.Store, auditLogger *audit.Logger) *NginxHandlers {
	return &NginxHandlers{
		nginxManager: nginxManager,
		nginxGen:     nginxGen,
		store:        store,
		auditLogger:  auditLogger,
	}
}

// ReloadNginx reloads nginx configuration (admin only)
// @Summary Reload nginx configuration
// @Description Reloads nginx with current configuration
// @Tags nginx
// @Security AdminAuth
// @Produce json
// @Success 200 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/nginx/reload [post]
func (h *NginxHandlers) ReloadNginx(c *gin.Context) {
	if h.nginxManager == nil {
		log.Warn().Msg("nginx manager not available")
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "nginx proxy not enabled"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	log.Info().Msg("manual nginx reload requested")

	// Create reloader and trigger reload
	reloader := nginx.NewReloader()
	err := reloader.Reload(ctx)
	if err != nil {
		log.Error().Err(err).Msg("nginx reload failed")

		// Audit log nginx reload failure
		if h.auditLogger != nil {
			actor := audit.GetActorFromContext(c.Request.Context())
			h.auditLogger.RecordNginxAction(c.Request.Context(), actor, audit.ActionNginxReload, map[string]interface{}{
				"success": false,
				"error":   err.Error(),
			})
		}

		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("nginx reload failed: %v", err)})
		return
	}

	log.Info().Msg("nginx reloaded successfully")

	// Audit log nginx reload
	if h.auditLogger != nil {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordNginxAction(c.Request.Context(), actor, audit.ActionNginxReload, map[string]interface{}{
			"success": true,
		})
	}

	c.JSON(http.StatusOK, gin.H{"message": "nginx reloaded successfully"})
}

// GetNginxStatus returns nginx health status
// @Summary Get nginx status
// @Description Returns nginx health status and last configuration apply information
// @Tags nginx
// @Security AdminAuth
// @Produce json
// @Success 200 {object} NginxStatusResponse
// @Failure 500 {object} map[string]string
// @Router /v1/nginx/status [get]
func (h *NginxHandlers) GetNginxStatus(c *gin.Context) {
	if h.nginxManager == nil {
		log.Warn().Msg("nginx manager not available")
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "nginx proxy not enabled"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Try nginx -t to check configuration validity
	validator := nginx.NewValidator()
	err := validator.ValidateConfig(ctx, "# Basic nginx config validation test")

	status := "healthy"
	var lastError *string
	if err != nil {
		status = "error"
		errStr := err.Error()
		lastError = &errStr
		log.Debug().Err(err).Msg("nginx validation check failed")
	}

	// TODO: In future, get last apply time and config hash from persistent state
	response := NginxStatusResponse{
		Status:    status,
		LastError: lastError,
	}

	c.JSON(http.StatusOK, response)
}

// GetCurrentConfig returns currently active nginx configuration
// @Summary Get current nginx configuration  
// @Description Returns the currently active nginx configuration rendered from database
// @Tags nginx
// @Security AdminAuth
// @Produce json
// @Success 200 {object} NginxConfigResponse
// @Failure 500 {object} map[string]string
// @Router /v1/nginx/config [get]
func (h *NginxHandlers) GetCurrentConfig(c *gin.Context) {
	if h.nginxGen == nil {
		log.Warn().Msg("nginx generator not available")
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "nginx proxy not enabled"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Get all routes from database
	routes, err := h.store.GetAllRoutes(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to get routes for nginx config")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve routes"})
		return
	}

	// Convert to RouteWithService (TODO: implement proper join query)
	routesWithServices := make([]store.RouteWithService, len(routes))
	for i, route := range routes {
		service, err := h.store.GetService(ctx, route.ServiceID)
		if err != nil {
			log.Warn().Err(err).Int64("service_id", route.ServiceID).Msg("failed to get service for route")
			continue
		}
		routesWithServices[i] = store.RouteWithService{
			Route:       route,
			ServiceName: service.Name,
			ProjectName: "", // TODO: get project name
		}
	}

	// Get certificates  
	certificates, err := h.store.ListCertificates(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to get certificates for nginx config")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve certificates"})
		return
	}

	// Convert certificates to map
	certMap := make(map[string]store.EnhancedCertificate)
	for _, cert := range certificates {
		certMap[cert.Domain] = cert
	}

	// Generate configuration
	renderInput := nginx.RenderInput{
		Routes: routesWithServices,
		Certs:  certMap,
	}

	config, hash, err := h.nginxGen.Render(renderInput)
	if err != nil {
		log.Error().Err(err).Msg("failed to render nginx configuration")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate configuration"})
		return
	}

	response := NginxConfigResponse{
		Config:      config,
		Hash:        hash,
		GeneratedAt: time.Now(),
		Routes:      routesWithServices,
	}

	c.JSON(http.StatusOK, response)
}

// ValidateCurrentConfig validates current nginx configuration without applying
// @Summary Validate current nginx configuration
// @Description Performs a dry-run validation of the current nginx configuration
// @Tags nginx
// @Security AdminAuth
// @Produce json
// @Success 200 {object} ValidateResponse
// @Failure 500 {object} map[string]string
// @Router /v1/nginx/validate [post]
func (h *NginxHandlers) ValidateCurrentConfig(c *gin.Context) {
	if h.nginxGen == nil {
		log.Warn().Msg("nginx generator not available")
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "nginx proxy not enabled"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 15*time.Second)
	defer cancel()

	// Get current configuration (same logic as GetCurrentConfig)
	routes, err := h.store.GetAllRoutes(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to get routes for validation")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve routes"})
		return
	}

	// Convert to RouteWithService
	routesWithServices := make([]store.RouteWithService, len(routes))
	for i, route := range routes {
		service, err := h.store.GetService(ctx, route.ServiceID)
		if err != nil {
			log.Warn().Err(err).Int64("service_id", route.ServiceID).Msg("failed to get service for route")
			continue
		}
		routesWithServices[i] = store.RouteWithService{
			Route:       route,
			ServiceName: service.Name,
			ProjectName: "", // TODO: get project name
		}
	}

	certificates, err := h.store.ListCertificates(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to get certificates for validation")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve certificates"})
		return
	}

	certMap := make(map[string]store.EnhancedCertificate)
	for _, cert := range certificates {
		certMap[cert.Domain] = cert
	}

	renderInput := nginx.RenderInput{
		Routes: routesWithServices,
		Certs:  certMap,
	}

	config, hash, err := h.nginxGen.Render(renderInput)
	if err != nil {
		log.Error().Err(err).Msg("failed to render configuration for validation")
		c.JSON(http.StatusOK, ValidateResponse{
			Valid: false,
			Error: fmt.Sprintf("configuration generation failed: %v", err),
		})
		return
	}

	// Validate the generated configuration
	validator := nginx.NewValidator()
	err = validator.ValidateConfig(ctx, config)

	response := ValidateResponse{
		Valid:  err == nil,
		Config: config,
		Hash:   hash,
	}

	if err != nil {
		response.Error = err.Error()
		log.Debug().Err(err).Msg("nginx configuration validation failed")
	}

	// Audit log nginx validation
	if h.auditLogger != nil {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordNginxAction(c.Request.Context(), actor, audit.ActionNginxValidate, map[string]interface{}{
			"valid": response.Valid,
			"hash":  response.Hash,
		})
	}

	c.JSON(http.StatusOK, response)
}