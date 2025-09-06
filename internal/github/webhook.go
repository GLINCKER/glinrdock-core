package github

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// WebhookHandler handles GitHub App webhook events
type WebhookHandler struct {
	secret string
	store  GitHubStore
}

// GitHubInstallation represents a GitHub App installation in the database
type GitHubInstallation struct {
	ID           int64     `json:"id" db:"id"`
	AccountLogin string    `json:"account_login" db:"account_login"`
	AccountType  string    `json:"account_type" db:"account_type"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

// GitHubRepo represents a GitHub repository in the database
type GitHubRepo struct {
	ID             int64     `json:"id" db:"id"`
	FullName       string    `json:"full_name" db:"full_name"`
	InstallationID int64     `json:"installation_id" db:"installation_id"`
	Active         bool      `json:"active" db:"active"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
}

// GitHubStore defines the interface for GitHub-related database operations
type GitHubStore interface {
	CreateGitHubInstallation(ctx context.Context, installation *GitHubInstallation) error
	DeleteGitHubInstallation(ctx context.Context, id int64) error
	CreateGitHubRepo(ctx context.Context, repo *GitHubRepo) error
	DeleteGitHubRepo(ctx context.Context, id int64) error
	GetActiveReposByInstallation(ctx context.Context, installationID int64) ([]GitHubRepo, error)
}

// NewWebhookHandler creates a new webhook handler
func NewWebhookHandler(secret string, store GitHubStore) *WebhookHandler {
	return &WebhookHandler{
		secret: secret,
		store:  store,
	}
}

// HandleWebhook processes incoming GitHub webhook events
func (h *WebhookHandler) HandleWebhook(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Read the body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "Error reading body", http.StatusBadRequest)
		return
	}

	// Verify signature
	if !h.verifySignature(r.Header.Get("X-Hub-Signature-256"), body) {
		http.Error(w, "Invalid signature", http.StatusUnauthorized)
		return
	}

	// Get event type
	eventType := r.Header.Get("X-GitHub-Event")
	if eventType == "" {
		http.Error(w, "Missing event type", http.StatusBadRequest)
		return
	}

	// Handle the event
	if err := h.handleEvent(eventType, body); err != nil {
		http.Error(w, fmt.Sprintf("Error handling event: %v", err), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("OK"))
}

// verifySignature verifies the HMAC signature of the webhook payload
func (h *WebhookHandler) verifySignature(signature string, body []byte) bool {
	if signature == "" || h.secret == "" {
		return false
	}

	// Remove "sha256=" prefix
	if !strings.HasPrefix(signature, "sha256=") {
		return false
	}
	signature = strings.TrimPrefix(signature, "sha256=")

	// Calculate expected signature
	mac := hmac.New(sha256.New, []byte(h.secret))
	mac.Write(body)
	expectedSignature := hex.EncodeToString(mac.Sum(nil))

	// Compare signatures using constant time comparison
	return hmac.Equal([]byte(signature), []byte(expectedSignature))
}

// handleEvent routes events to appropriate handlers
func (h *WebhookHandler) handleEvent(eventType string, body []byte) error {
	switch eventType {
	case "installation":
		return h.handleInstallationEvent(body)
	case "installation_repositories":
		return h.handleInstallationRepositoriesEvent(body)
	case "push":
		return h.handlePushEvent(body)
	default:
		// Ignore other events
		return nil
	}
}

// InstallationEvent represents a GitHub App installation event
type InstallationEvent struct {
	Action       string       `json:"action"`
	Installation Installation `json:"installation"`
	Repositories []Repository `json:"repositories,omitempty"`
}

// InstallationRepositoriesEvent represents changes to installation repositories
type InstallationRepositoriesEvent struct {
	Action              string       `json:"action"`
	Installation        Installation `json:"installation"`
	RepositoriesAdded   []Repository `json:"repositories_added,omitempty"`
	RepositoriesRemoved []Repository `json:"repositories_removed,omitempty"`
}

// PushEvent represents a repository push event
type PushEvent struct {
	Ref        string     `json:"ref"`
	Repository Repository `json:"repository"`
	Commits    []struct {
		ID      string `json:"id"`
		Message string `json:"message"`
		Author  struct {
			Name  string `json:"name"`
			Email string `json:"email"`
		} `json:"author"`
	} `json:"commits"`
	Installation Installation `json:"installation"`
}

// handleInstallationEvent processes installation/uninstallation events
func (h *WebhookHandler) handleInstallationEvent(body []byte) error {
	var event InstallationEvent
	if err := json.Unmarshal(body, &event); err != nil {
		return fmt.Errorf("failed to parse installation event: %w", err)
	}

	ctx := context.Background()

	switch event.Action {
	case "created":
		// Store installation in database
		installation := &GitHubInstallation{
			ID:           event.Installation.ID,
			AccountLogin: event.Installation.Account.Login,
			AccountType:  event.Installation.Account.Type,
			CreatedAt:    time.Now(),
			UpdatedAt:    time.Now(),
		}

		if err := h.store.CreateGitHubInstallation(ctx, installation); err != nil {
			return fmt.Errorf("failed to create installation: %w", err)
		}

		// Add repositories if included in event
		for _, repo := range event.Repositories {
			githubRepo := &GitHubRepo{
				ID:             repo.ID,
				FullName:       repo.FullName,
				InstallationID: event.Installation.ID,
				Active:         false, // Default to inactive, user must activate
				CreatedAt:      time.Now(),
				UpdatedAt:      time.Now(),
			}

			if err := h.store.CreateGitHubRepo(ctx, githubRepo); err != nil {
				fmt.Printf("Failed to create repo %s: %v\n", repo.FullName, err)
			}
		}

		fmt.Printf("Installation created: %d (%s) with %d repositories\n",
			event.Installation.ID, event.Installation.Account.Login, len(event.Repositories))

	case "deleted":
		// Remove installation from database (will cascade delete repos)
		if err := h.store.DeleteGitHubInstallation(ctx, event.Installation.ID); err != nil {
			return fmt.Errorf("failed to delete installation: %w", err)
		}
		fmt.Printf("Installation deleted: %d (%s)\n", event.Installation.ID, event.Installation.Account.Login)

	case "suspend":
		// TODO: Mark installation as suspended (need to add suspend field to DB)
		fmt.Printf("Installation suspended: %d (%s)\n", event.Installation.ID, event.Installation.Account.Login)

	case "unsuspend":
		// TODO: Mark installation as active (need to add suspend field to DB)
		fmt.Printf("Installation unsuspended: %d (%s)\n", event.Installation.ID, event.Installation.Account.Login)
	}

	return nil
}

// handleInstallationRepositoriesEvent processes repository access changes
func (h *WebhookHandler) handleInstallationRepositoriesEvent(body []byte) error {
	var event InstallationRepositoriesEvent
	if err := json.Unmarshal(body, &event); err != nil {
		return fmt.Errorf("failed to parse installation repositories event: %w", err)
	}

	ctx := context.Background()

	switch event.Action {
	case "added":
		// Add repositories to database
		for _, repo := range event.RepositoriesAdded {
			githubRepo := &GitHubRepo{
				ID:             repo.ID,
				FullName:       repo.FullName,
				InstallationID: event.Installation.ID,
				Active:         false, // Default to inactive, user must activate
				CreatedAt:      time.Now(),
				UpdatedAt:      time.Now(),
			}

			if err := h.store.CreateGitHubRepo(ctx, githubRepo); err != nil {
				fmt.Printf("Failed to create repo %s: %v\n", repo.FullName, err)
			}
		}
		fmt.Printf("Repositories added to installation %d: %d repos\n",
			event.Installation.ID, len(event.RepositoriesAdded))

	case "removed":
		// Remove repositories from database
		for _, repo := range event.RepositoriesRemoved {
			if err := h.store.DeleteGitHubRepo(ctx, repo.ID); err != nil {
				fmt.Printf("Failed to delete repo %s: %v\n", repo.FullName, err)
			}
		}
		fmt.Printf("Repositories removed from installation %d: %d repos\n",
			event.Installation.ID, len(event.RepositoriesRemoved))
	}

	return nil
}

// handlePushEvent processes repository push events
func (h *WebhookHandler) handlePushEvent(body []byte) error {
	var event PushEvent
	if err := json.Unmarshal(body, &event); err != nil {
		return fmt.Errorf("failed to parse push event: %w", err)
	}

	// Only handle pushes to main/master branches
	if !strings.HasSuffix(event.Ref, "/main") && !strings.HasSuffix(event.Ref, "/master") {
		return nil
	}

	ctx := context.Background()

	// Check if repository is active (user has enabled it for CI/CD)
	activeRepos, err := h.store.GetActiveReposByInstallation(ctx, event.Installation.ID)
	if err != nil {
		return fmt.Errorf("failed to get active repos: %w", err)
	}

	var activeRepo *GitHubRepo
	for _, repo := range activeRepos {
		if repo.ID == event.Repository.ID {
			activeRepo = &repo
			break
		}
	}

	if activeRepo == nil {
		// Repository is not active, ignore push
		fmt.Printf("Push to %s ignored: repository not active\n", event.Repository.FullName)
		return nil
	}

	// TODO: Get linked projects for this repository and trigger builds
	// This would require extending the store interface to include project mappings
	fmt.Printf("Push to active repo %s: %s (%d commits) - would trigger build\n",
		event.Repository.FullName, event.Ref, len(event.Commits))

	return nil
}
