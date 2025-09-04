package store

import (
	"context"
	"crypto/rand"
	"database/sql"
	"embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"regexp"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/GLINCKER/glinrdock/internal/github"
	"github.com/rs/zerolog/log"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// Migrate runs database migrations exactly once
func (s *Store) Migrate(ctx context.Context) error {
	// Create schema_version table if it doesn't exist
	_, err := s.db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS schema_version (
			version INTEGER PRIMARY KEY,
			applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`)
	if err != nil {
		return fmt.Errorf("failed to create schema_version table: %w", err)
	}

	// Check current version
	var currentVersion int
	err = s.db.QueryRowContext(ctx, "SELECT COALESCE(MAX(version), 0) FROM schema_version").Scan(&currentVersion)
	if err != nil {
		return fmt.Errorf("failed to get current schema version: %w", err)
	}

	// Read and apply migrations
	migrations, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("failed to read migrations directory: %w", err)
	}

	for _, migration := range migrations {
		if migration.IsDir() {
			continue
		}

		// Extract version from filename (001_init.sql -> 1)
		var version int
		if _, err := fmt.Sscanf(migration.Name(), "%d_", &version); err != nil {
			continue
		}

		if version <= currentVersion {
			continue
		}

		// Read migration SQL
		content, err := migrationsFS.ReadFile("migrations/" + migration.Name())
		if err != nil {
			return fmt.Errorf("failed to read migration %s: %w", migration.Name(), err)
		}

		// Execute migration in transaction
		tx, err := s.db.BeginTx(ctx, nil)
		if err != nil {
			return fmt.Errorf("failed to begin transaction for migration %s: %w", migration.Name(), err)
		}

		if _, err := tx.ExecContext(ctx, string(content)); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to execute migration %s: %w", migration.Name(), err)
		}

		if _, err := tx.ExecContext(ctx, "INSERT INTO schema_version (version) VALUES (?)", version); err != nil {
			tx.Rollback()
			return fmt.Errorf("failed to record migration %s: %w", migration.Name(), err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("failed to commit migration %s: %w", migration.Name(), err)
		}
	}

	return nil
}

// CreateToken creates a new token with bcrypt hash and role
func (s *Store) CreateToken(ctx context.Context, name, plain, role string) (Token, error) {
	if name == "" || len(name) > 64 {
		return Token{}, fmt.Errorf("invalid token name: must be 1-64 characters")
	}
	
	if !IsRoleValid(role) {
		return Token{}, fmt.Errorf("invalid role: must be one of admin, deployer, viewer")
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		return Token{}, fmt.Errorf("failed to hash token: %w", err)
	}

	result, err := s.db.ExecContext(ctx, 
		"INSERT INTO tokens (name, hash, role) VALUES (?, ?, ?)", 
		name, string(hash), role)
	if err != nil {
		return Token{}, fmt.Errorf("failed to create token: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return Token{}, fmt.Errorf("failed to get token ID: %w", err)
	}

	return Token{
		ID:        id,
		Name:      name,
		Hash:      string(hash),
		Role:      role,
		CreatedAt: time.Now(),
	}, nil
}

// ListTokens returns all tokens (without hashes)
func (s *Store) ListTokens(ctx context.Context) ([]Token, error) {
	rows, err := s.db.QueryContext(ctx, 
		"SELECT id, name, role, created_at, last_used_at FROM tokens ORDER BY created_at DESC")
	if err != nil {
		return nil, fmt.Errorf("failed to list tokens: %w", err)
	}
	defer rows.Close()

	var tokens []Token
	for rows.Next() {
		var token Token
		var lastUsedAt sql.NullTime
		
		err := rows.Scan(&token.ID, &token.Name, &token.Role, &token.CreatedAt, &lastUsedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan token: %w", err)
		}

		if lastUsedAt.Valid {
			token.LastUsedAt = &lastUsedAt.Time
		}

		tokens = append(tokens, token)
	}

	return tokens, rows.Err()
}

// DeleteTokenByName removes a token by name
func (s *Store) DeleteTokenByName(ctx context.Context, name string) error {
	result, err := s.db.ExecContext(ctx, "DELETE FROM tokens WHERE name = ?", name)
	if err != nil {
		return fmt.Errorf("failed to delete token: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("token not found: %s", name)
	}

	return nil
}

// TouchToken updates last_used_at for a token
func (s *Store) TouchToken(ctx context.Context, name string) error {
	_, err := s.db.ExecContext(ctx, 
		"UPDATE tokens SET last_used_at = CURRENT_TIMESTAMP WHERE name = ?", name)
	if err != nil {
		return fmt.Errorf("failed to touch token: %w", err)
	}
	return nil
}

// GetTokenByName retrieves a token by name (includes hash for verification)
func (s *Store) GetTokenByName(ctx context.Context, name string) (Token, error) {
	var token Token
	var lastUsedAt sql.NullTime

	err := s.db.QueryRowContext(ctx, 
		"SELECT id, name, hash, role, created_at, last_used_at FROM tokens WHERE name = ?", name).
		Scan(&token.ID, &token.Name, &token.Hash, &token.Role, &token.CreatedAt, &lastUsedAt)
	
	if err == sql.ErrNoRows {
		return Token{}, fmt.Errorf("token not found: %s", name)
	}
	if err != nil {
		return Token{}, fmt.Errorf("failed to get token: %w", err)
	}

	if lastUsedAt.Valid {
		token.LastUsedAt = &lastUsedAt.Time
	}

	return token, nil
}

// VerifyToken checks if a plain token matches any stored hash
func (s *Store) VerifyToken(ctx context.Context, plain string) (string, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT name, hash FROM tokens")
	if err != nil {
		return "", fmt.Errorf("failed to query tokens: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var name, hash string
		if err := rows.Scan(&name, &hash); err != nil {
			return "", fmt.Errorf("failed to scan token: %w", err)
		}

		if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)); err == nil {
			return name, nil
		}
	}

	return "", fmt.Errorf("invalid token")
}

// CreateProject creates a new project
func (s *Store) CreateProject(ctx context.Context, name string) (Project, error) {
	if name == "" || len(name) > 64 {
		return Project{}, fmt.Errorf("invalid project name: must be 1-64 characters")
	}

	result, err := s.db.ExecContext(ctx, 
		"INSERT INTO projects (name) VALUES (?)", name)
	if err != nil {
		return Project{}, fmt.Errorf("failed to create project: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return Project{}, fmt.Errorf("failed to get project ID: %w", err)
	}

	// Generate network name and update the project
	networkName := GenerateProjectNetworkName(id)
	_, err = s.db.ExecContext(ctx, "UPDATE projects SET network_name = ? WHERE id = ?", networkName, id)
	if err != nil {
		return Project{}, fmt.Errorf("failed to set project network name: %w", err)
	}

	project := Project{
		ID:          id,
		Name:        name,
		NetworkName: &networkName,
		CreatedAt:   time.Now(),
	}

	// Update search index in background to avoid blocking the operation
	go func() {
		if err := s.IndexProject(context.Background(), id); err != nil {
			log.Warn().Err(err).Int64("project_id", id).Msg("failed to update search index for project")
		}
	}()

	return project, nil
}

// CreateProjectWithWebhook creates a new project with webhook configuration
func (s *Store) CreateProjectWithWebhook(ctx context.Context, name string, repoURL, branch, imageTarget *string) (Project, error) {
	if name == "" || len(name) > 64 {
		return Project{}, fmt.Errorf("invalid project name: must be 1-64 characters")
	}
	
	result, err := s.db.ExecContext(ctx, 
		"INSERT INTO projects (name, repo_url, branch, image_target) VALUES (?, ?, ?, ?)", 
		name, repoURL, branch, imageTarget)
	if err != nil {
		return Project{}, fmt.Errorf("failed to create project: %w", err)
	}
	
	id, err := result.LastInsertId()
	if err != nil {
		return Project{}, fmt.Errorf("failed to get project ID: %w", err)
	}
	
	// Generate network name and update the project
	networkName := GenerateProjectNetworkName(id)
	_, err = s.db.ExecContext(ctx, "UPDATE projects SET network_name = ? WHERE id = ?", networkName, id)
	if err != nil {
		return Project{}, fmt.Errorf("failed to set project network name: %w", err)
	}
	
	// Get the full project back to include all fields
	return s.GetProject(ctx, id)
}

// UpdateProject updates an existing project
func (s *Store) UpdateProject(ctx context.Context, id int64, name string, repoURL, branch, imageTarget *string) (Project, error) {
	if name == "" || len(name) > 64 {
		return Project{}, fmt.Errorf("invalid project name: must be 1-64 characters")
	}
	
	_, err := s.db.ExecContext(ctx, 
		"UPDATE projects SET name = ?, repo_url = ?, branch = ?, image_target = ? WHERE id = ?", 
		name, repoURL, branch, imageTarget, id)
	if err != nil {
		return Project{}, fmt.Errorf("failed to update project: %w", err)
	}
	
	// Get the updated project
	return s.GetProject(ctx, id)
}

// ListProjects returns all projects
func (s *Store) ListProjects(ctx context.Context) ([]Project, error) {
	rows, err := s.db.QueryContext(ctx, 
		"SELECT id, name, repo_url, branch, image_target, network_name, created_at FROM projects ORDER BY created_at DESC")
	if err != nil {
		return nil, fmt.Errorf("failed to list projects: %w", err)
	}
	defer rows.Close()

	var projects []Project
	for rows.Next() {
		var project Project
		var repoURL, branch, imageTarget, networkName sql.NullString
		err := rows.Scan(&project.ID, &project.Name, &repoURL, &branch, &imageTarget, &networkName, &project.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan project: %w", err)
		}
		
		if repoURL.Valid {
			project.RepoURL = &repoURL.String
		}
		if branch.Valid {
			project.Branch = branch.String
		}
		if imageTarget.Valid {
			project.ImageTarget = &imageTarget.String
		}
		if networkName.Valid {
			project.NetworkName = &networkName.String
		}
		
		projects = append(projects, project)
	}

	return projects, rows.Err()
}

// GetProject retrieves a project by ID
func (s *Store) GetProject(ctx context.Context, id int64) (Project, error) {
	var project Project
	var repoURL, branch, imageTarget, networkName sql.NullString
	err := s.db.QueryRowContext(ctx, 
		"SELECT id, name, repo_url, branch, image_target, network_name, created_at FROM projects WHERE id = ?", id).
		Scan(&project.ID, &project.Name, &repoURL, &branch, &imageTarget, &networkName, &project.CreatedAt)
	
	if err == sql.ErrNoRows {
		return Project{}, fmt.Errorf("project not found: %d", id)
	}
	if err != nil {
		return Project{}, fmt.Errorf("failed to get project: %w", err)
	}

	if repoURL.Valid {
		project.RepoURL = &repoURL.String
	}
	if branch.Valid {
		project.Branch = branch.String
	}
	if imageTarget.Valid {
		project.ImageTarget = &imageTarget.String
	}
	if networkName.Valid {
		project.NetworkName = &networkName.String
	}

	return project, nil
}

// DeleteProject removes a project by ID
func (s *Store) DeleteProject(ctx context.Context, id int64) error {
	result, err := s.db.ExecContext(ctx, "DELETE FROM projects WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete project: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("project not found: %d", id)
	}

	return nil
}

// TokenCount returns the number of tokens in the database
func (s *Store) TokenCount(ctx context.Context) (int, error) {
	var count int
	err := s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM tokens").Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count tokens: %w", err)
	}
	return count, nil
}

// CreateService creates a new service within a project
func (s *Store) CreateService(ctx context.Context, projectID int64, spec ServiceSpec) (Service, error) {
	if spec.Name == "" || len(spec.Name) > 64 {
		return Service{}, fmt.Errorf("invalid service name: must be 1-64 characters")
	}
	if spec.Image == "" {
		return Service{}, fmt.Errorf("service image cannot be empty")
	}

	// Validate DNS-friendly name
	if !isDNSLabel(spec.Name) {
		return Service{}, fmt.Errorf("service name must be DNS-label friendly")
	}

	// Marshal JSON fields
	envJSON, err := marshalJSON(spec.Env)
	if err != nil {
		return Service{}, fmt.Errorf("failed to marshal env: %w", err)
	}

	portsJSON, err := marshalJSON(spec.Ports)
	if err != nil {
		return Service{}, fmt.Errorf("failed to marshal ports: %w", err)
	}

	result, err := s.db.ExecContext(ctx,
		"INSERT INTO services (project_id, name, image, env, ports, container_id, health_path, desired_state, restart_count, crash_looping, health_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		projectID, spec.Name, spec.Image, envJSON, portsJSON, nil, spec.HealthPath, ServiceStateRunning, 0, false, HealthStatusUnknown)
	if err != nil {
		return Service{}, fmt.Errorf("failed to create service: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return Service{}, fmt.Errorf("failed to get service ID: %w", err)
	}

	service := Service{
		ID:         id,
		ProjectID:  projectID,
		Name:       spec.Name,
		Image:      spec.Image,
		Env:        spec.Env,
		Ports:      spec.Ports,
		HealthPath: spec.HealthPath,
		CreatedAt:  time.Now(),
	}

	// Update search index in background to avoid blocking the operation
	go func() {
		if err := s.IndexService(context.Background(), id); err != nil {
			log.Warn().Err(err).Int64("service_id", id).Msg("failed to update search index for service")
		}
		// Also update the project index since service count changed
		if err := s.IndexProject(context.Background(), projectID); err != nil {
			log.Warn().Err(err).Int64("project_id", projectID).Msg("failed to update search index for project after service creation")
		}
	}()

	return service, nil
}

// ListServices returns all services for a project
func (s *Store) ListServices(ctx context.Context, projectID int64) ([]Service, error) {
	rows, err := s.db.QueryContext(ctx,
		"SELECT id, project_id, name, description, image, container_id, env, ports, volumes, health_path, desired_state, last_exit_code, restart_count, restart_window_at, crash_looping, health_status, last_probe_at, created_at FROM services WHERE project_id = ? ORDER BY created_at DESC",
		projectID)
	if err != nil {
		return nil, fmt.Errorf("failed to list services: %w", err)
	}
	defer rows.Close()

	var services []Service
	for rows.Next() {
		var service Service
		var envJSON, portsJSON, volumesJSON sql.NullString

		err := rows.Scan(&service.ID, &service.ProjectID, &service.Name, &service.Description, &service.Image,
			&service.ContainerID, &envJSON, &portsJSON, &volumesJSON, &service.HealthPath, &service.DesiredState, &service.LastExitCode, &service.RestartCount, &service.RestartWindowAt, &service.CrashLooping, &service.HealthStatus, &service.LastProbeAt, &service.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan service: %w", err)
		}

		if err := unmarshalJSON(envJSON.String, &service.Env); err != nil {
			return nil, fmt.Errorf("failed to unmarshal env: %w", err)
		}

		if err := unmarshalJSON(portsJSON.String, &service.Ports); err != nil {
			return nil, fmt.Errorf("failed to unmarshal ports: %w", err)
		}

		if err := unmarshalJSON(volumesJSON.String, &service.Volumes); err != nil {
			return nil, fmt.Errorf("failed to unmarshal volumes: %w", err)
		}

		services = append(services, service)
	}

	return services, rows.Err()
}

// GetService retrieves a service by ID
func (s *Store) GetService(ctx context.Context, id int64) (Service, error) {
	var service Service
	var envJSON, portsJSON, volumesJSON sql.NullString

	err := s.db.QueryRowContext(ctx,
		"SELECT id, project_id, name, description, image, container_id, env, ports, volumes, health_path, desired_state, last_exit_code, restart_count, restart_window_at, crash_looping, health_status, last_probe_at, created_at FROM services WHERE id = ?", id).
		Scan(&service.ID, &service.ProjectID, &service.Name, &service.Description, &service.Image,
			&service.ContainerID, &envJSON, &portsJSON, &volumesJSON, &service.HealthPath, &service.DesiredState, &service.LastExitCode, &service.RestartCount, &service.RestartWindowAt, &service.CrashLooping, &service.HealthStatus, &service.LastProbeAt, &service.CreatedAt)

	if err == sql.ErrNoRows {
		return Service{}, fmt.Errorf("service not found: %d", id)
	}
	if err != nil {
		return Service{}, fmt.Errorf("failed to get service: %w", err)
	}

	if err := unmarshalJSON(envJSON.String, &service.Env); err != nil {
		return Service{}, fmt.Errorf("failed to unmarshal env: %w", err)
	}

	if err := unmarshalJSON(portsJSON.String, &service.Ports); err != nil {
		return Service{}, fmt.Errorf("failed to unmarshal ports: %w", err)
	}

	if err := unmarshalJSON(volumesJSON.String, &service.Volumes); err != nil {
		return Service{}, fmt.Errorf("failed to unmarshal volumes: %w", err)
	}

	return service, nil
}

// DeleteService removes a service by ID
func (s *Store) DeleteService(ctx context.Context, id int64) error {
	result, err := s.db.ExecContext(ctx, "DELETE FROM services WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete service: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("service not found: %d", id)
	}

	return nil
}

// GetServiceNetwork returns networking information for a service
func (s *Store) GetServiceNetwork(ctx context.Context, serviceID int64) (ServiceNetwork, error) {
	// Get service and project information
	query := `
		SELECT s.id, s.name, s.ports, s.project_id, p.name as project_name, p.network_name
		FROM services s
		JOIN projects p ON s.project_id = p.id
		WHERE s.id = ?
	`
	
	var service struct {
		ID          int64   `json:"id"`
		Name        string  `json:"name"`
		Ports       string  `json:"ports"`
		ProjectID   int64   `json:"project_id"`
		ProjectName string  `json:"project_name"`
		NetworkName *string `json:"network_name"`
	}
	
	err := s.db.QueryRowContext(ctx, query, serviceID).Scan(
		&service.ID, &service.Name, &service.Ports, &service.ProjectID, &service.ProjectName, &service.NetworkName,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return ServiceNetwork{}, fmt.Errorf("service not found: %d", serviceID)
		}
		return ServiceNetwork{}, fmt.Errorf("failed to get service: %w", err)
	}
	
	// Parse ports
	var ports []PortMap
	if service.Ports != "" {
		if err := json.Unmarshal([]byte(service.Ports), &ports); err != nil {
			return ServiceNetwork{}, fmt.Errorf("failed to parse ports: %w", err)
		}
	}
	
	// Generate alias and hints
	alias := GenerateServiceAlias(service.ProjectName, service.Name)
	
	// Use project network name or generate one for backward compatibility
	var network string
	if service.NetworkName != nil && *service.NetworkName != "" {
		network = *service.NetworkName
	} else {
		network = GenerateProjectNetworkName(service.ProjectID)
	}
	
	// Convert to internal port mappings
	var portsInternal []InternalPortMapping
	for _, port := range ports {
		portsInternal = append(portsInternal, InternalPortMapping{
			Container: port.Container,
			Protocol:  "tcp", // Default to TCP
		})
	}
	
	// Generate hints
	dnsHint, curlHint := GenerateNetworkHints(alias, ports)
	
	// Generate aliases using the new function
	aliases := GenerateServiceAliases(service.ProjectName, service.Name)
	
	// Get external hosts from routes
	var externalHosts []string
	routesQuery := `
		SELECT domain, path
		FROM routes
		WHERE service_id = ?
	`
	
	rows, err := s.db.QueryContext(ctx, routesQuery, serviceID)
	if err != nil {
		// Log error but don't fail the main query
		// Could add logging here if needed
	} else {
		defer rows.Close()
		for rows.Next() {
			var domain, path string
			if err := rows.Scan(&domain, &path); err == nil {
				protocol := "https" // Default to HTTPS
				if path == "" || path == "/" {
					externalHosts = append(externalHosts, fmt.Sprintf("%s://%s", protocol, domain))
				} else {
					externalHosts = append(externalHosts, fmt.Sprintf("%s://%s%s", protocol, domain, path))
				}
			}
		}
	}
	
	// Generate internal DNS hint
	internalDNS := fmt.Sprintf("%s.%s.local", service.Name, service.ProjectName)
	
	return ServiceNetwork{
		ProjectNetwork: network,
		Aliases:        aliases,
		Networks:       []NetworkConnection{}, // Would require Docker API integration to populate
		IPv4:           nil,                   // Not implemented yet - would require Docker API integration
		PortsInternal:  portsInternal,
		ExternalHosts:  externalHosts,
		InternalDNS:    internalDNS,
		DNSHint:        dnsHint,
		CurlHint:       curlHint,
	}, nil
}

// CreateServiceLinks creates links between services
func (s *Store) CreateServiceLinks(ctx context.Context, serviceID int64, targetIDs []int64) error {
	if len(targetIDs) == 0 {
		// Clear existing links
		_, err := s.db.ExecContext(ctx, "DELETE FROM service_links WHERE service_id = ?", serviceID)
		return err
	}
	
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()
	
	// Clear existing links
	_, err = tx.ExecContext(ctx, "DELETE FROM service_links WHERE service_id = ?", serviceID)
	if err != nil {
		return fmt.Errorf("failed to clear existing links: %w", err)
	}
	
	// Validate target services exist
	for _, targetID := range targetIDs {
		var exists bool
		err = tx.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM services WHERE id = ?)", targetID).Scan(&exists)
		if err != nil {
			return fmt.Errorf("failed to validate target service %d: %w", targetID, err)
		}
		if !exists {
			return fmt.Errorf("target service not found: %d", targetID)
		}
	}
	
	// Insert new links
	for _, targetID := range targetIDs {
		if targetID == serviceID {
			continue // Skip self-links
		}
		
		_, err = tx.ExecContext(ctx, 
			"INSERT INTO service_links (service_id, target_id) VALUES (?, ?)", 
			serviceID, targetID,
		)
		if err != nil {
			return fmt.Errorf("failed to create link to service %d: %w", targetID, err)
		}
	}
	
	return tx.Commit()
}

// GetServiceLinks returns linked services for a service
func (s *Store) GetServiceLinks(ctx context.Context, serviceID int64) ([]LinkedService, error) {
	query := `
		SELECT s.id, s.name, s.project_id, p.name as project_name
		FROM service_links sl
		JOIN services s ON sl.target_id = s.id
		JOIN projects p ON s.project_id = p.id
		WHERE sl.service_id = ?
		ORDER BY s.name
	`
	
	rows, err := s.db.QueryContext(ctx, query, serviceID)
	if err != nil {
		return nil, fmt.Errorf("failed to query service links: %w", err)
	}
	defer rows.Close()
	
	var links []LinkedService
	for rows.Next() {
		var link LinkedService
		var projectName string
		
		err := rows.Scan(&link.ID, &link.Name, &link.ProjectID, &projectName)
		if err != nil {
			return nil, fmt.Errorf("failed to scan service link: %w", err)
		}
		
		// Generate alias
		link.Alias = GenerateServiceAlias(projectName, link.Name)
		
		links = append(links, link)
	}
	
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate service links: %w", err)
	}
	
	return links, nil
}

// UpdateService updates an existing service
func (s *Store) UpdateService(ctx context.Context, id int64, updates Service) error {
	// Marshal env, ports, and volumes to JSON
	envJSON, err := marshalJSON(updates.Env)
	if err != nil {
		return fmt.Errorf("failed to marshal env: %w", err)
	}

	portsJSON, err := marshalJSON(updates.Ports)
	if err != nil {
		return fmt.Errorf("failed to marshal ports: %w", err)
	}

	volumesJSON, err := marshalJSON(updates.Volumes)
	if err != nil {
		return fmt.Errorf("failed to marshal volumes: %w", err)
	}

	query := `UPDATE services SET 
		name = ?, 
		description = ?, 
		image = ?, 
		container_id = ?,
		env = ?, 
		ports = ?, 
		volumes = ?,
		project_id = ?,
		health_path = ?
		WHERE id = ?`
	
	result, err := s.db.ExecContext(ctx, query, 
		updates.Name, 
		updates.Description,
		updates.Image,
		updates.ContainerID, 
		envJSON, 
		portsJSON, 
		volumesJSON,
		updates.ProjectID,
		updates.HealthPath,
		id)
	if err != nil {
		return fmt.Errorf("failed to update service: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("service not found: %d", id)
	}

	return nil
}

// UpdateServiceContainerID updates the container_id for a service
func (s *Store) UpdateServiceContainerID(ctx context.Context, id int64, containerID string) error {
	result, err := s.db.ExecContext(ctx, "UPDATE services SET container_id = ? WHERE id = ?", containerID, id)
	if err != nil {
		return fmt.Errorf("failed to update service container_id: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("service not found: %d", id)
	}

	return nil
}

// GetServiceByContainerID retrieves a service by its container ID
func (s *Store) GetServiceByContainerID(ctx context.Context, containerID string) (*Service, error) {
	var service Service
	var envJSON, portsJSON, volumesJSON sql.NullString

	err := s.db.QueryRowContext(ctx,
		"SELECT id, project_id, name, description, image, container_id, env, ports, volumes, health_path, desired_state, last_exit_code, restart_count, restart_window_at, crash_looping, health_status, last_probe_at, created_at FROM services WHERE container_id = ?", containerID).
		Scan(&service.ID, &service.ProjectID, &service.Name, &service.Description, &service.Image,
			&service.ContainerID, &envJSON, &portsJSON, &volumesJSON, &service.HealthPath, &service.DesiredState, &service.LastExitCode, &service.RestartCount, &service.RestartWindowAt, &service.CrashLooping, &service.HealthStatus, &service.LastProbeAt, &service.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // Return nil instead of error for "not found"
		}
		return nil, fmt.Errorf("failed to get service by container_id: %w", err)
	}

	// Parse JSON fields
	if err := unmarshalJSON(envJSON.String, &service.Env); err != nil {
		return nil, fmt.Errorf("failed to unmarshal env: %w", err)
	}
	if err := unmarshalJSON(portsJSON.String, &service.Ports); err != nil {
		return nil, fmt.Errorf("failed to unmarshal ports: %w", err)
	}
	if err := unmarshalJSON(volumesJSON.String, &service.Volumes); err != nil {
		return nil, fmt.Errorf("failed to unmarshal volumes: %w", err)
	}

	return &service, nil
}

// Helper functions for JSON marshaling and validation
var dnsLabelRegex = regexp.MustCompile(`^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`)

func isDNSLabel(name string) bool {
	if len(name) == 0 || len(name) > 63 {
		return false
	}
	return dnsLabelRegex.MatchString(name)
}

func marshalJSON(v interface{}) (string, error) {
	if v == nil {
		return "{}", nil
	}
	data, err := json.Marshal(v)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func unmarshalJSON(data string, v interface{}) error {
	if data == "" || data == "{}" {
		return nil
	}
	return json.Unmarshal([]byte(data), v)
}

// Health and crash loop operations

// UpdateServiceHealth updates the health status and probe time for a service
func (s *Store) UpdateServiceHealth(ctx context.Context, serviceID int64, healthStatus string) error {
	_, err := s.db.ExecContext(ctx,
		"UPDATE services SET health_status = ?, last_probe_at = CURRENT_TIMESTAMP WHERE id = ?",
		healthStatus, serviceID)
	if err != nil {
		return fmt.Errorf("failed to update service health: %w", err)
	}
	return nil
}

// UpdateServiceState updates the desired state and crash loop status
func (s *Store) UpdateServiceState(ctx context.Context, serviceID int64, desiredState string, crashLooping bool) error {
	_, err := s.db.ExecContext(ctx,
		"UPDATE services SET desired_state = ?, crash_looping = ? WHERE id = ?",
		desiredState, crashLooping, serviceID)
	if err != nil {
		return fmt.Errorf("failed to update service state: %w", err)
	}
	return nil
}

// UpdateServiceRestart updates restart tracking fields for crash loop detection
func (s *Store) UpdateServiceRestart(ctx context.Context, serviceID int64, exitCode int, restartCount int, windowStart *time.Time) error {
	_, err := s.db.ExecContext(ctx,
		"UPDATE services SET last_exit_code = ?, restart_count = ?, restart_window_at = ? WHERE id = ?",
		exitCode, restartCount, windowStart, serviceID)
	if err != nil {
		return fmt.Errorf("failed to update service restart data: %w", err)
	}
	return nil
}

// UnlockService clears the crash loop flag and sets desired state to running
func (s *Store) UnlockService(ctx context.Context, serviceID int64) error {
	_, err := s.db.ExecContext(ctx,
		"UPDATE services SET crash_looping = FALSE, desired_state = ?, restart_count = 0, restart_window_at = NULL WHERE id = ?",
		ServiceStateRunning, serviceID)
	if err != nil {
		return fmt.Errorf("failed to unlock service: %w", err)
	}
	return nil
}

// Route operations

// CreateRoute creates a new route for a service
func (s *Store) CreateRoute(ctx context.Context, serviceID int64, spec RouteSpec) (Route, error) {
	// Validate domain (basic validation)
	if spec.Domain == "" {
		return Route{}, fmt.Errorf("domain cannot be empty")
	}
	
	if len(spec.Domain) > 253 { // Max domain name length
		return Route{}, fmt.Errorf("domain too long: max 253 characters")
	}

	// Verify service exists
	_, err := s.GetService(ctx, serviceID)
	if err != nil {
		return Route{}, fmt.Errorf("service not found: %w", err)
	}

	// Insert route
	result, err := s.db.ExecContext(ctx,
		"INSERT INTO routes (service_id, domain, port, tls, path, certificate_id, proxy_config) VALUES (?, ?, ?, ?, ?, ?, ?)",
		serviceID, spec.Domain, spec.Port, spec.TLS, spec.Path, spec.CertificateID, spec.ProxyConfig)
	if err != nil {
		return Route{}, fmt.Errorf("failed to create route: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return Route{}, fmt.Errorf("failed to get route ID: %w", err)
	}

	// Get the created route
	route, err := s.GetRoute(ctx, id)
	if err != nil {
		return Route{}, err
	}

	// Update search index in background to avoid blocking the operation
	go func() {
		if err := s.IndexRoute(context.Background(), id); err != nil {
			log.Warn().Err(err).Int64("route_id", id).Msg("failed to update search index for route")
		}
	}()

	return route, nil
}

// ListRoutes returns all routes for a service
func (s *Store) ListRoutes(ctx context.Context, serviceID int64) ([]Route, error) {
	rows, err := s.db.QueryContext(ctx,
		"SELECT id, service_id, domain, port, tls, path, certificate_id, proxy_config, created_at, updated_at FROM routes WHERE service_id = ? ORDER BY created_at",
		serviceID)
	if err != nil {
		return nil, fmt.Errorf("failed to query routes: %w", err)
	}
	defer rows.Close()

	var routes []Route
	for rows.Next() {
		var route Route
		err := rows.Scan(&route.ID, &route.ServiceID, &route.Domain, &route.Port, &route.TLS, &route.Path, &route.CertificateID, &route.ProxyConfig, &route.CreatedAt, &route.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan route: %w", err)
		}
		routes = append(routes, route)
	}

	return routes, rows.Err()
}

// GetRoute retrieves a route by ID
func (s *Store) GetRoute(ctx context.Context, id int64) (Route, error) {
	var route Route
	err := s.db.QueryRowContext(ctx,
		"SELECT id, service_id, domain, port, tls, path, certificate_id, proxy_config, created_at, updated_at FROM routes WHERE id = ?", id).
		Scan(&route.ID, &route.ServiceID, &route.Domain, &route.Port, &route.TLS, &route.Path, &route.CertificateID, &route.ProxyConfig, &route.CreatedAt, &route.UpdatedAt)

	if err == sql.ErrNoRows {
		return Route{}, fmt.Errorf("route not found: %d", id)
	}
	if err != nil {
		return Route{}, fmt.Errorf("failed to get route: %w", err)
	}

	return route, nil
}

// GetAllRoutes retrieves all routes (for nginx config generation)
func (s *Store) GetAllRoutes(ctx context.Context) ([]Route, error) {
	rows, err := s.db.QueryContext(ctx,
		"SELECT id, service_id, domain, port, tls, path, certificate_id, proxy_config, created_at, updated_at FROM routes ORDER BY domain")
	if err != nil {
		return nil, fmt.Errorf("failed to query all routes: %w", err)
	}
	defer rows.Close()

	var routes []Route
	for rows.Next() {
		var route Route
		err := rows.Scan(&route.ID, &route.ServiceID, &route.Domain, &route.Port, &route.TLS, &route.Path, &route.CertificateID, &route.ProxyConfig, &route.CreatedAt, &route.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan route: %w", err)
		}
		routes = append(routes, route)
	}

	return routes, rows.Err()
}

// DeleteRoute removes a route by ID
func (s *Store) DeleteRoute(ctx context.Context, id int64) error {
	result, err := s.db.ExecContext(ctx, "DELETE FROM routes WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete route: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check affected rows: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("route not found: %d", id)
	}

	return nil
}

// GetAllRoutesWithServices returns all routes joined with service information
func (s *Store) GetAllRoutesWithServices(ctx context.Context) ([]RouteWithService, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT 
			r.id, r.service_id, r.domain, r.port, r.tls, r.path, r.certificate_id, r.proxy_config, r.created_at, r.updated_at,
			s.name as service_name, p.name as project_name
		FROM routes r
		JOIN services s ON r.service_id = s.id
		JOIN projects p ON s.project_id = p.id
		ORDER BY r.domain`)
	if err != nil {
		return nil, fmt.Errorf("failed to query routes with services: %w", err)
	}
	defer rows.Close()

	var routes []RouteWithService
	for rows.Next() {
		var route RouteWithService
		err := rows.Scan(
			&route.ID, &route.ServiceID, &route.Domain, &route.Port, &route.TLS, &route.Path,
			&route.CertificateID, &route.ProxyConfig, &route.CreatedAt, &route.UpdatedAt,
			&route.ServiceName, &route.ProjectName)
		if err != nil {
			return nil, fmt.Errorf("failed to scan route: %w", err)
		}
		routes = append(routes, route)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate rows: %w", err)
	}

	return routes, nil
}

// UpdateRoute updates an existing route
func (s *Store) UpdateRoute(ctx context.Context, id int64, spec RouteSpec) (Route, error) {
	// Validate domain (basic validation)
	if spec.Domain == "" {
		return Route{}, fmt.Errorf("domain cannot be empty")
	}
	
	if len(spec.Domain) > 253 { // Max domain name length
		return Route{}, fmt.Errorf("domain too long: max 253 characters")
	}

	// Check that route exists
	_, err := s.GetRoute(ctx, id)
	if err != nil {
		return Route{}, fmt.Errorf("route not found: %w", err)
	}

	// Update route
	result, err := s.db.ExecContext(ctx,
		"UPDATE routes SET domain = ?, port = ?, tls = ?, path = ?, certificate_id = ?, proxy_config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		spec.Domain, spec.Port, spec.TLS, spec.Path, spec.CertificateID, spec.ProxyConfig, id)
	if err != nil {
		return Route{}, fmt.Errorf("failed to update route: %w", err)
	}
	
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return Route{}, fmt.Errorf("failed to get rows affected: %w", err)
	}
	if rowsAffected == 0 {
		return Route{}, fmt.Errorf("route not found: %d", id)
	}

	// Get the updated route
	return s.GetRoute(ctx, id)
}

// Certificate operations for nginx proxy

// CreateCertificate creates a new certificate record
func (s *Store) CreateCertificate(ctx context.Context, spec CertificateSpec) (Certificate, error) {
	if spec.Domain == "" {
		return Certificate{}, fmt.Errorf("domain cannot be empty")
	}
	
	if len(spec.Domain) > 253 {
		return Certificate{}, fmt.Errorf("domain too long: max 253 characters")
	}

	// Set default AutoRenew if not specified
	autoRenew := true
	if spec.AutoRenew != nil {
		autoRenew = *spec.AutoRenew
	}

	// Create certificate struct for encryption
	cert := Certificate{
		Domain:    spec.Domain,
		Type:      spec.Type,
		CertData:  spec.CertData,
		KeyData:   spec.KeyData,
		AutoRenew: autoRenew,
	}

	// Encrypt key data if present
	if cert.KeyData != nil && *cert.KeyData != "" {
		masterKey, err := s.getMasterKey()
		if err != nil {
			return Certificate{}, fmt.Errorf("failed to get master key for encryption: %w", err)
		}
		
		if err := cert.EncryptKeyData(masterKey); err != nil {
			return Certificate{}, fmt.Errorf("failed to encrypt key data: %w", err)
		}
	}

	result, err := s.db.ExecContext(ctx,
		"INSERT INTO certificates (domain, type, cert_data, key_data, key_data_nonce, auto_renew) VALUES (?, ?, ?, ?, ?, ?)",
		cert.Domain, cert.Type, cert.CertData, cert.KeyData, cert.KeyDataNonce, cert.AutoRenew)
	if err != nil {
		return Certificate{}, fmt.Errorf("failed to create certificate: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return Certificate{}, fmt.Errorf("failed to get certificate ID: %w", err)
	}

	return s.GetCertificate(ctx, id)
}

// GetCertificate retrieves a certificate by ID
func (s *Store) GetCertificate(ctx context.Context, id int64) (Certificate, error) {
	var cert Certificate
	err := s.db.QueryRowContext(ctx,
		"SELECT id, domain, type, cert_data, key_data, key_data_nonce, expires_at, auto_renew, created_at, updated_at FROM certificates WHERE id = ?", id).
		Scan(&cert.ID, &cert.Domain, &cert.Type, &cert.CertData, &cert.KeyData, &cert.KeyDataNonce, &cert.ExpiresAt, &cert.AutoRenew, &cert.CreatedAt, &cert.UpdatedAt)

	if err == sql.ErrNoRows {
		return Certificate{}, fmt.Errorf("certificate not found: %d", id)
	}
	if err != nil {
		return Certificate{}, fmt.Errorf("failed to get certificate: %w", err)
	}

	// Decrypt key data if present
	if cert.KeyData != nil && cert.KeyDataNonce != nil && *cert.KeyData != "" && *cert.KeyDataNonce != "" {
		masterKey, err := s.getMasterKey()
		if err != nil {
			return Certificate{}, fmt.Errorf("failed to get master key for decryption: %w", err)
		}
		
		if err := cert.DecryptKeyData(masterKey); err != nil {
			return Certificate{}, fmt.Errorf("failed to decrypt key data: %w", err)
		}
	}

	return cert, nil
}

// GetCertificateByDomain retrieves a certificate by domain
func (s *Store) GetCertificateByDomain(ctx context.Context, domain string) (Certificate, error) {
	var cert Certificate
	err := s.db.QueryRowContext(ctx,
		"SELECT id, domain, type, cert_data, key_data, key_data_nonce, expires_at, auto_renew, created_at, updated_at FROM certificates WHERE domain = ?", domain).
		Scan(&cert.ID, &cert.Domain, &cert.Type, &cert.CertData, &cert.KeyData, &cert.KeyDataNonce, &cert.ExpiresAt, &cert.AutoRenew, &cert.CreatedAt, &cert.UpdatedAt)

	if err == sql.ErrNoRows {
		return Certificate{}, fmt.Errorf("certificate not found for domain: %s", domain)
	}
	if err != nil {
		return Certificate{}, fmt.Errorf("failed to get certificate by domain: %w", err)
	}

	// Decrypt key data if present
	if cert.KeyData != nil && cert.KeyDataNonce != nil && *cert.KeyData != "" && *cert.KeyDataNonce != "" {
		masterKey, err := s.getMasterKey()
		if err != nil {
			return Certificate{}, fmt.Errorf("failed to get master key for decryption: %w", err)
		}
		
		if err := cert.DecryptKeyData(masterKey); err != nil {
			return Certificate{}, fmt.Errorf("failed to decrypt key data: %w", err)
		}
	}

	return cert, nil
}

// ListCertificates retrieves all enhanced certificates
func (s *Store) ListCertificates(ctx context.Context) ([]EnhancedCertificate, error) {
	query := `
		SELECT id, domain, type, issuer, not_before, not_after, status, 
			   pem_cert, pem_chain, pem_key_enc, pem_key_nonce, 
			   created_at, updated_at
		FROM certificates_enhanced 
		ORDER BY domain`
	
	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query enhanced certificates: %w", err)
	}
	defer rows.Close()

	var certificates []EnhancedCertificate
	masterKey, keyErr := s.getMasterKey()
	
	for rows.Next() {
		var cert EnhancedCertificate
		err := rows.Scan(
			&cert.ID, &cert.Domain, &cert.Type, &cert.Issuer, 
			&cert.NotBefore, &cert.NotAfter, &cert.Status,
			&cert.PEMCert, &cert.PEMChain, &cert.PEMKeyEnc, &cert.PEMKeyNonce,
			&cert.CreatedAt, &cert.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan enhanced certificate: %w", err)
		}
		
		// Decrypt key data if present and master key is available
		if keyErr == nil && cert.PEMKeyEnc != nil && cert.PEMKeyNonce != nil && *cert.PEMKeyEnc != "" && *cert.PEMKeyNonce != "" {
			if err := cert.DecryptPEMKey(masterKey); err != nil {
				log.Warn().Err(err).Str("domain", cert.Domain).Msg("failed to decrypt certificate private key")
			}
		}
		
		certificates = append(certificates, cert)
	}

	return certificates, rows.Err()
}

// DNS Provider Methods

// CreateDNSProvider creates a new DNS provider
func (s *Store) CreateDNSProvider(ctx context.Context, spec DNSProviderSpec) (DNSProvider, error) {
	var provider DNSProvider
	
	// Marshal config to JSON
	configBytes, err := json.Marshal(spec.Config)
	if err != nil {
		return provider, fmt.Errorf("failed to marshal DNS provider config: %w", err)
	}
	configJSON := string(configBytes)
	
	now := time.Now()
	query := `
		INSERT INTO dns_providers (name, type, config_json, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?)
	`
	
	result, err := s.db.ExecContext(ctx, query, spec.Name, spec.Type, configJSON, now, now)
	if err != nil {
		return provider, fmt.Errorf("failed to create DNS provider: %w", err)
	}
	
	id, err := result.LastInsertId()
	if err != nil {
		return provider, fmt.Errorf("failed to get DNS provider ID: %w", err)
	}
	
	provider = DNSProvider{
		ID:         id,
		Name:       spec.Name,
		Type:       spec.Type,
		ConfigJSON: configJSON,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
	
	return provider, nil
}

// ListDNSProviders retrieves all DNS providers
func (s *Store) ListDNSProviders(ctx context.Context) ([]DNSProvider, error) {
	query := `
		SELECT id, name, type, config_json, created_at, updated_at
		FROM dns_providers
		ORDER BY name
	`
	
	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query DNS providers: %w", err)
	}
	defer rows.Close()
	
	var providers []DNSProvider
	for rows.Next() {
		var provider DNSProvider
		err := rows.Scan(
			&provider.ID, &provider.Name, &provider.Type, 
			&provider.ConfigJSON, &provider.CreatedAt, &provider.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan DNS provider: %w", err)
		}
		providers = append(providers, provider)
	}
	
	return providers, rows.Err()
}

// Domain Methods

// generateRandomToken generates a random token of specified length
func generateRandomToken(length int) string {
	bytes := make([]byte, length)
	if _, err := rand.Read(bytes); err != nil {
		// Fallback to timestamp-based token if random fails
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(bytes)[:length]
}

// CreateDomain creates a new domain with a verification token
func (s *Store) CreateDomain(ctx context.Context, domain *Domain) (int64, error) {
	if domain.Name == "" {
		return 0, fmt.Errorf("domain name cannot be empty")
	}
	
	// Generate verification token if not provided
	if domain.VerificationToken == "" {
		domain.VerificationToken = generateRandomToken(32)
	}
	
	// Set default status if not provided
	if domain.Status == "" {
		domain.Status = DomainStatusPending
	}
	
	result, err := s.db.ExecContext(ctx,
		`INSERT INTO domains (name, status, provider, zone_id, verification_token, verification_checked_at, certificate_id, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		domain.Name, domain.Status, domain.Provider, domain.ZoneID, domain.VerificationToken, domain.VerificationCheckedAt, domain.CertificateID)
	
	if err != nil {
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return 0, fmt.Errorf("domain %s already exists", domain.Name)
		}
		return 0, fmt.Errorf("failed to create domain: %w", err)
	}
	
	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("failed to get domain ID: %w", err)
	}
	
	return id, nil
}

// GetDomainByName retrieves a domain by its name
func (s *Store) GetDomainByName(ctx context.Context, name string) (*Domain, error) {
	var domain Domain
	var provider, zoneID sql.NullString
	var verificationCheckedAt sql.NullTime
	var certificateID sql.NullInt64
	
	err := s.db.QueryRowContext(ctx,
		`SELECT id, name, status, provider, zone_id, verification_token, verification_checked_at, certificate_id, created_at, updated_at
		 FROM domains WHERE name = ?`, name).
		Scan(&domain.ID, &domain.Name, &domain.Status, &provider, &zoneID, &domain.VerificationToken, 
			&verificationCheckedAt, &certificateID, &domain.CreatedAt, &domain.UpdatedAt)
	
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("domain not found: %s", name)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get domain: %w", err)
	}
	
	// Handle nullable fields
	if provider.Valid {
		domain.Provider = &provider.String
	}
	if zoneID.Valid {
		domain.ZoneID = &zoneID.String
	}
	if verificationCheckedAt.Valid {
		domain.VerificationCheckedAt = &verificationCheckedAt.Time
	}
	if certificateID.Valid {
		domain.CertificateID = &certificateID.Int64
	}
	
	return &domain, nil
}

// ListDomains returns domains filtered by status (empty slice returns all domains)
func (s *Store) ListDomains(ctx context.Context, statuses []string) ([]Domain, error) {
	var query string
	var args []interface{}
	
	if len(statuses) == 0 {
		// Return all domains
		query = `SELECT id, name, status, provider, zone_id, verification_token, verification_checked_at, certificate_id, created_at, updated_at
				 FROM domains ORDER BY created_at DESC`
	} else {
		// Filter by statuses
		placeholders := strings.Repeat("?,", len(statuses))
		placeholders = placeholders[:len(placeholders)-1] // Remove trailing comma
		query = fmt.Sprintf(`SELECT id, name, status, provider, zone_id, verification_token, verification_checked_at, certificate_id, created_at, updated_at
							 FROM domains WHERE status IN (%s) ORDER BY created_at DESC`, placeholders)
		
		for _, status := range statuses {
			args = append(args, status)
		}
	}
	
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to list domains: %w", err)
	}
	defer rows.Close()
	
	var domains []Domain
	for rows.Next() {
		var domain Domain
		var provider, zoneID sql.NullString
		var verificationCheckedAt sql.NullTime
		var certificateID sql.NullInt64
		
		err := rows.Scan(&domain.ID, &domain.Name, &domain.Status, &provider, &zoneID, 
			&domain.VerificationToken, &verificationCheckedAt, &certificateID, 
			&domain.CreatedAt, &domain.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan domain: %w", err)
		}
		
		// Handle nullable fields
		if provider.Valid {
			domain.Provider = &provider.String
		}
		if zoneID.Valid {
			domain.ZoneID = &zoneID.String
		}
		if verificationCheckedAt.Valid {
			domain.VerificationCheckedAt = &verificationCheckedAt.Time
		}
		if certificateID.Valid {
			domain.CertificateID = &certificateID.Int64
		}
		
		domains = append(domains, domain)
	}
	
	return domains, rows.Err()
}

// UpdateDomainStatus updates a domain's status and optionally its certificate ID
func (s *Store) UpdateDomainStatus(ctx context.Context, id int64, status string, certID *int64) error {
	// Validate status
	validStatuses := map[string]bool{
		DomainStatusPending:   true,
		DomainStatusVerifying: true,
		DomainStatusVerified:  true,
		DomainStatusActive:    true,
		DomainStatusError:     true,
	}
	
	if !validStatuses[status] {
		return fmt.Errorf("invalid domain status: %s", status)
	}
	
	result, err := s.db.ExecContext(ctx,
		`UPDATE domains SET status = ?, certificate_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
		status, certID, id)
	
	if err != nil {
		return fmt.Errorf("failed to update domain status: %w", err)
	}
	
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	
	if rowsAffected == 0 {
		return fmt.Errorf("domain not found: %d", id)
	}
	
	return nil
}

// GetDB returns the database connection (for services that need direct access)
func (s *Store) GetDB() *sql.DB {
	return s.db
}

// GetEnhancedCertificate retrieves an enhanced certificate by ID
func (s *Store) GetEnhancedCertificate(ctx context.Context, id int64) (EnhancedCertificate, error) {
	var cert EnhancedCertificate
	
	query := `
		SELECT id, domain, type, issuer, not_before, not_after, status, 
			   pem_cert, pem_chain, pem_key_enc, pem_key_nonce, 
			   created_at, updated_at
		FROM certificates_enhanced 
		WHERE id = ?
	`
	
	err := s.db.QueryRowContext(ctx, query, id).Scan(
		&cert.ID, &cert.Domain, &cert.Type, &cert.Issuer, 
		&cert.NotBefore, &cert.NotAfter, &cert.Status,
		&cert.PEMCert, &cert.PEMChain, &cert.PEMKeyEnc, &cert.PEMKeyNonce,
		&cert.CreatedAt, &cert.UpdatedAt,
	)
	if err != nil {
		return cert, fmt.Errorf("failed to get enhanced certificate: %w", err)
	}
	
	// Decrypt key data if present and master key is available
	masterKey, keyErr := s.getMasterKey()
	if keyErr == nil && cert.PEMKeyEnc != nil && cert.PEMKeyNonce != nil && *cert.PEMKeyEnc != "" && *cert.PEMKeyNonce != "" {
		if err := cert.DecryptPEMKey(masterKey); err != nil {
			log.Warn().Err(err).Str("domain", cert.Domain).Msg("failed to decrypt certificate private key")
		}
	}
	
	return cert, nil
}

// UpdateCertificate updates an existing certificate
func (s *Store) UpdateCertificate(ctx context.Context, id int64, spec CertificateSpec) (Certificate, error) {
	if spec.Domain == "" {
		return Certificate{}, fmt.Errorf("domain cannot be empty")
	}
	
	if len(spec.Domain) > 253 {
		return Certificate{}, fmt.Errorf("domain too long: max 253 characters")
	}

	// Set default AutoRenew if not specified
	autoRenew := true
	if spec.AutoRenew != nil {
		autoRenew = *spec.AutoRenew
	}

	// Create certificate struct for encryption
	cert := Certificate{
		Domain:    spec.Domain,
		Type:      spec.Type,
		CertData:  spec.CertData,
		KeyData:   spec.KeyData,
		AutoRenew: autoRenew,
	}

	// Encrypt key data if present
	if cert.KeyData != nil && *cert.KeyData != "" {
		masterKey, err := s.getMasterKey()
		if err != nil {
			return Certificate{}, fmt.Errorf("failed to get master key for encryption: %w", err)
		}
		
		if err := cert.EncryptKeyData(masterKey); err != nil {
			return Certificate{}, fmt.Errorf("failed to encrypt key data: %w", err)
		}
	}

	result, err := s.db.ExecContext(ctx,
		"UPDATE certificates SET domain = ?, type = ?, cert_data = ?, key_data = ?, key_data_nonce = ?, auto_renew = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
		cert.Domain, cert.Type, cert.CertData, cert.KeyData, cert.KeyDataNonce, cert.AutoRenew, id)
	if err != nil {
		return Certificate{}, fmt.Errorf("failed to update certificate: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return Certificate{}, fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return Certificate{}, fmt.Errorf("certificate not found: %d", id)
	}

	return s.GetCertificate(ctx, id)
}

// DeleteCertificate removes a certificate by ID
func (s *Store) DeleteCertificate(ctx context.Context, id int64) error {
	result, err := s.db.ExecContext(ctx, "DELETE FROM certificates WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete certificate: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check affected rows: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("certificate not found: %d", id)
	}

	return nil
}

// NginxConfig management methods

// CreateNginxConfig creates a new nginx configuration record
func (s *Store) CreateNginxConfig(ctx context.Context, configHash, configContent string) (NginxConfig, error) {
	if configHash == "" {
		return NginxConfig{}, fmt.Errorf("config_hash cannot be empty")
	}
	if configContent == "" {
		return NginxConfig{}, fmt.Errorf("config_content cannot be empty")
	}

	result, err := s.db.ExecContext(ctx,
		"INSERT INTO nginx_configs (config_hash, config_content, active) VALUES (?, ?, ?)",
		configHash, configContent, false)
	if err != nil {
		return NginxConfig{}, fmt.Errorf("failed to create nginx config: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return NginxConfig{}, fmt.Errorf("failed to get nginx config ID: %w", err)
	}

	return s.GetNginxConfig(ctx, id)
}

// GetNginxConfig retrieves a nginx configuration by ID
func (s *Store) GetNginxConfig(ctx context.Context, id int64) (NginxConfig, error) {
	var config NginxConfig
	err := s.db.QueryRowContext(ctx,
		"SELECT id, config_hash, config_content, active, created_at FROM nginx_configs WHERE id = ?", id).
		Scan(&config.ID, &config.ConfigHash, &config.ConfigContent, &config.Active, &config.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return NginxConfig{}, fmt.Errorf("nginx config not found: %d", id)
		}
		return NginxConfig{}, fmt.Errorf("failed to get nginx config: %w", err)
	}

	return config, nil
}

// GetNginxConfigByHash retrieves a nginx configuration by config hash
func (s *Store) GetNginxConfigByHash(ctx context.Context, configHash string) (NginxConfig, error) {
	var config NginxConfig
	err := s.db.QueryRowContext(ctx,
		"SELECT id, config_hash, config_content, active, created_at FROM nginx_configs WHERE config_hash = ?", configHash).
		Scan(&config.ID, &config.ConfigHash, &config.ConfigContent, &config.Active, &config.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return NginxConfig{}, fmt.Errorf("nginx config not found for hash: %s", configHash)
		}
		return NginxConfig{}, fmt.Errorf("failed to get nginx config by hash: %w", err)
	}

	return config, nil
}

// GetActiveNginxConfig retrieves the currently active nginx configuration
func (s *Store) GetActiveNginxConfig(ctx context.Context) (NginxConfig, error) {
	var config NginxConfig
	err := s.db.QueryRowContext(ctx,
		"SELECT id, config_hash, config_content, active, created_at FROM nginx_configs WHERE active = 1 LIMIT 1").
		Scan(&config.ID, &config.ConfigHash, &config.ConfigContent, &config.Active, &config.CreatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return NginxConfig{}, fmt.Errorf("no active nginx config found")
		}
		return NginxConfig{}, fmt.Errorf("failed to get active nginx config: %w", err)
	}

	return config, nil
}

// SetActiveNginxConfig marks a nginx configuration as active and deactivates all others
func (s *Store) SetActiveNginxConfig(ctx context.Context, configID int64) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Deactivate all existing configs
	_, err = tx.ExecContext(ctx, "UPDATE nginx_configs SET active = 0")
	if err != nil {
		return fmt.Errorf("failed to deactivate existing configs: %w", err)
	}

	// Activate the specified config
	result, err := tx.ExecContext(ctx, "UPDATE nginx_configs SET active = 1 WHERE id = ?", configID)
	if err != nil {
		return fmt.Errorf("failed to activate config: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check affected rows: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("nginx config not found: %d", configID)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

// GetLastUpdatedTimestamp returns the maximum updated_at timestamp from routes and certificates
func (s *Store) GetLastUpdatedTimestamp(ctx context.Context) (time.Time, error) {
	var maxTimestamp time.Time
	
	// Query for the maximum updated_at from both routes and certificates
	err := s.db.QueryRowContext(ctx, `
		SELECT MAX(datetime) as max_time FROM (
			SELECT MAX(updated_at) as datetime FROM routes WHERE updated_at IS NOT NULL
			UNION ALL
			SELECT MAX(updated_at) as datetime FROM certificates WHERE updated_at IS NOT NULL
		)`).Scan(&maxTimestamp)
	
	if err != nil {
		if err == sql.ErrNoRows {
			return time.Time{}, nil // No updates found
		}
		return time.Time{}, fmt.Errorf("failed to get last updated timestamp: %w", err)
	}

	return maxTimestamp, nil
}

// Legacy certificate management methods (for the existing certs table)

// UpsertCert creates or updates a certificate record
func (s *Store) UpsertCert(ctx context.Context, domain, email, status string, expiresAt *time.Time) error {
	var lastIssuedAt *time.Time
	if status == "issued" {
		now := time.Now()
		lastIssuedAt = &now
	}

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO certs (domain, email, status, last_issued_at, expires_at)
		VALUES (?, ?, ?, ?, ?)
		ON CONFLICT(domain) DO UPDATE SET
			email = excluded.email,
			status = excluded.status,
			last_issued_at = excluded.last_issued_at,
			expires_at = excluded.expires_at
	`, domain, email, status, lastIssuedAt, expiresAt)
	
	if err != nil {
		return fmt.Errorf("failed to upsert cert for domain %s: %w", domain, err)
	}
	
	return nil
}

// GetCert retrieves a certificate by domain
func (s *Store) GetCert(ctx context.Context, domain string) (Cert, error) {
	var cert Cert
	err := s.db.QueryRowContext(ctx,
		"SELECT id, domain, email, status, last_issued_at, expires_at, created_at FROM certs WHERE domain = ?",
		domain).Scan(&cert.ID, &cert.Domain, &cert.Email, &cert.Status, &cert.LastIssuedAt, &cert.ExpiresAt, &cert.CreatedAt)
	
	if err == sql.ErrNoRows {
		return cert, ErrNotFound
	}
	if err != nil {
		return cert, fmt.Errorf("failed to get cert for domain %s: %w", domain, err)
	}
	
	return cert, nil
}

// ListCerts retrieves all certificates
func (s *Store) ListCerts(ctx context.Context) ([]Cert, error) {
	rows, err := s.db.QueryContext(ctx,
		"SELECT id, domain, email, status, last_issued_at, expires_at, created_at FROM certs ORDER BY domain")
	if err != nil {
		return nil, fmt.Errorf("failed to query certs: %w", err)
	}
	defer rows.Close()

	var certs []Cert
	for rows.Next() {
		var cert Cert
		err := rows.Scan(&cert.ID, &cert.Domain, &cert.Email, &cert.Status, &cert.LastIssuedAt, &cert.ExpiresAt, &cert.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan cert: %w", err)
		}
		certs = append(certs, cert)
	}

	return certs, rows.Err()
}

// ListCertsExpiringSoon retrieves certificates that expire within the given duration
func (s *Store) ListCertsExpiringSoon(ctx context.Context, within time.Duration) ([]Cert, error) {
	threshold := time.Now().Add(within)
	
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, domain, email, status, last_issued_at, expires_at, created_at 
		FROM certs 
		WHERE expires_at IS NOT NULL AND expires_at <= ? 
		ORDER BY expires_at`,
		threshold)
	if err != nil {
		return nil, fmt.Errorf("failed to query expiring certs: %w", err)
	}
	defer rows.Close()

	var certs []Cert
	for rows.Next() {
		var cert Cert
		err := rows.Scan(&cert.ID, &cert.Domain, &cert.Email, &cert.Status, &cert.LastIssuedAt, &cert.ExpiresAt, &cert.CreatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan cert: %w", err)
		}
		certs = append(certs, cert)
	}

	return certs, rows.Err()
}

// Client management methods

// CreateClient creates a new client record
func (s *Store) CreateClient(ctx context.Context, spec ClientSpec) (Client, error) {
	result, err := s.db.ExecContext(ctx, `
		INSERT INTO clients (name, status, last_ip, last_seen_at)
		VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
		spec.Name, ClientStatusActive, nullableString(spec.IP))
	if err != nil {
		return Client{}, fmt.Errorf("failed to create client: %w", err)
	}
	
	id, err := result.LastInsertId()
	if err != nil {
		return Client{}, fmt.Errorf("failed to get client id: %w", err)
	}
	
	return s.GetClient(ctx, id)
}

// GetClient retrieves a client by ID
func (s *Store) GetClient(ctx context.Context, id int64) (Client, error) {
	var client Client
	err := s.db.QueryRowContext(ctx, `
		SELECT id, name, token_id, status, last_ip, last_seen_at, created_at, updated_at
		FROM clients WHERE id = ?`, id).Scan(
		&client.ID, &client.Name, &client.TokenID, &client.Status,
		&client.LastIP, &client.LastSeenAt, &client.CreatedAt, &client.UpdatedAt)
	
	if err == sql.ErrNoRows {
		return Client{}, ErrNotFound
	}
	if err != nil {
		return Client{}, fmt.Errorf("failed to get client: %w", err)
	}
	
	return client, nil
}

// GetClientByName retrieves a client by name
func (s *Store) GetClientByName(ctx context.Context, name string) (Client, error) {
	var client Client
	err := s.db.QueryRowContext(ctx, `
		SELECT id, name, token_id, status, last_ip, last_seen_at, created_at, updated_at
		FROM clients WHERE name = ?`, name).Scan(
		&client.ID, &client.Name, &client.TokenID, &client.Status,
		&client.LastIP, &client.LastSeenAt, &client.CreatedAt, &client.UpdatedAt)
	
	if err == sql.ErrNoRows {
		return Client{}, ErrNotFound
	}
	if err != nil {
		return Client{}, fmt.Errorf("failed to get client by name: %w", err)
	}
	
	return client, nil
}

// ListClients retrieves all clients
func (s *Store) ListClients(ctx context.Context) ([]Client, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, name, token_id, status, last_ip, last_seen_at, created_at, updated_at
		FROM clients ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("failed to query clients: %w", err)
	}
	defer rows.Close()
	
	var clients []Client
	for rows.Next() {
		var client Client
		err := rows.Scan(&client.ID, &client.Name, &client.TokenID, &client.Status,
			&client.LastIP, &client.LastSeenAt, &client.CreatedAt, &client.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan client: %w", err)
		}
		clients = append(clients, client)
	}
	
	return clients, rows.Err()
}

// CountActiveClients returns the count of active clients
func (s *Store) CountActiveClients(ctx context.Context) (int, error) {
	var count int
	err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(*) FROM clients 
		WHERE status = ?`, ClientStatusActive).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count active clients: %w", err)
	}
	return count, nil
}

// TouchClient updates client last seen timestamp and IP
func (s *Store) TouchClient(ctx context.Context, name, ip string) error {
	// Try to get existing client first
	_, err := s.GetClientByName(ctx, name)
	if err == ErrNotFound {
		// Create new client
		_, err = s.CreateClient(ctx, ClientSpec{Name: name, IP: ip})
		return err
	}
	if err != nil {
		return err
	}
	
	// Update existing client
	_, err = s.db.ExecContext(ctx, `
		UPDATE clients 
		SET status = ?, last_ip = ?, last_seen_at = CURRENT_TIMESTAMP
		WHERE name = ?`,
		ClientStatusActive, nullableString(ip), name)
	if err != nil {
		return fmt.Errorf("failed to touch client: %w", err)
	}
	
	return nil
}

// DeleteClient removes a client by ID
func (s *Store) DeleteClient(ctx context.Context, id int64) error {
	result, err := s.db.ExecContext(ctx, "DELETE FROM clients WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("failed to delete client: %w", err)
	}
	
	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get affected rows: %w", err)
	}
	
	if rows == 0 {
		return ErrNotFound
	}
	
	return nil
}

// User management operations for GitHub OAuth

// UpsertUser creates or updates a user based on GitHub ID
func (s *Store) UpsertUser(ctx context.Context, user User) (User, error) {
	// Check if user exists by GitHub ID
	var existingUser User
	err := s.db.QueryRowContext(ctx, `
		SELECT id, github_id, login, name, avatar_url, role, created_at, updated_at, last_login_at
		FROM users WHERE github_id = ?`, user.GitHubID).Scan(
		&existingUser.ID, &existingUser.GitHubID, &existingUser.Login, 
		&existingUser.Name, &existingUser.AvatarURL, &existingUser.Role, 
		&existingUser.CreatedAt, &existingUser.UpdatedAt, &existingUser.LastLoginAt)

	if err == sql.ErrNoRows {
		// Insert new user
		result, err := s.db.ExecContext(ctx, `
			INSERT INTO users (github_id, login, name, avatar_url, role, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
			user.GitHubID, user.Login, user.Name, user.AvatarURL, user.Role)
		if err != nil {
			return User{}, fmt.Errorf("failed to insert user: %w", err)
		}

		id, err := result.LastInsertId()
		if err != nil {
			return User{}, fmt.Errorf("failed to get inserted user ID: %w", err)
		}

		// Return the created user
		return s.GetUserByID(ctx, id)
	} else if err != nil {
		return User{}, fmt.Errorf("failed to check existing user: %w", err)
	}

	// Update existing user (preserve role)
	_, err = s.db.ExecContext(ctx, `
		UPDATE users 
		SET login = ?, name = ?, avatar_url = ?, updated_at = CURRENT_TIMESTAMP
		WHERE github_id = ?`,
		user.Login, user.Name, user.AvatarURL, user.GitHubID)
	if err != nil {
		return User{}, fmt.Errorf("failed to update user: %w", err)
	}

	return s.GetUserByGitHubID(ctx, user.GitHubID)
}

// GetUserByGitHubID retrieves a user by their GitHub ID
func (s *Store) GetUserByGitHubID(ctx context.Context, githubID int64) (User, error) {
	var user User
	var lastLoginAt sql.NullTime
	
	err := s.db.QueryRowContext(ctx, `
		SELECT id, github_id, login, name, avatar_url, role, created_at, updated_at, last_login_at
		FROM users WHERE github_id = ?`, githubID).Scan(
		&user.ID, &user.GitHubID, &user.Login, &user.Name, 
		&user.AvatarURL, &user.Role, &user.CreatedAt, &user.UpdatedAt, &lastLoginAt)

	if err == sql.ErrNoRows {
		return User{}, fmt.Errorf("user not found with GitHub ID: %d", githubID)
	}
	if err != nil {
		return User{}, fmt.Errorf("failed to get user by GitHub ID: %w", err)
	}

	if lastLoginAt.Valid {
		user.LastLoginAt = &lastLoginAt.Time
	}

	return user, nil
}

// GetUserByID retrieves a user by their internal ID
func (s *Store) GetUserByID(ctx context.Context, id int64) (User, error) {
	var user User
	var lastLoginAt sql.NullTime
	
	err := s.db.QueryRowContext(ctx, `
		SELECT id, github_id, login, name, avatar_url, role, created_at, updated_at, last_login_at
		FROM users WHERE id = ?`, id).Scan(
		&user.ID, &user.GitHubID, &user.Login, &user.Name, 
		&user.AvatarURL, &user.Role, &user.CreatedAt, &user.UpdatedAt, &lastLoginAt)

	if err == sql.ErrNoRows {
		return User{}, fmt.Errorf("user not found with ID: %d", id)
	}
	if err != nil {
		return User{}, fmt.Errorf("failed to get user by ID: %w", err)
	}

	if lastLoginAt.Valid {
		user.LastLoginAt = &lastLoginAt.Time
	}

	return user, nil
}

// CountUsers returns the total number of users
func (s *Store) CountUsers(ctx context.Context) (int, error) {
	var count int
	err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM users`).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count users: %w", err)
	}
	return count, nil
}

// UpdateUserLastLogin updates the last login timestamp for a user
func (s *Store) UpdateUserLastLogin(ctx context.Context, id int64) error {
	_, err := s.db.ExecContext(ctx, `
		UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("failed to update user last login: %w", err)
	}
	return nil
}

// ListUsers retrieves all users (for admin purposes)
func (s *Store) ListUsers(ctx context.Context) ([]User, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, github_id, login, name, avatar_url, role, created_at, updated_at, last_login_at
		FROM users ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("failed to query users: %w", err)
	}
	defer rows.Close()

	var users []User
	for rows.Next() {
		var user User
		var lastLoginAt sql.NullTime
		
		err := rows.Scan(&user.ID, &user.GitHubID, &user.Login, &user.Name, 
			&user.AvatarURL, &user.Role, &user.CreatedAt, &user.UpdatedAt, &lastLoginAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan user: %w", err)
		}

		if lastLoginAt.Valid {
			user.LastLoginAt = &lastLoginAt.Time
		}

		users = append(users, user)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate users: %w", err)
	}

	return users, nil
}

// UpdateUserRole updates a user's role (admin only operation)
func (s *Store) UpdateUserRole(ctx context.Context, userID int64, role string) error {
	if !IsRoleValid(role) {
		return fmt.Errorf("invalid role: %s", role)
	}

	result, err := s.db.ExecContext(ctx, `
		UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
		role, userID)
	if err != nil {
		return fmt.Errorf("failed to update user role: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("user not found with ID: %d", userID)
	}

	return nil
}

// DeleteUser removes a user (admin only operation)
func (s *Store) DeleteUser(ctx context.Context, userID int64) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM users WHERE id = ?`, userID)
	if err != nil {
		return fmt.Errorf("failed to delete user: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return fmt.Errorf("user not found with ID: %d", userID)
	}

	return nil
}

// CreateAuditEntry creates a new audit log entry
func (s *Store) CreateAuditEntry(ctx context.Context, entry *audit.Entry) error {
	metaJSON := "{}"
	if entry.Meta != nil {
		metaBytes, err := json.Marshal(entry.Meta)
		if err != nil {
			return fmt.Errorf("failed to marshal audit metadata: %w", err)
		}
		metaJSON = string(metaBytes)
	}

	_, err := s.db.ExecContext(ctx, `
		INSERT INTO audit_entries (timestamp, actor, action, target_type, target_id, meta)
		VALUES (?, ?, ?, ?, ?, ?)`,
		entry.Timestamp, entry.Actor, string(entry.Action), entry.TargetType, entry.TargetID, metaJSON)
	
	if err != nil {
		return fmt.Errorf("failed to create audit entry: %w", err)
	}
	
	return nil
}

// GetAuditEntries retrieves recent audit entries
func (s *Store) GetAuditEntries(ctx context.Context, limit int) ([]audit.Entry, error) {
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, timestamp, actor, action, target_type, target_id, meta
		FROM audit_entries
		ORDER BY timestamp DESC
		LIMIT ?`, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query audit entries: %w", err)
	}
	defer rows.Close()

	var entries []audit.Entry
	for rows.Next() {
		var entry audit.Entry
		var metaJSON string
		
		err := rows.Scan(&entry.ID, &entry.Timestamp, &entry.Actor, 
			&entry.Action, &entry.TargetType, &entry.TargetID, &metaJSON)
		if err != nil {
			return nil, fmt.Errorf("failed to scan audit entry: %w", err)
		}

		// Unmarshal metadata
		if err := json.Unmarshal([]byte(metaJSON), &entry.Meta); err != nil {
			// If unmarshaling fails, use empty map
			entry.Meta = make(map[string]interface{})
		}

		entries = append(entries, entry)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate audit entries: %w", err)
	}

	return entries, nil
}

// nullableString converts an empty string to nil for database storage
func nullableString(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

// SystemConfig methods for storing system-wide configuration

// GetSystemConfig retrieves a system configuration value by key
func (s *Store) GetSystemConfig(ctx context.Context, key string) (string, error) {
	var value string
	err := s.db.QueryRowContext(ctx, `
		SELECT value FROM system_config WHERE key = ?`, key).Scan(&value)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", ErrNotFound
		}
		return "", fmt.Errorf("failed to get system config %s: %w", key, err)
	}
	return value, nil
}

// SetSystemConfig sets a system configuration value
func (s *Store) SetSystemConfig(ctx context.Context, key, value string) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT OR REPLACE INTO system_config (key, value, updated_at) 
		VALUES (?, ?, CURRENT_TIMESTAMP)`, key, value)
	if err != nil {
		return fmt.Errorf("failed to set system config %s: %w", key, err)
	}
	return nil
}

// IsOnboardingCompleted checks if the onboarding process has been completed
func (s *Store) IsOnboardingCompleted(ctx context.Context) (bool, error) {
	value, err := s.GetSystemConfig(ctx, "onboarding_completed")
	if err != nil {
		if err == ErrNotFound {
			return false, nil // Default to not completed if not set
		}
		return false, err
	}
	return value == "true", nil
}

// CompleteOnboarding marks the onboarding process as completed
func (s *Store) CompleteOnboarding(ctx context.Context) error {
	return s.SetSystemConfig(ctx, "onboarding_completed", "true")
}

// UserCount returns the number of users in the system
func (s *Store) UserCount(ctx context.Context) (int, error) {
	var count int
	err := s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM users`).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count users: %w", err)
	}
	return count, nil
}

// IsOnboardingNeeded checks if onboarding is needed by looking for existing projects
func (s *Store) IsOnboardingNeeded(ctx context.Context) (bool, error) {
	// Check if onboarding was already completed
	completed, err := s.IsOnboardingCompleted(ctx)
	if err != nil {
		return false, err
	}
	if completed {
		return false, nil
	}

	// Check if any projects exist (skip onboarding if projects exist)
	var projectCount int
	err = s.db.QueryRowContext(ctx, "SELECT COUNT(*) FROM projects").Scan(&projectCount)
	if err != nil {
		return false, fmt.Errorf("failed to count projects: %w", err)
	}

	// Onboarding is needed if no projects exist and onboarding not completed
	return projectCount == 0, nil
}

// Historical metrics operations

// CreateHistoricalMetric stores a system resource data point
func (s *Store) CreateHistoricalMetric(ctx context.Context, metric HistoricalMetric) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO historical_metrics (timestamp, cpu_percent, memory_used, memory_total, 
			disk_used, disk_total, network_rx, network_tx)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		metric.Timestamp, metric.CPUPercent, metric.MemoryUsed, metric.MemoryTotal,
		metric.DiskUsed, metric.DiskTotal, metric.NetworkRX, metric.NetworkTX)
	
	if err != nil {
		return fmt.Errorf("failed to create historical metric: %w", err)
	}
	
	return nil
}

// GetHistoricalMetrics retrieves historical metrics within a time range
func (s *Store) GetHistoricalMetrics(ctx context.Context, since time.Time, limit int) ([]HistoricalMetric, error) {
	if limit <= 0 {
		limit = 100 // Default to 100 data points
	} else if limit > 50000 {
		limit = 50000 // Cap at 50k for safety
	}
	
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, timestamp, cpu_percent, memory_used, memory_total, 
			disk_used, disk_total, network_rx, network_tx
		FROM historical_metrics 
		WHERE timestamp >= ?
		ORDER BY timestamp ASC
		LIMIT ?`, since, limit)
	
	if err != nil {
		return nil, fmt.Errorf("failed to query historical metrics: %w", err)
	}
	defer rows.Close()
	
	var metrics []HistoricalMetric
	for rows.Next() {
		var metric HistoricalMetric
		err := rows.Scan(&metric.ID, &metric.Timestamp, &metric.CPUPercent, &metric.MemoryUsed,
			&metric.MemoryTotal, &metric.DiskUsed, &metric.DiskTotal, &metric.NetworkRX, &metric.NetworkTX)
		if err != nil {
			return nil, fmt.Errorf("failed to scan historical metric: %w", err)
		}
		metrics = append(metrics, metric)
	}
	
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate historical metrics: %w", err)
	}
	
	return metrics, nil
}

// GetLatestHistoricalMetrics retrieves the most recent N metrics
func (s *Store) GetLatestHistoricalMetrics(ctx context.Context, limit int) ([]HistoricalMetric, error) {
	if limit <= 0 || limit > 1000 {
		limit = 50 // Default to 50 data points
	}
	
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, timestamp, cpu_percent, memory_used, memory_total, 
			disk_used, disk_total, network_rx, network_tx
		FROM historical_metrics 
		ORDER BY timestamp DESC
		LIMIT ?`, limit)
	
	if err != nil {
		return nil, fmt.Errorf("failed to query latest historical metrics: %w", err)
	}
	defer rows.Close()
	
	var metrics []HistoricalMetric
	for rows.Next() {
		var metric HistoricalMetric
		err := rows.Scan(&metric.ID, &metric.Timestamp, &metric.CPUPercent, &metric.MemoryUsed,
			&metric.MemoryTotal, &metric.DiskUsed, &metric.DiskTotal, &metric.NetworkRX, &metric.NetworkTX)
		if err != nil {
			return nil, fmt.Errorf("failed to scan historical metric: %w", err)
		}
		metrics = append(metrics, metric)
	}
	
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate historical metrics: %w", err)
	}
	
	// Reverse to get chronological order (oldest first)
	for i := 0; i < len(metrics)/2; i++ {
		j := len(metrics) - 1 - i
		metrics[i], metrics[j] = metrics[j], metrics[i]
	}
	
	return metrics, nil
}

// CleanupOldMetrics removes historical metrics older than the specified duration
func (s *Store) CleanupOldMetrics(ctx context.Context, olderThan time.Duration) error {
	cutoff := time.Now().Add(-olderThan)
	
	result, err := s.db.ExecContext(ctx, `
		DELETE FROM historical_metrics 
		WHERE timestamp < ?`, cutoff)
	
	if err != nil {
		return fmt.Errorf("failed to cleanup old metrics: %w", err)
	}
	
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected > 0 {
		// Log cleanup activity (could be enhanced with proper logging)
		fmt.Printf("Cleaned up %d old historical metrics older than %v\n", rowsAffected, olderThan)
	}
	
	return nil
}

// CleanupHistoricalMetrics removes historical metrics older than the specified cutoff time
func (s *Store) CleanupHistoricalMetrics(ctx context.Context, cutoff time.Time) error {
	result, err := s.db.ExecContext(ctx, `
		DELETE FROM historical_metrics 
		WHERE timestamp < ?`, cutoff)
	
	if err != nil {
		return fmt.Errorf("failed to cleanup historical metrics: %w", err)
	}
	
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected > 0 {
		fmt.Printf("Cleaned up %d historical metrics older than %v\n", rowsAffected, cutoff.Format(time.RFC3339))
	}
	
	return nil
}

// Environment variables operations with encryption support

// SetEnvVar creates or updates an environment variable for a service
func (s *Store) SetEnvVar(ctx context.Context, serviceID int64, key, value string, isSecret bool, nonce, ciphertext []byte) error {
	if key == "" {
		return fmt.Errorf("environment variable key cannot be empty")
	}
	
	// Verify service exists
	_, err := s.GetService(ctx, serviceID)
	if err != nil {
		return fmt.Errorf("service not found: %w", err)
	}
	
	// For secret values, nonce and ciphertext are required; value must be empty
	// For non-secret values, value is required; nonce and ciphertext must be empty
	if isSecret {
		if len(nonce) == 0 || len(ciphertext) == 0 || value != "" {
			return fmt.Errorf("secret variables require nonce and ciphertext; value must be empty")
		}
	} else {
		if value == "" || len(nonce) != 0 || len(ciphertext) != 0 {
			return fmt.Errorf("non-secret variables require value; nonce and ciphertext must be empty")
		}
	}
	
	// Check if the env var already exists
	var existingID int64
	err = s.db.QueryRowContext(ctx, `
		SELECT id FROM env_vars WHERE service_id = ? AND key = ?`,
		serviceID, key).Scan(&existingID)
	
	if err == sql.ErrNoRows {
		// Insert new env var
		_, err = s.db.ExecContext(ctx, `
			INSERT INTO env_vars (service_id, key, is_secret, value, nonce, ciphertext, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
			serviceID, key, isSecret, nullableString(value), nonce, ciphertext)
		
		if err != nil {
			return fmt.Errorf("failed to insert environment variable: %w", err)
		}
	} else if err != nil {
		return fmt.Errorf("failed to check existing environment variable: %w", err)
	} else {
		// Update existing env var (this will trigger the update trigger)
		_, err = s.db.ExecContext(ctx, `
			UPDATE env_vars 
			SET is_secret = ?, value = ?, nonce = ?, ciphertext = ?, updated_at = CURRENT_TIMESTAMP
			WHERE id = ?`,
			isSecret, nullableString(value), nonce, ciphertext, existingID)
		
		if err != nil {
			return fmt.Errorf("failed to update environment variable: %w", err)
		}
	}
	
	return nil
}

// GetEnvVar retrieves a single environment variable by service ID and key
func (s *Store) GetEnvVar(ctx context.Context, serviceID int64, key string) (EnvVar, error) {
	var envVar EnvVar
	var value sql.NullString
	var nonce, ciphertext []byte
	
	err := s.db.QueryRowContext(ctx, `
		SELECT id, service_id, key, is_secret, value, nonce, ciphertext, created_at, updated_at
		FROM env_vars 
		WHERE service_id = ? AND key = ?`,
		serviceID, key).Scan(
		&envVar.ID, &envVar.ServiceID, &envVar.Key, &envVar.IsSecret,
		&value, &nonce, &ciphertext, &envVar.CreatedAt, &envVar.UpdatedAt)
	
	if err == sql.ErrNoRows {
		return EnvVar{}, fmt.Errorf("environment variable not found: %s", key)
	}
	if err != nil {
		return EnvVar{}, fmt.Errorf("failed to get environment variable: %w", err)
	}
	
	if value.Valid {
		envVar.Value = value.String
	}
	envVar.Nonce = nonce
	envVar.Ciphertext = ciphertext
	
	return envVar, nil
}

// ListEnvVars retrieves all environment variables for a service
func (s *Store) ListEnvVars(ctx context.Context, serviceID int64) ([]EnvVar, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, service_id, key, is_secret, value, nonce, ciphertext, created_at, updated_at
		FROM env_vars 
		WHERE service_id = ?
		ORDER BY key`,
		serviceID)
	if err != nil {
		return nil, fmt.Errorf("failed to query environment variables: %w", err)
	}
	defer rows.Close()
	
	var envVars []EnvVar
	for rows.Next() {
		var envVar EnvVar
		var value sql.NullString
		var nonce, ciphertext []byte
		
		err := rows.Scan(&envVar.ID, &envVar.ServiceID, &envVar.Key, &envVar.IsSecret,
			&value, &nonce, &ciphertext, &envVar.CreatedAt, &envVar.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan environment variable: %w", err)
		}
		
		if value.Valid {
			envVar.Value = value.String
		}
		envVar.Nonce = nonce
		envVar.Ciphertext = ciphertext
		
		envVars = append(envVars, envVar)
	}
	
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate environment variables: %w", err)
	}
	
	return envVars, nil
}

// DeleteEnvVar removes an environment variable by service ID and key
func (s *Store) DeleteEnvVar(ctx context.Context, serviceID int64, key string) error {
	result, err := s.db.ExecContext(ctx, `
		DELETE FROM env_vars 
		WHERE service_id = ? AND key = ?`,
		serviceID, key)
	if err != nil {
		return fmt.Errorf("failed to delete environment variable: %w", err)
	}
	
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	
	if rowsAffected == 0 {
		return fmt.Errorf("environment variable not found: %s", key)
	}
	
	return nil
}

// BulkSetEnvVars sets multiple environment variables for a service in a transaction
func (s *Store) BulkSetEnvVars(ctx context.Context, serviceID int64, envVars []EnvVarUpdate) error {
	if len(envVars) == 0 {
		return nil // Nothing to do
	}
	
	// Verify service exists
	_, err := s.GetService(ctx, serviceID)
	if err != nil {
		return fmt.Errorf("service not found: %w", err)
	}
	
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()
	
	for _, envVar := range envVars {
		if envVar.Key == "" {
			return fmt.Errorf("environment variable key cannot be empty")
		}
		
		// Validate consistency for secrets vs non-secrets
		if envVar.IsSecret {
			if len(envVar.Nonce) == 0 || len(envVar.Ciphertext) == 0 || envVar.Value != "" {
				return fmt.Errorf("secret variable %s requires nonce and ciphertext; value must be empty", envVar.Key)
			}
		} else {
			if envVar.Value == "" || len(envVar.Nonce) != 0 || len(envVar.Ciphertext) != 0 {
				return fmt.Errorf("non-secret variable %s requires value; nonce and ciphertext must be empty", envVar.Key)
			}
		}
		
		// Check if the env var already exists
		var existingID int64
		err = tx.QueryRowContext(ctx, `
			SELECT id FROM env_vars WHERE service_id = ? AND key = ?`,
			serviceID, envVar.Key).Scan(&existingID)
		
		if err == sql.ErrNoRows {
			// Insert new env var
			_, err = tx.ExecContext(ctx, `
				INSERT INTO env_vars (service_id, key, is_secret, value, nonce, ciphertext, created_at, updated_at)
				VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
				serviceID, envVar.Key, envVar.IsSecret, nullableString(envVar.Value), envVar.Nonce, envVar.Ciphertext)
		} else if err != nil {
			return fmt.Errorf("failed to check existing environment variable %s: %w", envVar.Key, err)
		} else {
			// Update existing env var
			_, err = tx.ExecContext(ctx, `
				UPDATE env_vars 
				SET is_secret = ?, value = ?, nonce = ?, ciphertext = ?, updated_at = CURRENT_TIMESTAMP
				WHERE id = ?`,
				envVar.IsSecret, nullableString(envVar.Value), envVar.Nonce, envVar.Ciphertext, existingID)
		}
		
		if err != nil {
			return fmt.Errorf("failed to set environment variable %s: %w", envVar.Key, err)
		}
	}
	
	return tx.Commit()
}

// BulkDeleteEnvVars removes multiple environment variables for a service
func (s *Store) BulkDeleteEnvVars(ctx context.Context, serviceID int64, keys []string) error {
	if len(keys) == 0 {
		return nil // Nothing to do
	}
	
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()
	
	for _, key := range keys {
		_, err = tx.ExecContext(ctx, `
			DELETE FROM env_vars 
			WHERE service_id = ? AND key = ?`,
			serviceID, key)
		if err != nil {
			return fmt.Errorf("failed to delete environment variable %s: %w", key, err)
		}
	}
	
	return tx.Commit()
}

// GitHub App methods

// CreateGitHubInstallation creates a new GitHub App installation
func (s *Store) CreateGitHubInstallation(ctx context.Context, installation *github.GitHubInstallation) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT OR REPLACE INTO github_installations (id, account_login, account_type, created_at, updated_at)
		VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		installation.ID, installation.AccountLogin, installation.AccountType)
	
	if err != nil {
		return fmt.Errorf("failed to create GitHub installation: %w", err)
	}
	
	return nil
}

// DeleteGitHubInstallation is defined in github.go

// CreateGitHubRepo creates a new GitHub repository
func (s *Store) CreateGitHubRepo(ctx context.Context, repo *github.GitHubRepo) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT OR REPLACE INTO github_repos (id, full_name, installation_id, active, created_at, updated_at)
		VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
		repo.ID, repo.FullName, repo.InstallationID, repo.Active)
	
	if err != nil {
		return fmt.Errorf("failed to create GitHub repository: %w", err)
	}
	
	return nil
}

// DeleteGitHubRepo removes a GitHub repository
func (s *Store) DeleteGitHubRepo(ctx context.Context, id int64) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM github_repos WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("failed to delete GitHub repository: %w", err)
	}
	
	return nil
}

// GetActiveReposByInstallation returns all active repositories for an installation
func (s *Store) GetActiveReposByInstallation(ctx context.Context, installationID int64) ([]github.GitHubRepo, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT id, full_name, installation_id, active, created_at, updated_at
		FROM github_repos
		WHERE installation_id = ? AND active = 1`,
		installationID)
	
	if err != nil {
		return nil, fmt.Errorf("failed to query active repositories: %w", err)
	}
	defer rows.Close()
	
	var repos []github.GitHubRepo
	for rows.Next() {
		var repo github.GitHubRepo
		err := rows.Scan(&repo.ID, &repo.FullName, &repo.InstallationID, &repo.Active, &repo.CreatedAt, &repo.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan repository: %w", err)
		}
		repos = append(repos, repo)
	}
	
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate repositories: %w", err)
	}
	
	return repos, nil
}

// Settings methods

// GetSetting retrieves a setting by key
func (s *Store) GetSetting(ctx context.Context, key string) (*Setting, error) {
	var setting Setting
	err := s.db.QueryRowContext(ctx, `
		SELECT key, value, is_secret, created_at, updated_at
		FROM settings WHERE key = ?`, key).Scan(
		&setting.Key, &setting.Value, &setting.IsSecret, &setting.CreatedAt, &setting.UpdatedAt)
	
	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get setting: %w", err)
	}
	
	return &setting, nil
}

// SetSetting stores or updates a setting
func (s *Store) SetSetting(ctx context.Context, key string, value []byte, isSecret bool) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT OR REPLACE INTO settings (key, value, is_secret, created_at, updated_at)
		VALUES (?, ?, ?, 
			COALESCE((SELECT created_at FROM settings WHERE key = ?), CURRENT_TIMESTAMP), 
			CURRENT_TIMESTAMP)`,
		key, value, isSecret, key)
	
	if err != nil {
		return fmt.Errorf("failed to set setting: %w", err)
	}
	
	return nil
}

// DeleteSetting removes a setting by key
func (s *Store) DeleteSetting(ctx context.Context, key string) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM settings WHERE key = ?`, key)
	if err != nil {
		return fmt.Errorf("failed to delete setting: %w", err)
	}
	
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	
	if rowsAffected == 0 {
		return ErrNotFound
	}
	
	return nil
}

// ListSettings returns all settings (for admin use, secrets are not decrypted)
func (s *Store) ListSettings(ctx context.Context) ([]Setting, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT key, value, is_secret, created_at, updated_at
		FROM settings
		ORDER BY key`)
	
	if err != nil {
		return nil, fmt.Errorf("failed to list settings: %w", err)
	}
	defer rows.Close()
	
	var settings []Setting
	for rows.Next() {
		var setting Setting
		err := rows.Scan(&setting.Key, &setting.Value, &setting.IsSecret, &setting.CreatedAt, &setting.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan setting: %w", err)
		}
		
		// Don't expose secret values
		if setting.IsSecret {
			setting.Value = nil
		}
		
		settings = append(settings, setting)
	}
	
	if err = rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate settings: %w", err)
	}
	
	return settings, nil
}

// StoreOAuthState stores OAuth state with optional encrypted PKCE verifier
func (s *Store) StoreOAuthState(ctx context.Context, state string, encryptedVerifier []byte, expiresAt time.Time) error {
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO oauth_state (state, verifier_hash, expires_at)
		VALUES (?, ?, ?)`,
		state, encryptedVerifier, expiresAt)
	
	if err != nil {
		return fmt.Errorf("failed to store OAuth state: %w", err)
	}
	
	return nil
}

// GetOAuthState retrieves OAuth state and encrypted PKCE verifier
func (s *Store) GetOAuthState(ctx context.Context, state string) ([]byte, error) {
	var encryptedVerifier []byte
	
	err := s.db.QueryRowContext(ctx, `
		SELECT verifier_hash FROM oauth_state 
		WHERE state = ? AND expires_at > datetime('now')`,
		state).Scan(&encryptedVerifier)
	
	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get OAuth state: %w", err)
	}
	
	return encryptedVerifier, nil
}

// DeleteOAuthState removes used OAuth state
func (s *Store) DeleteOAuthState(ctx context.Context, state string) error {
	result, err := s.db.ExecContext(ctx, `DELETE FROM oauth_state WHERE state = ?`, state)
	if err != nil {
		return fmt.Errorf("failed to delete OAuth state: %w", err)
	}
	
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}
	
	if rowsAffected == 0 {
		return ErrNotFound
	}
	
	return nil
}

// CleanupExpiredOAuthStates removes expired OAuth states (called periodically)
func (s *Store) CleanupExpiredOAuthStates(ctx context.Context) error {
	_, err := s.db.ExecContext(ctx, `DELETE FROM oauth_state WHERE expires_at <= datetime('now')`)
	if err != nil {
		return fmt.Errorf("failed to cleanup expired OAuth states: %w", err)
	}
	
	return nil
}