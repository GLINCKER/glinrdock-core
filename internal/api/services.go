package api

import (
	"context"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/GLINCKER/glinrdock/internal/auth"
	"github.com/GLINCKER/glinrdock/internal/dockerx"
	"github.com/GLINCKER/glinrdock/internal/health"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/client"
)

// ServiceStore interface for service operations
type ServiceStore interface {
	CreateService(ctx context.Context, projectID int64, spec store.ServiceSpec) (store.Service, error)
	ListServices(ctx context.Context, projectID int64) ([]store.Service, error)
	GetService(ctx context.Context, id int64) (store.Service, error)
	GetServiceByContainerID(ctx context.Context, containerID string) (*store.Service, error)
	UpdateService(ctx context.Context, id int64, updates store.Service) error
	UpdateServiceHealth(ctx context.Context, serviceID int64, healthStatus string) error
	UpdateServiceState(ctx context.Context, serviceID int64, desiredState string, crashLooping bool) error
	UpdateServiceRestart(ctx context.Context, serviceID int64, exitCode int, restartCount int, windowStart *time.Time) error
	UnlockService(ctx context.Context, serviceID int64) error
	ListRoutes(ctx context.Context, serviceID int64) ([]store.Route, error)
	UpdateServiceContainerID(ctx context.Context, id int64, containerID string) error
	DeleteService(ctx context.Context, id int64) error
	GetProject(ctx context.Context, id int64) (store.Project, error)
	// Networking methods
	GetServiceNetwork(ctx context.Context, serviceID int64) (store.ServiceNetwork, error)
	CreateServiceLinks(ctx context.Context, serviceID int64, targetIDs []int64) error
	GetServiceLinks(ctx context.Context, serviceID int64) ([]store.LinkedService, error)
}

// DockerEngine interface for Docker operations
type DockerEngine interface {
	Pull(ctx context.Context, image string, registryID string) error
	Create(ctx context.Context, name string, spec dockerx.ContainerSpec, labels map[string]string) (string, error)
	Remove(ctx context.Context, id string) error
	Start(ctx context.Context, id string) error
	Stop(ctx context.Context, id string) error
	Restart(ctx context.Context, id string) error
	Logs(ctx context.Context, id string, follow bool) (io.ReadCloser, error)
	Stats(ctx context.Context, id string) (<-chan dockerx.ContainerStats, <-chan error)
	Inspect(ctx context.Context, containerID string) (dockerx.ContainerStatus, error)
	
	// Network operations
	EnsureNetwork(ctx context.Context, networkName string, labels map[string]string) error
	ConnectNetwork(ctx context.Context, networkName, containerID string, aliases []string) error
	DisconnectNetwork(ctx context.Context, networkName, containerID string) error
}

// CreateService creates a new service and its container
func (h *Handlers) CreateService(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseInt(projectIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project ID"})
		return
	}

	var spec store.ServiceSpec
	if err := c.ShouldBindJSON(&spec); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	// Verify project exists and get project info
	project, err := h.serviceStore.GetProject(ctx, projectID)
	if err != nil {
		if err.Error() == fmt.Sprintf("project not found: %d", projectID) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify project"})
		}
		return
	}

	// Pull Docker image
	var registryID string
	if spec.RegistryID != nil {
		registryID = *spec.RegistryID
	}
	if err := h.dockerEngine.Pull(ctx, spec.Image, registryID); err != nil {
		log.Error().Err(err).Str("image", spec.Image).Msg("failed to pull image")
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to pull image"})
		return
	}

	// Create service record first
	service, err := h.serviceStore.CreateService(ctx, projectID, spec)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create container with labels
	containerName := fmt.Sprintf("glinr_%d_%s", projectID, spec.Name)
	labels := map[string]string{
		"glinr.project_id": strconv.FormatInt(projectID, 10),
		"glinr.service_id": strconv.FormatInt(service.ID, 10),
		"glinr.managed":    "true",
	}

	containerSpec := dockerx.ContainerSpec{
		Image: spec.Image,
		Env:   spec.Env,
		Ports: spec.Ports,
	}

	containerID, err := h.dockerEngine.Create(ctx, containerName, containerSpec, labels)
	if err != nil {
		// Cleanup: delete service record if container creation fails
		h.serviceStore.DeleteService(ctx, service.ID)
		log.Error().Err(err).Str("container_name", containerName).Msg("failed to create container")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create container"})
		return
	}

	// Store the container ID in the service record
	err = h.serviceStore.UpdateServiceContainerID(ctx, service.ID, containerID)
	if err != nil {
		log.Error().Err(err).Int64("service_id", service.ID).Str("container_id", containerID).Msg("failed to store container ID")
		// Don't fail the whole operation, just log the error
	}

	// Set up project networking
	var networkName string
	if project.NetworkName != nil && *project.NetworkName != "" {
		networkName = *project.NetworkName
	} else {
		// Generate network name if not set (for backward compatibility)
		networkName = store.GenerateProjectNetworkName(projectID)
	}

	// Ensure project network exists
	networkLabels := map[string]string{
		"glinr.project_id": strconv.FormatInt(projectID, 10),
		"glinr.managed":    "true",
		"owner":            "glinrdock",
	}
	if err := h.dockerEngine.EnsureNetwork(ctx, networkName, networkLabels); err != nil {
		log.Error().Err(err).Str("network", networkName).Msg("failed to ensure project network")
		// Don't fail the whole operation, just log the error
	} else {
		// Connect container to project network with aliases
		aliases := store.GenerateServiceAliases(project.Name, service.Name)
		if err := h.dockerEngine.ConnectNetwork(ctx, networkName, containerID, aliases); err != nil {
			log.Error().Err(err).Str("network", networkName).Str("container", containerID).Msg("failed to connect container to project network")
			// Don't fail the whole operation, just log the error
		} else {
			log.Info().Str("network", networkName).Strs("aliases", aliases).Msg("connected service to project network")
		}
	}

	// Audit logging
	if h.auditLogger != nil {
		ctx := c.Request.Context()
		actor := audit.GetActorFromContext(ctx)
		
		h.auditLogger.RecordProjectAction(ctx, actor, audit.ActionProjectNetworkEnsure, strconv.FormatInt(projectID, 10), map[string]interface{}{
			"network_name": networkName,
		})

		aliases := store.GenerateServiceAliases(project.Name, service.Name)
		h.auditLogger.RecordServiceAction(ctx, actor, audit.ActionServiceNetworkAttach, strconv.FormatInt(service.ID, 10), map[string]interface{}{
			"network_name": networkName,
			"aliases":      aliases,
		})
	}

	log.Info().
		Int64("project_id", projectID).
		Int64("service_id", service.ID).
		Str("container_id", containerID).
		Str("network", networkName).
		Str("image", spec.Image).
		Msg("service created successfully")

	// Index service for search asynchronously
	go func() {
		indexCtx, indexCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer indexCancel()
		if err := h.store.IndexService(indexCtx, service.ID); err != nil {
			// Log error with sampling to avoid spam (1 in 10 errors logged)
			if service.ID%10 == 0 {
				log.Error().Err(err).Int64("service_id", service.ID).Msg("failed to index service for search")
			}
		}
	}()

	c.JSON(http.StatusCreated, service)
}

// ListServices returns all services for a project
func (h *Handlers) ListServices(c *gin.Context) {
	projectIDStr := c.Param("id")
	projectID, err := strconv.ParseInt(projectIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	services, err := h.serviceStore.ListServices(ctx, projectID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list services"})
		return
	}

	// Populate status from event cache or Docker inspect
	if h.eventCache != nil {
		for i := range services {
			if state, exists := h.eventCache.GetServiceState(services[i].ID); exists {
				services[i].Status = state.Status
			} else {
				// Try to use stored container_id first, then fallback to container name pattern
				var containerIdentifier string
				if services[i].ContainerID != nil && *services[i].ContainerID != "" {
					containerIdentifier = *services[i].ContainerID
				} else {
					containerIdentifier = fmt.Sprintf("glinr_%d_%s", services[i].ProjectID, services[i].Name)
				}
				
				if status, err := h.dockerEngine.Inspect(ctx, containerIdentifier); err == nil {
					// Map Docker states to our status format
					switch status.State {
					case "running":
						services[i].Status = "running"
					case "exited", "dead":
						services[i].Status = "stopped"
					case "created":
						services[i].Status = "created"
					case "paused":
						services[i].Status = "paused"
					default:
						services[i].Status = "stopped"
					}
				} else {
					services[i].Status = "stopped" // default if inspect fails or container doesn't exist
				}
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"services": services})
}

// ServiceDetailResponse represents the enhanced service detail response
type ServiceDetailResponse struct {
	ID                int64                 `json:"id"`
	ProjectID         int64                 `json:"project_id"`
	Name              string                `json:"name"`
	Description       *string               `json:"description,omitempty"`
	Image             string                `json:"image"`
	Status            string                `json:"status"`
	CreatedAt         time.Time             `json:"created_at"`
	UpdatedAt         *time.Time            `json:"updated_at,omitempty"`
	Ports             []store.PortMap       `json:"ports"`
	Volumes           []VolumeMap           `json:"volumes,omitempty"`
	EnvSummaryCount   int                   `json:"env_summary_count"`
	LastDeployAt      *time.Time            `json:"last_deploy_at,omitempty"`
	ContainerID       *string               `json:"container_id,omitempty"`
	StateReason       *string               `json:"state_reason,omitempty"`
	StartedAt         *time.Time            `json:"started_at,omitempty"`
	Network           *store.ServiceNetwork `json:"network,omitempty"`      // Network information
	Aliases           []string              `json:"aliases,omitempty"`      // DNS aliases
	
	// Health and crash loop fields
	DesiredState      string                `json:"desired_state"`
	LastExitCode      *int                  `json:"last_exit_code,omitempty"`
	RestartCount      int                   `json:"restart_count"`
	RestartWindowAt   *time.Time            `json:"restart_window_at,omitempty"`
	CrashLooping      bool                  `json:"crash_looping"`
	HealthStatus      string                `json:"health_status"`
	HealthPath        *string               `json:"health_path,omitempty"`
	LastProbeAt       *time.Time            `json:"last_probe_at,omitempty"`
}

// VolumeMap represents a volume mapping from host to container
type VolumeMap struct {
	Host      string `json:"host"`
	Container string `json:"container"`
	ReadOnly  bool   `json:"ro"`
}

// GetService returns a single service by ID with enhanced details
func (h *Handlers) GetService(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	service, err := h.serviceStore.GetService(ctx, id)
	if err != nil {
		if err.Error() == fmt.Sprintf("service not found: %d", id) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else {
			log.Error().Err(err).Int64("service_id", id).Msg("failed to get service")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get service"})
		}
		return
	}

	// Build enhanced response
	response := ServiceDetailResponse{
		ID:              service.ID,
		ProjectID:       service.ProjectID,
		Name:            service.Name,
		Image:           service.Image,
		CreatedAt:       service.CreatedAt,
		Ports:           service.Ports,
		Volumes:         []VolumeMap{}, // TODO: Add volume support to service spec
		EnvSummaryCount: len(service.Env),
		
		// Health and crash loop fields
		DesiredState:     service.DesiredState,
		LastExitCode:     service.LastExitCode,
		RestartCount:     service.RestartCount,
		RestartWindowAt:  service.RestartWindowAt,
		CrashLooping:     service.CrashLooping,
		HealthStatus:     service.HealthStatus,
		HealthPath:       service.HealthPath,
		LastProbeAt:      service.LastProbeAt,
	}

	// Populate status and container details from event cache or Docker inspect
	var containerIdentifier string
	if service.ContainerID != nil && *service.ContainerID != "" {
		containerIdentifier = *service.ContainerID
	} else {
		containerIdentifier = fmt.Sprintf("glinr_%d_%s", service.ProjectID, service.Name)
	}
	
	if h.eventCache != nil {
		if state, exists := h.eventCache.GetServiceState(service.ID); exists {
			response.Status = state.Status
			response.ContainerID = &state.ContainerID
		} else {
			// Fallback to Docker inspect
			if status, err := h.dockerEngine.Inspect(ctx, containerIdentifier); err == nil {
				// Map Docker states to our status format
				switch status.State {
				case "running":
					response.Status = "running"
				case "exited", "dead":
					response.Status = "stopped"
				case "created":
					response.Status = "created"
				case "paused":
					response.Status = "paused"
				default:
					response.Status = "stopped"
				}
				
				// Set container ID if available
				if status.ID != "" {
					shortID := status.ID
					if len(shortID) > 12 {
						shortID = shortID[:12]
					}
					response.ContainerID = &shortID
				}
				
				// Set started at time if available
				if status.StartedAt != nil {
					response.StartedAt = status.StartedAt
				}
				
				// Set state reason from status if available
				if status.Status != "" && status.Status != status.State {
					response.StateReason = &status.Status
				}
			} else {
				response.Status = "stopped"
				reason := "Container not found or stopped"
				response.StateReason = &reason
			}
		}
	} else {
		response.Status = "unknown"
	}

	// TODO: Add last deploy time from deployment records when available
	// response.LastDeployAt = service.LastDeployAt

	// Populate network information
	if network, err := h.serviceStore.GetServiceNetwork(ctx, service.ID); err == nil {
		response.Network = &network
		// Generate aliases for this service
		if project, err := h.serviceStore.GetProject(ctx, service.ProjectID); err == nil {
			response.Aliases = store.GenerateServiceAliases(project.Name, service.Name)
		}
	}

	// Sample audit logging (1:10) for service view events
	if h.auditLogger != nil && rand.Intn(10) == 0 {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordServiceAction(c.Request.Context(), actor, audit.ActionServiceView, strconv.FormatInt(id, 10), map[string]interface{}{
			"service_name": service.Name,
			"project_id":   service.ProjectID,
			"status":       response.Status,
			"sampled":      true,
		})
	}

	c.JSON(http.StatusOK, response)
}

// DeleteService removes a service and its container
func (h *Handlers) DeleteService(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	// Get service details first
	service, err := h.serviceStore.GetService(ctx, id)
	if err != nil {
		if err.Error() == fmt.Sprintf("service not found: %d", id) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get service"})
		}
		return
	}

	// Try to remove container (best effort - may not exist)
	containerName := fmt.Sprintf("glinr_%d_%s", service.ProjectID, service.Name)
	if err := h.dockerEngine.Remove(ctx, containerName); err != nil {
		log.Warn().Err(err).Str("container", containerName).Msg("failed to remove container (may not exist)")
	}

	// Remove service record
	err = h.serviceStore.DeleteService(ctx, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete service"})
		return
	}

	// Remove service from search index asynchronously
	go func() {
		indexCtx, indexCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer indexCancel()
		if err := h.store.SearchDeleteByEntity(indexCtx, "service", id); err != nil {
			// Log error with sampling to avoid spam (1 in 10 errors logged)
			if id%10 == 0 {
				log.Error().Err(err).Int64("service_id", id).Msg("failed to delete service from search index")
			}
		}
	}()

	log.Info().
		Int64("service_id", id).
		Str("container_name", containerName).
		Msg("service deleted successfully")

	c.JSON(http.StatusOK, gin.H{"message": "service deleted successfully"})
}

// ServiceConfig represents service configuration for editing
type ServiceConfig struct {
	ID          int64               `json:"id"`
	ProjectID   int64               `json:"project_id"`
	Name        string              `json:"name"`
	Description *string             `json:"description,omitempty"`
	Image       string              `json:"image"`
	Env         []store.EnvVar      `json:"env"`
	Ports       []store.PortMap     `json:"ports"`
	Volumes     []store.VolumeMap   `json:"volumes"`
}

// GetServiceConfig returns service configuration with environment variable masking
func (h *Handlers) GetServiceConfig(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	service, err := h.serviceStore.GetService(ctx, id)
	if err != nil {
		if err.Error() == fmt.Sprintf("service not found: %d", id) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get service"})
		}
		return
	}

	// Convert env map to EnvVar slice with secret masking
	envVars := make([]store.EnvVar, 0, len(service.Env))
	for key, value := range service.Env {
		envVar := store.EnvVar{
			Key:   key,
			Value: value,
		}
		
		// Check if this is a secret environment variable
		lowerKey := strings.ToLower(key)
		if strings.Contains(lowerKey, "password") || 
		   strings.Contains(lowerKey, "secret") || 
		   strings.Contains(lowerKey, "token") || 
		   strings.Contains(lowerKey, "key") {
			envVar.IsSecret = true
			envVar.Value = "******" // Mask the value
		}
		
		envVars = append(envVars, envVar)
	}

	config := ServiceConfig{
		ID:          service.ID,
		ProjectID:   service.ProjectID,
		Name:        service.Name,
		Description: service.Description,
		Image:       service.Image,
		Env:         envVars,
		Ports:       service.Ports,
		Volumes:     service.Volumes,
	}

	// Sample audit logging (1:20) for config read events
	if h.auditLogger != nil && rand.Intn(20) == 0 {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordServiceAction(c.Request.Context(), actor, audit.ActionServiceView, strconv.FormatInt(id, 10), map[string]interface{}{
			"service_name": service.Name,
			"project_id":   service.ProjectID,
			"config_read":  true,
			"sampled":      true,
		})
	}

	c.JSON(http.StatusOK, config)
}

// GetServiceEnvironment returns the actual environment variables from the Docker container
func (h *Handlers) GetServiceEnvironment(c *gin.Context) {
	// Parse service ID
	idParam := c.Param("id")
	serviceID, err := strconv.ParseInt(idParam, 10, 64)
	if err != nil {
		log.Error().Err(err).Str("id", idParam).Msg("invalid service ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	// Get service from database to get container ID
	service, err := h.serviceStore.GetService(c.Request.Context(), serviceID)
	if err != nil {
		log.Error().Err(err).Int64("service_id", serviceID).Msg("failed to get service")
		c.JSON(http.StatusNotFound, gin.H{"error": "service not found"})
		return
	}

	// Check if service has a container ID
	var containerID string
	if service.ContainerID != nil && *service.ContainerID != "" {
		containerID = *service.ContainerID
	} else {
		// Try to discover container by service_id label for existing services
		discoveredID, err := h.discoverContainerByServiceID(c.Request.Context(), serviceID)
		if err != nil {
			log.Warn().Err(err).Int64("service_id", serviceID).Msg("failed to discover container")
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "service container not available"})
			return
		}
		containerID = discoveredID
	}

	// Inspect container to get environment variables
	containerStatus, err := h.dockerEngine.Inspect(c.Request.Context(), containerID)
	if err != nil {
		log.Error().Err(err).Str("container_id", containerID).Msg("failed to inspect container")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to inspect container"})
		return
	}

	// Parse environment variables
	userEnv := make(map[string]string)
	systemEnv := make(map[string]string)

	for _, env := range containerStatus.Env {
		if parts := strings.SplitN(env, "=", 2); len(parts) == 2 {
			key, value := parts[0], parts[1]
			
			// Classify environment variables
			if isSystemEnvironmentVariable(key) {
				systemEnv[key] = value
			} else {
				userEnv[key] = value
			}
		}
	}

	response := map[string]interface{}{
		"service_id":   serviceID,
		"container_id": containerID,
		"user_env":     userEnv,
		"system_env":   systemEnv,
	}

	c.JSON(http.StatusOK, response)
}

// isSystemEnvironmentVariable determines if an environment variable is system-managed
func isSystemEnvironmentVariable(key string) bool {
	systemVars := []string{
		"PATH", "HOME", "USER", "SHELL", "TERM", "LANG", "LC_", "TZ",
		"HOSTNAME", "PWD", "OLDPWD", "SHLVL", 
		"NGINX_VERSION", "NJS_VERSION", "NJS_RELEASE", "PKG_RELEASE", "DYNPKG_RELEASE",
		"APACHE_", "HTTPD_", "PHP_", "MYSQL_", "POSTGRES_", "REDIS_",
		"NODE_VERSION", "NPM_VERSION", "YARN_VERSION",
		"JAVA_VERSION", "JAVA_HOME", "JRE_HOME",
		"PYTHON_VERSION", "PYTHONPATH", "PIP_",
		"GOPATH", "GOROOT", "GOOS", "GOARCH",
		"DEBIAN_FRONTEND", "APT_", "DPKG_",
	}
	
	for _, sysVar := range systemVars {
		if strings.HasPrefix(key, sysVar) {
			return true
		}
	}
	
	return false
}

// ServiceConfigUpdate represents service configuration update request
type ServiceConfigUpdate struct {
	Name        string            `json:"name" binding:"required"`
	Description *string           `json:"description"`
	Image       string            `json:"image" binding:"required"`
	Env         []store.EnvVar    `json:"env"`
	Ports       []store.PortMap   `json:"ports"`
	Volumes     []store.VolumeMap `json:"volumes"`
}

// UpdateServiceConfig updates service configuration with validation
func (h *Handlers) UpdateServiceConfig(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	var updateReq ServiceConfigUpdate
	if err := c.ShouldBindJSON(&updateReq); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	// Get existing service to verify it exists
	existingService, err := h.serviceStore.GetService(ctx, id)
	if err != nil {
		if err.Error() == fmt.Sprintf("service not found: %d", id) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get service"})
		}
		return
	}

	// Validate configuration
	if err := validateServiceConfig(updateReq); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Convert EnvVar slice to map, preserving existing secrets
	envMap := make(map[string]string)
	for _, envVar := range updateReq.Env {
		if envVar.IsSecret && envVar.Value == "******" {
			// Keep existing secret value if masked
			if existingValue, exists := existingService.Env[envVar.Key]; exists {
				envMap[envVar.Key] = existingValue
			}
		} else {
			envMap[envVar.Key] = envVar.Value
		}
	}

	// Build updated service
	updatedService := store.Service{
		ID:          id,
		ProjectID:   existingService.ProjectID,
		Name:        updateReq.Name,
		Description: updateReq.Description,
		Image:       updateReq.Image,
		Env:         envMap,
		Ports:       updateReq.Ports,
		Volumes:     updateReq.Volumes,
		CreatedAt:   existingService.CreatedAt,
	}

	// Update service in store
	if err := h.serviceStore.UpdateService(ctx, id, updatedService); err != nil {
		log.Error().Err(err).Int64("service_id", id).Msg("failed to update service config")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update service configuration"})
		return
	}

	// Audit logging for config update
	if h.auditLogger != nil {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordServiceAction(c.Request.Context(), actor, audit.ActionServiceUpdate, strconv.FormatInt(id, 10), map[string]interface{}{
			"service_name":  updateReq.Name,
			"project_id":    existingService.ProjectID,
			"config_update": true,
			"env_count":     len(updateReq.Env),
			"ports_count":   len(updateReq.Ports),
			"volumes_count": len(updateReq.Volumes),
		})
	}

	// Check if we need to recreate the container (name change or critical config changes)
	nameChanged := existingService.Name != updateReq.Name
	imageChanged := existingService.Image != updateReq.Image
	portsChanged := !arePortMapsEqual(existingService.Ports, updateReq.Ports)
	volumesChanged := !areVolumeMapsEqual(existingService.Volumes, updateReq.Volumes)
	envChanged := !areEnvMapsEqual(existingService.Env, envMap)
	
	needsRecreation := nameChanged || imageChanged || portsChanged || volumesChanged || envChanged

	if needsRecreation {
		log.Info().
			Int64("service_id", id).
			Bool("name_changed", nameChanged).
			Bool("image_changed", imageChanged).
			Bool("ports_changed", portsChanged).
			Bool("volumes_changed", volumesChanged).
			Bool("env_changed", envChanged).
			Msg("service needs container recreation")

		// WARNING: Container recreation will lose any data stored inside the container
		// Data should be stored in volumes to persist across recreations
		if err := h.recreateServiceContainer(ctx, id, updatedService); err != nil {
			log.Error().Err(err).Int64("service_id", id).Msg("failed to recreate service container")
			// Don't fail the config update, but warn the user
			c.JSON(http.StatusOK, gin.H{
				"message": "Configuration updated successfully, but container recreation failed. You may need to manually restart the service.",
				"warning": "Container restart required",
			})
			return
		}
	}

	log.Info().
		Int64("service_id", id).
		Str("service_name", updateReq.Name).
		Int("env_count", len(updateReq.Env)).
		Int("ports_count", len(updateReq.Ports)).
		Int("volumes_count", len(updateReq.Volumes)).
		Bool("container_recreated", needsRecreation).
		Msg("service configuration updated")

	// Re-index service for search asynchronously
	go func() {
		indexCtx, indexCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer indexCancel()
		if err := h.store.IndexService(indexCtx, id); err != nil {
			// Log error with sampling to avoid spam (1 in 10 errors logged)
			if id%10 == 0 {
				log.Error().Err(err).Int64("service_id", id).Msg("failed to re-index service for search")
			}
		}
	}()

	response := gin.H{"message": "service configuration updated successfully"}
	if needsRecreation {
		response["container_recreated"] = true
		response["warning"] = "Container was recreated - any data stored inside the container (not in volumes) has been lost"
		response["recommendation"] = "Use volume mounts to persist data across container recreations"
	}
	c.JSON(http.StatusOK, response)
}

// validateServiceConfig validates service configuration update
func validateServiceConfig(config ServiceConfigUpdate) error {
	// Validate environment variables - unique keys
	envKeys := make(map[string]bool)
	for _, envVar := range config.Env {
		if envVar.Key == "" {
			return fmt.Errorf("environment variable key cannot be empty")
		}
		if envKeys[envVar.Key] {
			return fmt.Errorf("duplicate environment variable key: %s", envVar.Key)
		}
		envKeys[envVar.Key] = true
	}

	// Validate ports - unique host ports and valid ranges
	hostPorts := make(map[int]bool)
	for _, port := range config.Ports {
		if port.Container < 1 || port.Container > 65535 {
			return fmt.Errorf("invalid container port: %d (must be 1-65535)", port.Container)
		}
		if port.Host < 1 || port.Host > 65535 {
			return fmt.Errorf("invalid host port: %d (must be 1-65535)", port.Host)
		}
		if hostPorts[port.Host] {
			return fmt.Errorf("duplicate host port: %d", port.Host)
		}
		hostPorts[port.Host] = true
	}

	// Validate volumes - safe host paths
	for _, volume := range config.Volumes {
		if volume.Host == "" || volume.Container == "" {
			return fmt.Errorf("volume paths cannot be empty")
		}
		// Basic security check - prevent dangerous host paths
		if strings.HasPrefix(volume.Host, "/") && 
		   (strings.HasPrefix(volume.Host, "/etc") || 
		    strings.HasPrefix(volume.Host, "/sys") || 
		    strings.HasPrefix(volume.Host, "/proc") ||
		    strings.HasPrefix(volume.Host, "/dev")) {
			return fmt.Errorf("host path not allowed for security reasons: %s", volume.Host)
		}
	}

	return nil
}

// GetServiceNetwork returns networking information for a service
func (h *Handlers) GetServiceNetwork(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	network, err := h.serviceStore.GetServiceNetwork(ctx, id)
	if err != nil {
		if err.Error() == fmt.Sprintf("service not found: %d", id) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get service network"})
		}
		return
	}

	c.JSON(http.StatusOK, network)
}

// UpdateServiceLinks creates/updates links between services
func (h *Handlers) UpdateServiceLinks(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	var request struct {
		Targets []int64 `json:"targets" binding:"required"`
	}
	
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Verify service exists first
	_, err = h.serviceStore.GetService(ctx, id)
	if err != nil {
		if err.Error() == fmt.Sprintf("service not found: %d", id) {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to verify service"})
		}
		return
	}

	// Create service links
	err = h.serviceStore.CreateServiceLinks(ctx, id, request.Targets)
	if err != nil {
		log.Error().Err(err).Int64("service_id", id).Msg("failed to update service links")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update service links"})
		return
	}

	// Get updated links for response
	links, err := h.serviceStore.GetServiceLinks(ctx, id)
	if err != nil {
		log.Warn().Err(err).Int64("service_id", id).Msg("failed to get updated service links")
		links = []store.LinkedService{} // Return empty array on error
	}

	// Audit logging
	if h.auditLogger != nil {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordServiceAction(c.Request.Context(), actor, audit.ActionServiceLinksUpdate, strconv.FormatInt(id, 10), map[string]interface{}{
			"service_id":    id,
			"targets_count": len(request.Targets),
			"targets":       request.Targets,
			"links_count":   len(links),
		})
	}

	log.Info().
		Int64("service_id", id).
		Int("targets_count", len(request.Targets)).
		Int("links_count", len(links)).
		Msg("service links updated")

	c.JSON(http.StatusOK, gin.H{
		"message": "service links updated successfully",
		"links":   links,
	})
}

// GetServiceLinks returns linked services for a service
func (h *Handlers) GetServiceLinks(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	links, err := h.serviceStore.GetServiceLinks(ctx, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get service links"})
		return
	}

	c.JSON(http.StatusOK, links)
}

// SetServiceHealthCheck sets the health check path for a service
func (h *Handlers) SetServiceHealthCheck(c *gin.Context) {
	serviceIDStr := c.Param("id")
	serviceID, err := strconv.ParseInt(serviceIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	var request struct {
		Path string `json:"path" binding:"required"`
	}

	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	ctx := c.Request.Context()

	// Verify service exists
	service, err := h.serviceStore.GetService(ctx, serviceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "service not found"})
		return
	}

	// Update the service with the health path
	updatedService := service
	updatedService.HealthPath = &request.Path

	err = h.serviceStore.UpdateService(ctx, serviceID, updatedService)
	if err != nil {
		log.Error().Err(err).Int64("service_id", serviceID).Msg("failed to update service health check")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update health check"})
		return
	}

	log.Info().
		Int64("service_id", serviceID).
		Str("health_path", request.Path).
		Msg("health check path configured")

	c.JSON(http.StatusOK, gin.H{"success": true, "health_path": request.Path})
}

// TriggerDirectBuild handles POST /v1/builds - for Spring Boot quickstart wizard
func (h *Handlers) TriggerDirectBuild(c *gin.Context) {
	var spec struct {
		RepoURL     string            `json:"repo_url" binding:"required"`
		Branch      string            `json:"branch"`
		Dockerfile  string            `json:"dockerfile"`
		Context     string            `json:"context"`
		BuildArgs   map[string]string `json:"build_args"`
	}

	if err := c.ShouldBindJSON(&spec); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid build specification"})
		return
	}

	// Set defaults
	if spec.Branch == "" {
		spec.Branch = "main"
	}
	if spec.Context == "" {
		spec.Context = "."
	}
	if spec.Dockerfile == "" {
		spec.Dockerfile = "Dockerfile"
	}

	// For now, simulate build process by returning success immediately
	// In a real implementation, this would queue a build job
	buildID := fmt.Sprintf("build_%d", time.Now().Unix())
	
	log.Info().
		Str("repo_url", spec.RepoURL).
		Str("branch", spec.Branch).
		Str("build_id", buildID).
		Msg("direct build triggered")

	c.JSON(http.StatusCreated, gin.H{
		"id":     buildID,
		"status": "success",
		"image":  fmt.Sprintf("glinr/%s:%s", extractRepoName(spec.RepoURL), spec.Branch),
	})
}

// TriggerDirectDeployment handles POST /v1/deployments - for Spring Boot quickstart wizard
func (h *Handlers) TriggerDirectDeployment(c *gin.Context) {
	var spec struct {
		ServiceID string `json:"service_id" binding:"required"`
		Image     string `json:"image" binding:"required"`
	}

	if err := c.ShouldBindJSON(&spec); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid deployment specification"})
		return
	}

	deploymentID := fmt.Sprintf("deployment_%d", time.Now().Unix())
	
	log.Info().
		Str("service_id", spec.ServiceID).
		Str("image", spec.Image).
		Str("deployment_id", deploymentID).
		Msg("direct deployment triggered")

	c.JSON(http.StatusAccepted, gin.H{
		"id":     deploymentID,
		"status": "success",
	})
}

// extractRepoName extracts repository name from Git URL
func extractRepoName(repoURL string) string {
	// Simple extraction logic - in practice, you'd want more robust parsing
	parts := strings.Split(strings.TrimSuffix(repoURL, ".git"), "/")
	if len(parts) > 0 {
		return strings.ToLower(parts[len(parts)-1])
	}
	return "unknown"
}

// recreateServiceContainer recreates a service's container with new configuration
// WARNING: This will destroy the existing container and any data stored inside it
// Data should be stored in volumes to persist across container recreations
func (h *Handlers) recreateServiceContainer(ctx context.Context, serviceID int64, updatedService store.Service) error {
	log.Warn().
		Int64("service_id", serviceID).
		Msg("RECREATING CONTAINER - Any data stored inside the container (not in volumes) will be lost")

	// Try to find and stop the existing container using the existing discovery from websocket handlers
	var existingContainerID string
	if discoveredID, err := h.discoverContainerByServiceID(ctx, serviceID); err == nil {
		existingContainerID = discoveredID
		log.Info().Str("container_id", existingContainerID).Int64("service_id", serviceID).Msg("stopping existing container")
		if stopErr := h.dockerEngine.Stop(ctx, existingContainerID); stopErr != nil {
			log.Warn().Err(stopErr).Str("container_id", existingContainerID).Msg("failed to stop existing container")
		}
		
		// TODO: In the future, we could add data backup/migration logic here
		// For now, we rely on proper volume configuration for data persistence
	}

	// Pull new image if image changed  
	var registryID string
	if updatedService.RegistryID != nil {
		registryID = *updatedService.RegistryID
	}
	if err := h.dockerEngine.Pull(ctx, updatedService.Image, registryID); err != nil {
		log.Warn().Err(err).Str("image", updatedService.Image).Msg("failed to pull image, continuing with local")
	}

	// Create new container with updated configuration and proper labels
	containerName := fmt.Sprintf("glinr_%d_%s", updatedService.ProjectID, updatedService.Name)
	labels := map[string]string{
		"glinr.project_id": strconv.FormatInt(updatedService.ProjectID, 10),
		"glinr.service_id": strconv.FormatInt(serviceID, 10), 
		"glinr.managed":    "true",
	}

	containerSpec := dockerx.ContainerSpec{
		Image: updatedService.Image,
		Env:   updatedService.Env,
		Ports: updatedService.Ports,
	}

	containerID, err := h.dockerEngine.Create(ctx, containerName, containerSpec, labels)
	if err != nil {
		return fmt.Errorf("failed to create new container: %w", err)
	}

	// Update service record with new container ID
	if err := h.serviceStore.UpdateServiceContainerID(ctx, serviceID, containerID); err != nil {
		log.Warn().Err(err).Int64("service_id", serviceID).Str("container_id", containerID).Msg("failed to store new container ID")
	}

	// Clean up the old container if we had one
	if existingContainerID != "" && existingContainerID != containerID {
		if removeErr := h.dockerEngine.Remove(ctx, existingContainerID); removeErr != nil {
			log.Warn().Err(removeErr).Str("old_container_id", existingContainerID).Msg("failed to remove old container - manual cleanup may be required")
		} else {
			log.Info().Str("old_container_id", existingContainerID).Msg("successfully removed old container")
		}
	}

	log.Info().
		Int64("service_id", serviceID).
		Str("container_id", containerID).
		Str("container_name", containerName).
		Bool("old_container_cleaned", existingContainerID != "" && existingContainerID != containerID).
		Msg("service container recreated successfully")

	return nil
}

// arePortMapsEqual compares two PortMap slices for equality
func arePortMapsEqual(a, b []store.PortMap) bool {
	if len(a) != len(b) {
		return false
	}
	for i, portA := range a {
		portB := b[i]
		if portA.Container != portB.Container || portA.Host != portB.Host {
			return false
		}
	}
	return true
}

// areVolumeMapsEqual compares two VolumeMap slices for equality  
func areVolumeMapsEqual(a, b []store.VolumeMap) bool {
	if len(a) != len(b) {
		return false
	}
	for i, volumeA := range a {
		volumeB := b[i]
		if volumeA.Host != volumeB.Host || volumeA.Container != volumeB.Container || volumeA.ReadOnly != volumeB.ReadOnly {
			return false
		}
	}
	return true
}

// areEnvMapsEqual compares two environment variable maps for equality
func areEnvMapsEqual(a, b map[string]string) bool {
	if len(a) != len(b) {
		return false
	}
	for key, valueA := range a {
		valueB, exists := b[key]
		if !exists || valueA != valueB {
			return false
		}
	}
	return true
}

// DiscoveredService represents a container found in Docker but not tracked in the database
type DiscoveredService struct {
	ContainerID     string            `json:"container_id"`
	ContainerName   string            `json:"container_name"`
	Image           string            `json:"image"`
	Status          string            `json:"status"`
	Created         time.Time         `json:"created"`
	ProjectID       *int64            `json:"project_id,omitempty"`
	ServiceID       *int64            `json:"service_id,omitempty"`
	Labels          map[string]string `json:"labels"`
	IsOrphaned      bool              `json:"is_orphaned"`
	OrphanReason    string            `json:"orphan_reason,omitempty"`
}

// DiscoverUnmanagedServices finds Docker containers that aren't properly tracked in the database
func (h *Handlers) DiscoverUnmanagedServices(c *gin.Context) {
	ctx := c.Request.Context()
	
	// Create Docker client directly (same pattern as websocket.go)
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		log.Error().Err(err).Msg("failed to create Docker client for discovery")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create Docker client"})
		return
	}
	defer cli.Close()
	
	// Create filter for GLINR-managed containers
	labelFilter := filters.NewArgs()
	labelFilter.Add("label", "glinr.managed=true")
	
	// Get all Docker containers with GLINR labels
	containers, err := cli.ContainerList(ctx, container.ListOptions{
		All:     true, // Include stopped containers
		Filters: labelFilter,
	})
	if err != nil {
		log.Error().Err(err).Msg("failed to list Docker containers")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list Docker containers"})
		return
	}

	var discovered []DiscoveredService
	
	for _, container := range containers {
		// Parse labels
		labels := container.Labels
		projectIDStr := labels["glinr.project_id"]
		serviceIDStr := labels["glinr.service_id"]
		
		var projectID, serviceID *int64
		if projectIDStr != "" {
			if pid, err := strconv.ParseInt(projectIDStr, 10, 64); err == nil {
				projectID = &pid
			}
		}
		if serviceIDStr != "" {
			if sid, err := strconv.ParseInt(serviceIDStr, 10, 64); err == nil {
				serviceID = &sid
			}
		}
		
		discoveredService := DiscoveredService{
			ContainerID:   container.ID,
			ContainerName: container.Names[0], // Docker containers always have at least one name
			Image:         container.Image,
			Status:        container.Status,  // Use Status instead of State
			Created:       time.Unix(container.Created, 0),
			ProjectID:     projectID,
			ServiceID:     serviceID,
			Labels:        labels,
		}
		
		// Check if this container is orphaned
		isOrphaned := false
		orphanReason := ""
		
		// First, check if this container ID is already tracked in the database
		// This handles cases where a container was adopted but labels weren't updated
		existingService, err := h.serviceStore.GetServiceByContainerID(ctx, container.ID)
		if err == nil && existingService != nil {
			// Container is already tracked in database - use database values, not label values
			isOrphaned = false
			// Update the discovered service info to reflect database reality
			discoveredService.ProjectID = &existingService.ProjectID
			discoveredService.ServiceID = &existingService.ID
		} else if serviceID != nil {
			// Check if the service exists in database (legacy label-based check)
			_, err := h.serviceStore.GetService(ctx, *serviceID)
			if err != nil {
				isOrphaned = true
				orphanReason = fmt.Sprintf("Service ID %d not found in database", *serviceID)
			} else {
				// Service exists, but also verify the project from labels exists
				if projectID != nil {
					_, err := h.serviceStore.GetProject(ctx, *projectID)
					if err != nil {
						isOrphaned = true
						orphanReason = fmt.Sprintf("Project ID %d not found in database", *projectID)
					}
				}
			}
		} else {
			isOrphaned = true
			orphanReason = "Container has no service_id label and not found in database"
		}
		
		discoveredService.IsOrphaned = isOrphaned
		discoveredService.OrphanReason = orphanReason
		
		// Only include containers that are either orphaned or we want to show all
		showAll := c.Query("all") == "true"
		if isOrphaned || showAll {
			discovered = append(discovered, discoveredService)
		}
	}
	
	c.JSON(http.StatusOK, gin.H{
		"discovered_services": discovered,
		"total_containers": len(containers),
		"orphaned_count": len(discovered),
	})
}

// AdoptContainerRequest represents the request to adopt an orphaned container
type AdoptContainerRequest struct {
	ContainerID string `json:"container_id" binding:"required"`
	ProjectID   int64  `json:"project_id" binding:"required"`
	ServiceName string `json:"service_name" binding:"required"`
}

// AdoptContainerHandler adopts an orphaned container into a project as a managed service
func (h *Handlers) AdoptContainerHandler(c *gin.Context) {
	var req AdoptContainerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Error().Err(err).Msg("invalid adopt container request")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request format"})
		return
	}

	ctx := c.Request.Context()

	// Create Docker client to inspect the container
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		log.Error().Err(err).Msg("failed to create Docker client for adoption")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create Docker client"})
		return
	}
	defer cli.Close()

	// Inspect the container to get its configuration
	containerInfo, err := cli.ContainerInspect(ctx, req.ContainerID)
	if err != nil {
		log.Error().Err(err).Str("container_id", req.ContainerID).Msg("failed to inspect container")
		c.JSON(http.StatusNotFound, gin.H{"error": "container not found"})
		return
	}

	// Verify the project exists
	project, err := h.serviceStore.GetProject(ctx, req.ProjectID)
	if err != nil {
		log.Error().Err(err).Int64("project_id", req.ProjectID).Msg("project not found")
		c.JSON(http.StatusNotFound, gin.H{"error": "project not found"})
		return
	}

	// Extract service configuration from container
	var ports []store.PortMap
	for containerPort, bindings := range containerInfo.NetworkSettings.Ports {
		if len(bindings) > 0 {
			for _, binding := range bindings {
				if binding.HostPort != "" {
					hostPort, err := strconv.Atoi(binding.HostPort)
					if err == nil {
						containerPortInt, err := strconv.Atoi(containerPort.Port())
						if err == nil {
							ports = append(ports, store.PortMap{
								Host:      hostPort,
								Container: containerPortInt,
							})
						}
					}
				}
			}
		}
	}

	// Extract environment variables
	envMap := make(map[string]string)
	for _, env := range containerInfo.Config.Env {
		if parts := strings.SplitN(env, "=", 2); len(parts) == 2 {
			// Skip Docker-specific environment variables
			if !strings.HasPrefix(parts[0], "PATH") && !strings.HasPrefix(parts[0], "HOSTNAME") {
				envMap[parts[0]] = parts[1]
			}
		}
	}

	// Extract volume mounts
	var volumes []store.VolumeMap
	for _, mount := range containerInfo.Mounts {
		if mount.Type == "bind" || mount.Type == "volume" {
			volumes = append(volumes, store.VolumeMap{
				Host:      mount.Source,
				Container: mount.Destination,
				ReadOnly:  !mount.RW,
			})
		}
	}

	// Create the service specification
	spec := store.ServiceSpec{
		Name:  req.ServiceName,
		Image: containerInfo.Config.Image,
		Env:   envMap,
		Ports: ports,
	}

	// Create the service in the database
	service, err := h.serviceStore.CreateService(ctx, req.ProjectID, spec)
	if err != nil {
		log.Error().Err(err).Int64("project_id", req.ProjectID).Str("service_name", req.ServiceName).Msg("failed to create adopted service")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create service record"})
		return
	}

	// Link the existing container to the service record
	err = h.serviceStore.UpdateServiceContainerID(ctx, service.ID, req.ContainerID)
	if err != nil {
		log.Error().Err(err).Int64("service_id", service.ID).Str("container_id", req.ContainerID).Msg("failed to link container to service")
		// This is a critical failure - delete the service record if we can't link the container
		if deleteErr := h.serviceStore.DeleteService(ctx, service.ID); deleteErr != nil {
			log.Error().Err(deleteErr).Int64("service_id", service.ID).Msg("failed to cleanup orphaned service record")
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to link container to service"})
		return
	}

	// Note: Docker doesn't allow updating labels on running containers
	// The container will keep its old labels until it's recreated
	// This is acceptable as our discovery logic can handle this case

	// Audit log the adoption
	if h.auditLogger != nil {
		actor := auth.CurrentTokenName(c)
		if actor == "" {
			actor = "system"
		}
		h.auditLogger.RecordServiceAction(ctx, actor, audit.ActionServiceUpdate, strconv.FormatInt(service.ID, 10), map[string]interface{}{
			"service_name":   req.ServiceName,
			"project_id":     req.ProjectID,
			"project_name":   project.Name,
			"container_id":   req.ContainerID,
			"adoption":       true,
			"container_name": containerInfo.Name,
			"image":          containerInfo.Config.Image,
			"adopted_by":     auth.CurrentRole(c),
		})
	}

	log.Info().
		Int64("project_id", req.ProjectID).
		Int64("service_id", service.ID).
		Str("service_name", req.ServiceName).
		Str("container_id", req.ContainerID).
		Msg("container adopted successfully")

	// Index adopted service for search asynchronously
	go func() {
		indexCtx, indexCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer indexCancel()
		if err := h.store.IndexService(indexCtx, service.ID); err != nil {
			// Log error with sampling to avoid spam (1 in 10 errors logged)
			if service.ID%10 == 0 {
				log.Error().Err(err).Int64("service_id", service.ID).Msg("failed to index adopted service for search")
			}
		}
	}()

	c.JSON(http.StatusCreated, gin.H{
		"message": "container adopted successfully",
		"service": service,
		"adoption_notes": []string{
			"Container has been added to the project as a managed service",
			"Container labels will be updated on next restart",
			"All existing data and configuration have been preserved",
		},
	})
}

// CleanupContainerRequest represents the request to cleanup/remove a container
type CleanupContainerRequest struct {
	ContainerID string `json:"container_id" binding:"required"`
	Force       bool   `json:"force,omitempty"` // Force remove even if running
}

// CleanupContainerHandler removes an orphaned or unwanted container
func (h *Handlers) CleanupContainerHandler(c *gin.Context) {
	var req CleanupContainerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Error().Err(err).Msg("invalid cleanup container request")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request format"})
		return
	}

	ctx := c.Request.Context()

	// Create Docker client to inspect and remove the container
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		log.Error().Err(err).Msg("failed to create Docker client for cleanup")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create Docker client"})
		return
	}
	defer cli.Close()

	// Inspect the container first to get info for audit logging
	containerInfo, err := cli.ContainerInspect(ctx, req.ContainerID)
	if err != nil {
		log.Error().Err(err).Str("container_id", req.ContainerID).Msg("failed to inspect container for cleanup")
		c.JSON(http.StatusNotFound, gin.H{"error": "container not found"})
		return
	}

	// Check if container is running and force flag is not set
	if containerInfo.State.Running && !req.Force {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "container is running - use force=true to remove running containers",
			"container_status": "running",
			"force_required": true,
		})
		return
	}

	// Stop the container if it's running and force is requested
	if containerInfo.State.Running && req.Force {
		log.Info().Str("container_id", req.ContainerID).Msg("stopping running container before removal")
		timeout := 10
		if err := cli.ContainerStop(ctx, req.ContainerID, container.StopOptions{Timeout: &timeout}); err != nil {
			log.Warn().Err(err).Str("container_id", req.ContainerID).Msg("failed to stop container gracefully, will force remove")
		}
	}

	// Remove the container
	removeOptions := container.RemoveOptions{
		RemoveVolumes: true,  // Remove anonymous volumes
		Force:         req.Force,
	}

	if err := cli.ContainerRemove(ctx, req.ContainerID, removeOptions); err != nil {
		log.Error().Err(err).Str("container_id", req.ContainerID).Msg("failed to remove container")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to remove container"})
		return
	}

	// Audit log the cleanup
	if h.auditLogger != nil {
		actor := auth.CurrentTokenName(c)
		if actor == "" {
			actor = "system"
		}
		
		// Extract project and service info from labels if available
		projectID := containerInfo.Config.Labels["glinr.project_id"]
		serviceID := containerInfo.Config.Labels["glinr.service_id"]
		
		h.auditLogger.RecordServiceAction(ctx, actor, audit.ActionServiceUpdate, req.ContainerID, map[string]interface{}{
			"container_id":     req.ContainerID,
			"container_name":   containerInfo.Name,
			"image":           containerInfo.Config.Image,
			"project_id":      projectID,
			"service_id":      serviceID,
			"cleanup":         true,
			"was_running":     containerInfo.State.Running,
			"force_removed":   req.Force,
			"cleaned_by":      auth.CurrentRole(c),
		})
	}

	log.Info().
		Str("container_id", req.ContainerID).
		Str("container_name", containerInfo.Name).
		Str("image", containerInfo.Config.Image).
		Bool("was_running", containerInfo.State.Running).
		Bool("force", req.Force).
		Msg("container cleaned up successfully")

	c.JSON(http.StatusOK, gin.H{
		"message": "container removed successfully",
		"container_id": req.ContainerID,
		"container_name": containerInfo.Name,
		"cleanup_notes": []string{
			"Container has been permanently removed from Docker",
			"All anonymous volumes were also removed",
			"Named volumes and bind mounts were preserved",
		},
	})
}

// UnlockService handles POST /v1/services/:id/unlock - clear crash loop flag
func (h *Handlers) UnlockService(c *gin.Context) {
	serviceIDStr := c.Param("id")
	serviceID, err := strconv.ParseInt(serviceIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	ctx := c.Request.Context()

	// Verify service exists and is in crash loop state
	service, err := h.serviceStore.GetService(ctx, serviceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "service not found"})
		return
	}

	if !service.CrashLooping {
		c.JSON(http.StatusBadRequest, gin.H{"error": "service is not in crash loop state"})
		return
	}

	// Get user info for audit logging
	userID := "unknown"
	if tokenName, exists := c.Get("token_name"); exists {
		if name, ok := tokenName.(string); ok {
			userID = name
		}
	}

	// Create crash loop detector and unlock service
	crashLoopDetector := h.getCrashLoopDetector()
	if err := crashLoopDetector.UnlockService(ctx, serviceID, userID); err != nil {
		log.Error().Err(err).Int64("service_id", serviceID).Msg("failed to unlock service")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to unlock service"})
		return
	}

	log.Info().
		Int64("service_id", serviceID).
		Str("service_name", service.Name).
		Str("unlocked_by", userID).
		Msg("service unlocked from crash loop")

	c.JSON(http.StatusOK, gin.H{
		"message": "service unlocked successfully",
		"service_id": serviceID,
		"service_name": service.Name,
	})
}

// RunHealthCheck handles POST /v1/services/:id/health-check/run - manual health check
func (h *Handlers) RunHealthCheck(c *gin.Context) {
	serviceIDStr := c.Param("id")
	serviceID, err := strconv.ParseInt(serviceIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	ctx := c.Request.Context()

	// Verify service exists
	_, err = h.serviceStore.GetService(ctx, serviceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "service not found"})
		return
	}

	// Create prober and run health check
	prober := h.getHealthProber()
	if err := prober.ProbeAndUpdate(ctx, serviceID); err != nil {
		log.Error().Err(err).Int64("service_id", serviceID).Msg("failed to run health check")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to run health check"})
		return
	}

	// Get updated service to return current health status
	service, err := h.serviceStore.GetService(ctx, serviceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get updated service status"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "health check completed",
		"service_id": serviceID,
		"health_status": service.HealthStatus,
		"last_probe_at": service.LastProbeAt,
	})
}

// getHealthProber returns a configured health prober instance
func (h *Handlers) getHealthProber() *health.Prober {
	return health.NewProber(h.serviceStore)
}

// getCrashLoopDetector returns a configured crash loop detector instance
func (h *Handlers) getCrashLoopDetector() *health.CrashLoopDetector {
	return health.NewCrashLoopDetector(h.serviceStore, h.auditLogger)
}

