package api

import (
	"net/http"

	"github.com/GLINCKER/glinrdock/internal/config"
	"github.com/GLINCKER/glinrdock/internal/plan"
	"github.com/gin-gonic/gin"
)

// ErrorResponse represents a simple error response
type ErrorResponse struct {
	Error string `json:"error"`
}

// QuotaExceededResponse represents a structured error response for quota violations
type QuotaExceededResponse struct {
	Error       string `json:"error"`
	Type        string `json:"type"`
	Message     string `json:"message"`
	Current     int    `json:"current"`
	Limit       int    `json:"limit"`
	Plan        string `json:"plan"`
	UpgradeHint string `json:"upgrade_hint"`
}

// HandleTokenQuotaError returns a structured token quota error response
func HandleTokenQuotaError(c *gin.Context, current, limit int, planName config.Plan) {
	response := QuotaExceededResponse{
		Error:       "quota_exceeded",
		Type:        "token",
		Message:     "Token quota exceeded for current plan",
		Current:     current,
		Limit:       limit,
		Plan:        planName.String(),
		UpgradeHint: getUpgradeHint(planName),
	}
	
	c.JSON(http.StatusForbidden, response)
}

// HandleClientQuotaError returns a structured client quota error response
func HandleClientQuotaError(c *gin.Context, current, limit int, planName config.Plan) {
	response := QuotaExceededResponse{
		Error:       "quota_exceeded",
		Type:        "client",
		Message:     "Client quota exceeded for current plan",
		Current:     current,
		Limit:       limit,
		Plan:        planName.String(),
		UpgradeHint: getUpgradeHint(planName),
	}
	
	c.JSON(http.StatusForbidden, response)
}

// HandleUserQuotaError returns a structured user quota error response
func HandleUserQuotaError(c *gin.Context, current, limit int, planName config.Plan) {
	response := QuotaExceededResponse{
		Error:       "quota_exceeded",
		Type:        "user",
		Message:     "User quota exceeded for current plan",
		Current:     current,
		Limit:       limit,
		Plan:        planName.String(),
		UpgradeHint: getUpgradeHint(planName),
	}
	
	c.JSON(http.StatusForbidden, response)
}

// HandleFeatureLockedError returns a structured error for locked features
func HandleFeatureLockedError(c *gin.Context, feature string, planName config.Plan) {
	c.JSON(http.StatusForbidden, gin.H{
		"error":        "feature_locked",
		"message":      "Feature not available in current plan",
		"feature":      feature,
		"plan":         planName.String(),
		"upgrade_hint": getUpgradeHint(planName),
	})
}

// HandlePlanError handles plan enforcement errors and returns appropriate responses
func HandlePlanError(c *gin.Context, err error, planName config.Plan, usage plan.Usage, limits config.PlanLimits) {
	switch {
	case err == plan.ErrTokenQuota:
		HandleTokenQuotaError(c, usage.Tokens, limits.MaxTokens, planName)
		
	case err == plan.ErrClientQuota:
		HandleClientQuotaError(c, usage.Clients, limits.MaxClients, planName)
		
	case err == plan.ErrUserQuota:
		HandleUserQuotaError(c, usage.Users, limits.MaxUsers, planName)
		
	case err == plan.ErrFeatureLocked:
		HandleFeatureLockedError(c, "user_management", planName)
		
	default:
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "plan_enforcement_error",
			"message": "Failed to check plan limits",
		})
	}
}

// getUpgradeHint returns appropriate upgrade suggestions based on current plan
func getUpgradeHint(planName config.Plan) string {
	switch planName {
	case config.PlanFree:
		return "Set GLINRDOCK_PLAN=PRO to increase limits"
	case config.PlanPro:
		return "Set GLINRDOCK_PLAN=PREMIUM for unlimited resources"
	default:
		return "Contact support for assistance"
	}
}

// SystemPlanResponse represents the response structure for plan information
type SystemPlanResponse struct {
	Plan   string                `json:"plan"`
	Limits config.PlanLimits     `json:"limits"`
	Usage  plan.Usage           `json:"usage"`
	Features map[string]bool     `json:"features"`
}

// GetPlanLimitsForResponse converts internal limits to JSON-safe format
func GetPlanLimitsForResponse(limits config.PlanLimits) map[string]interface{} {
	result := make(map[string]interface{})
	
	if limits.MaxTokens == -1 {
		result["max_tokens"] = "unlimited"
	} else {
		result["max_tokens"] = limits.MaxTokens
	}
	
	if limits.MaxClients == -1 {
		result["max_clients"] = "unlimited"
	} else {
		result["max_clients"] = limits.MaxClients
	}
	
	if limits.MaxUsers == -1 {
		result["max_users"] = "unlimited"
	} else {
		result["max_users"] = limits.MaxUsers
	}
	
	return result
}