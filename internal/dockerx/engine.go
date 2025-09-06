package dockerx

import (
	"context"
	"io"
	"strings"
	"time"

	"github.com/GLINCKER/glinrdock/internal/store"
)

// ContainerSpec represents container configuration for Docker operations
type ContainerSpec struct {
	Image string            `json:"image"`
	Env   map[string]string `json:"env"`
	Ports []store.PortMap   `json:"ports"`
}

// ContainerStats represents container resource usage statistics
type ContainerStats struct {
	CPUPercent    float64 `json:"cpu_percent"`
	MemoryUsage   uint64  `json:"memory_usage"`
	MemoryLimit   uint64  `json:"memory_limit"`
	MemoryPercent float64 `json:"memory_percent"`
	NetworkRx     uint64  `json:"network_rx"`
	NetworkTx     uint64  `json:"network_tx"`
	BlockRead     uint64  `json:"block_read"`
	BlockWrite    uint64  `json:"block_write"`
}

// Engine defines the interface for Docker operations
type Engine interface {
	Pull(ctx context.Context, image string, registryID string) error
	Create(ctx context.Context, name string, spec ContainerSpec, labels map[string]string) (string, error)
	Remove(ctx context.Context, id string) error
	Start(ctx context.Context, id string) error
	Stop(ctx context.Context, id string) error
	Restart(ctx context.Context, id string) error
	Logs(ctx context.Context, id string, follow bool) (io.ReadCloser, error)
	Stats(ctx context.Context, id string) (<-chan ContainerStats, <-chan error)
	Inspect(ctx context.Context, containerID string) (ContainerStatus, error)

	// Network operations
	EnsureNetwork(ctx context.Context, networkName string, labels map[string]string) error
	ConnectNetwork(ctx context.Context, networkName, containerID string, aliases []string) error
	DisconnectNetwork(ctx context.Context, networkName, containerID string) error
}

// ContainerStatus represents the status of a Docker container
type ContainerStatus struct {
	ID        string
	Name      string
	State     string // "created", "running", "paused", "restarting", "removing", "exited", "dead"
	Status    string
	StartedAt *time.Time // When the container started running
	Env       []string   // Environment variables from Docker inspect
}

// MockEngine implements Engine for testing without Docker
type MockEngine struct {
	pullError              error
	createError            error
	removeError            error
	startError             error
	stopError              error
	restartError           error
	logsError              error
	statsError             error
	inspectError           error
	ensureNetworkError     error
	connectNetworkError    error
	disconnectNetworkError error
	createID               string
	mockLogs               string
	mockStats              []ContainerStats
}

// NewMockEngine creates a new mock Docker engine
func NewMockEngine() *MockEngine {
	return &MockEngine{
		createID: "mock-container-id",
	}
}

// Pull simulates pulling an image
func (m *MockEngine) Pull(ctx context.Context, image string, registryID string) error {
	return m.pullError
}

// Create simulates creating a container
func (m *MockEngine) Create(ctx context.Context, name string, spec ContainerSpec, labels map[string]string) (string, error) {
	if m.createError != nil {
		return "", m.createError
	}
	return m.createID, nil
}

// Remove simulates removing a container
func (m *MockEngine) Remove(ctx context.Context, id string) error {
	return m.removeError
}

// Start simulates starting a container
func (m *MockEngine) Start(ctx context.Context, id string) error {
	return m.startError
}

// Stop simulates stopping a container
func (m *MockEngine) Stop(ctx context.Context, id string) error {
	return m.stopError
}

// Restart simulates restarting a container
func (m *MockEngine) Restart(ctx context.Context, id string) error {
	return m.restartError
}

// Logs simulates getting container logs
func (m *MockEngine) Logs(ctx context.Context, id string, follow bool) (io.ReadCloser, error) {
	if m.logsError != nil {
		return nil, m.logsError
	}
	return io.NopCloser(strings.NewReader(m.mockLogs)), nil
}

// Stats simulates getting container stats
func (m *MockEngine) Stats(ctx context.Context, id string) (<-chan ContainerStats, <-chan error) {
	statsCh := make(chan ContainerStats, len(m.mockStats))
	errCh := make(chan error, 1)

	go func() {
		defer close(statsCh)
		defer close(errCh)

		if m.statsError != nil {
			errCh <- m.statsError
			return
		}

		for _, stat := range m.mockStats {
			select {
			case statsCh <- stat:
			case <-ctx.Done():
				return
			}
		}
	}()

	return statsCh, errCh
}

// SetPullError sets the error to return from Pull
func (m *MockEngine) SetPullError(err error) {
	m.pullError = err
}

// SetCreateError sets the error to return from Create
func (m *MockEngine) SetCreateError(err error) {
	m.createError = err
}

// SetRemoveError sets the error to return from Remove
func (m *MockEngine) SetRemoveError(err error) {
	m.removeError = err
}

// SetCreateID sets the container ID to return from Create
func (m *MockEngine) SetCreateID(id string) {
	m.createID = id
}

// SetStartError sets the error to return from Start
func (m *MockEngine) SetStartError(err error) {
	m.startError = err
}

// SetStopError sets the error to return from Stop
func (m *MockEngine) SetStopError(err error) {
	m.stopError = err
}

// SetRestartError sets the error to return from Restart
func (m *MockEngine) SetRestartError(err error) {
	m.restartError = err
}

// SetLogsError sets the error to return from Logs
func (m *MockEngine) SetLogsError(err error) {
	m.logsError = err
}

// SetStatsError sets the error to return from Stats
func (m *MockEngine) SetStatsError(err error) {
	m.statsError = err
}

// SetMockLogs sets the mock log content
func (m *MockEngine) SetMockLogs(logs string) {
	m.mockLogs = logs
}

// SetMockStats sets the mock stats data
func (m *MockEngine) SetMockStats(stats []ContainerStats) {
	m.mockStats = stats
}

// Inspect simulates inspecting a container
func (m *MockEngine) Inspect(ctx context.Context, containerID string) (ContainerStatus, error) {
	if m.inspectError != nil {
		return ContainerStatus{}, m.inspectError
	}

	// Mock container started 5 minutes ago
	startedAt := time.Now().Add(-5 * time.Minute)

	return ContainerStatus{
		ID:        containerID,
		Name:      "mock-container",
		State:     "running",
		Status:    "running",
		StartedAt: &startedAt,
	}, nil
}

// EnsureNetwork simulates ensuring a Docker network exists
func (m *MockEngine) EnsureNetwork(ctx context.Context, networkName string, labels map[string]string) error {
	return m.ensureNetworkError
}

// ConnectNetwork simulates connecting a container to a network
func (m *MockEngine) ConnectNetwork(ctx context.Context, networkName, containerID string, aliases []string) error {
	return m.connectNetworkError
}

// DisconnectNetwork simulates disconnecting a container from a network
func (m *MockEngine) DisconnectNetwork(ctx context.Context, networkName, containerID string) error {
	return m.disconnectNetworkError
}

// SetEnsureNetworkError sets the error to return from EnsureNetwork
func (m *MockEngine) SetEnsureNetworkError(err error) {
	m.ensureNetworkError = err
}

// SetConnectNetworkError sets the error to return from ConnectNetwork
func (m *MockEngine) SetConnectNetworkError(err error) {
	m.connectNetworkError = err
}

// SetDisconnectNetworkError sets the error to return from DisconnectNetwork
func (m *MockEngine) SetDisconnectNetworkError(err error) {
	m.disconnectNetworkError = err
}

// SetInspectError sets the error to return from Inspect
func (m *MockEngine) SetInspectError(err error) {
	m.inspectError = err
}
