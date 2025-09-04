package dockerx

import (
	"context"
	"testing"
	"time"
)

func TestMockEngine_NetworkOperations(t *testing.T) {
	mock := NewMockEngine()
	
	t.Run("EnsureNetwork succeeds by default", func(t *testing.T) {
		ctx := context.Background()
		networkName := "glinr_proj_1"
		labels := map[string]string{
			"glinr.project_id": "1",
			"owner":            "glinrdock",
		}
		
		err := mock.EnsureNetwork(ctx, networkName, labels)
		if err != nil {
			t.Errorf("Expected no error, got %v", err)
		}
	})
	
	t.Run("EnsureNetwork returns configured error", func(t *testing.T) {
		ctx := context.Background()
		expectedErr := &mockError{"network creation failed"}
		mock.SetEnsureNetworkError(expectedErr)
		
		err := mock.EnsureNetwork(ctx, "test-network", nil)
		if err != expectedErr {
			t.Errorf("Expected %v, got %v", expectedErr, err)
		}
	})
	
	t.Run("ConnectNetwork succeeds by default", func(t *testing.T) {
		ctx := context.Background()
		networkName := "glinr_proj_1"
		containerID := "container123"
		aliases := []string{"web", "web.myproject.local"}
		
		err := mock.ConnectNetwork(ctx, networkName, containerID, aliases)
		if err != nil {
			t.Errorf("Expected no error, got %v", err)
		}
	})
	
	t.Run("ConnectNetwork returns configured error", func(t *testing.T) {
		ctx := context.Background()
		expectedErr := &mockError{"network connection failed"}
		mock.SetConnectNetworkError(expectedErr)
		
		err := mock.ConnectNetwork(ctx, "test-network", "container123", []string{"alias"})
		if err != expectedErr {
			t.Errorf("Expected %v, got %v", expectedErr, err)
		}
	})
	
	t.Run("DisconnectNetwork succeeds by default", func(t *testing.T) {
		ctx := context.Background()
		networkName := "glinr_proj_1"
		containerID := "container123"
		
		err := mock.DisconnectNetwork(ctx, networkName, containerID)
		if err != nil {
			t.Errorf("Expected no error, got %v", err)
		}
	})
	
	t.Run("DisconnectNetwork returns configured error", func(t *testing.T) {
		ctx := context.Background()
		expectedErr := &mockError{"network disconnection failed"}
		mock.SetDisconnectNetworkError(expectedErr)
		
		err := mock.DisconnectNetwork(ctx, "test-network", "container123")
		if err != expectedErr {
			t.Errorf("Expected %v, got %v", expectedErr, err)
		}
	})
}

func TestMockEngine_Inspect(t *testing.T) {
	mock := NewMockEngine()
	
	t.Run("Inspect returns mock container status", func(t *testing.T) {
		ctx := context.Background()
		containerID := "container123"
		
		status, err := mock.Inspect(ctx, containerID)
		if err != nil {
			t.Errorf("Expected no error, got %v", err)
		}
		
		if status.ID != containerID {
			t.Errorf("Expected container ID %s, got %s", containerID, status.ID)
		}
		
		if status.Name != "mock-container" {
			t.Errorf("Expected container name 'mock-container', got %s", status.Name)
		}
		
		if status.State != "running" {
			t.Errorf("Expected state 'running', got %s", status.State)
		}
		
		if status.StartedAt == nil {
			t.Error("Expected StartedAt to be set")
		} else {
			// Should be approximately 5 minutes ago
			elapsed := time.Since(*status.StartedAt)
			if elapsed < 4*time.Minute || elapsed > 6*time.Minute {
				t.Errorf("Expected StartedAt to be ~5 minutes ago, got %v", elapsed)
			}
		}
	})
	
	t.Run("Inspect returns configured error", func(t *testing.T) {
		ctx := context.Background()
		expectedErr := &mockError{"inspect failed"}
		mock.SetInspectError(expectedErr)
		
		_, err := mock.Inspect(ctx, "container123")
		if err != expectedErr {
			t.Errorf("Expected %v, got %v", expectedErr, err)
		}
	})
}

// Helper type for testing error scenarios
type mockError struct {
	message string
}

func (e *mockError) Error() string {
	return e.message
}