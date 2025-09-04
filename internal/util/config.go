package util

import (
	"os"
	"strconv"
	"strings"
)

// Config holds application configuration
type Config struct {
	AdminToken             string
	DataDir                string
	HTTPAddr               string
	LogLevel               string
	CORSOrigins            []string
	GitHubOAuthClientID    string
	GitHubOAuthSecret      string
	ExternalBaseURL        string
	Secret                 string
	GitHubAppID            string
	GitHubAppPrivateKeyPath string
	GitHubAppWebhookSecret string
	NginxProxyEnabled      bool
}

// LoadConfig reads configuration from environment variables with defaults
func LoadConfig() *Config {
	return &Config{
		AdminToken:             getEnv("ADMIN_TOKEN", ""),
		DataDir:                getEnv("DATA_DIR", "./data"),
		HTTPAddr:               getEnv("HTTP_ADDR", ":8080"),
		LogLevel:               getEnv("LOG_LEVEL", "info"),
		CORSOrigins:            parseOrigins(getEnv("GLINRDOCK_CORS_ORIGINS", "")),
		GitHubOAuthClientID:    getEnv("GITHUB_OAUTH_CLIENT_ID", ""),
		GitHubOAuthSecret:      getEnv("GITHUB_OAUTH_CLIENT_SECRET", ""),
		ExternalBaseURL:        getEnv("EXTERNAL_BASE_URL", ""),
		Secret:                 getEnv("GLINRDOCK_SECRET", ""),
		GitHubAppID:            getEnv("GITHUB_APP_ID", ""),
		GitHubAppPrivateKeyPath: getEnv("GITHUB_APP_PRIVATE_KEY_PATH", ""),
		GitHubAppWebhookSecret: getEnv("GITHUB_APP_WEBHOOK_SECRET", ""),
		NginxProxyEnabled:      getBoolEnv("NGINX_PROXY_ENABLED", false),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getBoolEnv(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.ParseBool(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}

func parseOrigins(origins string) []string {
	if origins == "" {
		return []string{}
	}
	return strings.Split(origins, ",")
}