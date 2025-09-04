package web

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/GLINCKER/glinrdock/internal/events"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// Mock implementations
type MockProjectStore struct {
	mock.Mock
}

func (m *MockProjectStore) ListProjects(ctx context.Context) ([]store.Project, error) {
	args := m.Called(ctx)
	return args.Get(0).([]store.Project), args.Error(1)
}

func (m *MockProjectStore) GetProject(ctx context.Context, id int64) (store.Project, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(store.Project), args.Error(1)
}

type MockServiceStore struct {
	mock.Mock
}

func (m *MockServiceStore) ListServices(ctx context.Context, projectID int64) ([]store.Service, error) {
	args := m.Called(ctx, projectID)
	return args.Get(0).([]store.Service), args.Error(1)
}

func (m *MockServiceStore) GetService(ctx context.Context, id int64) (store.Service, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(store.Service), args.Error(1)
}

type MockRouteStore struct {
	mock.Mock
}

func (m *MockRouteStore) ListRoutes(ctx context.Context, serviceID int64) ([]store.Route, error) {
	args := m.Called(ctx, serviceID)
	return args.Get(0).([]store.Route), args.Error(1)
}

func (m *MockRouteStore) GetAllRoutes(ctx context.Context) ([]store.Route, error) {
	args := m.Called(ctx)
	return args.Get(0).([]store.Route), args.Error(1)
}

func TestProjectsList(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mockProjectStore := &MockProjectStore{}
	mockServiceStore := &MockServiceStore{}
	
	projects := []store.Project{
		{ID: 1, Name: "test-project"},
		{ID: 2, Name: "another-project"},
	}
	
	services := []store.Service{
		{ID: 1, ProjectID: 1, Name: "api"},
		{ID: 2, ProjectID: 1, Name: "web"},
	}

	mockProjectStore.On("ListProjects", mock.Anything).Return(projects, nil)
	mockServiceStore.On("ListServices", mock.Anything, int64(1)).Return(services, nil)
	mockServiceStore.On("ListServices", mock.Anything, int64(2)).Return([]store.Service{}, nil)

	// Create minimal handlers just for this test
	handlers := &WebHandlers{
		projectStore: mockProjectStore,
		serviceStore: mockServiceStore,
	}

	r := gin.New()
	r.GET("/api/projects", handlers.ProjectsList)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/projects", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "test-project")
	assert.Contains(t, w.Body.String(), "2 services")

	mockProjectStore.AssertExpectations(t)
	mockServiceStore.AssertExpectations(t)
}

func TestSystemStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)

	eventCache := events.NewEventCache()
	eventCache.UpdateServiceState(1, "container1", "glinr_1_api", "running")
	eventCache.UpdateServiceState(2, "container2", "glinr_2_web", "stopped")

	mockRouteStore := &MockRouteStore{}
	mockRouteStore.On("GetAllRoutes", mock.Anything).Return([]store.Route{}, nil)

	handlers := &WebHandlers{
		eventCache: eventCache,
		routeStore: mockRouteStore,
	}

	r := gin.New()
	r.GET("/api/system-status", handlers.SystemStatus)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/api/system-status", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.Contains(t, w.Body.String(), "1 running")
}

func TestWebHandlersCreation(t *testing.T) {
	// Test template loading with non-existent directory
	_, err := NewWebHandlers("/non/existent/path", nil, nil, nil, nil)
	require.Error(t, err)
}