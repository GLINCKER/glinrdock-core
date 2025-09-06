package store

import (
	"time"
)

// Registry represents a container registry configuration
type Registry struct {
	ID        string    `json:"id" db:"id"`
	Name      string    `json:"name" db:"name"`
	Type      string    `json:"type" db:"type"` // ghcr, ecr, dockerhub, generic
	Server    string    `json:"server" db:"server"`
	Username  string    `json:"username" db:"username"`
	SecretEnc []byte    `json:"-" db:"secret_enc"` // Never include in JSON
	Nonce     []byte    `json:"-" db:"nonce"`      // Never include in JSON
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// RegistryPublic represents registry info safe for public viewing (no secrets)
type RegistryPublic struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	Server    string    `json:"server"`
	Username  string    `json:"username"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ToPublic converts Registry to RegistryPublic (removes secrets)
func (r *Registry) ToPublic() *RegistryPublic {
	return &RegistryPublic{
		ID:        r.ID,
		Name:      r.Name,
		Type:      r.Type,
		Server:    r.Server,
		Username:  r.Username,
		CreatedAt: r.CreatedAt,
		UpdatedAt: r.UpdatedAt,
	}
}

// ValidRegistryTypes defines allowed registry types
var ValidRegistryTypes = []string{
	"ghcr",      // GitHub Container Registry
	"ecr",       // Amazon Elastic Container Registry
	"dockerhub", // Docker Hub
	"generic",   // Generic registry
}

// IsValidRegistryType checks if a type is valid
func IsValidRegistryType(regType string) bool {
	for _, validType := range ValidRegistryTypes {
		if regType == validType {
			return true
		}
	}
	return false
}

// GetDefaultServer returns the default server URL for a registry type
func GetDefaultServer(regType string) string {
	switch regType {
	case "ghcr":
		return "ghcr.io"
	case "dockerhub":
		return "registry-1.docker.io"
	case "ecr":
		return "" // ECR requires specific regional URLs
	case "generic":
		return ""
	default:
		return ""
	}
}

// RegistryCreateRequest represents the request to create a new registry
type RegistryCreateRequest struct {
	Name     string `json:"name" binding:"required,min=1,max=255"`
	Type     string `json:"type" binding:"required"`
	Server   string `json:"server" binding:"required,min=1,max=255"`
	Username string `json:"username" binding:"required,min=1,max=255"`
	Password string `json:"password" binding:"required,min=1"` // Will be encrypted
}

// RegistryCredentials represents decrypted registry credentials for Docker auth
type RegistryCredentials struct {
	Server   string `json:"server"`
	Username string `json:"username"`
	Password string `json:"password"`
}
