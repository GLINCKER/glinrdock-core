package store

import (
	"context"
	"database/sql"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// WebhookStore interface for webhook delivery operations
type WebhookStore interface {
	CreateWebhookDelivery(ctx context.Context, delivery *WebhookDelivery) error
	GetWebhookDeliveries(ctx context.Context, limit int, offset int) ([]WebhookDelivery, error)
	GetWebhookDelivery(ctx context.Context, id string) (*WebhookDelivery, error)
	UpdateWebhookDeliveryStatus(ctx context.Context, id string, status string, response *string) error
	GetWebhookDeliveriesCount(ctx context.Context) (int, error)
}

// CreateWebhookDelivery creates a new webhook delivery record
func (s *Store) CreateWebhookDelivery(ctx context.Context, delivery *WebhookDelivery) error {
	if delivery.ID == "" {
		delivery.ID = uuid.New().String()
	}

	if delivery.CreatedAt.IsZero() {
		delivery.CreatedAt = time.Now()
	}

	query := `
		INSERT INTO webhook_deliveries (id, event, repository, status, payload, response, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`

	_, err := s.db.ExecContext(ctx, query,
		delivery.ID,
		delivery.Event,
		delivery.Repository,
		delivery.Status,
		delivery.Payload,
		delivery.Response,
		delivery.CreatedAt,
	)

	if err != nil {
		log.Error().Err(err).Str("id", delivery.ID).Msg("failed to create webhook delivery")
		return err
	}

	log.Info().Str("id", delivery.ID).Str("event", delivery.Event).Str("repo", delivery.Repository).Msg("webhook delivery created")
	return nil
}

// GetWebhookDeliveries retrieves webhook deliveries with pagination
func (s *Store) GetWebhookDeliveries(ctx context.Context, limit int, offset int) ([]WebhookDelivery, error) {
	query := `
		SELECT id, event, repository, status, payload, response, created_at, updated_at
		FROM webhook_deliveries
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`

	rows, err := s.db.QueryContext(ctx, query, limit, offset)
	if err != nil {
		log.Error().Err(err).Msg("failed to get webhook deliveries")
		return nil, err
	}
	defer rows.Close()

	var deliveries []WebhookDelivery
	for rows.Next() {
		var delivery WebhookDelivery
		err := rows.Scan(
			&delivery.ID,
			&delivery.Event,
			&delivery.Repository,
			&delivery.Status,
			&delivery.Payload,
			&delivery.Response,
			&delivery.CreatedAt,
			&delivery.UpdatedAt,
		)
		if err != nil {
			log.Error().Err(err).Msg("failed to scan webhook delivery")
			continue
		}
		deliveries = append(deliveries, delivery)
	}

	return deliveries, nil
}

// GetWebhookDelivery retrieves a single webhook delivery by ID
func (s *Store) GetWebhookDelivery(ctx context.Context, id string) (*WebhookDelivery, error) {
	query := `
		SELECT id, event, repository, status, payload, response, created_at, updated_at
		FROM webhook_deliveries
		WHERE id = ?
	`

	var delivery WebhookDelivery
	err := s.db.QueryRowContext(ctx, query, id).Scan(
		&delivery.ID,
		&delivery.Event,
		&delivery.Repository,
		&delivery.Status,
		&delivery.Payload,
		&delivery.Response,
		&delivery.CreatedAt,
		&delivery.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		log.Error().Err(err).Str("id", id).Msg("failed to get webhook delivery")
		return nil, err
	}

	return &delivery, nil
}

// UpdateWebhookDeliveryStatus updates the status and response of a webhook delivery
func (s *Store) UpdateWebhookDeliveryStatus(ctx context.Context, id string, status string, response *string) error {
	now := time.Now()
	query := `
		UPDATE webhook_deliveries 
		SET status = ?, response = ?, updated_at = ?
		WHERE id = ?
	`

	result, err := s.db.ExecContext(ctx, query, status, response, now, id)
	if err != nil {
		log.Error().Err(err).Str("id", id).Msg("failed to update webhook delivery status")
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return ErrNotFound
	}

	log.Info().Str("id", id).Str("status", status).Msg("webhook delivery status updated")
	return nil
}

// GetWebhookDeliveriesCount returns the total count of webhook deliveries
func (s *Store) GetWebhookDeliveriesCount(ctx context.Context) (int, error) {
	query := `SELECT COUNT(*) FROM webhook_deliveries`

	var count int
	err := s.db.QueryRowContext(ctx, query).Scan(&count)
	if err != nil {
		log.Error().Err(err).Msg("failed to get webhook deliveries count")
		return 0, err
	}

	return count, nil
}

// GetProjectByRepoURL finds a project by its repository URL
func (s *Store) GetProjectByRepoURL(ctx context.Context, repoURL string) (*Project, error) {
	query := `
		SELECT id, name, repo_url, branch, image_target, created_at
		FROM projects
		WHERE repo_url = ?
	`

	var project Project
	var repoURLVal, imageTargetVal sql.NullString

	err := s.db.QueryRowContext(ctx, query, repoURL).Scan(
		&project.ID,
		&project.Name,
		&repoURLVal,
		&project.Branch,
		&imageTargetVal,
		&project.CreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		log.Error().Err(err).Str("repo_url", repoURL).Msg("failed to get project by repo URL")
		return nil, err
	}

	if repoURLVal.Valid {
		project.RepoURL = &repoURLVal.String
	}
	if imageTargetVal.Valid {
		project.ImageTarget = &imageTargetVal.String
	}

	return &project, nil
}
