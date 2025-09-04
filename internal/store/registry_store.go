package store

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/pbkdf2"
)

// RegistryStore handles registry-related database operations
type RegistryStore struct {
	db            *sql.DB
	encryptionKey []byte
}

// NewRegistryStore creates a new registry store
func NewRegistryStore(db *sql.DB) *RegistryStore {
	// Generate a consistent encryption key based on a system identifier
	// In production, this should be from environment or secure key management
	systemSalt := "glinrdock-registry-encryption"
	key := pbkdf2.Key([]byte(systemSalt), []byte("static-salt"), 4096, 32, sha256.New)
	
	return &RegistryStore{
		db:            db,
		encryptionKey: key,
	}
}

// encryptPassword encrypts a password using AES-GCM
func (s *RegistryStore) encryptPassword(password string) ([]byte, []byte, error) {
	block, err := aes.NewCipher(s.encryptionKey)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext := gcm.Seal(nil, nonce, []byte(password), nil)
	return ciphertext, nonce, nil
}

// decryptPassword decrypts a password using AES-GCM
func (s *RegistryStore) decryptPassword(encryptedPassword, nonce []byte) (string, error) {
	block, err := aes.NewCipher(s.encryptionKey)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	plaintext, err := gcm.Open(nil, nonce, encryptedPassword, nil)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt password: %w", err)
	}

	return string(plaintext), nil
}

// CreateRegistry creates a new registry with encrypted password
func (s *RegistryStore) CreateRegistry(req RegistryCreateRequest) (*Registry, error) {
	// Validate registry type
	if !IsValidRegistryType(req.Type) {
		return nil, fmt.Errorf("invalid registry type: %s", req.Type)
	}

	// Encrypt password
	encryptedPassword, nonce, err := s.encryptPassword(req.Password)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt password: %w", err)
	}

	registry := &Registry{
		ID:        uuid.New().String(),
		Name:      req.Name,
		Type:      req.Type,
		Server:    req.Server,
		Username:  req.Username,
		SecretEnc: encryptedPassword,
		Nonce:     nonce,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	query := `
		INSERT INTO registries (id, name, type, server, username, secret_enc, nonce, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err = s.db.Exec(query, 
		registry.ID, registry.Name, registry.Type, registry.Server, registry.Username,
		registry.SecretEnc, registry.Nonce, registry.CreatedAt, registry.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to create registry: %w", err)
	}

	return registry, nil
}

// ListRegistries retrieves all registries (public info only)
func (s *RegistryStore) ListRegistries() ([]*RegistryPublic, error) {
	query := `
		SELECT id, name, type, server, username, created_at, updated_at
		FROM registries
		ORDER BY name ASC
	`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, fmt.Errorf("failed to query registries: %w", err)
	}
	defer rows.Close()

	var registries []*RegistryPublic
	for rows.Next() {
		registry := &RegistryPublic{}
		err := rows.Scan(&registry.ID, &registry.Name, &registry.Type, 
			&registry.Server, &registry.Username, &registry.CreatedAt, &registry.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan registry: %w", err)
		}
		registries = append(registries, registry)
	}

	return registries, nil
}

// GetRegistry retrieves a specific registry by ID (public info only)
func (s *RegistryStore) GetRegistry(id string) (*RegistryPublic, error) {
	query := `
		SELECT id, name, type, server, username, created_at, updated_at
		FROM registries
		WHERE id = ?
	`

	registry := &RegistryPublic{}
	err := s.db.QueryRow(query, id).Scan(&registry.ID, &registry.Name, &registry.Type,
		&registry.Server, &registry.Username, &registry.CreatedAt, &registry.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("registry not found")
		}
		return nil, fmt.Errorf("failed to get registry: %w", err)
	}

	return registry, nil
}

// GetRegistryCredentials retrieves registry credentials with decrypted password
// This should only be used internally for Docker authentication
func (s *RegistryStore) GetRegistryCredentials(id string) (*RegistryCredentials, error) {
	query := `
		SELECT server, username, secret_enc, nonce
		FROM registries
		WHERE id = ?
	`

	var server, username string
	var encryptedPassword, nonce []byte
	err := s.db.QueryRow(query, id).Scan(&server, &username, &encryptedPassword, &nonce)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("registry not found")
		}
		return nil, fmt.Errorf("failed to get registry credentials: %w", err)
	}

	// Decrypt password
	password, err := s.decryptPassword(encryptedPassword, nonce)
	if err != nil {
		return nil, fmt.Errorf("failed to decrypt registry password: %w", err)
	}

	return &RegistryCredentials{
		Server:   server,
		Username: username,
		Password: password,
	}, nil
}

// DeleteRegistry removes a registry
func (s *RegistryStore) DeleteRegistry(id string) error {
	// First check if registry exists
	_, err := s.GetRegistry(id)
	if err != nil {
		return err // Registry not found
	}

	// TODO: Check if any services are using this registry
	// For now, we'll allow deletion but services will fail to pull

	query := `DELETE FROM registries WHERE id = ?`
	result, err := s.db.Exec(query, id)
	if err != nil {
		return fmt.Errorf("failed to delete registry: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("registry not found")
	}

	return nil
}

// TestRegistryConnection tests if registry credentials work
// This is a placeholder - in a full implementation, you'd attempt a Docker login
func (s *RegistryStore) TestRegistryConnection(id string) error {
	creds, err := s.GetRegistryCredentials(id)
	if err != nil {
		return err
	}

	// TODO: Implement actual Docker registry authentication test
	// For now, just validate we can decrypt the credentials
	if creds.Server == "" || creds.Username == "" || creds.Password == "" {
		return fmt.Errorf("invalid registry credentials")
	}

	return nil
}