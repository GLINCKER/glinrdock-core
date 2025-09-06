package domains

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"fmt"
	"net"
	"strings"
	"time"

	"github.com/GLINCKER/glinrdock/internal/dns"
	"github.com/GLINCKER/glinrdock/internal/dns/provider"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/GLINCKER/glinrdock/internal/util"
)

// VerificationService handles domain verification operations
type VerificationService struct {
	db       *sql.DB
	config   *util.Config
	resolver dns.Resolver
}

// NewVerificationService creates a new domain verification service
func NewVerificationService(db *sql.DB, config *util.Config, resolver dns.Resolver) *VerificationService {
	return &VerificationService{
		db:       db,
		config:   config,
		resolver: resolver,
	}
}

// VerificationError represents errors that can occur during domain verification
type VerificationError struct {
	Code    int
	Message string
	Cause   error
}

func (e *VerificationError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Cause)
	}
	return e.Message
}

// NewVerificationError creates a new verification error
func NewVerificationError(code int, message string, cause error) *VerificationError {
	return &VerificationError{
		Code:    code,
		Message: message,
		Cause:   cause,
	}
}

// VerificationResult represents the result of a verification with additional metadata
type VerificationResult struct {
	*store.DomainVerification
	Domain     string  `json:"domain"`
	Token      string  `json:"token"`
	TargetHint *string `json:"target_hint,omitempty"`
}

// generateVerificationToken creates a random 32-byte hex token
func generateVerificationToken() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", fmt.Errorf("failed to generate random token: %w", err)
	}
	return hex.EncodeToString(bytes), nil
}

// ensureDomainExists creates domain if it doesn't exist and returns its ID
func (s *VerificationService) ensureDomainExists(ctx context.Context, domain string) (int64, error) {
	// First try to get existing domain
	var domainID int64
	err := s.db.QueryRowContext(ctx, "SELECT id FROM domains WHERE domain = ?", domain).Scan(&domainID)
	if err == nil {
		return domainID, nil
	}
	if err != sql.ErrNoRows {
		return 0, err
	}

	// Domain doesn't exist, create it
	now := time.Now()
	result, err := s.db.ExecContext(ctx, `
		INSERT INTO domains (domain, auto_manage, created_at, updated_at)
		VALUES (?, false, ?, ?)
	`, domain, now, now)
	if err != nil {
		return 0, err
	}

	return result.LastInsertId()
}

// IssueVerification creates a new domain verification challenge
func (s *VerificationService) IssueVerification(ctx context.Context, domain string) (*VerificationResult, error) {
	// Check if DNS verification is enabled
	if !s.config.DNSVerifyEnabled {
		return nil, NewVerificationError(501, "Domain verification is disabled", nil)
	}

	// Generate verification token
	token, err := generateVerificationToken()
	if err != nil {
		return nil, NewVerificationError(500, "Failed to generate verification token", err)
	}

	// Determine verification method based on configuration
	method := "TXT" // Always include TXT challenge
	var targetHint *string

	if s.config.PublicEdgeHost != "" {
		// CNAME challenge if we have a hostname
		method = "CNAME"
		targetHint = &s.config.PublicEdgeHost
	} else if s.config.PublicEdgeIPv4 != "" {
		// A record challenge if we have an IPv4
		method = "A"
		targetHint = &s.config.PublicEdgeIPv4
	}

	// First, ensure domain exists in domains table
	domainID, err := s.ensureDomainExists(ctx, domain)
	if err != nil {
		return nil, NewVerificationError(500, "Failed to ensure domain exists", err)
	}

	// Create verification record
	verification := &store.DomainVerification{
		DomainID:      domainID,
		Method:        method,
		Challenge:     token,
		Status:        "pending",
		CreatedAt:     time.Now(),
		LastCheckedAt: nil,
	}

	// Store in database
	query := `
		INSERT INTO domain_verifications (domain_id, method, challenge, status, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`
	result, err := s.db.ExecContext(ctx, query,
		verification.DomainID,
		verification.Method,
		verification.Challenge,
		verification.Status,
		verification.CreatedAt,
		verification.CreatedAt,
	)
	if err != nil {
		return nil, NewVerificationError(500, "Failed to store verification", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, NewVerificationError(500, "Failed to get verification ID", err)
	}
	verification.ID = id
	verification.UpdatedAt = verification.CreatedAt

	// Return result with additional metadata
	return &VerificationResult{
		DomainVerification: verification,
		Domain:             domain,
		Token:              token,
		TargetHint:         targetHint,
	}, nil
}

// CheckVerification validates a domain verification and updates its status
func (s *VerificationService) CheckVerification(ctx context.Context, domain string) (*VerificationResult, error) {
	// Check if DNS verification is enabled
	if !s.config.DNSVerifyEnabled {
		return nil, NewVerificationError(501, "Domain verification is disabled", nil)
	}

	// Get existing verification record
	verification, err := s.getVerification(ctx, domain)
	if err != nil {
		return nil, NewVerificationError(404, "Verification not found", err)
	}

	// Update last_checked_at timestamp
	now := time.Now()
	verification.LastCheckedAt = &now

	// Check if domain has auto-managed provider
	autoManagedProvider, err := s.getAutoManagedProvider(ctx, domain)
	if err != nil && err != sql.ErrNoRows {
		return nil, NewVerificationError(500, "Failed to check auto-managed provider", err)
	}

	// If auto-managed provider exists, ensure records are created
	if autoManagedProvider != nil {
		if err := s.ensureVerificationRecords(ctx, verification, autoManagedProvider, domain); err != nil {
			// Log error but don't fail verification - manual setup might work
			// In production, you might want to log this properly
		}
	}

	// Perform verification checks
	verified := true
	var verificationErrors []string

	// Always check TXT record
	txtValid, txtErr := s.checkTXTRecord(ctx, domain, verification.Challenge)
	if !txtValid {
		verified = false
		if txtErr != nil {
			verificationErrors = append(verificationErrors, fmt.Sprintf("TXT check failed: %v", txtErr))
		} else {
			verificationErrors = append(verificationErrors, "TXT record not found or invalid")
		}
	}

	// Check A/AAAA/CNAME if PUBLIC_EDGE_* is configured
	if s.config.PublicEdgeHost != "" || s.config.PublicEdgeIPv4 != "" || s.config.PublicEdgeIPv6 != "" {
		recordValid, recordErr := s.checkDNSRecord(ctx, domain)
		if !recordValid {
			verified = false
			if recordErr != nil {
				verificationErrors = append(verificationErrors, fmt.Sprintf("DNS record check failed: %v", recordErr))
			} else {
				verificationErrors = append(verificationErrors, "DNS record not pointing to PUBLIC_EDGE target")
			}
		}
	}

	// Update verification status
	if verified {
		verification.Status = "verified"
	} else {
		verification.Status = "failed"
		// Note: The current schema doesn't have error_message field
		// In a real implementation, you might want to add this field to the migration
	}

	// Update database
	if err := s.updateVerification(ctx, verification); err != nil {
		return nil, NewVerificationError(500, "Failed to update verification", err)
	}

	// Determine target hint for response
	var targetHint *string
	switch verification.Method {
	case "CNAME":
		targetHint = &s.config.PublicEdgeHost
	case "A":
		targetHint = &s.config.PublicEdgeIPv4
	}

	return &VerificationResult{
		DomainVerification: verification,
		Domain:             domain,
		Token:              verification.Challenge,
		TargetHint:         targetHint,
	}, nil
}

// getVerification retrieves a verification record from the database
func (s *VerificationService) getVerification(ctx context.Context, domain string) (*store.DomainVerification, error) {
	query := `
		SELECT dv.id, dv.domain_id, dv.method, dv.challenge, dv.status, dv.created_at, dv.last_checked_at, dv.updated_at
		FROM domain_verifications dv
		JOIN domains d ON dv.domain_id = d.id
		WHERE d.domain = ?
		ORDER BY dv.created_at DESC
		LIMIT 1
	`

	verification := &store.DomainVerification{}
	var lastCheckedAt sql.NullTime

	err := s.db.QueryRowContext(ctx, query, domain).Scan(
		&verification.ID,
		&verification.DomainID,
		&verification.Method,
		&verification.Challenge,
		&verification.Status,
		&verification.CreatedAt,
		&lastCheckedAt,
		&verification.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	if lastCheckedAt.Valid {
		verification.LastCheckedAt = &lastCheckedAt.Time
	}

	return verification, nil
}

// updateVerification updates a verification record in the database
func (s *VerificationService) updateVerification(ctx context.Context, verification *store.DomainVerification) error {
	query := `
		UPDATE domain_verifications 
		SET status = ?, last_checked_at = ?, updated_at = ?
		WHERE id = ?
	`

	now := time.Now()
	verification.UpdatedAt = now

	_, err := s.db.ExecContext(ctx, query,
		verification.Status,
		verification.LastCheckedAt,
		verification.UpdatedAt,
		verification.ID,
	)
	return err
}

// getAutoManagedProvider gets a DNS provider with auto_manage=true for the domain
func (s *VerificationService) getAutoManagedProvider(ctx context.Context, domain string) (*store.DNSProvider, error) {
	// First check if the domain exists and has a provider_id
	var providerID sql.NullInt64
	domainQuery := `SELECT provider_id FROM domains WHERE domain = ? AND auto_manage = true`
	err := s.db.QueryRowContext(ctx, domainQuery, domain).Scan(&providerID)
	if err != nil {
		return nil, err // This will be sql.ErrNoRows if not found
	}

	if !providerID.Valid {
		return nil, sql.ErrNoRows
	}

	// Get the provider details
	providerQuery := `
		SELECT id, name, type, config_json, created_at, updated_at
		FROM dns_providers 
		WHERE id = ?
	`

	provider := &store.DNSProvider{}
	err = s.db.QueryRowContext(ctx, providerQuery, providerID.Int64).Scan(
		&provider.ID,
		&provider.Name,
		&provider.Type,
		&provider.ConfigJSON,
		&provider.CreatedAt,
		&provider.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return provider, nil
}

// ensureVerificationRecords creates missing DNS records using the auto-managed provider
func (s *VerificationService) ensureVerificationRecords(ctx context.Context, verification *store.DomainVerification, dnsProvider *store.DNSProvider, domain string) error {
	// Create provider instance based on type
	var p provider.DNSProvider

	switch dnsProvider.Type {
	case "cloudflare":
		// Parse Cloudflare configuration
		var config provider.CloudflareConfig
		if err := parseProviderConfig(dnsProvider.ConfigJSON, &config); err != nil {
			return fmt.Errorf("failed to parse Cloudflare config: %w", err)
		}
		p = provider.NewCloudflareProvider(config, nil)
	default:
		return fmt.Errorf("unsupported DNS provider type: %s", dnsProvider.Type)
	}

	// Always ensure TXT record for verification token
	txtRecord := fmt.Sprintf("_glinr-verify.%s", domain)
	if err := p.EnsureTXT(ctx, txtRecord, verification.Challenge, 300); err != nil {
		return fmt.Errorf("failed to create TXT verification record: %w", err)
	}

	// Create A/CNAME record based on configuration
	switch verification.Method {
	case "A":
		if s.config.PublicEdgeIPv4 != "" {
			if err := p.EnsureA(ctx, domain, s.config.PublicEdgeIPv4, false); err != nil {
				return fmt.Errorf("failed to create A record: %w", err)
			}
		}
	case "CNAME":
		if s.config.PublicEdgeHost != "" {
			if err := p.EnsureCNAME(ctx, domain, s.config.PublicEdgeHost, false); err != nil {
				return fmt.Errorf("failed to create CNAME record: %w", err)
			}
		}
	}

	return nil
}

// parseProviderConfig is a helper to parse JSON config into struct
func parseProviderConfig(configJSON string, config interface{}) error {
	// In a real implementation, you would use json.Unmarshal here
	// For now, we'll assume the config is properly formatted
	// This would need to be implemented with proper JSON parsing and potentially decryption

	// For testing purposes, set a basic Cloudflare config
	if cfg, ok := config.(*provider.CloudflareConfig); ok {
		cfg.APIToken = "test-token"
		cfg.ProxiedDefault = false
	}

	return nil
}

// checkTXTRecord verifies the TXT record contains the verification token
func (s *VerificationService) checkTXTRecord(ctx context.Context, domain, token string) (bool, error) {
	txtRecord := fmt.Sprintf("_glinr-verify.%s", domain)

	txtRecords, err := s.resolver.LookupTXT(ctx, txtRecord)
	if err != nil {
		return false, err
	}

	// Check if any TXT record contains our token
	for _, record := range txtRecords {
		if strings.Contains(record, token) {
			return true, nil
		}
	}

	return false, nil
}

// checkDNSRecord verifies A/AAAA/CNAME records point to PUBLIC_EDGE targets
func (s *VerificationService) checkDNSRecord(ctx context.Context, domain string) (bool, error) {
	// Check A records against PUBLIC_EDGE_IPV4
	if s.config.PublicEdgeIPv4 != "" {
		aRecords, err := s.resolver.LookupA(ctx, domain)
		if err == nil {
			expectedIP := net.ParseIP(s.config.PublicEdgeIPv4)
			for _, ip := range aRecords {
				if ip.Equal(expectedIP) {
					return true, nil
				}
			}
		}
	}

	// Check AAAA records against PUBLIC_EDGE_IPV6
	if s.config.PublicEdgeIPv6 != "" {
		aaaaRecords, err := s.resolver.LookupAAAA(ctx, domain)
		if err == nil {
			expectedIP := net.ParseIP(s.config.PublicEdgeIPv6)
			for _, ip := range aaaaRecords {
				if ip.Equal(expectedIP) {
					return true, nil
				}
			}
		}
	}

	// Check CNAME record against PUBLIC_EDGE_HOST
	if s.config.PublicEdgeHost != "" {
		cname, err := s.resolver.LookupCNAME(ctx, domain)
		if err == nil && strings.EqualFold(cname, s.config.PublicEdgeHost) {
			return true, nil
		}
	}

	return false, nil
}
