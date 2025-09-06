package events

import (
	"strings"
	"testing"
	"time"

	"github.com/docker/docker/api/types/events"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEventCache(t *testing.T) {
	cache := NewEventCache()

	t.Run("UpdateAndGetServiceState", func(t *testing.T) {
		// Update a service state
		cache.UpdateServiceState(123, "container-123", "glinr_1_api", "running")

		// Retrieve the state
		state, exists := cache.GetServiceState(123)
		require.True(t, exists)
		assert.Equal(t, int64(123), state.ServiceID)
		assert.Equal(t, "container-123", state.ContainerID)
		assert.Equal(t, "glinr_1_api", state.ContainerName)
		assert.Equal(t, "running", state.Status)
		assert.WithinDuration(t, time.Now(), state.LastUpdated, time.Second)
	})

	t.Run("GetNonExistentService", func(t *testing.T) {
		_, exists := cache.GetServiceState(999)
		assert.False(t, exists)
	})

	t.Run("GetAllServiceStates", func(t *testing.T) {
		cache.UpdateServiceState(456, "container-456", "glinr_2_worker", "stopped")

		states := cache.GetAllServiceStates()
		require.Len(t, states, 2) // From previous test + this one

		// Check both states exist
		assert.Contains(t, states, int64(123))
		assert.Contains(t, states, int64(456))
		assert.Equal(t, "running", states[123].Status)
		assert.Equal(t, "stopped", states[456].Status)
	})
}

func TestExtractServiceIDFromContainerName(t *testing.T) {
	tests := []struct {
		name          string
		containerName string
		expectError   bool
	}{
		{
			name:          "ValidGlinrContainer",
			containerName: "glinr_1_api",
			expectError:   false,
		},
		{
			name:          "ValidGlinrContainerWithHyphens",
			containerName: "glinr_2_web-server",
			expectError:   false,
		},
		{
			name:          "InvalidPrefix",
			containerName: "other_1_api",
			expectError:   true,
		},
		{
			name:          "InvalidFormat",
			containerName: "glinr_api",
			expectError:   true,
		},
		{
			name:          "EmptyName",
			containerName: "",
			expectError:   true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			serviceID, err := extractServiceIDFromContainerName(tt.containerName)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
				assert.Greater(t, serviceID, int64(0))

				// Same container name should always produce same ID
				serviceID2, err2 := extractServiceIDFromContainerName(tt.containerName)
				assert.NoError(t, err2)
				assert.Equal(t, serviceID, serviceID2)
			}
		})
	}
}

func TestMapDockerEventToStatus(t *testing.T) {
	tests := []struct {
		action         string
		expectedStatus string
	}{
		{"create", "created"},
		{"start", "running"},
		{"stop", "stopped"},
		{"die", "dead"},
		{"destroy", "removed"},
		{"pause", ""},   // Should be ignored
		{"unpause", ""}, // Should be ignored
		{"unknown", ""}, // Should be ignored
	}

	for _, tt := range tests {
		t.Run(tt.action, func(t *testing.T) {
			status := mapDockerEventToStatus(tt.action)
			assert.Equal(t, tt.expectedStatus, status)
		})
	}
}

func TestDockerEventHandling(t *testing.T) {
	cache := NewEventCache()

	// Create a mock Docker event
	event := events.Message{
		Type:   "container",
		Action: events.Action("start"),
		Actor: events.Actor{
			ID: "container-123",
			Attributes: map[string]string{
				"name": "glinr_1_api",
			},
		},
	}

	// Create monitor (without actual Docker client for unit test)
	monitor := &DockerEventMonitor{
		client:     nil,
		eventCache: cache,
	}

	// Handle the event
	monitor.handleDockerEvent(event)

	// Verify the service state was updated
	serviceID, err := extractServiceIDFromContainerName("glinr_1_api")
	require.NoError(t, err)

	state, exists := cache.GetServiceState(serviceID)
	require.True(t, exists)
	assert.Equal(t, "container-123", state.ContainerID)
	assert.Equal(t, "glinr_1_api", state.ContainerName)
	assert.Equal(t, "running", state.Status)
}

func TestDockerEventFiltering(t *testing.T) {
	cache := NewEventCache()
	monitor := &DockerEventMonitor{
		client:     nil,
		eventCache: cache,
	}

	t.Run("IgnoreNonContainerEvents", func(t *testing.T) {
		event := events.Message{
			Type:   "network",
			Action: events.Action("create"),
		}

		monitor.handleDockerEvent(event)

		// Should not have created any service states
		states := cache.GetAllServiceStates()
		assert.Empty(t, states)
	})

	t.Run("IgnoreNonGlinrContainers", func(t *testing.T) {
		event := events.Message{
			Type:   "container",
			Action: events.Action("start"),
			Actor: events.Actor{
				ID: "container-456",
				Attributes: map[string]string{
					"name": "nginx",
				},
			},
		}

		monitor.handleDockerEvent(event)

		// Should not have created any service states
		states := cache.GetAllServiceStates()
		assert.Empty(t, states)
	})

	t.Run("ProcessGlinrContainers", func(t *testing.T) {
		event := events.Message{
			Type:   "container",
			Action: events.Action("start"),
			Actor: events.Actor{
				ID: "container-789",
				Attributes: map[string]string{
					"name": "glinr_3_database",
				},
			},
		}

		monitor.handleDockerEvent(event)

		// Should have created a service state
		states := cache.GetAllServiceStates()
		assert.Len(t, states, 1)

		// Find the service
		var state *ServiceState
		for _, s := range states {
			if strings.Contains(s.ContainerName, "database") {
				state = s
				break
			}
		}
		require.NotNil(t, state)
		assert.Equal(t, "running", state.Status)
	})
}
