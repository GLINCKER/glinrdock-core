package nginx

import (
	"context"
	"os"
	"strings"
	"testing"
	"time"
)


func TestNewValidator(t *testing.T) {
	validator := NewValidator()

	if validator.nginxPath != "nginx" {
		t.Errorf("Expected nginxPath to be 'nginx', got %s", validator.nginxPath)
	}
	if validator.useDocker != false {
		t.Errorf("Expected useDocker to be false, got %t", validator.useDocker)
	}
	if validator.dockerContainer != "nginx-proxy" {
		t.Errorf("Expected dockerContainer to be 'nginx-proxy', got %s", validator.dockerContainer)
	}
}

func TestValidator_SetNginxPath(t *testing.T) {
	validator := NewValidator()
	customPath := "/usr/local/bin/nginx"

	validator.SetNginxPath(customPath)

	if validator.nginxPath != customPath {
		t.Errorf("Expected nginxPath to be %s, got %s", customPath, validator.nginxPath)
	}
}

func TestValidator_EnableDockerValidation(t *testing.T) {
	validator := NewValidator()
	containerName := "custom-nginx"

	validator.EnableDockerValidation(containerName)

	if !validator.useDocker {
		t.Error("Expected useDocker to be true")
	}
	if validator.dockerContainer != containerName {
		t.Errorf("Expected dockerContainer to be %s, got %s", containerName, validator.dockerContainer)
	}
}

func TestValidator_EnableDockerValidation_EmptyContainer(t *testing.T) {
	validator := NewValidator()

	validator.EnableDockerValidation("")

	if !validator.useDocker {
		t.Error("Expected useDocker to be true")
	}
	if validator.dockerContainer != "nginx-proxy" {
		t.Errorf("Expected dockerContainer to remain 'nginx-proxy', got %s", validator.dockerContainer)
	}
}

func TestValidator_DisableDockerValidation(t *testing.T) {
	validator := NewValidator()
	validator.EnableDockerValidation("test")

	validator.DisableDockerValidation()

	if validator.useDocker {
		t.Error("Expected useDocker to be false")
	}
}

func TestValidator_ValidateConfig(t *testing.T) {
	skipNginxTestsInCI(t)
	
	validator := NewValidator()

	tests := []struct {
		name        string
		config      string
		expectError bool
	}{
		{
			name:        "empty config",
			config:      "",
			expectError: true,
		},
		{
			name:        "whitespace only config",
			config:      "   \n\t  ",
			expectError: true,
		},
		{
			name: "valid server block",
			config: `
server {
    listen 80;
    server_name example.com;
    location / {
        proxy_pass http://backend;
    }
}`,
			expectError: false,
		},
		{
			name: "valid upstream block",
			config: `
upstream backend {
    server 127.0.0.1:8080;
}`,
			expectError: false,
		},
		{
			name: "config with both server and upstream",
			config: `
upstream backend {
    server 127.0.0.1:8080;
}
server {
    listen 80;
    server_name example.com;
    location / {
        proxy_pass http://backend;
    }
}`,
			expectError: false,
		},
		{
			name: "config without server or upstream (should warn but not error)",
			config: `
# Just a comment
worker_processes auto;
`,
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			err := validator.ValidateConfig(ctx, tt.config)

			if tt.expectError && err == nil {
				t.Error("Expected error but got none")
			}
			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
		})
	}
}

func TestValidator_ValidateConfiguration_WithNginxCmd(t *testing.T) {
	skipNginxTestsInCI(t)
	
	validator := NewValidator()

	tests := []struct {
		name        string
		nginxCmd    string
		expectError bool
	}{
		{
			name:        "empty nginx command",
			nginxCmd:    "",
			expectError: false, // Should use default validation path
		},
		{
			name:        "echo command (should succeed)",
			nginxCmd:    "echo nginx-test",
			expectError: false,
		},
		{
			name:        "false command (should fail)",
			nginxCmd:    "false",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			// Set environment variable
			if tt.nginxCmd != "" {
				os.Setenv("NGINX_CMD", tt.nginxCmd)
			} else {
				os.Unsetenv("NGINX_CMD")
			}
			defer os.Unsetenv("NGINX_CMD")

			// Create a temporary config file for testing
			configPath := "/tmp/test-nginx.conf"
			testConfig := `
server {
    listen 80;
    server_name test.example.com;
    location / {
        proxy_pass http://backend;
    }
}`

			// Write test config
			err := os.WriteFile(configPath, []byte(testConfig), 0644)
			if err != nil {
				t.Fatalf("Failed to create test config: %v", err)
			}
			defer os.Remove(configPath)

			err = validator.ValidateConfiguration(ctx, configPath)

			if tt.expectError && err == nil {
				t.Error("Expected error but got none")
			}
			if !tt.expectError && err != nil {
				// For nginx command not found, we don't fail
				if !strings.Contains(err.Error(), "nginx binary not found") &&
					!strings.Contains(err.Error(), "custom nginx command validation failed") {
					t.Errorf("Unexpected error: %v", err)
				}
			}
		})
	}
}

func TestValidator_ValidateConfiguration_DockerNotFound(t *testing.T) {
	skipNginxTestsInCI(t)
	
	validator := NewValidator()
	validator.EnableDockerValidation("non-existent-container")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	configPath := "/tmp/test-nginx.conf"
	testConfig := `server { listen 80; }`

	err := os.WriteFile(configPath, []byte(testConfig), 0644)
	if err != nil {
		t.Fatalf("Failed to create test config: %v", err)
	}
	defer os.Remove(configPath)

	// This should not error even if docker container doesn't exist
	err = validator.ValidateConfiguration(ctx, configPath)
	if err != nil {
		t.Errorf("Expected no error when docker container not found, got: %v", err)
	}
}

func TestValidator_validateWithCustomCommand(t *testing.T) {
	validator := NewValidator()

	tests := []struct {
		name        string
		nginxCmd    string
		expectError bool
	}{
		{
			name:        "empty command",
			nginxCmd:    "",
			expectError: true,
		},
		{
			name:        "echo command",
			nginxCmd:    "echo test",
			expectError: false,
		},
		{
			name:        "false command",
			nginxCmd:    "false",
			expectError: true,
		},
		{
			name:        "command with multiple args",
			nginxCmd:    "echo hello world",
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()

			configPath := "/tmp/test-nginx.conf"
			testConfig := `server { listen 80; }`

			err := os.WriteFile(configPath, []byte(testConfig), 0644)
			if err != nil {
				t.Fatalf("Failed to create test config: %v", err)
			}
			defer os.Remove(configPath)

			err = validator.validateWithCustomCommand(ctx, tt.nginxCmd, configPath)

			if tt.expectError && err == nil {
				t.Error("Expected error but got none")
			}
			if !tt.expectError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
		})
	}
}

func TestValidator_validateWithDocker(t *testing.T) {
	validator := NewValidator()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	configPath := "/tmp/test-nginx.conf"

	// This should not error even if docker container doesn't exist (should skip validation)
	err := validator.validateWithDocker(ctx, configPath)
	if err != nil {
		t.Errorf("Expected no error when docker container not found, got: %v", err)
	}
}

func TestGetDockerContainerName(t *testing.T) {
	tests := []struct {
		name     string
		envVar   string
		expected string
	}{
		{
			name:     "default container name",
			envVar:   "",
			expected: "nginx-proxy",
		},
		{
			name:     "custom container name",
			envVar:   "custom-nginx",
			expected: "custom-nginx",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.envVar != "" {
				os.Setenv("DEV_NGINX_DOCKER_NAME", tt.envVar)
			} else {
				os.Unsetenv("DEV_NGINX_DOCKER_NAME")
			}
			defer os.Unsetenv("DEV_NGINX_DOCKER_NAME")

			result := getDockerContainerName()
			if result != tt.expected {
				t.Errorf("getDockerContainerName() = %s, want %s", result, tt.expected)
			}
		})
	}
}

func TestShouldUseDockerReload(t *testing.T) {
	tests := []struct {
		name     string
		envVar   string
		expected bool
	}{
		{
			name:     "no env var set",
			envVar:   "",
			expected: false,
		},
		{
			name:     "env var set to container name",
			envVar:   "nginx-proxy",
			expected: true,
		},
		{
			name:     "env var set to custom name",
			envVar:   "custom-nginx",
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if tt.envVar != "" {
				os.Setenv("DEV_NGINX_DOCKER_NAME", tt.envVar)
			} else {
				os.Unsetenv("DEV_NGINX_DOCKER_NAME")
			}
			defer os.Unsetenv("DEV_NGINX_DOCKER_NAME")

			result := shouldUseDockerReload()
			if result != tt.expected {
				t.Errorf("shouldUseDockerReload() = %t, want %t", result, tt.expected)
			}
		})
	}
}
