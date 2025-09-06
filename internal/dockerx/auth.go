package dockerx

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"

	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/docker/docker/api/types/registry"
	"github.com/docker/docker/client"
)

// AuthConfig represents Docker registry authentication configuration
type AuthConfig struct {
	Username string `json:"username,omitempty"`
	Password string `json:"password,omitempty"`
	Auth     string `json:"auth,omitempty"`
	Email    string `json:"email,omitempty"`
}

// DockerAuthHelper provides Docker registry authentication functionality
type DockerAuthHelper struct {
	client        *client.Client
	registryStore *store.RegistryStore
}

// NewDockerAuthHelper creates a new Docker authentication helper
func NewDockerAuthHelper(dockerClient *client.Client, registryStore *store.RegistryStore) *DockerAuthHelper {
	return &DockerAuthHelper{
		client:        dockerClient,
		registryStore: registryStore,
	}
}

// GetAuthConfigForImage returns authentication config for a given image
func (d *DockerAuthHelper) GetAuthConfigForImage(registryID string) (*registry.AuthConfig, error) {
	if registryID == "" {
		return nil, nil // No auth needed
	}

	creds, err := d.registryStore.GetRegistryCredentials(registryID)
	if err != nil {
		return nil, fmt.Errorf("failed to get registry credentials: %w", err)
	}

	return &registry.AuthConfig{
		Username:      creds.Username,
		Password:      creds.Password,
		ServerAddress: creds.Server,
	}, nil
}

// GetRegistryAuth returns base64-encoded auth for Docker API
func (d *DockerAuthHelper) GetRegistryAuth(registryID string) (string, error) {
	if registryID == "" {
		return "", nil // No auth needed
	}

	authConfig, err := d.GetAuthConfigForImage(registryID)
	if err != nil {
		return "", err
	}

	if authConfig == nil {
		return "", nil
	}

	// Encode auth config as base64 JSON for Docker API
	authConfigBytes, err := json.Marshal(authConfig)
	if err != nil {
		return "", fmt.Errorf("failed to marshal auth config: %w", err)
	}

	return base64.URLEncoding.EncodeToString(authConfigBytes), nil
}

// AuthenticateRegistry performs Docker login for a registry
func (d *DockerAuthHelper) AuthenticateRegistry(ctx context.Context, registryID string) error {
	if registryID == "" {
		return nil // No auth needed
	}

	authConfig, err := d.GetAuthConfigForImage(registryID)
	if err != nil {
		return err
	}

	if authConfig == nil {
		return nil
	}

	// Test authentication by attempting a login
	_, err = d.client.RegistryLogin(ctx, *authConfig)
	if err != nil {
		return fmt.Errorf("registry authentication failed: %w", err)
	}

	return nil
}

// GetImageRegistry extracts registry server from image name
func GetImageRegistry(imageName string) string {
	// Handle Docker Hub special cases
	if imageName == "" {
		return ""
	}

	// Split image name to find registry
	parts := parseImageName(imageName)
	if parts.Registry == "" || parts.Registry == "docker.io" {
		return "registry-1.docker.io" // Docker Hub registry
	}

	return parts.Registry
}

// ImageParts represents parsed image components
type ImageParts struct {
	Registry   string
	Namespace  string
	Repository string
	Tag        string
}

// parseImageName parses a Docker image name into components
func parseImageName(imageName string) ImageParts {
	parts := ImageParts{Tag: "latest"}

	// Handle tag
	if tagIndex := findLastIndex(imageName, ':'); tagIndex != -1 {
		// Check if this is actually a port (registry with port)
		slashAfterColon := findIndex(imageName[tagIndex+1:], '/')
		if slashAfterColon == -1 { // No slash after colon, it's a tag
			parts.Tag = imageName[tagIndex+1:]
			imageName = imageName[:tagIndex]
		}
	}

	// Handle registry
	if registryIndex := findIndex(imageName, '/'); registryIndex != -1 {
		possibleRegistry := imageName[:registryIndex]

		// Check if this looks like a registry (contains . or :)
		if findIndex(possibleRegistry, '.') != -1 || findIndex(possibleRegistry, ':') != -1 {
			parts.Registry = possibleRegistry
			imageName = imageName[registryIndex+1:]
		}
	}

	// Handle namespace/repository
	if namespaceIndex := findIndex(imageName, '/'); namespaceIndex != -1 {
		parts.Namespace = imageName[:namespaceIndex]
		parts.Repository = imageName[namespaceIndex+1:]
	} else {
		parts.Repository = imageName
	}

	return parts
}

// Helper functions for string manipulation
func findIndex(s string, ch rune) int {
	for i, c := range s {
		if c == ch {
			return i
		}
	}
	return -1
}

func findLastIndex(s string, ch rune) int {
	for i := len(s) - 1; i >= 0; i-- {
		if rune(s[i]) == ch {
			return i
		}
	}
	return -1
}
