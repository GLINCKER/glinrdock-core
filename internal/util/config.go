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
	
	// DNS and domain management configuration
	DNSVerifyEnabled       bool
	PublicEdgeHost         string
	PublicEdgeIPv4         string
	PublicEdgeIPv6         string
	DNSResolvers           []string
	
	// ACME configuration
	ACMEDirectoryURL       string
	ACMEEmail              string
	ACMEHTTP01Enabled      bool
	ACMEDNS01Enabled       bool
	
	// Cloudflare API token (optional, can be stored in providers table)
	CFAPIToken             string
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
		
		// DNS and domain management configuration
		DNSVerifyEnabled:       getBoolEnv("DNS_VERIFY_ENABLED", true),
		PublicEdgeHost:         getEnv("PUBLIC_EDGE_HOST", ""),
		PublicEdgeIPv4:         getEnv("PUBLIC_EDGE_IPV4", ""),
		PublicEdgeIPv6:         getEnv("PUBLIC_EDGE_IPV6", ""),
		DNSResolvers:           parseResolvers(getEnv("DNS_RESOLVERS", "1.1.1.1:53,8.8.8.8:53")),
		
		// ACME configuration
		ACMEDirectoryURL:       getEnv("ACME_DIRECTORY_URL", "https://acme-v02.api.letsencrypt.org/directory"),
		ACMEEmail:              getEnv("ACME_EMAIL", ""),
		ACMEHTTP01Enabled:      getBoolEnv("ACME_HTTP01_ENABLED", true),
		ACMEDNS01Enabled:       getBoolEnv("ACME_DNS01_ENABLED", true),
		
		// Cloudflare API token (optional, can be stored in providers table)
		CFAPIToken:             getEnv("CF_API_TOKEN", ""),
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

func parseResolvers(resolvers string) []string {
	if resolvers == "" {
		return []string{"1.1.1.1:53", "8.8.8.8:53"}
	}
	return strings.Split(resolvers, ",")
}