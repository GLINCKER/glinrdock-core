package store

import (
	"context"
	"database/sql"
	"fmt"
)

// UpsertGitHubInstallation creates or updates a GitHub installation
func (s *Store) UpsertGitHubInstallation(ctx context.Context, installation *GitHubInstallation) (*GitHubInstallation, error) {
	query := `
		INSERT INTO github_installations (
			installation_id, account_login, account_id, account_type, permissions, events
		) VALUES (?, ?, ?, ?, ?, ?)
		ON CONFLICT(installation_id) DO UPDATE SET
			account_login = excluded.account_login,
			account_id = excluded.account_id,
			account_type = excluded.account_type,
			permissions = excluded.permissions,
			events = excluded.events,
			updated_at = CURRENT_TIMESTAMP
		RETURNING id, created_at, updated_at
	`

	var result GitHubInstallation
	result = *installation

	err := s.db.QueryRowContext(ctx, query,
		installation.InstallationID,
		installation.AccountLogin,
		installation.AccountID,
		installation.AccountType,
		installation.Permissions,
		installation.Events,
	).Scan(&result.ID, &result.CreatedAt, &result.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to upsert GitHub installation: %w", err)
	}

	return &result, nil
}

// GetGitHubInstallations retrieves all GitHub installations
func (s *Store) GetGitHubInstallations(ctx context.Context) ([]GitHubInstallation, error) {
	query := `
		SELECT id, installation_id, account_login, account_id, account_type, 
		       permissions, events, created_at, updated_at, suspended_at, suspended_by
		FROM github_installations
		ORDER BY account_login
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query installations: %w", err)
	}
	defer rows.Close()

	var installations []GitHubInstallation
	for rows.Next() {
		var installation GitHubInstallation
		err := rows.Scan(
			&installation.ID,
			&installation.InstallationID,
			&installation.AccountLogin,
			&installation.AccountID,
			&installation.AccountType,
			&installation.Permissions,
			&installation.Events,
			&installation.CreatedAt,
			&installation.UpdatedAt,
			&installation.SuspendedAt,
			&installation.SuspendedBy,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan installation: %w", err)
		}
		installations = append(installations, installation)
	}

	return installations, nil
}

// GetGitHubInstallationByID retrieves a GitHub installation by ID
func (s *Store) GetGitHubInstallationByID(ctx context.Context, installationID int64) (*GitHubInstallation, error) {
	query := `
		SELECT id, installation_id, account_login, account_id, account_type, 
		       permissions, events, created_at, updated_at, suspended_at, suspended_by
		FROM github_installations
		WHERE installation_id = ?
	`

	var installation GitHubInstallation
	err := s.db.QueryRowContext(ctx, query, installationID).Scan(
		&installation.ID,
		&installation.InstallationID,
		&installation.AccountLogin,
		&installation.AccountID,
		&installation.AccountType,
		&installation.Permissions,
		&installation.Events,
		&installation.CreatedAt,
		&installation.UpdatedAt,
		&installation.SuspendedAt,
		&installation.SuspendedBy,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to get GitHub installation: %w", err)
	}

	return &installation, nil
}

// DeleteGitHubInstallation removes a GitHub installation and all related data
func (s *Store) DeleteGitHubInstallation(ctx context.Context, installationID int64) error {
	query := `DELETE FROM github_installations WHERE installation_id = ?`

	result, err := s.db.ExecContext(ctx, query, installationID)
	if err != nil {
		return fmt.Errorf("failed to delete GitHub installation: %w", err)
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

// UpsertGitHubRepository creates or updates a GitHub repository
func (s *Store) UpsertGitHubRepository(ctx context.Context, repo *GitHubRepository) (*GitHubRepository, error) {
	query := `
		INSERT INTO github_repositories (
			repository_id, installation_id, name, full_name, owner_login, 
			private, default_branch, clone_url, ssh_url
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(repository_id, installation_id) DO UPDATE SET
			name = excluded.name,
			full_name = excluded.full_name,
			owner_login = excluded.owner_login,
			private = excluded.private,
			default_branch = excluded.default_branch,
			clone_url = excluded.clone_url,
			ssh_url = excluded.ssh_url,
			updated_at = CURRENT_TIMESTAMP
		RETURNING id, created_at, updated_at
	`

	var result GitHubRepository
	result = *repo

	err := s.db.QueryRowContext(ctx, query,
		repo.RepositoryID,
		repo.InstallationID,
		repo.Name,
		repo.FullName,
		repo.OwnerLogin,
		repo.Private,
		repo.DefaultBranch,
		repo.CloneURL,
		repo.SSHURL,
	).Scan(&result.ID, &result.CreatedAt, &result.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to upsert GitHub repository: %w", err)
	}

	return &result, nil
}

// GetGitHubRepositories retrieves all GitHub repositories
func (s *Store) GetGitHubRepositories(ctx context.Context) ([]GitHubRepository, error) {
	query := `
		SELECT id, repository_id, installation_id, name, full_name, owner_login,
		       private, default_branch, clone_url, ssh_url, created_at, updated_at
		FROM github_repositories
		ORDER BY full_name
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query repositories: %w", err)
	}
	defer rows.Close()

	var repositories []GitHubRepository
	for rows.Next() {
		var repo GitHubRepository
		err := rows.Scan(
			&repo.ID,
			&repo.RepositoryID,
			&repo.InstallationID,
			&repo.Name,
			&repo.FullName,
			&repo.OwnerLogin,
			&repo.Private,
			&repo.DefaultBranch,
			&repo.CloneURL,
			&repo.SSHURL,
			&repo.CreatedAt,
			&repo.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan repository: %w", err)
		}
		repositories = append(repositories, repo)
	}

	return repositories, nil
}

// GetGitHubRepositoriesByInstallation retrieves repositories for a specific installation
func (s *Store) GetGitHubRepositoriesByInstallation(ctx context.Context, installationID int64) ([]GitHubRepository, error) {
	query := `
		SELECT id, repository_id, installation_id, name, full_name, owner_login,
		       private, default_branch, clone_url, ssh_url, created_at, updated_at
		FROM github_repositories
		WHERE installation_id = ?
		ORDER BY full_name
	`

	rows, err := s.db.QueryContext(ctx, query, installationID)
	if err != nil {
		return nil, fmt.Errorf("failed to query repositories: %w", err)
	}
	defer rows.Close()

	var repositories []GitHubRepository
	for rows.Next() {
		var repo GitHubRepository
		err := rows.Scan(
			&repo.ID,
			&repo.RepositoryID,
			&repo.InstallationID,
			&repo.Name,
			&repo.FullName,
			&repo.OwnerLogin,
			&repo.Private,
			&repo.DefaultBranch,
			&repo.CloneURL,
			&repo.SSHURL,
			&repo.CreatedAt,
			&repo.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan repository: %w", err)
		}
		repositories = append(repositories, repo)
	}

	return repositories, nil
}

// GetGitHubRepositoryByID retrieves a GitHub repository by its GitHub ID
func (s *Store) GetGitHubRepositoryByID(ctx context.Context, repositoryID int64) (*GitHubRepository, error) {
	query := `
		SELECT id, repository_id, installation_id, name, full_name, owner_login,
		       private, default_branch, clone_url, ssh_url, created_at, updated_at
		FROM github_repositories
		WHERE repository_id = ?
	`

	var repo GitHubRepository
	err := s.db.QueryRowContext(ctx, query, repositoryID).Scan(
		&repo.ID,
		&repo.RepositoryID,
		&repo.InstallationID,
		&repo.Name,
		&repo.FullName,
		&repo.OwnerLogin,
		&repo.Private,
		&repo.DefaultBranch,
		&repo.CloneURL,
		&repo.SSHURL,
		&repo.CreatedAt,
		&repo.UpdatedAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to get GitHub repository: %w", err)
	}

	return &repo, nil
}

// CreateGitHubRepoMapping creates a new GitHub repository to project mapping
func (s *Store) CreateGitHubRepoMapping(ctx context.Context, mapping *GitHubRepoMapping) (*GitHubRepoMapping, error) {
	query := `
		INSERT INTO github_repo_mappings (
			repository_id, project_id, branch_filter, build_context, 
			build_args, auto_deploy, created_by
		) VALUES (?, ?, ?, ?, ?, ?, ?)
		RETURNING id, created_at, updated_at
	`

	var result GitHubRepoMapping
	result = *mapping

	err := s.db.QueryRowContext(ctx, query,
		mapping.RepositoryID,
		mapping.ProjectID,
		mapping.BranchFilter,
		mapping.BuildContext,
		mapping.BuildArgs,
		mapping.AutoDeploy,
		mapping.CreatedBy,
	).Scan(&result.ID, &result.CreatedAt, &result.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create GitHub repo mapping: %w", err)
	}

	return &result, nil
}

// GetGitHubRepoMappings retrieves all GitHub repository mappings
func (s *Store) GetGitHubRepoMappings(ctx context.Context) ([]GitHubRepoMapping, error) {
	query := `
		SELECT id, repository_id, project_id, branch_filter, build_context,
		       build_args, auto_deploy, created_at, updated_at, created_by
		FROM github_repo_mappings
		ORDER BY created_at DESC
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query repo mappings: %w", err)
	}
	defer rows.Close()

	var mappings []GitHubRepoMapping
	for rows.Next() {
		var mapping GitHubRepoMapping
		err := rows.Scan(
			&mapping.ID,
			&mapping.RepositoryID,
			&mapping.ProjectID,
			&mapping.BranchFilter,
			&mapping.BuildContext,
			&mapping.BuildArgs,
			&mapping.AutoDeploy,
			&mapping.CreatedAt,
			&mapping.UpdatedAt,
			&mapping.CreatedBy,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan repo mapping: %w", err)
		}
		mappings = append(mappings, mapping)
	}

	return mappings, nil
}

// GetGitHubRepoMappingByRepo retrieves a GitHub repository mapping by repository ID
func (s *Store) GetGitHubRepoMappingByRepo(ctx context.Context, repositoryID int64) (*GitHubRepoMapping, error) {
	query := `
		SELECT id, repository_id, project_id, branch_filter, build_context,
		       build_args, auto_deploy, created_at, updated_at, created_by
		FROM github_repo_mappings
		WHERE repository_id = ?
	`

	var mapping GitHubRepoMapping
	err := s.db.QueryRowContext(ctx, query, repositoryID).Scan(
		&mapping.ID,
		&mapping.RepositoryID,
		&mapping.ProjectID,
		&mapping.BranchFilter,
		&mapping.BuildContext,
		&mapping.BuildArgs,
		&mapping.AutoDeploy,
		&mapping.CreatedAt,
		&mapping.UpdatedAt,
		&mapping.CreatedBy,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to get GitHub repo mapping: %w", err)
	}

	return &mapping, nil
}

// DeleteGitHubRepoMapping removes a GitHub repository mapping
func (s *Store) DeleteGitHubRepoMapping(ctx context.Context, repositoryID int64) error {
	query := `DELETE FROM github_repo_mappings WHERE repository_id = ?`

	result, err := s.db.ExecContext(ctx, query, repositoryID)
	if err != nil {
		return fmt.Errorf("failed to delete GitHub repo mapping: %w", err)
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

// LogGitHubWebhookEvent records a GitHub webhook event for audit purposes
func (s *Store) LogGitHubWebhookEvent(ctx context.Context, event *GitHubWebhookEvent) error {
	query := `
		INSERT INTO github_webhook_events (
			event_type, event_action, installation_id, repository_id, 
			payload_hash, processed_at, error_message
		) VALUES (?, ?, ?, ?, ?, ?, ?)
	`

	_, err := s.db.ExecContext(ctx, query,
		event.EventType,
		event.EventAction,
		event.InstallationID,
		event.RepositoryID,
		event.PayloadHash,
		event.ProcessedAt,
		event.ErrorMessage,
	)

	if err != nil {
		return fmt.Errorf("failed to log webhook event: %w", err)
	}

	return nil
}

// GetGitHubWebhookEvents retrieves recent webhook events for debugging
func (s *Store) GetGitHubWebhookEvents(ctx context.Context, limit int) ([]GitHubWebhookEvent, error) {
	query := `
		SELECT id, event_type, event_action, installation_id, repository_id,
		       payload_hash, processed_at, error_message, created_at
		FROM github_webhook_events
		ORDER BY created_at DESC
		LIMIT ?
	`

	rows, err := s.db.QueryContext(ctx, query, limit)
	if err != nil {
		return nil, fmt.Errorf("failed to query webhook events: %w", err)
	}
	defer rows.Close()

	var events []GitHubWebhookEvent
	for rows.Next() {
		var event GitHubWebhookEvent
		err := rows.Scan(
			&event.ID,
			&event.EventType,
			&event.EventAction,
			&event.InstallationID,
			&event.RepositoryID,
			&event.PayloadHash,
			&event.ProcessedAt,
			&event.ErrorMessage,
			&event.CreatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan webhook event: %w", err)
		}
		events = append(events, event)
	}

	return events, nil
}

// GitHubRepositoryWithMapping represents a repository with its activation status
type GitHubRepositoryWithMapping struct {
	GitHubRepository
	IsActivated bool               `json:"is_activated"`
	Mapping     *GitHubRepoMapping `json:"mapping,omitempty"`
}

// GetGitHubRepositoriesWithMappings retrieves repositories with their activation status
func (s *Store) GetGitHubRepositoriesWithMappings(ctx context.Context) ([]GitHubRepositoryWithMapping, error) {
	query := `
		SELECT 
			r.id, r.repository_id, r.installation_id, r.name, r.full_name, r.owner_login,
			r.private, r.default_branch, r.clone_url, r.ssh_url, r.created_at, r.updated_at,
			m.id, m.repository_id, m.project_id, m.branch_filter, m.build_context,
			m.build_args, m.auto_deploy, m.created_at, m.updated_at, m.created_by
		FROM github_repositories r
		LEFT JOIN github_repo_mappings m ON r.repository_id = m.repository_id
		ORDER BY r.full_name
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query repositories with mappings: %w", err)
	}
	defer rows.Close()

	var repositories []GitHubRepositoryWithMapping
	for rows.Next() {
		var repoWithMapping GitHubRepositoryWithMapping
		var mappingID sql.NullInt64
		var mappingRepoID sql.NullInt64
		var mappingProjectID sql.NullInt64
		var mappingBranchFilter sql.NullString
		var mappingBuildContext sql.NullString
		var mappingBuildArgs sql.NullString
		var mappingAutoDeploy sql.NullBool
		var mappingCreatedAt sql.NullTime
		var mappingUpdatedAt sql.NullTime
		var mappingCreatedBy sql.NullString

		err := rows.Scan(
			&repoWithMapping.ID,
			&repoWithMapping.RepositoryID,
			&repoWithMapping.InstallationID,
			&repoWithMapping.Name,
			&repoWithMapping.FullName,
			&repoWithMapping.OwnerLogin,
			&repoWithMapping.Private,
			&repoWithMapping.DefaultBranch,
			&repoWithMapping.CloneURL,
			&repoWithMapping.SSHURL,
			&repoWithMapping.CreatedAt,
			&repoWithMapping.UpdatedAt,
			&mappingID,
			&mappingRepoID,
			&mappingProjectID,
			&mappingBranchFilter,
			&mappingBuildContext,
			&mappingBuildArgs,
			&mappingAutoDeploy,
			&mappingCreatedAt,
			&mappingUpdatedAt,
			&mappingCreatedBy,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan repository with mapping: %w", err)
		}

		repoWithMapping.IsActivated = mappingID.Valid

		if mappingID.Valid {
			mapping := &GitHubRepoMapping{
				ID:           mappingID.Int64,
				RepositoryID: mappingRepoID.Int64,
				ProjectID:    mappingProjectID.Int64,
				AutoDeploy:   mappingAutoDeploy.Bool,
				CreatedAt:    mappingCreatedAt.Time,
				UpdatedAt:    mappingUpdatedAt.Time,
				CreatedBy:    mappingCreatedBy.String,
			}

			if mappingBranchFilter.Valid {
				mapping.BranchFilter = &mappingBranchFilter.String
			}
			if mappingBuildContext.Valid {
				mapping.BuildContext = &mappingBuildContext.String
			}
			if mappingBuildArgs.Valid {
				mapping.BuildArgs = &mappingBuildArgs.String
			}

			repoWithMapping.Mapping = mapping
		}

		repositories = append(repositories, repoWithMapping)
	}

	return repositories, nil
}
