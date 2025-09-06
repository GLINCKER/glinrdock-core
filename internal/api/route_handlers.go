package api

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// RouteStore interface for route operations
type RouteStore interface {
	CreateRoute(ctx context.Context, serviceID int64, spec store.RouteSpec) (store.Route, error)
	UpdateRoute(ctx context.Context, id int64, spec store.RouteSpec) (store.Route, error)
	ListRoutes(ctx context.Context, serviceID int64) ([]store.Route, error)
	GetRoute(ctx context.Context, id int64) (store.Route, error)
	GetAllRoutes(ctx context.Context) ([]store.Route, error)
	DeleteRoute(ctx context.Context, id int64) error
	GetService(ctx context.Context, id int64) (store.Service, error)
}

// CreateServiceRoute creates a new route for a service
func (h *Handlers) CreateServiceRoute(c *gin.Context) {
	// Parse service ID
	serviceIDStr := c.Param("id")
	serviceID, err := strconv.ParseInt(serviceIDStr, 10, 64)
	if err != nil {
		log.Error().Err(err).Str("id", serviceIDStr).Msg("invalid service ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	// Parse route specification
	var spec store.RouteSpec
	if err := c.ShouldBindJSON(&spec); err != nil {
		log.Error().Err(err).Msg("invalid route specification")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Create route in database
	route, err := h.routeStore.CreateRoute(ctx, serviceID, spec)
	if err != nil {
		log.Error().Err(err).Int64("service_id", serviceID).Msg("failed to create route")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create route"})
		return
	}

	// Regenerate and reload nginx configuration
	if h.nginxConfig != nil {
		if err := h.nginxConfig.UpdateAndReload(ctx); err != nil {
			log.Error().Err(err).Msg("failed to update nginx configuration")
			// Don't fail the request, but log the error
			// The route was created successfully in the database
		}
	}

	log.Info().
		Int64("service_id", serviceID).
		Int64("route_id", route.ID).
		Str("domain", route.Domain).
		Msg("route created successfully")

	// Index route for search asynchronously
	go func() {
		indexCtx, indexCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer indexCancel()
		if err := h.store.IndexRoute(indexCtx, route.ID); err != nil {
			// Log error with sampling to avoid spam (1 in 10 errors logged)
			if route.ID%10 == 0 {
				log.Error().Err(err).Int64("route_id", route.ID).Msg("failed to index route for search")
			}
		}
	}()

	c.JSON(http.StatusCreated, route)
}

// ListServiceRoutes lists all routes for a service
func (h *Handlers) ListServiceRoutes(c *gin.Context) {
	// Parse service ID
	serviceIDStr := c.Param("id")
	serviceID, err := strconv.ParseInt(serviceIDStr, 10, 64)
	if err != nil {
		log.Error().Err(err).Str("id", serviceIDStr).Msg("invalid service ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	routes, err := h.routeStore.ListRoutes(ctx, serviceID)
	if err != nil {
		log.Error().Err(err).Int64("service_id", serviceID).Msg("failed to list routes")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list routes"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"routes": routes})
}

// GetRoute retrieves a single route by ID
func (h *Handlers) GetRoute(c *gin.Context) {
	// Parse route ID
	routeIDStr := c.Param("id")
	routeID, err := strconv.ParseInt(routeIDStr, 10, 64)
	if err != nil {
		log.Error().Err(err).Str("id", routeIDStr).Msg("invalid route ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid route ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	route, err := h.routeStore.GetRoute(ctx, routeID)
	if err != nil {
		log.Error().Err(err).Int64("route_id", routeID).Msg("failed to get route")
		if err.Error() == fmt.Sprintf("route not found: %d", routeID) {
			c.JSON(http.StatusNotFound, gin.H{"error": "route not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get route"})
		}
		return
	}

	c.JSON(http.StatusOK, route)
}

// DeleteRoute removes a route by ID
func (h *Handlers) DeleteRoute(c *gin.Context) {
	// Parse route ID
	routeIDStr := c.Param("id")
	routeID, err := strconv.ParseInt(routeIDStr, 10, 64)
	if err != nil {
		log.Error().Err(err).Str("id", routeIDStr).Msg("invalid route ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid route ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Get route info before deletion (for logging)
	route, err := h.routeStore.GetRoute(ctx, routeID)
	if err != nil {
		log.Error().Err(err).Int64("route_id", routeID).Msg("route not found for deletion")
		c.JSON(http.StatusNotFound, gin.H{"error": "route not found"})
		return
	}

	// Delete route from database
	if err := h.routeStore.DeleteRoute(ctx, routeID); err != nil {
		log.Error().Err(err).Int64("route_id", routeID).Msg("failed to delete route")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete route"})
		return
	}

	// Regenerate and reload nginx configuration
	if h.nginxConfig != nil {
		if err := h.nginxConfig.UpdateAndReload(ctx); err != nil {
			log.Error().Err(err).Msg("failed to update nginx configuration after route deletion")
			// Don't fail the request, but log the error
			// The route was deleted successfully from the database
		}
	}

	// Remove route from search index asynchronously
	go func() {
		indexCtx, indexCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer indexCancel()
		if err := h.store.SearchDeleteByEntity(indexCtx, "route", routeID); err != nil {
			// Log error with sampling to avoid spam (1 in 10 errors logged)
			if routeID%10 == 0 {
				log.Error().Err(err).Int64("route_id", routeID).Msg("failed to delete route from search index")
			}
		}
	}()

	log.Info().
		Int64("route_id", routeID).
		Str("domain", route.Domain).
		Msg("route deleted successfully")

	c.JSON(http.StatusOK, gin.H{"message": "route deleted successfully"})
}

// UpdateRoute updates an existing route
func (h *Handlers) UpdateRoute(c *gin.Context) {
	// Parse route ID
	routeIDStr := c.Param("id")
	routeID, err := strconv.ParseInt(routeIDStr, 10, 64)
	if err != nil {
		log.Error().Err(err).Str("id", routeIDStr).Msg("invalid route ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid route ID"})
		return
	}

	// Parse route specification
	var spec store.RouteSpec
	if err := c.ShouldBindJSON(&spec); err != nil {
		log.Error().Err(err).Msg("invalid route specification")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Update route in database
	route, err := h.routeStore.UpdateRoute(ctx, routeID, spec)
	if err != nil {
		log.Error().Err(err).Int64("route_id", routeID).Msg("failed to update route")
		if err.Error() == fmt.Sprintf("route not found: %d", routeID) {
			c.JSON(http.StatusNotFound, gin.H{"error": "route not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update route"})
		}
		return
	}

	// Regenerate and reload nginx configuration
	if h.nginxConfig != nil {
		if err := h.nginxConfig.UpdateAndReload(ctx); err != nil {
			log.Error().Err(err).Msg("failed to update nginx configuration")
			// Don't fail the request, but log the error
			// The route was updated successfully in the database
		}
	}

	log.Info().
		Int64("route_id", routeID).
		Str("domain", route.Domain).
		Msg("route updated successfully")

	// Update route in search index asynchronously
	go func() {
		indexCtx, indexCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer indexCancel()
		if err := h.store.IndexRoute(indexCtx, route.ID); err != nil {
			// Log error with sampling to avoid spam (1 in 10 errors logged)
			if route.ID%10 == 0 {
				log.Error().Err(err).Int64("route_id", route.ID).Msg("failed to reindex route for search")
			}
		}
	}()

	c.JSON(http.StatusOK, route)
}

// PreviewRouteConfig returns route configuration details for preview
func (h *Handlers) PreviewRouteConfig(c *gin.Context) {
	// Parse route ID
	routeIDStr := c.Param("id")
	routeID, err := strconv.ParseInt(routeIDStr, 10, 64)
	if err != nil {
		log.Error().Err(err).Str("id", routeIDStr).Msg("invalid route ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid route ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// Get the route
	route, err := h.routeStore.GetRoute(ctx, routeID)
	if err != nil {
		log.Error().Err(err).Int64("route_id", routeID).Msg("failed to get route")
		if err.Error() == fmt.Sprintf("route not found: %d", routeID) {
			c.JSON(http.StatusNotFound, gin.H{"error": "route not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get route"})
		}
		return
	}

	// Get the service for this route
	service, err := h.routeStore.GetService(ctx, route.ServiceID)
	if err != nil {
		log.Error().Err(err).Int64("service_id", route.ServiceID).Msg("failed to get service for route preview")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get service"})
		return
	}

	// Get certificate info if configured
	var certificateInfo *gin.H
	if route.TLS && route.CertificateID != nil {
		cert, err := h.store.GetCertificate(ctx, *route.CertificateID)
		if err != nil {
			log.Warn().Err(err).Int64("certificate_id", *route.CertificateID).Msg("failed to get certificate for route preview")
		} else {
			certificateInfo = &gin.H{
				"id":      cert.ID,
				"domain":  cert.Domain,
				"type":    cert.Type,
				"expires": cert.ExpiresAt,
			}
		}
	}

	// Build comprehensive route preview
	response := gin.H{
		"route": gin.H{
			"id":             route.ID,
			"domain":         route.Domain,
			"port":           route.Port,
			"tls":            route.TLS,
			"path":           route.Path,
			"certificate_id": route.CertificateID,
			"proxy_config":   route.ProxyConfig,
			"created_at":     route.CreatedAt,
			"updated_at":     route.UpdatedAt,
		},
		"service": gin.H{
			"id":   service.ID,
			"name": service.Name,
		},
		"certificate": certificateInfo,
		"nginx_config": gin.H{
			"upstream_name": fmt.Sprintf("%s_%d", service.Name, service.ID),
			"server_name":   route.Domain,
			"proxy_pass":    fmt.Sprintf("http://%s_%d", service.Name, service.ID),
		},
		"preview": true,
	}

	c.JSON(http.StatusOK, response)
}

// ListAllRoutes lists all routes in the system (admin endpoint)
func (h *Handlers) ListAllRoutes(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	routes, err := h.routeStore.GetAllRoutes(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to list all routes")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list routes"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"routes": routes})
}

// RegenerateNginxConfig manually triggers nginx configuration regeneration
func (h *Handlers) RegenerateNginxConfig(c *gin.Context) {
	if h.nginxConfig == nil {
		log.Warn().Msg("nginx configuration not available")
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "nginx configuration not available"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	if err := h.nginxConfig.UpdateAndReload(ctx); err != nil {
		log.Error().Err(err).Msg("failed to regenerate nginx configuration")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to regenerate nginx configuration"})
		return
	}

	log.Info().Msg("nginx configuration regenerated successfully")
	c.JSON(http.StatusOK, gin.H{"message": "nginx configuration regenerated successfully"})
}
