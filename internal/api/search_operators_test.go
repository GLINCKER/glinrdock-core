package api

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestParseSearchOperators(t *testing.T) {
	tests := []struct {
		name     string
		query    string
		expected *SearchOperators
	}{
		{
			name:  "no operators",
			query: "simple search query",
			expected: &SearchOperators{
				OriginalQuery: "simple search query",
				CleanQuery:    "simple search query",
			},
		},
		{
			name:  "single type operator",
			query: "type:service postgres",
			expected: &SearchOperators{
				Type:          "service",
				OriginalQuery: "type:service postgres",
				CleanQuery:    "postgres",
			},
		},
		{
			name:  "multiple operators",
			query: "type:service project:demo status:running postgres",
			expected: &SearchOperators{
				Type:          "service",
				Project:       "demo",
				Status:        "running",
				OriginalQuery: "type:service project:demo status:running postgres",
				CleanQuery:    "postgres",
			},
		},
		{
			name:  "operators mixed with text",
			query: "database type:service in project:glinr with status:running",
			expected: &SearchOperators{
				Type:          "service",
				Project:       "glinr",
				Status:        "running",
				OriginalQuery: "database type:service in project:glinr with status:running",
				CleanQuery:    "database in with",
			},
		},
		{
			name:  "invalid type operator ignored",
			query: "type:invalid postgres",
			expected: &SearchOperators{
				OriginalQuery: "type:invalid postgres",
				CleanQuery:    "postgres",
			},
		},
		{
			name:  "invalid status operator ignored",
			query: "status:invalid postgres",
			expected: &SearchOperators{
				OriginalQuery: "status:invalid postgres",
				CleanQuery:    "postgres",
			},
		},
		{
			name:  "only operators no clean query",
			query: "type:service project:demo",
			expected: &SearchOperators{
				Type:          "service",
				Project:       "demo",
				OriginalQuery: "type:service project:demo",
				CleanQuery:    "",
			},
		},
		{
			name:  "case insensitive operators",
			query: "TYPE:service PROJECT:demo STATUS:running",
			expected: &SearchOperators{
				Type:          "service",
				Project:       "demo",
				Status:        "running",
				OriginalQuery: "TYPE:service PROJECT:demo STATUS:running",
				CleanQuery:    "",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := parseSearchOperators(tt.query)
			
			assert.Equal(t, tt.expected.Type, result.Type, "Type should match")
			assert.Equal(t, tt.expected.Project, result.Project, "Project should match")
			assert.Equal(t, tt.expected.Status, result.Status, "Status should match")
			assert.Equal(t, tt.expected.OriginalQuery, result.OriginalQuery, "OriginalQuery should match")
			assert.Equal(t, tt.expected.CleanQuery, result.CleanQuery, "CleanQuery should match")
		})
	}
}

func TestParseSearchOperators_ValidEntityTypes(t *testing.T) {
	validTypes := []string{"service", "project", "route", "registry", "env_template", "page"}
	
	for _, entityType := range validTypes {
		t.Run("valid_type_"+entityType, func(t *testing.T) {
			query := "type:" + entityType + " test"
			result := parseSearchOperators(query)
			
			assert.Equal(t, entityType, result.Type, "Should parse valid entity type: "+entityType)
			assert.Equal(t, "test", result.CleanQuery, "Should clean query correctly")
		})
	}
}

func TestParseSearchOperators_ValidStatuses(t *testing.T) {
	validStatuses := []string{"running", "stopped"}
	
	for _, status := range validStatuses {
		t.Run("valid_status_"+status, func(t *testing.T) {
			query := "status:" + status + " test"
			result := parseSearchOperators(query)
			
			assert.Equal(t, status, result.Status, "Should parse valid status: "+status)
			assert.Equal(t, "test", result.CleanQuery, "Should clean query correctly")
		})
	}
}