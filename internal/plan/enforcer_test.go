package plan

import (
	"context"
	"strings"
	"testing"

	"github.com/GLINCKER/glinrdock/internal/config"
)

// MockStore implements the Store interface for testing
type MockStore struct {
	tokenCount  int
	clientCount int
	userCount   int
}

func (m *MockStore) TokenCount(ctx context.Context) (int, error) {
	return m.tokenCount, nil
}

func (m *MockStore) CountActiveClients(ctx context.Context) (int, error) {
	return m.clientCount, nil
}

func (m *MockStore) UserCount(ctx context.Context) (int, error) {
	return m.userCount, nil
}

func TestEnforcer_CheckTokenQuota(t *testing.T) {
	tests := []struct {
		name        string
		plan        config.Plan
		tokenCount  int
		expectError bool
		errorType   error
	}{
		{
			name:        "FREE plan under limit",
			plan:        config.PlanFree,
			tokenCount:  2,
			expectError: false,
		},
		{
			name:        "FREE plan at limit",
			plan:        config.PlanFree,
			tokenCount:  3,
			expectError: true,
			errorType:   ErrTokenQuota,
		},
		{
			name:        "FREE plan over limit",
			plan:        config.PlanFree,
			tokenCount:  5,
			expectError: true,
			errorType:   ErrTokenQuota,
		},
		{
			name:        "PRO plan under limit",
			plan:        config.PlanPro,
			tokenCount:  8,
			expectError: false,
		},
		{
			name:        "PRO plan at limit",
			plan:        config.PlanPro,
			tokenCount:  10,
			expectError: true,
			errorType:   ErrTokenQuota,
		},
		{
			name:        "PREMIUM plan unlimited",
			plan:        config.PlanPremium,
			tokenCount:  1000,
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			planConfig := &config.PlanConfig{
				Plan:   tt.plan,
				Limits: config.GetPlanLimits(tt.plan),
			}

			enforcer := New(planConfig)
			mockStore := &MockStore{tokenCount: tt.tokenCount}

			err := enforcer.CheckTokenQuota(context.Background(), mockStore)

			if tt.expectError {
				if err == nil {
					t.Errorf("expected error but got none")
				}
				if tt.errorType != nil && !isErrorType(err, tt.errorType) {
					t.Errorf("expected error type %v but got %v", tt.errorType, err)
				}
			} else {
				if err != nil {
					t.Errorf("expected no error but got %v", err)
				}
			}
		})
	}
}

func TestEnforcer_CheckClientQuota(t *testing.T) {
	tests := []struct {
		name        string
		plan        config.Plan
		clientCount int
		expectError bool
		errorType   error
	}{
		{
			name:        "FREE plan under limit",
			plan:        config.PlanFree,
			clientCount: 1,
			expectError: false,
		},
		{
			name:        "FREE plan at limit",
			plan:        config.PlanFree,
			clientCount: 2,
			expectError: true,
			errorType:   ErrClientQuota,
		},
		{
			name:        "PRO plan under limit",
			plan:        config.PlanPro,
			clientCount: 8,
			expectError: false,
		},
		{
			name:        "PREMIUM plan unlimited",
			plan:        config.PlanPremium,
			clientCount: 1000,
			expectError: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			planConfig := &config.PlanConfig{
				Plan:   tt.plan,
				Limits: config.GetPlanLimits(tt.plan),
			}

			enforcer := New(planConfig)
			mockStore := &MockStore{clientCount: tt.clientCount}

			err := enforcer.CheckClientQuota(context.Background(), mockStore)

			if tt.expectError {
				if err == nil {
					t.Errorf("expected error but got none")
				}
				if tt.errorType != nil && !isErrorType(err, tt.errorType) {
					t.Errorf("expected error type %v but got %v", tt.errorType, err)
				}
			} else {
				if err != nil {
					t.Errorf("expected no error but got %v", err)
				}
			}
		})
	}
}

func TestEnforcer_FeatureEnabled(t *testing.T) {
	tests := []struct {
		name     string
		plan     config.Plan
		feature  string
		expected bool
	}{
		// Core features available in all plans
		{
			name:     "FREE plan core features",
			plan:     config.PlanFree,
			feature:  "projects",
			expected: true,
		},
		{
			name:     "FREE plan lockdown",
			plan:     config.PlanFree,
			feature:  "lockdown",
			expected: true,
		},

		// Pro features
		{
			name:     "FREE plan SMTP alerts",
			plan:     config.PlanFree,
			feature:  "smtp_alerts",
			expected: false,
		},
		{
			name:     "PRO plan SMTP alerts",
			plan:     config.PlanPro,
			feature:  "smtp_alerts",
			expected: true,
		},
		{
			name:     "PRO plan CI integrations",
			plan:     config.PlanPro,
			feature:  "ci_integrations",
			expected: true,
		},

		// Premium features
		{
			name:     "FREE plan SSO",
			plan:     config.PlanFree,
			feature:  "sso",
			expected: false,
		},
		{
			name:     "PRO plan SSO",
			plan:     config.PlanPro,
			feature:  "sso",
			expected: false,
		},
		{
			name:     "PREMIUM plan SSO",
			plan:     config.PlanPremium,
			feature:  "sso",
			expected: true,
		},
		{
			name:     "PREMIUM plan audit logs",
			plan:     config.PlanPremium,
			feature:  "audit_logs",
			expected: true,
		},

		// Unknown features
		{
			name:     "unknown feature",
			plan:     config.PlanPremium,
			feature:  "unknown_feature",
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			planConfig := &config.PlanConfig{
				Plan:   tt.plan,
				Limits: config.GetPlanLimits(tt.plan),
			}

			enforcer := New(planConfig)
			result := enforcer.FeatureEnabled(tt.feature)

			if result != tt.expected {
				t.Errorf("expected %v but got %v for feature %s on plan %s", tt.expected, result, tt.feature, tt.plan)
			}
		})
	}
}

func TestEnforcer_GetUsage(t *testing.T) {
	planConfig := &config.PlanConfig{
		Plan:   config.PlanFree,
		Limits: config.GetPlanLimits(config.PlanFree),
	}

	enforcer := New(planConfig)
	mockStore := &MockStore{
		tokenCount:  2,
		clientCount: 1,
		userCount:   1,
	}

	usage, err := enforcer.GetUsage(context.Background(), mockStore)
	if err != nil {
		t.Fatalf("expected no error but got %v", err)
	}

	if usage.Tokens != 2 {
		t.Errorf("expected 2 tokens but got %d", usage.Tokens)
	}
	if usage.Clients != 1 {
		t.Errorf("expected 1 client but got %d", usage.Clients)
	}
	if usage.Users != 1 {
		t.Errorf("expected 1 user but got %d", usage.Users)
	}
}

func TestNewQuotaError(t *testing.T) {
	err := NewQuotaError("token", 3, 3, config.PlanFree)

	if err.Type != "token" {
		t.Errorf("expected type 'token' but got '%s'", err.Type)
	}
	if err.Current != 3 {
		t.Errorf("expected current 3 but got %d", err.Current)
	}
	if err.Limit != 3 {
		t.Errorf("expected limit 3 but got %d", err.Limit)
	}
	if err.Plan != "FREE" {
		t.Errorf("expected plan 'FREE' but got '%s'", err.Plan)
	}
	if err.UpgradeHint != "Set GLINRDOCK_PLAN=PRO to increase limits" {
		t.Errorf("unexpected upgrade hint: %s", err.UpgradeHint)
	}
}

// Helper function to check error types
func isErrorType(err error, expectedType error) bool {
	if expectedType == ErrTokenQuota {
		return isTokenQuotaError(err)
	}
	if expectedType == ErrClientQuota {
		return isClientQuotaError(err)
	}
	return err.Error() == expectedType.Error()
}

// Helper to check if error is a token quota error
func isTokenQuotaError(err error) bool {
	return err != nil && strings.Contains(err.Error(), "token quota exceeded")
}

// Helper to check if error is a client quota error
func isClientQuotaError(err error) bool {
	return err != nil && strings.Contains(err.Error(), "client quota exceeded")
}
