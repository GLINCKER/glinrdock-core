package api

import (
	"context"

	"github.com/GLINCKER/glinrdock/internal/github"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// GitHubAppHandlers provides GitHub App functionality
type GitHubAppHandlers struct {
	adminHandlers   *GitHubAdminHandlers
	webhookHandler  *GitHubWebhookHandler
	githubService   *github.GitHubAppService
	settingsService *SettingsService
}

// NewGitHubAppHandlers creates new GitHub App handlers
func NewGitHubAppHandlers(store *store.Store, settingsService *SettingsService, buildQueue BuildQueue) *GitHubAppHandlers {
	// Initialize GitHub service from settings
	githubService := initializeGitHubAppFromSettings(context.Background(), settingsService)

	// Create admin handlers
	adminHandlers := NewGitHubAdminHandlers(store, settingsService, githubService)

	// Create webhook handler
	webhookHandler := NewGitHubWebhookHandler(store, settingsService, githubService, buildQueue)

	return &GitHubAppHandlers{
		adminHandlers:   adminHandlers,
		webhookHandler:  webhookHandler,
		githubService:   githubService,
		settingsService: settingsService,
	}
}

// Admin API handlers - delegated to admin handlers

func (h *GitHubAppHandlers) GetInstallations(c *gin.Context) {
	h.adminHandlers.GetInstallations(c)
}

func (h *GitHubAppHandlers) GetRepositories(c *gin.Context) {
	h.adminHandlers.GetRepositories(c)
}

func (h *GitHubAppHandlers) ActivateRepository(c *gin.Context) {
	h.adminHandlers.ActivateRepository(c)
}

func (h *GitHubAppHandlers) DeactivateRepository(c *gin.Context) {
	h.adminHandlers.DeactivateRepository(c)
}

func (h *GitHubAppHandlers) SyncInstallations(c *gin.Context) {
	h.adminHandlers.SyncInstallations(c)
}

func (h *GitHubAppHandlers) GetWebhookEvents(c *gin.Context) {
	h.adminHandlers.GetWebhookEvents(c)
}

// Webhook handler

func (h *GitHubAppHandlers) HandleWebhook(c *gin.Context) {
	h.webhookHandler.HandleWebhook(c)
}

// Service getters

func (h *GitHubAppHandlers) GetGitHubService() *github.GitHubAppService {
	return h.githubService
}

func (h *GitHubAppHandlers) IsConfigured() bool {
	return h.githubService != nil && h.githubService.IsConfigured()
}

// initializeGitHubAppFromSettings creates GitHub App service from database settings
func initializeGitHubAppFromSettings(ctx context.Context, settingsService *SettingsService) *github.GitHubAppService {
	if settingsService == nil {
		log.Warn().Msg("settings service not available - GitHub App disabled")
		return nil
	}

	// Get integrations config from settings
	integrationsConfig, err := settingsService.GetIntegrationsConfig(ctx)
	if err != nil {
		if err != store.ErrNotFound {
			log.Error().Err(err).Msg("failed to get integrations config")
		}
		// No GitHub App configuration found - this is normal for fresh installs
		log.Info().Msg("GitHub App not configured")
		return nil
	}

	// Check if GitHub App is configured
	if integrationsConfig.GitHubApp == nil || integrationsConfig.GitHubApp.AppID == "" {
		log.Info().Msg("GitHub App not configured")
		return nil
	}

	appConfig := integrationsConfig.GitHubApp

	// Get private key
	privateKey, err := settingsService.GetGitHubAppPrivateKey(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to get GitHub App private key")
		return nil
	}

	// Create GitHub App service
	service, err := github.NewGitHubAppService(appConfig.AppID, privateKey)
	if err != nil {
		log.Error().Err(err).Msg("failed to create GitHub App service")
		return nil
	}

	if service.IsConfigured() {
		log.Info().Str("app_id", appConfig.AppID).Msg("GitHub App authentication enabled")
		return service
	}

	log.Warn().Msg("GitHub App configuration validation failed")
	return nil
}
