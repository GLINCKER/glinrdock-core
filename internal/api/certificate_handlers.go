package api

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/GLINCKER/glinrdock/internal/certs"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// CertificateHandlers contains certificate management API handlers
type CertificateHandlers struct {
	store       *store.Store
	issuer      certs.Issuer
	auditLogger *audit.Logger
}

// CertificateUploadRequest represents certificate upload request
type CertificateUploadRequest struct {
	Domain    string `json:"domain" binding:"required"`
	Type      string `json:"type" binding:"required"`
	CertData  string `json:"cert_data" binding:"required"`
	KeyData   string `json:"key_data" binding:"required"`
	AutoRenew bool   `json:"auto_renew"`
}

// CertificateResponse represents certificate API response
type CertificateResponse struct {
	ID        int64      `json:"id"`
	Domain    string     `json:"domain"`
	Type      string     `json:"type"`
	HasCert   bool       `json:"has_cert"`
	HasKey    bool       `json:"has_key"`
	ExpiresAt *time.Time `json:"expires_at,omitempty"`
	AutoRenew bool       `json:"auto_renew"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

// RenewResponse represents certificate renewal response
type RenewResponse struct {
	Message string `json:"message"`
	JobID   string `json:"job_id,omitempty"`
}

// NewCertificateHandlers creates new certificate handlers
func NewCertificateHandlers(store *store.Store, auditLogger *audit.Logger) *CertificateHandlers {
	return &CertificateHandlers{
		store:       store,
		issuer:      &certs.NoopIssuer{},
		auditLogger: auditLogger,
	}
}

// UploadCertificate handles certificate upload
// @Summary Upload a certificate
// @Description Upload a certificate with private key for a domain
// @Tags certificates
// @Security AdminAuth
// @Accept json
// @Produce json
// @Param certificate body CertificateUploadRequest true "Certificate data"
// @Success 201 {object} CertificateResponse
// @Failure 400 {object} map[string]string
// @Failure 409 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/certificates [post]
func (h *CertificateHandlers) UploadCertificate(c *gin.Context) {
	var req CertificateUploadRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Error().Err(err).Msg("invalid certificate upload request")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid certificate data"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Validate domain format (basic validation)
	if req.Domain == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "domain is required"})
		return
	}

	// Validate certificate type
	if req.Type != "manual" && req.Type != "letsencrypt" && req.Type != "custom" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid certificate type"})
		return
	}

	// Check if certificate already exists
	_, err := h.store.GetCertificateByDomain(ctx, req.Domain)
	if err == nil {
		log.Warn().Str("domain", req.Domain).Msg("certificate already exists for domain")
		c.JSON(http.StatusConflict, gin.H{"error": "certificate already exists for this domain"})
		return
	}

	// Create certificate specification
	spec := store.CertificateSpec{
		Domain:    req.Domain,
		Type:      req.Type,
		CertData:  &req.CertData,
		KeyData:   &req.KeyData,
		AutoRenew: &req.AutoRenew,
		// TODO: Parse certificate to extract expiry date
	}

	// Create certificate in database
	cert, err := h.store.CreateCertificate(ctx, spec)
	if err != nil {
		log.Error().Err(err).Str("domain", req.Domain).Msg("failed to create certificate")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create certificate"})
		return
	}

	log.Info().Str("domain", req.Domain).Int64("id", cert.ID).Msg("certificate created successfully")

	// Audit log certificate creation
	if h.auditLogger != nil {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordCertificateAction(c.Request.Context(), actor, audit.ActionCertificateCreate, fmt.Sprintf("%d", cert.ID), map[string]interface{}{
			"domain": cert.Domain,
			"type":   cert.Type,
		})
	}

	response := CertificateResponse{
		ID:        cert.ID,
		Domain:    cert.Domain,
		Type:      cert.Type,
		HasCert:   cert.CertData != nil,
		HasKey:    cert.KeyData != nil,
		ExpiresAt: cert.ExpiresAt,
		AutoRenew: cert.AutoRenew,
		CreatedAt: cert.CreatedAt,
		UpdatedAt: cert.UpdatedAt,
	}

	c.JSON(http.StatusCreated, response)
}

// ListCertificates lists all certificates
// @Summary List certificates
// @Description Get a list of all certificates
// @Tags certificates
// @Security AdminAuth
// @Produce json
// @Success 200 {array} CertificateResponse
// @Failure 500 {object} map[string]string
// @Router /v1/certificates [get]
func (h *CertificateHandlers) ListCertificates(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	certificates, err := h.store.ListCertificates(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to list certificates")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list certificates"})
		return
	}

	// Convert to response format (without exposing private keys)
	responses := make([]CertificateResponse, len(certificates))
	for i, cert := range certificates {
		responses[i] = CertificateResponse{
			ID:        cert.ID,
			Domain:    cert.Domain,
			Type:      cert.Type,
			HasCert:   cert.CertData != nil,
			HasKey:    cert.KeyData != nil,
			ExpiresAt: cert.ExpiresAt,
			AutoRenew: cert.AutoRenew,
			CreatedAt: cert.CreatedAt,
			UpdatedAt: cert.UpdatedAt,
		}
	}

	c.JSON(http.StatusOK, responses)
}

// GetCertificate gets a specific certificate by ID
// @Summary Get certificate by ID
// @Description Get details of a specific certificate
// @Tags certificates
// @Security AdminAuth
// @Produce json
// @Param id path int true "Certificate ID"
// @Success 200 {object} CertificateResponse
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/certificates/{id} [get]
func (h *CertificateHandlers) GetCertificate(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		log.Error().Err(err).Str("id", idStr).Msg("invalid certificate ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid certificate ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	cert, err := h.store.GetCertificate(ctx, id)
	if err != nil {
		log.Error().Err(err).Int64("id", id).Msg("failed to get certificate")
		c.JSON(http.StatusNotFound, gin.H{"error": "certificate not found"})
		return
	}

	response := CertificateResponse{
		ID:        cert.ID,
		Domain:    cert.Domain,
		Type:      cert.Type,
		HasCert:   cert.CertData != nil,
		HasKey:    cert.KeyData != nil,
		ExpiresAt: cert.ExpiresAt,
		AutoRenew: cert.AutoRenew,
		CreatedAt: cert.CreatedAt,
		UpdatedAt: cert.UpdatedAt,
	}

	c.JSON(http.StatusOK, response)
}

// DeleteCertificate deletes a certificate by ID
// @Summary Delete certificate
// @Description Delete a certificate by ID
// @Tags certificates
// @Security AdminAuth
// @Produce json
// @Param id path int true "Certificate ID"
// @Success 204
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/certificates/{id} [delete]
func (h *CertificateHandlers) DeleteCertificate(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		log.Error().Err(err).Str("id", idStr).Msg("invalid certificate ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid certificate ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Get certificate details for audit logging before deletion
	cert, err := h.store.GetCertificate(ctx, id)
	if err != nil {
		log.Error().Err(err).Int64("id", id).Msg("certificate not found for deletion")
		c.JSON(http.StatusNotFound, gin.H{"error": "certificate not found"})
		return
	}

	// Delete certificate
	err = h.store.DeleteCertificate(ctx, id)
	if err != nil {
		log.Error().Err(err).Int64("id", id).Msg("failed to delete certificate")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete certificate"})
		return
	}

	log.Info().Int64("id", id).Msg("certificate deleted successfully")

	// Audit log certificate deletion
	if h.auditLogger != nil {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordCertificateAction(c.Request.Context(), actor, audit.ActionCertificateDelete, fmt.Sprintf("%d", cert.ID), map[string]interface{}{
			"domain": cert.Domain,
			"type":   cert.Type,
		})
	}
	c.Status(http.StatusNoContent)
}

// RenewCertificate initiates certificate renewal
// @Summary Renew certificate
// @Description Initiate certificate renewal process (returns 202 for async processing)
// @Tags certificates
// @Security AdminAuth
// @Produce json
// @Param id path int true "Certificate ID"
// @Success 202 {object} RenewResponse
// @Failure 400 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 501 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/certificates/{id}/renew [post]
func (h *CertificateHandlers) RenewCertificate(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		log.Error().Err(err).Str("id", idStr).Msg("invalid certificate ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid certificate ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Check if certificate exists
	cert, err := h.store.GetCertificate(ctx, id)
	if err != nil {
		log.Error().Err(err).Int64("id", id).Msg("certificate not found for renewal")
		c.JSON(http.StatusNotFound, gin.H{"error": "certificate not found"})
		return
	}

	// Return 501 Not Implemented for letsencrypt certificates when using NoopIssuer
	if cert.Type == "letsencrypt" {
		if _, isNoop := h.issuer.(*certs.NoopIssuer); isNoop {
			log.Info().Int64("id", id).Str("domain", cert.Domain).Str("type", cert.Type).Msg("ACME renewal not implemented")
			c.JSON(http.StatusNotImplemented, gin.H{"error": "ACME certificate renewal not implemented - upload certificates manually or configure ACME provider"})
			return
		}

		// For real ACME providers, attempt renewal
		certPEM, keyPEM, expiresAt, err := h.issuer.Ensure(ctx, cert.Domain)
		if err != nil {
			log.Error().Err(err).Int64("id", id).Str("domain", cert.Domain).Msg("ACME renewal failed")
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("certificate renewal failed: %v", err)})
			return
		}

		// Update certificate in database
		certPEMStr := string(certPEM)
		keyPEMStr := string(keyPEM)
		spec := store.CertificateSpec{
			Domain:    cert.Domain,
			Type:      cert.Type,
			CertData:  &certPEMStr,
			KeyData:   &keyPEMStr,
			AutoRenew: &cert.AutoRenew,
		}

		_, err = h.store.UpdateCertificate(ctx, id, spec)
		if err != nil {
			log.Error().Err(err).Int64("id", id).Msg("failed to update renewed certificate")
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to store renewed certificate"})
			return
		}

		log.Info().Int64("id", id).Str("domain", cert.Domain).Time("expires_at", expiresAt).Msg("certificate renewed successfully")
		response := RenewResponse{
			Message: fmt.Sprintf("Certificate renewed successfully for domain %s", cert.Domain),
		}
		c.JSON(http.StatusOK, response)
		return
	}

	// For manual/custom certificates, renewal is not automatic
	log.Info().Int64("id", id).Str("domain", cert.Domain).Str("type", cert.Type).Msg("manual certificate renewal not supported")
	response := RenewResponse{
		Message: fmt.Sprintf("Manual renewal not supported for %s certificates. Please upload a new certificate.", cert.Type),
	}
	c.JSON(http.StatusAccepted, response)
}