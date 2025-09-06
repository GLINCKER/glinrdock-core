package api

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/GLINCKER/glinrdock/internal/crypto"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// EnvVarStore interface for environment variable operations
type EnvVarStore interface {
	SetEnvVar(ctx context.Context, serviceID int64, key, value string, isSecret bool, nonce, ciphertext []byte) error
	GetEnvVar(ctx context.Context, serviceID int64, key string) (store.EnvVar, error)
	ListEnvVars(ctx context.Context, serviceID int64) ([]store.EnvVar, error)
	DeleteEnvVar(ctx context.Context, serviceID int64, key string) error
	BulkSetEnvVars(ctx context.Context, serviceID int64, envVars []store.EnvVarUpdate) error
	BulkDeleteEnvVars(ctx context.Context, serviceID int64, keys []string) error
	GetService(ctx context.Context, id int64) (store.Service, error)
}

// EnvVarResponse represents the response for environment variables with masking
type EnvVarResponse struct {
	Key       string    `json:"key"`
	Value     string    `json:"value"`
	IsSecret  bool      `json:"is_secret"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// EnvVarRequest represents a request to create/update an environment variable
type EnvVarRequest struct {
	Key      string `json:"key" binding:"required"`
	Value    string `json:"value" binding:"required"`
	IsSecret bool   `json:"is_secret"`
}

// BulkEnvVarRequest represents a request to bulk update environment variables
type BulkEnvVarRequest struct {
	EnvVars []EnvVarRequest `json:"env_vars" binding:"required"`
}

// maskSecretValue returns masked value for secret environment variables based on user role
func maskSecretValue(envVar store.EnvVar, userRole string, masterKey []byte) string {
	// Non-secret variables are always visible
	if !envVar.IsSecret {
		return envVar.Value
	}

	// Viewers can only see masked secrets
	if userRole == store.RoleViewer {
		return "******"
	}

	// Deployers and Admins can see unmasked secrets
	if (userRole == store.RoleDeployer || userRole == store.RoleAdmin) && len(envVar.Nonce) > 0 && len(envVar.Ciphertext) > 0 {
		// Decrypt the secret value
		plaintext, err := crypto.Decrypt(masterKey, envVar.Nonce, envVar.Ciphertext)
		if err != nil {
			log.Error().Err(err).Msg("failed to decrypt secret environment variable")
			return "******" // Return masked on decryption error
		}
		return string(plaintext)
	}

	// Fallback to masked for any edge cases
	return "******"
}

// GetServiceEnvVars retrieves all environment variables for a service
func (h *Handlers) GetServiceEnvVars(c *gin.Context) {
	// Parse service ID
	serviceIDStr := c.Param("id")
	serviceID, err := strconv.ParseInt(serviceIDStr, 10, 64)
	if err != nil {
		log.Error().Err(err).Str("id", serviceIDStr).Msg("invalid service ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Verify service exists
	_, err = h.envVarStore.GetService(ctx, serviceID)
	if err != nil {
		log.Error().Err(err).Int64("service_id", serviceID).Msg("service not found")
		c.JSON(http.StatusNotFound, gin.H{"error": "service not found"})
		return
	}

	// Get environment variables
	envVars, err := h.envVarStore.ListEnvVars(ctx, serviceID)
	if err != nil {
		log.Error().Err(err).Int64("service_id", serviceID).Msg("failed to list environment variables")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve environment variables"})
		return
	}

	// Get user role from context
	userRole, exists := c.Get("user_role")
	if !exists {
		userRole = store.RoleViewer // Default to most restrictive
	}

	// Load master key for decryption (only if user can see secrets)
	var masterKey []byte
	if userRole == store.RoleAdmin || userRole == store.RoleDeployer {
		masterKey, err = crypto.LoadMasterKeyFromEnv()
		if err != nil {
			log.Error().Err(err).Msg("failed to load master key for decryption")
			// Continue with masked values for all secrets
		}
	}

	// Convert to response format with appropriate masking
	var response []EnvVarResponse
	for _, envVar := range envVars {
		response = append(response, EnvVarResponse{
			Key:       envVar.Key,
			Value:     maskSecretValue(envVar, userRole.(string), masterKey),
			IsSecret:  envVar.IsSecret,
			CreatedAt: envVar.CreatedAt,
			UpdatedAt: envVar.UpdatedAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{"env_vars": response})
}

// SetServiceEnvVar creates or updates a single environment variable
func (h *Handlers) SetServiceEnvVar(c *gin.Context) {
	// Parse service ID
	serviceIDStr := c.Param("id")
	serviceID, err := strconv.ParseInt(serviceIDStr, 10, 64)
	if err != nil {
		log.Error().Err(err).Str("id", serviceIDStr).Msg("invalid service ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	// Parse request
	var req EnvVarRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Error().Err(err).Msg("invalid environment variable request")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check permissions - only deployers and admins can create/update env vars
	userRole, exists := c.Get("user_role")
	if !exists || (userRole != store.RoleAdmin && userRole != store.RoleDeployer) {
		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	var nonce, ciphertext []byte
	value := req.Value

	// If it's a secret, encrypt it
	if req.IsSecret {
		masterKey, err := crypto.LoadMasterKeyFromEnv()
		if err != nil {
			log.Error().Err(err).Msg("failed to load master key for encryption")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "encryption not available"})
			return
		}

		nonce, ciphertext, err = crypto.Encrypt(masterKey, []byte(req.Value))
		if err != nil {
			log.Error().Err(err).Msg("failed to encrypt secret value")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to encrypt secret"})
			return
		}
		value = "" // Clear plaintext value for secrets
	}

	// Store environment variable
	err = h.envVarStore.SetEnvVar(ctx, serviceID, req.Key, value, req.IsSecret, nonce, ciphertext)
	if err != nil {
		log.Error().Err(err).Int64("service_id", serviceID).Str("key", req.Key).Msg("failed to set environment variable")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to set environment variable"})
		return
	}

	log.Info().
		Int64("service_id", serviceID).
		Str("key", req.Key).
		Bool("is_secret", req.IsSecret).
		Msg("environment variable set successfully")

	c.JSON(http.StatusOK, gin.H{"message": "environment variable set successfully"})
}

// BulkUpdateServiceEnvVars updates multiple environment variables for a service
func (h *Handlers) BulkUpdateServiceEnvVars(c *gin.Context) {
	// Parse service ID
	serviceIDStr := c.Param("id")
	serviceID, err := strconv.ParseInt(serviceIDStr, 10, 64)
	if err != nil {
		log.Error().Err(err).Str("id", serviceIDStr).Msg("invalid service ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	// Parse request
	var req BulkEnvVarRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Error().Err(err).Msg("invalid bulk environment variable request")
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Check permissions
	userRole, exists := c.Get("user_role")
	if !exists || (userRole != store.RoleAdmin && userRole != store.RoleDeployer) {
		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	// Load master key for encryption if needed
	var masterKey []byte
	hasSecrets := false
	for _, envVar := range req.EnvVars {
		if envVar.IsSecret {
			hasSecrets = true
			break
		}
	}

	if hasSecrets {
		masterKey, err = crypto.LoadMasterKeyFromEnv()
		if err != nil {
			log.Error().Err(err).Msg("failed to load master key for encryption")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "encryption not available"})
			return
		}
	}

	// Convert to store format with encryption
	var envVarUpdates []store.EnvVarUpdate
	for _, req := range req.EnvVars {
		update := store.EnvVarUpdate{
			Key:      req.Key,
			Value:    req.Value,
			IsSecret: req.IsSecret,
		}

		// Encrypt secrets
		if req.IsSecret {
			nonce, ciphertext, err := crypto.Encrypt(masterKey, []byte(req.Value))
			if err != nil {
				log.Error().Err(err).Str("key", req.Key).Msg("failed to encrypt secret value")
				c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to encrypt secret"})
				return
			}
			update.Nonce = nonce
			update.Ciphertext = ciphertext
			update.Value = "" // Clear plaintext for secrets
		}

		envVarUpdates = append(envVarUpdates, update)
	}

	// Bulk update
	err = h.envVarStore.BulkSetEnvVars(ctx, serviceID, envVarUpdates)
	if err != nil {
		log.Error().Err(err).Int64("service_id", serviceID).Msg("failed to bulk update environment variables")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update environment variables"})
		return
	}

	log.Info().
		Int64("service_id", serviceID).
		Int("count", len(req.EnvVars)).
		Msg("environment variables updated successfully")

	c.JSON(http.StatusOK, gin.H{"message": "environment variables updated successfully"})
}

// DeleteServiceEnvVar removes a single environment variable
func (h *Handlers) DeleteServiceEnvVar(c *gin.Context) {
	// Parse service ID
	serviceIDStr := c.Param("id")
	serviceID, err := strconv.ParseInt(serviceIDStr, 10, 64)
	if err != nil {
		log.Error().Err(err).Str("id", serviceIDStr).Msg("invalid service ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	// Get environment variable key from URL parameter
	key := c.Param("key")
	if key == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "environment variable key is required"})
		return
	}

	// Check permissions
	userRole, exists := c.Get("user_role")
	if !exists || (userRole != store.RoleAdmin && userRole != store.RoleDeployer) {
		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Delete environment variable
	err = h.envVarStore.DeleteEnvVar(ctx, serviceID, key)
	if err != nil {
		log.Error().Err(err).Int64("service_id", serviceID).Str("key", key).Msg("failed to delete environment variable")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete environment variable"})
		return
	}

	log.Info().
		Int64("service_id", serviceID).
		Str("key", key).
		Msg("environment variable deleted successfully")

	c.JSON(http.StatusOK, gin.H{"message": "environment variable deleted successfully"})
}
