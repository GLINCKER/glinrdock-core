package github

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// Note: InstallationToken, Installation, and Repository types are defined in app.go

// InstallationClient provides access to GitHub API with installation tokens
type InstallationClient struct {
	authenticator  *AppAuthenticator
	installationID int64
	client         *http.Client
}

// NewInstallationClient creates a new client for a specific installation
func NewInstallationClient(authenticator *AppAuthenticator, installationID int64) (*InstallationClient, error) {
	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	return &InstallationClient{
		authenticator:  authenticator,
		installationID: installationID,
		client:         client,
	}, nil
}

// getInstallationToken exchanges JWT for an installation access token
func (c *InstallationClient) getInstallationToken(ctx context.Context) (*InstallationToken, error) {
	jwt, err := c.authenticator.CreateJWT()
	if err != nil {
		return nil, fmt.Errorf("failed to create JWT: %w", err)
	}

	url := fmt.Sprintf("https://api.github.com/app/installations/%d/access_tokens", c.installationID)
	req, err := http.NewRequestWithContext(ctx, "POST", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+jwt)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "GLINR-Dock-App/1.0")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get installation token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return nil, fmt.Errorf("failed to get installation token, status: %d", resp.StatusCode)
	}

	var token InstallationToken
	if err := json.NewDecoder(resp.Body).Decode(&token); err != nil {
		return nil, fmt.Errorf("failed to decode token response: %w", err)
	}

	return &token, nil
}

// CreateAuthenticatedClient creates an HTTP client with installation token authentication
func (c *InstallationClient) CreateAuthenticatedClient(ctx context.Context) (*http.Client, error) {
	token, err := c.getInstallationToken(ctx)
	if err != nil {
		return nil, err
	}

	client := &http.Client{
		Timeout: 30 * time.Second,
		Transport: &installationTokenTransport{
			transport: http.DefaultTransport,
			token:     token.Token,
		},
	}

	return client, nil
}

// GetInstallationRepositories retrieves all repositories accessible to the installation
func (c *InstallationClient) GetInstallationRepositories(ctx context.Context) ([]Repository, error) {
	token, err := c.getInstallationToken(ctx)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("https://api.github.com/installation/repositories")
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "token "+token.Token)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "GLINR-Dock-App/1.0")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get repositories: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get repositories, status: %d", resp.StatusCode)
	}

	var response struct {
		Repositories []Repository `json:"repositories"`
	}
	
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return nil, fmt.Errorf("failed to decode repositories response: %w", err)
	}

	return response.Repositories, nil
}

// installationTokenTransport adds installation token authorization header to all requests
type installationTokenTransport struct {
	transport http.RoundTripper
	token     string
}

func (t *installationTokenTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// Clone the request to avoid modifying the original
	reqCopy := req.Clone(req.Context())
	reqCopy.Header.Set("Authorization", "token "+t.token)
	reqCopy.Header.Set("Accept", "application/vnd.github.v3+json")
	reqCopy.Header.Set("User-Agent", "GLINR-Dock-App/1.0")
	
	return t.transport.RoundTrip(reqCopy)
}

// AppManager handles GitHub App-level operations
type AppManager struct {
	authenticator *AppAuthenticator
	client        *http.Client
}

// NewAppManager creates a new GitHub App manager
func NewAppManager(authenticator *AppAuthenticator) *AppManager {
	return &AppManager{
		authenticator: authenticator,
		client:        &http.Client{Timeout: 30 * time.Second},
	}
}

// GetInstallations retrieves all installations for the GitHub App
func (m *AppManager) GetInstallations(ctx context.Context) ([]Installation, error) {
	jwt, err := m.authenticator.CreateJWT()
	if err != nil {
		return nil, fmt.Errorf("failed to create JWT: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/app/installations", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+jwt)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "GLINR-Dock-App/1.0")

	resp, err := m.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get installations: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get installations, status: %d", resp.StatusCode)
	}

	var installations []Installation
	if err := json.NewDecoder(resp.Body).Decode(&installations); err != nil {
		return nil, fmt.Errorf("failed to decode installations response: %w", err)
	}

	return installations, nil
}

// GetInstallation retrieves a specific installation by ID
func (m *AppManager) GetInstallation(ctx context.Context, installationID int64) (*Installation, error) {
	jwt, err := m.authenticator.CreateJWT()
	if err != nil {
		return nil, fmt.Errorf("failed to create JWT: %w", err)
	}

	url := fmt.Sprintf("https://api.github.com/app/installations/%d", installationID)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+jwt)
	req.Header.Set("Accept", "application/vnd.github.v3+json")
	req.Header.Set("User-Agent", "GLINR-Dock-App/1.0")

	resp, err := m.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get installation: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to get installation, status: %d", resp.StatusCode)
	}

	var installation Installation
	if err := json.NewDecoder(resp.Body).Decode(&installation); err != nil {
		return nil, fmt.Errorf("failed to decode installation response: %w", err)
	}

	return &installation, nil
}