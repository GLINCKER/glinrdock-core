package dockerx

// Client provides typed wrapper interface for Docker operations
type Client interface {
	Ping() error
}

// MockClient implements Client for testing
type MockClient struct {
	pingError error
}

// NewMockClient creates a new mock client
func NewMockClient() *MockClient {
	return &MockClient{}
}

// Ping returns mock response for Docker ping
func (m *MockClient) Ping() error {
	return m.pingError
}

// SetPingError sets the error to return from Ping
func (m *MockClient) SetPingError(err error) {
	m.pingError = err
}
