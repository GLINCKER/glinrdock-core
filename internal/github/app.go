package github

import (
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

// GitHubAppService handles GitHub App authentication and API operations
type GitHubAppService struct {
	appID      string
	privateKey *rsa.PrivateKey
}

// NewGitHubAppService creates a new GitHub App service
func NewGitHubAppService(appID string, privateKeyPEM string) (*GitHubAppService, error) {
	if appID == "" {
		return nil, fmt.Errorf("app ID is required")
	}

	if privateKeyPEM == "" {
		return nil, fmt.Errorf("private key PEM is required")
	}

	// Parse the private key
	privateKey, err := parseRSAPrivateKey(privateKeyPEM)
	if err != nil {
		return nil, fmt.Errorf("failed to parse private key: %w", err)
	}

	return &GitHubAppService{
		appID:      appID,
		privateKey: privateKey,
	}, nil
}

// GenerateJWT generates a JWT for GitHub App authentication (10 minute expiry)
func (s *GitHubAppService) GenerateJWT() (string, error) {
	now := time.Now()
	
	// Create the claims
	claims := jwt.MapClaims{
		"iat": now.Unix(),
		"exp": now.Add(10 * time.Minute).Unix(),
		"iss": s.appID,
	}

	// Create the token
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)

	// Sign the token
	tokenString, err := token.SignedString(s.privateKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign JWT: %w", err)
	}

	return tokenString, nil
}

// GetInstallationToken exchanges the installation ID for an access token
func (s *GitHubAppService) GetInstallationToken(ctx context.Context, installationID int64) (*InstallationToken, error) {
	// Generate JWT
	jwtToken, err := s.GenerateJWT()
	if err != nil {
		return nil, fmt.Errorf("failed to generate JWT: %w", err)
	}

	// Create the request
	url := fmt.Sprintf("https://api.github.com/app/installations/%d/access_tokens", installationID)
	req, err := http.NewRequestWithContext(ctx, "POST", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+jwtToken)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "GLINR-Dock/1.0")

	// Make the request
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub API returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse the response
	var token InstallationToken
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &token, nil
}

// GetInstallations fetches all installations for this GitHub App
func (s *GitHubAppService) GetInstallations(ctx context.Context) ([]Installation, error) {
	// Generate JWT
	jwtToken, err := s.GenerateJWT()
	if err != nil {
		return nil, fmt.Errorf("failed to generate JWT: %w", err)
	}

	// Create the request
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/app/installations", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+jwtToken)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "GLINR-Dock/1.0")

	// Make the request
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub API returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse the response
	var installations []Installation
	if err := json.NewDecoder(resp.Body).Decode(&installations); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return installations, nil
}

// GetInstallationRepositories fetches repositories for a specific installation
func (s *GitHubAppService) GetInstallationRepositories(ctx context.Context, installationID int64) ([]Repository, error) {
	// Get installation token first
	token, err := s.GetInstallationToken(ctx, installationID)
	if err != nil {
		return nil, fmt.Errorf("failed to get installation token: %w", err)
	}

	// Create the request
	url := fmt.Sprintf("https://api.github.com/installation/repositories")
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "token "+token.Token)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "GLINR-Dock/1.0")

	// Make the request
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	// Check response status
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub API returned status %d: %s", resp.StatusCode, string(body))
	}

	// Parse the response
	var repoResponse struct {
		Repositories []Repository `json:"repositories"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&repoResponse); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return repoResponse.Repositories, nil
}

// InstallationToken represents a GitHub App installation access token
type InstallationToken struct {
	Token       string                 `json:"token"`
	ExpiresAt   time.Time             `json:"expires_at"`
	Permissions map[string]string     `json:"permissions"`
	Repositories []Repository         `json:"repositories,omitempty"`
}

// Installation represents a GitHub App installation
type Installation struct {
	ID                  int64             `json:"id"`
	Account             Account           `json:"account"`
	RepositorySelection string            `json:"repository_selection"`
	AccessTokensURL     string            `json:"access_tokens_url"`
	RepositoriesURL     string            `json:"repositories_url"`
	HTMLURL            string            `json:"html_url"`
	AppID              int64             `json:"app_id"`
	AppSlug            string            `json:"app_slug"`
	TargetID           int64             `json:"target_id"`
	TargetType         string            `json:"target_type"`
	Permissions        map[string]string `json:"permissions"`
	Events             []string          `json:"events"`
	CreatedAt          time.Time         `json:"created_at"`
	UpdatedAt          time.Time         `json:"updated_at"`
	SingleFileName     *string           `json:"single_file_name"`
	HasMultipleFiles   bool              `json:"has_multiple_single_files"`
	SuspendedBy        *Account          `json:"suspended_by"`
	SuspendedAt        *time.Time        `json:"suspended_at"`
}

// Account represents a GitHub user or organization account
type Account struct {
	Login             string `json:"login"`
	ID                int64  `json:"id"`
	NodeID           string `json:"node_id"`
	AvatarURL        string `json:"avatar_url"`
	GravatarID       string `json:"gravatar_id"`
	URL              string `json:"url"`
	HTMLURL          string `json:"html_url"`
	FollowersURL     string `json:"followers_url"`
	FollowingURL     string `json:"following_url"`
	GistsURL         string `json:"gists_url"`
	StarredURL       string `json:"starred_url"`
	SubscriptionsURL string `json:"subscriptions_url"`
	OrganizationsURL string `json:"organizations_url"`
	ReposURL         string `json:"repos_url"`
	EventsURL        string `json:"events_url"`
	ReceivedEventsURL string `json:"received_events_url"`
	Type             string `json:"type"`
	SiteAdmin        bool   `json:"site_admin"`
}

// Repository represents a GitHub repository
type Repository struct {
	ID               int64    `json:"id"`
	NodeID          string   `json:"node_id"`
	Name            string   `json:"name"`
	FullName        string   `json:"full_name"`
	Owner           Account  `json:"owner"`
	Private         bool     `json:"private"`
	HTMLURL         string   `json:"html_url"`
	Description     *string  `json:"description"`
	Fork            bool     `json:"fork"`
	URL             string   `json:"url"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
	PushedAt        *time.Time `json:"pushed_at"`
	GitURL          string   `json:"git_url"`
	SSHURL          string   `json:"ssh_url"`
	CloneURL        string   `json:"clone_url"`
	SVNURL          string   `json:"svn_url"`
	Homepage        *string  `json:"homepage"`
	Size            int      `json:"size"`
	StargazersCount int      `json:"stargazers_count"`
	WatchersCount   int      `json:"watchers_count"`
	Language        *string  `json:"language"`
	HasIssues       bool     `json:"has_issues"`
	HasProjects     bool     `json:"has_projects"`
	HasWiki         bool     `json:"has_wiki"`
	HasPages        bool     `json:"has_pages"`
	ForksCount      int      `json:"forks_count"`
	Archived        bool     `json:"archived"`
	Disabled        bool     `json:"disabled"`
	OpenIssuesCount int      `json:"open_issues_count"`
	License         *License `json:"license"`
	AllowForking    bool     `json:"allow_forking"`
	IsTemplate      bool     `json:"is_template"`
	Topics          []string `json:"topics"`
	Visibility      string   `json:"visibility"`
	ForksURL        string   `json:"forks_url"`
	KeysURL         string   `json:"keys_url"`
	CollaboratorsURL string  `json:"collaborators_url"`
	TeamsURL        string   `json:"teams_url"`
	HooksURL        string   `json:"hooks_url"`
	IssueEventsURL  string   `json:"issue_events_url"`
	EventsURL       string   `json:"events_url"`
	AssigneesURL    string   `json:"assignees_url"`
	BranchesURL     string   `json:"branches_url"`
	TagsURL         string   `json:"tags_url"`
	BlobsURL        string   `json:"blobs_url"`
	GitTagsURL      string   `json:"git_tags_url"`
	GitRefsURL      string   `json:"git_refs_url"`
	TreesURL        string   `json:"trees_url"`
	StatusesURL     string   `json:"statuses_url"`
	LanguagesURL    string   `json:"languages_url"`
	StargazersURL   string   `json:"stargazers_url"`
	ContributorsURL string   `json:"contributors_url"`
	SubscribersURL  string   `json:"subscribers_url"`
	SubscriptionURL string   `json:"subscription_url"`
	CommitsURL      string   `json:"commits_url"`
	GitCommitsURL   string   `json:"git_commits_url"`
	CommentsURL     string   `json:"comments_url"`
	IssueCommentURL string   `json:"issue_comment_url"`
	ContentsURL     string   `json:"contents_url"`
	CompareURL      string   `json:"compare_url"`
	MergesURL       string   `json:"merges_url"`
	ArchiveURL      string   `json:"archive_url"`
	DownloadsURL    string   `json:"downloads_url"`
	IssuesURL       string   `json:"issues_url"`
	PullsURL        string   `json:"pulls_url"`
	MilestonesURL   string   `json:"milestones_url"`
	NotificationsURL string  `json:"notifications_url"`
	LabelsURL       string   `json:"labels_url"`
	ReleasesURL     string   `json:"releases_url"`
	DeploymentsURL  string   `json:"deployments_url"`
	DefaultBranch   string   `json:"default_branch"`
}

// License represents a GitHub repository license
type License struct {
	Key    string `json:"key"`
	Name   string `json:"name"`
	SPDXID string `json:"spdx_id"`
	URL    string `json:"url"`
	NodeID string `json:"node_id"`
}

// parseRSAPrivateKey parses an RSA private key from PEM format
func parseRSAPrivateKey(pemData string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(pemData))
	if block == nil {
		return nil, fmt.Errorf("failed to decode PEM block")
	}

	switch block.Type {
	case "RSA PRIVATE KEY":
		return x509.ParsePKCS1PrivateKey(block.Bytes)
	case "PRIVATE KEY":
		key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
		if err != nil {
			return nil, err
		}
		if rsaKey, ok := key.(*rsa.PrivateKey); ok {
			return rsaKey, nil
		}
		return nil, fmt.Errorf("private key is not RSA")
	default:
		return nil, fmt.Errorf("unsupported private key type: %s", block.Type)
	}
}

// IsConfigured returns true if the service has valid configuration
func (s *GitHubAppService) IsConfigured() bool {
	return s.appID != "" && s.privateKey != nil
}