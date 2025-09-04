package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/GLINCKER/glinrdock/internal/dockerx"
	"github.com/GLINCKER/glinrdock/internal/events"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockServiceStore implements ServiceStore for testing
type MockServiceStore struct {
	mock.Mock
}

func (m *MockServiceStore) CreateService(ctx context.Context, projectID int64, spec store.ServiceSpec) (store.Service, error) {
	args := m.Called(ctx, projectID, spec)
	return args.Get(0).(store.Service), args.Error(1)
}

func (m *MockServiceStore) ListServices(ctx context.Context, projectID int64) ([]store.Service, error) {
	args := m.Called(ctx, projectID)
	return args.Get(0).([]store.Service), args.Error(1)
}

func (m *MockServiceStore) GetService(ctx context.Context, id int64) (store.Service, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(store.Service), args.Error(1)
}

func (m *MockServiceStore) UpdateService(ctx context.Context, id int64, updates store.Service) error {
	args := m.Called(ctx, id, updates)
	return args.Error(0)
}

func (m *MockServiceStore) DeleteService(ctx context.Context, id int64) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockServiceStore) GetProject(ctx context.Context, id int64) (store.Project, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(store.Project), args.Error(1)
}

func (m *MockServiceStore) GetServiceNetwork(ctx context.Context, serviceID int64) (store.ServiceNetwork, error) {
	args := m.Called(ctx, serviceID)
	return args.Get(0).(store.ServiceNetwork), args.Error(1)
}

func (m *MockServiceStore) CreateServiceLinks(ctx context.Context, serviceID int64, targetIDs []int64) error {
	args := m.Called(ctx, serviceID, targetIDs)
	return args.Error(0)
}

func (m *MockServiceStore) GetServiceLinks(ctx context.Context, serviceID int64) ([]store.LinkedService, error) {
	args := m.Called(ctx, serviceID)
	return args.Get(0).([]store.LinkedService), args.Error(1)
}

// MockDockerEngine implements DockerEngine for testing
type MockDockerEngine struct {
	mock.Mock
}

func (m *MockDockerEngine) Pull(ctx context.Context, image string) error {
	args := m.Called(ctx, image)
	return args.Error(0)
}

func (m *MockDockerEngine) Create(ctx context.Context, name string, spec dockerx.ContainerSpec, labels map[string]string) (string, error) {
	args := m.Called(ctx, name, spec, labels)
	return args.String(0), args.Error(1)
}

func (m *MockDockerEngine) Remove(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockDockerEngine) Start(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockDockerEngine) Stop(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockDockerEngine) Restart(ctx context.Context, id string) error {
	args := m.Called(ctx, id)
	return args.Error(0)
}

func (m *MockDockerEngine) Logs(ctx context.Context, id string, follow bool) (io.ReadCloser, error) {
	args := m.Called(ctx, id, follow)
	return args.Get(0).(io.ReadCloser), args.Error(1)
}

func (m *MockDockerEngine) Stats(ctx context.Context, id string) (<-chan dockerx.ContainerStats, <-chan error) {
	args := m.Called(ctx, id)
	return args.Get(0).(<-chan dockerx.ContainerStats), args.Get(1).(<-chan error)
}

func (m *MockDockerEngine) Inspect(ctx context.Context, containerID string) (dockerx.ContainerStatus, error) {
	args := m.Called(ctx, containerID)
	return args.Get(0).(dockerx.ContainerStatus), args.Error(1)
}

func setupServiceTestServer(t *testing.T, serviceStore ServiceStore, dockerEngine DockerEngine, eventCache *events.EventCache) *gin.Engine {
	gin.SetMode(gin.TestMode)

	dockerClient := dockerx.NewMockClient()
	handlers := NewHandlers(dockerClient, nil, nil, serviceStore, nil, dockerEngine, nil, nil, nil, nil, nil, nil, nil, nil, eventCache)

	r := gin.New()
	
	// Add routes without authentication middleware for testing
	v1 := r.Group("/v1")
	{
		projects := v1.Group("/projects")
		{
			projects.POST("/:id/services", handlers.CreateService)
			projects.GET("/:id/services", handlers.ListServices)
		}
		services := v1.Group("/services")
		{
			services.GET("/:id", handlers.GetService)
			services.DELETE("/:id", handlers.DeleteService)
			services.GET("/:id/network", handlers.GetServiceNetwork)
			services.GET("/:id/links", handlers.GetServiceLinks)
			services.POST("/:id/links", handlers.UpdateServiceLinks)
		}
	}

	return r
}

func TestCreateService(t *testing.T) {
	mockStore := &MockServiceStore{}
	mockEngine := &MockDockerEngine{}
	
	// Mock project exists
	project := store.Project{ID: 1, Name: "test-project"}
	mockStore.On("GetProject", mock.Anything, int64(1)).Return(project, nil)
	
	// Mock successful image pull
	mockEngine.On("Pull", mock.Anything, "nginx:alpine").Return(nil)
	
	// Mock service creation
	expectedService := store.Service{
		ID:        1,
		ProjectID: 1,
		Name:      "api",
		Image:     "nginx:alpine",
		Env:       map[string]string{"ENV": "test"},
		Ports:     []store.PortMap{{Container: 8080, Host: 8081}},
	}
	serviceSpec := store.ServiceSpec{
		Name:  "api",
		Image: "nginx:alpine", 
		Env:   map[string]string{"ENV": "test"},
		Ports: []store.PortMap{{Container: 8080, Host: 8081}},
	}
	mockStore.On("CreateService", mock.Anything, int64(1), serviceSpec).Return(expectedService, nil)
	
	// Mock container creation
	mockEngine.On("Create", mock.Anything, "glinr_1_api", mock.AnythingOfType("dockerx.ContainerSpec"), mock.AnythingOfType("map[string]string")).Return("container-id", nil)

	r := setupServiceTestServer(t, mockStore, mockEngine, nil)

	// Create request
	reqBody := map[string]interface{}{
		"name":  "api",
		"image": "nginx:alpine",
		"env":   map[string]string{"ENV": "test"},
		"ports": []map[string]int{{"container": 8080, "host": 8081}},
	}
	jsonBody, _ := json.Marshal(reqBody)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/projects/1/services", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer test-token")

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var response store.Service
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "api", response.Name)
	assert.Equal(t, "nginx:alpine", response.Image)

	mockStore.AssertExpectations(t)
	mockEngine.AssertExpectations(t)
}

func TestListServices(t *testing.T) {
	mockStore := &MockServiceStore{}
	
	expectedServices := []store.Service{
		{ID: 1, ProjectID: 1, Name: "api", Image: "nginx"},
		{ID: 2, ProjectID: 1, Name: "worker", Image: "alpine"},
	}
	mockStore.On("ListServices", mock.Anything, int64(1)).Return(expectedServices, nil)

	r := setupServiceTestServer(t, mockStore, nil, nil)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/projects/1/services", nil)
	req.Header.Set("Authorization", "Bearer test-token")

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string][]store.Service
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Len(t, response["services"], 2)

	mockStore.AssertExpectations(t)
}

func TestGetService(t *testing.T) {
	mockStore := &MockServiceStore{}
	
	expectedService := store.Service{
		ID: 1, ProjectID: 1, Name: "api", Image: "nginx",
	}
	mockStore.On("GetService", mock.Anything, int64(1)).Return(expectedService, nil)

	r := setupServiceTestServer(t, mockStore, nil, nil)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/services/1", nil)
	req.Header.Set("Authorization", "Bearer test-token")

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response store.Service
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "api", response.Name)

	mockStore.AssertExpectations(t)
}

func TestDeleteService(t *testing.T) {
	mockStore := &MockServiceStore{}
	mockEngine := &MockDockerEngine{}
	
	service := store.Service{ID: 1, ProjectID: 1, Name: "api"}
	mockStore.On("GetService", mock.Anything, int64(1)).Return(service, nil)
	mockEngine.On("Remove", mock.Anything, "glinr_1_api").Return(nil)
	mockStore.On("DeleteService", mock.Anything, int64(1)).Return(nil)

	r := setupServiceTestServer(t, mockStore, mockEngine, nil)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("DELETE", "/v1/services/1", nil)
	req.Header.Set("Authorization", "Bearer test-token")

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]string
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "service deleted successfully", response["message"])

	mockStore.AssertExpectations(t)
	mockEngine.AssertExpectations(t)
}

func TestServiceValidation(t *testing.T) {
	mockStore := &MockServiceStore{}
	r := setupServiceTestServer(t, mockStore, nil, nil)

	t.Run("InvalidProjectID", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/v1/projects/invalid/services", nil)
		req.Header.Set("Authorization", "Bearer test-token")

		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
		assert.Contains(t, w.Body.String(), "invalid project ID")
	})

	t.Run("MissingName", func(t *testing.T) {
		reqBody := map[string]interface{}{
			"image": "nginx",
		}
		jsonBody, _ := json.Marshal(reqBody)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/v1/projects/1/services", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer test-token")

		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
		assert.Contains(t, w.Body.String(), "error")
	})
}

// Test status functionality with EventCache
func TestListServicesWithStatus(t *testing.T) {
	mockStore := &MockServiceStore{}
	
	// Create mock services
	expectedServices := []store.Service{
		{ID: 1, ProjectID: 1, Name: "api", Image: "nginx"},
		{ID: 2, ProjectID: 1, Name: "worker", Image: "alpine"},
	}
	mockStore.On("ListServices", mock.Anything, int64(1)).Return(expectedServices, nil)

	// Create event cache with service states
	eventCache := events.NewEventCache()
	// Add service states to cache
	eventCache.UpdateServiceState(1, "container-1", "glinr_1_api", "running")
	eventCache.UpdateServiceState(2, "container-2", "glinr_1_worker", "stopped")

	r := setupServiceTestServer(t, mockStore, nil, eventCache)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/projects/1/services", nil)
	req.Header.Set("Authorization", "Bearer test-token")

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string][]store.Service
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Len(t, response["services"], 2)
	
	// Verify status was populated from event cache
	services := response["services"]
	for _, service := range services {
		if service.ID == 1 {
			assert.Equal(t, "running", service.Status)
		} else if service.ID == 2 {
			assert.Equal(t, "stopped", service.Status)
		}
	}

	mockStore.AssertExpectations(t)
}

func TestGetServiceWithStatus(t *testing.T) {
	mockStore := &MockServiceStore{}
	
	expectedService := store.Service{
		ID: 1, ProjectID: 1, Name: "api", Image: "nginx",
	}
	mockStore.On("GetService", mock.Anything, int64(1)).Return(expectedService, nil)

	// Create event cache with service state
	eventCache := events.NewEventCache()
	eventCache.UpdateServiceState(1, "container-1", "glinr_1_api", "running")

	r := setupServiceTestServer(t, mockStore, nil, eventCache)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/services/1", nil)
	req.Header.Set("Authorization", "Bearer test-token")

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response store.Service
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "api", response.Name)
	assert.Equal(t, "running", response.Status) // Status populated from cache

	mockStore.AssertExpectations(t)
}

func TestServicesWithoutEventCache(t *testing.T) {
	mockStore := &MockServiceStore{}
	
	expectedServices := []store.Service{
		{ID: 1, ProjectID: 1, Name: "api", Image: "nginx"},
	}
	mockStore.On("ListServices", mock.Anything, int64(1)).Return(expectedServices, nil)

	// Pass nil event cache
	r := setupServiceTestServer(t, mockStore, nil, nil)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/projects/1/services", nil)
	req.Header.Set("Authorization", "Bearer test-token")

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string][]store.Service
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Len(t, response["services"], 1)
	
	// Status should be empty when no event cache
	services := response["services"]
	assert.Equal(t, "", services[0].Status)

	mockStore.AssertExpectations(t)
}

func TestServiceStatusDefaultsToStopped(t *testing.T) {
	mockStore := &MockServiceStore{}
	
	expectedServices := []store.Service{
		{ID: 999, ProjectID: 1, Name: "unknown", Image: "nginx"}, // Service not in cache
	}
	mockStore.On("ListServices", mock.Anything, int64(1)).Return(expectedServices, nil)

	// Create event cache but don't add the service
	eventCache := events.NewEventCache()

	r := setupServiceTestServer(t, mockStore, nil, eventCache)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/projects/1/services", nil)
	req.Header.Set("Authorization", "Bearer test-token")

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string][]store.Service
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Len(t, response["services"], 1)
	
	// Status should default to "stopped" when service not found in cache
	services := response["services"]
	assert.Equal(t, "stopped", services[0].Status)

	mockStore.AssertExpectations(t)
}

// Networking feature tests

func TestGetServiceNetwork(t *testing.T) {
	mockStore := &MockServiceStore{}
	
	expectedNetwork := store.ServiceNetwork{
		ServiceID: 1,
		ServiceName: "api",
		Alias: "svc-test-project-api",
		ProjectName: "test-project",
		InternalPorts: []store.InternalPortMapping{
			{Port: 8080, Protocol: "tcp"},
			{Port: 9090, Protocol: "tcp"},
		},
		NetworkName: "glinr_default",
		Hints: map[string]string{
			"DNS": "svc-test-project-api:8080",
			"curl": "curl http://svc-test-project-api:8080/health",
		},
	}
	mockStore.On("GetServiceNetwork", mock.Anything, int64(1)).Return(expectedNetwork, nil)

	r := setupServiceTestServer(t, mockStore, nil, nil)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/services/1/network", nil)
	req.Header.Set("Authorization", "Bearer test-token")

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response store.ServiceNetwork
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "svc-test-project-api", response.Alias)
	assert.Equal(t, "glinr_default", response.NetworkName)
	assert.Len(t, response.InternalPorts, 2)
	assert.Equal(t, "svc-test-project-api:8080", response.Hints["DNS"])

	mockStore.AssertExpectations(t)
}

func TestGetServiceNetworkNotFound(t *testing.T) {
	mockStore := &MockServiceStore{}
	
	mockStore.On("GetServiceNetwork", mock.Anything, int64(999)).Return(store.ServiceNetwork{}, assert.AnError)

	r := setupServiceTestServer(t, mockStore, nil, nil)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/services/999/network", nil)
	req.Header.Set("Authorization", "Bearer test-token")

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusInternalServerError, w.Code)

	mockStore.AssertExpectations(t)
}

func TestGetServiceLinks(t *testing.T) {
	mockStore := &MockServiceStore{}
	
	expectedLinks := []store.LinkedService{
		{ID: 2, Name: "database", Alias: "svc-test-project-database"},
		{ID: 3, Name: "redis", Alias: "svc-test-project-redis"},
	}
	mockStore.On("GetServiceLinks", mock.Anything, int64(1)).Return(expectedLinks, nil)

	r := setupServiceTestServer(t, mockStore, nil, nil)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/v1/services/1/links", nil)
	req.Header.Set("Authorization", "Bearer test-token")

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string][]store.LinkedService
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Len(t, response["links"], 2)
	assert.Equal(t, "database", response["links"][0].Name)
	assert.Equal(t, "svc-test-project-database", response["links"][0].Alias)

	mockStore.AssertExpectations(t)
}

func TestUpdateServiceLinks(t *testing.T) {
	mockStore := &MockServiceStore{}
	
	targetIDs := []int64{2, 3}
	mockStore.On("CreateServiceLinks", mock.Anything, int64(1), targetIDs).Return(nil)

	r := setupServiceTestServer(t, mockStore, nil, nil)

	reqBody := map[string]interface{}{
		"target_ids": []int{2, 3},
	}
	jsonBody, _ := json.Marshal(reqBody)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/v1/services/1/links", bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer test-token")

	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]string
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "service links updated successfully", response["message"])

	mockStore.AssertExpectations(t)
}

func TestUpdateServiceLinksValidation(t *testing.T) {
	mockStore := &MockServiceStore{}
	r := setupServiceTestServer(t, mockStore, nil, nil)

	t.Run("InvalidServiceID", func(t *testing.T) {
		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/v1/services/invalid/links", nil)
		req.Header.Set("Authorization", "Bearer test-token")

		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
		assert.Contains(t, w.Body.String(), "invalid service ID")
	})

	t.Run("MissingTargetIDs", func(t *testing.T) {
		reqBody := map[string]interface{}{}
		jsonBody, _ := json.Marshal(reqBody)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/v1/services/1/links", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer test-token")

		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
	})

	t.Run("EmptyTargetIDs", func(t *testing.T) {
		reqBody := map[string]interface{}{
			"target_ids": []int{},
		}
		jsonBody, _ := json.Marshal(reqBody)

		w := httptest.NewRecorder()
		req, _ := http.NewRequest("POST", "/v1/services/1/links", bytes.NewBuffer(jsonBody))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer test-token")

		r.ServeHTTP(w, req)

		assert.Equal(t, http.StatusBadRequest, w.Code)
		assert.Contains(t, w.Body.String(), "target_ids cannot be empty")
	})
}

// Test service alias generation
func TestServiceAliasGeneration(t *testing.T) {
	tests := []struct {
		projectName string
		serviceName string
		expected    string
	}{
		{"My Project", "Web API", "svc-my-project-web-api"},
		{"test-project", "database", "svc-test-project-database"},
		{"UPPER CASE", "service-name", "svc-upper-case-service-name"},
		{"project with spaces", "service_with_underscores", "svc-project-with-spaces-service-with-underscores"},
		{"", "service", "svc--service"}, // Edge case
		{"project", "", "svc-project-"}, // Edge case
	}

	for _, tt := range tests {
		t.Run(fmt.Sprintf("%s_%s", tt.projectName, tt.serviceName), func(t *testing.T) {
			alias := store.GenerateServiceAlias(tt.projectName, tt.serviceName)
			assert.Equal(t, tt.expected, alias)
		})
	}
}

// Test slug generation utility
func TestSlugGeneration(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"Simple Name", "simple-name"},
		{"test-project", "test-project"},
		{"UPPERCASE", "uppercase"},
		{"multiple   spaces", "multiple-spaces"},
		{"special!@#$%chars", "specialchars"},
		{"under_score", "under-score"},
		{"", ""},
		{"123numbers", "123numbers"},
		{"Mix3d-Ch4rs_And Numbers!", "mix3d-ch4rs-and-numbers"},
	}

	for _, tt := range tests {
		t.Run(tt.input, func(t *testing.T) {
			slug := store.GenerateSlug(tt.input)
			assert.Equal(t, tt.expected, slug)
		})
	}
}