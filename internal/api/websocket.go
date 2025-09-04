package api

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/client"
)

// WebSocketUpgrader configures the WebSocket upgrader
var WebSocketUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins for now - should be configured properly in production
		return true
	},
}

// ServiceLogsHandler handles GET /v1/services/:id/logs (WebSocket)
func (h *Handlers) ServiceLogsHandler(c *gin.Context) {
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

	// Check if service has a container ID, if not try to discover by label
	var containerID string
	if service.ContainerID != nil && *service.ContainerID != "" {
		containerID = *service.ContainerID
	} else {
		// Auto-discover container by service_id label for existing services
		discoveredID, err := h.discoverContainerByServiceID(c.Request.Context(), serviceID)
		if err != nil {
			log.Warn().Err(err).Int64("service_id", serviceID).Msg("failed to discover container")
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "service container not available"})
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

	// Upgrade to WebSocket
	conn, err := WebSocketUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Error().Err(err).Msg("failed to upgrade to websocket")
		return
	}
	defer conn.Close()

	// Get logs stream using container ID
	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	logsReader, err := h.dockerEngine.Logs(ctx, containerID, true)
	if err != nil {
		log.Error().Err(err).Str("container_id", containerID).Msg("failed to get container logs")
		conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("Error: %s", err.Error())))
		return
	}
	defer logsReader.Close()

	// Stream logs to WebSocket
	go func() {
		defer cancel()
		scanner := make([]byte, 4096)
		for {
			select {
			case <-ctx.Done():
				return
			default:
			}

			n, err := logsReader.Read(scanner)
			if err != nil {
				if err == io.EOF {
					return
				}
				log.Error().Err(err).Msg("error reading logs")
				return
			}

			if n > 0 {
				if err := conn.WriteMessage(websocket.TextMessage, scanner[:n]); err != nil {
					log.Error().Err(err).Msg("error writing to websocket")
					return
				}
			}
		}
	}()

	// Handle WebSocket messages (ping/pong)
	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			log.Debug().Err(err).Msg("websocket connection closed")
			break
		}
	}
}

// ServiceStatsHandler handles GET /v1/services/:id/stats (WebSocket)
func (h *Handlers) ServiceStatsHandler(c *gin.Context) {
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

	// Check if service has a container ID, if not try to discover by label
	var containerID string
	if service.ContainerID != nil && *service.ContainerID != "" {
		containerID = *service.ContainerID
	} else {
		// Auto-discover container by service_id label for existing services
		discoveredID, err := h.discoverContainerByServiceID(c.Request.Context(), serviceID)
		if err != nil {
			log.Warn().Err(err).Int64("service_id", serviceID).Msg("failed to discover container")
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "service container not available"})
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

	// Upgrade to WebSocket
	conn, err := WebSocketUpgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Error().Err(err).Msg("failed to upgrade to websocket")
		return
	}
	defer conn.Close()

	// Get stats stream using container ID
	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	statsCh, errCh := h.dockerEngine.Stats(ctx, containerID)

	// Stream stats to WebSocket
	go func() {
		defer cancel()
		for {
			select {
			case <-ctx.Done():
				return
			case err := <-errCh:
				if err != nil {
					log.Error().Err(err).Str("container_id", containerID).Msg("error getting container stats")
					conn.WriteMessage(websocket.TextMessage, []byte(fmt.Sprintf("Error: %s", err.Error())))
					return
				}
			case stats, ok := <-statsCh:
				if !ok {
					return
				}

				if err := conn.WriteJSON(stats); err != nil {
					log.Error().Err(err).Msg("error writing stats to websocket")
					return
				}
			}
		}
	}()

	// Handle WebSocket messages (ping/pong) and keep connection alive
	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if err := conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				log.Debug().Err(err).Msg("websocket ping failed")
				return
			}
		default:
			conn.SetReadDeadline(time.Now().Add(60 * time.Second))
			_, _, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Error().Err(err).Msg("websocket error")
				}
				return
			}
		}
	}
}

// ServiceLogsTailHandler handles GET /v1/services/:id/logs?tail=N (REST)
func (h *Handlers) ServiceLogsTailHandler(c *gin.Context) {
	// Parse service ID
	idParam := c.Param("id")
	serviceID, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		log.Error().Err(err).Str("id", idParam).Msg("invalid service ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	// Parse tail parameter (default to 50 lines)
	tailParam := c.DefaultQuery("tail", "50")
	tailLines, err := strconv.Atoi(tailParam)
	if err != nil || tailLines < 1 || tailLines > 1000 {
		tailLines = 50 // Default to 50 lines, max 1000 for safety
	}

	// Get service from database to get container name
	service, err := h.serviceStore.GetService(c.Request.Context(), serviceID)
	if err != nil {
		log.Error().Err(err).Int64("service_id", serviceID).Msg("failed to get service")
		c.JSON(http.StatusNotFound, gin.H{"error": "service not found"})
		return
	}

	// Check if service has a container ID, if not try to discover by label
	var containerID string
	if service.ContainerID != nil && *service.ContainerID != "" {
		containerID = *service.ContainerID
	} else {
		// Auto-discover container by service_id label for existing services
		discoveredID, err := h.discoverContainerByServiceID(c.Request.Context(), serviceID)
		if err != nil {
			log.Warn().Err(err).Int64("service_id", serviceID).Msg("failed to discover container")
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "service container not available"})
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

	// Get logs (non-following for REST)
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	logsReader, err := h.dockerEngine.Logs(ctx, containerID, false) // false = no follow
	if err != nil {
		log.Error().Err(err).Str("container_id", containerID).Msg("failed to get container logs")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get container logs"})
		return
	}
	defer logsReader.Close()

	// Read all logs and split into lines
	logBytes, err := io.ReadAll(logsReader)
	if err != nil {
		log.Error().Err(err).Str("container_id", containerID).Msg("failed to read container logs")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read container logs"})
		return
	}

	// Split logs into lines and get the tail
	logLines := strings.Split(strings.TrimSpace(string(logBytes)), "\n")
	
	// Get last N lines
	var tailedLines []string
	if len(logLines) > tailLines {
		tailedLines = logLines[len(logLines)-tailLines:]
	} else {
		tailedLines = logLines
	}

	// Remove empty lines
	var filteredLines []string
	for _, line := range tailedLines {
		if strings.TrimSpace(line) != "" {
			filteredLines = append(filteredLines, line)
		}
	}

	response := map[string]interface{}{
		"service_id":   serviceID,
		"container":    containerID,
		"tail_lines":   tailLines,
		"total_lines":  len(filteredLines),
		"logs":         filteredLines,
	}

	log.Debug().Int64("service_id", serviceID).Str("container_id", containerID).Int("lines", len(filteredLines)).Msg("service logs retrieved")
	c.JSON(http.StatusOK, response)
}

// discoverContainerByServiceID discovers a container using Docker labels
func (h *Handlers) discoverContainerByServiceID(ctx context.Context, serviceID int64) (string, error) {
	// Create a Docker client - this should ideally be injected, but for now create directly
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return "", fmt.Errorf("failed to create Docker client: %w", err)
	}
	defer cli.Close()

	// Create filter to find containers with our service_id label
	labelFilter := filters.NewArgs()
	labelFilter.Add("label", fmt.Sprintf("glinr.service_id=%d", serviceID))
	labelFilter.Add("label", "glinr.managed=true")

	// List containers matching the filter
	containers, err := cli.ContainerList(ctx, container.ListOptions{
		All:     true, // Include stopped containers
		Filters: labelFilter,
	})
	if err != nil {
		return "", fmt.Errorf("failed to list containers: %w", err)
	}

	if len(containers) == 0 {
		return "", fmt.Errorf("no container found with service_id=%d", serviceID)
	}

	if len(containers) > 1 {
		log.Warn().Int64("service_id", serviceID).Int("count", len(containers)).Msg("multiple containers found for service, using first one")
	}

	containerID := containers[0].ID
	log.Info().Int64("service_id", serviceID).Str("container_id", containerID).Msg("discovered container by label")

	return containerID, nil
}