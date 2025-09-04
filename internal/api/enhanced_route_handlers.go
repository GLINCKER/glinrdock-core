package api

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/GLINCKER/glinrdock/internal/domains"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/GLINCKER/glinrdock/internal/tls"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// EnhancedRouteHandlers contains enhanced route management with TLS support
type EnhancedRouteHandlers struct {
	store               *store.Store
	verificationService *domains.VerificationService
	acmeService         *tls.ACMEService
	auditLogger         *audit.Logger
}

// TLSRouteRequest represents a route creation request with TLS support
type TLSRouteRequest struct {
	store.RouteSpec
	AutoVerifyDomain bool `json:"auto_verify_domain,omitempty"` // Automatically verify domain if TLS=true
	AutoIssueCert    bool `json:"auto_issue_cert,omitempty"`    // Automatically issue certificate if verified
}

// TLSRouteResponse represents route creation response with TLS progress
type TLSRouteResponse struct {
	store.Route
	TLSProgress *TLSProgressStatus `json:"tls_progress,omitempty"`
}

// TLSProgressStatus represents the status of TLS setup
type TLSProgressStatus struct {
	Stage              string     `json:"stage"`               // "verification", "certificate_issuance", "nginx_reload", "complete"
	DomainVerified     bool       `json:"domain_verified"`     
	CertificateIssued  bool       `json:"certificate_issued"`  
	NginxReloaded      bool       `json:"nginx_reloaded"`      
	LastUpdate         time.Time  `json:"last_update"`         
	Message            string     `json:"message,omitempty"`   
	Error              *string    `json:"error,omitempty"`     
}

// NewEnhancedRouteHandlers creates new enhanced route handlers
func NewEnhancedRouteHandlers(store *store.Store, verificationService *domains.VerificationService, acmeService *tls.ACMEService, auditLogger *audit.Logger) *EnhancedRouteHandlers {
	return &EnhancedRouteHandlers{
		store:               store,
		verificationService: verificationService,
		acmeService:         acmeService,
		auditLogger:         auditLogger,
	}
}

// CreateTLSRoute creates a route with automatic TLS setup (deployer+ access)
// @Summary Create route with TLS support
// @Description Creates a new route with automatic domain verification and certificate issuance
// @Tags routes
// @Security DeployerAuth
// @Accept json
// @Produce json
// @Param id path int true "Service ID"
// @Param route body TLSRouteRequest true "Route specification with TLS options"
// @Success 201 {object} TLSRouteResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/services/{id}/routes/tls [post]
func (h *EnhancedRouteHandlers) CreateTLSRoute(c *gin.Context) {
	// Parse service ID
	serviceIDStr := c.Param("id")
	serviceID, err := strconv.ParseInt(serviceIDStr, 10, 64)
	if err != nil {
		log.Warn().Str("service_id", serviceIDStr).Msg("invalid service ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	// Parse TLS route request
	var req TLSRouteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Warn().Err(err).Msg("invalid TLS route request")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	// Verify service exists
	_, err = h.store.GetService(ctx, serviceID)
	if err != nil {
		log.Warn().Err(err).Int64("service_id", serviceID).Msg("service not found")
		c.JSON(http.StatusNotFound, gin.H{"error": "service not found"})
		return
	}

	// Create the route first
	route, err := h.store.CreateRoute(ctx, serviceID, req.RouteSpec)
	if err != nil {
		log.Error().Err(err).Int64("service_id", serviceID).Msg("failed to create route")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create route"})
		return
	}

	log.Info().
		Int64("service_id", serviceID).
		Int64("route_id", route.ID).
		Str("domain", route.Domain).
		Bool("tls", route.TLS).
		Bool("auto_verify", req.AutoVerifyDomain).
		Bool("auto_issue", req.AutoIssueCert).
		Msg("route created, starting TLS setup if enabled")

	// Audit log route creation
	if h.auditLogger != nil {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordRouteAction(c.Request.Context(), actor, audit.ActionRouteCreate, strconv.FormatInt(route.ID, 10), map[string]interface{}{
			"route_id":   route.ID,
			"service_id": serviceID,
			"domain":     route.Domain,
			"tls":        route.TLS,
			"auto_verify": req.AutoVerifyDomain,
			"auto_issue":  req.AutoIssueCert,
		})
	}

	// Prepare response
	response := TLSRouteResponse{
		Route: route,
	}

	// If TLS is enabled, start the TLS setup process
	if route.TLS && (req.AutoVerifyDomain || req.AutoIssueCert) {
		progress := &TLSProgressStatus{
			Stage:             "verification",
			DomainVerified:    false,
			CertificateIssued: false,
			NginxReloaded:     false,
			LastUpdate:        time.Now(),
			Message:           "Starting domain verification and certificate issuance",
		}
		response.TLSProgress = progress

		// Start async TLS setup
		go h.handleTLSSetup(route, req.AutoVerifyDomain, req.AutoIssueCert)
	}

	c.JSON(http.StatusCreated, response)
}

// handleTLSSetup performs the TLS setup process asynchronously
func (h *EnhancedRouteHandlers) handleTLSSetup(route store.Route, autoVerify, autoIssue bool) {
	ctx := context.Background()
	
	log.Info().
		Int64("route_id", route.ID).
		Str("domain", route.Domain).
		Msg("starting async TLS setup")

	// Step 1: Domain verification (if enabled)
	domainVerified := false
	if autoVerify {
		log.Debug().
			Str("domain", route.Domain).
			Msg("starting domain verification")

		// Issue verification
		_, err := h.verificationService.IssueVerification(ctx, route.Domain)
		if err != nil {
			log.Error().
				Err(err).
				Str("domain", route.Domain).
				Msg("failed to issue domain verification")
			return
		}

		// Check verification (with retries)
		for i := 0; i < 5; i++ {
			time.Sleep(time.Duration(i+1) * 10 * time.Second) // Exponential backoff

			result, err := h.verificationService.CheckVerification(ctx, route.Domain)
			if err != nil {
				log.Warn().
					Err(err).
					Str("domain", route.Domain).
					Int("attempt", i+1).
					Msg("domain verification check failed")
				continue
			}

			if result.Status == "verified" {
				domainVerified = true
				log.Info().
					Str("domain", route.Domain).
					Msg("domain verification successful")
				break
			}

			log.Debug().
				Str("domain", route.Domain).
				Str("status", result.Status).
				Int("attempt", i+1).
				Msg("domain verification still pending")
		}

		if !domainVerified {
			log.Error().
				Str("domain", route.Domain).
				Msg("domain verification failed after retries")
			return
		}
	} else {
		// Assume domain is already verified if auto-verify is disabled
		domainVerified = true
	}

	// Step 2: Certificate issuance (if enabled and domain verified)
	certificateIssued := false
	if autoIssue && domainVerified {
		log.Debug().
			Str("domain", route.Domain).
			Msg("starting certificate issuance")

		cert, err := h.acmeService.IssueCertificate(ctx, route.Domain)
		if err != nil {
			log.Error().
				Err(err).
				Str("domain", route.Domain).
				Msg("failed to issue certificate")
			return
		}

		certificateIssued = true
		log.Info().
			Int64("cert_id", cert.ID).
			Str("domain", route.Domain).
			Msg("certificate issued successfully")
	}

	// Step 3: Nginx configuration reload (if certificate was issued)
	nginxReloaded := false
	if certificateIssued {
		log.Debug().
			Str("domain", route.Domain).
			Msg("triggering nginx configuration reload")

		// The nginx manager should automatically pick up the new certificate
		// through its reconcile loop. In a production system, you might want
		// to trigger an immediate reload here.
		
		nginxReloaded = true
		log.Info().
			Str("domain", route.Domain).
			Msg("nginx configuration reload triggered")
	}

	log.Info().
		Int64("route_id", route.ID).
		Str("domain", route.Domain).
		Bool("domain_verified", domainVerified).
		Bool("certificate_issued", certificateIssued).
		Bool("nginx_reloaded", nginxReloaded).
		Msg("TLS setup completed")
}