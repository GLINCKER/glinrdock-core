package api

import (
	"context"
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/GLINCKER/glinrdock/internal/dns"
	"github.com/GLINCKER/glinrdock/internal/domains"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/GLINCKER/glinrdock/internal/util"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// DomainHandlers contains domain management API handlers
type DomainHandlers struct {
	store               *store.Store
	verificationService *domains.VerificationService
	auditLogger         *audit.Logger
}

// CreateDomainRequest represents a request to create a domain
type CreateDomainRequest struct {
	Domain      string `json:"domain" binding:"required"`
	ProviderID  *int64 `json:"provider_id,omitempty"`
	AutoManage  bool   `json:"auto_manage"`
}

// DomainResponse represents a domain in API responses
type DomainResponse struct {
	ID         int64     `json:"id"`
	Domain     string    `json:"domain"`
	ProviderID *int64    `json:"provider_id"`
	AutoManage bool      `json:"auto_manage"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// DomainStatusResponse represents domain verification status
type DomainStatusResponse struct {
	Domain        string     `json:"domain"`
	Verified      bool       `json:"verified"`
	Method        string     `json:"method,omitempty"`
	Token         string     `json:"token,omitempty"`
	TargetHint    *string    `json:"target_hint,omitempty"`
	LastCheckedAt *time.Time `json:"last_checked_at"`
	CreatedAt     time.Time  `json:"created_at"`
}

// NewDomainHandlers creates new domain handlers
func NewDomainHandlers(store *store.Store, config *util.Config, auditLogger *audit.Logger) *DomainHandlers {
	resolver := dns.NewMultiResolver(config.DNSResolvers)
	verificationService := domains.NewVerificationService(store.GetDB(), config, resolver)
	
	return &DomainHandlers{
		store:               store,
		verificationService: verificationService,
		auditLogger:         auditLogger,
	}
}

// CreateDomain creates a new domain (deployer+ access)
// @Summary Create domain
// @Description Creates a new domain for certificate management and DNS operations
// @Tags domains
// @Security DeployerAuth
// @Accept json
// @Produce json
// @Param domain body CreateDomainRequest true "Domain configuration"
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

	// Create domain spec
	spec := store.DomainSpec{
		Domain:     req.Domain,
		ProviderID: req.ProviderID,
		AutoManage: &req.AutoManage,
	}

	// Create the domain
	domain, err := h.store.CreateDomain(ctx, spec)
	if err != nil {
		log.Error().Err(err).Str("domain", req.Domain).Msg("failed to create domain")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create domain"})
		return
	}

	log.Info().
		Int64("domain_id", domain.ID).
		Str("domain", domain.Domain).
		Bool("auto_manage", domain.AutoManage).
		Msg("domain created successfully")

	// Audit log domain creation
	if h.auditLogger != nil {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordDomainAction(c.Request.Context(), actor, audit.ActionDomainCreate, map[string]interface{}{
			"domain_id":    domain.ID,
			"domain":       domain.Domain,
			"provider_id":  domain.ProviderID,
			"auto_manage":  domain.AutoManage,
		})
	}

	response := DomainResponse{
		ID:         domain.ID,
		Domain:     domain.Domain,
		ProviderID: domain.ProviderID,
		AutoManage: domain.AutoManage,
		CreatedAt:  domain.CreatedAt,
		UpdatedAt:  domain.UpdatedAt,
	}

	c.JSON(http.StatusCreated, response)
}

// VerifyDomain initiates domain verification (deployer+ access)
// @Summary Verify domain
// @Description Initiates domain verification process using DNS challenges
// @Tags domains
// @Security DeployerAuth
// @Produce json
// @Param id path int true "Domain ID"
// @Success 200 {object} DomainStatusResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/domains/{id}/verify [post]
func (h *DomainHandlers) VerifyDomain(c *gin.Context) {
	domainIDStr := c.Param("id")
	domainID, err := strconv.ParseInt(domainIDStr, 10, 64)
	if err != nil {
		log.Warn().Str("domain_id", domainIDStr).Msg("invalid domain ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid domain ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	// Get domain from database
	domain, err := h.store.GetDomain(ctx, domainID)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Warn().Int64("domain_id", domainID).Msg("domain not found")
			c.JSON(http.StatusNotFound, gin.H{"error": "domain not found"})
			return
		}
		log.Error().Err(err).Int64("domain_id", domainID).Msg("failed to get domain")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve domain"})
		return
	}

	// Issue verification challenge
	result, err := h.verificationService.IssueVerification(ctx, domain.Domain)
	if err != nil {
		if verifyErr, ok := err.(*domains.VerificationError); ok {
			log.Warn().Err(err).Str("domain", domain.Domain).Int("code", verifyErr.Code).Msg("domain verification failed")
			c.JSON(verifyErr.Code, gin.H{"error": verifyErr.Message})
			return
		}
		log.Error().Err(err).Str("domain", domain.Domain).Msg("failed to issue domain verification")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to issue domain verification"})
		return
	}

	log.Info().
		Str("domain", domain.Domain).
		Str("method", result.Method).
		Msg("domain verification issued successfully")

	// Audit log domain verification
	if h.auditLogger != nil {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordDomainAction(c.Request.Context(), actor, audit.ActionDomainVerify, map[string]interface{}{
			"domain_id":      domainID,
			"domain":         domain.Domain,
			"method":         result.Method,
			"verification_id": result.ID,
		})
	}

	response := DomainStatusResponse{
		Domain:        result.Domain,
		Verified:      result.Status == "verified",
		Method:        result.Method,
		Token:         result.Token,
		TargetHint:    result.TargetHint,
		LastCheckedAt: result.LastCheckedAt,
		CreatedAt:     result.CreatedAt,
	}

	c.JSON(http.StatusOK, response)
}

// GetDomainStatus gets domain verification status (deployer+ access)
// @Summary Get domain status
// @Description Returns the current verification status of a domain
// @Tags domains
// @Security DeployerAuth
// @Produce json
// @Param id path int true "Domain ID"
// @Success 200 {object} DomainStatusResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/domains/{id}/status [get]
func (h *DomainHandlers) GetDomainStatus(c *gin.Context) {
	domainIDStr := c.Param("id")
	domainID, err := strconv.ParseInt(domainIDStr, 10, 64)
	if err != nil {
		log.Warn().Str("domain_id", domainIDStr).Msg("invalid domain ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid domain ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	// Get domain from database
	domain, err := h.store.GetDomain(ctx, domainID)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Warn().Int64("domain_id", domainID).Msg("domain not found")
			c.JSON(http.StatusNotFound, gin.H{"error": "domain not found"})
			return
		}
		log.Error().Err(err).Int64("domain_id", domainID).Msg("failed to get domain")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve domain"})
		return
	}

	// Check verification status
	result, err := h.verificationService.CheckVerification(ctx, domain.Domain)
	if err != nil {
		if verifyErr, ok := err.(*domains.VerificationError); ok {
			if verifyErr.Code == 404 {
				// No verification exists yet
				response := DomainStatusResponse{
					Domain:        domain.Domain,
					Verified:      false,
					LastCheckedAt: nil,
					CreatedAt:     domain.CreatedAt,
				}
				c.JSON(http.StatusOK, response)
				return
			}
			log.Warn().Err(err).Str("domain", domain.Domain).Int("code", verifyErr.Code).Msg("domain verification check failed")
			c.JSON(verifyErr.Code, gin.H{"error": verifyErr.Message})
			return
		}
		log.Error().Err(err).Str("domain", domain.Domain).Msg("failed to check domain verification")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check domain verification"})
		return
	}

	log.Debug().
		Str("domain", domain.Domain).
		Str("status", result.Status).
		Msg("domain verification status checked")

	// Audit log domain status check
	if h.auditLogger != nil {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordDomainAction(c.Request.Context(), actor, audit.ActionDomainStatusCheck, map[string]interface{}{
			"domain_id": domainID,
			"domain":    domain.Domain,
			"verified":  result.Status == "verified",
		})
	}

	response := DomainStatusResponse{
		Domain:        result.Domain,
		Verified:      result.Status == "verified",
		Method:        result.Method,
		Token:         result.Token,
		TargetHint:    result.TargetHint,
		LastCheckedAt: result.LastCheckedAt,
		CreatedAt:     result.CreatedAt,
	}

	c.JSON(http.StatusOK, response)
}