package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/GLINCKER/glinrdock/internal/health"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
)

// Mock store for health tests
type MockHealthServiceStore struct {
	services map[int64]store.Service
	unlocked bool
}

func (m *MockHealthServiceStore) GetService(ctx context.Context, id int64) (store.Service, error) {
	if service, exists := m.services[id]; exists {
		return service, nil
	}
	return store.Service{}, store.ErrNotFound
}

func (m *MockHealthServiceStore) ListRoutes(ctx context.Context, serviceID int64) ([]store.Route, error) {
	return []store.Route{}, nil
}

func (m *MockHealthServiceStore) UpdateServiceHealth(ctx context.Context, serviceID int64, healthStatus string) error {
	if service, exists := m.services[serviceID]; exists {
		service.HealthStatus = healthStatus
		service.LastProbeAt = timePtr(time.Now())
		m.services[serviceID] = service
	}
	return nil
}

func (m *MockHealthServiceStore) UpdateServiceRestart(ctx context.Context, serviceID int64, exitCode int, restartCount int, windowStart *time.Time) error {
	return nil
}

func (m *MockHealthServiceStore) UpdateServiceState(ctx context.Context, serviceID int64, desiredState string, crashLooping bool) error {
	return nil
}

func (m *MockHealthServiceStore) UnlockService(ctx context.Context, serviceID int64) error {
	if service, exists := m.services[serviceID]; exists {
		service.CrashLooping = false
		service.DesiredState = store.ServiceStateRunning
		m.services[serviceID] = service
		m.unlocked = true
	}
	return nil
}

func TestUnlockService(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Create mock store with a crash-looping service
	mockStore := &MockHealthServiceStore{
		services: map[int64]store.Service{
			1: {
				ID:           1,
				Name:         "test-service",
				CrashLooping: true,
				DesiredState: store.ServiceStateStopped,
			},
		},
	}

	// Create handlers
	handlers := &Handlers{
		serviceStore: mockStore,
		auditLogger:  nil, // Skip audit for testing
	}

	// Test unlocking crash-looping service
	t.Run("unlock crash-looping service", func(t *testing.T) {
		router := gin.New()
		router.POST("/services/:id/unlock", handlers.UnlockService)

		req := httptest.NewRequest("POST", "/services/1/unlock", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", w.Code)
		}

		if !mockStore.unlocked {
			t.Error("Service was not unlocked")
		}

		var response map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
			t.Fatal("Failed to parse response:", err)
		}

		if response["message"] != "service unlocked successfully" {
			t.Errorf("Expected success message, got %s", response["message"])
		}
	})

	// Test unlocking non-crash-looping service
	t.Run("unlock non-crash-looping service", func(t *testing.T) {
		mockStore.services[2] = store.Service{
			ID:           2,
			Name:         "healthy-service",
			CrashLooping: false,
			DesiredState: store.ServiceStateRunning,
		}

		router := gin.New()
		router.POST("/services/:id/unlock", handlers.UnlockService)

		req := httptest.NewRequest("POST", "/services/2/unlock", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Errorf("Expected status 400, got %d", w.Code)
		}
	})

	// Test unlocking non-existent service
	t.Run("unlock non-existent service", func(t *testing.T) {
		router := gin.New()
		router.POST("/services/:id/unlock", handlers.UnlockService)

		req := httptest.NewRequest("POST", "/services/999/unlock", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("Expected status 404, got %d", w.Code)
		}
	})
}

func TestRunHealthCheck(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Create mock store with a running service
	mockStore := &MockHealthServiceStore{
		services: map[int64]store.Service{
			1: {
				ID:           1,
				Name:         "test-service",
				Status:       store.ServiceStateRunning,
				DesiredState: store.ServiceStateRunning,
				HealthStatus: store.HealthStatusUnknown,
				HealthPath:   stringPtr("/health"),
				Ports:        []store.PortMap{{Container: 8080, Host: 8080}},
			},
		},
	}

	// Create mock health prober that always returns OK
	mockProber := &MockHealthProber{
		healthStatus: store.HealthStatusOK,
	}

	handlers := &Handlers{
		serviceStore: mockStore,
		auditLogger:  nil,
	}

	// Override getHealthProber to return mock
	originalGetHealthProber := handlers.getHealthProber
	handlers.getHealthProber = func() *health.Prober {
		return (*health.Prober)(mockProber) // Type conversion for testing
	}
	defer func() { handlers.getHealthProber = originalGetHealthProber }()

	t.Run("run health check on existing service", func(t *testing.T) {
		router := gin.New()
		router.POST("/services/:id/health-check/run", handlers.RunHealthCheck)

		req := httptest.NewRequest("POST", "/services/1/health-check/run", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", w.Code)
		}

		var response map[string]interface{}
		if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
			t.Fatal("Failed to parse response:", err)
		}

		if response["message"] != "health check completed" {
			t.Errorf("Expected completion message, got %s", response["message"])
		}

		if response["health_status"] != store.HealthStatusOK {
			t.Errorf("Expected health status %s, got %s", store.HealthStatusOK, response["health_status"])
		}
	})

	t.Run("run health check on non-existent service", func(t *testing.T) {
		router := gin.New()
		router.POST("/services/:id/health-check/run", handlers.RunHealthCheck)

		req := httptest.NewRequest("POST", "/services/999/health-check/run", nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusNotFound {
			t.Errorf("Expected status 404, got %d", w.Code)
		}
	})
}

// Mock health prober for testing
type MockHealthProber struct {
	healthStatus string
	shouldError  bool
}

func (m *MockHealthProber) ProbeAndUpdate(ctx context.Context, serviceID int64) error {
	if m.shouldError {
		return store.ErrNotFound
	}
	// Mock implementation would update service health status
	return nil
}

func TestGetServiceWithHealthFields(t *testing.T) {
	gin.SetMode(gin.TestMode)

	now := time.Now()
	mockStore := &MockHealthServiceStore{
		services: map[int64]store.Service{
			1: {
				ID:              1,
				Name:            "test-service",
				Status:          store.ServiceStateRunning,
				HealthStatus:    store.HealthStatusOK,
				LastProbeAt:     &now,
				CrashLooping:    false,
				DesiredState:    store.ServiceStateRunning,
				RestartCount:    2,
				LastExitCode:    intPtr(0),
				RestartWindowAt: &now,
			},
		},
	}

	handlers := &Handlers{
		serviceStore: mockStore,
	}

	router := gin.New()
	router.GET("/services/:id", handlers.GetService)

	req := httptest.NewRequest("GET", "/services/1", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d", w.Code)
	}

	var response ServiceDetailResponse
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatal("Failed to parse response:", err)
	}

	// Verify health and crash-loop fields are included
	if response.HealthStatus != store.HealthStatusOK {
		t.Errorf("Expected health status %s, got %s", store.HealthStatusOK, response.HealthStatus)
	}

	if response.CrashLooping {
		t.Error("Expected crash_looping to be false")
	}

	if response.DesiredState != store.ServiceStateRunning {
		t.Errorf("Expected desired state %s, got %s", store.ServiceStateRunning, response.DesiredState)
	}

	if response.RestartCount != 2 {
		t.Errorf("Expected restart count 2, got %d", response.RestartCount)
	}

	if response.LastExitCode == nil || *response.LastExitCode != 0 {
		t.Errorf("Expected last exit code 0, got %v", response.LastExitCode)
	}
}

// Helper functions (stringPtr is defined in github_admin_test.go)
func intPtr(i int) *int {
	return &i
}

func timePtr(t time.Time) *time.Time {
	return &t
}