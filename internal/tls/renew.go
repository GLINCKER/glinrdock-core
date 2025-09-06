package tls

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"time"

	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/GLINCKER/glinrdock/internal/nginx"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/GLINCKER/glinrdock/internal/util"
	"github.com/rs/zerolog/log"
)

// RenewalService handles automated certificate renewals
type RenewalService struct {
	store        *store.Store
	acmeService  *ACMEService
	nginxManager *nginx.Manager
	config       *util.Config
	auditLogger  *audit.Logger

	// Internal state
	ticker    *time.Ticker
	stopCh    chan struct{}
	running   bool
	runningMu sync.RWMutex

	// Configuration
	renewalThreshold time.Duration // Renew certificates expiring within this period
	checkInterval    time.Duration // How often to check for renewals
}

// RenewalConfig holds configuration for the renewal service
type RenewalConfig struct {
	RenewalThreshold time.Duration // Default: 30 days
	CheckInterval    time.Duration // Default: 24 hours
}

// RenewalStats represents renewal operation statistics
type RenewalStats struct {
	TotalScanned       int           `json:"total_scanned"`
	EligibleForRenewal int           `json:"eligible_for_renewal"`
	SuccessfulRenewals int           `json:"successful_renewals"`
	FailedRenewals     int           `json:"failed_renewals"`
	StartTime          time.Time     `json:"start_time"`
	Duration           time.Duration `json:"duration"`
	Errors             []string      `json:"errors,omitempty"`
}

// RenewalResult represents the result of a single certificate renewal
type RenewalResult struct {
	Domain        string        `json:"domain"`
	CertificateID int64         `json:"certificate_id"`
	Success       bool          `json:"success"`
	Method        string        `json:"method"` // "dns-01" or "http-01"
	Error         *string       `json:"error,omitempty"`
	Duration      time.Duration `json:"duration"`
	StartTime     time.Time     `json:"start_time"`
}

// NewRenewalService creates a new renewal service
func NewRenewalService(store *store.Store, acmeService *ACMEService, nginxManager *nginx.Manager, config *util.Config, auditLogger *audit.Logger, renewalConfig RenewalConfig) *RenewalService {
	// Set defaults if not specified
	if renewalConfig.RenewalThreshold == 0 {
		renewalConfig.RenewalThreshold = 30 * 24 * time.Hour // 30 days
	}
	if renewalConfig.CheckInterval == 0 {
		renewalConfig.CheckInterval = 24 * time.Hour // Daily
	}

	return &RenewalService{
		store:            store,
		acmeService:      acmeService,
		nginxManager:     nginxManager,
		config:           config,
		auditLogger:      auditLogger,
		stopCh:           make(chan struct{}),
		renewalThreshold: renewalConfig.RenewalThreshold,
		checkInterval:    renewalConfig.CheckInterval,
	}
}

// Start begins the renewal service background task
func (r *RenewalService) Start(ctx context.Context) error {
	r.runningMu.Lock()
	defer r.runningMu.Unlock()

	if r.running {
		return fmt.Errorf("renewal service is already running")
	}

	log.Info().
		Dur("renewal_threshold", r.renewalThreshold).
		Dur("check_interval", r.checkInterval).
		Msg("starting certificate renewal service")

	// Run initial scan
	go func() {
		log.Info().Msg("running initial certificate renewal scan")
		if stats, err := r.runRenewalScan(ctx); err != nil {
			log.Error().Err(err).Msg("initial certificate renewal scan failed")
		} else {
			log.Info().
				Int("scanned", stats.TotalScanned).
				Int("eligible", stats.EligibleForRenewal).
				Int("renewed", stats.SuccessfulRenewals).
				Int("failed", stats.FailedRenewals).
				Dur("duration", stats.Duration).
				Msg("initial certificate renewal scan completed")
		}
	}()

	// Start recurring ticker
	r.ticker = time.NewTicker(r.checkInterval)
	r.running = true

	go r.renewalLoop(ctx)

	return nil
}

// Stop stops the renewal service
func (r *RenewalService) Stop() error {
	r.runningMu.Lock()
	defer r.runningMu.Unlock()

	if !r.running {
		return fmt.Errorf("renewal service is not running")
	}

	log.Info().Msg("stopping certificate renewal service")

	close(r.stopCh)
	if r.ticker != nil {
		r.ticker.Stop()
	}
	r.running = false

	return nil
}

// IsRunning returns whether the renewal service is currently running
func (r *RenewalService) IsRunning() bool {
	r.runningMu.RLock()
	defer r.runningMu.RUnlock()
	return r.running
}

// renewalLoop runs the periodic renewal check
func (r *RenewalService) renewalLoop(ctx context.Context) {
	for {
		select {
		case <-r.stopCh:
			log.Info().Msg("certificate renewal service stopped")
			return
		case <-r.ticker.C:
			log.Debug().Msg("running scheduled certificate renewal scan")

			stats, err := r.runRenewalScan(ctx)
			if err != nil {
				log.Error().Err(err).Msg("scheduled certificate renewal scan failed")
				continue
			}

			// Log results
			logEvent := log.Info().
				Int("scanned", stats.TotalScanned).
				Int("eligible", stats.EligibleForRenewal).
				Int("renewed", stats.SuccessfulRenewals).
				Int("failed", stats.FailedRenewals).
				Dur("duration", stats.Duration)

			if len(stats.Errors) > 0 {
				logEvent = logEvent.Strs("errors", stats.Errors)
			}

			logEvent.Msg("scheduled certificate renewal scan completed")
		}
	}
}

// runRenewalScan performs a complete renewal scan
func (r *RenewalService) runRenewalScan(ctx context.Context) (*RenewalStats, error) {
	stats := &RenewalStats{
		StartTime: time.Now(),
	}

	// Get certificates expiring within threshold
	certificates, err := r.getCertificatesForRenewal(ctx)
	if err != nil {
		return stats, fmt.Errorf("failed to get certificates for renewal: %w", err)
	}

	stats.TotalScanned = len(certificates)

	log.Info().
		Int("certificates", len(certificates)).
		Dur("threshold", r.renewalThreshold).
		Msg("found certificates eligible for renewal")

	// Process each certificate
	var renewalResults []RenewalResult
	for _, cert := range certificates {
		if cert.Status != "active" {
			log.Debug().
				Int64("cert_id", cert.ID).
				Str("domain", cert.Domain).
				Str("status", cert.Status).
				Msg("skipping certificate with non-active status")
			continue
		}

		stats.EligibleForRenewal++

		result := r.renewCertificate(ctx, cert)
		renewalResults = append(renewalResults, result)

		if result.Success {
			stats.SuccessfulRenewals++
		} else {
			stats.FailedRenewals++
			if result.Error != nil {
				stats.Errors = append(stats.Errors, fmt.Sprintf("%s: %s", cert.Domain, *result.Error))
			}
		}

		// Small delay between renewals to avoid overwhelming ACME servers
		time.Sleep(2 * time.Second)
	}

	stats.Duration = time.Since(stats.StartTime)

	// Audit log renewal batch
	if r.auditLogger != nil {
		r.auditLogger.RecordCertificateAction(ctx, "renewal-service", audit.ActionCertificateRenew, "batch", map[string]interface{}{
			"total_scanned":           stats.TotalScanned,
			"eligible_for_renewal":    stats.EligibleForRenewal,
			"successful_renewals":     stats.SuccessfulRenewals,
			"failed_renewals":         stats.FailedRenewals,
			"duration_ms":             stats.Duration.Milliseconds(),
			"renewal_threshold_hours": r.renewalThreshold.Hours(),
		})
	}

	return stats, nil
}

// getCertificatesForRenewal retrieves certificates that need renewal
func (r *RenewalService) getCertificatesForRenewal(ctx context.Context) ([]store.EnhancedCertificate, error) {
	// Calculate cutoff date
	cutoff := time.Now().Add(r.renewalThreshold)

	query := `
		SELECT id, domain, type, issuer, not_before, not_after, status, 
			   pem_cert, pem_chain, pem_key_enc, pem_key_nonce, 
			   created_at, updated_at
		FROM certificates_enhanced 
		WHERE status = 'active' 
		  AND not_after IS NOT NULL 
		  AND not_after <= ?
		ORDER BY not_after ASC
	`

	rows, err := r.store.GetDB().QueryContext(ctx, query, cutoff)
	if err != nil {
		return nil, fmt.Errorf("failed to query certificates for renewal: %w", err)
	}
	defer rows.Close()

	var certificates []store.EnhancedCertificate
	for rows.Next() {
		var cert store.EnhancedCertificate
		err := rows.Scan(
			&cert.ID, &cert.Domain, &cert.Type, &cert.Issuer,
			&cert.NotBefore, &cert.NotAfter, &cert.Status,
			&cert.PEMCert, &cert.PEMChain, &cert.PEMKeyEnc, &cert.PEMKeyNonce,
			&cert.CreatedAt, &cert.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan certificate: %w", err)
		}
		certificates = append(certificates, cert)
	}

	return certificates, rows.Err()
}

// renewCertificate handles the renewal of a single certificate
func (r *RenewalService) renewCertificate(ctx context.Context, cert store.EnhancedCertificate) RenewalResult {
	result := RenewalResult{
		Domain:        cert.Domain,
		CertificateID: cert.ID,
		StartTime:     time.Now(),
		Success:       false,
	}

	defer func() {
		result.Duration = time.Since(result.StartTime)
	}()

	log.Info().
		Int64("cert_id", cert.ID).
		Str("domain", cert.Domain).
		Time("expires_at", *cert.NotAfter).
		Msg("starting certificate renewal")

	// Determine renewal method
	method, err := r.determineRenewalMethod(ctx, cert.Domain)
	if err != nil {
		errStr := fmt.Sprintf("failed to determine renewal method: %v", err)
		result.Error = &errStr
		log.Error().
			Err(err).
			Str("domain", cert.Domain).
			Msg("failed to determine renewal method")
		return result
	}

	result.Method = method

	log.Debug().
		Str("domain", cert.Domain).
		Str("method", method).
		Msg("using renewal method")

	// Issue new certificate
	newCert, err := r.acmeService.IssueCertificate(ctx, cert.Domain)
	if err != nil {
		errStr := fmt.Sprintf("failed to issue certificate: %v", err)
		result.Error = &errStr
		log.Error().
			Err(err).
			Str("domain", cert.Domain).
			Str("method", method).
			Msg("certificate renewal failed")
		return result
	}

	// Update nginx configuration atomically
	if r.nginxManager != nil {
		err = r.nginxManager.CertificateUpdateHook(ctx, newCert, r.store, nil)
		if err != nil {
			log.Error().
				Err(err).
				Str("domain", cert.Domain).
				Int64("new_cert_id", newCert.ID).
				Msg("failed to update nginx configuration after renewal")
			// Don't fail the renewal - the certificate was issued successfully
		}
	}

	result.Success = true

	log.Info().
		Int64("old_cert_id", cert.ID).
		Int64("new_cert_id", newCert.ID).
		Str("domain", cert.Domain).
		Str("method", method).
		Dur("duration", result.Duration).
		Msg("certificate renewed successfully")

	// Audit log individual renewal
	if r.auditLogger != nil {
		r.auditLogger.RecordCertificateAction(ctx, "renewal-service", audit.ActionCertificateRenew, cert.Domain, map[string]interface{}{
			"old_cert_id": cert.ID,
			"new_cert_id": newCert.ID,
			"domain":      cert.Domain,
			"method":      method,
			"duration_ms": result.Duration.Milliseconds(),
			"old_expires": cert.NotAfter,
			"new_expires": newCert.NotAfter,
		})
	}

	return result
}

// determineRenewalMethod selects the appropriate renewal method based on domain configuration
func (r *RenewalService) determineRenewalMethod(ctx context.Context, domain string) (string, error) {
	// Check if domain has auto-managed DNS provider
	query := `
		SELECT d.auto_manage, dp.type as provider_type 
		FROM domains d 
		LEFT JOIN dns_providers dp ON d.provider_id = dp.id 
		WHERE d.domain = ?
	`

	var autoManage bool
	var providerType sql.NullString

	err := r.store.GetDB().QueryRowContext(ctx, query, domain).Scan(&autoManage, &providerType)
	if err != nil && err != sql.ErrNoRows {
		return "", fmt.Errorf("failed to check domain configuration: %w", err)
	}

	// Prefer DNS-01 if domain has auto-managed provider
	if autoManage && providerType.Valid {
		log.Debug().
			Str("domain", domain).
			Str("provider_type", providerType.String).
			Msg("using DNS-01 renewal method (auto-managed domain)")
		return "dns-01", nil
	}

	// Fall back to HTTP-01 if PUBLIC_EDGE is available
	if r.config.PublicEdgeHost != "" || r.config.PublicEdgeIPv4 != "" || r.config.PublicEdgeIPv6 != "" {
		log.Debug().
			Str("domain", domain).
			Msg("using HTTP-01 renewal method (PUBLIC_EDGE available)")
		return "http-01", nil
	}

	return "", fmt.Errorf("no suitable renewal method available for domain %s", domain)
}

// ForceRenewal manually triggers renewal for a specific domain
func (r *RenewalService) ForceRenewal(ctx context.Context, domain string) (*RenewalResult, error) {
	// Get the certificate for this domain
	query := `
		SELECT id, domain, type, issuer, not_before, not_after, status, 
			   pem_cert, pem_chain, pem_key_enc, pem_key_nonce, 
			   created_at, updated_at
		FROM certificates_enhanced 
		WHERE domain = ? AND status = 'active'
		ORDER BY created_at DESC
		LIMIT 1
	`

	var cert store.EnhancedCertificate
	err := r.store.GetDB().QueryRowContext(ctx, query, domain).Scan(
		&cert.ID, &cert.Domain, &cert.Type, &cert.Issuer,
		&cert.NotBefore, &cert.NotAfter, &cert.Status,
		&cert.PEMCert, &cert.PEMChain, &cert.PEMKeyEnc, &cert.PEMKeyNonce,
		&cert.CreatedAt, &cert.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("no active certificate found for domain %s", domain)
		}
		return nil, fmt.Errorf("failed to get certificate for domain %s: %w", domain, err)
	}

	log.Info().
		Str("domain", domain).
		Int64("cert_id", cert.ID).
		Msg("forcing certificate renewal")

	result := r.renewCertificate(ctx, cert)
	return &result, nil
}

// GetRenewalStats returns current renewal statistics
func (r *RenewalService) GetRenewalStats(ctx context.Context) (*RenewalStats, error) {
	// Get count of certificates expiring within threshold
	cutoff := time.Now().Add(r.renewalThreshold)

	var totalActive int
	var eligibleForRenewal int

	// Count total active certificates
	err := r.store.GetDB().QueryRowContext(ctx,
		"SELECT COUNT(*) FROM certificates_enhanced WHERE status = 'active'").Scan(&totalActive)
	if err != nil {
		return nil, fmt.Errorf("failed to count active certificates: %w", err)
	}

	// Count certificates eligible for renewal
	err = r.store.GetDB().QueryRowContext(ctx,
		"SELECT COUNT(*) FROM certificates_enhanced WHERE status = 'active' AND not_after IS NOT NULL AND not_after <= ?",
		cutoff).Scan(&eligibleForRenewal)
	if err != nil {
		return nil, fmt.Errorf("failed to count certificates eligible for renewal: %w", err)
	}

	return &RenewalStats{
		TotalScanned:       totalActive,
		EligibleForRenewal: eligibleForRenewal,
		StartTime:          time.Now(),
	}, nil
}
