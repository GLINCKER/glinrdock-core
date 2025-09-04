package middleware

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/GLINCKER/glinrdock/internal/config"
	"github.com/GLINCKER/glinrdock/internal/plan"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFeatureGate(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name            string
		plan            config.Plan
		feature         string
		expectedStatus  int
		expectedMessage string
		description     string
	}{
		{
			name:            "FREE plan accessing Pro feature",
			plan:            config.PlanFree,
			feature:         "smtp_alerts",
			expectedStatus:  403,
			expectedMessage: "feature locked",
			description:     "FREE plan should be denied access to Pro features",
		},
		{
			name:            "PRO plan accessing Pro feature",
			plan:            config.PlanPro,
			feature:         "smtp_alerts",
			expectedStatus:  200,
			expectedMessage: "success",
			description:     "PRO plan should have access to Pro features",
		},
		{
			name:            "PRO plan accessing Premium feature",
			plan:            config.PlanPro,
			feature:         "sso",
			expectedStatus:  403,
			expectedMessage: "feature locked",
			description:     "PRO plan should be denied access to Premium features",
		},
		{
			name:            "PREMIUM plan accessing Premium feature",
			plan:            config.PlanPremium,
			feature:         "sso",
			expectedStatus:  200,
			expectedMessage: "success",
			description:     "PREMIUM plan should have access to all features",
		},
		{
			name:            "PREMIUM plan accessing Pro feature",
			plan:            config.PlanPremium,
			feature:         "ci_integrations",
			expectedStatus:  200,
			expectedMessage: "success",
			description:     "PREMIUM plan should have access to Pro features too",
		},
		{
			name:            "FREE plan accessing core feature",
			plan:            config.PlanFree,
			feature:         "projects",
			expectedStatus:  200,
			expectedMessage: "success",
			description:     "All plans should have access to core features",
		},
		{
			name:            "FREE plan accessing SSL certs",
			plan:            config.PlanFree,
			feature:         "ssl_certs",
			expectedStatus:  403,
			expectedMessage: "feature locked",
			description:     "FREE plan should not have access to SSL certificate management",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create plan enforcer with specified plan
			planEnforcer := plan.New(&config.PlanConfig{
				Plan:   tt.plan,
				Limits: config.GetPlanLimits(tt.plan),
			})

			// Create test router with feature gate middleware
			r := gin.New()
			r.Use(FeatureGate(planEnforcer, tt.feature))
			r.GET("/test-feature", func(c *gin.Context) {
				c.JSON(200, gin.H{"message": "success"})
			})

			// Make request
			req, _ := http.NewRequest("GET", "/test-feature", nil)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			// Check status code
			assert.Equal(t, tt.expectedStatus, w.Code,
				"Expected status %d, got %d for %s", tt.expectedStatus, w.Code, tt.description)

			// Parse response body
			var response map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			require.NoError(t, err, "Response should be valid JSON")

			if tt.expectedStatus == 403 {
				// Check feature locked response structure
				assert.Equal(t, tt.expectedMessage, response["error"], "Error message should match")
				assert.Equal(t, tt.plan.String(), response["plan"], "Plan should be included in response")
				assert.Equal(t, tt.feature, response["feature"], "Feature should be included in response")
				assert.NotEmpty(t, response["upgrade_hint"], "Upgrade hint should be provided")

				// Verify upgrade hint content based on feature type
				upgradeHint := response["upgrade_hint"].(string)
				if tt.feature == "smtp_alerts" || tt.feature == "ci_integrations" || tt.feature == "ssl_certs" {
					assert.Contains(t, upgradeHint, "PRO", "Pro features should suggest PRO plan upgrade")
				} else if tt.feature == "sso" || tt.feature == "oauth" {
					assert.Contains(t, upgradeHint, "PREMIUM", "Premium features should suggest PREMIUM plan upgrade")
				}
			} else {
				// Check success response
				assert.Equal(t, tt.expectedMessage, response["message"], "Success message should match")
			}
		})
	}
}

func TestFeatureGateWithLicense(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Test with license-based plan enforcement
	// This would require creating a mock license, but for now we'll test the basic functionality
	t.Run("license-based enforcement", func(t *testing.T) {
		// Create a PRO plan enforcer
		planEnforcer := plan.New(&config.PlanConfig{
			Plan:   config.PlanPro,
			Limits: config.GetPlanLimits(config.PlanPro),
		})

		r := gin.New()
		r.Use(FeatureGate(planEnforcer, "ci_integrations"))
		r.GET("/test", func(c *gin.Context) {
			c.JSON(200, gin.H{"message": "success"})
		})

		req, _ := http.NewRequest("GET", "/test", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		assert.Equal(t, 200, w.Code, "PRO plan should have access to CI integrations")
	})
}

func TestFeatureGateUpgradeHints(t *testing.T) {
	tests := []struct {
		plan            config.Plan
		feature         string
		expectedContent []string
		description     string
	}{
		{
			plan:            config.PlanFree,
			feature:         "smtp_alerts",
			expectedContent: []string{"PRO", "PREMIUM"},
			description:     "FREE plan should suggest PRO or PREMIUM for Pro features",
		},
		{
			plan:            config.PlanFree,
			feature:         "sso",
			expectedContent: []string{"PREMIUM"},
			description:     "FREE plan should suggest PREMIUM for Premium features",
		},
		{
			plan:            config.PlanPro,
			feature:         "oauth",
			expectedContent: []string{"PREMIUM"},
			description:     "PRO plan should suggest PREMIUM for Premium features",
		},
	}

	for _, tt := range tests {
		t.Run(tt.description, func(t *testing.T) {
			hint := getUpgradeHint(tt.plan, tt.feature)
			
			for _, content := range tt.expectedContent {
				assert.Contains(t, hint, content,
					"Upgrade hint should contain '%s' for %s", content, tt.description)
			}
			assert.NotEmpty(t, hint, "Upgrade hint should not be empty")
		})
	}
}

func TestFeatureGateCoreFeatures(t *testing.T) {
	gin.SetMode(gin.TestMode)

	coreFeatures := []string{"projects", "services", "routes", "logs", "basic_metrics", "lockdown", "emergency_restart"}

	for _, feature := range coreFeatures {
		t.Run("core_feature_"+feature, func(t *testing.T) {
			// Test that core features are accessible from all plans
			plans := []config.Plan{config.PlanFree, config.PlanPro, config.PlanPremium}

			for _, planType := range plans {
				planEnforcer := plan.New(&config.PlanConfig{
					Plan:   planType,
					Limits: config.GetPlanLimits(planType),
				})

				r := gin.New()
				r.Use(FeatureGate(planEnforcer, feature))
				r.GET("/test", func(c *gin.Context) {
					c.JSON(200, gin.H{"message": "success"})
				})

				req, _ := http.NewRequest("GET", "/test", nil)
				w := httptest.NewRecorder()
				r.ServeHTTP(w, req)

				assert.Equal(t, 200, w.Code,
					"Core feature '%s' should be accessible from %s plan", feature, planType.String())
			}
		})
	}
}

func TestFeatureGateChaining(t *testing.T) {
	gin.SetMode(gin.TestMode)

	// Test multiple feature gates in chain
	planEnforcer := plan.New(&config.PlanConfig{
		Plan:   config.PlanPro,
		Limits: config.GetPlanLimits(config.PlanPro),
	})

	r := gin.New()
	// Chain two feature gates - both should pass for PRO plan
	r.Use(FeatureGate(planEnforcer, "smtp_alerts"))
	r.Use(FeatureGate(planEnforcer, "ci_integrations"))
	r.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "success"})
	})

	req, _ := http.NewRequest("GET", "/test", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	assert.Equal(t, 200, w.Code, "Chained feature gates should all pass for appropriate plan")

	// Test chain with one failing gate
	r2 := gin.New()
	r2.Use(FeatureGate(planEnforcer, "smtp_alerts"))    // Should pass
	r2.Use(FeatureGate(planEnforcer, "sso"))            // Should fail (Premium only)
	r2.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "success"})
	})

	req2, _ := http.NewRequest("GET", "/test", nil)
	w2 := httptest.NewRecorder()
	r2.ServeHTTP(w2, req2)

	assert.Equal(t, 403, w2.Code, "Chain should fail if any gate fails")
}

func BenchmarkFeatureGate(b *testing.B) {
	gin.SetMode(gin.TestMode)

	planEnforcer := plan.New(&config.PlanConfig{
		Plan:   config.PlanPro,
		Limits: config.GetPlanLimits(config.PlanPro),
	})

	r := gin.New()
	r.Use(FeatureGate(planEnforcer, "smtp_alerts"))
	r.GET("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "success"})
	})

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		for pb.Next() {
			req, _ := http.NewRequest("GET", "/test", nil)
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
		}
	})
}