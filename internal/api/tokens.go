package api

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/GLINCKER/glinrdock/internal/auth"
	"github.com/GLINCKER/glinrdock/internal/plan"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
)

// TokenStore interface for token operations
type TokenStore interface {
	CreateToken(ctx context.Context, name, plain, role string) (store.Token, error)
	ListTokens(ctx context.Context) ([]store.Token, error)
	DeleteTokenByName(ctx context.Context, name string) error
	TokenCount(ctx context.Context) (int, error)
	CountActiveClients(ctx context.Context) (int, error)
	UserCount(ctx context.Context) (int, error)
	// Onboarding methods
	IsOnboardingNeeded(ctx context.Context) (bool, error)
	CompleteOnboarding(ctx context.Context) error
}

// CreateTokenRequest represents token creation request
type CreateTokenRequest struct {
	Name  string `json:"name" binding:"required"`
	Plain string `json:"plain" binding:"required"`
	Role  string `json:"role"`
}

// CreateToken creates a new API token
func (h *Handlers) CreateToken(c *gin.Context) {
	var req CreateTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Set default role if not provided
	if req.Role == "" {
		req.Role = store.RoleAdmin
	}

	// Validate role
	if !store.IsRoleValid(req.Role) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid role: must be admin, deployer, or viewer"})
		return
	}

	// Check if current user can create this role
	currentRole := auth.CurrentRole(c)
	if !store.CanCreateRole(currentRole, req.Role) {
		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions to create this role"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Check quota before creating token
	if h.planEnforcer != nil {
		if err := h.planEnforcer.CheckTokenQuota(ctx, h.tokenStore); err != nil {
			if errors.Is(err, plan.ErrTokenQuota) {
				usage, _ := h.planEnforcer.GetUsage(ctx, h.tokenStore)
				limits := h.planEnforcer.GetLimits()
				HandleTokenQuotaError(c, usage.Tokens, limits.MaxTokens, h.planEnforcer.GetPlan())
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check quota"})
			return
		}
	}

	token, err := h.tokenStore.CreateToken(ctx, req.Name, req.Plain, req.Role)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Audit log token creation
	if h.auditLogger != nil {
		actor := auth.CurrentTokenName(c)
		if actor == "" {
			actor = "system"
		}
		h.auditLogger.RecordTokenAction(ctx, actor, audit.ActionTokenCreate, req.Name, map[string]interface{}{
			"role":       req.Role,
			"created_by": auth.CurrentRole(c),
			"token_id":   token.ID,
		})
	}

	// Return token without hash
	response := gin.H{
		"id":         token.ID,
		"name":       token.Name,
		"role":       token.Role,
		"created_at": token.CreatedAt,
	}

	c.JSON(http.StatusCreated, response)
}

// ListTokens returns all tokens
func (h *Handlers) ListTokens(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	tokens, err := h.tokenStore.ListTokens(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list tokens"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"tokens": tokens})
}

// DeleteToken removes a token by name
func (h *Handlers) DeleteToken(c *gin.Context) {
	name := c.Param("name")
	if name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "token name is required"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	err := h.tokenStore.DeleteTokenByName(ctx, name)
	if err != nil {
		if err.Error() == "token not found: "+name {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete token"})
		}
		return
	}

	// Audit log token deletion
	if h.auditLogger != nil {
		actor := auth.CurrentTokenName(c)
		if actor == "" {
			actor = "system"
		}
		h.auditLogger.RecordTokenAction(ctx, actor, audit.ActionTokenDelete, name, map[string]interface{}{
			"deleted_by": auth.CurrentRole(c),
		})
	}

	c.JSON(http.StatusOK, gin.H{"message": "token deleted successfully"})
}
