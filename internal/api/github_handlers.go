package api

import (
	"net/http"
	"strconv"

	"github.com/GLINCKER/glinrdock/internal/github"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/GLINCKER/glinrdock/internal/util"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// GitHubHandlers provides GitHub App integration functionality
type GitHubHandlers struct {
	store          *store.Store
	appManager     *github.AppManager
	authenticators map[int64]*github.InstallationClient // installationID -> client
	config         *util.Config
}

// NewGitHubHandlers creates a new GitHubHandlers instance
func NewGitHubHandlers(store *store.Store, config *util.Config) (*GitHubHandlers, error) {
	if config.GitHubAppID == "" || config.GitHubAppPrivateKeyPath == "" {
		log.Warn().Msg("GitHub App not configured - GitHub integration disabled")
		return nil, nil
	}

	authenticator, err := github.NewAppAuthenticator(config.GitHubAppID, config.GitHubAppPrivateKeyPath)
	if err != nil {
		return nil, err
	}

	appManager := github.NewAppManager(authenticator)

	return &GitHubHandlers{
		store:          store,
		appManager:     appManager,
		authenticators: make(map[int64]*github.InstallationClient),
		config:         config,
	}, nil
}

// ListInstallations returns all GitHub App installations
func (h *GitHubHandlers) ListInstallations(c *gin.Context) {
	ctx := c.Request.Context()

	// Get installations from GitHub API
	installations, err := h.appManager.GetInstallations(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to get installations from GitHub")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get installations"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"installations": installations})
}

// GetInstallation returns a specific GitHub App installation
func (h *GitHubHandlers) GetInstallation(c *gin.Context) {
	installationIDStr := c.Param("id")
	installationID, err := strconv.ParseInt(installationIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid installation ID"})
		return
	}

	ctx := c.Request.Context()

	installation, err := h.appManager.GetInstallation(ctx, installationID)
	if err != nil {
		log.Error().Err(err).Int64("installation_id", installationID).Msg("failed to get installation")
		c.JSON(http.StatusNotFound, gin.H{"error": "installation not found"})
		return
	}

	c.JSON(http.StatusOK, installation)
}

// ListInstallationRepositories returns repositories for a specific installation
func (h *GitHubHandlers) ListInstallationRepositories(c *gin.Context) {
	installationIDStr := c.Param("id")
	installationID, err := strconv.ParseInt(installationIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid installation ID"})
		return
	}

	ctx := c.Request.Context()

	// Get or create installation client
	installationClient, err := h.getInstallationClient(installationID)
	if err != nil {
		log.Error().Err(err).Int64("installation_id", installationID).Msg("failed to create installation client")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to access installation"})
		return
	}

	// Get repositories from GitHub API
	repositories, err := installationClient.GetInstallationRepositories(ctx)
	if err != nil {
		log.Error().Err(err).Int64("installation_id", installationID).Msg("failed to get repositories")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get repositories"})
		return
	}

	// Get active status from database
	activeRepos, err := h.store.GetActiveReposByInstallation(ctx, installationID)
	if err != nil {
		log.Error().Err(err).Int64("installation_id", installationID).Msg("failed to get active repos from database")
		// Continue without active status
		activeRepos = []github.GitHubRepo{}
	}

	// Create a map for quick lookup
	activeMap := make(map[int64]bool)
	for _, repo := range activeRepos {
		activeMap[repo.ID] = repo.Active
	}

	// Combine GitHub API data with local active status
	type RepositoryWithStatus struct {
		github.Repository
		Active bool `json:"active"`
	}

	var reposWithStatus []RepositoryWithStatus
	for _, repo := range repositories {
		reposWithStatus = append(reposWithStatus, RepositoryWithStatus{
			Repository: repo,
			Active:     activeMap[repo.ID],
		})
	}

	c.JSON(http.StatusOK, gin.H{"repositories": reposWithStatus})
}

// ActivateRepository activates a repository for CI/CD
func (h *GitHubHandlers) ActivateRepository(c *gin.Context) {
	installationIDStr := c.Param("installation_id")
	installationID, err := strconv.ParseInt(installationIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid installation ID"})
		return
	}

	repoIDStr := c.Param("repo_id")
	repoID, err := strconv.ParseInt(repoIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid repository ID"})
		return
	}

	ctx := c.Request.Context()

	// Get repository info from GitHub to verify it exists and we have access
	installationClient, err := h.getInstallationClient(installationID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to access installation"})
		return
	}

	repositories, err := installationClient.GetInstallationRepositories(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get repositories"})
		return
	}

	var targetRepo *github.Repository
	for _, repo := range repositories {
		if repo.ID == repoID {
			targetRepo = &repo
			break
		}
	}

	if targetRepo == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "repository not found in installation"})
		return
	}

	// Create or update repository in database as active
	githubRepo := &github.GitHubRepo{
		ID:             repoID,
		FullName:       targetRepo.FullName,
		InstallationID: installationID,
		Active:         true,
	}

	err = h.store.CreateGitHubRepo(ctx, githubRepo)
	if err != nil {
		log.Error().Err(err).Int64("repo_id", repoID).Msg("failed to activate repository")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to activate repository"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "repository activated",
		"repository": targetRepo.FullName,
		"active":     true,
	})
}

// DeactivateRepository deactivates a repository for CI/CD
func (h *GitHubHandlers) DeactivateRepository(c *gin.Context) {
	installationIDStr := c.Param("installation_id")
	installationID, err := strconv.ParseInt(installationIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid installation ID"})
		return
	}

	repoIDStr := c.Param("repo_id")
	repoID, err := strconv.ParseInt(repoIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid repository ID"})
		return
	}

	ctx := c.Request.Context()

	// Update repository in database as inactive
	githubRepo := &github.GitHubRepo{
		ID:             repoID,
		FullName:       "", // Will be filled from database
		InstallationID: installationID,
		Active:         false,
	}

	// For deactivation, we need to get the current repo first to preserve the full_name
	activeRepos, err := h.store.GetActiveReposByInstallation(ctx, installationID)
	if err != nil {
		log.Error().Err(err).Int64("installation_id", installationID).Msg("failed to get active repos")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get repositories"})
		return
	}

	var found bool
	for _, repo := range activeRepos {
		if repo.ID == repoID {
			githubRepo.FullName = repo.FullName
			found = true
			break
		}
	}

	if !found {
		c.JSON(http.StatusNotFound, gin.H{"error": "repository not found or already inactive"})
		return
	}

	err = h.store.CreateGitHubRepo(ctx, githubRepo)
	if err != nil {
		log.Error().Err(err).Int64("repo_id", repoID).Msg("failed to deactivate repository")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to deactivate repository"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "repository deactivated",
		"repository": githubRepo.FullName,
		"active":     false,
	})
}

// getInstallationClient returns or creates an installation client for the given installation ID
func (h *GitHubHandlers) getInstallationClient(installationID int64) (*github.InstallationClient, error) {
	if client, exists := h.authenticators[installationID]; exists {
		return client, nil
	}

	// Create new installation client
	authenticator, err := github.NewAppAuthenticator(h.config.GitHubAppID, h.config.GitHubAppPrivateKeyPath)
	if err != nil {
		return nil, err
	}

	client, err := github.NewInstallationClient(authenticator, installationID)
	if err != nil {
		return nil, err
	}

	h.authenticators[installationID] = client
	return client, nil
}
