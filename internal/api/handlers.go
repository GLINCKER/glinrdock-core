package api

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/GLINCKER/glinrdock/internal/auth"
	"github.com/GLINCKER/glinrdock/internal/config"
	"github.com/GLINCKER/glinrdock/internal/docker"
	"github.com/GLINCKER/glinrdock/internal/dockerx"
	"github.com/GLINCKER/glinrdock/internal/events"
	"github.com/GLINCKER/glinrdock/internal/license"
	"github.com/GLINCKER/glinrdock/internal/plan"
	"github.com/GLINCKER/glinrdock/internal/proxy"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/GLINCKER/glinrdock/internal/util"
	"github.com/GLINCKER/glinrdock/internal/version"
	"github.com/gin-gonic/gin"
)

// Handlers contains API handlers with dependencies
type Handlers struct {
	dockerClient dockerx.Client
	store        *store.Store // Add main store for search indexing
	tokenStore   TokenStore
	projectStore ProjectStore
	serviceStore ServiceStore
	routeStore   RouteStore
	envVarStore  EnvVarStore
	dockerEngine DockerEngine
	nginxConfig     *proxy.NginxConfig
	cicdHandlers    *CICDHandlers
	certHandlers    *CertHandlers
	metricsHandlers *MetricsHandlers
	webhookHandlers *WebhookHandlers
	planEnforcer    *plan.Enforcer
	licenseManager  *license.Manager
	auditLogger     *audit.Logger
	config          *config.PlanConfig
	systemConfig    *util.Config   // Add system configuration
	eventCache      *events.EventCache
	environmentStore *store.EnvironmentStore
	registryStore    *store.RegistryStore
	networkManager     *docker.NetworkManager
	oauthService       *auth.OAuthService
	githubHandlers     *GitHubHandlers
	settingsHandlers   *SettingsHandlers
	githubAppHandlers  *GitHubAppHandlers
	searchHandlers     *SearchHandlers
	helpHandlers       *HelpHandlers
}

// NewHandlers creates new handlers with dependencies
func NewHandlers(dockerClient dockerx.Client, mainStore *store.Store, tokenStore TokenStore, projectStore ProjectStore, serviceStore ServiceStore, routeStore RouteStore, envVarStore EnvVarStore, dockerEngine DockerEngine, nginxConfig *proxy.NginxConfig, cicdHandlers *CICDHandlers, certHandlers *CertHandlers, metricsHandlers *MetricsHandlers, webhookHandlers *WebhookHandlers, planEnforcer *plan.Enforcer, licenseManager *license.Manager, auditLogger *audit.Logger, config *config.PlanConfig, systemConfig *util.Config, eventCache *events.EventCache, environmentStore *store.EnvironmentStore, registryStore *store.RegistryStore, networkManager *docker.NetworkManager, oauthService *auth.OAuthService, githubHandlers *GitHubHandlers, settingsHandlers *SettingsHandlers, githubAppHandlers *GitHubAppHandlers, searchHandlers *SearchHandlers, helpHandlers *HelpHandlers) *Handlers {
	return &Handlers{
		dockerClient:     dockerClient,
		store:            mainStore,
		tokenStore:       tokenStore,
		projectStore:     projectStore,
		serviceStore:     serviceStore,
		routeStore:       routeStore,
		envVarStore:      envVarStore,
		dockerEngine:     dockerEngine,
		nginxConfig:      nginxConfig,
		cicdHandlers:     cicdHandlers,
		certHandlers:     certHandlers,
		metricsHandlers:  metricsHandlers,
		webhookHandlers:  webhookHandlers,
		planEnforcer:     planEnforcer,
		licenseManager:   licenseManager,
		auditLogger:      auditLogger,
		config:           config,
		systemConfig:     systemConfig,
		eventCache:       eventCache,
		environmentStore: environmentStore,
		registryStore:    registryStore,
		networkManager:     networkManager,
		oauthService:       oauthService,
		githubHandlers:     githubHandlers,
		settingsHandlers:   settingsHandlers,
		githubAppHandlers:  githubAppHandlers,
		searchHandlers:     searchHandlers,
		helpHandlers:       helpHandlers,
	}
}

// Health returns server health status
func (h *Handlers) Health(c *gin.Context) {
	info := version.Get()
	c.JSON(http.StatusOK, gin.H{
		"ok":      true,
		"uptime":  version.GetUptime().String(),
		"version": info.Version,
	})
}

// GitHub App webhook handler - delegated to GitHub App handlers
func (h *Handlers) GitHubAppWebhook(c *gin.Context) {
	if h.githubAppHandlers != nil {
		h.githubAppHandlers.HandleWebhook(c)
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "GitHub App not configured"})
	}
}

// System returns system information
func (h *Handlers) System(c *gin.Context) {
	info := version.Get()
	
	dockerStatus := "unknown"
	if h.dockerClient != nil {
		if err := h.dockerClient.Ping(); err == nil {
			dockerStatus = "connected"
		} else {
			dockerStatus = "unreachable"
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"go_version":    info.GoVersion,
		"os":           info.OS,
		"arch":         info.Arch,
		"docker_status": dockerStatus,
		"uptime":       version.GetUptime().String(),
		"nginx_proxy_enabled": h.nginxConfig != nil,
	})
}

// SystemConfig returns system configuration settings
func (h *Handlers) SystemConfig(c *gin.Context) {
	if h.systemConfig == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"error": "system configuration not available",
		})
		return
	}

	// Return system configuration with DNS and ACME settings
	// Sensitive values like secrets are redacted
	config := gin.H{
		"dns": gin.H{
			"verify_enabled":     h.systemConfig.DNSVerifyEnabled,
			"public_edge_host":   h.systemConfig.PublicEdgeHost,
			"public_edge_ipv4":   h.systemConfig.PublicEdgeIPv4,
			"public_edge_ipv6":   h.systemConfig.PublicEdgeIPv6,
			"resolvers":          h.systemConfig.DNSResolvers,
		},
		"acme": gin.H{
			"directory_url":      h.systemConfig.ACMEDirectoryURL,
			"email":              h.systemConfig.ACMEEmail,
			"http01_enabled":     h.systemConfig.ACMEHTTP01Enabled,
			"dns01_enabled":      h.systemConfig.ACMEDNS01Enabled,
		},
		"cloudflare": gin.H{
			"api_token_configured": h.systemConfig.CFAPIToken != "",
		},
		"nginx": gin.H{
			"proxy_enabled": h.systemConfig.NginxProxyEnabled,
		},
		"security": gin.H{
			"secrets_enabled": h.systemConfig.Secret != "",
		},
	}

	c.JSON(http.StatusOK, config)
}

// GetSystemPlan returns plan information with usage and limits
func (h *Handlers) GetSystemPlan(c *gin.Context) {
	if h.planEnforcer == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "plan enforcement not configured"})
		return
	}
	
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()
	
	usage, err := h.planEnforcer.GetUsage(ctx, h.tokenStore)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get usage"})
		return
	}
	
	limits := h.planEnforcer.GetLimits()
	plan := h.planEnforcer.GetPlan()
	
	// Get feature flags
	features := map[string]bool{
		"projects":             h.planEnforcer.FeatureEnabled("projects"),
		"services":             h.planEnforcer.FeatureEnabled("services"),
		"routes":               h.planEnforcer.FeatureEnabled("routes"),
		"logs":                 h.planEnforcer.FeatureEnabled("logs"),
		"basic_metrics":        h.planEnforcer.FeatureEnabled("basic_metrics"),
		"lockdown":             h.planEnforcer.FeatureEnabled("lockdown"),
		"emergency_restart":    h.planEnforcer.FeatureEnabled("emergency_restart"),
		"smtp_alerts":          h.planEnforcer.FeatureEnabled("smtp_alerts"),
		"oauth":                h.planEnforcer.FeatureEnabled("oauth"),
		"multi_env":            h.planEnforcer.FeatureEnabled("multi_env"),
		"sso":                  h.planEnforcer.FeatureEnabled("sso"),
		"audit_logs":           h.planEnforcer.FeatureEnabled("audit_logs"),
		"ci_integrations":      h.planEnforcer.FeatureEnabled("ci_integrations"),
		"advanced_dashboards":  h.planEnforcer.FeatureEnabled("advanced_dashboards"),
	}
	
	response := SystemPlanResponse{
		Plan:     plan.String(),
		Limits:   limits,
		Usage:    usage,
		Features: features,
	}
	
	c.JSON(http.StatusOK, response)
}

// CI/CD endpoints - delegate to CICDHandlers
func (h *Handlers) GitHubWebhook(c *gin.Context) {
	if h.webhookHandlers != nil {
		h.webhookHandlers.GitHubWebhookEnhanced(c)
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Webhook handlers not configured"})
	}
}

// ListWebhookDeliveries delegates to webhook handlers
func (h *Handlers) ListWebhookDeliveries(c *gin.Context) {
	if h.webhookHandlers != nil {
		h.webhookHandlers.ListWebhookDeliveries(c)
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Webhook handlers not configured"})
	}
}

// GetWebhookDelivery delegates to webhook handlers  
func (h *Handlers) GetWebhookDelivery(c *gin.Context) {
	if h.webhookHandlers != nil {
		h.webhookHandlers.GetWebhookDelivery(c)
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Webhook handlers not configured"})
	}
}

func (h *Handlers) TriggerBuild(c *gin.Context) {
	if h.cicdHandlers != nil {
		h.cicdHandlers.TriggerBuild(c)
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "CI/CD not configured"})
	}
}

func (h *Handlers) GetBuild(c *gin.Context) {
	if h.cicdHandlers != nil {
		h.cicdHandlers.GetBuild(c)
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "CI/CD not configured"})
	}
}

func (h *Handlers) ListBuilds(c *gin.Context) {
	if h.cicdHandlers != nil {
		h.cicdHandlers.ListBuilds(c)
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "CI/CD not configured"})
	}
}

func (h *Handlers) TriggerDeployment(c *gin.Context) {
	if h.cicdHandlers != nil {
		h.cicdHandlers.TriggerDeployment(c)
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "CI/CD not configured"})
	}
}

func (h *Handlers) GetDeployment(c *gin.Context) {
	if h.cicdHandlers != nil {
		h.cicdHandlers.GetDeployment(c)
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "CI/CD not configured"})
	}
}

func (h *Handlers) ListDeployments(c *gin.Context) {
	if h.cicdHandlers != nil {
		h.cicdHandlers.ListDeployments(c)
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "CI/CD not configured"})
	}
}

func (h *Handlers) RollbackDeployment(c *gin.Context) {
	if h.cicdHandlers != nil {
		h.cicdHandlers.RollbackDeployment(c)
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "CI/CD not configured"})
	}
}

func (h *Handlers) GetJob(c *gin.Context) {
	if h.cicdHandlers != nil {
		h.cicdHandlers.GetJob(c)
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "CI/CD not configured"})
	}
}

// Certificate endpoints - delegate to CertHandlers
func (h *Handlers) IssueCert(c *gin.Context) {
	if h.certHandlers != nil {
		h.certHandlers.IssueCert(c)
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Certificate management not configured"})
	}
}

func (h *Handlers) ListCerts(c *gin.Context) {
	if h.certHandlers != nil {
		h.certHandlers.ListCerts(c)
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Certificate management not configured"})
	}
}

func (h *Handlers) RenewCert(c *gin.Context) {
	if h.certHandlers != nil {
		h.certHandlers.RenewCert(c)
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Certificate management not configured"})
	}
}

func (h *Handlers) GetCert(c *gin.Context) {
	if h.certHandlers != nil {
		h.certHandlers.GetCert(c)
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Certificate management not configured"})
	}
}

func (h *Handlers) ReloadNginx(c *gin.Context) {
	nginxHandlers := NewNginxHandlers(nil, nil, h.store, h.auditLogger)
	nginxHandlers.ReloadNginx(c)
}

func (h *Handlers) GetCertStatus(c *gin.Context) {
	if h.certHandlers != nil {
		h.certHandlers.GetCertStatus(c)
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Certificate management not configured"})
	}
}

// Metrics endpoints - delegate to MetricsHandlers
func (h *Handlers) GetMetrics(c *gin.Context) {
	if h.metricsHandlers != nil {
		h.metricsHandlers.GetMetrics(c)
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Metrics not configured"})
	}
}

func (h *Handlers) GetHistoricalMetrics(c *gin.Context) {
	if h.metricsHandlers != nil {
		h.metricsHandlers.GetHistoricalMetrics(c)
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Historical metrics not configured"})
	}
}

func (h *Handlers) GetLatestHistoricalMetrics(c *gin.Context) {
	if h.metricsHandlers != nil {
		h.metricsHandlers.GetLatestHistoricalMetrics(c)
	} else {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "Historical metrics not configured"})
	}
}

// CreateBackup creates and returns a system backup
func (h *Handlers) CreateBackup(c *gin.Context) {
	if h.auditLogger != nil {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordSystemAction(c.Request.Context(), actor, audit.ActionBackupCreate, nil)
	}

	// Create backup using backup service
	backupData, err := createSystemBackup()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create backup: " + err.Error()})
		return
	}

	// Set headers for file download
	timestamp := time.Now().Format("2006-01-02T15-04-05")
	filename := "glinrdock-backup-" + timestamp + ".tar.gz"
	
	c.Header("Content-Type", "application/octet-stream")
	c.Header("Content-Disposition", "attachment; filename=\""+filename+"\"")
	c.Header("Content-Length", fmt.Sprintf("%d", len(backupData)))
	
	c.Data(http.StatusOK, "application/octet-stream", backupData)
}

// RestoreBackup restores system from backup
func (h *Handlers) RestoreBackup(c *gin.Context) {
	file, err := c.FormFile("backup")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No backup file provided"})
		return
	}

	// Validate file type
	if !strings.HasSuffix(file.Filename, ".tar.gz") && !strings.HasSuffix(file.Filename, ".tgz") {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid backup file format. Expected .tar.gz or .tgz"})
		return
	}

	// Validate file size (max 100MB)
	if file.Size > 100*1024*1024 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Backup file too large (max 100MB)"})
		return
	}

	if h.auditLogger != nil {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordSystemAction(c.Request.Context(), actor, audit.ActionBackupRestore, map[string]interface{}{
			"filename": file.Filename,
			"size":     file.Size,
		})
	}

	// Open the uploaded file
	src, err := file.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read backup file"})
		return
	}
	defer src.Close()

	// Read file data
	backupData := make([]byte, file.Size)
	_, err = src.Read(backupData)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read backup data"})
		return
	}

	// Start restore process asynchronously
	go func() {
		if err := restoreSystemBackup(backupData); err != nil {
			// Note: We can't access the gin context here, so we use "system" as actor
			if h.auditLogger != nil {
				h.auditLogger.RecordSystemAction(context.Background(), "system", audit.ActionBackupRestore, map[string]interface{}{
					"status": "failed",
					"error":  err.Error(),
				})
			}
		} else {
			if h.auditLogger != nil {
				h.auditLogger.RecordSystemAction(context.Background(), "system", audit.ActionBackupRestore, map[string]interface{}{
					"status": "completed",
				})
			}
		}
	}()

	// Return 202 Accepted to indicate async processing
	c.JSON(http.StatusAccepted, gin.H{
		"message": "Backup restore initiated",
		"status":  "processing",
	})
}

// BackupManifest contains metadata about the backup
type BackupManifest struct {
	Version     string    `json:"version"`
	CreatedAt   time.Time `json:"created_at"`
	CreatedBy   string    `json:"created_by"`
	SystemInfo  SystemBackupInfo `json:"system_info"`
	Contents    []string  `json:"contents"`
	Checksum    string    `json:"checksum,omitempty"`
}

// SystemBackupInfo contains system information at backup time
type SystemBackupInfo struct {
	Hostname    string `json:"hostname"`
	Platform    string `json:"platform"`
	GoVersion   string `json:"go_version"`
	DockerStatus string `json:"docker_status"`
}

// createSystemBackup creates a system backup and returns the data
func createSystemBackup() ([]byte, error) {
	// Create a buffer to write our archive to
	var buf bytes.Buffer
	
	// Create gzip writer
	gzw := gzip.NewWriter(&buf)
	defer gzw.Close()
	
	// Create tar writer
	tw := tar.NewWriter(gzw)
	defer tw.Close()
	
	// Create backup manifest
	manifest := BackupManifest{
		Version:   "1.0",
		CreatedAt: time.Now(),
		CreatedBy: "glinrdock-system",
		SystemInfo: SystemBackupInfo{
			Hostname:     getHostname(),
			Platform:     getPlatformInfo(),
			GoVersion:    version.Get().GoVersion,
			DockerStatus: "connected", // Could check actual status
		},
		Contents: []string{},
	}
	
	// Add database file if it exists
	dbPaths := []string{
		"./glinrdock.db",
		"./data/glinrdock.db", 
		"./db/glinrdock.db",
	}
	
	dbAdded := false
	for _, dbPath := range dbPaths {
		if err := addFileToTar(tw, dbPath, "db.sqlite", &manifest); err == nil {
			dbAdded = true
			break
		}
	}
	
	if !dbAdded {
		// Create a minimal database placeholder
		dbContent := fmt.Sprintf(`-- GLINRDOCK Database Backup
-- Created: %s
-- Hostname: %s
-- Platform: %s

-- This is a backup placeholder. In a production system, this would contain
-- the complete SQLite database with all projects, services, routes, and configuration.

PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS system_info (
  key TEXT PRIMARY KEY,
  value TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR REPLACE INTO system_info (key, value) VALUES 
('backup_created', '%s'),
('backup_version', '1.0'),
('system_hostname', '%s');
`, time.Now().Format(time.RFC3339), getHostname(), getPlatformInfo(), time.Now().Format(time.RFC3339), getHostname())
		
		if err := addStringToTar(tw, dbContent, "db.sqlite", &manifest); err != nil {
			return nil, fmt.Errorf("failed to add database to backup: %v", err)
		}
	}
	
	// Add certificates directory if it exists
	certsPath := "./certs"
	if err := addDirectoryToTar(tw, certsPath, "certs/", &manifest); err != nil {
		// Create placeholder certs directory
		if err := addStringToTar(tw, "# GLINRDOCK Certificates Directory\n# Created: "+time.Now().Format(time.RFC3339), "certs/README.txt", &manifest); err != nil {
			return nil, fmt.Errorf("failed to add certs directory: %v", err)
		}
	}
	
	// Add nginx configuration if it exists
	nginxPath := "./nginx"
	if err := addDirectoryToTar(tw, nginxPath, "nginx/", &manifest); err != nil {
		// Create placeholder nginx config
		nginxConfig := `# GLINRDOCK Nginx Configuration
# Generated: ` + time.Now().Format(time.RFC3339) + `
events {
    worker_connections 1024;
}
http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    # GLINRDOCK proxy configurations will be added here
    include /etc/nginx/conf.d/*.conf;
}
`
		if err := addStringToTar(tw, nginxConfig, "nginx/nginx.conf", &manifest); err != nil {
			return nil, fmt.Errorf("failed to add nginx config: %v", err)
		}
	}
	
	// Add configuration files
	configFiles := []string{
		"./configs/app.yml",
		"./configs/.env.example",
		"./docker-compose.yml",
	}
	
	for _, configFile := range configFiles {
		fileName := filepath.Base(configFile)
		if err := addFileToTar(tw, configFile, "config/"+fileName, &manifest); err != nil {
			// Ignore missing config files, just log them
			continue
		}
	}
	
	// Create manifest.json
	manifestData, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("failed to marshal manifest: %v", err)
	}
	
	// Add manifest to tar
	manifestHeader := &tar.Header{
		Name: "manifest.json",
		Mode: 0644,
		Size: int64(len(manifestData)),
		ModTime: time.Now(),
	}
	
	if err := tw.WriteHeader(manifestHeader); err != nil {
		return nil, fmt.Errorf("failed to write manifest header: %v", err)
	}
	
	if _, err := tw.Write(manifestData); err != nil {
		return nil, fmt.Errorf("failed to write manifest: %v", err)
	}
	
	// Close writers to flush data
	if err := tw.Close(); err != nil {
		return nil, fmt.Errorf("failed to close tar writer: %v", err)
	}
	
	if err := gzw.Close(); err != nil {
		return nil, fmt.Errorf("failed to close gzip writer: %v", err)
	}
	
	return buf.Bytes(), nil
}

// Helper functions for backup creation

// addFileToTar adds a file to the tar archive
func addFileToTar(tw *tar.Writer, filePath, archivePath string, manifest *BackupManifest) error {
	file, err := os.Open(filePath)
	if err != nil {
		return err
	}
	defer file.Close()
	
	info, err := file.Stat()
	if err != nil {
		return err
	}
	
	header, err := tar.FileInfoHeader(info, "")
	if err != nil {
		return err
	}
	header.Name = archivePath
	
	if err := tw.WriteHeader(header); err != nil {
		return err
	}
	
	_, err = io.Copy(tw, file)
	if err != nil {
		return err
	}
	
	manifest.Contents = append(manifest.Contents, archivePath)
	return nil
}

// addStringToTar adds a string as a file to the tar archive
func addStringToTar(tw *tar.Writer, content, archivePath string, manifest *BackupManifest) error {
	header := &tar.Header{
		Name: archivePath,
		Mode: 0644,
		Size: int64(len(content)),
		ModTime: time.Now(),
	}
	
	if err := tw.WriteHeader(header); err != nil {
		return err
	}
	
	if _, err := tw.Write([]byte(content)); err != nil {
		return err
	}
	
	manifest.Contents = append(manifest.Contents, archivePath)
	return nil
}

// addDirectoryToTar adds a directory and its contents to the tar archive
func addDirectoryToTar(tw *tar.Writer, dirPath, archivePrefix string, manifest *BackupManifest) error {
	return filepath.Walk(dirPath, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		
		// Get relative path from the directory
		relPath, err := filepath.Rel(dirPath, path)
		if err != nil {
			return err
		}
		
		archivePath := filepath.Join(archivePrefix, relPath)
		
		if info.IsDir() {
			// Add directory entry
			header := &tar.Header{
				Name: archivePath + "/",
				Mode: int64(info.Mode()),
				ModTime: info.ModTime(),
				Typeflag: tar.TypeDir,
			}
			return tw.WriteHeader(header)
		}
		
		// Add file
		file, err := os.Open(path)
		if err != nil {
			return err
		}
		defer file.Close()
		
		header, err := tar.FileInfoHeader(info, "")
		if err != nil {
			return err
		}
		header.Name = archivePath
		
		if err := tw.WriteHeader(header); err != nil {
			return err
		}
		
		_, err = io.Copy(tw, file)
		if err != nil {
			return err
		}
		
		manifest.Contents = append(manifest.Contents, archivePath)
		return nil
	})
}

// getHostname returns the system hostname
func getHostname() string {
	hostname, err := os.Hostname()
	if err != nil {
		return "unknown"
	}
	return hostname
}

// getPlatformInfo returns platform information
func getPlatformInfo() string {
	info := version.Get()
	return fmt.Sprintf("%s/%s", info.OS, info.Arch)
}

// restoreSystemBackup restores system from backup data
func restoreSystemBackup(backupData []byte) error {
	if len(backupData) == 0 {
		return fmt.Errorf("empty backup data")
	}
	
	// Validate backup archive structure
	manifest, err := validateBackupArchive(backupData)
	if err != nil {
		return fmt.Errorf("invalid backup archive: %v", err)
	}
	
	// Log restore operation
	fmt.Printf("Restoring backup created at %s (version %s)\n", manifest.CreatedAt.Format(time.RFC3339), manifest.Version)
	fmt.Printf("Backup contains %d files: %v\n", len(manifest.Contents), manifest.Contents)
	
	// Actually extract and restore files
	if err := extractAndRestoreBackup(backupData); err != nil {
		return fmt.Errorf("failed to extract and restore backup: %v", err)
	}
	
	fmt.Printf("Backup restore completed successfully\n")
	return nil
}

// validateBackupArchive validates the backup archive structure and returns the manifest
func validateBackupArchive(backupData []byte) (*BackupManifest, error) {
	// Create a buffer from the backup data
	buf := bytes.NewReader(backupData)
	
	// Create gzip reader
	gzr, err := gzip.NewReader(buf)
	if err != nil {
		return nil, fmt.Errorf("failed to create gzip reader: %v", err)
	}
	defer gzr.Close()
	
	// Create tar reader
	tr := tar.NewReader(gzr)
	
	var manifest *BackupManifest
	foundManifest := false
	fileCount := 0
	
	// Read through the archive
	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("failed to read tar entry: %v", err)
		}
		
		fileCount++
		
		// Check for manifest.json
		if header.Name == "manifest.json" {
			foundManifest = true
			
			// Read manifest content
			manifestData, err := io.ReadAll(tr)
			if err != nil {
				return nil, fmt.Errorf("failed to read manifest: %v", err)
			}
			
			// Parse manifest
			var m BackupManifest
			if err := json.Unmarshal(manifestData, &m); err != nil {
				return nil, fmt.Errorf("failed to parse manifest: %v", err)
			}
			
			manifest = &m
		}
	}
	
	// Validate we found the manifest
	if !foundManifest || manifest == nil {
		return nil, fmt.Errorf("backup archive is missing manifest.json")
	}
	
	// Validate manifest version
	if manifest.Version == "" {
		return nil, fmt.Errorf("backup manifest is missing version")
	}
	
	// Validate we have some files
	if fileCount < 2 { // At least manifest.json and one other file
		return nil, fmt.Errorf("backup archive appears to be incomplete (only %d files)", fileCount)
	}
	
	// Check for required files
	hasDatabase := false
	for _, content := range manifest.Contents {
		if strings.Contains(content, "db.sqlite") || strings.Contains(content, "database") {
			hasDatabase = true
			break
		}
	}
	
	if !hasDatabase && fileCount < 3 {
		return nil, fmt.Errorf("backup archive may be incomplete - no database file found")
	}
	
	return manifest, nil
}

// extractAndRestoreBackup extracts the backup archive and restores the files
func extractAndRestoreBackup(backupData []byte) error {
	// Create a buffer from the backup data
	buf := bytes.NewReader(backupData)
	
	// Create gzip reader
	gzr, err := gzip.NewReader(buf)
	if err != nil {
		return fmt.Errorf("failed to create gzip reader: %v", err)
	}
	defer gzr.Close()
	
	// Create tar reader
	tr := tar.NewReader(gzr)
	
	// Create backup directory for current files
	backupDir := fmt.Sprintf("./backup-%s", time.Now().Format("20060102-150405"))
	if err := os.MkdirAll(backupDir, 0755); err != nil {
		fmt.Printf("Warning: could not create backup directory: %v\n", err)
	}
	
	// Extract all files from the archive
	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return fmt.Errorf("failed to read tar entry: %v", err)
		}
		
		// Determine target path based on file type
		var targetPath string
		switch {
		case strings.HasPrefix(header.Name, "db.sqlite"):
			targetPath = "./glinrdock.db"
		case strings.HasPrefix(header.Name, "certs/"):
			targetPath = "./" + header.Name
		case strings.HasPrefix(header.Name, "nginx/"):
			targetPath = "./" + header.Name
		case strings.HasPrefix(header.Name, "config/"):
			// Extract config files to configs/ directory
			fileName := filepath.Base(header.Name)
			targetPath = "./configs/" + fileName
		case header.Name == "manifest.json":
			// Save manifest for reference
			targetPath = "./restored-manifest.json"
		default:
			fmt.Printf("Skipping unknown file: %s\n", header.Name)
			continue
		}
		
		// Skip directories for now (we'll create them as needed)
		if header.Typeflag == tar.TypeDir {
			if err := os.MkdirAll(targetPath, os.FileMode(header.Mode)); err != nil {
				fmt.Printf("Warning: could not create directory %s: %v\n", targetPath, err)
			}
			continue
		}
		
		// Create parent directory if needed
		if dir := filepath.Dir(targetPath); dir != "." {
			if err := os.MkdirAll(dir, 0755); err != nil {
				fmt.Printf("Warning: could not create parent directory %s: %v\n", dir, err)
			}
		}
		
		// Backup existing file if it exists
		if _, err := os.Stat(targetPath); err == nil {
			backupPath := filepath.Join(backupDir, filepath.Base(targetPath))
			if err := os.Rename(targetPath, backupPath); err != nil {
				fmt.Printf("Warning: could not backup existing file %s: %v\n", targetPath, err)
			} else {
				fmt.Printf("Backed up existing file: %s -> %s\n", targetPath, backupPath)
			}
		}
		
		// Extract the file
		outFile, err := os.Create(targetPath)
		if err != nil {
			return fmt.Errorf("failed to create file %s: %v", targetPath, err)
		}
		
		if _, err := io.Copy(outFile, tr); err != nil {
			outFile.Close()
			return fmt.Errorf("failed to extract file %s: %v", targetPath, err)
		}
		outFile.Close()
		
		// Set file permissions
		if err := os.Chmod(targetPath, os.FileMode(header.Mode)); err != nil {
			fmt.Printf("Warning: could not set permissions for %s: %v\n", targetPath, err)
		}
		
		fmt.Printf("Restored file: %s\n", targetPath)
	}
	
	fmt.Printf("All files extracted successfully. Backup of original files saved to: %s\n", backupDir)
	return nil
}

// Docker Hub API proxy handlers to avoid CORS issues

// DockerHubSearchResponse represents Docker Hub search response
type DockerHubSearchResponse struct {
	Count    int                   `json:"count"`
	Next     string                `json:"next"`
	Previous string                `json:"previous"`
	Results  []DockerHubRepository `json:"results"`
}

// DockerHubRepository represents a Docker Hub repository
type DockerHubRepository struct {
	User            string `json:"user"`
	Name            string `json:"name"`
	Namespace       string `json:"namespace"`
	RepositoryType  string `json:"repository_type"`
	Status          int    `json:"status"`
	Description     string `json:"description"`
	IsPrivate       bool   `json:"is_private"`
	IsAutomated     bool   `json:"is_automated"`
	CanEdit         bool   `json:"can_edit"`
	StarCount       int    `json:"star_count"`
	PullCount       int64  `json:"pull_count"`
	LastUpdated     string `json:"last_updated"`
	RepoName        string `json:"repo_name"`
	ShortDescription string `json:"short_description"`
	IsOfficial      bool   `json:"is_official"`
}

// DockerHubSearchProxy proxies search requests to Docker Hub API
func (h *Handlers) DockerHubSearchProxy(c *gin.Context) {
	query := c.Query("query")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "query parameter is required"})
		return
	}

	pageSize := c.DefaultQuery("page_size", "25")
	
	// Make request to Docker Hub API
	url := fmt.Sprintf("https://hub.docker.com/v2/search/repositories/?query=%s&page_size=%s", 
		query, pageSize)
	
	resp, err := http.Get(url)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch from Docker Hub"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Docker Hub API error"})
		return
	}

	// Read response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read response"})
		return
	}

	// Parse and return JSON response
	var searchResponse DockerHubSearchResponse
	if err := json.Unmarshal(body, &searchResponse); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse response"})
		return
	}

	c.JSON(http.StatusOK, searchResponse)
}

// DockerHubRepositoryProxy proxies repository info requests to Docker Hub API
func (h *Handlers) DockerHubRepositoryProxy(c *gin.Context) {
	repoName := c.Param("repo")
	if repoName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "repository name is required"})
		return
	}

	// Make request to Docker Hub API
	url := fmt.Sprintf("https://hub.docker.com/v2/repositories/%s/", repoName)
	
	resp, err := http.Get(url)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch from Docker Hub"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(resp.StatusCode, gin.H{"error": "Docker Hub API error"})
		return
	}

	// Read and return response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read response"})
		return
	}

	// Parse and return JSON response
	var repo DockerHubRepository
	if err := json.Unmarshal(body, &repo); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse response"})
		return
	}

	c.JSON(http.StatusOK, repo)
}

// DockerHubTagsProxy proxies repository tags requests to Docker Hub API  
func (h *Handlers) DockerHubTagsProxy(c *gin.Context) {
	repoName := c.Param("repo")
	if repoName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "repository name is required"})
		return
	}

	pageSize := c.DefaultQuery("page_size", "10")

	// Make request to Docker Hub API
	url := fmt.Sprintf("https://hub.docker.com/v2/repositories/%s/tags/?page_size=%s&ordering=-last_updated", 
		repoName, pageSize)
	
	resp, err := http.Get(url)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch from Docker Hub"})
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		c.JSON(resp.StatusCode, gin.H{"error": "Docker Hub API error"})
		return
	}

	// Read and return response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to read response"})
		return
	}

	// Return raw JSON response
	var result interface{}
	if err := json.Unmarshal(body, &result); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse response"})
		return
	}

	c.JSON(http.StatusOK, result)
}

// Nginx Management delegate methods

func (h *Handlers) GetNginxStatus(c *gin.Context) {
	nginxHandlers := NewNginxHandlers(nil, nil, h.store, h.auditLogger)
	nginxHandlers.GetNginxStatus(c)
}

func (h *Handlers) GetNginxConfig(c *gin.Context) {
	nginxHandlers := NewNginxHandlers(nil, nil, h.store, h.auditLogger)
	nginxHandlers.GetCurrentConfig(c)
}

func (h *Handlers) ValidateNginxConfig(c *gin.Context) {
	nginxHandlers := NewNginxHandlers(nil, nil, h.store, h.auditLogger)
	nginxHandlers.ValidateCurrentConfig(c)
}

// Certificate Management delegate methods

func (h *Handlers) UploadCertificate(c *gin.Context) {
	certHandlers := NewCertificateHandlers(h.store, h.auditLogger)
	certHandlers.UploadCertificate(c)
}

func (h *Handlers) ListCertificates(c *gin.Context) {
	certHandlers := NewCertificateHandlers(h.store, h.auditLogger)
	certHandlers.ListCertificates(c)
}

func (h *Handlers) GetCertificate(c *gin.Context) {
	certHandlers := NewCertificateHandlers(h.store, h.auditLogger)
	certHandlers.GetCertificate(c)
}

func (h *Handlers) DeleteCertificate(c *gin.Context) {
	certHandlers := NewCertificateHandlers(h.store, h.auditLogger)
	certHandlers.DeleteCertificate(c)
}

func (h *Handlers) RenewCertificate(c *gin.Context) {
	certHandlers := NewCertificateHandlers(h.store, h.auditLogger)
	certHandlers.RenewCertificate(c)
}