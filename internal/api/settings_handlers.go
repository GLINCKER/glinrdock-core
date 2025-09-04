package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// SettingsHandlers provides settings management functionality
type SettingsHandlers struct {
	store           *store.Store
	settingsService *SettingsService
	auditLogger     *audit.Logger
}

// NewSettingsHandlers creates new settings handlers
func NewSettingsHandlers(store *store.Store, auditLogger *audit.Logger) *SettingsHandlers {
	return &SettingsHandlers{
		store:           store,
		settingsService: NewSettingsService(store),
		auditLogger:     auditLogger,
	}
}

// GetSettingsService returns the settings service for internal use
func (h *SettingsHandlers) GetSettingsService() *SettingsService {
	return h.settingsService
}

// GetIntegrations returns integration configuration
func (h *SettingsHandlers) GetIntegrations(c *gin.Context) {
	ctx := c.Request.Context()

	// Audit read access (sampled 1:10)
	h.auditLogger.Record(ctx, "settings", audit.ActionRead, "integrations", "", map[string]interface{}{
		"endpoint": "/v1/settings/integrations",
		"sampled":  true,
	})

	config, err := h.settingsService.GetIntegrationsConfig(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to get integrations config")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get integrations configuration"})
		return
	}

	// Ensure we never expose secrets in the response
	if config.GitHubOAuth != nil {
		config.GitHubOAuth.ClientSecret = ""
	}
	if config.GitHubApp != nil {
		config.GitHubApp.PrivateKeyPEM = ""
	}

	c.JSON(http.StatusOK, config)
}

// UpdateIntegrations updates integration configuration
func (h *SettingsHandlers) UpdateIntegrations(c *gin.Context) {
	ctx := c.Request.Context()

	var config store.IntegrationsConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}

	// Validate the configuration
	if err := h.validateIntegrationsConfig(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "validation failed", "details": err.Error()})
		return
	}

	// Update the configuration
	if err := h.settingsService.UpdateIntegrationsConfig(ctx, &config); err != nil {
		log.Error().Err(err).Msg("failed to update integrations config")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update integrations configuration"})
		return
	}

	// Audit the update (always)
	h.auditLogger.Record(ctx, "settings", audit.ActionUpdate, "integrations", "", map[string]interface{}{
		"endpoint":     "/v1/settings/integrations",
		"github_oauth": config.GitHubOAuth != nil,
		"github_app":   config.GitHubApp != nil,
		"has_secrets":  h.hasSecrets(&config),
	})

	// Return the updated configuration (without secrets)
	updatedConfig, err := h.settingsService.GetIntegrationsConfig(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to get updated integrations config")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get updated configuration"})
		return
	}

	// Ensure we never expose secrets in the response
	if updatedConfig.GitHubOAuth != nil {
		updatedConfig.GitHubOAuth.ClientSecret = ""
	}
	if updatedConfig.GitHubApp != nil {
		updatedConfig.GitHubApp.PrivateKeyPEM = ""
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "integrations configuration updated successfully",
		"config":  updatedConfig,
	})
}

// validateIntegrationsConfig validates the provided configuration
func (h *SettingsHandlers) validateIntegrationsConfig(config *store.IntegrationsConfig) error {
	if config.GitHubOAuth != nil {
		oauth := config.GitHubOAuth

		// Validate mode
		if oauth.Mode != "off" && oauth.Mode != "pkce" && oauth.Mode != "confidential" {
			return ErrInvalidOAuthMode
		}

		// Validate client ID requirement
		if oauth.Mode != "off" && oauth.ClientID == "" {
			return ErrMissingClientID
		}

		// Validate client secret requirement for confidential mode
		if oauth.Mode == "confidential" && oauth.ClientSecret == "" {
			// Check if we already have a stored secret
			_, err := h.store.GetSetting(context.Background(), GitHubOAuthSecretKey)
			if err == store.ErrNotFound {
				return ErrMissingClientSecret
			}
		}
	}

	if config.GitHubApp != nil {
		app := config.GitHubApp

		// Validate app ID
		if app.AppID != "" {
			if err := validateAppID(app.AppID); err != nil {
				return err
			}
		}

		// Validate private key
		if app.PrivateKeyPEM != "" {
			if err := validateRSAPrivateKey(app.PrivateKeyPEM); err != nil {
				return ErrInvalidPrivateKey
			}
		}
	}

	return nil
}

// hasSecrets checks if the configuration contains secrets
func (h *SettingsHandlers) hasSecrets(config *store.IntegrationsConfig) bool {
	hasSecrets := false

	if config.GitHubOAuth != nil && config.GitHubOAuth.ClientSecret != "" {
		hasSecrets = true
	}

	if config.GitHubApp != nil && config.GitHubApp.PrivateKeyPEM != "" {
		hasSecrets = true
	}

	return hasSecrets
}

// GetGitHubInstallURL returns the GitHub App installation URL
func (h *SettingsHandlers) GetGitHubInstallURL(c *gin.Context) {
	ctx := c.Request.Context()

	// Get GitHub App configuration to check if app is configured
	setting, err := h.store.GetSetting(ctx, GitHubAppConfigKey)
	if err != nil {
		if err == store.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "GitHub App not configured"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get GitHub App configuration"})
		return
	}

	var config store.GitHubAppConfig
	if err := json.Unmarshal(setting.Value, &config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to parse GitHub App configuration"})
		return
	}

	if config.AppID == "" {
		c.JSON(http.StatusNotFound, gin.H{"error": "GitHub App ID not configured"})
		return
	}

	// Generate installation URL
	installURL := fmt.Sprintf("https://github.com/apps/your-app-name/installations/new")
	if config.AppID != "" {
		installURL = fmt.Sprintf("https://github.com/apps/app-id-%s/installations/new", config.AppID)
	}

	c.JSON(http.StatusOK, gin.H{
		"install_url": installURL,
		"app_id":      config.AppID,
	})
}

// Custom errors for validation
var (
	ErrInvalidOAuthMode     = fmt.Errorf("invalid OAuth mode: must be 'off', 'pkce', or 'confidential'")
	ErrMissingClientID      = fmt.Errorf("client_id is required when mode is not 'off'")
	ErrMissingClientSecret  = fmt.Errorf("client_secret is required for confidential mode")
	ErrInvalidAppID         = fmt.Errorf("invalid app_id: must be numeric")
	ErrInvalidPrivateKey    = fmt.Errorf("invalid private key PEM format")
)

func validateAppID(appID string) error {
	if _, err := strconv.ParseInt(appID, 10, 64); err != nil {
		return ErrInvalidAppID
	}
	return nil
}