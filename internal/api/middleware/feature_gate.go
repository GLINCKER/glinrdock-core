package middleware

import (
	"net/http"

	"github.com/GLINCKER/glinrdock/internal/config"
	"github.com/GLINCKER/glinrdock/internal/plan"
	"github.com/gin-gonic/gin"
)

// FeatureGateResponse represents the error response for locked features
type FeatureGateResponse struct {
	Error       string `json:"error"`
	Plan        string `json:"plan"`
	Feature     string `json:"feature"`
	UpgradeHint string `json:"upgrade_hint"`
}

// FeatureGate creates middleware that enforces feature access based on plan
func FeatureGate(planEnforcer *plan.Enforcer, feature string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !planEnforcer.FeatureEnabled(feature) {
			upgradeHint := getUpgradeHint(planEnforcer.GetPlan(), feature)
			c.JSON(http.StatusForbidden, FeatureGateResponse{
				Error:       "feature locked",
				Plan:        planEnforcer.GetPlan().String(),
				Feature:     feature,
				UpgradeHint: upgradeHint,
			})
			c.Abort()
			return
		}
		c.Next()
	}
}

// getUpgradeHint provides upgrade suggestions based on current plan and requested feature
func getUpgradeHint(currentPlan config.Plan, feature string) string {
	switch feature {
	case "smtp_alerts", "ci_integrations", "ssl_certs":
		if currentPlan == config.PlanFree {
			return "Upgrade to PRO or PREMIUM plan to enable this feature"
		}
		return "This feature is available in PRO and PREMIUM plans"
	case "oauth", "multi_env", "sso", "audit_logs", "advanced_dashboards":
		if currentPlan == config.PlanFree || currentPlan == config.PlanPro {
			return "Upgrade to PREMIUM plan to enable this feature"
		}
		return "This feature is available in PREMIUM plan only"
	default:
		return "Feature requires a higher plan tier"
	}
}