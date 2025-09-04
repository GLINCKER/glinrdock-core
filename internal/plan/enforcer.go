package plan

import (
	"context"
	"errors"
	"fmt"

	"github.com/GLINCKER/glinrdock/internal/config"
	"github.com/GLINCKER/glinrdock/internal/license"
)

var (
	// ErrTokenQuota is returned when token creation would exceed plan limits
	ErrTokenQuota = errors.New("token quota exceeded")
	
	// ErrClientQuota is returned when client registration would exceed plan limits
	ErrClientQuota = errors.New("client quota exceeded")
	
	// ErrUserQuota is returned when user creation would exceed plan limits
	ErrUserQuota = errors.New("user quota exceeded")
	
	// ErrFeatureLocked is returned when trying to use a feature not available in current plan
	ErrFeatureLocked = errors.New("feature locked")
)

// Store interface for plan enforcement operations
type Store interface {
	TokenCount(ctx context.Context) (int, error)
	CountActiveClients(ctx context.Context) (int, error)
	UserCount(ctx context.Context) (int, error) // Future implementation
}

// Enforcer manages plan limits and feature access
type Enforcer struct {
	plan      config.Plan
	limits    config.PlanLimits
	license   *license.License
	features  []string
}

// New creates a new plan enforcer
func New(planConfig *config.PlanConfig) *Enforcer {
	return &Enforcer{
		plan:   planConfig.Plan,
		limits: planConfig.Limits,
	}
}

// FromLicense creates a plan enforcer from a verified license
func FromLicense(lic *license.License) *Enforcer {
	var plan config.Plan
	var limits config.PlanLimits

	// Convert license plan to config plan
	switch lic.Plan {
	case "FREE":
		plan = config.PlanFree
		limits = config.PlanLimits{
			MaxTokens:  3,
			MaxClients: 2,
			MaxUsers:   1,
		}
	case "PRO":
		plan = config.PlanPro
		limits = config.PlanLimits{
			MaxTokens:  50,
			MaxClients: 20,
			MaxUsers:   10,
		}
	case "PREMIUM":
		plan = config.PlanPremium
		limits = config.PlanLimits{
			MaxTokens:  -1, // Unlimited
			MaxClients: -1, // Unlimited
			MaxUsers:   -1, // Unlimited
		}
	default:
		// Default to FREE for unknown plans
		plan = config.PlanFree
		limits = config.PlanLimits{
			MaxTokens:  3,
			MaxClients: 2,
			MaxUsers:   1,
		}
	}

	// Override limits if license specifies seats
	if lic.Seats > 0 {
		limits.MaxUsers = lic.Seats
	}

	return &Enforcer{
		plan:     plan,
		limits:   limits,
		license:  lic,
		features: lic.Features,
	}
}

// NewWithLicenseFallback creates an enforcer with license precedence
func NewWithLicenseFallback(lic *license.License, planConfig *config.PlanConfig) *Enforcer {
	if lic != nil && !lic.IsExpired() {
		return FromLicense(lic)
	}
	return New(planConfig)
}

// CheckTokenQuota verifies if a new token can be created within plan limits
func (e *Enforcer) CheckTokenQuota(ctx context.Context, store Store) error {
	if e.limits.IsUnlimited(e.limits.MaxTokens) {
		return nil
	}
	
	current, err := store.TokenCount(ctx)
	if err != nil {
		return fmt.Errorf("failed to check token count: %w", err)
	}
	
	if current >= e.limits.MaxTokens {
		return fmt.Errorf("%w: %d/%d tokens used", ErrTokenQuota, current, e.limits.MaxTokens)
	}
	
	return nil
}

// CheckClientQuota verifies if a new client can be registered within plan limits
func (e *Enforcer) CheckClientQuota(ctx context.Context, store Store) error {
	if e.limits.IsUnlimited(e.limits.MaxClients) {
		return nil
	}
	
	current, err := store.CountActiveClients(ctx)
	if err != nil {
		return fmt.Errorf("failed to check client count: %w", err)
	}
	
	if current >= e.limits.MaxClients {
		return fmt.Errorf("%w: %d/%d clients used", ErrClientQuota, current, e.limits.MaxClients)
	}
	
	return nil
}

// CheckUserQuota verifies if a new user can be created within plan limits
// This is prepared for future user management implementation
func (e *Enforcer) CheckUserQuota(ctx context.Context, store Store) error {
	// For now, only Free plan allows 1 admin user, others are locked
	if e.plan == config.PlanFree {
		return fmt.Errorf("%w: user management not available in free plan", ErrFeatureLocked)
	}
	
	if e.limits.IsUnlimited(e.limits.MaxUsers) {
		return nil
	}
	
	current, err := store.UserCount(ctx)
	if err != nil {
		return fmt.Errorf("failed to check user count: %w", err)
	}
	
	if current >= e.limits.MaxUsers {
		return fmt.Errorf("%w: %d/%d users used", ErrUserQuota, current, e.limits.MaxUsers)
	}
	
	return nil
}

// FeatureEnabled checks if a feature is enabled in the current plan
func (e *Enforcer) FeatureEnabled(feature string) bool {
	// If we have a license with specific features, check those first
	if e.license != nil && len(e.features) > 0 {
		for _, f := range e.features {
			if f == feature {
				return true
			}
		}
		// For license-based plans, only allow explicitly listed features + core features
		return e.isCoreFeature(feature)
	}

	// Fall back to plan-based feature checking
	switch feature {
	case "smtp_alerts":
		return e.plan == config.PlanPro || e.plan == config.PlanPremium
		
	case "ssl_certs":
		return e.plan == config.PlanPro || e.plan == config.PlanPremium
		
	case "oauth":
		return e.plan == config.PlanPremium
		
	case "multi_env":
		return e.plan == config.PlanPremium
		
	case "sso":
		return e.plan == config.PlanPremium
		
	case "audit_logs":
		return e.plan == config.PlanPremium
		
	case "ci_integrations":
		return e.plan == config.PlanPro || e.plan == config.PlanPremium
		
	case "advanced_dashboards":
		return e.plan == config.PlanPremium
		
	default:
		return e.isCoreFeature(feature)
	}
}

// isCoreFeature checks if a feature is a core feature available in all plans
func (e *Enforcer) isCoreFeature(feature string) bool {
	switch feature {
	case "projects", "services", "routes", "logs", "basic_metrics", "lockdown", "emergency_restart":
		return true
	default:
		return false
	}
}

// GetPlan returns the current plan
func (e *Enforcer) GetPlan() config.Plan {
	return e.plan
}

// GetLimits returns the current plan limits
func (e *Enforcer) GetLimits() config.PlanLimits {
	return e.limits
}

// GetLicense returns the current license (may be nil)
func (e *Enforcer) GetLicense() *license.License {
	return e.license
}

// HasLicense returns true if a valid license is active
func (e *Enforcer) HasLicense() bool {
	return e.license != nil && !e.license.IsExpired()
}

// GetFeatures returns the list of enabled features
func (e *Enforcer) GetFeatures() []string {
	if e.license != nil {
		// For license-based enforcement, return license features + core features
		features := make([]string, 0, len(e.features)+7)
		features = append(features, e.features...)
		// Add core features
		coreFeatures := []string{"projects", "services", "routes", "logs", "basic_metrics", "lockdown", "emergency_restart"}
		features = append(features, coreFeatures...)
		return features
	}

	// For plan-based enforcement, return features based on plan
	var features []string
	
	// Core features always included
	features = append(features, "projects", "services", "routes", "logs", "basic_metrics", "lockdown", "emergency_restart")
	
	// Plan-specific features
	switch e.plan {
	case config.PlanPremium:
		features = append(features, "oauth", "multi_env", "sso", "audit_logs", "advanced_dashboards")
		fallthrough
	case config.PlanPro:
		features = append(features, "smtp_alerts", "ci_integrations", "ssl_certs")
	}
	
	return features
}

// GetUsage retrieves current usage statistics
func (e *Enforcer) GetUsage(ctx context.Context, store Store) (Usage, error) {
	usage := Usage{}
	
	// Get token count
	tokenCount, err := store.TokenCount(ctx)
	if err != nil {
		return usage, fmt.Errorf("failed to get token count: %w", err)
	}
	usage.Tokens = tokenCount
	
	// Get client count
	clientCount, err := store.CountActiveClients(ctx)
	if err != nil {
		return usage, fmt.Errorf("failed to get client count: %w", err)
	}
	usage.Clients = clientCount
	
	// Get user count (future implementation, return 1 for now representing admin)
	usage.Users = 1
	
	return usage, nil
}

// Usage represents current resource usage
type Usage struct {
	Tokens  int `json:"tokens"`
	Clients int `json:"clients"`
	Users   int `json:"users"`
}

// QuotaError provides detailed information about quota violations
type QuotaError struct {
	Type        string `json:"type"`
	Message     string `json:"message"`
	Current     int    `json:"current"`
	Limit       int    `json:"limit"`
	Plan        string `json:"plan"`
	UpgradeHint string `json:"upgrade_hint"`
}

// Error implements the error interface
func (qe QuotaError) Error() string {
	return qe.Message
}

// NewQuotaError creates a structured quota error with upgrade hints
func NewQuotaError(errType string, current, limit int, plan config.Plan) *QuotaError {
	var upgradeHint string
	switch plan {
	case config.PlanFree:
		upgradeHint = "Set GLINRDOCK_PLAN=PRO to increase limits"
	case config.PlanPro:
		upgradeHint = "Set GLINRDOCK_PLAN=PREMIUM for unlimited resources"
	default:
		upgradeHint = "Contact support for assistance"
	}
	
	return &QuotaError{
		Type:        errType,
		Message:     fmt.Sprintf("%s quota exceeded: %d/%d used", errType, current, limit),
		Current:     current,
		Limit:       limit,
		Plan:        plan.String(),
		UpgradeHint: upgradeHint,
	}
}