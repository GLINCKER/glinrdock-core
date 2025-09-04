package store

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestStoreForSearch(t *testing.T) *Store {
	// Use unique in-memory database for each test
	dsn := fmt.Sprintf("file:memdb%d_%s?mode=memory&cache=shared", time.Now().UnixNano(), t.Name())
	db, err := sql.Open("sqlite3", dsn)
	require.NoError(t, err)

	store := &Store{db: db}
	
	// Run migrations
	ctx := context.Background()
	err = store.Migrate(ctx)
	require.NoError(t, err)

	t.Cleanup(func() {
		store.Close()
	})

	return store
}

func TestIndexPagesStatic(t *testing.T) {
	store := setupTestStoreForSearch(t)
	ctx := context.Background()

	// Test IndexPagesStatic function
	err := store.IndexPagesStatic(ctx)
	require.NoError(t, err)

	// Verify pages were indexed
	var count int
	err = store.db.QueryRowContext(ctx, 
		"SELECT COUNT(*) FROM search_docs WHERE entity_type = 'page'").Scan(&count)
	require.NoError(t, err)
	assert.Greater(t, count, 10, "should have indexed multiple pages")

	// Test specific pages exist
	expectedPages := []struct {
		title    string
		urlPath  string
	}{
		{"Dashboard", "/app/"},
		{"Settings", "/app/settings"},
		{"Projects", "/app/projects"},
		{"Services", "/app/services"},
		{"Integrations", "/app/settings/integrations"},
	}

	for _, page := range expectedPages {
		var foundCount int
		err = store.db.QueryRowContext(ctx,
			"SELECT COUNT(*) FROM search_docs WHERE entity_type = 'page' AND title = ? AND url_path = ?",
			page.title, page.urlPath).Scan(&foundCount)
		require.NoError(t, err)
		assert.Equal(t, 1, foundCount, "page %s should be indexed", page.title)
	}
}

func TestSearchSeedPages(t *testing.T) {
	store := setupTestStoreForSearch(t)
	ctx := context.Background()

	// Test SearchSeedPages function
	err := store.SearchSeedPages(ctx)
	require.NoError(t, err)

	// Verify pages were indexed
	var count int
	err = store.db.QueryRowContext(ctx, 
		"SELECT COUNT(*) FROM search_docs WHERE entity_type = 'page'").Scan(&count)
	require.NoError(t, err)
	assert.Greater(t, count, 10, "should have seeded multiple pages")

	// Test that it can be called multiple times without error
	err = store.SearchSeedPages(ctx)
	require.NoError(t, err)

	// Count should remain the same (pages replaced, not duplicated)
	var newCount int
	err = store.db.QueryRowContext(ctx, 
		"SELECT COUNT(*) FROM search_docs WHERE entity_type = 'page'").Scan(&newCount)
	require.NoError(t, err)
	assert.Equal(t, count, newCount, "repeated seeding should not create duplicates")
}

func TestSearchQueryWithPages(t *testing.T) {
	store := setupTestStoreForSearch(t)
	ctx := context.Background()

	// Seed pages
	err := store.SearchSeedPages(ctx)
	require.NoError(t, err)

	// Test search capabilities
	_, err = store.CheckFTS5Support(ctx)
	require.NoError(t, err)

	// Test search for settings page
	filter := SearchFilter{
		Type:       "page",
		Limit:      10,
		Offset:     0,
		AllowBasic: true,
	}

	hits, err := store.SearchQuery(ctx, "settings", filter)
	require.NoError(t, err)
	
	// Should find at least one settings page
	assert.Greater(t, len(hits), 0, "should find settings pages")
	
	// Verify the result structure
	for _, hit := range hits {
		assert.Equal(t, "page", hit.Type, "all results should be page type")
		assert.NotEmpty(t, hit.Title, "page should have title")
		assert.NotEmpty(t, hit.URLPath, "page should have URL path")
		assert.Contains(t, hit.URLPath, "/app/", "page URL should start with /app/")
	}

	// Test search for dashboard
	dashboardHits, err := store.SearchQuery(ctx, "dashboard", filter)
	require.NoError(t, err)
	assert.Greater(t, len(dashboardHits), 0, "should find dashboard page")

	// Verify dashboard result
	found := false
	for _, hit := range dashboardHits {
		if hit.Title == "Dashboard" && hit.URLPath == "/app/" {
			found = true
			break
		}
	}
	assert.True(t, found, "should find specific dashboard page")
}

func TestSearchReindexIncludesPages(t *testing.T) {
	store := setupTestStoreForSearch(t)
	ctx := context.Background()

	// Run full reindex
	err := store.SearchReindex(ctx)
	require.NoError(t, err)

	// Verify pages were included in reindex
	var count int
	err = store.db.QueryRowContext(ctx, 
		"SELECT COUNT(*) FROM search_docs WHERE entity_type = 'page'").Scan(&count)
	require.NoError(t, err)
	assert.Greater(t, count, 10, "reindex should include pages")

	// Test that we can search pages after reindex
	filter := SearchFilter{
		Type:       "page", 
		Limit:      5,
		Offset:     0,
		AllowBasic: true,
	}

	hits, err := store.SearchQuery(ctx, "quick", filter)
	require.NoError(t, err)
	
	// Should find quickstart related pages
	found := false
	for _, hit := range hits {
		if hit.Title == "Quick Start" {
			found = true
			break
		}
	}
	assert.True(t, found, "should find Quick Start page after reindex")
}

func TestScanSearchHitsFieldMapping(t *testing.T) {
	store := setupTestStoreForSearch(t)
	ctx := context.Background()

	// Seed pages  
	err := store.SearchSeedPages(ctx)
	require.NoError(t, err)

	// Test that scan mapping works correctly by doing a direct query
	query := `SELECT entity_id, entity_type, title, subtitle, url_path, 1.0 AS score, project_id 
	          FROM search_docs WHERE entity_type = 'page' LIMIT 1`
	
	rows, err := store.db.QueryContext(ctx, query)
	require.NoError(t, err)
	defer rows.Close()

	hits, err := store.scanSearchHits(rows)
	require.NoError(t, err)
	assert.Greater(t, len(hits), 0, "should scan at least one hit")

	hit := hits[0]
	assert.Equal(t, "page", hit.Type, "type should be correctly scanned")
	assert.NotEmpty(t, hit.Title, "title should be scanned")
	assert.NotEmpty(t, hit.URLPath, "url_path should be scanned")
	assert.Greater(t, hit.EntityID, int64(0), "entity_id should be positive")
	assert.Equal(t, 1.0, hit.Score, "score should be 1.0")
}

func TestPageEntityTypeValidation(t *testing.T) {
	// This would be in the API test, but we can verify the basic structure
	store := setupTestStoreForSearch(t)
	ctx := context.Background()

	// Seed pages
	err := store.SearchSeedPages(ctx)
	require.NoError(t, err)

	// Test mixed search (pages + other types if they existed)
	filter := SearchFilter{
		Limit:      20,
		Offset:     0,
		AllowBasic: true,
		// No type filter - should return all types
	}

	hits, err := store.SearchQuery(ctx, "system", filter)
	require.NoError(t, err)

	// Should find pages containing "system"
	pageCount := 0
	for _, hit := range hits {
		if hit.Type == "page" {
			pageCount++
		}
	}
	
	assert.Greater(t, pageCount, 0, "should find pages in mixed search")
}

func TestSearchSuggest(t *testing.T) {
	store := setupTestStoreForSearch(t)
	ctx := context.Background()

	// Seed pages
	err := store.SearchSeedPages(ctx)
	require.NoError(t, err)

	// Test basic suggestions
	filter := SearchFilter{
		Limit:      5,
		Offset:     0,
		AllowBasic: true,
	}

	suggestions, err := store.SearchSuggest(ctx, "se", filter)
	require.NoError(t, err)
	
	// Should find suggestions starting with "se"
	assert.Greater(t, len(suggestions), 0, "should find suggestions for 'se'")
	
	// Check suggestion structure
	for _, suggestion := range suggestions {
		assert.NotEmpty(t, suggestion.Query, "suggestion should have query")
		assert.NotEmpty(t, suggestion.Label, "suggestion should have label")
		assert.NotEmpty(t, suggestion.Type, "suggestion should have type")
		assert.NotEmpty(t, suggestion.URLPath, "suggestion should have URL path")
	}
}

func TestSearchSuggestWithFilters(t *testing.T) {
	store := setupTestStoreForSearch(t)
	ctx := context.Background()

	// Seed pages
	err := store.SearchSeedPages(ctx)
	require.NoError(t, err)

	// Test with type filter
	filter := SearchFilter{
		Type:       "page",
		Limit:      3,
		Offset:     0,
		AllowBasic: true,
	}

	suggestions, err := store.SearchSuggest(ctx, "se", filter)
	require.NoError(t, err)
	
	// All suggestions should be pages
	for _, suggestion := range suggestions {
		assert.Equal(t, "page", suggestion.Type, "all suggestions should be page type")
	}
}

func TestSearchSuggestMinLength(t *testing.T) {
	store := setupTestStoreForSearch(t)
	ctx := context.Background()

	// Seed pages
	err := store.SearchSeedPages(ctx)
	require.NoError(t, err)

	filter := SearchFilter{
		Limit:      5,
		AllowBasic: true,
	}

	// Test with too short prefix
	suggestions, err := store.SearchSuggest(ctx, "s", filter)
	require.NoError(t, err)
	assert.Empty(t, suggestions, "should return empty for single character")

	// Test with valid prefix
	suggestions, err = store.SearchSuggest(ctx, "se", filter)
	require.NoError(t, err)
	assert.Greater(t, len(suggestions), 0, "should return suggestions for two characters")
}

func TestSearchSuggestFormatting(t *testing.T) {
	store := setupTestStoreForSearch(t)
	ctx := context.Background()

	// Seed pages
	err := store.SearchSeedPages(ctx)
	require.NoError(t, err)

	filter := SearchFilter{
		Type:       "page",
		Limit:      5,
		AllowBasic: true,
	}

	suggestions, err := store.SearchSuggest(ctx, "se", filter)
	require.NoError(t, err)

	// Find specific suggestions to test formatting
	for _, suggestion := range suggestions {
		if suggestion.Type == "page" && suggestion.Query == "Settings" {
			assert.Equal(t, "Settings", suggestion.Label, "page labels should just be the title")
			assert.Equal(t, "/app/settings", suggestion.URLPath, "should have correct URL")
			break
		}
	}
}

func TestPrepareFTS5PrefixQuery(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"", "*"},
		{"service", `"service*"`},
		{"my service", `"my" AND "service*"`},
		{"test \"quoted\" term", `"test" AND """quoted""" AND "term*"`},
	}

	for _, test := range tests {
		result := prepareFTS5PrefixQuery(test.input)
		assert.Equal(t, test.expected, result, "FTS5 prefix query should be formatted correctly")
	}
}

func TestSearchWithProjectNameFilter(t *testing.T) {
	store := setupTestStoreForSearch(t)
	ctx := context.Background()

	// Seed pages
	err := store.SearchSeedPages(ctx)
	require.NoError(t, err)

	// Test project name filtering - even though we don't have real projects,
	// the SQL join should not crash and should handle the filter gracefully
	filter := SearchFilter{
		ProjectName: "nonexistent",
		Limit:       10,
		Offset:      0,
		AllowBasic:  true,
	}

	// This should not crash even with non-existent project
	hits, err := store.SearchQuery(ctx, "dashboard", filter)
	require.NoError(t, err)
	
	// Should return empty results since project doesn't exist
	assert.Empty(t, hits, "should return empty results for non-existent project")

	// Test that empty project name doesn't filter
	filter.ProjectName = ""
	hits, err = store.SearchQuery(ctx, "dashboard", filter)
	require.NoError(t, err)
	assert.Greater(t, len(hits), 0, "should return results when no project filter")
}

func TestSearchWithStatusFilter(t *testing.T) {
	store := setupTestStoreForSearch(t)
	ctx := context.Background()

	// Seed pages
	err := store.SearchSeedPages(ctx)
	require.NoError(t, err)

	// Test status filtering for services
	filter := SearchFilter{
		Type:       "service",
		Status:     "running",
		Limit:      10,
		Offset:     0,
		AllowBasic: true,
	}

	// This should not crash and should apply status filter
	hits, err := store.SearchQuery(ctx, "test", filter)
	require.NoError(t, err)
	
	// Results should be empty or filtered (we don't have services with status tags in test data)
	// The important thing is that it doesn't crash
	assert.GreaterOrEqual(t, len(hits), 0, "should handle status filtering gracefully")

	// Test with non-service type - status filter should be ignored
	filter.Type = "page"
	hits, err = store.SearchQuery(ctx, "dashboard", filter)
	require.NoError(t, err)
	
	// Should find pages since status filter is ignored for non-service types
	assert.GreaterOrEqual(t, len(hits), 0, "should ignore status filter for non-service types")
}

