package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"github.com/GLINCKER/glinrdock/internal/github"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// GitHubAdminHandlers provides GitHub App administration functionality
type GitHubAdminHandlers struct {
	store           *store.Store
	settingsService *SettingsService
	githubService   *github.GitHubAppService
}

// NewGitHubAdminHandlers creates new GitHub admin handlers
func NewGitHubAdminHandlers(store *store.Store, settingsService *SettingsService, githubService *github.GitHubAppService) *GitHubAdminHandlers {
	return &GitHubAdminHandlers{
		store:           store,
		settingsService: settingsService,
		githubService:   githubService,
	}
}

// GetInstallations returns all GitHub App installations with repositories
func (h *GitHubAdminHandlers) GetInstallations(c *gin.Context) {
	ctx := c.Request.Context()

	// Check if GitHub App is configured
	if h.githubService == nil || !h.githubService.IsConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "GitHub App not configured"})
		return
	}

	// Get installations from database
	installations, err := h.store.GetGitHubInstallations(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to get GitHub installations")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get installations"})
		return
	}

	// Enhance installations with repository data
	var result []InstallationWithRepos
	for _, installation := range installations {
		repos, err := h.store.GetGitHubRepositoriesByInstallation(ctx, installation.InstallationID)
		if err != nil {
			log.Error().Err(err).Int64("installation_id", installation.InstallationID).Msg("failed to get installation repositories")
			repos = []store.GitHubRepository{} // Return empty slice on error
		}

		installationWithRepos := InstallationWithRepos{
			Installation: installation,
			Repositories: repos,
		}

		result = append(result, installationWithRepos)
	}

	c.JSON(http.StatusOK, gin.H{
		"installations": result,
		"total_count":   len(result),
	})
}

// GetRepositories returns all available GitHub repositories with their activation status
func (h *GitHubAdminHandlers) GetRepositories(c *gin.Context) {
	ctx := c.Request.Context()

	// Check if GitHub App is configured
	if h.githubService == nil || !h.githubService.IsConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "GitHub App not configured"})
		return
	}

	// Get repositories with mappings
	repositories, err := h.store.GetGitHubRepositoriesWithMappings(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to get GitHub repositories")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get repositories"})
		return
	}

	// Count activated repos
	activatedCount := 0
	for _, repo := range repositories {
		if repo.IsActivated {
			activatedCount++
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"repositories":    repositories,
		"total_count":     len(repositories),
		"activated_count": activatedCount,
	})
}

// ActivateRepository activates a GitHub repository for CI/CD
func (h *GitHubAdminHandlers) ActivateRepository(c *gin.Context) {
	ctx := c.Request.Context()

	// Parse repository ID from URL
	repoIDStr := c.Param("id")
	repoID, err := strconv.ParseInt(repoIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid repository ID"})
		return
	}

	// Parse request body
	var req ActivateRepositoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body", "details": err.Error()})
		return
	}

	// Validate required fields
	if req.ProjectID == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "project_id is required"})
		return
	}

	// Check if repository exists
	repository, err := h.store.GetGitHubRepositoryByID(ctx, repoID)
	if err != nil {
		if err == store.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "repository not found"})
		} else {
			log.Error().Err(err).Int64("repo_id", repoID).Msg("failed to get repository")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get repository"})
		}
		return
	}

	// Check if project exists
	project, err := h.store.GetProject(ctx, req.ProjectID)
	if err != nil {
		if err == store.ErrNotFound {
			c.JSON(http.StatusBadRequest, gin.H{"error": "project not found"})
		} else {
			log.Error().Err(err).Int64("project_id", req.ProjectID).Msg("failed to get project")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get project"})
		}
		return
	}

	// Check if repository is already activated
	existingMapping, err := h.store.GetGitHubRepoMappingByRepo(ctx, repoID)
	if err == nil {
		// Repository is already activated
		c.JSON(http.StatusConflict, gin.H{
			"error":   "repository already activated",
			"mapping": existingMapping,
		})
		return
	} else if err != store.ErrNotFound {
		log.Error().Err(err).Int64("repo_id", repoID).Msg("failed to check existing mapping")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check activation status"})
		return
	}

	// Get current user for audit
	createdBy := "unknown"
	if tokenName, exists := c.Get("token_name"); exists {
		createdBy = tokenName.(string)
	}

	// Serialize build args if provided
	var buildArgsJSON *string
	if req.BuildArgs != nil && len(req.BuildArgs) > 0 {
		buildArgsBytes, err := json.Marshal(req.BuildArgs)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid build_args format"})
			return
		}
		buildArgsStr := string(buildArgsBytes)
		buildArgsJSON = &buildArgsStr
	}

	// Create the mapping
	mapping := &store.GitHubRepoMapping{
		RepositoryID: repoID,
		ProjectID:    req.ProjectID,
		BranchFilter: req.BranchFilter,
		BuildContext: req.BuildContext,
		BuildArgs:    buildArgsJSON,
		AutoDeploy:   req.AutoDeploy,
		CreatedBy:    createdBy,
	}

	createdMapping, err := h.store.CreateGitHubRepoMapping(ctx, mapping)
	if err != nil {
		log.Error().Err(err).Interface("mapping", mapping).Msg("failed to create repo mapping")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to activate repository"})
		return
	}

	log.Info().
		Int64("repo_id", repoID).
		Str("repo", repository.FullName).
		Int64("project_id", req.ProjectID).
		Str("project", project.Name).
		Str("created_by", createdBy).
		Msg("repository activated for CI/CD")

	c.JSON(http.StatusCreated, gin.H{
		"message":    "repository activated successfully",
		"mapping":    createdMapping,
		"repository": repository,
		"project":    project,
	})
}

// DeactivateRepository deactivates a GitHub repository from CI/CD
func (h *GitHubAdminHandlers) DeactivateRepository(c *gin.Context) {
	ctx := c.Request.Context()

	// Parse repository ID from URL
	repoIDStr := c.Param("id")
	repoID, err := strconv.ParseInt(repoIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid repository ID"})
		return
	}

	// Check if repository mapping exists
	mapping, err := h.store.GetGitHubRepoMappingByRepo(ctx, repoID)
	if err != nil {
		if err == store.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "repository not activated"})
		} else {
			log.Error().Err(err).Int64("repo_id", repoID).Msg("failed to get repo mapping")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get activation status"})
		}
		return
	}

	// Get repository info for logging
	repository, err := h.store.GetGitHubRepositoryByID(ctx, repoID)
	if err != nil && err != store.ErrNotFound {
		log.Error().Err(err).Int64("repo_id", repoID).Msg("failed to get repository info")
	}

	// Delete the mapping
	if err := h.store.DeleteGitHubRepoMapping(ctx, repoID); err != nil {
		log.Error().Err(err).Int64("repo_id", repoID).Msg("failed to delete repo mapping")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to deactivate repository"})
		return
	}

	// Get current user for logging
	deactivatedBy := "unknown"
	if tokenName, exists := c.Get("token_name"); exists {
		deactivatedBy = tokenName.(string)
	}

	repoName := fmt.Sprintf("repo_%d", repoID)
	if repository != nil {
		repoName = repository.FullName
	}

	log.Info().
		Int64("repo_id", repoID).
		Str("repo", repoName).
		Int64("project_id", mapping.ProjectID).
		Str("deactivated_by", deactivatedBy).
		Msg("repository deactivated from CI/CD")

	c.JSON(http.StatusOK, gin.H{
		"message": "repository deactivated successfully",
		"mapping": mapping,
	})
}

// SyncInstallations syncs installations and repositories from GitHub API
func (h *GitHubAdminHandlers) SyncInstallations(c *gin.Context) {
	ctx := c.Request.Context()

	// Check if GitHub App is configured
	if h.githubService == nil || !h.githubService.IsConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "GitHub App not configured"})
		return
	}

	// Fetch installations from GitHub API
	installations, err := h.githubService.GetInstallations(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to fetch installations from GitHub API")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to sync installations"})
		return
	}

	syncStats := SyncStats{
		InstallationsProcessed: len(installations),
		RepositoriesProcessed:  0,
		Errors:                 []string{},
	}

	// Process each installation
	for _, installation := range installations {
		// Convert to store model and upsert
		storeInstallation := &store.GitHubInstallation{
			InstallationID: installation.ID,
			AccountLogin:   installation.Account.Login,
			AccountID:      installation.Account.ID,
			AccountType:    installation.Account.Type,
		}

		// Marshal permissions and events
		if installation.Permissions != nil {
			permissionsJSON, err := json.Marshal(installation.Permissions)
			if err != nil {
				syncStats.Errors = append(syncStats.Errors, fmt.Sprintf("failed to marshal permissions for installation %d: %v", installation.ID, err))
				continue
			}
			storeInstallation.Permissions = string(permissionsJSON)
		}

		if installation.Events != nil {
			eventsJSON, err := json.Marshal(installation.Events)
			if err != nil {
				syncStats.Errors = append(syncStats.Errors, fmt.Sprintf("failed to marshal events for installation %d: %v", installation.ID, err))
				continue
			}
			storeInstallation.Events = string(eventsJSON)
		}

		// Upsert installation
		_, err := h.store.UpsertGitHubInstallation(ctx, storeInstallation)
		if err != nil {
			syncStats.Errors = append(syncStats.Errors, fmt.Sprintf("failed to upsert installation %d: %v", installation.ID, err))
			continue
		}

		// Fetch repositories for this installation
		repos, err := h.githubService.GetInstallationRepositories(ctx, installation.ID)
		if err != nil {
			syncStats.Errors = append(syncStats.Errors, fmt.Sprintf("failed to fetch repositories for installation %d: %v", installation.ID, err))
			continue
		}

		// Process each repository
		for _, repo := range repos {
			storeRepo := &store.GitHubRepository{
				RepositoryID:   repo.ID,
				InstallationID: installation.ID,
				Name:           repo.Name,
				FullName:       repo.FullName,
				OwnerLogin:     repo.Owner.Login,
				Private:        repo.Private,
				DefaultBranch:  repo.DefaultBranch,
				CloneURL:       repo.CloneURL,
				SSHURL:         repo.SSHURL,
			}

			_, err := h.store.UpsertGitHubRepository(ctx, storeRepo)
			if err != nil {
				syncStats.Errors = append(syncStats.Errors, fmt.Sprintf("failed to upsert repository %d: %v", repo.ID, err))
			} else {
				syncStats.RepositoriesProcessed++
			}
		}
	}

	// Get current user for logging
	syncedBy := "unknown"
	if tokenName, exists := c.Get("token_name"); exists {
		syncedBy = tokenName.(string)
	}

	log.Info().
		Int("installations", syncStats.InstallationsProcessed).
		Int("repositories", syncStats.RepositoriesProcessed).
		Int("errors", len(syncStats.Errors)).
		Str("synced_by", syncedBy).
		Msg("GitHub installations sync completed")

	c.JSON(http.StatusOK, gin.H{
		"message": "sync completed",
		"stats":   syncStats,
	})
}

// GetWebhookEvents returns recent webhook events for debugging
func (h *GitHubAdminHandlers) GetWebhookEvents(c *gin.Context) {
	ctx := c.Request.Context()

	// Parse limit parameter
	limitStr := c.DefaultQuery("limit", "50")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 || limit > 1000 {
		limit = 50
	}

	// Get webhook events
	events, err := h.store.GetGitHubWebhookEvents(ctx, limit)
	if err != nil {
		log.Error().Err(err).Msg("failed to get webhook events")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get webhook events"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"events": events,
		"count":  len(events),
		"limit":  limit,
	})
}

// Request/Response types

type InstallationWithRepos struct {
	Installation store.GitHubInstallation `json:"installation"`
	Repositories []store.GitHubRepository `json:"repositories"`
}

type ActivateRepositoryRequest struct {
	ProjectID    int64             `json:"project_id" binding:"required"`
	BranchFilter *string           `json:"branch_filter,omitempty"`
	BuildContext *string           `json:"build_context,omitempty"`
	BuildArgs    map[string]string `json:"build_args,omitempty"`
	AutoDeploy   bool              `json:"auto_deploy"`
}

type SyncStats struct {
	InstallationsProcessed int      `json:"installations_processed"`
	RepositoriesProcessed  int      `json:"repositories_processed"`
	Errors                 []string `json:"errors"`
}
