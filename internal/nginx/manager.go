package nginx

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/rs/zerolog/log"
)

// Certificate type alias to work around import issues
type Certificate = store.Certificate

// storeInterface defines the methods needed from the store for nginx reconciliation
type storeInterface interface {
	GetLastUpdatedTimestamp(ctx context.Context) (time.Time, error)
	GetAllRoutesWithServices(ctx context.Context) ([]store.RouteWithService, error)
	ListCertificates(ctx context.Context) ([]store.Certificate, error)
	CreateNginxConfig(ctx context.Context, configHash, configContent string) (store.NginxConfig, error)
	GetNginxConfigByHash(ctx context.Context, configHash string) (store.NginxConfig, error)
	SetActiveNginxConfig(ctx context.Context, configID int64) error
}

// Manager handles nginx configuration and lifecycle
type Manager struct {
	nginxDirPath string
	confDirPath  string
	certsDirPath string
	enabled      bool
	validator    *Validator
	reloader     *Reloader
}

// NewManager creates a new nginx manager instance
func NewManager(dataDir string, enabled bool) *Manager {
	nginxDirPath := filepath.Join(dataDir, ".var", "nginx")
	return &Manager{
		nginxDirPath: nginxDirPath,
		confDirPath:  filepath.Join(nginxDirPath, "conf"),
		certsDirPath: filepath.Join(nginxDirPath, "certs"),
		enabled:      enabled,
		validator:    NewValidator(),
		reloader:     NewReloader(),
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

	// Validate the written configuration
	if err := m.validator.ValidateConfiguration(ctx, finalConfigPath); err != nil {
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