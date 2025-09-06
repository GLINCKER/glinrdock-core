package api

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/GLINCKER/glinrdock/internal/github"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// GitHubWebhookHandler handles GitHub App webhook events
type GitHubWebhookHandler struct {
	store           *store.Store
	settingsService *SettingsService
	githubService   *github.GitHubAppService
	buildQueue      BuildQueue // Interface for enqueueing builds
}

// BuildQueue interface for enqueueing CI/CD builds
type BuildQueue interface {
	EnqueueBuild(ctx context.Context, build *BuildRequest) error
}

// BuildRequest represents a CI/CD build request
type BuildRequest struct {
	ProjectID    int64             `json:"project_id"`
	RepositoryID int64             `json:"repository_id"`
	Branch       string            `json:"branch"`
	CommitSHA    string            `json:"commit_sha"`
	CommitMsg    string            `json:"commit_message"`
	Author       string            `json:"author"`
	CloneURL     string            `json:"clone_url"`
	BuildContext string            `json:"build_context,omitempty"`
	BuildArgs    map[string]string `json:"build_args,omitempty"`
	AutoDeploy   bool              `json:"auto_deploy"`
}

// NewGitHubWebhookHandler creates a new GitHub webhook handler
func NewGitHubWebhookHandler(store *store.Store, settingsService *SettingsService, githubService *github.GitHubAppService, buildQueue BuildQueue) *GitHubWebhookHandler {
	return &GitHubWebhookHandler{
		store:           store,
		settingsService: settingsService,
		githubService:   githubService,
		buildQueue:      buildQueue,
	}
}

// HandleWebhook processes GitHub App webhook events
func (h *GitHubWebhookHandler) HandleWebhook(c *gin.Context) {
	ctx := c.Request.Context()

	// Read the request body
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		log.Error().Err(err).Msg("failed to read webhook body")
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read request body"})
		return
	}

	// Get event type and delivery ID
	eventType := c.GetHeader("X-GitHub-Event")
	deliveryID := c.GetHeader("X-GitHub-Delivery")
	signature := c.GetHeader("X-Hub-Signature-256")

	if eventType == "" {
		log.Warn().Msg("webhook missing X-GitHub-Event header")
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing X-GitHub-Event header"})
		return
	}

	// Validate webhook signature
	if err := h.validateSignature(ctx, body, signature); err != nil {
		log.Error().Err(err).Str("delivery", deliveryID).Msg("webhook signature validation failed")
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
		return
	}

	// Calculate payload hash for deduplication
	payloadHash := fmt.Sprintf("%x", sha256.Sum256(body))

	// Log the webhook event
	webhookEvent := &store.GitHubWebhookEvent{
		EventType:   eventType,
		PayloadHash: payloadHash,
		CreatedAt:   time.Now(),
	}

	log.Info().
		Str("event", eventType).
		Str("delivery", deliveryID).
		Str("hash", payloadHash).
		Msg("processing GitHub webhook")

	// Process the event based on type
	var processingErr error
	switch eventType {
	case "installation":
		processingErr = h.handleInstallationEvent(ctx, body, webhookEvent)
	case "installation_repositories":
		processingErr = h.handleInstallationRepositoriesEvent(ctx, body, webhookEvent)
	case "push":
		processingErr = h.handlePushEvent(ctx, body, webhookEvent)
	default:
		log.Debug().Str("event", eventType).Msg("ignoring unhandled webhook event type")
		c.JSON(http.StatusOK, gin.H{"message": "event ignored"})
		return
	}

	// Update webhook event with processing result
	if processingErr != nil {
		log.Error().Err(processingErr).Str("event", eventType).Msg("webhook processing failed")
		errorMsg := processingErr.Error()
		webhookEvent.ErrorMessage = &errorMsg
	} else {
		now := time.Now()
		webhookEvent.ProcessedAt = &now
	}

	// Log the webhook event to database
	if err := h.store.LogGitHubWebhookEvent(ctx, webhookEvent); err != nil {
		log.Error().Err(err).Msg("failed to log webhook event")
	}

	if processingErr != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "webhook processing failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "webhook processed successfully"})
}

// validateSignature verifies the GitHub webhook HMAC signature
func (h *GitHubWebhookHandler) validateSignature(ctx context.Context, body []byte, signature string) error {
	if signature == "" {
		return fmt.Errorf("missing signature")
	}

	// Get webhook secret from settings
	webhookSecret, err := h.settingsService.GetGitHubAppWebhookSecret(ctx)
	if err != nil {
		return fmt.Errorf("failed to get webhook secret: %w", err)
	}

	if webhookSecret == "" {
		return fmt.Errorf("webhook secret not configured")
	}

	// Parse signature (format: sha256=<hex>)
	if !strings.HasPrefix(signature, "sha256=") {
		return fmt.Errorf("invalid signature format")
	}

	signatureHex := signature[7:] // Remove "sha256=" prefix
	expectedSignature, err := hex.DecodeString(signatureHex)
	if err != nil {
		return fmt.Errorf("invalid signature hex: %w", err)
	}

	// Compute HMAC
	mac := hmac.New(sha256.New, []byte(webhookSecret))
	mac.Write(body)
	computedSignature := mac.Sum(nil)

	// Compare signatures using constant-time comparison
	if subtle.ConstantTimeCompare(expectedSignature, computedSignature) != 1 {
		return fmt.Errorf("signature mismatch")
	}

	return nil
}

// handleInstallationEvent processes installation and installation lifecycle events
func (h *GitHubWebhookHandler) handleInstallationEvent(ctx context.Context, body []byte, webhookEvent *store.GitHubWebhookEvent) error {
	var payload InstallationPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return fmt.Errorf("failed to parse installation payload: %w", err)
	}

	webhookEvent.EventAction = &payload.Action
	webhookEvent.InstallationID = &payload.Installation.ID

	log.Info().
		Str("action", payload.Action).
		Int64("installation_id", payload.Installation.ID).
		Str("account", payload.Installation.Account.Login).
		Msg("processing installation event")

	switch payload.Action {
	case "created":
		return h.handleInstallationCreated(ctx, &payload.Installation)
	case "deleted":
		return h.handleInstallationDeleted(ctx, payload.Installation.ID)
	case "suspend":
		return h.handleInstallationSuspended(ctx, payload.Installation.ID, payload.Sender)
	case "unsuspend":
		return h.handleInstallationUnsuspended(ctx, payload.Installation.ID)
	default:
		log.Debug().Str("action", payload.Action).Msg("ignoring installation action")
		return nil
	}
}

// handleInstallationRepositoriesEvent processes repository add/remove events
func (h *GitHubWebhookHandler) handleInstallationRepositoriesEvent(ctx context.Context, body []byte, webhookEvent *store.GitHubWebhookEvent) error {
	var payload InstallationRepositoriesPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return fmt.Errorf("failed to parse installation repositories payload: %w", err)
	}

	webhookEvent.EventAction = &payload.Action
	webhookEvent.InstallationID = &payload.Installation.ID

	log.Info().
		Str("action", payload.Action).
		Int64("installation_id", payload.Installation.ID).
		Int("repo_count", len(payload.RepositoriesAdded)+len(payload.RepositoriesRemoved)).
		Msg("processing installation repositories event")

	switch payload.Action {
	case "added":
		return h.handleRepositoriesAdded(ctx, payload.Installation.ID, payload.RepositoriesAdded)
	case "removed":
		return h.handleRepositoriesRemoved(ctx, payload.RepositoriesRemoved)
	default:
		log.Debug().Str("action", payload.Action).Msg("ignoring installation repositories action")
		return nil
	}
}

// handlePushEvent processes push events and enqueues builds for activated repos
func (h *GitHubWebhookHandler) handlePushEvent(ctx context.Context, body []byte, webhookEvent *store.GitHubWebhookEvent) error {
	var payload PushPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		return fmt.Errorf("failed to parse push payload: %w", err)
	}

	webhookEvent.InstallationID = &payload.Installation.ID
	webhookEvent.RepositoryID = &payload.Repository.ID

	// Extract branch from ref
	branch := strings.TrimPrefix(payload.Ref, "refs/heads/")
	if branch == payload.Ref {
		log.Debug().Str("ref", payload.Ref).Msg("ignoring non-branch push")
		return nil
	}

	log.Info().
		Int64("repo_id", payload.Repository.ID).
		Str("repo", payload.Repository.FullName).
		Str("branch", branch).
		Str("commit", payload.HeadCommit.ID).
		Msg("processing push event")

	// Check if repository is activated
	mapping, err := h.store.GetGitHubRepoMappingByRepo(ctx, payload.Repository.ID)
	if err != nil {
		if err == store.ErrNotFound {
			log.Debug().Int64("repo_id", payload.Repository.ID).Msg("repository not activated, skipping build")
			return nil
		}
		return fmt.Errorf("failed to get repo mapping: %w", err)
	}

	// Check branch filter if configured
	if mapping.BranchFilter != nil && *mapping.BranchFilter != "" {
		// TODO: Implement regex matching for branch filter
		// For now, simple string comparison
		if branch != *mapping.BranchFilter && *mapping.BranchFilter != "*" {
			log.Debug().
				Str("branch", branch).
				Str("filter", *mapping.BranchFilter).
				Msg("branch does not match filter, skipping build")
			return nil
		}
	}

	// Parse build args if configured
	var buildArgs map[string]string
	if mapping.BuildArgs != nil && *mapping.BuildArgs != "" {
		if err := json.Unmarshal([]byte(*mapping.BuildArgs), &buildArgs); err != nil {
			log.Error().Err(err).Str("build_args", *mapping.BuildArgs).Msg("failed to parse build args")
			buildArgs = nil
		}
	}

	// Create build request
	buildRequest := &BuildRequest{
		ProjectID:    mapping.ProjectID,
		RepositoryID: payload.Repository.ID,
		Branch:       branch,
		CommitSHA:    payload.HeadCommit.ID,
		CommitMsg:    payload.HeadCommit.Message,
		Author:       payload.HeadCommit.Author.Name,
		CloneURL:     payload.Repository.CloneURL,
		BuildArgs:    buildArgs,
		AutoDeploy:   mapping.AutoDeploy,
	}

	if mapping.BuildContext != nil {
		buildRequest.BuildContext = *mapping.BuildContext
	}

	// Enqueue the build
	if err := h.buildQueue.EnqueueBuild(ctx, buildRequest); err != nil {
		return fmt.Errorf("failed to enqueue build: %w", err)
	}

	log.Info().
		Int64("project_id", mapping.ProjectID).
		Str("repo", payload.Repository.FullName).
		Str("branch", branch).
		Str("commit", payload.HeadCommit.ID).
		Msg("build enqueued successfully")

	return nil
}

// Installation event handlers

func (h *GitHubWebhookHandler) handleInstallationCreated(ctx context.Context, installation *github.Installation) error {
	// Convert to store model
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
			return fmt.Errorf("failed to marshal permissions: %w", err)
		}
		storeInstallation.Permissions = string(permissionsJSON)
	}

	if installation.Events != nil {
		eventsJSON, err := json.Marshal(installation.Events)
		if err != nil {
			return fmt.Errorf("failed to marshal events: %w", err)
		}
		storeInstallation.Events = string(eventsJSON)
	}

	// Upsert installation
	_, err := h.store.UpsertGitHubInstallation(ctx, storeInstallation)
	if err != nil {
		return fmt.Errorf("failed to upsert installation: %w", err)
	}

	// Fetch and store repositories for this installation
	repos, err := h.githubService.GetInstallationRepositories(ctx, installation.ID)
	if err != nil {
		log.Error().Err(err).Int64("installation_id", installation.ID).Msg("failed to fetch installation repositories")
		// Don't fail the entire operation for this
		return nil
	}

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

		if _, err := h.store.UpsertGitHubRepository(ctx, storeRepo); err != nil {
			log.Error().Err(err).Int64("repo_id", repo.ID).Msg("failed to upsert repository")
		}
	}

	log.Info().
		Int64("installation_id", installation.ID).
		Str("account", installation.Account.Login).
		Int("repo_count", len(repos)).
		Msg("installation created successfully")

	return nil
}

func (h *GitHubWebhookHandler) handleInstallationDeleted(ctx context.Context, installationID int64) error {
	if err := h.store.DeleteGitHubInstallation(ctx, installationID); err != nil && err != store.ErrNotFound {
		return fmt.Errorf("failed to delete installation: %w", err)
	}

	log.Info().Int64("installation_id", installationID).Msg("installation deleted successfully")
	return nil
}

func (h *GitHubWebhookHandler) handleInstallationSuspended(ctx context.Context, installationID int64, sender *github.Account) error {
	// For now, just log the event. Could update installation record if needed.
	suspendedBy := "unknown"
	if sender != nil {
		suspendedBy = sender.Login
	}

	log.Info().
		Int64("installation_id", installationID).
		Str("suspended_by", suspendedBy).
		Msg("installation suspended")

	return nil
}

func (h *GitHubWebhookHandler) handleInstallationUnsuspended(ctx context.Context, installationID int64) error {
	log.Info().Int64("installation_id", installationID).Msg("installation unsuspended")
	return nil
}

// Repository event handlers

func (h *GitHubWebhookHandler) handleRepositoriesAdded(ctx context.Context, installationID int64, repos []github.Repository) error {
	for _, repo := range repos {
		storeRepo := &store.GitHubRepository{
			RepositoryID:   repo.ID,
			InstallationID: installationID,
			Name:           repo.Name,
			FullName:       repo.FullName,
			OwnerLogin:     repo.Owner.Login,
			Private:        repo.Private,
			DefaultBranch:  repo.DefaultBranch,
			CloneURL:       repo.CloneURL,
			SSHURL:         repo.SSHURL,
		}

		if _, err := h.store.UpsertGitHubRepository(ctx, storeRepo); err != nil {
			log.Error().Err(err).Int64("repo_id", repo.ID).Msg("failed to upsert repository")
		} else {
			log.Info().
				Int64("repo_id", repo.ID).
				Str("repo", repo.FullName).
				Msg("repository added to installation")
		}
	}

	return nil
}

func (h *GitHubWebhookHandler) handleRepositoriesRemoved(ctx context.Context, repos []github.Repository) error {
	for _, repo := range repos {
		// Remove any activation mappings first
		if err := h.store.DeleteGitHubRepoMapping(ctx, repo.ID); err != nil && err != store.ErrNotFound {
			log.Error().Err(err).Int64("repo_id", repo.ID).Msg("failed to delete repo mapping")
		}

		log.Info().
			Int64("repo_id", repo.ID).
			Str("repo", repo.FullName).
			Msg("repository removed from installation")
	}

	return nil
}

// Webhook payload types

type InstallationPayload struct {
	Action       string              `json:"action"`
	Installation github.Installation `json:"installation"`
	Sender       *github.Account     `json:"sender,omitempty"`
}

type InstallationRepositoriesPayload struct {
	Action              string              `json:"action"`
	Installation        github.Installation `json:"installation"`
	RepositoriesAdded   []github.Repository `json:"repositories_added,omitempty"`
	RepositoriesRemoved []github.Repository `json:"repositories_removed,omitempty"`
	Sender              *github.Account     `json:"sender,omitempty"`
}

type PushPayload struct {
	Ref          string              `json:"ref"`
	Before       string              `json:"before"`
	After        string              `json:"after"`
	Repository   github.Repository   `json:"repository"`
	Installation github.Installation `json:"installation"`
	Pusher       PushUser            `json:"pusher"`
	Sender       github.Account      `json:"sender"`
	HeadCommit   Commit              `json:"head_commit"`
	Commits      []Commit            `json:"commits"`
}

type PushUser struct {
	Name  string `json:"name"`
	Email string `json:"email"`
}

type Commit struct {
	ID        string     `json:"id"`
	TreeID    string     `json:"tree_id"`
	Message   string     `json:"message"`
	Timestamp time.Time  `json:"timestamp"`
	URL       string     `json:"url"`
	Author    CommitUser `json:"author"`
	Committer CommitUser `json:"committer"`
	Added     []string   `json:"added"`
	Removed   []string   `json:"removed"`
	Modified  []string   `json:"modified"`
}

type CommitUser struct {
	Name     string `json:"name"`
	Email    string `json:"email"`
	Username string `json:"username"`
}
