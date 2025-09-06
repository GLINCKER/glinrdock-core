package api

import (
	"github.com/GLINCKER/glinrdock/internal/api/middleware"
	"github.com/GLINCKER/glinrdock/internal/auth"
	"github.com/GLINCKER/glinrdock/internal/plan"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/GLINCKER/glinrdock/internal/web"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

// SetupRoutes configures API routes with middleware
func SetupRoutes(r *gin.Engine, handlers *Handlers, corsOrigins []string, authService *auth.AuthService, webHandlers *web.WebHandlers, planEnforcer *plan.Enforcer) {
	// Setup CORS if origins specified
	if len(corsOrigins) > 0 {
		config := cors.DefaultConfig()
		config.AllowOrigins = corsOrigins
		config.AllowHeaders = []string{"Origin", "Content-Length", "Content-Type", "Authorization"}
		r.Use(cors.New(config))
	}

	v1 := r.Group("/v1")
	{
		// Public endpoints
		v1.GET("/health", handlers.Health)
		v1.HEAD("/health", handlers.Health) // HEAD method for health checks
		v1.GET("/system", handlers.System)
		v1.GET("/system/config", authService.Middleware(), authService.RequireAdminRole(), handlers.SystemConfig) // System configuration (admin only)
		v1.GET("/system/metrics", handlers.SystemMetrics)
		v1.GET("/system/lockdown-status", handlers.GetLockdownStatus)
		v1.GET("/system/status", handlers.GetSystemStatus)
		v1.GET("/system/plan", authService.Middleware(), handlers.GetSystemPlan)
		v1.GET("/system/license", authService.Middleware(), handlers.GetLicenseStatus)
		v1.GET("/system/onboarding", handlers.GetOnboardingStatus)
		v1.POST("/system/onboarding/complete", authService.Middleware(), handlers.CompleteOnboarding)

		// Docker Hub proxy endpoints (public since they're just proxying external APIs)
		dockerhub := v1.Group("/dockerhub")
		{
			dockerhub.GET("/search", handlers.DockerHubSearchProxy)
			dockerhub.GET("/repo/*repo", handlers.DockerHubRepositoryProxy)
			dockerhub.GET("/tags/*repo", handlers.DockerHubTagsProxy)
		}

		// Authentication endpoints with rate limiting
		auth := v1.Group("/auth")
		authRateLimiter := middleware.NewAuthRateLimiter(middleware.DefaultAuthRateLimitConfig())
		auth.Use(middleware.AuthRateLimit(authRateLimiter))
		{
			auth.POST("/login", handlers.LoginHandler)
			auth.POST("/logout", handlers.LogoutHandler)

			// OAuth endpoints (no rate limiting needed for GitHub redirects)
			auth.GET("/github/login", handlers.GitHubLoginHandler)
			auth.GET("/github/callback", handlers.GitHubCallbackHandler)
			auth.POST("/oauth/logout", handlers.OAuthLogoutHandler)
		}

		// Protected endpoints
		protected := v1.Group("")
		protected.Use(authService.Middleware())
		protected.Use(LockdownMiddleware())
		{
			// Auth endpoints (require authentication)
			protected.GET("/auth/me", handlers.AuthMeHandler)
			protected.GET("/auth/info", handlers.AuthInfoHandler)

			// Token management (admin only)
			tokens := protected.Group("/tokens")
			tokens.Use(authService.RequireAdminRole())
			{
				tokens.POST("", handlers.CreateToken)
				tokens.GET("", handlers.ListTokens)
				tokens.DELETE("/:name", handlers.DeleteToken)
			}

			// Project management (admin, deployer can create/modify; viewer can read)
			projects := protected.Group("/projects")
			{
				projects.POST("", authService.RequireRole(store.RoleDeployer), handlers.CreateProject)
				projects.GET("", handlers.ListProjects)
				projects.GET("/:id", handlers.GetProject)
				projects.PUT("/:id", authService.RequireRole(store.RoleDeployer), handlers.UpdateProject)
				projects.DELETE("/:id", authService.RequireRole(store.RoleDeployer), handlers.DeleteProject)

				// Services within projects
				projects.POST("/:id/services", authService.RequireRole(store.RoleDeployer), handlers.CreateService)
				projects.GET("/:id/services", handlers.ListServices)

				// Routes for services within projects
				projects.POST("/:id/routes", authService.RequireRole(store.RoleDeployer), handlers.CreateServiceRoute)
				projects.GET("/:id/routes", handlers.ListServiceRoutes)
			}

			// Deployment templates and automation (deployer+ can deploy, all can view templates)
			deployment := protected.Group("/deploy")
			{
				// Template management - all authenticated users can view templates
				deployment.GET("/templates", handlers.deploymentHandlers.GetDeploymentTemplates)
				deployment.GET("/templates/:id", handlers.deploymentHandlers.GetDeploymentTemplate)

				// Auto-detection for repositories - all authenticated users can analyze
				deployment.POST("/detect", handlers.deploymentHandlers.AutoDetectProject)

				// Deployment execution - deployer+ only
				deployment.POST("", authService.RequireRole(store.RoleDeployer), handlers.deploymentHandlers.DeployService)
			}

			// Service management (admin, deployer can manage; viewer can read)
			services := protected.Group("/services")
			{
				// Service discovery (all authenticated users can view discovered services)
				services.GET("/discover", handlers.DiscoverUnmanagedServices)
				// Container adoption (deployer+ can adopt orphaned containers)
				services.POST("/adopt", authService.RequireRole(store.RoleDeployer), handlers.AdoptContainerHandler)
				// Container cleanup (deployer+ can remove orphaned containers)
				services.POST("/cleanup", authService.RequireRole(store.RoleDeployer), handlers.CleanupContainerHandler)

				services.GET("/:id", handlers.GetService)
				services.DELETE("/:id", authService.RequireRole(store.RoleDeployer), handlers.DeleteService)

				// Service configuration (viewer can read, deployer+ can edit)
				services.GET("/:id/config", handlers.GetServiceConfig)
				services.PUT("/:id/config", authService.RequireRole(store.RoleDeployer), handlers.UpdateServiceConfig)

				// Service environment (viewer can read actual Docker environment)
				services.GET("/:id/environment", handlers.GetServiceEnvironment)

				// Service lifecycle (admin, deployer only)
				services.POST("/:id/start", authService.RequireRole(store.RoleDeployer), handlers.StartServiceHandler)
				services.POST("/:id/stop", authService.RequireRole(store.RoleDeployer), handlers.StopServiceHandler)
				services.POST("/:id/restart", authService.RequireRole(store.RoleDeployer), handlers.RestartServiceHandler)

				// Service observability (all authenticated users)
				services.GET("/:id/logs", handlers.ServiceLogsHandler)          // WebSocket streaming
				services.GET("/:id/logs/tail", handlers.ServiceLogsTailHandler) // REST tail
				services.GET("/:id/stats", handlers.ServiceStatsHandler)

				// Service networking (all authenticated users can read, deployer+ can edit links)
				services.GET("/:id/network", handlers.GetServiceNetwork)
				services.GET("/:id/links", handlers.GetServiceLinks)
				services.POST("/:id/links", authService.RequireRole(store.RoleDeployer), handlers.UpdateServiceLinks)

				// Service health endpoints
				services.POST("/:id/health-check", authService.RequireRole(store.RoleDeployer), handlers.SetServiceHealthCheck)
				services.POST("/:id/health-check/run", handlers.RunHealthCheck)
				services.GET("/:id/health-check/debug", handlers.DebugServiceHealth) // Debug endpoint for troubleshooting
				services.POST("/:id/unlock", authService.RequireRole(store.RoleDeployer), handlers.UnlockService)

				// Service environment variables (viewer can read with masking, deployer+ can modify)
				services.GET("/:id/env-vars", handlers.GetServiceEnvVars)
				services.PUT("/:id/env-vars", authService.RequireRole(store.RoleDeployer), handlers.SetServiceEnvVar)
				services.POST("/:id/env-vars/bulk", authService.RequireRole(store.RoleDeployer), handlers.BulkUpdateServiceEnvVars)
				services.DELETE("/:id/env-vars/:key", authService.RequireRole(store.RoleDeployer), handlers.DeleteServiceEnvVar)
			}

			// Route management (admin, deployer can manage; viewer can read)
			routes := protected.Group("/routes")
			{
				routes.GET("/:id", handlers.GetRoute)
				routes.PUT("/:id", authService.RequireRole(store.RoleDeployer), handlers.UpdateRoute)
				routes.DELETE("/:id", authService.RequireRole(store.RoleDeployer), handlers.DeleteRoute)
				routes.GET("/:id/config", handlers.PreviewRouteConfig) // All authenticated users can preview
				routes.GET("", handlers.ListAllRoutes)                 // All authenticated users
			}

			// System management (admin only)
			system := protected.Group("/system")
			system.Use(authService.RequireAdminRole())
			{
				system.POST("/nginx/reload", handlers.ReloadNginx)
				system.GET("/nginx/status", handlers.GetNginxStatus)
				system.GET("/nginx/config", handlers.GetNginxConfig)
				system.POST("/nginx/validate", handlers.ValidateNginxConfig)
				system.POST("/lockdown", handlers.SystemLockdown)
				system.POST("/lift-lockdown", handlers.LiftLockdown)
				system.POST("/start", handlers.SystemStart)
				system.POST("/stop", handlers.SystemStop)
				system.POST("/emergency-restart", handlers.EmergencyRestart)
				system.GET("/logs", handlers.GetSystemLogs)
				system.GET("/log-paths", handlers.GetLogPaths)

				// Backup management
				system.POST("/backup", handlers.CreateBackup)
				system.POST("/restore", handlers.RestoreBackup)

				// License management
				system.POST("/license/activate", handlers.ActivateLicense)
				system.POST("/license/deactivate", handlers.DeactivateLicense)
			}

			// Environment management (admin, deployer can manage; all users can read) - TODO: Re-enable when handlers are complete
			/*
				environments := protected.Group("/environments")
				{
					environments.GET("", handlers.ListEnvironments)
					environments.POST("", authService.RequireRole(store.RoleDeployer), handlers.CreateEnvironment)
					environments.GET("/:id", handlers.GetEnvironment)
					environments.PUT("/:id", authService.RequireRole(store.RoleDeployer), handlers.UpdateEnvironment)
					environments.DELETE("/:id", authService.RequireRole(store.RoleDeployer), handlers.DeleteEnvironment)
					environments.POST("/:id/duplicate", authService.RequireRole(store.RoleDeployer), handlers.DuplicateEnvironment)
					environments.POST("/:id/activate", authService.RequireRole(store.RoleDeployer), handlers.SetActiveEnvironment)
					environments.GET("/:id/variables", handlers.GetEnvironmentVariables)
					environments.GET("/:id/variables/merged", handlers.GetMergedEnvironmentVariables)
					environments.PUT("/:id/variables/:key", authService.RequireRole(store.RoleDeployer), handlers.SetEnvironmentVariable)
					environments.DELETE("/:id/variables/:key", authService.RequireRole(store.RoleDeployer), handlers.DeleteEnvironmentVariable)
					environments.PUT("/:id/variables", authService.RequireRole(store.RoleDeployer), handlers.BulkUpdateEnvironmentVariables)
				}
			*/

			// Registry management (admin can manage; deployer can list)
			registries := protected.Group("/registries")
			{
				registries.GET("", handlers.ListRegistries)                                                   // All authenticated users can list
				registries.GET("/types", handlers.GetValidRegistryTypes)                                      // All authenticated users can get types
				registries.POST("", authService.RequireAdminRole(), handlers.CreateRegistry)                  // Admin only
				registries.GET("/:id", handlers.GetRegistry)                                                  // All authenticated users can view
				registries.DELETE("/:id", authService.RequireAdminRole(), handlers.DeleteRegistry)            // Admin only
				registries.POST("/:id/test", authService.RequireAdminRole(), handlers.TestRegistryConnection) // Admin only
			}

			// Audit log (admin only)
			protected.GET("/audit", authService.RequireAdminRole(), handlers.GetAuditEntries)

			// Support bundle (admin only)
			protected.POST("/support/bundle", authService.RequireAdminRole(), handlers.GenerateSupportBundle)

			// Settings endpoints
			if handlers.settingsHandlers != nil {
				settings := protected.Group("/settings")
				{
					// All authenticated users can read settings (sampled audit)
					settings.GET("/integrations", handlers.settingsHandlers.GetIntegrations)
					// Only admin can update settings
					settings.PUT("/integrations", authService.RequireAdminRole(), handlers.settingsHandlers.UpdateIntegrations)
					// Helper endpoint for GitHub App installation URL
					settings.GET("/github/install-url", authService.RequireAdminRole(), handlers.settingsHandlers.GetGitHubInstallURL)
				}
			}

			// GitHub App integration endpoints (admin only)
			if handlers.githubAppHandlers != nil {
				github := protected.Group("/github")
				github.Use(authService.RequireAdminRole())
				{
					// Installation management
					github.GET("/installations", handlers.githubAppHandlers.GetInstallations)
					github.POST("/installations/sync", handlers.githubAppHandlers.SyncInstallations)

					// Repository management
					github.GET("/repositories", handlers.githubAppHandlers.GetRepositories)
					github.POST("/repos/:id/activate", handlers.githubAppHandlers.ActivateRepository)
					github.DELETE("/repos/:id/activate", handlers.githubAppHandlers.DeactivateRepository)

					// Webhook debugging
					github.GET("/webhook/events", handlers.githubAppHandlers.GetWebhookEvents)
				}
			}

			// Certificate management (admin only) - PRO+ only
			certs := protected.Group("/certs")
			certs.Use(authService.RequireAdminRole())
			certs.Use(middleware.FeatureGate(planEnforcer, "ssl_certs"))
			{
				certs.POST("/issue", handlers.IssueCert)
				certs.GET("", handlers.ListCerts)
				certs.POST("/:domain/renew", handlers.RenewCert)
				certs.GET("/:domain", handlers.GetCert)
				certs.GET("/:domain/status", handlers.GetCertStatus)
			}

			// New Certificate management API (admin only)
			certificates := protected.Group("/certificates")
			certificates.Use(authService.RequireAdminRole())
			{
				certificates.POST("", handlers.UploadCertificate)
				certificates.GET("", handlers.ListCertificates)
				certificates.GET("/:id", handlers.GetCertificate)
				certificates.DELETE("/:id", handlers.DeleteCertificate)
				certificates.POST("/:id/renew", handlers.RenewCertificate)
			}

			// Domain management API (admin only)
			if handlers.domainHandlers != nil {
				domains := protected.Group("/domains")
				domains.Use(authService.RequireAdminRole())
				{
					domains.POST("", handlers.domainHandlers.CreateDomain)
					domains.GET("", handlers.domainHandlers.ListDomains)
					domains.GET("/:id", handlers.domainHandlers.GetDomain)
					domains.POST("/:id/auto-configure", handlers.domainHandlers.AutoConfigureDomain)
					domains.POST("/:id/verify", handlers.domainHandlers.VerifyDomain)
					domains.POST("/:id/activate", handlers.domainHandlers.ActivateDomain)
				}
			}

			// DNS Provider management API (admin only)
			if handlers.dnsProviderHandlers != nil {
				dns := protected.Group("/dns")
				dns.Use(authService.RequireAdminRole())
				{
					providers := dns.Group("/providers")
					{
						providers.POST("", handlers.dnsProviderHandlers.CreateDNSProvider)
						providers.GET("", handlers.dnsProviderHandlers.ListDNSProviders)
						providers.GET("/:id", handlers.dnsProviderHandlers.GetDNSProvider)
						providers.DELETE("/:id", handlers.dnsProviderHandlers.DeleteDNSProvider)
					}
				}
			}

			// Nginx Proxy management API (admin only)
			nginx := protected.Group("/nginx")
			nginx.Use(authService.RequireAdminRole())
			{
				nginx.POST("/reload", handlers.ReloadNginx)
				nginx.GET("/status", handlers.GetNginxStatus)
				nginx.GET("/config", handlers.GetNginxConfig)
				nginx.POST("/validate", handlers.ValidateNginxConfig)
			}

			// Client management (admin can read; all authenticated can touch)
			clients := protected.Group("/clients")
			{
				clients.GET("", authService.RequireAdminRole(), handlers.ListClients)
				clients.POST("/touch", handlers.TouchClient)
				clients.DELETE("/:id", authService.RequireAdminRole(), handlers.DeleteClient)
			}

			// CI/CD endpoints (admin, deployer can manage; viewer can read) - PRO+ only
			cicd := protected.Group("/cicd")
			cicd.Use(middleware.FeatureGate(planEnforcer, "ci_integrations"))
			{
				// Builds
				cicd.POST("/services/:id/build", authService.RequireRole(store.RoleDeployer), handlers.TriggerBuild)
				cicd.GET("/services/:id/builds", handlers.ListBuilds)
				cicd.GET("/builds/:id", handlers.GetBuild)

				// Deployments
				cicd.POST("/services/:id/deploy", authService.RequireRole(store.RoleDeployer), handlers.TriggerDeployment)
				cicd.POST("/services/:id/rollback", authService.RequireRole(store.RoleDeployer), handlers.RollbackDeployment)
				cicd.GET("/services/:id/deployments", handlers.ListDeployments)
				cicd.GET("/deployments/:id", handlers.GetDeployment)

				// Jobs
				cicd.GET("/jobs/:id", handlers.GetJob)
			}

			// Direct endpoints for compatibility (non-CI/CD gated)
			builds := protected.Group("/builds")
			{
				builds.POST("", authService.RequireRole(store.RoleDeployer), handlers.TriggerDirectBuild)
				builds.GET("/:id", handlers.GetBuild)
			}

			deployments := protected.Group("/deployments")
			{
				deployments.POST("", authService.RequireRole(store.RoleDeployer), handlers.TriggerDirectDeployment)
				deployments.GET("/:id", handlers.GetDeployment)
			}

			// Search endpoints (all authenticated users)
			if handlers.searchHandlers != nil {
				search := protected.Group("/search")
				{
					search.GET("/status", handlers.searchHandlers.GetSearchStatus)
					search.GET("", handlers.searchHandlers.Search)
					search.GET("/suggest", handlers.searchHandlers.SearchSuggest)
					search.POST("/reindex", authService.RequireAdminRole(), handlers.searchHandlers.PostReindex)
				}
			}

			// Metrics endpoint (all authenticated users)
			protected.GET("/metrics", handlers.GetMetrics)
			protected.GET("/metrics/historical", handlers.GetHistoricalMetrics)
			protected.GET("/metrics/latest", handlers.GetLatestHistoricalMetrics)

			// Help documentation endpoints (all authenticated users)
			if handlers.helpHandlers != nil {
				help := protected.Group("/help")
				{
					help.GET("/manifest", handlers.helpHandlers.GetHelpManifest)
					help.POST("/reindex", authService.RequireAdminRole(), handlers.helpHandlers.ReindexHelp)
					// Specific routes for known document structures
					help.GET("/guides/:slug", handlers.helpHandlers.GetHelpDocumentNested)
					help.GET("/using/:slug", handlers.helpHandlers.GetHelpDocumentNested)
					help.GET("/integrations/:slug", handlers.helpHandlers.GetHelpDocumentNested)
					// Single-level documents
					help.GET("/:slug", handlers.helpHandlers.GetHelpDocument)
				}
			}
		}

		// Webhook endpoints
		webhooks := v1.Group("/webhooks")
		{
			// Public webhook endpoint (secured by signature)
			webhooks.POST("/github", handlers.GitHubWebhook)
			// GitHub App webhook endpoint
			webhooks.POST("/github/app", handlers.GitHubAppWebhook)
		}

		// Protected webhook management endpoints
		protected.GET("/webhooks", handlers.ListWebhookDeliveries)  // All authenticated users can view deliveries
		protected.GET("/webhooks/:id", handlers.GetWebhookDelivery) // All authenticated users can view delivery details
	}

	// Serve static files (always enabled for UI-Lite)
	r.Static("/static", "./web/static")

	// Serve UI-Lite assets directly under /assets for the SPA
	r.Static("/assets", "./web/static/ui-lite/assets")

	// Add UI-Lite SPA routes
	r.GET("/app/*filepath", func(c *gin.Context) {
		c.File("./web/static/ui-lite/index.html")
	})
	r.GET("/app", func(c *gin.Context) {
		c.Redirect(302, "/app/")
	})

	// Add web UI routes if web handlers provided (legacy HTMX UI)
	if webHandlers != nil {
		// Web UI routes (public for now, could add auth later)
		r.GET("/", webHandlers.Dashboard)
		r.GET("/routes", webHandlers.AllRoutes)
		r.GET("/system", webHandlers.SystemOverview)
		r.GET("/services/:id", webHandlers.ServiceDetail)

		// API endpoints for HTMX requests
		api := r.Group("/api")
		{
			api.GET("/projects", webHandlers.ProjectsList)
			api.GET("/services/all", webHandlers.ServicesList)
			api.GET("/services/:id/routes", webHandlers.RoutesList)
			api.GET("/system-status", webHandlers.SystemStatus)
		}

		// Form endpoints
		r.GET("/projects/new", webHandlers.ShowProjectForm)
		r.GET("/projects/:id/services/new", webHandlers.ShowServiceForm)
		r.GET("/services/:id/routes/new", webHandlers.ShowRouteForm)
	}
}
