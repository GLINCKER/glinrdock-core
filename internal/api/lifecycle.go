package api

import (
	"net/http"
	"strconv"

	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/GLINCKER/glinrdock/internal/auth"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// StartServiceHandler handles POST /v1/services/:id/start
func (h *Handlers) StartServiceHandler(c *gin.Context) {
	// Parse service ID
	idParam := c.Param("id")
	serviceID, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		log.Error().Err(err).Str("id", idParam).Msg("invalid service ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	// Get service from database to get container name
	service, err := h.serviceStore.GetService(c.Request.Context(), serviceID)
	if err != nil {
		log.Error().Err(err).Int64("service_id", serviceID).Msg("failed to get service")
		c.JSON(http.StatusNotFound, gin.H{"error": "service not found"})
		return
	}

	// Try to discover container by service ID first, fall back to name-based discovery
	var containerID string
	if service.ContainerID != nil && *service.ContainerID != "" {
		containerID = *service.ContainerID
	} else {
		// Auto-discover container by service_id label for existing services
		discoveredID, err := h.discoverContainerByServiceID(c.Request.Context(), serviceID)
		if err != nil {
			log.Warn().Err(err).Int64("service_id", serviceID).Msg("failed to discover container")
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "service container not found"})
			return
		}
		containerID = discoveredID

		// Update the service record with discovered container ID
		err = h.serviceStore.UpdateServiceContainerID(c.Request.Context(), serviceID, containerID)
		if err != nil {
			log.Warn().Err(err).Int64("service_id", serviceID).Msg("failed to update container ID")
			// Continue anyway since we have the ID
		}
	}

	// Start the container
	err = h.dockerEngine.Start(c.Request.Context(), containerID)
	if err != nil {
		log.Error().Err(err).Str("container_id", containerID).Msg("failed to start container")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to start service"})
		return
	}

	// Audit log service start
	if h.auditLogger != nil {
		actor := auth.CurrentTokenName(c)
		if actor == "" {
			actor = "system"
		}
		h.auditLogger.RecordServiceAction(c.Request.Context(), actor, audit.ActionServiceStart, strconv.FormatInt(serviceID, 10), map[string]interface{}{
			"service_name": service.Name,
			"project_id":   service.ProjectID,
			"container_id": containerID,
			"started_by":   auth.CurrentRole(c),
		})
	}

	log.Info().Int64("service_id", serviceID).Str("container_id", containerID).Msg("service started successfully")
	c.JSON(http.StatusOK, gin.H{"message": "service started successfully"})
}

// StopServiceHandler handles POST /v1/services/:id/stop
func (h *Handlers) StopServiceHandler(c *gin.Context) {
	// Parse service ID
	idParam := c.Param("id")
	serviceID, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		log.Error().Err(err).Str("id", idParam).Msg("invalid service ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	// Get service from database to get container name
	service, err := h.serviceStore.GetService(c.Request.Context(), serviceID)
	if err != nil {
		log.Error().Err(err).Int64("service_id", serviceID).Msg("failed to get service")
		c.JSON(http.StatusNotFound, gin.H{"error": "service not found"})
		return
	}

	// Try to discover container by service ID first
	var containerID string
	if service.ContainerID != nil && *service.ContainerID != "" {
		containerID = *service.ContainerID
	} else {
		// Auto-discover container by service_id label for existing services
		discoveredID, err := h.discoverContainerByServiceID(c.Request.Context(), serviceID)
		if err != nil {
			log.Warn().Err(err).Int64("service_id", serviceID).Msg("failed to discover container")
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "service container not found"})
			return
		}
		containerID = discoveredID

		// Update the service record with discovered container ID
		err = h.serviceStore.UpdateServiceContainerID(c.Request.Context(), serviceID, containerID)
		if err != nil {
			log.Warn().Err(err).Int64("service_id", serviceID).Msg("failed to update container ID")
			// Continue anyway since we have the ID
		}
	}

	// Stop the container
	err = h.dockerEngine.Stop(c.Request.Context(), containerID)
	if err != nil {
		log.Error().Err(err).Str("container_id", containerID).Msg("failed to stop container")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to stop service"})
		return
	}

	// Audit log service stop
	if h.auditLogger != nil {
		actor := auth.CurrentTokenName(c)
		if actor == "" {
			actor = "system"
		}
		h.auditLogger.RecordServiceAction(c.Request.Context(), actor, audit.ActionServiceStop, strconv.FormatInt(serviceID, 10), map[string]interface{}{
			"service_name": service.Name,
			"project_id":   service.ProjectID,
			"container_id": containerID,
			"stopped_by":   auth.CurrentRole(c),
		})
	}

	log.Info().Int64("service_id", serviceID).Str("container_id", containerID).Msg("service stopped successfully")
	c.JSON(http.StatusOK, gin.H{"message": "service stopped successfully"})
}

// RestartServiceHandler handles POST /v1/services/:id/restart
func (h *Handlers) RestartServiceHandler(c *gin.Context) {
	// Parse service ID
	idParam := c.Param("id")
	serviceID, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		log.Error().Err(err).Str("id", idParam).Msg("invalid service ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	// Get service from database to get container name
	service, err := h.serviceStore.GetService(c.Request.Context(), serviceID)
	if err != nil {
		log.Error().Err(err).Int64("service_id", serviceID).Msg("failed to get service")
		c.JSON(http.StatusNotFound, gin.H{"error": "service not found"})
		return
	}

	// Try to discover container by service ID first
	var containerID string
	if service.ContainerID != nil && *service.ContainerID != "" {
		containerID = *service.ContainerID
	} else {
		// Auto-discover container by service_id label for existing services
		discoveredID, err := h.discoverContainerByServiceID(c.Request.Context(), serviceID)
		if err != nil {
			log.Warn().Err(err).Int64("service_id", serviceID).Msg("failed to discover container")
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "service container not found"})
			return
		}
		containerID = discoveredID

		// Update the service record with discovered container ID
		err = h.serviceStore.UpdateServiceContainerID(c.Request.Context(), serviceID, containerID)
		if err != nil {
			log.Warn().Err(err).Int64("service_id", serviceID).Msg("failed to update container ID")
			// Continue anyway since we have the ID
		}
	}

	// Restart the container
	err = h.dockerEngine.Restart(c.Request.Context(), containerID)
	if err != nil {
		log.Error().Err(err).Str("container_id", containerID).Msg("failed to restart container")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to restart service"})
		return
	}

	// Audit log service restart
	if h.auditLogger != nil {
		actor := auth.CurrentTokenName(c)
		if actor == "" {
			actor = "system"
		}
		h.auditLogger.RecordServiceAction(c.Request.Context(), actor, audit.ActionServiceRestart, strconv.FormatInt(serviceID, 10), map[string]interface{}{
			"service_name": service.Name,
			"project_id":   service.ProjectID,
			"container_id": containerID,
			"restarted_by": auth.CurrentRole(c),
		})
	}

	log.Info().Int64("service_id", serviceID).Str("container_id", containerID).Msg("service restarted successfully")
	c.JSON(http.StatusOK, gin.H{"message": "service restarted successfully"})
}
