package util

import (
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestLoadConfigDefaults(t *testing.T) {
	config := LoadConfig()

	assert.Equal(t, "", config.AdminToken)
	assert.Equal(t, "./data", config.DataDir)
	assert.Equal(t, ":8080", config.HTTPAddr)
	assert.Equal(t, "info", config.LogLevel)
	assert.Empty(t, config.CORSOrigins)
}

func TestLoadConfigFromEnv(t *testing.T) {
	// Set test environment variables
	os.Setenv("ADMIN_TOKEN", "test-token")
	os.Setenv("DATA_DIR", "/tmp/test")
	os.Setenv("HTTP_ADDR", ":3000")
	os.Setenv("LOG_LEVEL", "debug")
	os.Setenv("GLINRDOCK_CORS_ORIGINS", "http://localhost:3000,http://localhost:8080")

	defer func() {
		os.Unsetenv("ADMIN_TOKEN")
		os.Unsetenv("DATA_DIR")
		os.Unsetenv("HTTP_ADDR")
		os.Unsetenv("LOG_LEVEL")
		os.Unsetenv("GLINRDOCK_CORS_ORIGINS")
	}()

	config := LoadConfig()

	assert.Equal(t, "test-token", config.AdminToken)
	assert.Equal(t, "/tmp/test", config.DataDir)
	assert.Equal(t, ":3000", config.HTTPAddr)
	assert.Equal(t, "debug", config.LogLevel)
	assert.Equal(t, []string{"http://localhost:3000", "http://localhost:8080"}, config.CORSOrigins)
}

func TestParseOrigins(t *testing.T) {
	tests := []struct {
		input    string
		expected []string
	}{
		{"", []string{}},
		{"http://localhost:3000", []string{"http://localhost:3000"}},
		{"http://localhost:3000,http://localhost:8080", []string{"http://localhost:3000", "http://localhost:8080"}},
	}

	for _, tt := range tests {
		result := parseOrigins(tt.input)
		assert.Equal(t, tt.expected, result)
	}
}
