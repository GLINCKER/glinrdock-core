package api

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/GLINCKER/glinrdock/internal/crypto"
	"github.com/GLINCKER/glinrdock/internal/store"
)

func TestSettingsService_GitHubOAuthConfig(t *testing.T) {
	// Mock store for testing
	store := &MockSettingsStore{
		settings: make(map[string]*store.Setting),
	}
	
	service := NewSettingsService(store)
	ctx := context.Background()

	t.Run("get empty config", func(t *testing.T) {
		config, err := service.getGitHubOAuthConfig(ctx)
		if err != store.ErrNotFound {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
		if config != nil {
			t.Errorf("expected nil config, got %v", config)
		}
	})

	t.Run("save and retrieve PKCE config", func(t *testing.T) {
		config := &store.GitHubOAuthConfig{
			Mode:     "pkce",
			ClientID: "test-client-id",
		}

		err := service.updateGitHubOAuthConfig(ctx, config)
		if err != nil {
			t.Fatalf("failed to update config: %v", err)
		}

		retrieved, err := service.getGitHubOAuthConfig(ctx)
		if err != nil {
			t.Fatalf("failed to get config: %v", err)
		}

		if retrieved.Mode != "pkce" {
			t.Errorf("expected mode 'pkce', got '%s'", retrieved.Mode)
		}
		if retrieved.ClientID != "test-client-id" {
			t.Errorf("expected client_id 'test-client-id', got '%s'", retrieved.ClientID)
		}
		if retrieved.HasSecret {
			t.Error("expected HasSecret to be false for PKCE mode")
		}
	})

	t.Run("save and retrieve confidential config", func(t *testing.T) {
		config := &store.GitHubOAuthConfig{
			Mode:         "confidential",
			ClientID:     "test-client-id-2",
			ClientSecret: "test-client-secret",
		}

		err := service.updateGitHubOAuthConfig(ctx, config)
		if err != nil {
			t.Fatalf("failed to update config: %v", err)
		}

		retrieved, err := service.getGitHubOAuthConfig(ctx)
		if err != nil {
			t.Fatalf("failed to get config: %v", err)
		}

		if retrieved.Mode != "confidential" {
			t.Errorf("expected mode 'confidential', got '%s'", retrieved.Mode)
		}
		if retrieved.ClientID != "test-client-id-2" {
			t.Errorf("expected client_id 'test-client-id-2', got '%s'", retrieved.ClientID)
		}
		if !retrieved.HasSecret {
			t.Error("expected HasSecret to be true for confidential mode")
		}
	})

	t.Run("validation errors", func(t *testing.T) {
		tests := []struct {
			name   string
			config *store.GitHubOAuthConfig
			error  string
		}{
			{
				name: "invalid mode",
				config: &store.GitHubOAuthConfig{
					Mode:     "invalid",
					ClientID: "test",
				},
				error: "invalid OAuth mode",
			},
			{
				name: "missing client_id for pkce",
				config: &store.GitHubOAuthConfig{
					Mode: "pkce",
				},
				error: "client_id is required",
			},
			{
				name: "missing client_secret for confidential",
				config: &store.GitHubOAuthConfig{
					Mode:     "confidential",
					ClientID: "test",
				},
				error: "client_secret is required",
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				err := service.updateGitHubOAuthConfig(ctx, tt.config)
				if err == nil {
					t.Fatal("expected error, got none")
				}
				// Just check that error contains expected substring
				if !containsString(err.Error(), tt.error) {
					t.Errorf("expected error containing '%s', got '%v'", tt.error, err)
				}
			})
		}
	})
}

func TestSettingsService_GitHubAppConfig(t *testing.T) {
	store := &MockSettingsStore{
		settings: make(map[string]*store.Setting),
	}
	
	service := NewSettingsService(store)
	ctx := context.Background()

	t.Run("save and retrieve app config", func(t *testing.T) {
		privateKey := `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA2Z3QX0TKDX/5Z6WhQy9t1/1+Lp3y6e7wq2z5Y8bZ3tY5X/8+
H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+
-----END RSA PRIVATE KEY-----`

		config := &store.GitHubAppConfig{
			AppID:         "123456",
			PrivateKeyPEM: privateKey,
		}

		err := service.updateGitHubAppConfig(ctx, config)
		if err != nil {
			t.Fatalf("failed to update config: %v", err)
		}

		retrieved, err := service.getGitHubAppConfig(ctx)
		if err != nil {
			t.Fatalf("failed to get config: %v", err)
		}

		if retrieved.AppID != "123456" {
			t.Errorf("expected app_id '123456', got '%s'", retrieved.AppID)
		}
		if !retrieved.HasPrivateKey {
			t.Error("expected HasPrivateKey to be true")
		}
		if !retrieved.Installed {
			t.Error("expected Installed to be true when both app_id and private key are set")
		}
	})

	t.Run("validation errors", func(t *testing.T) {
		tests := []struct {
			name   string
			config *store.GitHubAppConfig
			error  string
		}{
			{
				name: "invalid app_id",
				config: &store.GitHubAppConfig{
					AppID: "not-numeric",
				},
				error: "invalid app_id",
			},
			{
				name: "invalid private key",
				config: &store.GitHubAppConfig{
					AppID:         "123456",
					PrivateKeyPEM: "invalid-pem-data",
				},
				error: "invalid private key",
			},
		}

		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				err := service.updateGitHubAppConfig(ctx, tt.config)
				if err == nil {
					t.Fatal("expected error, got none")
				}
				if !containsString(err.Error(), tt.error) {
					t.Errorf("expected error containing '%s', got '%v'", tt.error, err)
				}
			})
		}
	})
}

func TestValidateRSAPrivateKey(t *testing.T) {
	tests := []struct {
		name    string
		pem     string
		wantErr bool
	}{
		{
			name:    "empty pem",
			pem:     "",
			wantErr: true,
		},
		{
			name:    "invalid pem data",
			pem:     "not-a-pem-file",
			wantErr: true,
		},
		{
			name:    "unsupported key type",
			pem:     "-----BEGIN PUBLIC KEY-----\ndata\n-----END PUBLIC KEY-----",
			wantErr: true,
		},
		// Note: We can't test valid keys without a real RSA private key
		// In real tests, you would use test fixtures with valid keys
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateRSAPrivateKey(tt.pem)
			if (err != nil) != tt.wantErr {
				t.Errorf("validateRSAPrivateKey() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestSettingsService_IntegrationsConfig(t *testing.T) {
	store := &MockSettingsStore{
		settings: make(map[string]*store.Setting),
	}
	
	service := NewSettingsService(&MockStore{settings: store.settings})
	ctx := context.Background()

	t.Run("get empty integrations config", func(t *testing.T) {
		config, err := service.GetIntegrationsConfig(ctx)
		if err != nil {
			t.Fatalf("expected no error for empty config, got %v", err)
		}
		if config == nil {
			t.Fatal("expected config object, got nil")
		}
		if config.GitHubOAuth != nil {
			t.Error("expected nil GitHub OAuth config")
		}
		if config.GitHubApp != nil {
			t.Error("expected nil GitHub App config")
		}
	})

	t.Run("update and retrieve integrations config", func(t *testing.T) {
		updateConfig := &store.IntegrationsConfig{
			GitHubOAuth: &store.GitHubOAuthConfig{
				Mode:     "pkce",
				ClientID: "test-oauth-client",
			},
			GitHubApp: &store.GitHubAppConfig{
				AppID:         "654321",
				PrivateKeyPEM: testValidRSAKey(),
			},
		}

		err := service.UpdateIntegrationsConfig(ctx, updateConfig)
		if err != nil {
			t.Fatalf("failed to update integrations config: %v", err)
		}

		retrieved, err := service.GetIntegrationsConfig(ctx)
		if err != nil {
			t.Fatalf("failed to get integrations config: %v", err)
		}

		if retrieved.GitHubOAuth == nil {
			t.Fatal("expected GitHub OAuth config")
		}
		if retrieved.GitHubOAuth.Mode != "pkce" {
			t.Errorf("expected OAuth mode 'pkce', got '%s'", retrieved.GitHubOAuth.Mode)
		}
		if retrieved.GitHubOAuth.ClientID != "test-oauth-client" {
			t.Errorf("expected OAuth client_id 'test-oauth-client', got '%s'", retrieved.GitHubOAuth.ClientID)
		}

		if retrieved.GitHubApp == nil {
			t.Fatal("expected GitHub App config")
		}
		if retrieved.GitHubApp.AppID != "654321" {
			t.Errorf("expected App ID '654321', got '%s'", retrieved.GitHubApp.AppID)
		}
		if !retrieved.GitHubApp.HasPrivateKey {
			t.Error("expected HasPrivateKey to be true")
		}
		if !retrieved.GitHubApp.Installed {
			t.Error("expected Installed to be true")
		}
	})
}

func TestSettingsService_SecretRetrieval(t *testing.T) {
	// Skip if no master key available
	_, err := crypto.LoadMasterKeyFromEnv()
	if err != nil {
		t.Skipf("Skipping secret tests: %v", err)
	}

	store := &MockStore{
		settings: make(map[string]*store.Setting),
	}
	
	service := NewSettingsService(store)
	ctx := context.Background()

	t.Run("oauth secret storage and retrieval", func(t *testing.T) {
		config := &store.GitHubOAuthConfig{
			Mode:         "confidential",
			ClientID:     "test-client",
			ClientSecret: "super-secret-value",
		}

		err := service.updateGitHubOAuthConfig(ctx, config)
		if err != nil {
			t.Fatalf("failed to update OAuth config: %v", err)
		}

		secret, err := service.GetGitHubOAuthSecret(ctx)
		if err != nil {
			t.Fatalf("failed to get OAuth secret: %v", err)
		}

		if secret != "super-secret-value" {
			t.Errorf("expected secret 'super-secret-value', got '%s'", secret)
		}
	})

	t.Run("app private key storage and retrieval", func(t *testing.T) {
		config := &store.GitHubAppConfig{
			AppID:         "123456",
			PrivateKeyPEM: testValidRSAKey(),
		}

		err := service.updateGitHubAppConfig(ctx, config)
		if err != nil {
			t.Fatalf("failed to update App config: %v", err)
		}

		privateKey, err := service.GetGitHubAppPrivateKey(ctx)
		if err != nil {
			t.Fatalf("failed to get App private key: %v", err)
		}

		if privateKey != testValidRSAKey() {
			t.Error("retrieved private key does not match stored key")
		}
	})

	t.Run("secret not found errors", func(t *testing.T) {
		emptyStore := &MockStore{settings: make(map[string]*store.Setting)}
		emptyService := NewSettingsService(emptyStore)

		_, err := emptyService.GetGitHubOAuthSecret(ctx)
		if err != store.ErrNotFound {
			t.Errorf("expected ErrNotFound, got %v", err)
		}

		_, err = emptyService.GetGitHubAppPrivateKey(ctx)
		if err != store.ErrNotFound {
			t.Errorf("expected ErrNotFound, got %v", err)
		}
	})
}

func testValidRSAKey() string {
	return `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA2Z3QX0TKDX/5Z6WhQy9t1/1+Lp3y6e7wq2z5Y8bZ3tY5X/8+
H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+
H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+
H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+
H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+
H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+
H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+
H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+
QIDAQABAoIBAE8Z8Z3QX0TKDX/5Z6WhQy9t1/1+Lp3y6e7wq2z5Y8bZ3tY5X/8+
H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+
H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+
H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+
H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+
H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+
H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+
ECgYEA8Z3QX0TKDX/5Z6WhQy9t1/1+Lp3y6e7wq2z5Y8bZ3tY5X/8+H5z5Y3vZ
3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ
3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ
3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8CgYEA5Z6W
hQy9t1/1+Lp3y6e7wq2z5Y8bZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+
H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+
H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+
H5z5Y3vZ3tY5X/8CgYEAwKCAQEA2Z3QX0TKDX/5Z6WhQy9t1/1+Lp3y6e7wq2z5
Y8bZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5
Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5
Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5
Y3vZ3tY5X/8CgYEAhQy9t1/1+Lp3y6e7wq2z5Y8bZ3tY5X/8+H5z5Y3vZ3tY5X/8+
H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+
H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+
H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8CgYAZ3QX0TKDX/5Z6
WhQy9t1/1+Lp3y6e7wq2z5Y8bZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+
H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+
H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+
H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+H5z5Y3vZ3tY5X/8+
-----END RSA PRIVATE KEY-----`
}

// MockStore implements the store interface for testing
type MockStore struct {
	settings map[string]*store.Setting
}

func (m *MockStore) GetSetting(ctx context.Context, key string) (*store.Setting, error) {
	if setting, exists := m.settings[key]; exists {
		return setting, nil
	}
	return nil, store.ErrNotFound
}

func (m *MockStore) SetSetting(ctx context.Context, key string, value []byte, isSecret bool) error {
	m.settings[key] = &store.Setting{
		Key:      key,
		Value:    value,
		IsSecret: isSecret,
	}
	return nil
}

func (m *MockStore) DeleteSetting(ctx context.Context, key string) error {
	delete(m.settings, key)
	return nil
}

// MockSettingsStore implements a simple in-memory store for testing
type MockSettingsStore struct {
	settings map[string]*store.Setting
}

func (m *MockSettingsStore) GetSetting(ctx context.Context, key string) (*store.Setting, error) {
	if setting, exists := m.settings[key]; exists {
		return setting, nil
	}
	return nil, store.ErrNotFound
}

func (m *MockSettingsStore) SetSetting(ctx context.Context, key string, value []byte, isSecret bool) error {
	m.settings[key] = &store.Setting{
		Key:      key,
		Value:    value,
		IsSecret: isSecret,
	}
	return nil
}

func (m *MockSettingsStore) DeleteSetting(ctx context.Context, key string) error {
	delete(m.settings, key)
	return nil
}

func (m *MockSettingsStore) ListSettings(ctx context.Context) ([]store.Setting, error) {
	var settings []store.Setting
	for _, setting := range m.settings {
		settings = append(settings, *setting)
	}
	return settings, nil
}

// Helper function to check if a string contains a substring
func containsString(s, substr string) bool {
	return len(s) >= len(substr) && (s == substr || len(substr) == 0 || 
		(len(s) > len(substr) && (s[:len(substr)] == substr || s[len(s)-len(substr):] == substr || 
			func() bool {
				for i := 0; i <= len(s)-len(substr); i++ {
					if s[i:i+len(substr)] == substr {
						return true
					}
				}
				return false
			}())))
}