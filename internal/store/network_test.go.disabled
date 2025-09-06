package store

import (
	"context"
	"testing"
)

func TestGenerateProjectNetworkName(t *testing.T) {
	tests := []struct {
		name      string
		projectID int64
		expected  string
	}{
		{"project 1", 1, "glinr_proj_1"},
		{"project 42", 42, "glinr_proj_42"},
		{"project 123", 123, "glinr_proj_123"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GenerateProjectNetworkName(tt.projectID)
			if result != tt.expected {
				t.Errorf("GenerateProjectNetworkName(%d) = %q, expected %q", tt.projectID, result, tt.expected)
			}
		})
	}
}

func TestGenerateServiceAliases(t *testing.T) {
	tests := []struct {
		name        string
		projectName string
		serviceName string
		expected    []string
	}{
		{
			name:        "simple names",
			projectName: "myapp",
			serviceName: "web",
			expected:    []string{"web", "web.myapp.local"},
		},
		{
			name:        "names with spaces",
			projectName: "My Project",
			serviceName: "Web Service",
			expected:    []string{"web-service", "web-service.my-project.local"},
		},
		{
			name:        "names with special characters",
			projectName: "api_backend",
			serviceName: "redis_cache",
			expected:    []string{"redis-cache", "redis-cache.api-backend.local"},
		},
		{
			name:        "uppercase names",
			projectName: "BACKEND",
			serviceName: "DATABASE",
			expected:    []string{"database", "database.backend.local"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GenerateServiceAliases(tt.projectName, tt.serviceName)
			if len(result) != len(tt.expected) {
				t.Errorf("GenerateServiceAliases(%q, %q) returned %d aliases, expected %d",
					tt.projectName, tt.serviceName, len(result), len(tt.expected))
				return
			}

			for i, alias := range result {
				if alias != tt.expected[i] {
					t.Errorf("GenerateServiceAliases(%q, %q)[%d] = %q, expected %q",
						tt.projectName, tt.serviceName, i, alias, tt.expected[i])
				}
			}
		})
	}
}

func TestGenerateSlug(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"simple string", "hello", "hello"},
		{"with spaces", "hello world", "hello-world"},
		{"mixed case", "Hello World", "hello-world"},
		{"with underscores", "hello_world", "hello-world"},
		{"with special chars", "hello@world!", "hello-world"},
		{"multiple spaces", "hello   world", "hello-world"},
		{"leading/trailing spaces", "  hello world  ", "hello-world"},
		{"numbers", "app2024", "app2024"},
		{"only special chars", "!@#$%", "unnamed"},
		{"empty string", "", "unnamed"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GenerateSlug(tt.input)
			if result != tt.expected {
				t.Errorf("GenerateSlug(%q) = %q, expected %q", tt.input, result, tt.expected)
			}
		})
	}
}

func TestStore_CreateProject_WithNetworkName(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()

	ctx := context.Background()

	// Create a project and verify network_name is set
	project, err := store.CreateProject(ctx, "test-project")
	if err != nil {
		t.Fatalf("CreateProject failed: %v", err)
	}

	if project.NetworkName == nil {
		t.Error("Expected network_name to be set, got nil")
	} else {
		expected := GenerateProjectNetworkName(project.ID)
		if *project.NetworkName != expected {
			t.Errorf("Expected network_name %q, got %q", expected, *project.NetworkName)
		}
	}

	// Verify the project can be retrieved with network_name
	retrieved, err := store.GetProject(ctx, project.ID)
	if err != nil {
		t.Fatalf("GetProject failed: %v", err)
	}

	if retrieved.NetworkName == nil {
		t.Error("Expected retrieved project to have network_name set, got nil")
	} else if *retrieved.NetworkName != *project.NetworkName {
		t.Errorf("Expected retrieved network_name %q, got %q", *project.NetworkName, *retrieved.NetworkName)
	}
}

func TestStore_GetServiceNetwork(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()

	ctx := context.Background()

	// Create a project
	project, err := store.CreateProject(ctx, "test-project")
	if err != nil {
		t.Fatalf("CreateProject failed: %v", err)
	}

	// Create a service with ports
	spec := ServiceSpec{
		Name:  "web-service",
		Image: "nginx:latest",
		Ports: []PortMap{{Host: 8080, Container: 80}},
	}

	service, err := store.CreateService(ctx, project.ID, spec)
	if err != nil {
		t.Fatalf("CreateService failed: %v", err)
	}

	// Get network information for the service
	network, err := store.GetServiceNetwork(ctx, service.ID)
	if err != nil {
		t.Fatalf("GetServiceNetwork failed: %v", err)
	}

	// Verify network information
	if network.ProjectNetwork == "" {
		t.Error("Expected project network name to be set")
	}

	if len(network.Aliases) == 0 {
		t.Error("Expected aliases to be set")
	}

	if len(network.PortsInternal) == 0 {
		t.Error("Expected internal ports to be populated")
	} else {
		if network.PortsInternal[0].Container != 80 {
			t.Errorf("Expected internal port 80, got %d", network.PortsInternal[0].Container)
		}
		if network.PortsInternal[0].Protocol != "tcp" {
			t.Errorf("Expected protocol 'tcp', got %q", network.PortsInternal[0].Protocol)
		}
	}
}
