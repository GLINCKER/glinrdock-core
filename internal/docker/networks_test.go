package docker

import (
	"context"
	"testing"
	
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/network"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
)

// MockDockerClient is a mock implementation of the Docker client interface
type MockDockerClient struct {
	mock.Mock
}

func (m *MockDockerClient) NetworkList(ctx context.Context, options network.ListOptions) ([]network.Inspect, error) {
	args := m.Called(ctx, options)
	return args.Get(0).([]network.Inspect), args.Error(1)
}

func (m *MockDockerClient) NetworkCreate(ctx context.Context, name string, options network.CreateOptions) (network.CreateResponse, error) {
	args := m.Called(ctx, name, options)
	return args.Get(0).(network.CreateResponse), args.Error(1)
}

func (m *MockDockerClient) NetworkConnect(ctx context.Context, networkID, containerID string, config *network.EndpointSettings) error {
	args := m.Called(ctx, networkID, containerID, config)
	return args.Error(0)
}

func (m *MockDockerClient) NetworkDisconnect(ctx context.Context, networkID, containerID string, force bool) error {
	args := m.Called(ctx, networkID, containerID, force)
	return args.Error(0)
}

func (m *MockDockerClient) NetworkRemove(ctx context.Context, networkID string) error {
	args := m.Called(ctx, networkID)
	return args.Error(0)
}

func (m *MockDockerClient) ContainerInspect(ctx context.Context, containerID string) (container.InspectResponse, error) {
	args := m.Called(ctx, containerID)
	return args.Get(0).(container.InspectResponse), args.Error(1)
}

func TestEnsureProjectNetwork_NewNetwork(t *testing.T) {
	ctx := context.Background()
	projectID := int64(123)
	networkName := "glinr_proj_123"
	
	mockClient := &MockDockerClient{}
	nm := &NetworkManager{client: mockClient}
	
	// Mock that the network doesn't exist
	mockClient.On("NetworkList", ctx, mock.MatchedBy(func(opts network.ListOptions) bool {
		return opts.Filters.Get("name")[0] == networkName
	})).Return([]network.Inspect{}, nil)
	
	// Mock successful network creation
	createResponse := network.CreateResponse{
		ID:      "net-123",
		Warning: "",
	}
	mockClient.On("NetworkCreate", ctx, networkName, mock.MatchedBy(func(opts network.CreateOptions) bool {
		return opts.Driver == "bridge" &&
			opts.Labels["owner"] == "glinrdock" &&
			opts.Labels["project_id"] == "123"
	})).Return(createResponse, nil)
	
	// Test
	id, existed, err := nm.EnsureProjectNetwork(ctx, networkName, projectID)
	
	// Assertions
	assert.NoError(t, err)
	assert.False(t, existed)
	assert.Equal(t, "net-123", id)
	
	mockClient.AssertExpectations(t)
}

func TestEnsureProjectNetwork_ExistingNetwork(t *testing.T) {
	ctx := context.Background()
	projectID := int64(123)
	networkName := "glinr_proj_123"
	
	mockClient := &MockDockerClient{}
	nm := &NetworkManager{client: mockClient}
	
	// Mock that the network already exists with our labels
	existingNetwork := network.Inspect{
		ID:   "net-existing",
		Name: networkName,
		Labels: map[string]string{
			"owner":      "glinrdock",
			"project_id": "123",
		},
	}
	mockClient.On("NetworkList", ctx, mock.MatchedBy(func(opts network.ListOptions) bool {
		return opts.Filters.Get("name")[0] == networkName
	})).Return([]network.Inspect{existingNetwork}, nil)
	
	// Test
	id, existed, err := nm.EnsureProjectNetwork(ctx, networkName, projectID)
	
	// Assertions
	assert.NoError(t, err)
	assert.True(t, existed)
	assert.Equal(t, "net-existing", id)
	
	mockClient.AssertExpectations(t)
}

func TestEnsureProjectNetwork_ExistingUnmanagedNetwork(t *testing.T) {
	ctx := context.Background()
	projectID := int64(123)
	networkName := "glinr_proj_123"
	
	mockClient := &MockDockerClient{}
	nm := &NetworkManager{client: mockClient}
	
	// Mock that the network exists but is not managed by glinrdock
	existingNetwork := network.Inspect{
		ID:   "net-unmanaged",
		Name: networkName,
		Labels: map[string]string{
			"owner": "someone-else",
		},
	}
	mockClient.On("NetworkList", ctx, mock.MatchedBy(func(opts network.ListOptions) bool {
		return opts.Filters.Get("name")[0] == networkName
	})).Return([]network.Inspect{existingNetwork}, nil)
	
	// Test
	id, existed, err := nm.EnsureProjectNetwork(ctx, networkName, projectID)
	
	// Assertions
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not managed by glinrdock")
	assert.False(t, existed)
	assert.Empty(t, id)
	
	mockClient.AssertExpectations(t)
}

func TestConnectContainerToNetwork(t *testing.T) {
	ctx := context.Background()
	containerID := "container-123"
	networkName := "glinr_proj_1"
	aliases := []string{"web", "web.myproject.local"}
	
	mockClient := &MockDockerClient{}
	nm := &NetworkManager{client: mockClient}
	
	// Mock successful connection
	mockClient.On("NetworkConnect", ctx, networkName, containerID, mock.MatchedBy(func(settings *network.EndpointSettings) bool {
		return len(settings.Aliases) == 2 &&
			settings.Aliases[0] == "web" &&
			settings.Aliases[1] == "web.myproject.local"
	})).Return(nil)
	
	// Test
	err := nm.ConnectContainerToNetwork(ctx, containerID, networkName, aliases)
	
	// Assertions
	assert.NoError(t, err)
	
	mockClient.AssertExpectations(t)
}

func TestGenerateServiceAliases(t *testing.T) {
	tests := []struct {
		name        string
		serviceName string
		projectSlug string
		expected    []string
	}{
		{
			name:        "simple names",
			serviceName: "web",
			projectSlug: "myproject",
			expected:    []string{"web", "web.myproject.local"},
		},
		{
			name:        "empty project slug",
			serviceName: "api",
			projectSlug: "",
			expected:    []string{"api"},
		},
		{
			name:        "complex names",
			serviceName: "user-service",
			projectSlug: "e-commerce",
			expected:    []string{"user-service", "user-service.e-commerce.local"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := GenerateServiceAliases(tt.serviceName, tt.projectSlug)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestRemoveProjectNetwork(t *testing.T) {
	ctx := context.Background()
	networkName := "glinr_proj_123"
	
	mockClient := &MockDockerClient{}
	nm := &NetworkManager{client: mockClient}
	
	// Mock that the network exists and is managed by glinrdock
	existingNetwork := network.Inspect{
		ID:   "net-123",
		Name: networkName,
		Labels: map[string]string{
			"owner":      "glinrdock",
			"project_id": "123",
		},
	}
	mockClient.On("NetworkList", ctx, mock.MatchedBy(func(opts network.ListOptions) bool {
		return opts.Filters.Get("name")[0] == networkName
	})).Return([]network.Inspect{existingNetwork}, nil)
	
	// Mock successful removal
	mockClient.On("NetworkRemove", ctx, "net-123").Return(nil)
	
	// Test
	err := nm.RemoveProjectNetwork(ctx, networkName)
	
	// Assertions
	assert.NoError(t, err)
	
	mockClient.AssertExpectations(t)
}

func TestRemoveProjectNetwork_UnmanagedNetwork(t *testing.T) {
	ctx := context.Background()
	networkName := "glinr_proj_123"
	
	mockClient := &MockDockerClient{}
	nm := &NetworkManager{client: mockClient}
	
	// Mock that the network exists but is not managed by glinrdock
	existingNetwork := network.Inspect{
		ID:   "net-unmanaged",
		Name: networkName,
		Labels: map[string]string{
			"owner": "someone-else",
		},
	}
	mockClient.On("NetworkList", ctx, mock.MatchedBy(func(opts network.ListOptions) bool {
		return opts.Filters.Get("name")[0] == networkName
	})).Return([]network.Inspect{existingNetwork}, nil)
	
	// Test
	err := nm.RemoveProjectNetwork(ctx, networkName)
	
	// Assertions
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not managed by glinrdock")
	
	// Should not call NetworkRemove
	mockClient.AssertExpectations(t)
}

func TestRemoveProjectNetwork_NonexistentNetwork(t *testing.T) {
	ctx := context.Background()
	networkName := "glinr_proj_123"
	
	mockClient := &MockDockerClient{}
	nm := &NetworkManager{client: mockClient}
	
	// Mock that the network doesn't exist
	mockClient.On("NetworkList", ctx, mock.MatchedBy(func(opts network.ListOptions) bool {
		return opts.Filters.Get("name")[0] == networkName
	})).Return([]network.Inspect{}, nil)
	
	// Test
	err := nm.RemoveProjectNetwork(ctx, networkName)
	
	// Assertions - should succeed (network already doesn't exist)
	assert.NoError(t, err)
	
	mockClient.AssertExpectations(t)
}