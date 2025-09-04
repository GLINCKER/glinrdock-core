package license

import (
	"crypto/ed25519"
	"encoding/base64"
	"fmt"
	"os"
	"path/filepath"
)

// Manager handles license loading and verification
type Manager struct {
	pubKey      ed25519.PublicKey
	dataDir     string
	current     *License
	initialized bool
}

// NewManager creates a new license manager
func NewManager(pubKeyBase64 string, dataDir string) (*Manager, error) {
	if pubKeyBase64 == "" {
		return nil, fmt.Errorf("public key is required")
	}

	pubKey, err := base64.StdEncoding.DecodeString(pubKeyBase64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode public key: %w", err)
	}

	if len(pubKey) != ed25519.PublicKeySize {
		return nil, fmt.Errorf("invalid public key size: expected %d, got %d", ed25519.PublicKeySize, len(pubKey))
	}

	return &Manager{
		pubKey:  pubKey,
		dataDir: dataDir,
	}, nil
}

// LoadCurrent loads the current license from disk
func (m *Manager) LoadCurrent() (*License, error) {
	if m.initialized && m.current != nil {
		return m.current, nil
	}

	licensePath := filepath.Join(m.dataDir, "license", "current.license")
	
	// Check if license file exists
	if _, err := os.Stat(licensePath); os.IsNotExist(err) {
		m.initialized = true
		return nil, nil // No license file is OK
	}

	// Read the license file
	licenseData, err := os.ReadFile(licensePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read license file: %w", err)
	}

	// Verify the license
	license, err := Verify(licenseData, m.pubKey)
	if err != nil {
		return nil, fmt.Errorf("license verification failed: %w", err)
	}

	m.current = license
	m.initialized = true
	return license, nil
}

// SaveCurrent saves a license as the current active license
func (m *Manager) SaveCurrent(licenseData []byte) error {
	// Verify the license first
	license, err := Verify(licenseData, m.pubKey)
	if err != nil {
		return fmt.Errorf("license verification failed: %w", err)
	}

	// Ensure license directory exists
	licenseDir := filepath.Join(m.dataDir, "license")
	if err := os.MkdirAll(licenseDir, 0755); err != nil {
		return fmt.Errorf("failed to create license directory: %w", err)
	}

	// Write to temporary file first (atomic write)
	licensePath := filepath.Join(licenseDir, "current.license")
	tempPath := licensePath + ".tmp"
	
	if err := os.WriteFile(tempPath, licenseData, 0644); err != nil {
		return fmt.Errorf("failed to write license file: %w", err)
	}

	// Atomic rename
	if err := os.Rename(tempPath, licensePath); err != nil {
		os.Remove(tempPath) // Clean up temp file
		return fmt.Errorf("failed to activate license: %w", err)
	}

	// Update in-memory copy
	m.current = license
	return nil
}

// DeactivateCurrent moves the current license to disabled directory
func (m *Manager) DeactivateCurrent() error {
	licensePath := filepath.Join(m.dataDir, "license", "current.license")
	
	// Check if current license exists
	if _, err := os.Stat(licensePath); os.IsNotExist(err) {
		return fmt.Errorf("no active license to deactivate")
	}

	// Ensure disabled directory exists
	disabledDir := filepath.Join(m.dataDir, "license", "disabled")
	if err := os.MkdirAll(disabledDir, 0755); err != nil {
		return fmt.Errorf("failed to create disabled directory: %w", err)
	}

	// Move to disabled directory with timestamp
	timestamp := fmt.Sprintf("%d", os.Getpid()) // Use PID to avoid conflicts
	disabledPath := filepath.Join(disabledDir, fmt.Sprintf("license-%s.license", timestamp))
	
	if err := os.Rename(licensePath, disabledPath); err != nil {
		return fmt.Errorf("failed to deactivate license: %w", err)
	}

	// Clear in-memory copy
	m.current = nil
	return nil
}

// Current returns the currently loaded license
func (m *Manager) Current() *License {
	if !m.initialized {
		// Try to load if not initialized
		m.LoadCurrent()
	}
	return m.current
}

// IsActivated returns true if a valid license is currently active
func (m *Manager) IsActivated() bool {
	license := m.Current()
	return license != nil && !license.IsExpired()
}