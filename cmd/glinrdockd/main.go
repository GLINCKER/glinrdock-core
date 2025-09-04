package main

import (
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/GLINCKER/glinrdock/internal/api"
	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/GLINCKER/glinrdock/internal/auth"
	planconfig "github.com/GLINCKER/glinrdock/internal/config"
	"github.com/GLINCKER/glinrdock/internal/crypto"
	"github.com/GLINCKER/glinrdock/internal/docker"
	"github.com/GLINCKER/glinrdock/internal/dockerx"
	"github.com/GLINCKER/glinrdock/internal/events"
	"github.com/GLINCKER/glinrdock/internal/license"
	"github.com/GLINCKER/glinrdock/internal/metrics"
	"github.com/GLINCKER/glinrdock/internal/nginx"
	"github.com/GLINCKER/glinrdock/internal/plan"
	"github.com/GLINCKER/glinrdock/internal/proxy"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/GLINCKER/glinrdock/internal/util"
	"github.com/GLINCKER/glinrdock/internal/web"
	"github.com/docker/docker/client"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// initializeOAuthFromSettings creates OAuth service from database settings
func initializeOAuthFromSettings(ctx context.Context, settingsHandlers *api.SettingsHandlers, stateStore auth.StateStore, config *util.Config, store *store.Store) *auth.OAuthService {
	if settingsHandlers == nil {
		log.Warn().Msg("settings handlers not available - OAuth disabled")
		return nil
	}

	// Get integrations config from settings
	integrationsConfig, err := settingsHandlers.GetSettingsService().GetIntegrationsConfig(ctx)
	if err != nil {
		if err.Error() != "not found" {
			log.Error().Err(err).Msg("failed to get integrations config")
		}
		// No OAuth configuration found - this is normal for fresh installs
		log.Info().Msg("GitHub OAuth not configured - using token authentication only")
		return nil
	}

	// Check if OAuth is configured and enabled
	if integrationsConfig.GitHubOAuth == nil || integrationsConfig.GitHubOAuth.Mode == "off" {
		log.Info().Msg("GitHub OAuth disabled - using token authentication only")
		return nil
	}

	oauthConfig := integrationsConfig.GitHubOAuth
	
	// Validate required configuration
	if oauthConfig.ClientID == "" {
		log.Warn().Msg("GitHub OAuth client ID not configured")
		return nil
	}
	
	if config.ExternalBaseURL == "" {
		log.Warn().Msg("External base URL not configured - OAuth disabled")
		return nil
	}
	
	if config.Secret == "" {
		log.Warn().Msg("Master secret not configured - OAuth disabled")
		return nil
	}

	// Get client secret for confidential mode - temporarily disabled
	// var clientSecret string
	// if oauthConfig.Mode == "confidential" {
	//	secret, err := settingsHandlers.GetSettingsService().GetGitHubOAuthSecret(ctx)
	//	if err != nil {
	//		log.Error().Err(err).Msg("failed to get GitHub OAuth client secret for confidential mode")
	//		return nil
	//	}
	//	clientSecret = secret
	// }

	// Create OAuth configuration - temporarily disabled
	// authOAuthConfig := auth.OAuthConfig{
	//	Mode:         oauthConfig.Mode,
	//	ClientID:     oauthConfig.ClientID,
	//	ClientSecret: clientSecret,
	//	BaseURL:      config.ExternalBaseURL,
	//	Secret:       config.Secret,
	// }

	// Create OAuth service with user store and state store - temporarily disabled
	// service := auth.NewOAuthService(authOAuthConfig, store, store)
	
	// OAuth service temporarily disabled
	// if service.IsConfigured() {
	//	log.Info().Str("mode", oauthConfig.Mode).Msg("GitHub OAuth authentication enabled")
	//	return service
	// }
	
	log.Warn().Msg("GitHub OAuth configuration validation failed")
	return nil
}

func main() {
	// Load configuration
	config := util.LoadConfig()

	// Setup logging
	util.SetupLogger(config.LogLevel)

	// Validate or generate encryption key for secrets at rest
	if _, err := crypto.LoadMasterKeyFromEnv(); err != nil {
		log.Warn().Err(err).Msg("GLINRDOCK_SECRET not configured - secret environment variables will not be available")
		log.Warn().Msg("To enable secret environment variables, set GLINRDOCK_SECRET to a base64-encoded 32-byte key")
		log.Warn().Msg("Generate a key with: openssl rand -base64 32")
	} else {
		log.Info().Msg("encryption key loaded successfully - secret environment variables are available")
	}

	// Set Gin to release mode
	gin.SetMode(gin.ReleaseMode)

	// Open store
	storeInstance, err := store.Open(config.DataDir)
	if err != nil {
		log.Fatal().Err(err).Msg("failed to open store")
	}
	defer storeInstance.Close()

	// Run migrations
	ctx := context.Background()
	if err := storeInstance.Migrate(ctx); err != nil {
		log.Fatal().Err(err).Msg("failed to migrate store")
	}

	// Setup authentication service
	authService := auth.NewAuthService(storeInstance)

	// Setup OAuth service from settings (will be configured after settings handlers are created)
	var oauthService *auth.OAuthService

	// Bootstrap admin token if needed
	if err := authService.BootstrapAdminToken(ctx, config.AdminToken); err != nil {
		log.Fatal().Err(err).Msg("failed to bootstrap admin token")
	}

	// Create Docker client (mock for now)
	dockerClient := dockerx.NewMockClient()

	// Create Docker engine (try real engine, fallback to mock)
	var dockerEngine api.DockerEngine
	var dockerClientForEvents *client.Client
	if mobyEngine, err := dockerx.NewMobyEngine(storeInstance.RegistryStore); err != nil {
		log.Warn().Err(err).Msg("failed to connect to Docker, using mock engine")
		dockerEngine = dockerx.NewMockEngine()
		dockerClientForEvents = nil
	} else {
		dockerEngine = mobyEngine
		// Create a separate Docker client for event monitoring
		if cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation()); err != nil {
			log.Warn().Err(err).Msg("failed to create Docker client for events")
			dockerClientForEvents = nil
		} else {
			dockerClientForEvents = cli
		}
	}

	// Create NetworkManager for Docker networking
	var networkManager *docker.NetworkManager
	if dockerClientForEvents != nil {
		networkManager = docker.NewNetworkManager(dockerClientForEvents)
	} else {
		// For mock mode, use nil - network operations will be no-ops
		networkManager = nil
	}

	// Setup event cache and monitoring
	eventCache := events.NewEventCache()
	if dockerClientForEvents != nil {
		eventMonitor := events.NewDockerEventMonitor(dockerClientForEvents, eventCache)
		if err := eventMonitor.Start(ctx); err != nil {
			log.Error().Err(err).Msg("failed to start Docker event monitor")
		} else {
			log.Info().Msg("Docker event monitor started")
		}
	}

	// Initialize metrics collection
	metrics.InitGlobal()
	log.Info().Msg("metrics collector initialized")

	// Initialize nginx manager
	nginxManager := nginx.NewManager(config.DataDir, config.NginxProxyEnabled)
	if err := nginxManager.Initialize(ctx); err != nil {
		log.Error().Err(err).Msg("failed to initialize nginx manager")
	}

	// Setup nginx configuration if enabled
	var nginxConfig *proxy.NginxConfig
	var certHandlers *api.CertHandlers
	if config.NginxProxyEnabled {
		nginxConfig = proxy.NewNginxConfig("/etc/nginx/nginx.conf", config.DataDir, storeInstance)
		// Initialize certificate handlers for nginx proxy
		certHandlers = api.NewCertHandlers(storeInstance, nil, nginxConfig) // TODO: Add job queue
		log.Info().Msg("nginx proxy enabled")
	} else {
		log.Info().Msg("nginx proxy disabled - routes will use host-bound ports")
	}

	// Setup metrics handlers
	metricsHandlers := api.NewMetricsHandlers(metrics.DefaultCollector, storeInstance)
	
	// Setup and start historical metrics collection
	historyCollector := metrics.NewHistoryCollector(storeInstance, 30*time.Second)
	go historyCollector.Start(context.Background())

	// Setup and start nginx reconcile loop if enabled
	if config.NginxProxyEnabled {
		nginxGenerator := nginx.NewGenerator("", "")
		go nginxManager.Reconcile(context.Background(), storeInstance, nginxGenerator)
		log.Info().Msg("nginx reconcile loop started")
	}

	// Setup license manager (for now, use a placeholder public key - should be from env or config)
	// TODO: Get this from environment variable or configuration
	pubKey := "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=" // Placeholder - replace with actual public key
	licenseManager, err := license.NewManager(pubKey, config.DataDir)
	if err != nil {
		log.Warn().Err(err).Msg("failed to initialize license manager, using config-only plan enforcement")
		licenseManager = nil
	}

	// Setup audit logger
	auditLogger := audit.New(storeInstance)

	// Setup webhook handlers
	webhookSecret := os.Getenv("WEBHOOK_SECRET") // Optional webhook HMAC secret
	githubAppWebhookSecret := config.GitHubAppWebhookSecret
	webhookHandlers := api.NewWebhookHandlers(storeInstance, auditLogger, webhookSecret, githubAppWebhookSecret)

	// Setup GitHub App handlers
	githubHandlers, err := api.NewGitHubHandlers(storeInstance, config)
	if err != nil {
		log.Warn().Err(err).Msg("failed to initialize GitHub App handlers")
		githubHandlers = nil
	}

	// Setup settings handlers
	settingsHandlers := api.NewSettingsHandlers(storeInstance, auditLogger)

	// Setup search handlers
	searchHandlers := api.NewSearchHandlers(storeInstance, auditLogger)

	// Setup help handlers
	helpHandlers := api.NewHelpHandlers(auditLogger)

	// Initialize OAuth service from settings - temporarily disabled due to interface mismatch
	// oauthService = initializeOAuthFromSettings(ctx, settingsHandlers, storeInstance, config, storeInstance)
	// if oauthService != nil {
	//	authService.SetOAuthService(oauthService)
	// }
	oauthService = nil

	// Setup plan configuration and enforcer
	planConf := planconfig.NewPlanConfig()
	var currentLicense *license.License
	if licenseManager != nil {
		currentLicense = licenseManager.Current()
	}
	planEnforcer := plan.NewWithLicenseFallback(currentLicense, planConf)
	log.Info().Str("plan", planConf.Plan.String()).
		Interface("limits", planConf.Limits).
		Msg("plan enforcer initialized")

	// Setup handlers with all required dependencies  
	// Note: storeInstance implements multiple store interfaces, hence the repetition
	handlers := api.NewHandlers(
		dockerClient,
		storeInstance,    // main store for search indexing
		storeInstance,    // TokenStore
		storeInstance,    // ProjectStore  
		storeInstance,    // ServiceStore
		storeInstance,    // RouteStore
		storeInstance,    // EnvVarStore
		dockerEngine,
		nginxConfig,
		nil,              // cicdHandlers
		certHandlers,     // certHandlers
		metricsHandlers,
		webhookHandlers,
		planEnforcer,
		licenseManager,
		auditLogger,
		planConf,
		config,           // system config
		eventCache,
		storeInstance.EnvironmentStore,
		storeInstance.RegistryStore,
		networkManager,
		oauthService,
		githubHandlers,
		settingsHandlers,
		nil,              // githubAppHandlers
		searchHandlers,
		helpHandlers,
	)

	// Setup web handlers  
	var webHandlers *web.WebHandlers = nil
	log.Info().Msg("web UI enabled")

	// Setup router
	r := gin.New()
	r.Use(gin.Recovery())
	
	// Setup routes
	api.SetupRoutes(r, handlers, config.CORSOrigins, authService, webHandlers, planEnforcer)

	// Create HTTP server
	srv := &http.Server{
		Addr:    config.HTTPAddr,
		Handler: r,
	}

	log.Info().Str("addr", config.HTTPAddr).Msg("starting glinrdockd server")

	// Start server in goroutine
	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("server startup failed")
		}
	}()

	// Wait for interrupt signal for graceful shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Info().Msg("shutting down server...")

	// Create shutdown context with timeout
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Fatal().Err(err).Msg("server forced to shutdown")
	}

	log.Info().Msg("server exited")
}