package api

import (
	"context"
	"net/http"
	"time"

	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// Registry API Handlers

// CreateRegistry creates a new container registry
func (h *Handlers) CreateRegistry(c *gin.Context) {
	var req store.RegistryCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Validate registry type
	if !store.IsValidRegistryType(req.Type) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid registry type. Must be one of: " +
				"ghcr, ecr, dockerhub, generic",
		})
		return
	}

	// Set default server if not provided for known types
	if req.Server == "" {
		defaultServer := store.GetDefaultServer(req.Type)
		if defaultServer == "" && (req.Type == "ecr" || req.Type == "generic") {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": "Server URL is required for this registry type",
			})
			return
		}
		req.Server = defaultServer
	}

	registry, err := h.registryStore.CreateRegistry(req)
	if err != nil {
		if isUniqueConstraintError(err) {
			c.JSON(http.StatusConflict, gin.H{"error": "Registry name already exists"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create registry"})
		return
	}

	// Log audit event
	actor := audit.GetActorFromContext(c.Request.Context())
	h.auditLogger.RecordRegistryAction(c.Request.Context(), actor, audit.ActionRegistryCreate, registry.ID, map[string]interface{}{
		"registry_name": registry.Name,
		"registry_type": registry.Type,
		"server":        registry.Server,
	})

	// Update search index in background to avoid blocking the operation
	go func() {
		if err := h.store.IndexRegistryByStringID(context.Background(), registry.ID); err != nil {
			log.Warn().Err(err).Str("registry_id", registry.ID).Msg("failed to update search index for registry")
		}
	}()

	// Return public info only (no secrets)
	c.JSON(http.StatusCreated, registry.ToPublic())
}

// ListRegistries returns all container registries
func (h *Handlers) ListRegistries(c *gin.Context) {
	registries, err := h.registryStore.ListRegistries()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve registries"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"registries": registries,
	})
}

// GetRegistry returns a single registry
func (h *Handlers) GetRegistry(c *gin.Context) {
	registryID := c.Param("id")
	if registryID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Registry ID is required"})
		return
	}

	registry, err := h.registryStore.GetRegistry(registryID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Registry not found"})
		return
	}

	c.JSON(http.StatusOK, registry)
}

// DeleteRegistry deletes a container registry
func (h *Handlers) DeleteRegistry(c *gin.Context) {
	registryID := c.Param("id")
	if registryID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Registry ID is required"})
		return
	}

	// Get registry info for audit log before deletion
	registry, err := h.registryStore.GetRegistry(registryID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Registry not found"})
		return
	}

	err = h.registryStore.DeleteRegistry(registryID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete registry"})
		return
	}

	// Log audit event
	actor := audit.GetActorFromContext(c.Request.Context())
	h.auditLogger.RecordRegistryAction(c.Request.Context(), actor, audit.ActionRegistryDelete, registryID, map[string]interface{}{
		"registry_name": registry.Name,
		"registry_type": registry.Type,
		"server":        registry.Server,
	})

	// Remove from search index in background
	go func() {
		indexCtx, indexCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer indexCancel()
		// Convert string ID to int64 using the same hash function as IndexRegistryByStringID
		entityID := int64(len(registryID))
		for _, b := range []byte(registryID) {
			entityID = entityID*31 + int64(b)
		}
		if err := h.store.SearchDeleteByEntity(indexCtx, "registry", entityID); err != nil {
			log.Warn().Err(err).Str("registry_id", registryID).Msg("failed to remove registry from search index")
		}
	}()

	c.JSON(http.StatusNoContent, nil)
}

// TestRegistryConnection tests registry credentials
func (h *Handlers) TestRegistryConnection(c *gin.Context) {
	registryID := c.Param("id")
	if registryID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Registry ID is required"})
		return
	}

	err := h.registryStore.TestRegistryConnection(registryID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Registry connection failed: " + err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "Registry connection test successful",
	})
}

// GetValidRegistryTypes returns the list of valid registry types
func (h *Handlers) GetValidRegistryTypes(c *gin.Context) {
	types := make([]map[string]string, len(store.ValidRegistryTypes))
	for i, regType := range store.ValidRegistryTypes {
		types[i] = map[string]string{
			"type":   regType,
			"server": store.GetDefaultServer(regType),
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"types": types,
	})
}

// Helper function to check for unique constraint errors
func isUniqueConstraintError(err error) bool {
	return err != nil && (
	// SQLite unique constraint error
	err.Error() == "UNIQUE constraint failed: registries.name" ||
		// Generic check for unique constraint
		contains(err.Error(), "UNIQUE constraint") ||
		contains(err.Error(), "duplicate"))
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && s[len(s)-len(substr):] == substr ||
		len(s) > len(substr) && findInString(s, substr)
}

func findInString(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
