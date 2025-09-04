package api

import (
	"context"
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/GLINCKER/glinrdock/internal/tls"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// CertificateIssuanceHandlers contains certificate issuance API handlers
type CertificateIssuanceHandlers struct {
	store       *store.Store
	acmeService *tls.ACMEService
	auditLogger *audit.Logger
}

// IssueCertificateRequest represents a request to issue a certificate
type IssueCertificateRequest struct {
	Domain string  `json:"domain" binding:"required"`
	Method *string `json:"method,omitempty"` // "http-01" or "dns-01", defaults to "http-01"
}

// IssueCertificateResponse represents the response from certificate issuance
type IssueCertificateResponse struct {
	JobID       string `json:"job_id"`
	Domain      string `json:"domain"`
	Method      string `json:"method"`
	Status      string `json:"status"`
	Message     string `json:"message,omitempty"`
	StartedAt   time.Time `json:"started_at"`
}

// CertificateDetailsResponse represents detailed certificate information
type CertificateDetailsResponse struct {
	ID        int64      `json:"id"`
	Domain    string     `json:"domain"`
	Type      string     `json:"type"`
	Issuer    *string    `json:"issuer"`
	NotBefore *time.Time `json:"not_before"`
	NotAfter  *time.Time `json:"not_after"`
	Status    string     `json:"status"`
	HasCert   bool       `json:"has_cert"`
	HasKey    bool       `json:"has_key"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

// NewCertificateIssuanceHandlers creates new certificate issuance handlers
func NewCertificateIssuanceHandlers(store *store.Store, acmeService *tls.ACMEService, auditLogger *audit.Logger) *CertificateIssuanceHandlers {
	return &CertificateIssuanceHandlers{
		store:       store,
		acmeService: acmeService,
		auditLogger: auditLogger,
	}
}

// IssueCertificate initiates certificate issuance (deployer+ access)
// @Summary Issue certificate
// @Description Initiates ACME certificate issuance for a domain (async operation)
// @Tags certificates
// @Security DeployerAuth
// @Accept json
// @Produce json
// @Param certificate body IssueCertificateRequest true "Certificate issuance request"
// @Success 202 {object} IssueCertificateResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/certificates/issue [post]
func (h *CertificateIssuanceHandlers) IssueCertificate(c *gin.Context) {
	var req IssueCertificateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Warn().Err(err).Msg("invalid certificate issuance request")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: " + err.Error()})
		return
	}

	// Default to http-01 if method not specified
	method := "http-01"
	if req.Method != nil {
		method = *req.Method
	}

	// Validate method
	if method != "http-01" && method != "dns-01" {
		log.Warn().Str("method", method).Msg("unsupported challenge method")
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported challenge method: " + method})
		return
	}

	// Generate a job ID for async tracking
	jobID := "cert_" + strconv.FormatInt(time.Now().UnixNano(), 36)
	startedAt := time.Now()

	log.Info().
		Str("domain", req.Domain).
		Str("method", method).
		Str("job_id", jobID).
		Msg("initiating certificate issuance")

	// Start certificate issuance asynchronously
	go func() {
		// Use a background context for the async operation
		bgCtx := context.Background()
		
		cert, err := h.acmeService.IssueCertificate(bgCtx, req.Domain)
		if err != nil {
			log.Error().
				Err(err).
				Str("domain", req.Domain).
				Str("job_id", jobID).
				Msg("certificate issuance failed")
			
			// In a production system, you'd want to store job status in database
			// For now, we'll just log the failure
			return
		}

		log.Info().
			Int64("cert_id", cert.ID).
			Str("domain", req.Domain).
			Str("job_id", jobID).
			Msg("certificate issued successfully")
	}()

	// Audit log certificate issuance
	if h.auditLogger != nil {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordCertificateAction(c.Request.Context(), actor, audit.ActionCertificateCreate, req.Domain, map[string]interface{}{
			"domain":  req.Domain,
			"method":  method,
			"job_id":  jobID,
			"async":   true,
		})
	}

	response := IssueCertificateResponse{
		JobID:     jobID,
		Domain:    req.Domain,
		Method:    method,
		Status:    "processing",
		Message:   "Certificate issuance started",
		StartedAt: startedAt,
	}

	c.JSON(http.StatusAccepted, response)
}

// GetCertificate gets detailed certificate information (deployer+ access)
// @Summary Get certificate details
// @Description Returns detailed information about a specific certificate
// @Tags certificates
// @Security DeployerAuth
// @Produce json
// @Param id path int true "Certificate ID"
// @Success 200 {object} CertificateDetailsResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/certificates/{id} [get]
func (h *CertificateIssuanceHandlers) GetCertificate(c *gin.Context) {
	certIDStr := c.Param("id")
	certID, err := strconv.ParseInt(certIDStr, 10, 64)
	if err != nil {
		log.Warn().Str("cert_id", certIDStr).Msg("invalid certificate ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid certificate ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Get enhanced certificate by ID
	cert, err := h.store.GetEnhancedCertificate(ctx, certID)
	if err != nil {
		if err == sql.ErrNoRows {
			log.Warn().Int64("cert_id", certID).Msg("certificate not found")
			c.JSON(http.StatusNotFound, gin.H{"error": "certificate not found"})
			return
		}
		log.Error().Err(err).Int64("cert_id", certID).Msg("failed to get certificate")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve certificate"})
		return
	}

	log.Debug().
		Int64("cert_id", certID).
		Str("domain", cert.Domain).
		Str("status", cert.Status).
		Msg("certificate retrieved successfully")

	// Audit log certificate access
	if h.auditLogger != nil {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordCertificateAction(c.Request.Context(), actor, audit.ActionRead, strconv.FormatInt(certID, 10), map[string]interface{}{
			"cert_id": certID,
			"domain":  cert.Domain,
		})
	}

	response := CertificateDetailsResponse{
		ID:        cert.ID,
		Domain:    cert.Domain,
		Type:      cert.Type,
		Issuer:    cert.Issuer,
		NotBefore: cert.NotBefore,
		NotAfter:  cert.NotAfter,
		Status:    cert.Status,
		HasCert:   cert.PEMCert != nil,
		HasKey:    cert.PEMKeyEnc != nil,
		CreatedAt: cert.CreatedAt,
		UpdatedAt: cert.UpdatedAt,
	}

	c.JSON(http.StatusOK, response)
}