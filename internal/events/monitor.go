package events

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/GLINCKER/glinrdock/internal/metrics"
	"github.com/docker/docker/api/types/events"
	"github.com/docker/docker/client"
	"github.com/gorilla/websocket"
	"github.com/rs/zerolog/log"
)

// ServiceState represents the current state of a service container
type ServiceState struct {
	ServiceID     int64     `json:"service_id"`
	ContainerID   string    `json:"container_id"`
	ContainerName string    `json:"container_name"`
	Status        string    `json:"status"` // "created", "running", "stopped", "dead", "removed"
	LastUpdated   time.Time `json:"last_updated"`
}

// EventCache maintains service states in memory
type EventCache struct {
	mu       sync.RWMutex
	services map[int64]*ServiceState // key: service ID
	clients  map[*websocket.Conn]bool
}

// NewEventCache creates a new event cache
func NewEventCache() *EventCache {
	return &EventCache{
		services: make(map[int64]*ServiceState),
		clients:  make(map[*websocket.Conn]bool),
	}
}

// UpdateServiceState updates or creates a service state
func (ec *EventCache) UpdateServiceState(serviceID int64, containerID, containerName, status string) {
	ec.mu.Lock()
	defer ec.mu.Unlock()

	state := &ServiceState{
		ServiceID:     serviceID,
		ContainerID:   containerID,
		ContainerName: containerName,
		Status:        status,
		LastUpdated:   time.Now(),
	}

	ec.services[serviceID] = state

	// Update running services metric
	ec.updateRunningServicesMetric()

	// Broadcast to connected WebSocket clients
	ec.broadcastState(state)

	log.Info().
		Int64("service_id", serviceID).
		Str("container_name", containerName).
		Str("status", status).
		Msg("service state updated")
}

// GetServiceState retrieves the current state of a service
func (ec *EventCache) GetServiceState(serviceID int64) (*ServiceState, bool) {
	ec.mu.RLock()
	defer ec.mu.RUnlock()

	state, exists := ec.services[serviceID]
	return state, exists
}

// GetAllServiceStates returns all current service states
func (ec *EventCache) GetAllServiceStates() map[int64]*ServiceState {
	ec.mu.RLock()
	defer ec.mu.RUnlock()

	// Create a copy to avoid race conditions
	result := make(map[int64]*ServiceState)
	for k, v := range ec.services {
		result[k] = v
	}
	return result
}

// updateRunningServicesMetric counts and updates the running services metric
func (ec *EventCache) updateRunningServicesMetric() {
	runningCount := 0
	for _, state := range ec.services {
		if state.Status == "running" {
			runningCount++
		}
	}
	metrics.SetServicesRunning(runningCount)
}

// AddWebSocketClient adds a WebSocket client for event broadcasting
func (ec *EventCache) AddWebSocketClient(conn *websocket.Conn) {
	ec.mu.Lock()
	defer ec.mu.Unlock()

	ec.clients[conn] = true
	log.Debug().Msg("WebSocket client added to event cache")
}

// RemoveWebSocketClient removes a WebSocket client
func (ec *EventCache) RemoveWebSocketClient(conn *websocket.Conn) {
	ec.mu.Lock()
	defer ec.mu.Unlock()

	delete(ec.clients, conn)
	log.Debug().Msg("WebSocket client removed from event cache")
}

// broadcastState sends state updates to all connected WebSocket clients
func (ec *EventCache) broadcastState(state *ServiceState) {
	if len(ec.clients) == 0 {
		return
	}

	message, err := json.Marshal(state)
	if err != nil {
		log.Error().Err(err).Msg("failed to marshal service state")
		return
	}

	// Create a list of clients to remove (those that fail to receive messages)
	var clientsToRemove []*websocket.Conn

	for client := range ec.clients {
		if err := client.WriteMessage(websocket.TextMessage, message); err != nil {
			log.Debug().Err(err).Msg("failed to send state to WebSocket client")
			clientsToRemove = append(clientsToRemove, client)
		}
	}

	// Remove failed clients
	for _, client := range clientsToRemove {
		delete(ec.clients, client)
	}
}

// DockerEventMonitor monitors Docker events and updates the event cache
type DockerEventMonitor struct {
	client     *client.Client
	eventCache *EventCache
}

// NewDockerEventMonitor creates a new Docker event monitor
func NewDockerEventMonitor(dockerClient *client.Client, eventCache *EventCache) *DockerEventMonitor {
	return &DockerEventMonitor{
		client:     dockerClient,
		eventCache: eventCache,
	}
}

// Start begins monitoring Docker events
func (dem *DockerEventMonitor) Start(ctx context.Context) error {
	log.Info().Msg("starting Docker event monitor")

	eventsChan, errChan := dem.client.Events(ctx, events.ListOptions{})

	go func() {
		for {
			select {
			case <-ctx.Done():
				log.Info().Msg("stopping Docker event monitor")
				return
			case err := <-errChan:
				if err != nil {
					log.Error().Err(err).Msg("Docker events error")
				}
			case event := <-eventsChan:
				dem.handleDockerEvent(event)
			}
		}
	}()

	return nil
}

// handleDockerEvent processes individual Docker events
func (dem *DockerEventMonitor) handleDockerEvent(event events.Message) {
	// Only process container events
	if event.Type != "container" {
		return
	}

	// Only process events for our containers (those with glinr_ prefix)
	containerName := event.Actor.Attributes["name"]
	if !strings.HasPrefix(containerName, "glinr_") {
		return
	}

	// Extract service ID from container name format: glinr_{project_id}_{service_name}
	serviceID, err := extractServiceIDFromContainerName(containerName)
	if err != nil {
		log.Warn().Err(err).Str("container_name", containerName).Msg("failed to extract service ID from container name")
		return
	}

	// Map Docker event actions to our status
	status := mapDockerEventToStatus(string(event.Action))
	if status == "" {
		// Skip events we don't care about
		return
	}

	// Update the event cache
	dem.eventCache.UpdateServiceState(
		serviceID,
		event.Actor.ID,
		containerName,
		status,
	)
}

// extractServiceIDFromContainerName extracts service ID from container name
// Container name format: glinr_{project_id}_{service_name}
// For simplicity, we'll use a hash of the container name as service ID
// In a real implementation, you'd maintain a mapping between container names and service IDs
func extractServiceIDFromContainerName(containerName string) (int64, error) {
	parts := strings.Split(containerName, "_")
	if len(parts) < 3 || parts[0] != "glinr" {
		return 0, fmt.Errorf("invalid container name format: %s", containerName)
	}

	// For now, generate a consistent hash-based ID
	// In production, you'd maintain a proper mapping
	hash := int64(0)
	for _, char := range containerName {
		hash = hash*31 + int64(char)
	}

	// Ensure positive ID
	if hash < 0 {
		hash = -hash
	}

	return hash, nil
}

// mapDockerEventToStatus maps Docker event actions to our service status
func mapDockerEventToStatus(action string) string {
	switch action {
	case "create":
		return "created"
	case "start":
		return "running"
	case "stop":
		return "stopped"
	case "die":
		return "dead"
	case "destroy":
		return "removed"
	default:
		return "" // Ignore other events
	}
}
