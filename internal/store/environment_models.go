package store

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// Environment represents a configuration environment (dev, staging, prod, etc.)
type Environment struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Type        string    `json:"type" db:"type"` // development, staging, production, testing
	Description *string   `json:"description,omitempty" db:"description"`
	IsDefault   bool      `json:"is_default" db:"is_default"`
	IsActive    bool      `json:"is_active" db:"is_active"`
	InheritFrom *string   `json:"inherit_from,omitempty" db:"inherit_from"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

// EnvironmentVariable represents a single environment variable
type EnvironmentVariable struct {
	ID            string    `json:"id" db:"id"`
	EnvironmentID string    `json:"environment_id" db:"environment_id"`
	Key           string    `json:"key" db:"key"`
	Value         string    `json:"value" db:"value"`
	IsSecret      bool      `json:"is_secret" db:"is_secret"`
	Description   *string   `json:"description,omitempty" db:"description"`
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

// MergedEnvironmentVariable represents a variable with inheritance information
type MergedEnvironmentVariable struct {
	Key           string `json:"key"`
	Value         string `json:"value"`
	IsSecret      bool   `json:"is_secret"`
	Source        string `json:"source"` // "direct", "inherited", "override"
	SourceEnvID   string `json:"source_env_id"`
	SourceEnvName string `json:"source_env_name"`
}

// EnvironmentTemplate represents a reusable environment configuration
type EnvironmentTemplate struct {
	ID              string          `json:"id" db:"id"`
	Name            string          `json:"name" db:"name"`
	Description     *string         `json:"description,omitempty" db:"description"`
	EnvironmentType string          `json:"environment_type" db:"environment_type"`
	TemplateData    TemplateData    `json:"template_data" db:"template_data"`
	IsSystem        bool            `json:"is_system" db:"is_system"`
	CreatedAt       time.Time       `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at" db:"updated_at"`
}

// TemplateData represents the variable and secret structure for a template
type TemplateData struct {
	Variables map[string]string `json:"variables"`
	Secrets   []string          `json:"secrets"` // Secret keys only
}

// EnvironmentWithVariables combines environment with its resolved variables
type EnvironmentWithVariables struct {
	Environment     Environment                  `json:"environment"`
	Variables       map[string]string            `json:"variables"`
	Secrets         map[string]bool              `json:"secrets"` // Keys only, values hidden
	MergedVariables []MergedEnvironmentVariable  `json:"merged_variables"`
	VariableCount   int                          `json:"variable_count"`
	SecretCount     int                          `json:"secret_count"`
	InheritedCount  int                          `json:"inherited_count"`
}

// Value implements driver.Valuer for TemplateData to store as JSON
func (td TemplateData) Value() (driver.Value, error) {
	return json.Marshal(td)
}

// Scan implements sql.Scanner for TemplateData to read from JSON
func (td *TemplateData) Scan(value interface{}) error {
	if value == nil {
		return nil
	}

	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("cannot scan %T into TemplateData", value)
	}

	return json.Unmarshal(bytes, td)
}

// ValidEnvironmentTypes defines allowed environment types
var ValidEnvironmentTypes = []string{
	"development",
	"staging", 
	"production",
	"testing",
}

// IsValidEnvironmentType checks if a type is valid
func IsValidEnvironmentType(envType string) bool {
	for _, validType := range ValidEnvironmentTypes {
		if envType == validType {
			return true
		}
	}
	return false
}

// EnvironmentCreateRequest represents the request to create a new environment
type EnvironmentCreateRequest struct {
	Name        string  `json:"name" binding:"required,min=1,max=255"`
	Type        string  `json:"type" binding:"required"`
	Description *string `json:"description"`
	IsDefault   bool    `json:"is_default"`
	InheritFrom *string `json:"inherit_from"`
}

// EnvironmentUpdateRequest represents the request to update an environment
type EnvironmentUpdateRequest struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	IsDefault   *bool   `json:"is_default,omitempty"`
	InheritFrom *string `json:"inherit_from,omitempty"`
}

// EnvironmentDuplicateRequest represents the request to duplicate an environment
type EnvironmentDuplicateRequest struct {
	Name          string `json:"name" binding:"required,min=1,max=255"`
	CopyVariables bool   `json:"copy_variables"`
	CopySecrets   bool   `json:"copy_secrets"`
}

// VariableSetRequest represents the request to set a variable
type VariableSetRequest struct {
	Value       string  `json:"value" binding:"required"`
	IsSecret    bool    `json:"is_secret"`
	Description *string `json:"description"`
}

// VariableBulkUpdateRequest represents bulk variable update
type VariableBulkUpdateRequest struct {
	Variables map[string]string `json:"variables" binding:"required"`
	Operation string            `json:"operation"` // "merge" or "replace"
}