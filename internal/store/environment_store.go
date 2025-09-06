package store

import (
	"database/sql"
)

// EnvironmentStore handles environment-related database operations
type EnvironmentStore struct {
	db *sql.DB
}

// NewEnvironmentStore creates a new environment store
func NewEnvironmentStore(db *sql.DB) *EnvironmentStore {
	return &EnvironmentStore{db: db}
}

// ListEnvironments retrieves all environments
func (s *EnvironmentStore) ListEnvironments() ([]Environment, error) {
	query := `
		SELECT id, name, type, description, is_default, created_at, updated_at 
		FROM environments 
		ORDER BY is_default DESC, name ASC
	`

	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var environments []Environment
	for rows.Next() {
		var env Environment
		err := rows.Scan(&env.ID, &env.Name, &env.Type, &env.Description, &env.IsDefault, &env.CreatedAt, &env.UpdatedAt)
		if err != nil {
			return nil, err
		}
		environments = append(environments, env)
	}

	return environments, nil
}

// GetEnvironment retrieves a specific environment by ID
func (s *EnvironmentStore) GetEnvironment(id string) (*Environment, error) {
	query := `
		SELECT id, name, type, description, is_default, created_at, updated_at 
		FROM environments 
		WHERE id = ?
	`

	var env Environment
	err := s.db.QueryRow(query, id).Scan(&env.ID, &env.Name, &env.Type, &env.Description, &env.IsDefault, &env.CreatedAt, &env.UpdatedAt)
	if err != nil {
		return nil, err
	}

	return &env, nil
}

// CreateEnvironment creates a new environment
func (s *EnvironmentStore) CreateEnvironment(env *Environment) error {
	query := `
		INSERT INTO environments (id, name, type, description, is_default, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`

	_, err := s.db.Exec(query, env.ID, env.Name, env.Type, env.Description, env.IsDefault, env.CreatedAt, env.UpdatedAt)
	return err
}

// UpdateEnvironment updates an existing environment
func (s *EnvironmentStore) UpdateEnvironment(env *Environment) error {
	query := `
		UPDATE environments 
		SET name = ?, type = ?, description = ?, is_default = ?, updated_at = ?
		WHERE id = ?
	`

	_, err := s.db.Exec(query, env.Name, env.Type, env.Description, env.IsDefault, env.UpdatedAt, env.ID)
	return err
}

// DeleteEnvironment removes an environment and its variables
func (s *EnvironmentStore) DeleteEnvironment(id string) error {
	// Delete variables first (foreign key constraint)
	_, err := s.db.Exec("DELETE FROM environment_variables WHERE environment_id = ?", id)
	if err != nil {
		return err
	}

	// Delete environment
	_, err = s.db.Exec("DELETE FROM environments WHERE id = ?", id)
	return err
}

// GetEnvironmentVariables retrieves all variables for an environment
func (s *EnvironmentStore) GetEnvironmentVariables(environmentID string) ([]EnvironmentVariable, error) {
	query := `
		SELECT id, environment_id, key, value, is_secret, created_at, updated_at
		FROM environment_variables 
		WHERE environment_id = ?
		ORDER BY key ASC
	`

	rows, err := s.db.Query(query, environmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var variables []EnvironmentVariable
	for rows.Next() {
		var variable EnvironmentVariable
		err := rows.Scan(&variable.ID, &variable.EnvironmentID, &variable.Key, &variable.Value, &variable.IsSecret, &variable.CreatedAt, &variable.UpdatedAt)
		if err != nil {
			return nil, err
		}
		variables = append(variables, variable)
	}

	return variables, nil
}

// UpdateEnvironmentVariables replaces all variables for an environment
func (s *EnvironmentStore) UpdateEnvironmentVariables(environmentID string, variables []EnvironmentVariable) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Delete existing variables
	_, err = tx.Exec("DELETE FROM environment_variables WHERE environment_id = ?", environmentID)
	if err != nil {
		return err
	}

	// Insert new variables
	for _, variable := range variables {
		_, err = tx.Exec(`
			INSERT INTO environment_variables (id, environment_id, key, value, is_secret, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, variable.ID, variable.EnvironmentID, variable.Key, variable.Value, variable.IsSecret, variable.CreatedAt, variable.UpdatedAt)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

// GetEnvironmentVariablesAsMap returns environment variables as a key-value map
func (s *EnvironmentStore) GetEnvironmentVariablesAsMap(environmentID string) (map[string]string, error) {
	variables, err := s.GetEnvironmentVariables(environmentID)
	if err != nil {
		return nil, err
	}

	result := make(map[string]string)
	for _, variable := range variables {
		result[variable.Key] = variable.Value
	}

	return result, nil
}
