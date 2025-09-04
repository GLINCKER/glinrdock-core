package api

import (
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"strconv"

	"github.com/GLINCKER/glinrdock/internal/crypto"
	"github.com/GLINCKER/glinrdock/internal/store"
)

// Settings keys
const (
	GitHubOAuthConfigKey      = "github.oauth.config"
	GitHubOAuthSecretKey      = "github.oauth.client_secret"
	GitHubAppConfigKey        = "github.app.config"
	GitHubAppPrivateKeyKey    = "github.app.private_key"
	GitHubAppWebhookSecretKey = "github.app.webhook_secret"
)

// SettingsService handles encrypted settings operations
type SettingsService struct {
	store *store.Store
}

// NewSettingsService creates a new settings service
func NewSettingsService(store *store.Store) *SettingsService {
	return &SettingsService{
		store: store,
	}
}

// GetIntegrationsConfig retrieves all integration settings
func (s *SettingsService) GetIntegrationsConfig(ctx context.Context) (*store.IntegrationsConfig, error) {
	config := &store.IntegrationsConfig{}

	// Get GitHub OAuth config
	githubOAuth, err := s.getGitHubOAuthConfig(ctx)
	if err != nil && err != store.ErrNotFound {
		return nil, fmt.Errorf("failed to get GitHub OAuth config: %w", err)
	}
	if githubOAuth != nil {
		config.GitHubOAuth = githubOAuth
	}

	// Get GitHub App config
	githubApp, err := s.getGitHubAppConfig(ctx)
	if err != nil && err != store.ErrNotFound {
		return nil, fmt.Errorf("failed to get GitHub App config: %w", err)
	}
	if githubApp != nil {
		config.GitHubApp = githubApp
	}

	return config, nil
}

// UpdateIntegrationsConfig updates integration settings
func (s *SettingsService) UpdateIntegrationsConfig(ctx context.Context, config *store.IntegrationsConfig) error {
	// Update GitHub OAuth if provided
	if config.GitHubOAuth != nil {
		if err := s.updateGitHubOAuthConfig(ctx, config.GitHubOAuth); err != nil {
			return fmt.Errorf("failed to update GitHub OAuth config: %w", err)
		}
	}

	// Update GitHub App if provided
	if config.GitHubApp != nil {
		if err := s.updateGitHubAppConfig(ctx, config.GitHubApp); err != nil {
			return fmt.Errorf("failed to update GitHub App config: %w", err)
		}
	}

	return nil
}

func (s *SettingsService) getGitHubOAuthConfig(ctx context.Context) (*store.GitHubOAuthConfig, error) {
	setting, err := s.store.GetSetting(ctx, GitHubOAuthConfigKey)
	if err != nil {
		return nil, err
	}

	var config store.GitHubOAuthConfig
	if err := json.Unmarshal(setting.Value, &config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal OAuth config: %w", err)
	}

	// Check if we have a client secret
	if config.Mode == "confidential" {
		_, err := s.store.GetSetting(ctx, GitHubOAuthSecretKey)
		config.HasSecret = err == nil
	}

	return &config, nil
}

func (s *SettingsService) getGitHubAppConfig(ctx context.Context) (*store.GitHubAppConfig, error) {
	setting, err := s.store.GetSetting(ctx, GitHubAppConfigKey)
	if err != nil {
		return nil, err
	}

	var config store.GitHubAppConfig
	if err := json.Unmarshal(setting.Value, &config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal App config: %w", err)
	}

	// Check if we have a private key
	_, err = s.store.GetSetting(ctx, GitHubAppPrivateKeyKey)
	config.HasPrivateKey = err == nil
	
	// Check if we have a webhook secret
	_, err = s.store.GetSetting(ctx, GitHubAppWebhookSecretKey)
	config.HasWebhookSecret = err == nil
	
	config.Installed = config.HasPrivateKey && config.AppID != ""

	return &config, nil
}

func (s *SettingsService) updateGitHubOAuthConfig(ctx context.Context, config *store.GitHubOAuthConfig) error {
	// Validate mode
	if config.Mode != "off" && config.Mode != "pkce" && config.Mode != "confidential" {
		return fmt.Errorf("invalid OAuth mode: %s", config.Mode)
	}

	// Validate client ID requirement
	if config.Mode != "off" && config.ClientID == "" {
		return fmt.Errorf("client_id is required when mode is not 'off'")
	}

	// Validate client secret requirement for confidential mode
	if config.Mode == "confidential" && config.ClientSecret == "" {
		// Check if we already have a secret stored
		_, err := s.store.GetSetting(ctx, GitHubOAuthSecretKey)
		if err == store.ErrNotFound {
			return fmt.Errorf("client_secret is required for confidential mode")
		}
	}

	// Store the config (without secret)
	configToStore := &store.GitHubOAuthConfig{
		Mode:     config.Mode,
		ClientID: config.ClientID,
	}

	configJSON, err := json.Marshal(configToStore)
	if err != nil {
		return fmt.Errorf("failed to marshal OAuth config: %w", err)
	}

	if err := s.store.SetSetting(ctx, GitHubOAuthConfigKey, configJSON, false); err != nil {
		return fmt.Errorf("failed to store OAuth config: %w", err)
	}

	// Store client secret if provided
	if config.ClientSecret != "" {
		secretData, err := s.encryptSecret(config.ClientSecret)
		if err != nil {
			return fmt.Errorf("failed to encrypt client secret: %w", err)
		}

		if err := s.store.SetSetting(ctx, GitHubOAuthSecretKey, secretData, true); err != nil {
			return fmt.Errorf("failed to store client secret: %w", err)
		}
	}

	// If mode is off, remove the secret
	if config.Mode == "off" {
		s.store.DeleteSetting(ctx, GitHubOAuthSecretKey) // Ignore error
	}

	return nil
}

func (s *SettingsService) updateGitHubAppConfig(ctx context.Context, config *store.GitHubAppConfig) error {
	// Validate app ID
	if config.AppID != "" {
		if _, err := strconv.ParseInt(config.AppID, 10, 64); err != nil {
			return fmt.Errorf("invalid app_id: must be numeric")
		}
	}

	// Validate private key PEM if provided
	if config.PrivateKeyPEM != "" {
		if err := validateRSAPrivateKey(config.PrivateKeyPEM); err != nil {
			return fmt.Errorf("invalid private key: %w", err)
		}
	}

	// Store the config (without private key)
	configToStore := &store.GitHubAppConfig{
		AppID: config.AppID,
	}

	configJSON, err := json.Marshal(configToStore)
	if err != nil {
		return fmt.Errorf("failed to marshal App config: %w", err)
	}

	if err := s.store.SetSetting(ctx, GitHubAppConfigKey, configJSON, false); err != nil {
		return fmt.Errorf("failed to store App config: %w", err)
	}

	// Store private key if provided
	if config.PrivateKeyPEM != "" {
		keyData, err := s.encryptSecret(config.PrivateKeyPEM)
		if err != nil {
			return fmt.Errorf("failed to encrypt private key: %w", err)
		}

		if err := s.store.SetSetting(ctx, GitHubAppPrivateKeyKey, keyData, true); err != nil {
			return fmt.Errorf("failed to store private key: %w", err)
		}
	}

	// Store webhook secret if provided
	if config.WebhookSecret != "" {
		secretData, err := s.encryptSecret(config.WebhookSecret)
		if err != nil {
			return fmt.Errorf("failed to encrypt webhook secret: %w", err)
		}

		if err := s.store.SetSetting(ctx, GitHubAppWebhookSecretKey, secretData, true); err != nil {
			return fmt.Errorf("failed to store webhook secret: %w", err)
		}
	}

	return nil
}

// encryptSecret encrypts a secret using the master key
func (s *SettingsService) encryptSecret(secret string) ([]byte, error) {
	masterKey, err := crypto.LoadMasterKeyFromEnv()
	if err != nil {
		return nil, fmt.Errorf("master key not available: %w", err)
	}

	nonce, ciphertext, err := crypto.Encrypt(masterKey, []byte(secret))
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt secret: %w", err)
	}

	// Store nonce + ciphertext together
	result := make([]byte, len(nonce)+len(ciphertext))
	copy(result, nonce)
	copy(result[len(nonce):], ciphertext)

	return result, nil
}

// decryptSecret decrypts a secret using the master key
func (s *SettingsService) decryptSecret(encryptedData []byte) (string, error) {
	masterKey, err := crypto.LoadMasterKeyFromEnv()
	if err != nil {
		return "", fmt.Errorf("master key not available: %w", err)
	}

	// Extract nonce and ciphertext (nonce is first 12 bytes)
	if len(encryptedData) < 12 {
		return "", fmt.Errorf("invalid encrypted data: too short")
	}

	nonce := encryptedData[:12]
	ciphertext := encryptedData[12:]

	plaintext, err := crypto.Decrypt(masterKey, nonce, ciphertext)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt secret: %w", err)
	}

	return string(plaintext), nil
}

// validateRSAPrivateKey validates that the PEM string contains a valid RSA private key
func validateRSAPrivateKey(pemData string) error {
	block, _ := pem.Decode([]byte(pemData))
	if block == nil {
		return fmt.Errorf("failed to decode PEM block")
	}

	switch block.Type {
	case "RSA PRIVATE KEY":
		_, err := x509.ParsePKCS1PrivateKey(block.Bytes)
		return err
	case "PRIVATE KEY":
		key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
		if err != nil {
			return err
		}
		if _, ok := key.(*rsa.PrivateKey); !ok {
			return fmt.Errorf("private key is not RSA")
		}
		return nil
	default:
		return fmt.Errorf("unsupported private key type: %s", block.Type)
	}
}

// GetGitHubOAuthSecret retrieves and decrypts the GitHub OAuth client secret
func (s *SettingsService) GetGitHubOAuthSecret(ctx context.Context) (string, error) {
	setting, err := s.store.GetSetting(ctx, GitHubOAuthSecretKey)
	if err != nil {
		return "", err
	}

	return s.decryptSecret(setting.Value)
}

// GetGitHubAppPrivateKey retrieves and decrypts the GitHub App private key
func (s *SettingsService) GetGitHubAppPrivateKey(ctx context.Context) (string, error) {
	setting, err := s.store.GetSetting(ctx, GitHubAppPrivateKeyKey)
	if err != nil {
		return "", err
	}

	return s.decryptSecret(setting.Value)
}

// GetGitHubAppWebhookSecret retrieves and decrypts the GitHub App webhook secret
func (s *SettingsService) GetGitHubAppWebhookSecret(ctx context.Context) (string, error) {
	setting, err := s.store.GetSetting(ctx, GitHubAppWebhookSecretKey)
	if err != nil {
		return "", err
	}

	return s.decryptSecret(setting.Value)
}