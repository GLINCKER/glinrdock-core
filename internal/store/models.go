package store

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/GLINCKER/glinrdock/internal/crypto"
)

// Common errors
var (
	ErrNotFound = errors.New("resource not found")
)

// RBAC Roles
const (
	RoleAdmin    = "admin"    // Full access to all resources
	RoleDeployer = "deployer" // Can manage builds, deployments, and services but not tokens/certs
	RoleViewer   = "viewer"   // Read-only access to all resources
)

// Token represents an API authentication token
type Token struct {
	ID         int64      `json:"id"`
	Name       string     `json:"name"`
	Hash       string     `json:"-"` // Never expose hash in JSON
	Role       string     `json:"role"`
	CreatedAt  time.Time  `json:"created_at"`
	LastUsedAt *time.Time `json:"last_used_at"`
}

// User represents a GitHub authenticated user
type User struct {
	ID          int64      `json:"id" db:"id"`
	GitHubID    int64      `json:"github_id" db:"github_id"`
	Login       string     `json:"login" db:"login"`
	Name        string     `json:"name" db:"name"`
	AvatarURL   string     `json:"avatar_url" db:"avatar_url"`
	Role        string     `json:"role" db:"role"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
	LastLoginAt *time.Time `json:"last_login_at" db:"last_login_at"`
}

// GitHubInstallation represents a GitHub App installation
type GitHubInstallation struct {
	ID             int64      `json:"id" db:"id"`
	InstallationID int64      `json:"installation_id" db:"installation_id"`
	AccountLogin   string     `json:"account_login" db:"account_login"`
	AccountID      int64      `json:"account_id" db:"account_id"`
	AccountType    string     `json:"account_type" db:"account_type"` // "Organization" or "User"
	Permissions    string     `json:"permissions" db:"permissions"`   // JSON blob
	Events         string     `json:"events" db:"events"`             // JSON array
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at" db:"updated_at"`
	SuspendedAt    *time.Time `json:"suspended_at" db:"suspended_at"`
	SuspendedBy    *string    `json:"suspended_by" db:"suspended_by"`
}

// GitHubRepo represents a GitHub repository accessible via App
type GitHubRepo struct {
	ID             int64     `json:"id" db:"id"`
	FullName       string    `json:"full_name" db:"full_name"`
	InstallationID int64     `json:"installation_id" db:"installation_id"`
	Active         bool      `json:"active" db:"active"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
}

// RepoProjectMap represents the mapping between a GitHub repo and project template
type RepoProjectMap struct {
	ID         int64     `json:"id" db:"id"`
	RepoID     int64     `json:"repo_id" db:"repo_id"`
	ProjectID  int64     `json:"project_id" db:"project_id"`
	Dockerfile string    `json:"dockerfile" db:"dockerfile"`
	Context    string    `json:"context" db:"context"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" db:"updated_at"`
}

// IsRoleValid checks if the given role is a valid RBAC role
func IsRoleValid(role string) bool {
	return role == RoleAdmin || role == RoleDeployer || role == RoleViewer
}

// CanAccessResource checks if a role can access another role's resources
// Admin can access all, Deployer can access Deployer and Viewer, Viewer can only access Viewer
func CanAccessResource(userRole, targetRole string) bool {
	if userRole == RoleAdmin {
		return true // Admin can access all resources
	}
	if userRole == RoleDeployer {
		return targetRole == RoleDeployer || targetRole == RoleViewer
	}
	if userRole == RoleViewer {
		return targetRole == RoleViewer
	}
	return false
}

// CanCreateRole checks if a user role can create tokens with the target role
func CanCreateRole(userRole, targetRole string) bool {
	if userRole == RoleAdmin {
		return IsRoleValid(targetRole) // Admin can create any valid role
	}
	// Only admins can create tokens
	return false
}

// Project represents a deployable project
type Project struct {
	ID          int64     `json:"id"`
	Name        string    `json:"name"`
	RepoURL     *string   `json:"repo_url,omitempty" db:"repo_url"`         // Git repository URL for webhooks
	Branch      string    `json:"branch" db:"branch"`                       // Target branch (default: main)
	ImageTarget *string   `json:"image_target,omitempty" db:"image_target"` // Target container image (e.g., ghcr.io/user/repo)
	NetworkName *string   `json:"network_name,omitempty" db:"network_name"` // Docker network name for this project
	CreatedAt   time.Time `json:"created_at"`
}

// PortMap represents a port mapping from container to host
type PortMap struct {
	Container int `json:"container"`
	Host      int `json:"host"`
}

// VolumeMap represents a volume mapping from host to container
type VolumeMap struct {
	Host      string `json:"host"`
	Container string `json:"container"`
	ReadOnly  bool   `json:"ro"`
}

// EnvVar represents an environment variable with encryption support
type EnvVar struct {
	ID         int64     `json:"id"`
	ServiceID  int64     `json:"service_id"`
	Key        string    `json:"key"`
	Value      string    `json:"value,omitempty"` // For non-secret variables
	IsSecret   bool      `json:"is_secret"`
	Nonce      []byte    `json:"-"` // AES-GCM nonce (not exposed in JSON)
	Ciphertext []byte    `json:"-"` // Encrypted value (not exposed in JSON)
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// EnvVarUpdate represents an environment variable update request
type EnvVarUpdate struct {
	Key        string `json:"key" binding:"required"`
	Value      string `json:"value,omitempty"` // For non-secret variables
	IsSecret   bool   `json:"is_secret"`
	Nonce      []byte `json:"-"` // For secret variables (internal use)
	Ciphertext []byte `json:"-"` // For secret variables (internal use)
}

// Service represents a containerized service within a project
type Service struct {
	ID              int64             `json:"id"`
	ProjectID       int64             `json:"project_id"`
	Name            string            `json:"name"`
	Description     *string           `json:"description,omitempty"`
	Image           string            `json:"image"`
	ContainerID     *string           `json:"container_id,omitempty"` // actual Docker container ID
	Status          string            `json:"status,omitempty"`       // populated at runtime from event cache
	Env             map[string]string `json:"env"`
	Ports           []PortMap         `json:"ports"`
	Volumes         []VolumeMap       `json:"volumes,omitempty"`
	RegistryID      *string           `json:"registry_id,omitempty"`
	HealthPath      *string           `json:"health_path,omitempty"`       // health check endpoint path
	DesiredState    string            `json:"desired_state"`               // running|stopped
	LastExitCode    *int              `json:"last_exit_code,omitempty"`    // last container exit code
	RestartCount    int               `json:"restart_count"`               // restarts in current 10min window
	RestartWindowAt *time.Time        `json:"restart_window_at,omitempty"` // start of current 10min window
	CrashLooping    bool              `json:"crash_looping"`               // true if in crash loop state
	HealthStatus    string            `json:"health_status"`               // ok|fail|unknown
	LastProbeAt     *time.Time        `json:"last_probe_at,omitempty"`     // last health probe time
	Network         *ServiceNetwork   `json:"network,omitempty"`           // populated with networking info when requested
	Aliases         []string          `json:"aliases,omitempty"`           // populated with DNS aliases when requested
	CreatedAt       time.Time         `json:"created_at"`
}

// GetAlias generates a deterministic service alias for internal networking
func (s Service) GetAlias(projectName string) string {
	return GenerateServiceAlias(projectName, s.Name)
}

// ShouldEnterCrashLoop checks if service should enter crash loop based on restart history
func (s *Service) ShouldEnterCrashLoop() bool {
	if s.LastExitCode == nil || *s.LastExitCode == 0 {
		return false // only crash loop on non-zero exit codes
	}

	if s.RestartWindowAt == nil {
		return false // no restart window established yet
	}

	// Check if we're still in the 10-minute window
	windowEnd := s.RestartWindowAt.Add(CrashLoopWindow * time.Minute)
	if time.Now().After(windowEnd) {
		return false // outside window, should reset
	}

	return s.RestartCount >= CrashLoopThreshold
}

// UpdateRestartCount updates the restart count and window for crash loop detection
func (s *Service) UpdateRestartCount() {
	now := time.Now()

	// If no window exists or window expired, start new window
	if s.RestartWindowAt == nil || now.After(s.RestartWindowAt.Add(CrashLoopWindow*time.Minute)) {
		s.RestartWindowAt = &now
		s.RestartCount = 1
	} else {
		// Within existing window, increment count
		s.RestartCount++
	}
}

// HealthCheckType represents the type of health check to perform
type HealthCheckType string

const (
	HealthCheckHTTP     HealthCheckType = "http"
	HealthCheckTCP      HealthCheckType = "tcp"
	HealthCheckPostgres HealthCheckType = "postgres"
	HealthCheckMySQL    HealthCheckType = "mysql"
	HealthCheckRedis    HealthCheckType = "redis"
)

// GetHealthCheckType determines the appropriate health check type for this service
func (s *Service) GetHealthCheckType() HealthCheckType {
	// Auto-detect based on image name
	image := strings.ToLower(s.Image)

	if strings.Contains(image, "postgres") {
		return HealthCheckPostgres
	}
	if strings.Contains(image, "mysql") || strings.Contains(image, "mariadb") {
		return HealthCheckMySQL
	}
	if strings.Contains(image, "redis") {
		return HealthCheckRedis
	}

	// Default to HTTP for web services
	return HealthCheckHTTP
}

// GetHealthProbeURL returns the URL to use for health checks
func (s *Service) GetHealthProbeURL(routes []Route) string {
	// If service has routes and health_path, use external URL
	if len(routes) > 0 && s.HealthPath != nil {
		route := routes[0] // use first route
		protocol := "http"
		if route.TLS {
			protocol = "https"
		}
		return fmt.Sprintf("%s://%s%s", protocol, route.Domain, *s.HealthPath)
	}

	// If no routes but has health_path, use host port
	if s.HealthPath != nil && len(s.Ports) > 0 {
		port := s.Ports[0].Host // use host port for probing
		return fmt.Sprintf("http://localhost:%d%s", port, *s.HealthPath)
	}

	// No health path configured, try default port
	if len(s.Ports) > 0 {
		port := s.Ports[0].Host // use host port for probing
		return fmt.Sprintf("http://localhost:%d/health", port)
	}

	// Fallback to default port
	return fmt.Sprintf("http://localhost:%d/health", DefaultHealthPort)
}

// ServiceNetwork represents service networking information
type ServiceNetwork struct {
	ProjectNetwork string                `json:"project_network"` // Project network name (e.g., "glinr_proj_1")
	Aliases        []string              `json:"aliases"`         // DNS aliases for the service
	Networks       []NetworkConnection   `json:"networks"`        // All networks the container is connected to
	IPv4           *string               `json:"ipv4,omitempty"`  // Primary IP address
	PortsInternal  []InternalPortMapping `json:"ports_internal"`  // Internal port mappings
	ExternalHosts  []string              `json:"external_hosts"`  // External URLs derived from routes
	InternalDNS    string                `json:"internal_dns"`    // Internal DNS name (hint only)
	DNSHint        string                `json:"dns_hint"`        // Example DNS usage
	CurlHint       string                `json:"curl_hint"`       // Example curl command
}

// NetworkConnection represents a container's connection to a Docker network
type NetworkConnection struct {
	Name      string   `json:"name"`
	ID        string   `json:"id"`
	IPAddress string   `json:"ip_address"`
	Aliases   []string `json:"aliases"`
}

// InternalPortMapping represents internal port configuration
type InternalPortMapping struct {
	Container int    `json:"container"`
	Protocol  string `json:"protocol,omitempty"`
}

// ServiceLink represents a link between services
type ServiceLink struct {
	ID        int64     `json:"id"`
	ServiceID int64     `json:"service_id"`
	TargetID  int64     `json:"target_id"`
	CreatedAt time.Time `json:"created_at"`
}

// LinkedService represents a service in the links response
type LinkedService struct {
	ID        int64  `json:"id"`
	Alias     string `json:"alias"`
	ProjectID int64  `json:"project_id"`
	Name      string `json:"name"`
}

// ServiceSpec represents the specification for creating a service
type ServiceSpec struct {
	Name       string            `json:"name" binding:"required"`
	Image      string            `json:"image" binding:"required"`
	Env        map[string]string `json:"env"`
	Ports      []PortMap         `json:"ports"`
	RegistryID *string           `json:"registry_id,omitempty"`
	HealthPath *string           `json:"health_path,omitempty"`
}

// Route represents an external routing configuration
type Route struct {
	ID            int64      `json:"id"`
	ServiceID     int64      `json:"service_id"`
	Domain        string     `json:"domain"`
	Port          int        `json:"port"`
	TLS           bool       `json:"tls"`
	Path          *string    `json:"path,omitempty"`
	CertificateID *int64     `json:"certificate_id,omitempty"`
	DomainID      *int64     `json:"domain_id,omitempty"`
	ProxyConfig   *string    `json:"proxy_config,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     *time.Time `json:"updated_at,omitempty"`
}

// RouteSpec represents the specification for creating a route
type RouteSpec struct {
	Domain        string  `json:"domain" binding:"required"`
	Port          int     `json:"port" binding:"required,min=1,max=65535"`
	TLS           bool    `json:"tls"`
	Path          *string `json:"path,omitempty"`
	CertificateID *int64  `json:"certificate_id,omitempty"`
	DomainID      *int64  `json:"domain_id,omitempty"`
	ProxyConfig   *string `json:"proxy_config,omitempty"`
}

// RouteWithService combines route and service information for nginx config generation
type RouteWithService struct {
	Route
	ServiceName string `json:"service_name"`
	ProjectName string `json:"project_name"`
}

// Certificate represents an SSL/TLS certificate
type Certificate struct {
	ID           int64      `json:"id"`
	Domain       string     `json:"domain"`
	Type         string     `json:"type"`
	CertData     *string    `json:"cert_data,omitempty"`
	KeyData      *string    `json:"key_data,omitempty"`
	KeyDataNonce *string    `json:"-"` // Never expose nonce in JSON
	ExpiresAt    *time.Time `json:"expires_at,omitempty"`
	AutoRenew    bool       `json:"auto_renew"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// CertificateForAPI returns a copy of the certificate with key_data redacted for API responses
func (c Certificate) CertificateForAPI() Certificate {
	apiCert := c
	if c.KeyData != nil && *c.KeyData != "" {
		keyStr := *c.KeyData
		length := len(keyStr)

		// Create SHA-256 fingerprint of the key data
		hash := sha256.Sum256([]byte(keyStr))
		fingerprint := hex.EncodeToString(hash[:8]) // Use first 8 bytes (16 hex chars) for fingerprint

		// Redact with length and fingerprint info
		redacted := fmt.Sprintf("[REDACTED: length=%d, fingerprint=%s]", length, fingerprint)
		apiCert.KeyData = &redacted
	}
	// Always remove nonce from API responses
	apiCert.KeyDataNonce = nil
	return apiCert
}

// DecryptKeyData decrypts the key data using the provided master key
func (c *Certificate) DecryptKeyData(masterKey []byte) error {
	if c.KeyData == nil || c.KeyDataNonce == nil {
		return nil // No key data to decrypt
	}

	// Decode base64 encrypted data and nonce
	encryptedData, err := base64.StdEncoding.DecodeString(*c.KeyData)
	if err != nil {
		return fmt.Errorf("failed to decode encrypted key data: %w", err)
	}

	nonce, err := base64.StdEncoding.DecodeString(*c.KeyDataNonce)
	if err != nil {
		return fmt.Errorf("failed to decode nonce: %w", err)
	}

	// Decrypt using the crypto package
	plaintext, err := crypto.Decrypt(masterKey, nonce, encryptedData)
	if err != nil {
		return fmt.Errorf("failed to decrypt key data: %w", err)
	}

	// Replace encrypted data with decrypted plaintext
	decrypted := string(plaintext)
	c.KeyData = &decrypted

	return nil
}

// EncryptKeyData encrypts the key data using the provided master key
func (c *Certificate) EncryptKeyData(masterKey []byte) error {
	if c.KeyData == nil || *c.KeyData == "" {
		return nil // No key data to encrypt
	}

	// Encrypt the key data
	nonce, ciphertext, err := crypto.Encrypt(masterKey, []byte(*c.KeyData))
	if err != nil {
		return fmt.Errorf("failed to encrypt key data: %w", err)
	}

	// Encode as base64 for storage
	encryptedData := base64.StdEncoding.EncodeToString(ciphertext)
	encodedNonce := base64.StdEncoding.EncodeToString(nonce)

	// Update the struct
	c.KeyData = &encryptedData
	c.KeyDataNonce = &encodedNonce

	return nil
}

// CertificateSpec represents the specification for creating a certificate
type CertificateSpec struct {
	Domain    string  `json:"domain" binding:"required"`
	Type      string  `json:"type" binding:"required"`
	CertData  *string `json:"cert_data,omitempty"`
	KeyData   *string `json:"key_data,omitempty"`
	AutoRenew *bool   `json:"auto_renew,omitempty"`
}

// NginxConfig represents a nginx configuration snapshot
type NginxConfig struct {
	ID            int64     `json:"id"`
	ConfigHash    string    `json:"config_hash"`
	ConfigContent string    `json:"config_content"`
	Active        bool      `json:"active"`
	CreatedAt     time.Time `json:"created_at"`
}

// Build represents a container image build
type Build struct {
	ID          int64      `json:"id"`
	ProjectID   int64      `json:"project_id"`
	ServiceID   int64      `json:"service_id"`
	GitURL      string     `json:"git_url"`
	GitRef      string     `json:"git_ref"`
	CommitSHA   string     `json:"commit_sha"`
	CommitMsg   string     `json:"commit_msg"`
	ContextPath string     `json:"context_path"`
	Dockerfile  string     `json:"dockerfile"`
	ImageTag    string     `json:"image_tag"`
	Status      string     `json:"status"` // queued, building, success, failed
	LogPath     *string    `json:"log_path"`
	TriggeredBy string     `json:"triggered_by"`
	StartedAt   *time.Time `json:"started_at"`
	FinishedAt  *time.Time `json:"finished_at"`
	CreatedAt   time.Time  `json:"created_at"`
}

// BuildSpec represents the specification for creating a build
type BuildSpec struct {
	GitURL      string `json:"git_url" binding:"required"`
	GitRef      string `json:"git_ref" binding:"required"`
	ContextPath string `json:"context_path"`
	Dockerfile  string `json:"dockerfile"`
}

// Deployment represents a service deployment
type Deployment struct {
	ID        int64     `json:"id"`
	ProjectID int64     `json:"project_id"`
	ServiceID int64     `json:"service_id"`
	ImageTag  string    `json:"image_tag"`
	Status    string    `json:"status"` // deploying, success, failed, rolled_back
	Reason    *string   `json:"reason"`
	CreatedAt time.Time `json:"created_at"`
}

// WebhookDelivery represents a webhook delivery attempt
type WebhookDelivery struct {
	ID         string     `json:"id" db:"id"`
	Event      string     `json:"event" db:"event"`           // push, pull_request, etc.
	Repository string     `json:"repository" db:"repository"` // repo URL or name
	Status     string     `json:"status" db:"status"`         // success, failed, processing
	Payload    string     `json:"payload" db:"payload"`       // JSON payload from webhook
	Response   *string    `json:"response" db:"response"`     // Response from processing
	CreatedAt  time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt  *time.Time `json:"updated_at" db:"updated_at"`
}

// DeploymentSpec represents the specification for creating a deployment
type DeploymentSpec struct {
	ImageTag string `json:"image_tag" binding:"required"`
	Reason   string `json:"reason"`
}

// Cert represents a TLS certificate
type Cert struct {
	ID           int64      `json:"id"`
	Domain       string     `json:"domain"`
	Email        string     `json:"email"`
	Status       string     `json:"status"` // issued, failed, renewing
	LastIssuedAt *time.Time `json:"last_issued_at"`
	ExpiresAt    *time.Time `json:"expires_at"`
	CreatedAt    time.Time  `json:"created_at"`
}

// CertSpec represents the specification for creating a certificate
type CertSpec struct {
	Domain string `json:"domain" binding:"required"`
	Email  string `json:"email" binding:"required"`
}

// Client represents a connected client/integration
type Client struct {
	ID         int64      `json:"id"`
	Name       string     `json:"name"`
	TokenID    *int64     `json:"token_id"`
	Status     string     `json:"status"` // active, idle, disconnected
	LastIP     *string    `json:"last_ip"`
	LastSeenAt *time.Time `json:"last_seen_at"`
	CreatedAt  time.Time  `json:"created_at"`
	UpdatedAt  time.Time  `json:"updated_at"`
}

// ClientSpec represents the specification for creating/updating a client
type ClientSpec struct {
	Name string `json:"name" binding:"required"`
	IP   string `json:"ip"`
}

// Client status constants
const (
	ClientStatusActive       = "active"
	ClientStatusIdle         = "idle"
	ClientStatusDisconnected = "disconnected"
)

// Service state constants
const (
	ServiceStateRunning = "running"
	ServiceStateStopped = "stopped"
)

// Health status constants
const (
	HealthStatusOK      = "ok"
	HealthStatusFail    = "fail"
	HealthStatusUnknown = "unknown"
)

// Health system constants
const (
	CrashLoopThreshold = 5    // max restarts in window before crash loop
	CrashLoopWindow    = 10   // minutes for restart window
	HealthProbeTimeout = 3    // seconds for health probe timeout (increased from 1s)
	DefaultHealthPort  = 8080 // default port for health checks
)

// slugRegex matches characters that should be replaced in slugs
var slugRegex = regexp.MustCompile(`[^a-z0-9]+`)

// GenerateSlug creates a URL-safe slug from a string
func GenerateSlug(input string) string {
	// Convert to lowercase
	slug := strings.ToLower(input)
	// Replace non-alphanumeric characters with hyphens
	slug = slugRegex.ReplaceAllString(slug, "-")
	// Trim leading/trailing hyphens
	slug = strings.Trim(slug, "-")
	// Ensure it's not empty
	if slug == "" {
		slug = "unnamed"
	}
	return slug
}

// GenerateProjectNetworkName creates a project network name from project ID
func GenerateProjectNetworkName(projectID int64) string {
	return "glinr_proj_" + fmt.Sprint(projectID)
}

// GenerateServiceAlias creates a deterministic service alias for internal networking
func GenerateServiceAlias(projectName, serviceName string) string {
	projectSlug := GenerateSlug(projectName)
	serviceSlug := GenerateSlug(serviceName)
	return fmt.Sprintf("svc-%s-%s", projectSlug, serviceSlug)
}

// GenerateServiceAliases creates both short and long form service aliases
func GenerateServiceAliases(projectName, serviceName string) []string {
	projectSlug := GenerateSlug(projectName)
	serviceSlug := GenerateSlug(serviceName)

	// Short alias for same-network access
	shortAlias := serviceSlug

	// Long alias for cross-project reference
	longAlias := fmt.Sprintf("%s.%s.local", serviceSlug, projectSlug)

	return []string{shortAlias, longAlias}
}

// GenerateNetworkHints creates DNS and curl hints for service networking
func GenerateNetworkHints(alias string, ports []PortMap) (string, string) {
	if len(ports) == 0 {
		return alias, "# No ports exposed\n# Container may use internal ports"
	}

	// Use first port as primary hint
	primaryPort := ports[0].Container
	dnsHint := fmt.Sprintf("%s:%d", alias, primaryPort)
	curlHint := fmt.Sprintf("curl http://%s:%d/health", alias, primaryPort)

	return dnsHint, curlHint
}

// HistoricalMetric represents a historical system resource data point
type HistoricalMetric struct {
	ID          int64     `json:"id"`
	Timestamp   time.Time `json:"timestamp"`
	CPUPercent  float64   `json:"cpu_percent"`
	MemoryUsed  int64     `json:"memory_used"`
	MemoryTotal int64     `json:"memory_total"`
	DiskUsed    int64     `json:"disk_used"`
	DiskTotal   int64     `json:"disk_total"`
	NetworkRX   int64     `json:"network_rx"`
	NetworkTX   int64     `json:"network_tx"`
}

// Setting represents a configuration setting that may be encrypted
type Setting struct {
	Key       string    `json:"key" db:"key"`
	Value     []byte    `json:"-" db:"value"` // Raw encrypted/unencrypted data
	IsSecret  bool      `json:"is_secret" db:"is_secret"`
	CreatedAt time.Time `json:"created_at" db:"created_at"`
	UpdatedAt time.Time `json:"updated_at" db:"updated_at"`
}

// GitHubOAuthConfig represents GitHub OAuth configuration
type GitHubOAuthConfig struct {
	Mode         string `json:"mode"` // "off", "pkce", "confidential"
	ClientID     string `json:"client_id,omitempty"`
	HasSecret    bool   `json:"has_client_secret,omitempty"`
	ClientSecret string `json:"client_secret,omitempty"` // Only populated during updates
}

// GitHubAppConfig represents GitHub App configuration
type GitHubAppConfig struct {
	Installed        bool   `json:"installed"`
	AppID            string `json:"app_id,omitempty"`
	HasPrivateKey    bool   `json:"has_private_key,omitempty"`
	PrivateKeyPEM    string `json:"private_key_pem,omitempty"` // Only populated during updates
	HasWebhookSecret bool   `json:"has_webhook_secret,omitempty"`
	WebhookSecret    string `json:"webhook_secret,omitempty"` // Only populated during updates
}

// IntegrationsConfig represents all integration settings
type IntegrationsConfig struct {
	GitHubOAuth *GitHubOAuthConfig `json:"github_oauth,omitempty"`
	GitHubApp   *GitHubAppConfig   `json:"github_app,omitempty"`
}

// GitHubRepository represents a repository from a GitHub App installation
type GitHubRepository struct {
	ID             int64     `json:"id" db:"id"`
	RepositoryID   int64     `json:"repository_id" db:"repository_id"`
	InstallationID int64     `json:"installation_id" db:"installation_id"`
	Name           string    `json:"name" db:"name"`
	FullName       string    `json:"full_name" db:"full_name"`
	OwnerLogin     string    `json:"owner_login" db:"owner_login"`
	Private        bool      `json:"private" db:"private"`
	DefaultBranch  string    `json:"default_branch" db:"default_branch"`
	CloneURL       string    `json:"clone_url" db:"clone_url"`
	SSHURL         string    `json:"ssh_url" db:"ssh_url"`
	CreatedAt      time.Time `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time `json:"updated_at" db:"updated_at"`
}

// GitHubRepoMapping represents the activation mapping between GitHub repo and GLINR project
type GitHubRepoMapping struct {
	ID           int64     `json:"id" db:"id"`
	RepositoryID int64     `json:"repository_id" db:"repository_id"`
	ProjectID    int64     `json:"project_id" db:"project_id"`
	BranchFilter *string   `json:"branch_filter" db:"branch_filter"` // regex pattern
	BuildContext *string   `json:"build_context" db:"build_context"` // dockerfile path
	BuildArgs    *string   `json:"build_args" db:"build_args"`       // JSON object
	AutoDeploy   bool      `json:"auto_deploy" db:"auto_deploy"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
	CreatedBy    string    `json:"created_by" db:"created_by"`
}

// GitHubWebhookEvent represents a GitHub webhook event for audit/debugging
type GitHubWebhookEvent struct {
	ID             int64      `json:"id" db:"id"`
	EventType      string     `json:"event_type" db:"event_type"`
	EventAction    *string    `json:"event_action" db:"event_action"`
	InstallationID *int64     `json:"installation_id" db:"installation_id"`
	RepositoryID   *int64     `json:"repository_id" db:"repository_id"`
	PayloadHash    string     `json:"payload_hash" db:"payload_hash"`
	ProcessedAt    *time.Time `json:"processed_at" db:"processed_at"`
	ErrorMessage   *string    `json:"error_message" db:"error_message"`
	CreatedAt      time.Time  `json:"created_at" db:"created_at"`
}

// DNS Provider types
const (
	DNSProviderTypeCloudflare = "cloudflare"
)

// DNS verification methods
const (
	DNSVerificationMethodA     = "A"
	DNSVerificationMethodCNAME = "CNAME"
	DNSVerificationMethodTXT   = "TXT"
)

// DNS verification status
const (
	DNSVerificationStatusPending  = "pending"
	DNSVerificationStatusVerified = "verified"
	DNSVerificationStatusFailed   = "failed"
)

// Enhanced Certificate types and status
const (
	CertificateTypeACME     = "acme"
	CertificateTypeUploaded = "uploaded"

	CertificateStatusActive  = "active"
	CertificateStatusExpired = "expired"
	CertificateStatusFailed  = "failed"
	CertificateStatusPending = "pending"
)

// DNSProvider represents a DNS service provider for domain management
type DNSProvider struct {
	ID            int64     `json:"id" db:"id"`
	Name          string    `json:"name" db:"name"`
	Type          string    `json:"type" db:"type"`               // cloudflare, route53, manual
	Label         *string   `json:"label" db:"label"`             // User-friendly label
	Email         *string   `json:"email" db:"email"`             // Email for providers like ACME
	APIToken      *string   `json:"-" db:"api_token"`             // Encrypted API token - never expose in JSON
	APITokenNonce *string   `json:"-" db:"api_token_nonce"`       // Encryption nonce - never expose in JSON
	ConfigJSON    string    `json:"config_json" db:"config_json"` // Legacy encrypted provider-specific config
	Settings      *string   `json:"settings" db:"settings"`       // JSON blob for additional provider-specific settings
	Active        *bool     `json:"active" db:"active"`           // Whether this provider is active
	CreatedAt     time.Time `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

// DNSProviderSpec represents the specification for creating/updating a DNS provider
type DNSProviderSpec struct {
	Name     string         `json:"name" binding:"required"`
	Type     string         `json:"type" binding:"required"`
	Label    string         `json:"label" binding:"required"`
	Email    *string        `json:"email,omitempty"`
	APIToken *string        `json:"api_token,omitempty"`
	Config   map[string]any `json:"config" binding:"required"` // Legacy field for backward compatibility
	Settings map[string]any `json:"settings,omitempty"`
}

// EncryptAPIToken encrypts the API token using AES-GCM with the provided master key
func (p *DNSProvider) EncryptAPIToken(masterKey []byte) error {
	if p.APIToken == nil || *p.APIToken == "" {
		return nil // No API token to encrypt
	}

	// Encrypt the API token
	nonce, ciphertext, err := crypto.Encrypt(masterKey, []byte(*p.APIToken))
	if err != nil {
		return fmt.Errorf("failed to encrypt API token: %w", err)
	}

	// Encode as base64 for storage
	encryptedData := base64.StdEncoding.EncodeToString(ciphertext)
	encodedNonce := base64.StdEncoding.EncodeToString(nonce)

	// Update the struct
	p.APIToken = &encryptedData
	p.APITokenNonce = &encodedNonce

	return nil
}

// DecryptAPIToken decrypts the API token using AES-GCM with the provided master key
func (p *DNSProvider) DecryptAPIToken(masterKey []byte) error {
	if p.APIToken == nil || p.APITokenNonce == nil {
		return nil // No API token to decrypt
	}

	// Decode base64 encrypted data and nonce
	encryptedData, err := base64.StdEncoding.DecodeString(*p.APIToken)
	if err != nil {
		return fmt.Errorf("failed to decode encrypted API token: %w", err)
	}

	nonce, err := base64.StdEncoding.DecodeString(*p.APITokenNonce)
	if err != nil {
		return fmt.Errorf("failed to decode nonce: %w", err)
	}

	// Decrypt the API token
	plaintext, err := crypto.Decrypt(masterKey, nonce, encryptedData)
	if err != nil {
		return fmt.Errorf("failed to decrypt API token: %w", err)
	}

	// Update the struct with decrypted data
	decryptedToken := string(plaintext)
	p.APIToken = &decryptedToken

	return nil
}

// Domain represents a managed domain with verification and certificate support
type Domain struct {
	ID                    int64      `json:"id" db:"id"`
	Name                  string     `json:"name" db:"name"`
	Status                string     `json:"status" db:"status"`                         // pending|verifying|verified|active|error
	Provider              *string    `json:"provider" db:"provider"`                     // 'cloudflare'|'manual'|NULL
	ZoneID                *string    `json:"zone_id" db:"zone_id"`                       // provider zone identifier
	VerificationToken     string     `json:"verification_token" db:"verification_token"` // random token
	VerificationCheckedAt *time.Time `json:"verification_checked_at" db:"verification_checked_at"`
	CertificateID         *int64     `json:"certificate_id" db:"certificate_id"` // nullable FK to certificates
	CreatedAt             time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at" db:"updated_at"`
}

// Domain status constants
const (
	DomainStatusPending   = "pending"
	DomainStatusVerifying = "verifying"
	DomainStatusVerified  = "verified"
	DomainStatusActive    = "active"
	DomainStatusError     = "error"
)

// DomainSpec represents the specification for creating/updating a domain
type DomainSpec struct {
	Name     string  `json:"name" binding:"required"`
	Provider *string `json:"provider,omitempty"`
	ZoneID   *string `json:"zone_id,omitempty"`
}

// DomainVerification represents a domain ownership verification attempt
type DomainVerification struct {
	ID            int64      `json:"id" db:"id"`
	DomainID      int64      `json:"domain_id" db:"domain_id"`
	Method        string     `json:"method" db:"method"` // A, CNAME, TXT
	Challenge     string     `json:"challenge" db:"challenge"`
	Status        string     `json:"status" db:"status"` // pending, verified, failed
	LastCheckedAt *time.Time `json:"last_checked_at" db:"last_checked_at"`
	CreatedAt     time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at" db:"updated_at"`
}

// DomainVerificationSpec represents the specification for creating a domain verification
type DomainVerificationSpec struct {
	Method    string `json:"method" binding:"required"`
	Challenge string `json:"challenge" binding:"required"`
}

// EnhancedCertificate represents an enhanced SSL/TLS certificate with full metadata
type EnhancedCertificate struct {
	ID          int64      `json:"id" db:"id"`
	Domain      string     `json:"domain" db:"domain"`
	Type        string     `json:"type" db:"type"` // acme, uploaded
	Issuer      *string    `json:"issuer" db:"issuer"`
	NotBefore   *time.Time `json:"not_before" db:"not_before"`
	NotAfter    *time.Time `json:"not_after" db:"not_after"`
	Status      string     `json:"status" db:"status"` // active, expired, failed, pending
	PEMCert     *string    `json:"pem_cert" db:"pem_cert"`
	PEMChain    *string    `json:"pem_chain" db:"pem_chain"`
	PEMKeyEnc   *string    `json:"-" db:"pem_key_enc"`   // Encrypted private key (never exposed in JSON)
	PEMKeyNonce *string    `json:"-" db:"pem_key_nonce"` // Encryption nonce (never exposed in JSON)
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
}

// EnhancedCertificateForAPI returns a copy of the certificate with key data redacted for API responses
func (c EnhancedCertificate) EnhancedCertificateForAPI() EnhancedCertificate {
	apiCert := c
	if c.PEMKeyEnc != nil && *c.PEMKeyEnc != "" {
		keyStr := *c.PEMKeyEnc
		length := len(keyStr)

		// Create SHA-256 fingerprint of the encrypted key data
		hash := sha256.Sum256([]byte(keyStr))
		fingerprint := hex.EncodeToString(hash[:8]) // Use first 8 bytes (16 hex chars) for fingerprint

		// Redact with length and fingerprint info
		redacted := fmt.Sprintf("[REDACTED: length=%d, fingerprint=%s]", length, fingerprint)
		apiCert.PEMKeyEnc = &redacted
	}
	// Always remove nonce from API responses
	apiCert.PEMKeyNonce = nil
	return apiCert
}

// DecryptPEMKey decrypts the PEM private key using the provided master key
func (c *EnhancedCertificate) DecryptPEMKey(masterKey []byte) error {
	if c.PEMKeyEnc == nil || c.PEMKeyNonce == nil {
		return nil // No key data to decrypt
	}

	// Decode base64 encrypted data and nonce
	encryptedData, err := base64.StdEncoding.DecodeString(*c.PEMKeyEnc)
	if err != nil {
		return fmt.Errorf("failed to decode encrypted PEM key: %w", err)
	}

	nonce, err := base64.StdEncoding.DecodeString(*c.PEMKeyNonce)
	if err != nil {
		return fmt.Errorf("failed to decode nonce: %w", err)
	}

	// Decrypt using the crypto package
	plaintext, err := crypto.Decrypt(masterKey, nonce, encryptedData)
	if err != nil {
		return fmt.Errorf("failed to decrypt PEM key: %w", err)
	}

	// Replace encrypted data with decrypted plaintext
	decrypted := string(plaintext)
	c.PEMKeyEnc = &decrypted

	return nil
}

// EncryptPEMKey encrypts the PEM private key using the provided master key
func (c *EnhancedCertificate) EncryptPEMKey(masterKey []byte) error {
	if c.PEMKeyEnc == nil || *c.PEMKeyEnc == "" {
		return nil // No key data to encrypt
	}

	// Encrypt the key data
	nonce, ciphertext, err := crypto.Encrypt(masterKey, []byte(*c.PEMKeyEnc))
	if err != nil {
		return fmt.Errorf("failed to encrypt PEM key: %w", err)
	}

	// Encode as base64 for storage
	encryptedData := base64.StdEncoding.EncodeToString(ciphertext)
	encodedNonce := base64.StdEncoding.EncodeToString(nonce)

	// Update the struct
	c.PEMKeyEnc = &encryptedData
	c.PEMKeyNonce = &encodedNonce

	return nil
}

// EnhancedCertificateSpec represents the specification for creating an enhanced certificate
type EnhancedCertificateSpec struct {
	Domain   string  `json:"domain" binding:"required"`
	Type     string  `json:"type" binding:"required"`
	Issuer   *string `json:"issuer,omitempty"`
	PEMCert  *string `json:"pem_cert,omitempty"`
	PEMChain *string `json:"pem_chain,omitempty"`
	PEMKey   *string `json:"pem_key,omitempty"`
}
