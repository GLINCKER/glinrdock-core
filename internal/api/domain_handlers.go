package api

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/GLINCKER/glinrdock/internal/dns"
	"github.com/GLINCKER/glinrdock/internal/dns/cloudflare"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/GLINCKER/glinrdock/internal/util"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// DomainHandlers contains domain management API handlers
type DomainHandlers struct {
	store           *store.Store
	auditLogger     *audit.Logger
	zoneDetector    *dns.ZoneDetector
	inspector       dns.DNSInspector
	cloudflareToken string
}

// CreateDomainRequest represents a request to create a domain
type CreateDomainRequest struct {
	Name string `json:"name" binding:"required"`
}

// DomainResponse represents a domain in API responses with UI-friendly fields
type DomainResponse struct {
	ID                    int64      `json:"id"`
	Name                  string     `json:"name"`
	Status                string     `json:"status"`
	Provider              *string    `json:"provider"`
	ZoneID                *string    `json:"zone_id"`
	VerificationToken     string     `json:"verification_token"`
	VerificationCheckedAt *time.Time `json:"verification_checked_at"`
	CertificateID         *int64     `json:"certificate_id"`
	CreatedAt             time.Time  `json:"created_at"`
	UpdatedAt             time.Time  `json:"updated_at"`

	// UI-friendly fields
	NextAction    string                 `json:"next_action"`
	LastChecked   *time.Time             `json:"last_checked"`
	ProviderHints map[string]interface{} `json:"provider_hints,omitempty"`
	Instructions  *DomainInstructions    `json:"instructions,omitempty"`
}

// DomainInstructions contains DNS setup instructions for the user
type DomainInstructions struct {
	TXTRecord   *DNSInstruction `json:"txt_record"`
	CNAMERecord *DNSInstruction `json:"cname_record,omitempty"`
	Message     string          `json:"message"`
}

// DNSInstruction represents a single DNS record instruction
type DNSInstruction struct {
	Type    string `json:"type"`
	Name    string `json:"name"`
	Value   string `json:"value"`
	Purpose string `json:"purpose"`
}

// DomainListResponse represents paginated domain list
type DomainListResponse struct {
	Domains []DomainResponse `json:"domains"`
	Count   int              `json:"count"`
}

// NewDomainHandlers creates new domain handlers
func NewDomainHandlers(store *store.Store, config *util.Config, auditLogger *audit.Logger) *DomainHandlers {
	inspector := dns.NewInspector()
	zoneDetector := dns.NewZoneDetectorWithInspector(inspector)

	// Get Cloudflare token from config if available
	cloudflareToken := ""
	if config != nil && config.CFAPIToken != "" {
		cloudflareToken = config.CFAPIToken
	}

	return &DomainHandlers{
		store:           store,
		auditLogger:     auditLogger,
		zoneDetector:    zoneDetector,
		inspector:       inspector,
		cloudflareToken: cloudflareToken,
	}
}

// CreateDomain creates a new domain with auto-detection (Admin only)
// @Summary Create domain
// @Description Creates a new domain with provider auto-detection and generates verification instructions
// @Tags domains
// @Security AdminAuth
// @Accept json
// @Produce json
// @Param domain body CreateDomainRequest true "Domain to create"
// @Success 201 {object} DomainResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/domains [post]
func (h *DomainHandlers) CreateDomain(c *gin.Context) {
	var req CreateDomainRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Warn().Err(err).Msg("invalid domain request")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	// Auto-detect provider
	zoneInfo, err := h.zoneDetector.GetZoneInfo(ctx, req.Name)
	var provider *string
	var zoneID *string

	if err != nil {
		log.Warn().Err(err).Str("domain", req.Name).Msg("failed to detect zone info")
		// Continue without provider info - user can configure manually
	} else {
		provider = &zoneInfo.Provider

		// If Cloudflare and we have credentials, get zone ID
		if zoneInfo.Provider == dns.ProviderCloudflare && h.cloudflareToken != "" {
			client := cloudflare.NewClient(cloudflare.Config{APIToken: h.cloudflareToken})
			if cfZoneID, err := client.GetZoneID(ctx, zoneInfo.Zone); err == nil {
				zoneID = &cfZoneID
			}
		}
	}

	// Create domain struct
	domain := &store.Domain{
		Name:     req.Name,
		Status:   store.DomainStatusPending,
		Provider: provider,
		ZoneID:   zoneID,
	}

	// Create the domain
	domainID, err := h.store.CreateDomain(ctx, domain)
	if err != nil {
		log.Error().Err(err).Str("domain", req.Name).Msg("failed to create domain")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create domain"})
		return
	}

	// Get the created domain to return full details
	createdDomain, err := h.store.GetDomainByID(ctx, domainID)
	if err != nil {
		log.Error().Err(err).Int64("domain_id", domainID).Msg("failed to retrieve created domain")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve created domain"})
		return
	}

	log.Info().
		Int64("domain_id", domainID).
		Str("domain", createdDomain.Name).
		Str("status", createdDomain.Status).
		Str("provider", fmt.Sprintf("%v", createdDomain.Provider)).
		Msg("domain created successfully")

	// Audit log domain creation
	if h.auditLogger != nil {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordDomainAction(c.Request.Context(), actor, audit.ActionDomainCreate, map[string]interface{}{
			"domain_id": domainID,
			"domain":    createdDomain.Name,
			"provider":  createdDomain.Provider,
			"status":    createdDomain.Status,
		})
	}

	response := h.buildDomainResponse(createdDomain)
	c.JSON(http.StatusCreated, response)
}

// AutoConfigureDomain automatically configures DNS records if provider credentials exist (Admin only)
// @Summary Auto-configure domain
// @Description Automatically creates DNS records if provider credentials are available
// @Tags domains
// @Security AdminAuth
// @Produce json
// @Param id path int true "Domain ID"
// @Success 200 {object} DomainResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/domains/{id}/auto-configure [post]
func (h *DomainHandlers) AutoConfigureDomain(c *gin.Context) {
	domainID, domain, err := h.getDomainFromPath(c)
	if err != nil {
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 60*time.Second)
	defer cancel()

	// Check if we can auto-configure
	if domain.Provider == nil || *domain.Provider != dns.ProviderCloudflare {
		c.JSON(http.StatusBadRequest, gin.H{"error": "auto-configuration only available for Cloudflare domains"})
		return
	}

	if h.cloudflareToken == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Cloudflare API token not configured"})
		return
	}

	if domain.ZoneID == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "zone ID not available for domain"})
		return
	}

	client := cloudflare.NewClient(cloudflare.Config{APIToken: h.cloudflareToken})

	// Create TXT record for verification
	txtName := fmt.Sprintf("_glinr-verify.%s", domain.Name)
	_, err = client.EnsureTXT(ctx, *domain.ZoneID, txtName, domain.VerificationToken)
	if err != nil {
		log.Error().Err(err).Str("domain", domain.Name).Msg("failed to create verification TXT record")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create verification record"})
		return
	}

	// Create CNAME record pointing to our service (if not apex domain)
	if strings.Contains(domain.Name, ".") && !strings.HasPrefix(domain.Name, "*.") {
		// TODO: Get actual service hostname from config
		serviceHost := "glinr.example.com" // This should come from config
		_, err = client.EnsureRecord(ctx, *domain.ZoneID, "CNAME", domain.Name, serviceHost, false)
		if err != nil {
			log.Warn().Err(err).Str("domain", domain.Name).Msg("failed to create CNAME record")
			// Continue - TXT record is more important
		}
	}

	// Update domain status to verifying
	err = h.store.UpdateDomainStatus(ctx, domainID, store.DomainStatusVerifying, nil)
	if err != nil {
		log.Error().Err(err).Int64("domain_id", domainID).Msg("failed to update domain status")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update domain status"})
		return
	}

	// Get updated domain
	updatedDomain, err := h.store.GetDomainByID(ctx, domainID)
	if err != nil {
		log.Error().Err(err).Int64("domain_id", domainID).Msg("failed to retrieve updated domain")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve domain"})
		return
	}

	log.Info().
		Int64("domain_id", domainID).
		Str("domain", domain.Name).
		Msg("domain auto-configured successfully")

	// Audit log
	if h.auditLogger != nil {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordDomainAction(c.Request.Context(), actor, audit.ActionDomainConfigure, map[string]interface{}{
			"domain_id": domainID,
			"domain":    domain.Name,
		})
	}

	response := h.buildDomainResponse(updatedDomain)
	c.JSON(http.StatusOK, response)
}

// VerifyDomain checks for TXT record presence and updates status if verified (Admin only)
// @Summary Verify domain
// @Description Checks for verification TXT record and updates domain status
// @Tags domains
// @Security AdminAuth
// @Produce json
// @Param id path int true "Domain ID"
// @Success 200 {object} DomainResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/domains/{id}/verify [post]
func (h *DomainHandlers) VerifyDomain(c *gin.Context) {
	domainID, domain, err := h.getDomainFromPath(c)
	if err != nil {
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	// Check current status
	if domain.Status == store.DomainStatusVerified || domain.Status == store.DomainStatusActive {
		response := h.buildDomainResponse(domain)
		c.JSON(http.StatusOK, response)
		return
	}

	// Query TXT record
	txtName := fmt.Sprintf("_glinr-verify.%s", domain.Name)
	txtRecords, err := h.inspector.LookupTXT(ctx, txtName)
	if err != nil {
		log.Warn().Err(err).Str("domain", domain.Name).Msg("failed to lookup TXT records")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check verification record"})
		return
	}

	// Check if our token is present
	verified := false
	for _, record := range txtRecords {
		if record == domain.VerificationToken {
			verified = true
			break
		}
	}

	// Update verification timestamp
	now := time.Now()
	err = h.store.UpdateDomainVerificationChecked(ctx, domainID, &now)
	if err != nil {
		log.Warn().Err(err).Int64("domain_id", domainID).Msg("failed to update verification timestamp")
	}

	// Update status if verified
	if verified && domain.Status != store.DomainStatusVerified {
		err = h.store.UpdateDomainStatus(ctx, domainID, store.DomainStatusVerified, nil)
		if err != nil {
			log.Error().Err(err).Int64("domain_id", domainID).Msg("failed to update domain status to verified")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update domain status"})
			return
		}
		log.Info().
			Int64("domain_id", domainID).
			Str("domain", domain.Name).
			Msg("domain verified successfully")
	}

	// Get updated domain
	updatedDomain, err := h.store.GetDomainByID(ctx, domainID)
	if err != nil {
		log.Error().Err(err).Int64("domain_id", domainID).Msg("failed to retrieve updated domain")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve domain"})
		return
	}

	// Audit log
	if h.auditLogger != nil {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordDomainAction(c.Request.Context(), actor, audit.ActionDomainVerify, map[string]interface{}{
			"domain_id": domainID,
			"domain":    domain.Name,
			"verified":  verified,
		})
	}

	response := h.buildDomainResponse(updatedDomain)
	c.JSON(http.StatusOK, response)
}

// ActivateDomain triggers certificate issuance and sets status to active (Admin only)
// @Summary Activate domain
// @Description Triggers certificate issuance for verified domain
// @Tags domains
// @Security AdminAuth
// @Produce json
// @Param id path int true "Domain ID"
// @Success 200 {object} DomainResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/domains/{id}/activate [post]
func (h *DomainHandlers) ActivateDomain(c *gin.Context) {
	domainID, domain, err := h.getDomainFromPath(c)
	if err != nil {
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	// Check if domain is verified
	if domain.Status != store.DomainStatusVerified {
		c.JSON(http.StatusBadRequest, gin.H{"error": "domain must be verified before activation"})
		return
	}

	// TODO: Implement certificate issuance (Prompt 6)
	// For now, we'll just set the status to active
	// In the future, this will trigger the certificate issuance process

	err = h.store.UpdateDomainStatus(ctx, domainID, store.DomainStatusActive, nil)
	if err != nil {
		log.Error().Err(err).Int64("domain_id", domainID).Msg("failed to update domain status to active")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to activate domain"})
		return
	}

	log.Info().
		Int64("domain_id", domainID).
		Str("domain", domain.Name).
		Msg("domain activated successfully")

	// Get updated domain
	updatedDomain, err := h.store.GetDomainByID(ctx, domainID)
	if err != nil {
		log.Error().Err(err).Int64("domain_id", domainID).Msg("failed to retrieve updated domain")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve domain"})
		return
	}

	// Audit log
	if h.auditLogger != nil {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordDomainAction(c.Request.Context(), actor, audit.ActionDomainActivate, map[string]interface{}{
			"domain_id": domainID,
			"domain":    domain.Name,
		})
	}

	response := h.buildDomainResponse(updatedDomain)
	c.JSON(http.StatusOK, response)
}

// GetDomain retrieves a single domain by ID (authenticated users)
// @Summary Get domain
// @Description Retrieves domain details by ID
// @Tags domains
// @Security BearerAuth
// @Produce json
// @Param id path int true "Domain ID"
// @Success 200 {object} DomainResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/domains/{id} [get]
func (h *DomainHandlers) GetDomain(c *gin.Context) {
	_, domain, err := h.getDomainFromPath(c)
	if err != nil {
		return
	}

	response := h.buildDomainResponse(domain)
	c.JSON(http.StatusOK, response)
}

// ListDomains retrieves domains with optional status filter (authenticated users)
// @Summary List domains
// @Description Retrieves list of domains with optional filtering
// @Tags domains
// @Security BearerAuth
// @Produce json
// @Param status query string false "Filter by status (pending,verifying,verified,active,error)"
// @Success 200 {object} DomainListResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/domains [get]
func (h *DomainHandlers) ListDomains(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	// Parse status filter
	var statuses []string
	if statusParam := c.Query("status"); statusParam != "" {
		statuses = strings.Split(statusParam, ",")
		// Validate status values
		validStatuses := map[string]bool{
			store.DomainStatusPending:   true,
			store.DomainStatusVerifying: true,
			store.DomainStatusVerified:  true,
			store.DomainStatusActive:    true,
			store.DomainStatusError:     true,
		}
		for _, status := range statuses {
			if !validStatuses[status] {
				c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("invalid status: %s", status)})
				return
			}
		}
	}

	domains, err := h.store.ListDomains(ctx, statuses)
	if err != nil {
		log.Error().Err(err).Msg("failed to list domains")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve domains"})
		return
	}

	responses := make([]DomainResponse, len(domains))
	for i, domain := range domains {
		responses[i] = h.buildDomainResponse(&domain)
	}

	result := DomainListResponse{
		Domains: responses,
		Count:   len(responses),
	}

	c.JSON(http.StatusOK, result)
}

// Helper methods

func (h *DomainHandlers) getDomainFromPath(c *gin.Context) (int64, *store.Domain, error) {
	domainIDStr := c.Param("id")
	domainID, err := strconv.ParseInt(domainIDStr, 10, 64)
	if err != nil {
		log.Warn().Str("domain_id", domainIDStr).Msg("invalid domain ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid domain ID"})
		return 0, nil, err
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	domain, err := h.store.GetDomainByID(ctx, domainID)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Warn().Int64("domain_id", domainID).Msg("domain not found")
			c.JSON(http.StatusNotFound, gin.H{"error": "domain not found"})
			return 0, nil, err
		}
		log.Error().Err(err).Int64("domain_id", domainID).Msg("failed to get domain")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve domain"})
		return 0, nil, err
	}

	return domainID, domain, nil
}

func (h *DomainHandlers) buildDomainResponse(domain *store.Domain) DomainResponse {
	response := DomainResponse{
		ID:                    domain.ID,
		Name:                  domain.Name,
		Status:                domain.Status,
		Provider:              domain.Provider,
		ZoneID:                domain.ZoneID,
		VerificationToken:     domain.VerificationToken,
		VerificationCheckedAt: domain.VerificationCheckedAt,
		CertificateID:         domain.CertificateID,
		CreatedAt:             domain.CreatedAt,
		UpdatedAt:             domain.UpdatedAt,
		LastChecked:           domain.VerificationCheckedAt,
	}

	// Set next action based on status
	switch domain.Status {
	case store.DomainStatusPending:
		response.NextAction = "configure_dns"
		response.Instructions = h.buildDNSInstructions(domain)
	case store.DomainStatusVerifying:
		response.NextAction = "verify_dns"
	case store.DomainStatusVerified:
		response.NextAction = "activate"
	case store.DomainStatusActive:
		response.NextAction = "manage"
	case store.DomainStatusError:
		response.NextAction = "retry"
	}

	// Add provider hints
	if domain.Provider != nil {
		response.ProviderHints = map[string]interface{}{
			"type":           *domain.Provider,
			"auto_configure": h.canAutoConfig(domain),
		}
		if *domain.Provider == dns.ProviderCloudflare {
			response.ProviderHints["dashboard_url"] = "https://dash.cloudflare.com"
		}
	}

	return response
}

func (h *DomainHandlers) buildDNSInstructions(domain *store.Domain) *DomainInstructions {
	instructions := &DomainInstructions{
		TXTRecord: &DNSInstruction{
			Type:    "TXT",
			Name:    fmt.Sprintf("_glinr-verify.%s", domain.Name),
			Value:   domain.VerificationToken,
			Purpose: "Domain verification",
		},
	}

	// Add CNAME instruction for non-apex domains
	if strings.Contains(domain.Name, ".") && !strings.HasPrefix(domain.Name, "*.") {
		instructions.CNAMERecord = &DNSInstruction{
			Type:    "CNAME",
			Name:    domain.Name,
			Value:   "glinr.example.com", // TODO: Get from config
			Purpose: "Route traffic to GLINR",
		}
		instructions.Message = "Create both TXT and CNAME records, then use auto-configure or verify."
	} else {
		instructions.Message = "Create the TXT record for verification, then verify the domain."
	}

	return instructions
}

func (h *DomainHandlers) canAutoConfig(domain *store.Domain) bool {
	return domain.Provider != nil &&
		*domain.Provider == dns.ProviderCloudflare &&
		h.cloudflareToken != "" &&
		domain.ZoneID != nil
}
