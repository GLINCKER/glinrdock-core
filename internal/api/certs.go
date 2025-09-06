package api

import (
	"context"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/GLINCKER/glinrdock/internal/jobs"
	"github.com/GLINCKER/glinrdock/internal/proxy"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// CertHandlers contains certificate API handlers
type CertHandlers struct {
	certStore CertStore
	jobQueue  *jobs.Queue
	proxy     *proxy.NginxConfig
}

// CertStore interface for certificate-related database operations
type CertStore interface {
	UpsertCert(ctx context.Context, domain, email, status string, expiresAt *time.Time) error
	GetCert(ctx context.Context, domain string) (store.Cert, error)
	ListCerts(ctx context.Context) ([]store.Cert, error)
	ListCertsExpiringSoon(ctx context.Context, within time.Duration) ([]store.Cert, error)
}

// NewCertHandlers creates new certificate handlers
func NewCertHandlers(certStore CertStore, jobQueue *jobs.Queue, proxy *proxy.NginxConfig) *CertHandlers {
	return &CertHandlers{
		certStore: certStore,
		jobQueue:  jobQueue,
		proxy:     proxy,
	}
}

// IssueCert handles certificate issuance requests
func (h *CertHandlers) IssueCert(c *gin.Context) {
	var spec store.CertSpec
	if err := c.ShouldBindJSON(&spec); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid certificate specification"})
		return
	}

	// Validate domain and email
	if err := h.validateDomainAndEmail(spec.Domain, spec.Email); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create initial cert record
	if err := h.certStore.UpsertCert(c.Request.Context(), spec.Domain, spec.Email, "queued", nil); err != nil {
		log.Error().Err(err).Str("domain", spec.Domain).Msg("failed to create cert record")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create certificate record"})
		return
	}

	// Queue certificate issuance job
	jobData := map[string]interface{}{
		"domain": spec.Domain,
		"email":  spec.Email,
	}
	job := h.jobQueue.Enqueue("cert_issue", jobData)

	// Get cert record to return current status
	cert, err := h.certStore.GetCert(c.Request.Context(), spec.Domain)
	if err != nil {
		log.Error().Err(err).Str("domain", spec.Domain).Msg("failed to get cert record after creation")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get certificate status"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"domain":     cert.Domain,
		"email":      cert.Email,
		"status":     cert.Status,
		"expires_at": cert.ExpiresAt,
		"job_id":     job.ID,
	})
}

// ListCerts returns all certificates
func (h *CertHandlers) ListCerts(c *gin.Context) {
	certs, err := h.certStore.ListCerts(c.Request.Context())
	if err != nil {
		log.Error().Err(err).Msg("failed to list certificates")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list certificates"})
		return
	}

	c.JSON(http.StatusOK, certs)
}

// RenewCert handles certificate renewal requests
func (h *CertHandlers) RenewCert(c *gin.Context) {
	domain := c.Param("domain")
	if domain == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "domain parameter required"})
		return
	}

	// Get existing cert
	cert, err := h.certStore.GetCert(c.Request.Context(), domain)
	if err != nil {
		if err == store.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "certificate not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get certificate"})
		}
		return
	}

	// Update status to renewing
	if err := h.certStore.UpsertCert(c.Request.Context(), domain, cert.Email, "renewing", cert.ExpiresAt); err != nil {
		log.Error().Err(err).Str("domain", domain).Msg("failed to update cert status to renewing")
	}

	// Queue renewal job
	jobData := map[string]interface{}{
		"domain": domain,
	}
	job := h.jobQueue.Enqueue("cert_renew", jobData)

	c.JSON(http.StatusOK, gin.H{
		"domain": domain,
		"status": "renewing",
		"job_id": job.ID,
	})
}

// GetCert returns certificate details
func (h *CertHandlers) GetCert(c *gin.Context) {
	domain := c.Param("domain")
	if domain == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "domain parameter required"})
		return
	}

	cert, err := h.certStore.GetCert(c.Request.Context(), domain)
	if err != nil {
		if err == store.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "certificate not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get certificate"})
		}
		return
	}

	c.JSON(http.StatusOK, cert)
}

// ReloadNginx handles manual nginx reload requests
func (h *CertHandlers) ReloadNginx(c *gin.Context) {
	log.Info().Msg("manual nginx reload requested")

	if err := h.proxy.Reload(); err != nil {
		log.Error().Err(err).Msg("manual nginx reload failed")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "nginx reload failed",
			"details": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  "success",
		"message": "nginx reloaded successfully",
	})
}

// GetCertStatus returns certificate status with additional info
func (h *CertHandlers) GetCertStatus(c *gin.Context) {
	domain := c.Param("domain")
	if domain == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "domain parameter required"})
		return
	}

	cert, err := h.certStore.GetCert(c.Request.Context(), domain)
	if err != nil {
		if err == store.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "certificate not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get certificate"})
		}
		return
	}

	// Get cert file paths
	certPath, keyPath := h.proxy.GetCertPaths(domain)

	response := gin.H{
		"domain":     cert.Domain,
		"email":      cert.Email,
		"status":     cert.Status,
		"expires_at": cert.ExpiresAt,
		"created_at": cert.CreatedAt,
		"cert_path":  certPath,
		"key_path":   keyPath,
	}

	if cert.LastIssuedAt != nil {
		response["last_issued_at"] = cert.LastIssuedAt
	}

	c.JSON(http.StatusOK, response)
}

// Helper methods

// validateDomainAndEmail validates domain and email format
func (h *CertHandlers) validateDomainAndEmail(domain, email string) error {
	// Basic domain validation
	domainRegex := regexp.MustCompile(`^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$`)
	if !domainRegex.MatchString(domain) {
		return fmt.Errorf("invalid domain name: %s", domain)
	}

	// Basic email validation
	if !strings.Contains(email, "@") {
		return fmt.Errorf("invalid email format: %s", email)
	}

	return nil
}
