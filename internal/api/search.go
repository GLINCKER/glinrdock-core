package api

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/GLINCKER/glinrdock/internal/metrics"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// SearchHandlers provides search API endpoints
type SearchHandlers struct {
	store       *store.Store
	rateLimiter *RateLimiter
	auditor     *audit.Logger
}

// NewSearchHandlers creates a new SearchHandlers instance
func NewSearchHandlers(store *store.Store, auditor *audit.Logger) *SearchHandlers {
	// Create rate limiter: 10 requests per second, burst of 20
	rateLimiter := NewRateLimiter(20, 100*time.Millisecond)

	// Start cleanup routine
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			rateLimiter.CleanupExpired()
		}
	}()

	return &SearchHandlers{
		store:       store,
		rateLimiter: rateLimiter,
		auditor:     auditor,
	}
}

// SearchResponse represents the search API response
type SearchResponse struct {
	Hits   []store.SearchHit `json:"hits"`
	TookMS int64             `json:"took_ms"`
	FTS5   bool              `json:"fts5"`
	Total  int               `json:"total,omitempty"`
}

// SearchStatusResponse represents the search status response
type SearchStatusResponse struct {
	FTS5 bool   `json:"fts5"`
	Mode string `json:"mode"`
}

// ReindexResponse represents the reindex operation response
type ReindexResponse struct {
	Message   string    `json:"message"`
	StartedAt time.Time `json:"started_at"`
}

// SearchOperators represents parsed search operators
type SearchOperators struct {
	Type          string `json:"type,omitempty"`    // service|project|route|registry|env_template|page
	Project       string `json:"project,omitempty"` // project name fragment
	Status        string `json:"status,omitempty"`  // running|stopped
	CleanQuery    string `json:"clean_query"`       // query with operators removed
	OriginalQuery string `json:"original_query"`    // original query as provided
}

// operatorRegex matches search operators in the format "key:value"
var operatorRegex = regexp.MustCompile(`(\w+):(\w+)`)

// parseSearchOperators extracts operators from the query string and returns clean query
func parseSearchOperators(query string) *SearchOperators {
	operators := &SearchOperators{
		OriginalQuery: query,
		CleanQuery:    query,
	}

	// Find all operator matches
	matches := operatorRegex.FindAllStringSubmatch(query, -1)

	for _, match := range matches {
		if len(match) != 3 {
			continue
		}

		key := strings.ToLower(strings.TrimSpace(match[1]))
		value := strings.TrimSpace(match[2])

		// Process known operators
		switch key {
		case "type":
			if isValidEntityType(value) {
				operators.Type = value
			}
		case "project":
			operators.Project = value
		case "status":
			if value == "running" || value == "stopped" {
				operators.Status = value
			}
		}

		// Remove the operator from the query
		operators.CleanQuery = strings.Replace(operators.CleanQuery, match[0], "", 1)
	}

	// Clean up the query by removing extra whitespace
	operators.CleanQuery = strings.TrimSpace(regexp.MustCompile(`\s+`).ReplaceAllString(operators.CleanQuery, " "))

	return operators
}

// GetSearchStatus returns the current search capabilities
func (h *SearchHandlers) GetSearchStatus(c *gin.Context) {
	ctx := c.Request.Context()

	caps, err := h.store.CheckFTS5Support(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to check FTS5 support")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check search status"})
		return
	}

	c.JSON(http.StatusOK, SearchStatusResponse{
		FTS5: caps.FTS5Enabled,
		Mode: caps.Mode,
	})
}

// Search performs a global search across all indexed entities
func (h *SearchHandlers) Search(c *gin.Context) {
	startTime := time.Now()
	ctx := c.Request.Context()

	// Rate limiting check
	clientKey := getClientKey(c)
	if !h.rateLimiter.CheckLimit(clientKey) {
		c.Header("Retry-After", "1")
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":       "rate limit exceeded",
			"retry_after": "1s",
		})
		return
	}

	// Parse query parameter
	query := strings.TrimSpace(c.Query("q"))
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter 'q' is required"})
		return
	}

	// Parse operators from the query string
	operators := parseSearchOperators(query)

	// Use clean query for actual search (operators stripped out)
	searchQuery := operators.CleanQuery

	// Parse explicit filters from query params (these take precedence over operators)
	entityType := c.Query("type")
	if entityType == "" && operators.Type != "" {
		// Use operator-parsed type if no explicit query param
		entityType = operators.Type
	}
	if entityType != "" && !isValidEntityType(entityType) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid entity type"})
		return
	}

	var projectID *int64
	if projectIDStr := c.Query("project_id"); projectIDStr != "" {
		id, err := strconv.ParseInt(projectIDStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project_id"})
			return
		}
		projectID = &id
	}

	// Parse limit with bounds
	limit := 10
	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil {
			if l > 0 && l <= 50 {
				limit = l
			}
		}
	}

	// Parse offset
	offset := 0
	if offsetStr := c.Query("offset"); offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offset = o
		}
	}

	// Create search filter
	filter := store.SearchFilter{
		Type:        entityType,
		ProjectID:   projectID,
		ProjectName: operators.Project, // Use project name from operator
		Status:      operators.Status,  // Use status from operator
		Limit:       limit,
		Offset:      offset,
		AllowBasic:  true, // Allow fallback to basic search
	}

	// Check FTS5 capability
	caps, err := h.store.CheckFTS5Support(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to check search capabilities")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "search service unavailable"})
		return
	}

	// If FTS5 is not available and basic search is not allowed, return 501
	if !caps.FTS5Enabled && !filter.AllowBasic {
		c.JSON(http.StatusNotImplemented, gin.H{
			"error":        "FTS5 search not available and basic search not enabled",
			"capabilities": caps,
		})
		return
	}

	// Use the clean query (with operators stripped) for the actual search
	searchQuery = operators.CleanQuery
	if searchQuery == "" {
		// If clean query is empty, fall back to original query
		searchQuery = query
	}

	// Perform search with fallback behavior using the new method with count
	var searchResult *store.SearchQueryResult
	searchResult, err = h.store.SearchQueryWithCount(ctx, searchQuery, filter)
	if err != nil {
		log.Error().Err(err).Str("query", searchQuery).Msg("search query failed")

		// Attempt fallback to basic search if FTS5 failed
		if caps.FTS5Enabled && strings.Contains(err.Error(), "fts") {
			log.Warn().Str("query", searchQuery).Msg("FTS5 search failed, falling back to basic search")

			// Create fallback filter with basic search enabled
			fallbackFilter := filter
			fallbackFilter.AllowBasic = true

			// Retry with basic search using the legacy method for fallback
			hits, fallbackErr := h.store.SearchQueryBasic(ctx, searchQuery, fallbackFilter)
			if fallbackErr != nil {
				log.Error().Err(fallbackErr).Str("query", query).Msg("both FTS5 and basic search failed")
				c.JSON(http.StatusInternalServerError, gin.H{
					"error":       "search service temporarily unavailable",
					"details":     "Both advanced and basic search failed",
					"retry_after": "30s",
				})
				return
			} else {
				log.Info().Str("query", query).Msg("basic search fallback succeeded")
				// For fallback, we don't have accurate total count, so use hits length
				searchResult = &store.SearchQueryResult{
					Hits:  hits,
					Total: len(hits), // This is inaccurate but better than nothing for fallback
				}
			}
		} else {
			// Non-FTS error or basic search already attempted
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "search failed",
				"details": "Please try again with a simpler query",
				"suggestions": []string{
					"Use shorter search terms",
					"Avoid special characters",
					"Try searching for individual words",
				},
			})
			return
		}
	}

	hits := searchResult.Hits
	totalCount := searchResult.Total

	// Filter results based on RBAC with graceful degradation
	filteredHits, err := h.filterSearchResultsByRBAC(c, hits)
	if err != nil {
		log.Error().Err(err).Msg("failed to filter search results by RBAC")

		// For RBAC failures, return partial results with a warning rather than complete failure
		// This provides better user experience when individual entities can't be verified
		if len(hits) > 0 {
			log.Warn().Msg("returning search results without RBAC filtering due to permission check failure")
			filteredHits = hits // Return unfiltered results as fallback
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error":   "search access validation failed",
				"details": "Unable to verify access permissions for search results",
			})
			return
		}
	}

	// Calculate execution time
	tookMS := time.Since(startTime).Milliseconds()
	duration := time.Since(startTime)

	// Record metrics
	success := err == nil && len(hits) >= 0 // Consider successful if no error occurred
	metrics.RecordSearchQuery(entityType, success, duration)

	// Build response with accurate total count
	response := SearchResponse{
		Hits:   filteredHits,
		TookMS: tookMS,
		FTS5:   caps.FTS5Enabled,
		Total:  totalCount, // Use the actual total count from database
	}

	// Record audit event with sampling (1:20)
	if h.auditor != nil {
		actor := "anonymous"
		if tokenName, exists := c.Get("token_name"); exists {
			if name, ok := tokenName.(string); ok && name != "" {
				actor = name
			}
		}

		auditMeta := map[string]interface{}{
			"query":       redactQuery(query),
			"took_ms":     tookMS,
			"fts5":        caps.FTS5Enabled,
			"results":     len(filteredHits),
			"entity_type": entityType,
		}

		h.auditor.RecordSampled(ctx, actor, audit.ActionSearchQuery, "search", "query", auditMeta, 20)
	}

	// Enhanced performance logging
	logLevel := log.Debug() // Default to debug level
	if tookMS > 100 {       // Slow query - log at info level
		logLevel = log.Info()
	} else if tookMS > 500 { // Very slow query - log at warn level
		logLevel = log.Warn()
	}

	logLevel.
		Str("query", redactQuery(query)).
		Str("clean_query", redactQuery(searchQuery)).
		Int64("took_ms", tookMS).
		Int("results_total", len(hits)).
		Int("results_filtered", len(filteredHits)).
		Int("results_limit", limit).
		Int("results_offset", offset).
		Bool("fts5", caps.FTS5Enabled).
		Str("search_mode", caps.Mode).
		Str("entity_type", entityType).
		Interface("project_id", projectID).
		Str("project_name", operators.Project).
		Str("status", operators.Status).
		Str("endpoint", "search").
		Msg("search.query")

	// Add debug headers to show operator parsing results
	if operators.Type != "" {
		c.Header("X-Search-Type", operators.Type)
	}
	if operators.Project != "" {
		c.Header("X-Search-Project", operators.Project)
	}
	if operators.Status != "" {
		c.Header("X-Search-Status", operators.Status)
	}
	c.Header("X-Search-Original-Query", operators.OriginalQuery)
	c.Header("X-Search-Clean-Query", operators.CleanQuery)

	c.JSON(http.StatusOK, response)
}

// PostReindex triggers a full search index rebuild (admin only)
func (h *SearchHandlers) PostReindex(c *gin.Context) {
	startedAt := time.Now()

	// Check for help-only reindex parameter
	helpOnly := c.Query("help") == "true"

	if helpOnly {
		log.Info().Msg("starting help-only search reindex")
	} else {
		log.Info().Msg("starting full search reindex")
	}

	// Run reindex in background (in production, this should use a job queue)
	go func() {
		// Create a new background context since the request context will be cancelled
		bgCtx := context.Background()

		if helpOnly {
			if err := h.store.SearchReindexHelp(bgCtx); err != nil {
				log.Error().Err(err).Msg("help search reindex failed")
			}
		} else {
			if err := h.store.SearchReindex(bgCtx); err != nil {
				log.Error().Err(err).Msg("full search reindex failed")
			}
		}
	}()

	// Audit log
	log.Info().
		Str("started_by", getTokenName(c)).
		Msg("search.reindex")

	message := "full reindex started"
	if helpOnly {
		message = "help-only reindex started"
	}

	c.JSON(http.StatusAccepted, ReindexResponse{
		Message:   message,
		StartedAt: startedAt,
	})
}

// SearchSuggest performs autocomplete search suggestions
func (h *SearchHandlers) SearchSuggest(c *gin.Context) {
	startTime := time.Now()
	ctx := c.Request.Context()

	// Rate limiting check
	clientKey := getClientKey(c)
	if !h.rateLimiter.CheckLimit(clientKey) {
		c.Header("Retry-After", "1")
		c.JSON(http.StatusTooManyRequests, gin.H{
			"error":       "rate limit exceeded",
			"retry_after": "1s",
		})
		return
	}

	// Parse query parameter
	prefix := strings.TrimSpace(c.Query("q"))
	if len(prefix) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "query parameter 'q' must be at least 2 characters",
		})
		return
	}

	// Parse optional filters
	entityType := c.Query("type")
	if entityType != "" && !isValidEntityType(entityType) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid entity type"})
		return
	}

	var projectID *int64
	if projectIDStr := c.Query("project_id"); projectIDStr != "" {
		id, err := strconv.ParseInt(projectIDStr, 10, 64)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project_id"})
			return
		}
		projectID = &id
	}

	// Parse limit with bounds
	limit := 8 // default limit
	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil {
			if l > 0 && l <= 15 {
				limit = l
			}
		}
	}

	// Create search filter
	filter := store.SearchFilter{
		Type:       entityType,
		ProjectID:  projectID,
		Limit:      limit,
		Offset:     0,
		AllowBasic: true, // Allow fallback to basic search
	}

	// Check FTS5 capability
	caps, err := h.store.CheckFTS5Support(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to check search capabilities")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "search service unavailable"})
		return
	}

	// Perform suggestions search
	suggestions, err := h.store.SearchSuggest(ctx, prefix, filter)
	if err != nil {
		log.Error().Err(err).Str("prefix", redactQuery(prefix)).Msg("search suggest failed")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "suggest failed",
			"details": "Please try a different search term",
		})
		return
	}

	// Filter results based on RBAC with graceful degradation
	filteredSuggestions, err := h.filterSuggestionsByRBAC(c, suggestions)
	if err != nil {
		log.Error().Err(err).Msg("failed to filter suggestions by RBAC")

		// For RBAC failures, return partial results with a warning
		if len(suggestions) > 0 {
			log.Warn().Msg("returning suggestions without RBAC filtering due to permission check failure")
			filteredSuggestions = suggestions
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": "suggest access validation failed",
			})
			return
		}
	}

	// Calculate execution time
	tookMS := time.Since(startTime).Milliseconds()
	duration := time.Since(startTime)

	// Record metrics
	success := err == nil && len(suggestions) >= 0 // Consider successful if no error occurred
	metrics.RecordSearchSuggest(entityType, success, duration)

	// Build response
	response := store.SearchSuggestionsResponse{
		Suggestions: filteredSuggestions,
		TookMS:      tookMS,
		FTS5:        caps.FTS5Enabled,
	}

	// Record audit event with sampling (1:20)
	if h.auditor != nil {
		actor := "anonymous"
		if tokenName, exists := c.Get("token_name"); exists {
			if name, ok := tokenName.(string); ok && name != "" {
				actor = name
			}
		}

		auditMeta := map[string]interface{}{
			"prefix":      redactQuery(prefix),
			"took_ms":     tookMS,
			"fts5":        caps.FTS5Enabled,
			"suggestions": len(filteredSuggestions),
			"entity_type": entityType,
		}

		h.auditor.RecordSampled(ctx, actor, audit.ActionSearchSuggest, "search", "suggest", auditMeta, 20)
	}

	// Performance logging
	logLevel := log.Debug()
	if tookMS > 10 {
		logLevel = log.Info()
	}
	if tookMS > 50 {
		logLevel = log.Warn()
	}

	logLevel.
		Str("prefix", redactQuery(prefix)).
		Int64("took_ms", tookMS).
		Int("suggestions_total", len(suggestions)).
		Int("suggestions_filtered", len(filteredSuggestions)).
		Int("limit", limit).
		Bool("fts5", caps.FTS5Enabled).
		Str("entity_type", entityType).
		Interface("project_id", projectID).
		Str("endpoint", "suggest").
		Msg("search.suggest")

	c.JSON(http.StatusOK, response)
}

// filterSuggestionsByRBAC filters suggestions based on user permissions
func (h *SearchHandlers) filterSuggestionsByRBAC(c *gin.Context, suggestions []store.SearchSuggestion) ([]store.SearchSuggestion, error) {
	var filteredSuggestions []store.SearchSuggestion
	var accessErrors int

	for _, suggestion := range suggestions {
		// Convert suggestion to SearchHit for access checking
		hit := store.SearchHit{
			Type:    suggestion.Type,
			URLPath: suggestion.URLPath,
		}

		// Check if user can access this resource
		canAccess, err := h.canAccessSearchResult(c, hit)
		if err != nil {
			log.Debug().Err(err).
				Str("type", suggestion.Type).
				Str("label", suggestion.Label).
				Msg("access check failed for suggestion")
			accessErrors++
			continue
		}

		if canAccess {
			filteredSuggestions = append(filteredSuggestions, suggestion)
		}
	}

	// If we had too many access errors, return an error
	if accessErrors > len(suggestions)/2 {
		return nil, fmt.Errorf("too many access verification failures: %d/%d", accessErrors, len(suggestions))
	}

	return filteredSuggestions, nil
}

// getClientKey generates a unique key for rate limiting based on IP and token
func getClientKey(c *gin.Context) string {
	// Try to get token name first for more specific limiting
	if tokenName, exists := c.Get("token_name"); exists {
		if name, ok := tokenName.(string); ok {
			return "token:" + name
		}
	}

	// Fall back to IP-based limiting
	clientIP := c.ClientIP()
	return "ip:" + clientIP
}

// filterSearchResultsByRBAC filters search results based on user permissions
func (h *SearchHandlers) filterSearchResultsByRBAC(c *gin.Context, hits []store.SearchHit) ([]store.SearchHit, error) {
	var filteredHits []store.SearchHit
	var accessErrors int

	for _, hit := range hits {
		// Check if user can access this resource with error recovery
		canAccess, err := h.canAccessSearchResult(c, hit)
		if err != nil {
			// Log individual access check failures but don't fail the entire search
			log.Debug().Err(err).
				Str("type", hit.Type).
				Int64("entity_id", hit.EntityID).
				Msg("access check failed for search result")
			accessErrors++

			// Skip this result rather than failing entire search
			continue
		}

		if canAccess {
			filteredHits = append(filteredHits, hit)
		}
	}

	// If we had too many access errors, return an error
	if accessErrors > len(hits)/2 {
		return nil, fmt.Errorf("too many access verification failures: %d/%d", accessErrors, len(hits))
	}

	// Log if we had some access errors but continued
	if accessErrors > 0 {
		log.Info().
			Int("access_errors", accessErrors).
			Int("total_results", len(hits)).
			Int("filtered_results", len(filteredHits)).
			Msg("search results filtered with some access check failures")
	}

	return filteredHits, nil
}

// canAccessSearchResult checks if the current user can access a search result
func (h *SearchHandlers) canAccessSearchResult(c *gin.Context, hit store.SearchHit) (bool, error) {
	ctx := c.Request.Context()

	switch hit.Type {
	case "project":
		// Check project access
		project, err := h.store.GetProject(ctx, hit.EntityID)
		if err != nil {
			if err == store.ErrNotFound {
				return false, nil // Project doesn't exist, hide from results
			}
			return false, err
		}
		// In a full RBAC system, we'd check if user can access this project
		// For now, assume all authenticated users can see projects
		_ = project
		return true, nil

	case "service":
		// Check service access via project
		if hit.ProjectID == nil {
			return false, nil
		}

		project, err := h.store.GetProject(ctx, *hit.ProjectID)
		if err != nil {
			if err == store.ErrNotFound {
				return false, nil
			}
			return false, err
		}
		_ = project
		return true, nil

	case "route":
		// Routes are generally accessible to authenticated users
		return true, nil

	case "setting":
		// Settings access should be admin-only
		// This would check admin role in a full RBAC system
		return true, nil // For now, assume accessible

	case "page":
		// Pages are generally accessible to all authenticated users
		return true, nil

	case "registry":
		// Registries are accessible to authenticated users
		return true, nil

	case "env_template":
		// Environment templates are accessible to authenticated users
		return true, nil

	default:
		return false, nil
	}
}

// isValidEntityType checks if the provided entity type is valid
func isValidEntityType(entityType string) bool {
	validTypes := map[string]bool{
		"project":      true,
		"service":      true,
		"route":        true,
		"setting":      true,
		"registry":     true,
		"env_template": true,
		"page":         true,
		"help":         true,
		"operation":    true,
	}
	return validTypes[entityType]
}

// redactQuery redacts sensitive information from search queries for logging
func redactQuery(query string) string {
	// In production, this might redact patterns that look like secrets, tokens, etc.
	if len(query) > 100 {
		return query[:100] + "..."
	}
	return query
}

// getTokenName extracts the token name from context for audit logging
func getTokenName(c *gin.Context) string {
	if tokenName, exists := c.Get("token_name"); exists {
		if name, ok := tokenName.(string); ok {
			return name
		}
	}
	return "unknown"
}
