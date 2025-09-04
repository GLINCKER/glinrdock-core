package health

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/GLINCKER/glinrdock/internal/store"
)

// Mock store for testing
type MockServiceStore struct {
	services []store.Service
	routes   []store.Route
}

func (m *MockServiceStore) GetService(ctx context.Context, id int64) (store.Service, error) {
	for _, service := range m.services {
		if service.ID == id {
			return service, nil
		}
	}
	return store.Service{}, store.ErrNotFound
}

func (m *MockServiceStore) ListRoutes(ctx context.Context, serviceID int64) ([]store.Route, error) {
	var routes []store.Route
	for _, route := range m.routes {
		if route.ServiceID == serviceID {
			routes = append(routes, route)
		}
	}
	return routes, nil
}

func (m *MockServiceStore) UpdateServiceHealth(ctx context.Context, serviceID int64, healthStatus string) error {
	return nil
}

func TestProbeService_CrashLooping(t *testing.T) {
	mockStore := &MockServiceStore{}
	prober := NewProber(mockStore)

	service := &store.Service{
		ID:           1,
		Name:         "test-service",
		Status:       "running",
		CrashLooping: true,
		HealthPath:   stringPtr("/health"),
	}

	result := prober.ProbeService(context.Background(), service, []store.Route{})
	
	if result.Status != store.HealthStatusUnknown {
		t.Errorf("Expected health status to be unknown for crash-looping service, got %s", result.Status)
	}
}

func TestProbeService_UnhealthyService(t *testing.T) {
	// Create a test HTTP server that returns error status
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte("Internal Server Error"))
	}))
	defer server.Close()

	mockStore := &MockServiceStore{}
	prober := NewProber(mockStore)

	service := &store.Service{
		ID:         1,
		Name:       "test-service",
		Status:     "running",
		HealthPath: stringPtr("/health"),
		Ports:      []store.PortMap{{Container: 8080, Host: 8080}},
	}

	routes := []store.Route{
		{
			ID:        1,
			ServiceID: 1,
			Domain:    server.URL[7:], // Remove http://
			Port:      80,
			TLS:       false,
		},
	}

	result := prober.ProbeService(context.Background(), service, routes)
	
	if result.Status != store.HealthStatusFail {
		t.Errorf("Expected health status to be fail for unhealthy service, got %s", result.Status)
	}
	if result.Error == nil {
		t.Error("Expected error for unhealthy service probe")
	}
}

func TestProbeService_HealthyService(t *testing.T) {
	// Create a test HTTP server that returns OK status
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	}))
	defer server.Close()

	mockStore := &MockServiceStore{}
	prober := NewProber(mockStore)

	service := &store.Service{
		ID:         1,
		Name:       "test-service",
		Status:     "running",
		HealthPath: stringPtr("/health"),
		Ports:      []store.PortMap{{Container: 8080, Host: 8080}},
	}

	routes := []store.Route{
		{
			ID:        1,
			ServiceID: 1,
			Domain:    server.URL[7:], // Remove http://
			Port:      80,
			TLS:       false,
		},
	}

	result := prober.ProbeService(context.Background(), service, routes)
	
	if result.Status != store.HealthStatusOK {
		t.Errorf("Expected health status to be ok for healthy service, got %s", result.Status)
	}
}

func TestShouldEnterCrashLoop(t *testing.T) {
	service := store.Service{
		LastExitCode:    intPtr(1),
		RestartCount:    5,
		RestartWindowAt: timePtr(time.Now().Add(-5 * time.Minute)),
	}

	if !service.ShouldEnterCrashLoop() {
		t.Error("Expected service to enter crash loop with 5 restarts and non-zero exit code")
	}

	// Test with zero exit code - should not crash loop
	service.LastExitCode = intPtr(0)
	if service.ShouldEnterCrashLoop() {
		t.Error("Service should not enter crash loop with zero exit code")
	}

	// Test with expired window
	service.LastExitCode = intPtr(1)
	service.RestartWindowAt = timePtr(time.Now().Add(-15 * time.Minute))
	if service.ShouldEnterCrashLoop() {
		t.Error("Service should not enter crash loop with expired restart window")
	}
}

func TestCrashLoopDetector_HandleServiceRestart(t *testing.T) {
	mockStore := &MockCrashLoopServiceStore{
		services: []store.Service{
			{
				ID:              1,
				Name:            "test-service",
				RestartCount:    4,
				RestartWindowAt: timePtr(time.Now().Add(-5 * time.Minute)),
			},
		},
	}
	// We'll test the crash loop detector with a nil audit logger for simplicity
	detector := NewCrashLoopDetector(mockStore, nil)

	err := detector.HandleServiceRestart(context.Background(), 1, 1)
	if err != nil {
		t.Errorf("Expected no error handling service restart, got: %v", err)
	}
}

// Mock for crash loop service store
type MockCrashLoopServiceStore struct {
	services []store.Service
}

func (m *MockCrashLoopServiceStore) GetService(ctx context.Context, id int64) (store.Service, error) {
	for _, service := range m.services {
		if service.ID == id {
			return service, nil
		}
	}
	return store.Service{}, store.ErrNotFound
}

func (m *MockCrashLoopServiceStore) UpdateServiceRestart(ctx context.Context, serviceID int64, exitCode int, restartCount int, windowStart *time.Time) error {
	return nil
}

func (m *MockCrashLoopServiceStore) UpdateServiceState(ctx context.Context, serviceID int64, desiredState string, crashLooping bool) error {
	return nil
}

func (m *MockCrashLoopServiceStore) UnlockService(ctx context.Context, serviceID int64) error {
	return nil
}


// Helper functions
func stringPtr(s string) *string {
	return &s
}

func intPtr(i int) *int {
	return &i
}

func timePtr(t time.Time) *time.Time {
	return &t
}