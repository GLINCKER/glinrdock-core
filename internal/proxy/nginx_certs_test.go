package proxy

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockNginxRouteStore for testing nginx functionality
type MockNginxRouteStore struct {
	mock.Mock
}

func (m *MockNginxRouteStore) GetAllRoutes(ctx context.Context) ([]store.Route, error) {
	args := m.Called(ctx)
	return args.Get(0).([]store.Route), args.Error(1)
}

func (m *MockNginxRouteStore) GetService(ctx context.Context, id int64) (store.Service, error) {
	args := m.Called(ctx, id)
	return args.Get(0).(store.Service), args.Error(1)
}

func TestGetCertPaths(t *testing.T) {
	tempDir := t.TempDir()
	mockStore := &MockNginxRouteStore{}
	nginx := NewNginxConfig("/tmp/nginx.conf", tempDir, mockStore)

	certPath, keyPath := nginx.GetCertPaths("example.com")

	expectedCertPath := filepath.Join(tempDir, "certs", "example.com", "fullchain.pem")
	expectedKeyPath := filepath.Join(tempDir, "certs", "example.com", "privkey.pem")

	assert.Equal(t, expectedCertPath, certPath)
	assert.Equal(t, expectedKeyPath, keyPath)
}

func TestGetChallengeDir(t *testing.T) {
	tempDir := t.TempDir()
	mockStore := &MockNginxRouteStore{}
	nginx := NewNginxConfig("/tmp/nginx.conf", tempDir, mockStore)

	challengeDir := nginx.GetChallengeDir()
	expectedDir := filepath.Join(tempDir, "certs", "challenges")

	assert.Equal(t, expectedDir, challengeDir)
}

func TestCreateChallengeDir(t *testing.T) {
	tempDir := t.TempDir()
	mockStore := &MockNginxRouteStore{}
	nginx := NewNginxConfig("/tmp/nginx.conf", tempDir, mockStore)

	err := nginx.CreateChallengeDir()
	require.NoError(t, err)

	// Verify directory was created
	challengeDir := nginx.GetChallengeDir()
	stat, err := os.Stat(challengeDir)
	require.NoError(t, err)
	assert.True(t, stat.IsDir())
}

func TestBackupCurrentConfig(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "nginx.conf")
	
	mockStore := &MockNginxRouteStore{}
	nginx := NewNginxConfig(configPath, tempDir, mockStore)

	// Create a config file
	originalContent := "server { listen 80; }"
	err := os.WriteFile(configPath, []byte(originalContent), 0644)
	require.NoError(t, err)

	// Test backup
	err = nginx.backupCurrentConfig()
	require.NoError(t, err)

	// Verify backup was created
	backupContent, err := os.ReadFile(nginx.BackupPath)
	require.NoError(t, err)
	assert.Equal(t, originalContent, string(backupContent))
}

func TestBackupCurrentConfig_NoExistingFile(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "nonexistent.conf")
	
	mockStore := &MockNginxRouteStore{}
	nginx := NewNginxConfig(configPath, tempDir, mockStore)

	// Test backup with no existing file - should not error
	err := nginx.backupCurrentConfig()
	assert.NoError(t, err)

	// Verify no backup file was created
	_, err = os.Stat(nginx.BackupPath)
	assert.True(t, os.IsNotExist(err))
}

func TestRestoreBackupConfig(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "nginx.conf")
	
	mockStore := &MockNginxRouteStore{}
	nginx := NewNginxConfig(configPath, tempDir, mockStore)

	// Create backup file
	backupContent := "backup server { listen 80; }"
	err := os.WriteFile(nginx.BackupPath, []byte(backupContent), 0644)
	require.NoError(t, err)

	// Test restore
	err = nginx.restoreBackupConfig()
	require.NoError(t, err)

	// Verify config was restored
	restoredContent, err := os.ReadFile(configPath)
	require.NoError(t, err)
	assert.Equal(t, backupContent, string(restoredContent))
}

func TestRestoreBackupConfig_NoBackupFile(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "nginx.conf")
	
	mockStore := &MockNginxRouteStore{}
	nginx := NewNginxConfig(configPath, tempDir, mockStore)

	// Test restore without backup file
	err := nginx.restoreBackupConfig()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "backup config not found")
}

func TestReload_Success(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "nginx.conf")
	
	mockStore := &MockNginxRouteStore{}
	nginx := NewNginxConfig(configPath, tempDir, mockStore)
	
	// Mock successful nginx commands
	nginx.ValidateCmd = []string{"true"} // Always succeeds
	nginx.ReloadCmd = []string{"true"}   // Always succeeds

	// Create a config file
	err := os.WriteFile(configPath, []byte("test config"), 0644)
	require.NoError(t, err)

	// Test successful reload
	err = nginx.Reload()
	assert.NoError(t, err)

	// Verify backup was created during the process
	_, err = os.Stat(nginx.BackupPath)
	assert.NoError(t, err)
}

func TestReload_ValidationFailure(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "nginx.conf")
	
	mockStore := &MockNginxRouteStore{}
	nginx := NewNginxConfig(configPath, tempDir, mockStore)
	
	// Mock failing validation
	nginx.ValidateCmd = []string{"false"} // Always fails
	nginx.ReloadCmd = []string{"true"}    // Never reached

	// Create a config file
	err := os.WriteFile(configPath, []byte("test config"), 0644)
	require.NoError(t, err)

	// Test reload with validation failure
	err = nginx.Reload()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "configuration validation failed")
}

func TestReload_ReloadFailureWithRestore(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "nginx.conf")
	
	mockStore := &MockNginxRouteStore{}
	nginx := NewNginxConfig(configPath, tempDir, mockStore)
	
	// Mock successful validation but failing reload
	nginx.ValidateCmd = []string{"true"}  // Always succeeds
	nginx.ReloadCmd = []string{"false"}   // Always fails

	// Create a config file
	originalContent := "original config"
	err := os.WriteFile(configPath, []byte(originalContent), 0644)
	require.NoError(t, err)

	// Test reload with reload failure
	err = nginx.Reload()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "nginx reload failed (backup restored)")

	// Verify config was restored from backup
	restoredContent, err := os.ReadFile(configPath)
	require.NoError(t, err)
	assert.Equal(t, originalContent, string(restoredContent))
}

func TestLogNginxProcessInfo(t *testing.T) {
	tempDir := t.TempDir()
	mockStore := &MockNginxRouteStore{}
	nginx := NewNginxConfig("/tmp/nginx.conf", tempDir, mockStore)

	// This test is mainly for coverage as it uses system commands
	// In a real environment, it would try to find nginx processes
	err := nginx.logNginxProcessInfo()
	// May error if nginx is not running, but shouldn't panic
	// We just ensure it doesn't crash
	_ = err
}

func TestNginxConfig_Constructor(t *testing.T) {
	configPath := "/tmp/nginx.conf"
	dataDir := "/tmp/data"
	mockStore := &MockNginxRouteStore{}

	nginx := NewNginxConfig(configPath, dataDir, mockStore)

	assert.Equal(t, configPath, nginx.ConfigPath)
	assert.Equal(t, configPath+".tmp", nginx.TempPath)
	assert.Equal(t, configPath+".backup", nginx.BackupPath)
	assert.Equal(t, dataDir, nginx.DataDir)
	assert.Equal(t, []string{"nginx", "-s", "reload"}, nginx.ReloadCmd)
	assert.Equal(t, []string{"nginx", "-t"}, nginx.ValidateCmd)
	assert.Equal(t, mockStore, nginx.store)
}

// Integration test with mock commands
func TestReload_FullFlow(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "nginx.conf")
	
	mockStore := &MockNginxRouteStore{}
	nginx := NewNginxConfig(configPath, tempDir, mockStore)
	
	// Use echo to simulate successful commands
	nginx.ValidateCmd = []string{"echo", "nginx: configuration file test is successful"}
	nginx.ReloadCmd = []string{"echo", "nginx: signal process started"}

	// Create initial config
	originalContent := "server { listen 80; location / { proxy_pass http://backend; } }"
	err := os.WriteFile(configPath, []byte(originalContent), 0644)
	require.NoError(t, err)

	// Test full reload flow
	err = nginx.Reload()
	require.NoError(t, err)

	// Verify backup exists
	backupContent, err := os.ReadFile(nginx.BackupPath)
	require.NoError(t, err)
	assert.Equal(t, originalContent, string(backupContent))

	// Original config should still exist
	configContent, err := os.ReadFile(configPath)
	require.NoError(t, err)
	assert.Equal(t, originalContent, string(configContent))
}