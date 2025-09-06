package jobs

import (
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/GLINCKER/glinrdock/internal/proxy"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/go-acme/lego/v4/certcrypto"
	"github.com/go-acme/lego/v4/certificate"
	"github.com/go-acme/lego/v4/challenge/http01"
	"github.com/go-acme/lego/v4/lego"
	"github.com/go-acme/lego/v4/registration"
	"github.com/rs/zerolog/log"
)

// CertManager handles certificate issuance and renewal
type CertManager struct {
	store   CertStore
	proxy   *proxy.NginxConfig
	dataDir string
	acmeURL string // ACME server URL (defaults to Let's Encrypt)
	queue   *Queue // For progress updates
}

// CertStore interface for certificate-related database operations
type CertStore interface {
	UpsertCert(ctx context.Context, domain, email, status string, expiresAt *time.Time) error
	GetCert(ctx context.Context, domain string) (store.Cert, error)
	ListCerts(ctx context.Context) ([]store.Cert, error)
	ListCertsExpiringSoon(ctx context.Context, within time.Duration) ([]store.Cert, error)
}

// User represents an ACME user for Let's Encrypt registration
type User struct {
	Email        string
	Registration *registration.Resource
	key          crypto.PrivateKey
}

// GetEmail returns the user's email
func (u *User) GetEmail() string {
	return u.Email
}

// GetRegistration returns the user's registration resource
func (u *User) GetRegistration() *registration.Resource {
	return u.Registration
}

// GetPrivateKey returns the user's private key
func (u *User) GetPrivateKey() crypto.PrivateKey {
	return u.key
}

// NewCertManager creates a new certificate manager
func NewCertManager(certStore CertStore, nginxProxy *proxy.NginxConfig, dataDir string, queue *Queue) *CertManager {
	return &CertManager{
		store:   certStore,
		proxy:   nginxProxy,
		dataDir: dataDir,
		acmeURL: lego.LEDirectoryProduction, // Use Let's Encrypt production
		queue:   queue,
	}
}

// SetACMEURL sets the ACME server URL (useful for testing with staging)
func (cm *CertManager) SetACMEURL(url string) {
	cm.acmeURL = url
}

// IssueCert issues a new certificate for a domain
func (cm *CertManager) IssueCert(ctx context.Context, domain, email string) error {
	log.Info().Str("domain", domain).Str("email", email).Msg("starting certificate issuance")

	// Validate domain and email
	if err := cm.validateDomainAndEmail(domain, email); err != nil {
		return fmt.Errorf("validation failed: %w", err)
	}

	// Update cert status to renewing
	if err := cm.store.UpsertCert(ctx, domain, email, "renewing", nil); err != nil {
		log.Error().Err(err).Str("domain", domain).Msg("failed to update cert status to renewing")
	}

	// Ensure challenge directory exists
	if err := cm.proxy.CreateChallengeDir(); err != nil {
		return fmt.Errorf("failed to create challenge directory: %w", err)
	}

	// Create ACME client
	client, err := cm.createACMEClient(email)
	if err != nil {
		cm.store.UpsertCert(ctx, domain, email, "failed", nil)
		return fmt.Errorf("failed to create ACME client: %w", err)
	}

	// Set up HTTP-01 challenge
	if err := client.Challenge.SetHTTP01Provider(http01.NewProviderServer("", "80")); err != nil {
		cm.store.UpsertCert(ctx, domain, email, "failed", nil)
		return fmt.Errorf("failed to setup HTTP-01 challenge: %w", err)
	}

	// Request certificate
	request := certificate.ObtainRequest{
		Domains: []string{domain},
		Bundle:  true,
	}

	certResource, err := client.Certificate.Obtain(request)
	if err != nil {
		cm.store.UpsertCert(ctx, domain, email, "failed", nil)
		return fmt.Errorf("failed to obtain certificate: %w", err)
	}

	// Store certificate files
	if err := cm.storeCertificateFiles(domain, certResource); err != nil {
		cm.store.UpsertCert(ctx, domain, email, "failed", nil)
		return fmt.Errorf("failed to store certificate files: %w", err)
	}

	// Parse certificate to get expiry date
	cert, err := certcrypto.ParsePEMCertificate(certResource.Certificate)
	if err != nil {
		log.Warn().Err(err).Str("domain", domain).Msg("failed to parse certificate for expiry date")
	}

	var expiresAt *time.Time
	if cert != nil {
		expiresAt = &cert.NotAfter
	}

	// Update database with success
	if err := cm.store.UpsertCert(ctx, domain, email, "issued", expiresAt); err != nil {
		log.Error().Err(err).Str("domain", domain).Msg("failed to update cert status to issued")
		return fmt.Errorf("failed to update cert status: %w", err)
	}

	log.Info().
		Str("domain", domain).
		Time("expires_at", *expiresAt).
		Msg("certificate issued successfully")

	return nil
}

// RenewCert renews an existing certificate
func (cm *CertManager) RenewCert(ctx context.Context, domain string) error {
	log.Info().Str("domain", domain).Msg("starting certificate renewal")

	// Get current cert info
	cert, err := cm.store.GetCert(ctx, domain)
	if err != nil {
		return fmt.Errorf("failed to get cert info: %w", err)
	}

	return cm.IssueCert(ctx, domain, cert.Email)
}

// RenewAllCerts checks all certificates and renews those expiring within 30 days
func (cm *CertManager) RenewAllCerts(ctx context.Context) error {
	log.Info().Msg("starting renewal check for all certificates")

	// Get certificates expiring within 30 days
	certs, err := cm.store.ListCertsExpiringSoon(ctx, 30*24*time.Hour)
	if err != nil {
		return fmt.Errorf("failed to list expiring certs: %w", err)
	}

	if len(certs) == 0 {
		log.Info().Msg("no certificates need renewal")
		return nil
	}

	log.Info().Int("cert_count", len(certs)).Msg("found certificates needing renewal")

	var anyReloaded bool
	var errors []string

	for _, cert := range certs {
		log.Info().
			Str("domain", cert.Domain).
			Time("expires_at", *cert.ExpiresAt).
			Msg("renewing certificate")

		if err := cm.RenewCert(ctx, cert.Domain); err != nil {
			log.Error().
				Err(err).
				Str("domain", cert.Domain).
				Msg("failed to renew certificate")
			errors = append(errors, fmt.Sprintf("%s: %v", cert.Domain, err))
			continue
		}

		anyReloaded = true
	}

	// Reload nginx only if any certificates were renewed
	if anyReloaded {
		log.Info().Msg("reloading nginx after certificate renewals")
		if err := cm.proxy.Reload(); err != nil {
			log.Error().Err(err).Msg("failed to reload nginx after certificate renewals")
			errors = append(errors, fmt.Sprintf("nginx reload: %v", err))
		}
	}

	if len(errors) > 0 {
		return fmt.Errorf("renewal completed with errors: %s", strings.Join(errors, "; "))
	}

	log.Info().Msg("all certificate renewals completed successfully")
	return nil
}

// StartDailyRenewalJob starts the daily certificate renewal background job
func (cm *CertManager) StartDailyRenewalJob(ctx context.Context) {
	ticker := time.NewTicker(24 * time.Hour)
	defer ticker.Stop()

	// Run initial check after 5 minutes startup delay
	initialTimer := time.NewTimer(5 * time.Minute)

	log.Info().Msg("starting daily certificate renewal job")

	for {
		select {
		case <-initialTimer.C:
			// First run
			if err := cm.RenewAllCerts(ctx); err != nil {
				log.Error().Err(err).Msg("initial certificate renewal check failed")
			}

		case <-ticker.C:
			// Daily runs
			if err := cm.RenewAllCerts(ctx); err != nil {
				log.Error().Err(err).Msg("daily certificate renewal check failed")
			}

		case <-ctx.Done():
			log.Info().Msg("stopping daily certificate renewal job")
			return
		}
	}
}

// Handle processes certificate job requests
func (cm *CertManager) Handle(ctx context.Context, job *Job) error {
	switch job.Type {
	case "cert_issue":
		return cm.handleIssueJob(ctx, job)
	case "cert_renew":
		return cm.handleRenewJob(ctx, job)
	default:
		return fmt.Errorf("unknown cert job type: %s", job.Type)
	}
}

// handleIssueJob processes certificate issuance jobs
func (cm *CertManager) handleIssueJob(ctx context.Context, job *Job) error {
	domain, ok := job.Data["domain"].(string)
	if !ok {
		return fmt.Errorf("missing or invalid domain in job data")
	}

	email, ok := job.Data["email"].(string)
	if !ok {
		return fmt.Errorf("missing or invalid email in job data")
	}

	cm.queue.UpdateJobProgress(job.ID, 10)

	if err := cm.IssueCert(ctx, domain, email); err != nil {
		return fmt.Errorf("failed to issue certificate: %w", err)
	}

	cm.queue.UpdateJobProgress(job.ID, 90)

	// Reload nginx after successful issuance
	if err := cm.proxy.Reload(); err != nil {
		log.Warn().Err(err).Msg("certificate issued but nginx reload failed")
		return fmt.Errorf("certificate issued but nginx reload failed: %w", err)
	}

	cm.queue.UpdateJobProgress(job.ID, 100)
	return nil
}

// handleRenewJob processes certificate renewal jobs
func (cm *CertManager) handleRenewJob(ctx context.Context, job *Job) error {
	domain, ok := job.Data["domain"].(string)
	if !ok {
		return fmt.Errorf("missing or invalid domain in job data")
	}

	cm.queue.UpdateJobProgress(job.ID, 10)

	if err := cm.RenewCert(ctx, domain); err != nil {
		return fmt.Errorf("failed to renew certificate: %w", err)
	}

	cm.queue.UpdateJobProgress(job.ID, 90)

	// Reload nginx after successful renewal
	if err := cm.proxy.Reload(); err != nil {
		log.Warn().Err(err).Msg("certificate renewed but nginx reload failed")
		return fmt.Errorf("certificate renewed but nginx reload failed: %w", err)
	}

	cm.queue.UpdateJobProgress(job.ID, 100)
	return nil
}

// Helper methods

// validateDomainAndEmail validates domain and email format
func (cm *CertManager) validateDomainAndEmail(domain, email string) error {
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

// createACMEClient creates and configures an ACME client
func (cm *CertManager) createACMEClient(email string) (*lego.Client, error) {
	// Generate private key
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, fmt.Errorf("failed to generate private key: %w", err)
	}

	user := &User{
		Email: email,
		key:   privateKey,
	}

	config := lego.NewConfig(user)
	config.CADirURL = cm.acmeURL
	config.Certificate.KeyType = certcrypto.EC256

	client, err := lego.NewClient(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create lego client: %w", err)
	}

	// Register user
	reg, err := client.Registration.Register(registration.RegisterOptions{TermsOfServiceAgreed: true})
	if err != nil {
		return nil, fmt.Errorf("failed to register ACME user: %w", err)
	}
	user.Registration = reg

	return client, nil
}

// storeCertificateFiles saves certificate and private key to filesystem
func (cm *CertManager) storeCertificateFiles(domain string, certResource *certificate.Resource) error {
	certDir := filepath.Join(cm.dataDir, "certs", domain)
	if err := os.MkdirAll(certDir, 0755); err != nil {
		return fmt.Errorf("failed to create cert directory: %w", err)
	}

	// Write certificate
	certPath := filepath.Join(certDir, "fullchain.pem")
	if err := os.WriteFile(certPath, certResource.Certificate, 0644); err != nil {
		return fmt.Errorf("failed to write certificate: %w", err)
	}

	// Write private key
	keyPath := filepath.Join(certDir, "privkey.pem")
	if err := os.WriteFile(keyPath, certResource.PrivateKey, 0600); err != nil {
		return fmt.Errorf("failed to write private key: %w", err)
	}

	log.Info().
		Str("domain", domain).
		Str("cert_path", certPath).
		Str("key_path", keyPath).
		Msg("certificate files stored")

	return nil
}
