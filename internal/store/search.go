package store

import (
	"context"
	"crypto/md5"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

// SearchDoc represents a document in the search index
type SearchDoc struct {
	ID         int64     `json:"id" db:"id"`
	EntityType string    `json:"entity_type" db:"entity_type"`
	EntityID   int64     `json:"entity_id" db:"entity_id"`
	Title      string    `json:"title" db:"title"`
	Subtitle   string    `json:"subtitle" db:"subtitle"`
	Body       string    `json:"body" db:"body"`
	Tags       string    `json:"tags" db:"tags"`
	ProjectID  *int64    `json:"project_id" db:"project_id"`
	URLPath    string    `json:"url_path" db:"url_path"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

// SearchHit represents a search result
type SearchHit struct {
	ID         int64                  `json:"id"`
	Type       string                 `json:"type"`
	EntityID   int64                  `json:"entity_id"`
	Title      string                 `json:"title"`
	Subtitle   string                 `json:"subtitle"`
	URLPath    string                 `json:"url_path"`
	Score      float64                `json:"score"`
	ProjectID  *int64                 `json:"project_id,omitempty"`
	Badges     []SearchBadge          `json:"badges,omitempty"`
}

// SearchBadge represents a small badge/tag on search results
type SearchBadge struct {
	Key   string `json:"k"`
	Value string `json:"v"`
}

// SearchFilter represents search filtering options
type SearchFilter struct {
	Type        string `json:"type,omitempty"`         // project|service|route|setting|registry|env_template|page|help|operation
	ProjectID   *int64 `json:"project_id,omitempty"`  
	ProjectName string `json:"project_name,omitempty"` // project name fragment for filtering
	Status      string `json:"status,omitempty"`       // running|stopped (for services)
	Limit       int    `json:"limit"`
	Offset      int    `json:"offset"`
	AllowBasic  bool   `json:"allow_basic"`            // Allow fallback to LIKE queries if FTS5 unavailable
}

// SearchCapabilities represents the search capabilities of the system
type SearchCapabilities struct {
	FTS5Enabled bool   `json:"fts5"`
	Mode        string `json:"mode"` // "fts5" or "basic"
}

// CheckFTS5Support checks if FTS5 is available in SQLite
func (s *Store) CheckFTS5Support(ctx context.Context) (*SearchCapabilities, error) {
	var enabled int
	err := s.db.QueryRowContext(ctx, "SELECT sqlite_compileoption_used('ENABLE_FTS5')").Scan(&enabled)
	if err != nil {
		log.Error().Err(err).Msg("failed to check FTS5 support")
		return &SearchCapabilities{FTS5Enabled: false, Mode: "basic"}, nil
	}
	
	mode := "basic"
	if enabled == 1 {
		mode = "fts5"
	}
	
	return &SearchCapabilities{
		FTS5Enabled: enabled == 1,
		Mode:        mode,
	}, nil
}

// SearchUpsertDoc inserts or updates a search document
func (s *Store) SearchUpsertDoc(ctx context.Context, doc *SearchDoc) error {
	query := `
		INSERT OR REPLACE INTO search_docs 
		(entity_type, entity_id, title, subtitle, body, tags, project_id, url_path, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
	
	_, err := s.db.ExecContext(ctx, query, 
		doc.EntityType, doc.EntityID, doc.Title, doc.Subtitle, 
		doc.Body, doc.Tags, doc.ProjectID, doc.URLPath)
	if err != nil {
		return fmt.Errorf("failed to upsert search doc: %w", err)
	}
	
	return nil
}

// SearchDeleteByEntity deletes search documents for a specific entity
func (s *Store) SearchDeleteByEntity(ctx context.Context, entityType string, entityID int64) error {
	query := `DELETE FROM search_docs WHERE entity_type = ? AND entity_id = ?`
	_, err := s.db.ExecContext(ctx, query, entityType, entityID)
	if err != nil {
		return fmt.Errorf("failed to delete search docs: %w", err)
	}
	return nil
}

// SearchQueryResult holds search results with total count
type SearchQueryResult struct {
	Hits  []SearchHit
	Total int
}

// SearchQuery performs a search query using FTS5 or fallback to LIKE
func (s *Store) SearchQuery(ctx context.Context, q string, filter SearchFilter) ([]SearchHit, error) {
	result, err := s.SearchQueryWithCount(ctx, q, filter)
	if err != nil {
		return nil, err
	}
	return result.Hits, nil
}

// SearchQueryWithCount performs a search query and returns results with total count
func (s *Store) SearchQueryWithCount(ctx context.Context, q string, filter SearchFilter) (*SearchQueryResult, error) {
	// Check FTS5 capability first
	caps, err := s.CheckFTS5Support(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to check search capabilities: %w", err)
	}
	
	if caps.FTS5Enabled {
		return s.searchQueryFTS5WithCount(ctx, q, filter)
	}
	
	if filter.AllowBasic {
		return s.searchQueryBasicWithCount(ctx, q, filter)
	}
	
	return nil, fmt.Errorf("FTS5 not available and basic search not allowed")
}

// searchQueryFTS5 performs FTS5 search
func (s *Store) searchQueryFTS5(ctx context.Context, q string, filter SearchFilter) ([]SearchHit, error) {
	result, err := s.searchQueryFTS5WithCount(ctx, q, filter)
	if err != nil {
		return nil, err
	}
	return result.Hits, nil
}

// searchQueryFTS5WithCount performs FTS5 search with total count
func (s *Store) searchQueryFTS5WithCount(ctx context.Context, q string, filter SearchFilter) (*SearchQueryResult, error) {
	// Sanitize and prepare FTS5 query
	ftsQuery := prepareFTS5Query(q)
	
	// Build the base query for counting and data retrieval
	baseQuery := `
		FROM search_fts
		JOIN search_docs sd ON sd.id = search_fts.rowid
		LEFT JOIN projects p ON sd.project_id = p.id
		WHERE search_fts MATCH ?`
	
	args := []interface{}{ftsQuery}
	
	// Add filters
	if filter.Type != "" {
		baseQuery += " AND sd.entity_type = ?"
		args = append(args, filter.Type)
	}
	
	if filter.ProjectID != nil {
		baseQuery += " AND sd.project_id = ?"
		args = append(args, *filter.ProjectID)
	}
	
	// Add project name filtering via project join
	if filter.ProjectName != "" {
		baseQuery += " AND LOWER(p.name) LIKE ?"
		args = append(args, "%"+strings.ToLower(filter.ProjectName)+"%")
	}
	
	// Add status filtering for services (best-effort)
	if filter.Status != "" && filter.Type == "service" {
		// For FTS5 search, we'll add this as a tags filter
		baseQuery += " AND LOWER(sd.tags) LIKE ?"
		args = append(args, "%"+strings.ToLower(filter.Status)+"%")
	}
	
	// Get total count first
	countQuery := "SELECT COUNT(*) " + baseQuery
	var total int
	err := s.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("failed to count FTS5 search results: %w", err)
	}
	
	// Get actual results with pagination
	dataQuery := `
		SELECT sd.entity_id, sd.entity_type, sd.title, sd.subtitle, sd.url_path,
		       bm25(search_fts, 1.2, 0.75) AS score, sd.project_id ` + baseQuery +
		" ORDER BY score ASC, sd.updated_at DESC LIMIT ? OFFSET ?"
	
	dataArgs := append(args, filter.Limit, filter.Offset)
	rows, err := s.db.QueryContext(ctx, dataQuery, dataArgs...)
	if err != nil {
		return nil, fmt.Errorf("failed to execute FTS5 search: %w", err)
	}
	defer rows.Close()
	
	hits, err := s.scanSearchHits(rows)
	if err != nil {
		return nil, err
	}
	
	return &SearchQueryResult{
		Hits:  hits,
		Total: total,
	}, nil
}

// searchQueryBasic performs basic LIKE-based search with enhanced partial matching
func (s *Store) searchQueryBasic(ctx context.Context, q string, filter SearchFilter) ([]SearchHit, error) {
	result, err := s.searchQueryBasicWithCount(ctx, q, filter)
	if err != nil {
		return nil, err
	}
	return result.Hits, nil
}

// searchQueryBasicWithCount performs basic LIKE-based search with total count
func (s *Store) searchQueryBasicWithCount(ctx context.Context, q string, filter SearchFilter) (*SearchQueryResult, error) {
	// Sanitize query for LIKE
	searchTerm := strings.ToLower(strings.TrimSpace(q))
	searchTerm = strings.ReplaceAll(searchTerm, "%", "\\%")
	
	// Create different patterns for better matching
	exactPattern := "%" + searchTerm + "%"
	prefixPattern := searchTerm + "%"
	wordBoundaryPattern := "% " + searchTerm + "%"
	
	// Build base query for count and data retrieval
	baseQuery := `
		FROM search_docs s
		LEFT JOIN projects p ON s.project_id = p.id
		WHERE (LOWER(s.title) LIKE ? OR LOWER(s.title) LIKE ? OR LOWER(s.title) LIKE ? OR
		       LOWER(s.subtitle) LIKE ? OR LOWER(s.body) LIKE ? OR LOWER(s.tags) LIKE ?)`
	
	args := []interface{}{
		prefixPattern, wordBoundaryPattern, exactPattern, // WHERE clause patterns
		exactPattern, exactPattern, exactPattern, // subtitle, body, tags WHERE patterns
	}
	
	// Add filters
	if filter.Type != "" {
		baseQuery += " AND s.entity_type = ?"
		args = append(args, filter.Type)
	}
	
	if filter.ProjectID != nil {
		baseQuery += " AND s.project_id = ?"
		args = append(args, *filter.ProjectID)
	}
	
	// Add project name filtering via project join
	if filter.ProjectName != "" {
		baseQuery += " AND LOWER(p.name) LIKE ?"
		args = append(args, "%"+strings.ToLower(filter.ProjectName)+"%")
	}
	
	// Add status filtering for services (best-effort)
	if filter.Status != "" && filter.Type == "service" {
		// For basic search, we'll add this as a content filter
		// In a real implementation, you might join with a services table
		baseQuery += " AND LOWER(s.tags) LIKE ?"
		args = append(args, "%"+strings.ToLower(filter.Status)+"%")
	}
	
	// Get total count first
	countQuery := "SELECT COUNT(*) " + baseQuery
	var total int
	err := s.db.QueryRowContext(ctx, countQuery, args...).Scan(&total)
	if err != nil {
		return nil, fmt.Errorf("failed to count basic search results: %w", err)
	}
	
	// Get actual results with pagination
	// Enhanced query with weighted matching (prefix matches score higher)
	dataQuery := `
		SELECT s.entity_id, s.entity_type, s.title, s.subtitle, s.url_path,
		       CASE 
		         WHEN LOWER(s.title) LIKE ? THEN 3
		         WHEN LOWER(s.title) LIKE ? THEN 2
		         WHEN LOWER(s.title) LIKE ? THEN 2
		         WHEN LOWER(s.subtitle) LIKE ? THEN 1.5
		         WHEN LOWER(s.body) LIKE ? THEN 1
		         ELSE 0.5
		       END AS score, 
		       s.project_id ` + baseQuery
	
	// Add scoring patterns to args
	dataArgs := []interface{}{
		prefixPattern, wordBoundaryPattern, exactPattern, // scoring patterns
		exactPattern, exactPattern, // subtitle and body scoring
	}
	dataArgs = append(dataArgs, args...) // Add the base query args
	
	// Basic search has stricter limits
	limit := filter.Limit
	if limit > 10 {
		limit = 10
	}
	
	dataQuery += " ORDER BY score DESC, updated_at DESC LIMIT ? OFFSET ?"
	dataArgs = append(dataArgs, limit, filter.Offset)
	
	rows, err := s.db.QueryContext(ctx, dataQuery, dataArgs...)
	if err != nil {
		return nil, fmt.Errorf("failed to execute basic search: %w", err)
	}
	defer rows.Close()
	
	hits, err := s.scanSearchHits(rows)
	if err != nil {
		return nil, err
	}
	
	return &SearchQueryResult{
		Hits:  hits,
		Total: total,
	}, nil
}

// scanSearchHits scans database rows into SearchHit structs
func (s *Store) scanSearchHits(rows *sql.Rows) ([]SearchHit, error) {
	var hits []SearchHit
	
	for rows.Next() {
		var hit SearchHit
		err := rows.Scan(
			&hit.EntityID, &hit.Type, &hit.Title, 
			&hit.Subtitle, &hit.URLPath, &hit.Score, &hit.ProjectID)
		if err != nil {
			return nil, fmt.Errorf("failed to scan search hit: %w", err)
		}
		
		// Add type-specific badges
		hit.Badges = s.generateSearchBadges(hit.Type, hit.EntityID)
		hits = append(hits, hit)
	}
		
	return hits, rows.Err()
}

// generateSearchBadges creates contextual badges for search results
func (s *Store) generateSearchBadges(entityType string, entityID int64) []SearchBadge {
	var badges []SearchBadge
	
	switch entityType {
	case "service":
		// Add service status badge (would need to query service table)
		badges = append(badges, SearchBadge{Key: "type", Value: "service"})
	case "route":
		badges = append(badges, SearchBadge{Key: "type", Value: "route"})
	case "project":
		badges = append(badges, SearchBadge{Key: "type", Value: "project"})
	case "page":
		badges = append(badges, SearchBadge{Key: "type", Value: "page"})
	case "registry":
		badges = append(badges, SearchBadge{Key: "type", Value: "registry"})
	case "env_template":
		badges = append(badges, SearchBadge{Key: "type", Value: "template"})
	case "help":
		badges = append(badges, SearchBadge{Key: "type", Value: "help"})
	case "setting":
		badges = append(badges, SearchBadge{Key: "type", Value: "setting"})
	case "operation":
		badges = append(badges, SearchBadge{Key: "type", Value: "action"})
	}
	
	return badges
}

// prepareFTS5Query sanitizes and enhances a query for FTS5
func prepareFTS5Query(q string) string {
	// Remove potentially problematic characters
	q = strings.TrimSpace(q)
	if q == "" {
		return "*"
	}
	
	// For short queries (1-2 chars), use simple prefix matching
	if len(q) <= 2 {
		// Escape quotes and add prefix matching
		escaped := strings.ReplaceAll(q, `"`, `""`)
		return `"` + escaped + `*"`
	}
	
	// Split into terms and add prefix matching for all terms
	terms := strings.Fields(q)
	if len(terms) == 0 {
		return "*"
	}
	
	// Build FTS5 query with prefix matching on all terms
	var ftsTerms []string
	for _, term := range terms {
		// Escape quotes
		term = strings.ReplaceAll(term, `"`, `""`)
		
		// Add prefix matching to all terms that are reasonable length
		if len(term) >= 1 {
			term = term + "*"
		}
		
		ftsTerms = append(ftsTerms, `"`+term+`"`)
	}
	
	// Use OR for better prefix matching experience
	return strings.Join(ftsTerms, " OR ")
}

// SearchReindex rebuilds the entire search index from canonical tables
func (s *Store) SearchReindex(ctx context.Context) error {
	startTime := time.Now()
	log.Info().Msg("starting search reindex")
	
	// Begin transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()
	
	// Clear existing search docs
	if _, err := tx.ExecContext(ctx, "DELETE FROM search_docs"); err != nil {
		return fmt.Errorf("failed to clear search docs: %w", err)
	}
	
	// Index all entity types in parallel using goroutines for better performance
	type indexResult struct {
		name string
		err  error
	}
	
	resultsChan := make(chan indexResult, 7)
	
	// Launch goroutines for each indexing operation
	go func() {
		err := s.indexProjects(ctx, tx)
		resultsChan <- indexResult{name: "projects", err: err}
	}()
	
	go func() {
		err := s.indexServices(ctx, tx)
		resultsChan <- indexResult{name: "services", err: err}
	}()
	
	go func() {
		err := s.indexRoutes(ctx, tx)
		resultsChan <- indexResult{name: "routes", err: err}
	}()
	
	go func() {
		err := s.indexRegistries(ctx, tx)
		resultsChan <- indexResult{name: "registries", err: err}
	}()
	
	go func() {
		err := s.indexEnvironmentVars(ctx, tx)
		resultsChan <- indexResult{name: "environment_vars", err: err}
	}()
	
	go func() {
		err := s.indexPagesStatic(ctx, tx)
		resultsChan <- indexResult{name: "pages", err: err}
	}()
	
	go func() {
		err := s.indexHelp(ctx, tx)
		resultsChan <- indexResult{name: "help", err: err}
	}()
	
	// Wait for all operations to complete and collect any errors
	var indexErrors []string
	for i := 0; i < 7; i++ {
		result := <-resultsChan
		if result.err != nil {
			indexErrors = append(indexErrors, fmt.Sprintf("%s: %v", result.name, result.err))
		}
	}
	
	// Return combined errors if any occurred
	if len(indexErrors) > 0 {
		return fmt.Errorf("indexing failures: %v", indexErrors)
	}
	
	// Rebuild FTS index
	if _, err := tx.ExecContext(ctx, "INSERT INTO search_fts(search_fts) VALUES('rebuild')"); err != nil {
		log.Warn().Err(err).Msg("failed to rebuild FTS index - FTS5 may not be available")
	}
	
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit reindex transaction: %w", err)
	}
	
	tookMs := time.Since(startTime).Milliseconds()
	log.Info().
		Int64("took_ms", tookMs).
		Msg("search reindex completed")
	return nil
}

// SearchReindexHelp rebuilds only the help documents in the search index
func (s *Store) SearchReindexHelp(ctx context.Context) error {
	startTime := time.Now()
	log.Info().Msg("starting help-only search reindex")
	
	// Begin transaction
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()
	
	// Clear existing help documents only
	if _, err := tx.ExecContext(ctx, "DELETE FROM search_docs WHERE entity_type = 'help'"); err != nil {
		return fmt.Errorf("failed to clear help search docs: %w", err)
	}
	
	// Index help documents
	if err := s.indexHelp(ctx, tx); err != nil {
		return fmt.Errorf("failed to index help documents: %w", err)
	}
	
	// Rebuild FTS index (if available)
	if _, err := tx.ExecContext(ctx, "INSERT INTO search_fts(search_fts) VALUES('rebuild')"); err != nil {
		log.Warn().Err(err).Msg("failed to rebuild FTS index - FTS5 may not be available")
	}
	
	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit help reindex transaction: %w", err)
	}
	
	tookMs := time.Since(startTime).Milliseconds()
	log.Info().
		Int64("took_ms", tookMs).
		Msg("help-only search reindex completed")
	return nil
}

// Real-time indexing functions for individual entities

// IndexProject indexes a single project for search
func (s *Store) IndexProject(ctx context.Context, projectID int64) error {
	startTime := time.Now()
	defer func() {
		tookMS := time.Since(startTime).Milliseconds()
		log.Debug().
			Int64("project_id", projectID).
			Int64("took_ms", tookMS).
			Str("operation", "index_project").
			Msg("search.index.single")
	}()
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Remove existing project entry
	if _, err := tx.ExecContext(ctx, "DELETE FROM search_docs WHERE entity_type = 'project' AND entity_id = ?", projectID); err != nil {
		return fmt.Errorf("failed to remove existing project index: %w", err)
	}

	// Index the specific project
	row := tx.QueryRowContext(ctx, `
		SELECT p.id, p.name, p.branch,
		       COUNT(s.id) as service_count
		FROM projects p
		LEFT JOIN services s ON s.project_id = p.id
		WHERE p.id = ?
		GROUP BY p.id, p.name, p.branch`, projectID)
	
	var id int64
	var name, branch string
	var serviceCount int
	
	if err := row.Scan(&id, &name, &branch, &serviceCount); err != nil {
		if err == sql.ErrNoRows {
			// Project was deleted, just commit the removal
			return tx.Commit()
		}
		return fmt.Errorf("failed to query project: %w", err)
	}

	title := name
	subtitle := fmt.Sprintf("%s • %d services", branch, serviceCount)
	tags := fmt.Sprintf("project %s %s", name, branch)
	urlPath := fmt.Sprintf("/app/projects/%d", id)

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO search_docs (entity_type, entity_id, title, subtitle, body, tags, url_path, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		"project", id, title, subtitle, name, tags, urlPath, time.Now()); err != nil {
		return fmt.Errorf("failed to index project: %w", err)
	}

	return tx.Commit()
}

// IndexService indexes a single service for search
func (s *Store) IndexService(ctx context.Context, serviceID int64) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Remove existing service entry
	if _, err := tx.ExecContext(ctx, "DELETE FROM search_docs WHERE entity_type = 'service' AND entity_id = ?", serviceID); err != nil {
		return fmt.Errorf("failed to remove existing service index: %w", err)
	}

	// Index the specific service
	row := tx.QueryRowContext(ctx, `
		SELECT s.id, s.name, s.image, COALESCE(s.description, '') as description,
		       p.name as project_name
		FROM services s
		JOIN projects p ON s.project_id = p.id
		WHERE s.id = ?`, serviceID)
	
	var id int64
	var name, image, description, projectName string
	
	if err := row.Scan(&id, &name, &image, &description, &projectName); err != nil {
		if err == sql.ErrNoRows {
			// Service was deleted, just commit the removal
			return tx.Commit()
		}
		return fmt.Errorf("failed to query service: %w", err)
	}

	title := name
	subtitle := fmt.Sprintf("%s • %s", projectName, image)
	content := fmt.Sprintf("%s %s %s", name, image, description)
	tags := fmt.Sprintf("service %s %s docker container", projectName, name)
	urlPath := fmt.Sprintf("/app/services/%d", id)

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO search_docs (entity_type, entity_id, title, subtitle, body, tags, url_path, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		"service", id, title, subtitle, content, tags, urlPath, time.Now()); err != nil {
		return fmt.Errorf("failed to index service: %w", err)
	}

	return tx.Commit()
}

// IndexRoute indexes a single route for search
func (s *Store) IndexRoute(ctx context.Context, routeID int64) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Remove existing route entry
	if _, err := tx.ExecContext(ctx, "DELETE FROM search_docs WHERE entity_type = 'route' AND entity_id = ?", routeID); err != nil {
		return fmt.Errorf("failed to remove existing route index: %w", err)
	}

	// Index the specific route
	row := tx.QueryRowContext(ctx, `
		SELECT r.id, r.domain, r.port, r.tls,
		       s.name as service_name, p.name as project_name
		FROM routes r
		JOIN services s ON r.service_id = s.id
		JOIN projects p ON s.project_id = p.id
		WHERE r.id = ?`, routeID)
	
	var id int64
	var domain, serviceName, projectName string
	var port int
	var tls bool
	
	if err := row.Scan(&id, &domain, &port, &tls, &serviceName, &projectName); err != nil {
		if err == sql.ErrNoRows {
			// Route was deleted, just commit the removal
			return tx.Commit()
		}
		return fmt.Errorf("failed to query route: %w", err)
	}

	title := domain
	protocol := "http"
	tlsStatus := "HTTP"
	if tls {
		protocol = "https"
		tlsStatus = "HTTPS"
	}
	subtitle := fmt.Sprintf("%s • %s:%d → %s", projectName, tlsStatus, port, serviceName)
	content := fmt.Sprintf("%s %s %d", domain, protocol, port)
	tags := fmt.Sprintf("route %s %s %d", domain, protocol, port)
	urlPath := fmt.Sprintf("/app/routes")

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO search_docs (entity_type, entity_id, title, subtitle, body, tags, url_path, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		"route", id, title, subtitle, content, tags, urlPath, time.Now()); err != nil {
		return fmt.Errorf("failed to index route: %w", err)
	}

	return tx.Commit()
}

// IndexRegistryByStringID indexes a single registry for search using string ID
func (s *Store) IndexRegistryByStringID(ctx context.Context, registryID string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Convert string ID to int64 for search_docs table
	entityID := int64(len(registryID))
	for _, b := range []byte(registryID) {
		entityID = entityID*31 + int64(b)
	}

	// Remove existing registry entry
	if _, err := tx.ExecContext(ctx, "DELETE FROM search_docs WHERE entity_type = 'registry' AND entity_id = ?", entityID); err != nil {
		return fmt.Errorf("failed to remove existing registry index: %w", err)
	}

	// Index the specific registry
	row := tx.QueryRowContext(ctx, `
		SELECT id, name, server, COALESCE(description, '')
		FROM registries
		WHERE id = ?`, registryID)
	
	var id, name, server, description string
	
	if err := row.Scan(&id, &name, &server, &description); err != nil {
		if err == sql.ErrNoRows {
			// Registry was deleted, just commit the removal
			return tx.Commit()
		}
		return fmt.Errorf("failed to query registry: %w", err)
	}

	title := name
	subtitle := fmt.Sprintf("Docker Registry • %s", server)
	content := fmt.Sprintf("%s %s %s", name, server, description)
	tags := fmt.Sprintf("registry docker %s credentials", name)
	urlPath := "/app/settings/registries"

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO search_docs (entity_type, entity_id, title, subtitle, body, tags, url_path, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		"registry", entityID, title, subtitle, content, tags, urlPath, time.Now()); err != nil {
		return fmt.Errorf("failed to index registry: %w", err)
	}

	return tx.Commit()
}

// IndexRegistry indexes a single registry for search
func (s *Store) IndexRegistry(ctx context.Context, registryID int64) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	// Remove existing registry entry
	if _, err := tx.ExecContext(ctx, "DELETE FROM search_docs WHERE entity_type = 'registry' AND entity_id = ?", registryID); err != nil {
		return fmt.Errorf("failed to remove existing registry index: %w", err)
	}

	// Index the specific registry
	row := tx.QueryRowContext(ctx, `
		SELECT id, name, url, COALESCE(description, '')
		FROM registries
		WHERE id = ?`, registryID)
	
	var id int64
	var name, url, description string
	
	if err := row.Scan(&id, &name, &url, &description); err != nil {
		if err == sql.ErrNoRows {
			// Registry was deleted, just commit the removal
			return tx.Commit()
		}
		return fmt.Errorf("failed to query registry: %w", err)
	}

	title := name
	subtitle := fmt.Sprintf("Docker Registry • %s", url)
	content := fmt.Sprintf("%s %s %s", name, url, description)
	tags := fmt.Sprintf("registry docker %s credentials", name)
	urlPath := "/app/settings/registries"

	if _, err := tx.ExecContext(ctx, `
		INSERT INTO search_docs (entity_type, entity_id, title, subtitle, body, tags, url_path, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		"registry", id, title, subtitle, content, tags, urlPath, time.Now()); err != nil {
		return fmt.Errorf("failed to index registry: %w", err)
	}

	return tx.Commit()
}

// indexProjects indexes all projects
func (s *Store) indexProjects(ctx context.Context, tx *sql.Tx) error {
	rows, err := tx.QueryContext(ctx, `
		SELECT p.id, p.name, p.branch,
		       COUNT(s.id) as service_count
		FROM projects p
		LEFT JOIN services s ON s.project_id = p.id
		GROUP BY p.id, p.name, p.branch`)
	if err != nil {
		return err
	}
	defer rows.Close()
	
	for rows.Next() {
		var id int64
		var name, branch string
		var serviceCount int
		
		if err := rows.Scan(&id, &name, &branch, &serviceCount); err != nil {
			return err
		}
		
		doc := &SearchDoc{
			EntityType: "project",
			EntityID:   id,
			Title:      name,
			Subtitle:   fmt.Sprintf("%d services • %s", serviceCount, branch),
			Body:       fmt.Sprintf("Project %s on branch %s with %d services", name, branch, serviceCount),
			Tags:       fmt.Sprintf("project %s %s", name, branch),
			URLPath:    fmt.Sprintf("/app/projects/%d", id),
		}
		
		if err := s.insertSearchDocTx(ctx, tx, doc); err != nil {
			return err
		}
	}
	
	return rows.Err()
}

// indexServices indexes all services
func (s *Store) indexServices(ctx context.Context, tx *sql.Tx) error {
	rows, err := tx.QueryContext(ctx, `
		SELECT s.id, s.name, COALESCE(s.description, ''), s.image, s.project_id, p.name as project_name
		FROM services s
		JOIN projects p ON p.id = s.project_id`)
	if err != nil {
		return err
	}
	defer rows.Close()
	
	for rows.Next() {
		var id, projectID int64
		var name, description, image, projectName string
		
		if err := rows.Scan(&id, &name, &description, &image, &projectID, &projectName); err != nil {
			return err
		}
		
		subtitle := ""
		if image != "" {
			subtitle = fmt.Sprintf("image: %s", image)
		}
		
		// Create meaningful body text from service info
		body := description
		if body == "" {
			body = fmt.Sprintf("Service %s running %s in project %s", name, image, projectName)
		}
		
		doc := &SearchDoc{
			EntityType: "service",
			EntityID:   id,
			Title:      name,
			Subtitle:   subtitle,
			Body:       body,
			Tags:       fmt.Sprintf("service %s %s %s docker container deployment microservice", projectName, name, image),
			ProjectID:  &projectID,
			URLPath:    fmt.Sprintf("/app/services/%d", id),
		}
		
		if err := s.insertSearchDocTx(ctx, tx, doc); err != nil {
			return err
		}
	}
	
	return rows.Err()
}

// indexRoutes indexes all routes
func (s *Store) indexRoutes(ctx context.Context, tx *sql.Tx) error {
	rows, err := tx.QueryContext(ctx, `
		SELECT r.id, r.domain, r.port, r.tls, r.service_id, s.name as service_name, s.project_id
		FROM routes r
		LEFT JOIN services s ON s.id = r.service_id`)
	if err != nil {
		return err
	}
	defer rows.Close()
	
	for rows.Next() {
		var id int64
		var domain string
		var port int
		var tls bool
		var serviceID sql.NullInt64
		var serviceName sql.NullString
		var projectID sql.NullInt64
		
		if err := rows.Scan(&id, &domain, &port, &tls, &serviceID, &serviceName, &projectID); err != nil {
			return err
		}
		
		protocol := "http"
		if tls {
			protocol = "https"
		}
		
		title := fmt.Sprintf("%s://%s:%d", protocol, domain, port)
		subtitle := ""
		if serviceName.Valid {
			subtitle = fmt.Sprintf("→ %s", serviceName.String)
		}
		
		var pID *int64
		if projectID.Valid {
			pID = &projectID.Int64
		}
		
		body := fmt.Sprintf("Route %s on port %d", domain, port)
		if serviceName.Valid {
			body += fmt.Sprintf(" routing to service %s", serviceName.String)
		}
		
		doc := &SearchDoc{
			EntityType: "route",
			EntityID:   id,
			Title:      title,
			Subtitle:   subtitle,
			Body:       body,
			Tags:       fmt.Sprintf("route %s %s %d", domain, protocol, port),
			ProjectID:  pID,
			URLPath:    fmt.Sprintf("/app/routes/%d", id),
		}
		
		if err := s.insertSearchDocTx(ctx, tx, doc); err != nil {
			return err
		}
	}
	
	return rows.Err()
}

// indexRegistries indexes all Docker registries
func (s *Store) indexRegistries(ctx context.Context, tx *sql.Tx) error {
	rows, err := tx.QueryContext(ctx, `
		SELECT id, name, url, COALESCE(description, '')
		FROM registries`)
	if err != nil {
		// Table might not exist yet, skip silently
		return nil
	}
	defer rows.Close()
	
	for rows.Next() {
		var id int64
		var name, url, description string
		
		if err := rows.Scan(&id, &name, &url, &description); err != nil {
			return err
		}
		
		body := description
		if body == "" {
			body = fmt.Sprintf("Docker registry %s at %s", name, url)
		}
		
		doc := &SearchDoc{
			EntityType: "registry",
			EntityID:   id,
			Title:      name,
			Subtitle:   url,
			Body:       body,
			Tags:       fmt.Sprintf("registry docker %s credentials", name),
			URLPath:    "/app/settings/registries",
		}
		
		if err := s.insertSearchDocTx(ctx, tx, doc); err != nil {
			return err
		}
	}
	
	return rows.Err()
}

// indexEnvironmentVars indexes environment variables and templates
func (s *Store) indexEnvironmentVars(ctx context.Context, tx *sql.Tx) error {
	// Index environment templates first - note: id is VARCHAR, so we'll use a hash for EntityID
	rows, err := tx.QueryContext(ctx, `
		SELECT id, name, COALESCE(description, ''), environment_type
		FROM environment_templates`)
	if err != nil {
		// Table might not exist yet, skip silently
		return nil
	}
	defer rows.Close()
	
	for rows.Next() {
		var templateID, name, description, envType string
		
		if err := rows.Scan(&templateID, &name, &description, &envType); err != nil {
			return err
		}
		
		body := description
		if body == "" {
			body = fmt.Sprintf("Environment template for %s applications", envType)
		}
		
		// Use a simple hash of the template ID as EntityID since it's a string
		entityID := int64(len(templateID)) // Simple approach, could use hash if needed
		for _, b := range []byte(templateID) {
			entityID = entityID*31 + int64(b)
		}
		if entityID < 0 {
			entityID = -entityID
		}
		
		doc := &SearchDoc{
			EntityType: "env_template",
			EntityID:   entityID,
			Title:      name,
			Subtitle:   fmt.Sprintf("%s template", envType),
			Body:       body,
			Tags:       fmt.Sprintf("environment template %s %s", envType, name),
			URLPath:    fmt.Sprintf("/app/settings/environments/%s", templateID),
		}
		
		if err := s.insertSearchDocTx(ctx, tx, doc); err != nil {
			return err
		}
	}
	
	return rows.Err()
}

// insertSearchDocTx inserts a search document within a transaction
func (s *Store) insertSearchDocTx(ctx context.Context, tx *sql.Tx, doc *SearchDoc) error {
	query := `
		INSERT INTO search_docs 
		(entity_type, entity_id, title, subtitle, body, tags, project_id, url_path, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
	
	_, err := tx.ExecContext(ctx, query,
		doc.EntityType, doc.EntityID, doc.Title, doc.Subtitle,
		doc.Body, doc.Tags, doc.ProjectID, doc.URLPath)
	
	return err
}

// IndexPagesStatic indexes static navigation pages into the search system
func (s *Store) IndexPagesStatic(ctx context.Context) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	if err := s.indexPagesStatic(ctx, tx); err != nil {
		return fmt.Errorf("failed to index pages: %w", err)
	}

	return tx.Commit()
}

// SearchSeedPages reseeds pages without a full reindex
func (s *Store) SearchSeedPages(ctx context.Context) error {
	return s.IndexPagesStatic(ctx)
}

// indexPagesStatic indexes static navigation pages
func (s *Store) indexPagesStatic(ctx context.Context, tx *sql.Tx) error {
	// Remove existing page entries
	if _, err := tx.ExecContext(ctx, "DELETE FROM search_docs WHERE entity_type = 'page'"); err != nil {
		return fmt.Errorf("failed to remove existing page entries: %w", err)
	}

	// Define the curated list of pages matching frontend CommandPalette
	pages := []struct {
		slug     string
		title    string
		subtitle string
		urlPath  string
		content  string
		tags     string
	}{
		// Main Navigation
		{"dashboard", "Dashboard", "System overview and metrics", "/app/", "Dashboard overview metrics status", "dashboard overview metrics status"},
		{"projects", "Projects", "Manage your projects", "/app/projects", "Projects management repository", "projects management repository"},
		{"services", "Services", "Container services", "/app/services", "Services containers docker", "services containers docker"},
		{"routes", "Routes", "Network routing", "/app/routes", "Routes network proxy", "routes network proxy"},
		{"nodes", "Nodes", "Infrastructure nodes", "/app/nodes", "Nodes infrastructure servers", "nodes infrastructure servers"},

		// Deployment Section
		{"quickstart", "Quick Start", "Deployment quick start", "/app/quickstart", "Quick Start deployment getting started guide", "quickstart deployment getting started guide tutorial"},
		{"quickstart-spring", "Spring Boot", "Java quickstart deployment", "/app/quickstart/spring", "Spring Boot Java quickstart deployment framework", "spring boot java quickstart deployment framework"},
		{"templates", "Service Templates", "Configuration presets", "/app/templates", "Templates configurations presets service deployment", "templates configurations presets service deployment"},

		// Administration Section
		{"administration", "System Admin", "Administration management", "/app/administration", "System Admin administration management users permissions", "system admin administration management users permissions"},
		{"registries", "Registries", "Docker registry management", "/app/registries", "Registries docker hub container registry credentials", "registries docker hub container registry credentials"},
		{"logs", "System Logs", "Debugging and audit", "/app/logs", "System Logs debugging audit monitoring errors events", "system logs debugging audit monitoring errors events"},
		{"clients", "Clients", "API access management", "/app/clients", "Clients connections API access tokens authentication", "clients connections api access tokens authentication"},

		// Configuration Section
		{"settings", "Settings", "System configuration", "/app/settings", "Settings configuration preferences system config", "settings configuration preferences system config"},
		{"integrations", "Integrations", "External services", "/app/settings/integrations", "Integrations GitHub OAuth webhooks external services API", "integrations github oauth webhooks external services api"},
	}

	for _, page := range pages {
		// Generate a stable hash of the slug for entity_id
		entityID := int64(len(page.slug))
		for _, b := range []byte(page.slug) {
			entityID = entityID*31 + int64(b)
		}
		if entityID < 0 {
			entityID = -entityID
		}

		doc := &SearchDoc{
			EntityType: "page",
			EntityID:   entityID,
			Title:      page.title,
			Subtitle:   page.subtitle,
			Body:       page.content,
			Tags:       page.tags,
			ProjectID:  nil, // Pages are not project-scoped
			URLPath:    page.urlPath,
		}

		if err := s.insertSearchDocTx(ctx, tx, doc); err != nil {
			return fmt.Errorf("failed to index page %s: %w", page.slug, err)
		}
	}

	// Add comprehensive settings pages with rich content
	settingsPages := []struct {
		slug     string
		title    string
		subtitle string
		urlPath  string
		content  string
		tags     string
	}{
		// Settings Sub-pages with Rich Context
		{"settings-system-admin", "System Administration", "System security and administration controls", "/app/settings/system-admin", "System Administration lockdown mode emergency security restart backup restore system health maintenance", "system admin lockdown emergency security restart backup restore maintenance"},
		{"settings-auth", "Authentication", "User authentication and authorization", "/app/settings/auth", "Authentication authorization login logout session management security user access", "authentication authorization login logout session management security user access"},
		{"settings-license", "License Management", "Software license activation and management", "/app/settings/license", "License management activation deactivation features limits plan upgrade enterprise", "license management activation deactivation features limits plan upgrade enterprise"},
		{"settings-plan-limits", "Plan & Limits", "Resource usage and plan limitations", "/app/settings/plan-limits", "Plan limits usage quotas resources services projects capacity billing upgrade", "plan limits usage quotas resources services projects capacity billing upgrade"},
		{"settings-integrations-github", "GitHub Integration", "GitHub repository and OAuth integration", "/app/settings/integrations/github", "GitHub integration OAuth repository webhooks continuous deployment CI CD source control", "github integration oauth repository webhooks continuous deployment ci cd source control"},
		{"settings-integrations-proxy", "Nginx Proxy Settings", "Reverse proxy and load balancing configuration", "/app/settings/integrations/proxy", "Nginx proxy reverse proxy load balancing SSL certificates HTTPS configuration networking", "nginx proxy reverse proxy load balancing ssl certificates https configuration networking"},
		{"settings-certificates", "SSL Certificates", "SSL/TLS certificate management", "/app/settings/certificates", "SSL certificates TLS HTTPS security encryption domain verification Let's Encrypt", "ssl certificates tls https security encryption domain verification lets encrypt"},
		{"settings-env-templates", "Environment Templates", "Environment variable templates and configurations", "/app/settings/environments", "Environment templates variables configuration database development production staging", "environment templates variables configuration database development production staging"},
	}

	// Index settings pages
	for _, page := range settingsPages {
		entityID := int64(len(page.slug))
		for _, b := range []byte(page.slug) {
			entityID = entityID*31 + int64(b)
		}
		if entityID < 0 {
			entityID = -entityID
		}

		doc := &SearchDoc{
			EntityType: "setting",
			EntityID:   entityID,
			Title:      page.title,
			Subtitle:   page.subtitle,
			Body:       page.content,
			Tags:       page.tags,
			ProjectID:  nil,
			URLPath:    page.urlPath,
		}

		if err := s.insertSearchDocTx(ctx, tx, doc); err != nil {
			return fmt.Errorf("failed to index settings page %s: %w", page.slug, err)
		}
	}

	// Add searchable system operations and actions
	operations := []struct {
		slug     string
		title    string
		subtitle string
		urlPath  string
		content  string
		tags     string
	}{
		{"operation-lockdown", "Enable Lockdown Mode", "Emergency system lockdown and security mode", "/app/settings/system-admin", "Lockdown mode emergency security disable access maintenance mode system protection", "lockdown emergency security disable access maintenance mode system protection"},
		{"operation-backup", "Create System Backup", "Backup system configuration and data", "/app/settings/system-admin", "Backup system configuration export data restore recovery disaster", "backup system configuration export data restore recovery disaster"},
		{"operation-restore", "Restore System Backup", "Restore system from backup file", "/app/settings/system-admin", "Restore system backup recovery import configuration disaster recovery", "restore system backup recovery import configuration disaster recovery"},
		{"operation-reindex", "Rebuild Search Index", "Rebuild and refresh search index", "/app/settings/system-admin", "Reindex search rebuild refresh index maintenance search optimization", "reindex search rebuild refresh index maintenance search optimization"},
		{"operation-activate-license", "Activate License", "Activate software license key", "/app/settings/license", "Activate license key registration enterprise features unlock premium", "activate license key registration enterprise features unlock premium"},
		{"operation-ssl-setup", "SSL Certificate Setup", "Configure SSL certificates for domains", "/app/settings/certificates", "SSL certificate setup HTTPS domain verification security encryption", "ssl certificate setup https domain verification security encryption"},
	}

	// Index operations
	for _, op := range operations {
		entityID := int64(len(op.slug))
		for _, b := range []byte(op.slug) {
			entityID = entityID*31 + int64(b)
		}
		if entityID < 0 {
			entityID = -entityID
		}

		doc := &SearchDoc{
			EntityType: "operation",
			EntityID:   entityID,
			Title:      op.title,
			Subtitle:   op.subtitle,
			Body:       op.content,
			Tags:       op.tags,
			ProjectID:  nil,
			URLPath:    op.urlPath,
		}

		if err := s.insertSearchDocTx(ctx, tx, doc); err != nil {
			return fmt.Errorf("failed to index operation %s: %w", op.slug, err)
		}
	}

	return nil
}

// SearchSuggestion represents a search autocomplete suggestion
type SearchSuggestion struct {
	Query    string `json:"q"`
	Label    string `json:"label"`
	Type     string `json:"type"`
	URLPath  string `json:"url_path"`
}

// SearchSuggestionsResponse represents the suggestions API response
type SearchSuggestionsResponse struct {
	Suggestions []SearchSuggestion `json:"suggestions"`
	TookMS      int64              `json:"took_ms"`
	FTS5        bool               `json:"fts5"`
}

// SearchSuggest performs prefix-based autocomplete search
func (s *Store) SearchSuggest(ctx context.Context, prefix string, filter SearchFilter) ([]SearchSuggestion, error) {
	// Validate prefix length
	if len(strings.TrimSpace(prefix)) < 2 {
		return []SearchSuggestion{}, nil
	}
	
	// Check FTS5 capability first
	caps, err := s.CheckFTS5Support(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to check search capabilities: %w", err)
	}
	
	if caps.FTS5Enabled {
		return s.searchSuggestFTS5(ctx, prefix, filter)
	}
	
	if filter.AllowBasic {
		return s.searchSuggestBasic(ctx, prefix, filter)
	}
	
	return nil, fmt.Errorf("FTS5 not available and basic search not allowed")
}

// searchSuggestFTS5 performs FTS5 prefix-based suggestions
func (s *Store) searchSuggestFTS5(ctx context.Context, prefix string, filter SearchFilter) ([]SearchSuggestion, error) {
	// Prepare FTS5 prefix query
	ftsQuery := prepareFTS5PrefixQuery(prefix)
	
	query := `
		SELECT sd.entity_id, sd.entity_type, sd.title, sd.subtitle, sd.url_path,
		       bm25(search_fts, 1.2, 0.75) + 
		       CASE 
		         WHEN LOWER(sd.title) LIKE LOWER(?) THEN 2.0
		         ELSE 0.0
		       END AS score
		FROM search_fts
		JOIN search_docs sd ON sd.id = search_fts.rowid
		WHERE search_fts MATCH ?`
	
	prefixPattern := strings.ToLower(strings.TrimSpace(prefix)) + "%"
	args := []interface{}{prefixPattern, ftsQuery}
	
	// Add filters
	if filter.Type != "" {
		query += " AND sd.entity_type = ?"
		args = append(args, filter.Type)
	}
	
	if filter.ProjectID != nil {
		query += " AND sd.project_id = ?"
		args = append(args, *filter.ProjectID)
	}
	
	query += " ORDER BY score ASC, sd.updated_at DESC LIMIT ?"
	args = append(args, filter.Limit)
	
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to execute FTS5 suggest query: %w", err)
	}
	defer rows.Close()
	
	return s.scanSearchSuggestions(rows, prefix)
}

// searchSuggestBasic performs LIKE-based prefix suggestions 
func (s *Store) searchSuggestBasic(ctx context.Context, prefix string, filter SearchFilter) ([]SearchSuggestion, error) {
	// Sanitize prefix for LIKE
	searchPrefix := strings.ToLower(strings.TrimSpace(prefix))
	searchPrefix = strings.ReplaceAll(searchPrefix, "%", "\\%")
	
	// Create different patterns for better matching (prefix gets highest score)
	exactPrefixPattern := searchPrefix + "%"
	containsPattern := "%" + searchPrefix + "%"
	
	query := `
		SELECT entity_id, entity_type, title, subtitle, url_path,
		       CASE 
		         WHEN LOWER(title) LIKE ? THEN 3
		         WHEN LOWER(title) LIKE ? THEN 2
		         WHEN LOWER(subtitle) LIKE ? THEN 1.5
		         WHEN LOWER(body) LIKE ? THEN 1
		         ELSE 0.5
		       END AS score
		FROM search_docs
		WHERE (LOWER(title) LIKE ? OR LOWER(title) LIKE ? OR
		       LOWER(subtitle) LIKE ? OR LOWER(body) LIKE ?)`
	
	args := []interface{}{
		exactPrefixPattern, containsPattern, exactPrefixPattern, exactPrefixPattern, // scoring patterns
		exactPrefixPattern, containsPattern, exactPrefixPattern, exactPrefixPattern, // WHERE clause patterns
	}
	
	// Add filters
	if filter.Type != "" {
		query += " AND entity_type = ?"
		args = append(args, filter.Type)
	}
	
	if filter.ProjectID != nil {
		query += " AND project_id = ?"
		args = append(args, *filter.ProjectID)
	}
	
	// Smaller limit for basic search
	limit := filter.Limit
	if limit > 10 {
		limit = 10
	}
	
	query += " ORDER BY score DESC, updated_at DESC LIMIT ?"
	args = append(args, limit)
	
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to execute basic suggest query: %w", err)
	}
	defer rows.Close()
	
	return s.scanSearchSuggestions(rows, prefix)
}

// scanSearchSuggestions scans database rows into SearchSuggestion structs
func (s *Store) scanSearchSuggestions(rows *sql.Rows, prefix string) ([]SearchSuggestion, error) {
	var suggestions []SearchSuggestion
	
	for rows.Next() {
		var hit SearchHit
		err := rows.Scan(
			&hit.EntityID, &hit.Type, &hit.Title, 
			&hit.Subtitle, &hit.URLPath, &hit.Score)
		if err != nil {
			return nil, fmt.Errorf("failed to scan search suggestion: %w", err)
		}
		
		suggestion := SearchSuggestion{
			Query:   hit.Title,
			Label:   formatSuggestionLabel(hit),
			Type:    hit.Type,
			URLPath: hit.URLPath,
		}
		
		suggestions = append(suggestions, suggestion)
	}
	
	return suggestions, rows.Err()
}

// formatSuggestionLabel formats a human-readable label for the suggestion
func formatSuggestionLabel(hit SearchHit) string {
	switch hit.Type {
	case "page":
		return hit.Title
	case "service":
		if hit.Subtitle != "" {
			return fmt.Sprintf("%s — service", hit.Title)
		}
		return fmt.Sprintf("%s — service", hit.Title)
	case "project":
		if hit.Subtitle != "" {
			return fmt.Sprintf("%s — project", hit.Title)
		}
		return fmt.Sprintf("%s — project", hit.Title)
	case "route":
		return fmt.Sprintf("%s — route", hit.Title)
	case "registry":
		return fmt.Sprintf("%s — registry", hit.Title)
	case "env_template":
		return fmt.Sprintf("%s — template", hit.Title)
	default:
		return hit.Title
	}
}

// prepareFTS5PrefixQuery sanitizes and enhances a prefix query for FTS5
func prepareFTS5PrefixQuery(prefix string) string {
	// Remove potentially problematic characters
	prefix = strings.TrimSpace(prefix)
	if prefix == "" {
		return "*"
	}
	
	// For very short queries, use simple prefix matching
	if len(prefix) <= 2 {
		escaped := strings.ReplaceAll(prefix, `"`, `""`)
		return `"` + escaped + `*"`
	}
	
	// Split into terms and add prefix matching to all terms
	terms := strings.Fields(prefix)
	if len(terms) == 0 {
		return "*"
	}
	
	// Build FTS5 prefix query with prefix matching on all terms
	var ftsTerms []string
	for _, term := range terms {
		// Escape quotes
		term = strings.ReplaceAll(term, `"`, `""`)
		
		// Add prefix matching to all terms
		if len(term) >= 1 {
			term = term + "*"
		}
		
		ftsTerms = append(ftsTerms, `"`+term+`"`)
	}
	
	// Use OR for better prefix matching experience in suggestions
	return strings.Join(ftsTerms, " OR ")
}

// SearchQueryBasic performs basic SQL LIKE search when FTS5 is unavailable or fails
// This is a public wrapper around the internal searchQueryBasic for API fallback
func (s *Store) SearchQueryBasic(ctx context.Context, query string, filter SearchFilter) ([]SearchHit, error) {
	// Force allow basic search for this fallback call
	filter.AllowBasic = true
	return s.searchQueryBasic(ctx, query, filter)
}

// HelpDoc represents a help document from the manifest
type HelpDoc struct {
	Slug      string   `json:"slug"`
	Title     string   `json:"title"`
	Section   string   `json:"section"`
	RelPath   string   `json:"rel_path"`
	Tags      []string `json:"tags"`
	Version   string   `json:"version"`
	WordCount int      `json:"word_count"`
}

// HelpManifest represents the app help manifest structure
type HelpManifest struct {
	Files []HelpDoc `json:"files"`
}

// indexHelp indexes help documentation for search
func (s *Store) indexHelp(ctx context.Context, tx *sql.Tx) error {
	// Remove existing help entries
	if _, err := tx.ExecContext(ctx, "DELETE FROM search_docs WHERE entity_type = 'help'"); err != nil {
		return fmt.Errorf("failed to remove existing help entries: %w", err)
	}

	// Read and parse manifest file
	manifestPath := "appdocs/_manifest.json"
	manifestFile, err := os.Open(manifestPath)
	if os.IsNotExist(err) {
		log.Warn().Str("path", manifestPath).Msg("help manifest not found, skipping help indexing")
		return nil
	} else if err != nil {
		return fmt.Errorf("failed to open help manifest: %w", err)
	}
	defer manifestFile.Close()

	var manifest HelpManifest
	if err := json.NewDecoder(manifestFile).Decode(&manifest); err != nil {
		return fmt.Errorf("failed to decode help manifest: %w", err)
	}

	// Process each help document
	for _, doc := range manifest.Files {
		// Generate stable entity ID from slug hash
		hasher := md5.New()
		hasher.Write([]byte(doc.Slug))
		hashBytes := hasher.Sum(nil)
		// Convert to positive int64
		entityID := int64(hashBytes[0])<<24 | int64(hashBytes[1])<<16 | int64(hashBytes[2])<<8 | int64(hashBytes[3])
		if entityID < 0 {
			entityID = -entityID
		}

		// Read document content for search body
		docPath := fmt.Sprintf("appdocs/%s", doc.RelPath)
		body := s.extractHelpBody(docPath)

		// Create search document
		searchDoc := &SearchDoc{
			EntityType: "help",
			EntityID:   entityID,
			Title:      doc.Title,
			Subtitle:   doc.Section,
			Body:       body,
			Tags:       fmt.Sprintf("help %s %s %s", strings.ToLower(doc.Section), doc.Slug, strings.Join(doc.Tags, " ")),
			URLPath:    fmt.Sprintf("/app/help/%s", doc.Slug),
		}

		// Insert search document
		if err := s.upsertSearchDoc(ctx, tx, searchDoc); err != nil {
			return fmt.Errorf("failed to index help doc %s: %w", doc.Slug, err)
		}
	}

	log.Info().Int("count", len(manifest.Files)).Msg("indexed help documents")
	return nil
}

// extractHelpBody extracts searchable content from help markdown file
func (s *Store) extractHelpBody(filePath string) string {
	file, err := os.Open(filePath)
	if err != nil {
		log.Debug().Str("path", filePath).Msg("could not read help file for indexing")
		return ""
	}
	defer file.Close()

	// Read first 4KB for search indexing
	buffer := make([]byte, 4096)
	n, err := file.Read(buffer)
	if err != nil && err != io.EOF {
		return ""
	}
	content := string(buffer[:n])

	// Strip front matter
	frontMatterRegex := regexp.MustCompile(`(?s)^---\n.*?\n---\n`)
	content = frontMatterRegex.ReplaceAllString(content, "")

	// Strip markdown syntax but keep content
	// Remove headers but keep text
	content = regexp.MustCompile(`#{1,6}\s+`).ReplaceAllString(content, "")
	// Remove links but keep link text
	content = regexp.MustCompile(`\[([^\]]+)\]\([^)]+\)`).ReplaceAllString(content, "$1")
	// Remove inline code backticks
	content = regexp.MustCompile("`([^`]+)`").ReplaceAllString(content, "$1")
	// Remove bold/italic markers
	content = regexp.MustCompile(`\*\*([^*]+)\*\*`).ReplaceAllString(content, "$1")
	content = regexp.MustCompile(`\*([^*]+)\*`).ReplaceAllString(content, "$1")
	
	// Clean up whitespace and return first few paragraphs
	lines := strings.Split(content, "\n")
	var bodyLines []string
	paragraphCount := 0
	
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			if len(bodyLines) > 0 {
				paragraphCount++
				if paragraphCount >= 3 {
					break
				}
			}
		} else {
			bodyLines = append(bodyLines, line)
		}
	}
	
	return strings.TrimSpace(strings.Join(bodyLines, " "))
}

// upsertSearchDoc helper function to insert search document using transaction
func (s *Store) upsertSearchDoc(ctx context.Context, tx *sql.Tx, doc *SearchDoc) error {
	query := `
		INSERT OR REPLACE INTO search_docs 
		(entity_type, entity_id, title, subtitle, body, tags, project_id, url_path, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
	
	_, err := tx.ExecContext(ctx, query, 
		doc.EntityType, doc.EntityID, doc.Title, doc.Subtitle, 
		doc.Body, doc.Tags, doc.ProjectID, doc.URLPath)
	if err != nil {
		return fmt.Errorf("failed to upsert search doc: %w", err)
	}
	
	return nil
}

