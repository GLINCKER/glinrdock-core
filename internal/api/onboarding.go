package api

import (
	"net/http"

	"github.com/GLINCKER/glinrdock/internal/auth"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// OnboardingStatus represents the current onboarding status
type OnboardingStatus struct {
	Needed bool `json:"needed"`
}

// GetOnboardingStatus returns whether onboarding is needed
func (h *Handlers) GetOnboardingStatus(c *gin.Context) {
	ctx := c.Request.Context()
	
	// Check if onboarding is needed
	needed, err := h.tokenStore.IsOnboardingNeeded(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to check onboarding status")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check onboarding status"})
		return
	}

	c.JSON(http.StatusOK, OnboardingStatus{
		Needed: needed,
	})
}

// CompleteOnboarding marks the onboarding process as completed
func (h *Handlers) CompleteOnboarding(c *gin.Context) {
	ctx := c.Request.Context()

	// Only admin users can complete onboarding
	currentRole := auth.CurrentRole(c)
	if currentRole != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "admin role required to complete onboarding"})
		return
	}

	// Mark onboarding as completed
	err := h.tokenStore.CompleteOnboarding(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to complete onboarding")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to complete onboarding"})
		return
	}

	// Audit log the onboarding completion
	if h.auditLogger != nil {
		actor := auth.CurrentTokenName(c)
		if actor == "" {
			actor = "system"
		}
		h.auditLogger.RecordSystemAction(ctx, actor, "onboarding_complete", map[string]interface{}{
			"completed_by": currentRole,
			"token_name":   auth.CurrentTokenName(c),
		})
	}

	log.Info().
		Str("token_name", auth.CurrentTokenName(c)).
		Msg("onboarding completed")

	c.JSON(http.StatusOK, gin.H{"message": "onboarding completed successfully"})
}