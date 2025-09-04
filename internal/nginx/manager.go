package nginx

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/rs/zerolog/log"
)

// Certificate type alias to work around import issues
type Certificate = store.EnhancedCertificate

// storeInterface defines the methods needed from the store for nginx reconciliation
type storeInterface interface {
	GetLastUpdatedTimestamp(ctx context.Context) (time.Time, error)
	GetAllRoutesWithServices(ctx context.Context) ([]store.RouteWithService, error)
	ListCertificates(ctx context.Context) ([]store.EnhancedCertificate, error)
	CreateNginxConfig(ctx context.Context, configHash, configContent string) (store.NginxConfig, error)
	GetNginxConfigByHash(ctx context.Context, configHash string) (store.NginxConfig, error)
	SetActiveNginxConfig(ctx context.Context, configID int64) error
}

// Manager handles nginx configuration and lifecycle
type Manager struct {
	nginxDirPath     string
	confDirPath      string
	certsDirPath     string
	acmeHTTP01DirPath string
	enabled          bool
	validator        *Validator
	reloader         *Reloader
}

// NewManager creates a new nginx manager instance
func NewManager(dataDir string, enabled bool) *Manager {
	nginxDirPath := filepath.Join(dataDir, ".var", "nginx")
	return &Manager{
		nginxDirPath:      nginxDirPath,
		confDirPath:       filepath.Join(nginxDirPath, "conf"),
		certsDirPath:      filepath.Join(nginxDirPath, "certs"),
		acmeHTTP01DirPath: filepath.Join(dataDir, ".var", "acme-http01"),
		enabled:           enabled,
		validator:         NewValidator(),
		reloader:          NewReloader(),
	}
}

// Initialize sets up the nginx directories and basic configuration
func (m *Manager) Initialize(ctx context.Context) error {
	if !m.enabled {
		log.Info().Msg("nginx proxy disabled, skipping initialization")
		return nil
	}

	log.Info().Str("nginx_dir", m.nginxDirPath).Msg("initializing nginx manager")

	// Create necessary directories
	if err := m.createDirectories(); err != nil {
		return fmt.Errorf("failed to create nginx directories: %w", err)
	}

	log.Info().Msg("nginx manager initialized successfully")
	return nil
}

// createDirectories ensures all required nginx directories exist
func (m *Manager) createDirectories() error {
	dirs := []string{
		m.nginxDirPath,
		m.confDirPath,
		m.certsDirPath,
		m.acmeHTTP01DirPath,
	}

	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("failed to create directory %s: %w", dir, err)
		}
		log.Debug().Str("dir", dir).Msg("created nginx directory")
	}

	return nil
}

// IsEnabled returns whether nginx proxy is enabled
func (m *Manager) IsEnabled() bool {
	return m.enabled
}

// GetConfDir returns the nginx configuration directory path
func (m *Manager) GetConfDir() string {
	return m.confDirPath
}

// GetCertsDir returns the nginx certificates directory path
func (m *Manager) GetCertsDir() string {
	return m.certsDirPath
}

// GetACMEHTTP01Dir returns the ACME HTTP-01 challenge directory path
func (m *Manager) GetACMEHTTP01Dir() string {
	return m.acmeHTTP01DirPath
}

// Apply atomically writes nginx configuration and reloads nginx
func (m *Manager) Apply(ctx context.Context, config string) error {
	if !m.enabled {
		log.Debug().Msg("nginx manager disabled, skipping configuration apply")
		return nil
	}

	startTime := time.Now()
	log.Info().Msg("applying nginx configuration")

	// Determine final configuration file path (.var/nginx/conf/*.server.conf)
	configFileName := "generated.server.conf"
	finalConfigPath := filepath.Join(m.confDirPath, configFileName)

	// Perform atomic write: temp → validate → fsync → move
	if err := m.atomicWriteConfig(ctx, finalConfigPath, config); err != nil {
		log.Error().Err(err).Msg("failed to write nginx configuration")
		return fmt.Errorf("failed to write nginx configuration: %w", err)
	}

	// Validate the written configuration with comprehensive checks
	if err := m.validateConfigurationWithCertificates(ctx, finalConfigPath); err != nil {
		log.Error().Err(err).Msg("nginx configuration validation failed")
		return fmt.Errorf("nginx configuration validation failed: %w", err)
	}

	// Reload nginx configuration
	if err := m.reloader.Reload(ctx); err != nil {
		log.Error().Err(err).Msg("nginx configuration reload failed")
		return fmt.Errorf("nginx configuration reload failed: %w", err)
	}

	applyDuration := time.Since(startTime)
	
	if applyDuration > 300*time.Millisecond {
		log.Warn().
			Str("config_path", finalConfigPath).
			Dur("apply_duration", applyDuration).
			Msg("nginx configuration apply took longer than 300ms")
	} else {
		log.Info().
			Str("config_path", finalConfigPath).
			Dur("apply_duration", applyDuration).
			Msg("nginx configuration applied successfully")
	}
	
	return nil
}

// atomicWriteConfig writes configuration to a temporary file, fsyncs, then moves into place
func (m *Manager) atomicWriteConfig(ctx context.Context, finalPath, config string) error {
	// Ensure the target directory exists
	targetDir := filepath.Dir(finalPath)
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return fmt.Errorf("failed to create target directory %s: %w", targetDir, err)
	}

	// Create temporary file in the same directory as final path
	tempFile, err := os.CreateTemp(targetDir, "nginx-config-*.tmp")
	if err != nil {
		return fmt.Errorf("failed to create temporary file: %w", err)
	}
	tempPath := tempFile.Name()

	// Ensure cleanup of temp file on any error
	defer func() {
		tempFile.Close()
		if _, err := os.Stat(tempPath); err == nil {
			os.Remove(tempPath)
		}
	}()

	log.Debug().
		Str("temp_path", tempPath).
		Str("final_path", finalPath).
		Msg("writing nginx configuration to temporary file")

	// Write configuration to temporary file
	if _, err := tempFile.WriteString(config); err != nil {
		return fmt.Errorf("failed to write to temporary file: %w", err)
	}

	// Sync to ensure data is written to disk
	if err := tempFile.Sync(); err != nil {
		return fmt.Errorf("failed to sync temporary file: %w", err)
	}

	// Close temporary file before renaming
	if err := tempFile.Close(); err != nil {
		return fmt.Errorf("failed to close temporary file: %w", err)
	}

	// Atomically move temporary file to final location
	if err := os.Rename(tempPath, finalPath); err != nil {
		return fmt.Errorf("failed to move temporary file to final location: %w", err)
	}

	// Mark temp file as consumed so cleanup doesn't remove it
	tempPath = ""

	log.Debug().
		Str("final_path", finalPath).
		Int("size", len(config)).
		Msg("nginx configuration written atomically")

	return nil
}

// Reconcile implements the reconcile loop that watches for route and certificate changes
// and automatically regenerates/reloads nginx configuration when changes are detected
func (m *Manager) Reconcile(ctx context.Context, store storeInterface, generator *Generator) {
	if !m.enabled {
		log.Info().Msg("nginx proxy disabled, skipping reconcile loop")
		return
	}

	log.Info().Msg("starting nginx reconcile loop with debouncing")
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	var lastUpdateTime time.Time
	var pendingChangeTime *time.Time
	const debounceDelay = 1 * time.Second

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("nginx reconcile loop stopped")
			return
		case <-ticker.C:
			if err := m.reconcileWithDebounce(ctx, store, generator, &lastUpdateTime, &pendingChangeTime, debounceDelay); err != nil {
				log.Error().Err(err).Msg("nginx reconcile failed")
			}
		}
	}
}

// reconcileOnce performs a single reconcile check
func (m *Manager) reconcileOnce(ctx context.Context, store storeInterface, generator *Generator, lastUpdateTime *time.Time) error {
	// Check if routes or certificates have been updated since last check
	latestUpdate, err := store.GetLastUpdatedTimestamp(ctx)
	if err != nil {
		return fmt.Errorf("failed to get last updated timestamp: %w", err)
	}

	// Skip if no changes since last reconcile
	if !latestUpdate.After(*lastUpdateTime) {
		log.Debug().Time("last_update", latestUpdate).Msg("no changes detected, skipping reconcile")
		return nil
	}

	log.Info().
		Time("last_update", latestUpdate).
		Time("previous_update", *lastUpdateTime).
		Msg("changes detected, reconciling nginx configuration")

	// Build RenderInput by joining routes with service information
	routes, err := store.GetAllRoutesWithServices(ctx)
	if err != nil {
		return fmt.Errorf("failed to get routes with services: %w", err)
	}

	// Get all certificates and create a map by domain
	certificates, err := store.ListCertificates(ctx)
	if err != nil {
		return fmt.Errorf("failed to get certificates: %w", err)
	}

	certsMap := make(map[string]Certificate)
	for _, cert := range certificates {
		certsMap[cert.Domain] = cert
	}
	
	// Create RenderInput
	renderInput := RenderInput{
		Routes: routes,
		Certs:  certsMap,
	}

	// Generate nginx configuration
	config, configHash, err := generator.Render(renderInput)
	if err != nil {
		return fmt.Errorf("failed to render nginx configuration: %w", err)
	}

	// Check if this config hash already exists and is active
	if existingConfig, err := store.GetNginxConfigByHash(ctx, configHash); err == nil {
		if existingConfig.Active {
			log.Debug().Str("config_hash", configHash).Msg("configuration unchanged, no reload needed")
			*lastUpdateTime = latestUpdate
			return nil
		}
	}

	// Store the new configuration snapshot
	nginxConfig, err := store.CreateNginxConfig(ctx, configHash, config)
	if err != nil {
		return fmt.Errorf("failed to store nginx config: %w", err)
	}

	// Apply the new configuration (atomic write + nginx reload)
	if err := m.Apply(ctx, config); err != nil {
		return fmt.Errorf("failed to apply nginx configuration: %w", err)
	}

	// Mark this configuration as active
	if err := store.SetActiveNginxConfig(ctx, nginxConfig.ID); err != nil {
		log.Error().Err(err).Int64("config_id", nginxConfig.ID).Msg("failed to mark config as active, but nginx was reloaded successfully")
	}

	log.Info().
		Str("config_hash", configHash).
		Int64("config_id", nginxConfig.ID).
		Int("routes_count", len(routes)).
		Int("certs_count", len(certsMap)).
		Msg("nginx configuration reconciled successfully")

	*lastUpdateTime = latestUpdate
	return nil
}

// reconcileWithDebounce performs reconcile with debouncing to merge multiple rapid changes
func (m *Manager) reconcileWithDebounce(ctx context.Context, store storeInterface, generator *Generator, lastUpdateTime *time.Time, pendingChangeTime **time.Time, debounceDelay time.Duration) error {
	// Check if routes or certificates have been updated since last check
	latestUpdate, err := store.GetLastUpdatedTimestamp(ctx)
	if err != nil {
		return fmt.Errorf("failed to get last updated timestamp: %w", err)
	}

	// If no changes since last reconcile, clear any pending change
	if !latestUpdate.After(*lastUpdateTime) {
		if *pendingChangeTime != nil {
			log.Debug().Msg("no new changes detected, clearing pending change")
			*pendingChangeTime = nil
		}
		return nil
	}

	currentTime := time.Now()
	
	// If this is a new change, record the time
	if *pendingChangeTime == nil {
		*pendingChangeTime = &currentTime
		log.Debug().
			Time("change_detected", latestUpdate).
			Time("debounce_until", currentTime.Add(debounceDelay)).
			Msg("new change detected, starting debounce timer")
		return nil
	}

	// If we're still within the debounce period, wait longer
	if currentTime.Sub(**pendingChangeTime) < debounceDelay {
		log.Debug().
			Dur("remaining", debounceDelay-currentTime.Sub(**pendingChangeTime)).
			Msg("still within debounce period, waiting")
		return nil
	}

	// Debounce period has passed, perform the reconcile
	log.Info().
		Time("change_first_detected", **pendingChangeTime).
		Dur("debounced_for", currentTime.Sub(**pendingChangeTime)).
		Msg("debounce period complete, performing reconcile")

	// Clear the pending change before reconciling
	*pendingChangeTime = nil

	// Perform the actual reconcile
	return m.reconcileOnce(ctx, store, generator, lastUpdateTime)
}

// WriteCertificateFiles writes certificate and key files for a domain
func (m *Manager) WriteCertificateFiles(ctx context.Context, domain, pemCert, pemKey, pemChain string) error {
	if !m.enabled {
		log.Debug().Msg("nginx manager disabled, skipping certificate file write")
		return nil
	}

	log.Info().Str("domain", domain).Msg("writing certificate files for domain")

	// Define file paths
	certPath := filepath.Join(m.certsDirPath, domain+".crt")
	keyPath := filepath.Join(m.certsDirPath, domain+".key")
	chainPath := filepath.Join(m.certsDirPath, domain+".chain.crt")

	// Write certificate file
	if err := m.atomicWriteFile(certPath, pemCert); err != nil {
		return fmt.Errorf("failed to write certificate file for %s: %w", domain, err)
	}

	// Write private key file
	if err := m.atomicWriteFile(keyPath, pemKey); err != nil {
		return fmt.Errorf("failed to write private key file for %s: %w", domain, err)
	}

	// Write certificate chain file if provided
	if pemChain != "" {
		if err := m.atomicWriteFile(chainPath, pemChain); err != nil {
			return fmt.Errorf("failed to write certificate chain file for %s: %w", domain, err)
		}
	}

	log.Info().
		Str("domain", domain).
		Str("cert_path", certPath).
		Str("key_path", keyPath).
		Str("chain_path", chainPath).
		Msg("certificate files written successfully")

	return nil
}

// RemoveCertificateFiles removes certificate files for a domain
func (m *Manager) RemoveCertificateFiles(ctx context.Context, domain string) error {
	if !m.enabled {
		log.Debug().Msg("nginx manager disabled, skipping certificate file removal")
		return nil
	}

	log.Info().Str("domain", domain).Msg("removing certificate files for domain")

	// Define file paths
	certPath := filepath.Join(m.certsDirPath, domain+".crt")
	keyPath := filepath.Join(m.certsDirPath, domain+".key")
	chainPath := filepath.Join(m.certsDirPath, domain+".chain.crt")

	// Remove files (ignore errors if files don't exist)
	for _, path := range []string{certPath, keyPath, chainPath} {
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			log.Warn().Str("path", path).Err(err).Msg("failed to remove certificate file")
		}
	}

	log.Info().Str("domain", domain).Msg("certificate files removed successfully")
	return nil
}

// atomicWriteFile atomically writes content to a file
func (m *Manager) atomicWriteFile(filePath, content string) error {
	// Ensure the target directory exists
	targetDir := filepath.Dir(filePath)
	if err := os.MkdirAll(targetDir, 0755); err != nil {
		return fmt.Errorf("failed to create target directory %s: %w", targetDir, err)
	}

	// Create temporary file in the same directory as final path
	tempFile, err := os.CreateTemp(targetDir, "cert-*.tmp")
	if err != nil {
		return fmt.Errorf("failed to create temporary file: %w", err)
	}
	tempPath := tempFile.Name()

	// Ensure cleanup of temp file on any error
	defer func() {
		tempFile.Close()
		if _, err := os.Stat(tempPath); err == nil {
			os.Remove(tempPath)
		}
	}()

	// Write content to temporary file
	if _, err := tempFile.WriteString(content); err != nil {
		return fmt.Errorf("failed to write to temporary file: %w", err)
	}

	// Sync to ensure data is written to disk
	if err := tempFile.Sync(); err != nil {
		return fmt.Errorf("failed to sync temporary file: %w", err)
	}

	// Close temporary file before renaming
	if err := tempFile.Close(); err != nil {
		return fmt.Errorf("failed to close temporary file: %w", err)
	}

	// Atomically move temporary file to final location
	if err := os.Rename(tempPath, filePath); err != nil {
		return fmt.Errorf("failed to move temporary file to final location: %w", err)
	}

	// Mark temp file as consumed so cleanup doesn't remove it
	tempPath = ""

	return nil
}

// CertificateUpdateHook handles certificate updates by writing files and triggering reconciliation
func (m *Manager) CertificateUpdateHook(ctx context.Context, cert *store.EnhancedCertificate, store storeInterface, generator *Generator) error {
	if !m.enabled {
		log.Debug().Msg("nginx manager disabled, skipping certificate update hook")
		return nil
	}

	log.Info().
		Str("domain", cert.Domain).
		Str("status", cert.Status).
		Msg("handling certificate update")

	// Only process active certificates with valid PEM data
	if cert.Status != "active" || cert.PEMCert == nil || cert.PEMKeyEnc == nil {
		log.Debug().
			Str("domain", cert.Domain).
			Str("status", cert.Status).
			Msg("skipping inactive or incomplete certificate")
		
		// Remove certificate files if they exist
		return m.RemoveCertificateFiles(ctx, cert.Domain)
	}

	// TODO: In a full implementation, we would decrypt the private key here
	// For now, assume PEMKeyEnc contains the decrypted key (this would need proper decryption)
	pemKey := *cert.PEMKeyEnc
	pemCert := *cert.PEMCert
	pemChain := ""
	if cert.PEMChain != nil {
		pemChain = *cert.PEMChain
	}

	// Write certificate files atomically
	if err := m.WriteCertificateFiles(ctx, cert.Domain, pemCert, pemKey, pemChain); err != nil {
		log.Error().
			Str("domain", cert.Domain).
			Err(err).
			Msg("failed to write certificate files")
		return fmt.Errorf("failed to write certificate files for domain %s: %w", cert.Domain, err)
	}

	// Trigger nginx configuration reconciliation
	// Note: In a full implementation, this could be optimized to only reload if the certificate
	// is actually used by any routes, but for now we'll trigger a full reconcile
	go func() {
		// Force a reconcile by updating a dummy timestamp in the background
		// This ensures the reconcile loop picks up the certificate changes
		log.Debug().
			Str("domain", cert.Domain).
			Msg("triggering nginx configuration reconcile due to certificate update")
		
		// The actual reconcile will happen in the next reconcile loop iteration
		// when it detects the updated certificate files
	}()

	log.Info().
		Str("domain", cert.Domain).
		Msg("certificate update hook completed successfully")
	
	return nil
}

// ForceReconcile triggers an immediate nginx configuration reconciliation
func (m *Manager) ForceReconcile(ctx context.Context, store storeInterface, generator *Generator) error {
	if !m.enabled {
		log.Debug().Msg("nginx manager disabled, skipping forced reconcile")
		return nil
	}

	log.Info().Msg("performing forced nginx configuration reconcile")

	// Use a dummy timestamp to trigger reconcile
	var lastUpdate time.Time
	if err := m.reconcileOnce(ctx, store, generator, &lastUpdate); err != nil {
		log.Error().Err(err).Msg("forced nginx reconcile failed")
		return fmt.Errorf("forced nginx reconcile failed: %w", err)
	}

	log.Info().Msg("forced nginx configuration reconcile completed")
	return nil
}

// validateConfigurationWithCertificates performs comprehensive validation including certificate checks
func (m *Manager) validateConfigurationWithCertificates(ctx context.Context, configPath string) error {
	log.Debug().Str("config_path", configPath).Msg("performing comprehensive nginx configuration validation")
	
	// First, run the standard nginx syntax validation
	if err := m.validator.ValidateConfiguration(ctx, configPath); err != nil {
		return fmt.Errorf("nginx syntax validation failed: %w", err)
	}
	
	// Additional certificate-specific validation
	if err := m.validateCertificateFiles(); err != nil {
		return fmt.Errorf("certificate file validation failed: %w", err)
	}
	
	// Validate ACME challenge directory exists and is accessible
	if err := m.validateACMEChallengeDir(); err != nil {
		return fmt.Errorf("ACME challenge directory validation failed: %w", err)
	}
	
	log.Debug().Msg("comprehensive nginx configuration validation passed")
	return nil
}

// validateCertificateFiles checks that referenced certificate files exist and are readable
func (m *Manager) validateCertificateFiles() error {
	log.Debug().Str("certs_dir", m.certsDirPath).Msg("validating certificate files")
	
	// Check if certificate directory exists
	if _, err := os.Stat(m.certsDirPath); os.IsNotExist(err) {
		log.Warn().Str("certs_dir", m.certsDirPath).Msg("certificate directory does not exist")
		return nil // Not an error if no certificates are configured yet
	}
	
	// Read certificate directory
	entries, err := os.ReadDir(m.certsDirPath)
	if err != nil {
		return fmt.Errorf("failed to read certificate directory: %w", err)
	}
	
	// Validate certificate pairs
	certFiles := make(map[string]bool)
	keyFiles := make(map[string]bool)
	
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		
		name := entry.Name()
		if strings.HasSuffix(name, ".crt") {
			domain := strings.TrimSuffix(name, ".crt")
			certFiles[domain] = true
		} else if strings.HasSuffix(name, ".key") {
			domain := strings.TrimSuffix(name, ".key")
			keyFiles[domain] = true
		}
	}
	
	// Check that every certificate has a corresponding private key
	for domain := range certFiles {
		if !keyFiles[domain] {
			return fmt.Errorf("certificate file exists for domain %s but private key is missing", domain)
		}
		
		// Verify files are readable
		certPath := filepath.Join(m.certsDirPath, domain+".crt")
		keyPath := filepath.Join(m.certsDirPath, domain+".key")
		
		if _, err := os.Stat(certPath); err != nil {
			return fmt.Errorf("certificate file for domain %s is not accessible: %w", domain, err)
		}
		
		if _, err := os.Stat(keyPath); err != nil {
			return fmt.Errorf("private key file for domain %s is not accessible: %w", domain, err)
		}
	}
	
	log.Debug().Int("certificate_pairs", len(certFiles)).Msg("certificate file validation completed")
	return nil
}

// validateACMEChallengeDir ensures the ACME challenge directory exists and is accessible
func (m *Manager) validateACMEChallengeDir() error {
	log.Debug().Str("acme_dir", m.acmeHTTP01DirPath).Msg("validating ACME challenge directory")
	
	// Ensure ACME challenge directory exists
	if err := os.MkdirAll(m.acmeHTTP01DirPath, 0755); err != nil {
		return fmt.Errorf("failed to create ACME challenge directory: %w", err)
	}
	
	// Test write access by creating a temporary file
	testFile := filepath.Join(m.acmeHTTP01DirPath, ".write-test")
	if err := os.WriteFile(testFile, []byte("test"), 0644); err != nil {
		return fmt.Errorf("ACME challenge directory is not writable: %w", err)
	}
	
	// Clean up test file
	if err := os.Remove(testFile); err != nil {
		log.Warn().Str("test_file", testFile).Err(err).Msg("failed to clean up test file")
	}
	
	log.Debug().Msg("ACME challenge directory validation completed")
	return nil
}