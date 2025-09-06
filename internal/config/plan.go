package config

import (
	"os"
	"strconv"
	"strings"
)

// Plan represents the subscription tier
type Plan string

const (
	PlanFree    Plan = "FREE"
	PlanPro     Plan = "PRO"
	PlanPremium Plan = "PREMIUM"
)

// PlanLimits defines the resource limits for each plan
type PlanLimits struct {
	MaxTokens  int
	MaxClients int
	MaxUsers   int
}

// PlanConfig holds plan-related configuration
type PlanConfig struct {
	Plan   Plan
	Limits PlanLimits
}

// ResolvePlan determines the active plan from environment variables
func ResolvePlan() Plan {
	planEnv := strings.ToUpper(os.Getenv("GLINRDOCK_PLAN"))
	switch planEnv {
	case "PRO":
		return PlanPro
	case "PREMIUM":
		return PlanPremium
	default:
		return PlanFree
	}
}

// GetPlanLimits returns the resource limits for the specified plan
func GetPlanLimits(plan Plan) PlanLimits {
	switch plan {
	case PlanFree:
		return PlanLimits{
			MaxTokens:  getEnvInt("FREE_MAX_TOKENS", 3),
			MaxClients: getEnvInt("FREE_MAX_CLIENTS", 2),
			MaxUsers:   1, // Always 1 for free plan
		}
	case PlanPro:
		return PlanLimits{
			MaxTokens:  getEnvInt("PRO_MAX_TOKENS", 10),
			MaxClients: getEnvInt("PRO_MAX_CLIENTS", 10),
			MaxUsers:   10, // Pro supports multiple users
		}
	case PlanPremium:
		return PlanLimits{
			MaxTokens:  -1, // Unlimited
			MaxClients: -1, // Unlimited
			MaxUsers:   -1, // Unlimited
		}
	default:
		return GetPlanLimits(PlanFree)
	}
}

// NewPlanConfig creates a new plan configuration
func NewPlanConfig() *PlanConfig {
	plan := ResolvePlan()
	return &PlanConfig{
		Plan:   plan,
		Limits: GetPlanLimits(plan),
	}
}

// IsUnlimited returns true if the limit is set to unlimited (-1)
func (l PlanLimits) IsUnlimited(limit int) bool {
	return limit == -1
}

// getEnvInt retrieves an integer environment variable with a default fallback
func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if parsed, err := strconv.Atoi(value); err == nil {
			return parsed
		}
	}
	return defaultValue
}

// String returns the string representation of a plan
func (p Plan) String() string {
	return string(p)
}

// IsValid checks if the plan is a valid plan type
func (p Plan) IsValid() bool {
	switch p {
	case PlanFree, PlanPro, PlanPremium:
		return true
	default:
		return false
	}
}
