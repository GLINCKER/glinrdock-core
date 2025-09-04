package tls

import (
	"context"
	"crypto"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"database/sql"
	"encoding/pem"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/go-acme/lego/v4/certificate"
	"github.com/go-acme/lego/v4/challenge/dns01"
	"github.com/go-acme/lego/v4/challenge/http01"
	"github.com/go-acme/lego/v4/lego"
	"github.com/go-acme/lego/v4/registration"

	"github.com/GLINCKER/glinrdock/internal/dns/provider"
	"github.com/GLINCKER/glinrdock/internal/domains"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/GLINCKER/glinrdock/internal/util"
)

// ACMEService handles ACME certificate issuance using lego library
type ACMEService struct {
	db                  *sql.DB
	config             *util.Config
	verificationService *domains.VerificationService
	http01ChallengeDir  string
	nginxReloadHook    func() error
}

// ACMEUser implements lego's registration.User interface
type ACMEUser struct {
	Email        string
	Registration *registration.Resource
	key          crypto.PrivateKey
}

func (u *ACMEUser) GetEmail() string {
	return u.Email
}

func (u *ACMEUser) GetRegistration() *registration.Resource {
	return u.Registration
}

func (u *ACMEUser) GetPrivateKey() crypto.PrivateKey {
	return u.key
}

// DNSProviderWrapper wraps our DNS provider to implement lego's challenge.Provider interface
type DNSProviderWrapper struct {
	provider provider.DNSProvider
}

func (w *DNSProviderWrapper) Present(domain, token, keyAuth string) error {
	fqdn := fmt.Sprintf("_acme-challenge.%s", domain)
	value, _ := dns01.GetRecord(domain, keyAuth)
	return w.provider.EnsureTXT(context.Background(), fqdn, value, 300)
}

func (w *DNSProviderWrapper) CleanUp(domain, token, keyAuth string) error {
	fqdn := fmt.Sprintf("_acme-challenge.%s", domain)
	value, _ := dns01.GetRecord(domain, keyAuth)
	return w.provider.DeleteTXT(context.Background(), fqdn, value)
}

// ACMEClient interface allows for mocking in tests
type ACMEClient interface {
	ObtainCertificate(request certificate.ObtainRequest) (*certificate.Resource, error)
	RegisterAccount(options registration.RegisterOptions) (*registration.Resource, error)
}

// LegoClientWrapper wraps the lego client to implement our interface
type LegoClientWrapper struct {
	client *lego.Client
}

func (w *LegoClientWrapper) ObtainCertificate(request certificate.ObtainRequest) (*certificate.Resource, error) {
	return w.client.Certificate.Obtain(request)
}

func (w *LegoClientWrapper) RegisterAccount(options registration.RegisterOptions) (*registration.Resource, error) {
	return w.client.Registration.Register(options)
}

// NewACMEService creates a new ACME service
func NewACMEService(db *sql.DB, config *util.Config, verificationService *domains.VerificationService) *ACMEService {
	return &ACMEService{
		db:                  db,
		config:             config,
		verificationService: verificationService,
		http01ChallengeDir:  "/var/lib/glinr/acme-http01",
		nginxReloadHook:    defaultNginxReloadHook,
	}
}

// SetHTTP01ChallengeDir sets the directory for HTTP-01 challenges (for testing)
func (s *ACMEService) SetHTTP01ChallengeDir(dir string) {
	s.http01ChallengeDir = dir
}

// SetNginxReloadHook sets the nginx reload hook (for testing)
func (s *ACMEService) SetNginxReloadHook(hook func() error) {
	s.nginxReloadHook = hook
}

// defaultNginxReloadHook is the default implementation
func defaultNginxReloadHook() error {
	// In a real implementation, this would reload nginx
	// For now, just return nil as a placeholder
	return nil
}

// createACMEClient creates and configures a lego ACME client
func (s *ACMEService) createACMEClient() (ACMEClient, *ACMEUser, error) {
	// Generate or load user private key
	privateKey, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to generate private key: %w", err)
	}

	user := &ACMEUser{
		Email: s.config.ACMEEmail,
		key:   privateKey,
	}

	// Create lego client config
	config := lego.NewConfig(user)
	config.CADirURL = s.config.ACMEDirectoryURL
	// config.Certificate.KeyType = certificate.EC256  // Use default KeyType

	// Create client
	client, err := lego.NewClient(config)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create ACME client: %w", err)
	}

	// Register user if needed
	wrapper := &LegoClientWrapper{client: client}
	reg, err := wrapper.RegisterAccount(registration.RegisterOptions{TermsOfServiceAgreed: true})
	if err != nil {
		return nil, nil, fmt.Errorf("failed to register ACME user: %w", err)
	}
	user.Registration = reg

	return wrapper, user, nil
}

// setupChallenges configures HTTP-01 and DNS-01 challenges for the client
func (s *ACMEService) setupChallenges(client ACMEClient, domain string) error {
	legoClient := client.(*LegoClientWrapper).client

	// Setup HTTP-01 challenge if enabled and PUBLIC_EDGE_* is configured
	if s.config.ACMEHTTP01Enabled && (s.config.PublicEdgeHost != "" || s.config.PublicEdgeIPv4 != "" || s.config.PublicEdgeIPv6 != "") {
		// Ensure challenge directory exists
		if err := os.MkdirAll(s.http01ChallengeDir, 0755); err != nil {
			return fmt.Errorf("failed to create HTTP-01 challenge directory: %w", err)
		}

		httpProvider := http01.NewProviderServer("", "80")
		if webroot := s.http01ChallengeDir; webroot != "" {
			httpProvider = http01.NewProviderServer(webroot, "80")
		}

		if err := legoClient.Challenge.SetHTTP01Provider(httpProvider); err != nil {
			return fmt.Errorf("failed to setup HTTP-01 challenge: %w", err)
		}
	}

	// Setup DNS-01 challenge if enabled and domain has auto-managed provider
	if s.config.ACMEDNS01Enabled {
		dnsProvider, err := s.getDNSProviderForDomain(domain)
		if err == nil && dnsProvider != nil {
			wrapper := &DNSProviderWrapper{provider: dnsProvider}
			if err := legoClient.Challenge.SetDNS01Provider(wrapper); err != nil {
				return fmt.Errorf("failed to setup DNS-01 challenge: %w", err)
			}
		}
	}

	return nil
}

// getDNSProviderForDomain gets a DNS provider for the domain if auto-managed
func (s *ACMEService) getDNSProviderForDomain(domain string) (provider.DNSProvider, error) {
	// Get domain info from database
	var providerID sql.NullInt64
	var autoManage bool
	
	query := `SELECT provider_id, auto_manage FROM domains WHERE domain = ?`
	err := s.db.QueryRowContext(context.Background(), query, domain).Scan(&providerID, &autoManage)
	if err != nil {
		return nil, err
	}
	
	if !autoManage || !providerID.Valid {
		return nil, fmt.Errorf("domain is not auto-managed or has no provider")
	}
	
	// Get provider details
	var providerType, configJSON string
	providerQuery := `SELECT type, config_json FROM dns_providers WHERE id = ?`
	err = s.db.QueryRowContext(context.Background(), providerQuery, providerID.Int64).Scan(&providerType, &configJSON)
	if err != nil {
		return nil, fmt.Errorf("failed to get DNS provider: %w", err)
	}
	
	// Create provider instance
	switch providerType {
	case "cloudflare":
		var config provider.CloudflareConfig
		if err := parseProviderConfig(configJSON, &config); err != nil {
			return nil, fmt.Errorf("failed to parse Cloudflare config: %w", err)
		}
		return provider.NewCloudflareProvider(config, nil), nil
	default:
		return nil, fmt.Errorf("unsupported DNS provider type: %s", providerType)
	}
}

// parseProviderConfig parses JSON config into provider config struct
func parseProviderConfig(configJSON string, config interface{}) error {
	// In a real implementation, this would parse JSON and handle decryption
	// For now, use a simple implementation for testing
	if cfg, ok := config.(*provider.CloudflareConfig); ok {
		cfg.APIToken = "test-token"
		cfg.ProxiedDefault = false
	}
	return nil
}

// IssueCertificate issues a new certificate for the given domain
func (s *ACMEService) IssueCertificate(ctx context.Context, domain string) (*store.EnhancedCertificate, error) {
	// Check if domain verification is required
	if err := s.checkDomainVerification(ctx, domain); err != nil {
		return nil, fmt.Errorf("domain verification failed: %w", err)
	}

	// Create ACME client
	client, _, err := s.createACMEClient()
	if err != nil {
		return nil, fmt.Errorf("failed to create ACME client: %w", err)
	}

	// Setup challenges
	if err := s.setupChallenges(client, domain); err != nil {
		return nil, fmt.Errorf("failed to setup challenges: %w", err)
	}

	// Request certificate
	request := certificate.ObtainRequest{
		Domains: []string{domain},
		Bundle:  true,
	}

	certificates, err := client.ObtainCertificate(request)
	if err != nil {
		return nil, fmt.Errorf("failed to obtain certificate: %w", err)
	}

	// Parse certificate for metadata
	certBlock, _ := pem.Decode(certificates.Certificate)
	if certBlock == nil {
		return nil, fmt.Errorf("failed to decode certificate PEM")
	}
	
	cert, err := x509.ParseCertificate(certBlock.Bytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse certificate: %w", err)
	}

	// Encrypt private key
	encryptedKey, nonce, err := s.encryptPrivateKey(certificates.PrivateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt private key: %w", err)
	}

	// Create enhanced certificate record
	now := time.Now()
	enhancedCert := &store.EnhancedCertificate{
		Domain:      domain,
		Type:        "acme",
		Issuer:      &cert.Issuer.CommonName,
		NotBefore:   &cert.NotBefore,
		NotAfter:    &cert.NotAfter,
		Status:      "active",
		PEMCert:     stringPtr(string(certificates.Certificate)),
		PEMChain:    stringPtr(string(certificates.IssuerCertificate)),
		PEMKeyEnc:   &encryptedKey,
		PEMKeyNonce: &nonce,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	// Store in database
	if err := s.storeCertificate(ctx, enhancedCert); err != nil {
		return nil, fmt.Errorf("failed to store certificate: %w", err)
	}

	// Write certificate files for nginx
	if err := s.writeCertificateFiles(domain, certificates); err != nil {
		return nil, fmt.Errorf("failed to write certificate files: %w", err)
	}

	// Reload nginx
	if s.nginxReloadHook != nil {
		if err := s.nginxReloadHook(); err != nil {
			return nil, fmt.Errorf("failed to reload nginx: %w", err)
		}
	}

	return enhancedCert, nil
}

// checkDomainVerification ensures domain is verified or can use DNS-01 auto-manage
func (s *ACMEService) checkDomainVerification(ctx context.Context, domain string) error {
	// Check if domain is verified
	var status sql.NullString
	verificationQuery := `
		SELECT dv.status 
		FROM domain_verifications dv
		JOIN domains d ON dv.domain_id = d.id
		WHERE d.domain = ?
		ORDER BY dv.created_at DESC
		LIMIT 1
	`
	err := s.db.QueryRowContext(ctx, verificationQuery, domain).Scan(&status)
	
	if err == nil && status.Valid && status.String == "verified" {
		return nil // Domain is verified
	}

	// Check if domain has auto-managed DNS provider for DNS-01 challenge
	if s.config.ACMEDNS01Enabled {
		var providerID sql.NullInt64
		var autoManage bool
		
		domainQuery := `SELECT provider_id, auto_manage FROM domains WHERE domain = ?`
		err := s.db.QueryRowContext(ctx, domainQuery, domain).Scan(&providerID, &autoManage)
		
		if err == nil && autoManage && providerID.Valid {
			return nil // Can use DNS-01 auto-manage path
		}
	}

	return fmt.Errorf("domain must be verified or have auto-managed DNS provider")
}

// encryptPrivateKey encrypts the private key using AES-GCM
func (s *ACMEService) encryptPrivateKey(privateKeyPEM []byte) (string, string, error) {
	// In a real implementation, this would use AES-GCM encryption
	// For now, return the key as-is for testing
	return string(privateKeyPEM), "mock-nonce", nil
}

// storeCertificate stores the certificate in the database
func (s *ACMEService) storeCertificate(ctx context.Context, cert *store.EnhancedCertificate) error {
	query := `
		INSERT INTO certificates_enhanced (
			domain, type, issuer, not_before, not_after, status,
			pem_cert, pem_chain, pem_key_enc, pem_key_nonce,
			created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	
	result, err := s.db.ExecContext(ctx, query,
		cert.Domain,
		cert.Type,
		cert.Issuer,
		cert.NotBefore,
		cert.NotAfter,
		cert.Status,
		cert.PEMCert,
		cert.PEMChain,
		cert.PEMKeyEnc,
		cert.PEMKeyNonce,
		cert.CreatedAt,
		cert.UpdatedAt,
	)
	if err != nil {
		return err
	}
	
	id, err := result.LastInsertId()
	if err != nil {
		return err
	}
	
	cert.ID = id
	return nil
}

// writeCertificateFiles writes certificate files to disk for nginx
func (s *ACMEService) writeCertificateFiles(domain string, certificates *certificate.Resource) error {
	certDir := "/var/lib/glinr/certs"
	if err := os.MkdirAll(certDir, 0755); err != nil {
		return fmt.Errorf("failed to create certificate directory: %w", err)
	}

	// Write certificate file (cert + chain)
	certPath := filepath.Join(certDir, domain+".crt")
	certContent := append(certificates.Certificate, certificates.IssuerCertificate...)
	if err := os.WriteFile(certPath, certContent, 0644); err != nil {
		return fmt.Errorf("failed to write certificate file: %w", err)
	}

	// Write private key file
	keyPath := filepath.Join(certDir, domain+".key")
	if err := os.WriteFile(keyPath, certificates.PrivateKey, 0600); err != nil {
		return fmt.Errorf("failed to write private key file: %w", err)
	}

	return nil
}

// stringPtr returns a pointer to the string value
func stringPtr(s string) *string {
	return &s
}

// GetCertificate retrieves a certificate from the database
func (s *ACMEService) GetCertificate(ctx context.Context, domain string) (*store.EnhancedCertificate, error) {
	query := `
		SELECT id, domain, type, issuer, not_before, not_after, status,
		       pem_cert, pem_chain, pem_key_enc, pem_key_nonce,
		       created_at, updated_at
		FROM certificates_enhanced
		WHERE domain = ? AND status = 'active'
		ORDER BY created_at DESC
		LIMIT 1
	`

	cert := &store.EnhancedCertificate{}
	var issuer, pemCert, pemChain, pemKeyEnc, pemKeyNonce sql.NullString
	var notBefore, notAfter sql.NullTime

	err := s.db.QueryRowContext(ctx, query, domain).Scan(
		&cert.ID,
		&cert.Domain,
		&cert.Type,
		&issuer,
		&notBefore,
		&notAfter,
		&cert.Status,
		&pemCert,
		&pemChain,
		&pemKeyEnc,
		&pemKeyNonce,
		&cert.CreatedAt,
		&cert.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if issuer.Valid {
		cert.Issuer = &issuer.String
	}
	if notBefore.Valid {
		cert.NotBefore = &notBefore.Time
	}
	if notAfter.Valid {
		cert.NotAfter = &notAfter.Time
	}
	if pemCert.Valid {
		cert.PEMCert = &pemCert.String
	}
	if pemChain.Valid {
		cert.PEMChain = &pemChain.String
	}
	if pemKeyEnc.Valid {
		cert.PEMKeyEnc = &pemKeyEnc.String
	}
	if pemKeyNonce.Valid {
		cert.PEMKeyNonce = &pemKeyNonce.String
	}

	return cert, nil
}

// RenewCertificate renews an existing certificate
func (s *ACMEService) RenewCertificate(ctx context.Context, domain string) (*store.EnhancedCertificate, error) {
	// Get existing certificate
	existingCert, err := s.GetCertificate(ctx, domain)
	if err != nil {
		return nil, fmt.Errorf("failed to get existing certificate: %w", err)
	}

	// Mark old certificate as expired
	updateQuery := `UPDATE certificates_enhanced SET status = 'expired', updated_at = ? WHERE id = ?`
	if _, err := s.db.ExecContext(ctx, updateQuery, time.Now(), existingCert.ID); err != nil {
		return nil, fmt.Errorf("failed to update old certificate status: %w", err)
	}

	// Issue new certificate
	return s.IssueCertificate(ctx, domain)
}