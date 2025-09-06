package auth

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/GLINCKER/glinrdock/internal/api/middleware"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// Store interface for authentication operations
type Store interface {
	VerifyToken(ctx context.Context, plain string) (string, error)
	TouchToken(ctx context.Context, name string) error
	TokenCount(ctx context.Context) (int, error)
	CreateToken(ctx context.Context, name, plain, role string) (store.Token, error)
	GetTokenByName(ctx context.Context, name string) (store.Token, error)
}

// AuthService handles token-based and session-based authentication
type AuthService struct {
	store        Store
	rateLimiter  *middleware.AuthRateLimiter
	oauthService *OAuthService
}

// NewAuthService creates a new auth service
func NewAuthService(store Store) *AuthService {
	return &AuthService{
		store:       store,
		rateLimiter: middleware.NewAuthRateLimiter(middleware.DefaultAuthRateLimitConfig()),
	}
}

// SetOAuthService sets the OAuth service for session authentication
func (a *AuthService) SetOAuthService(oauthService *OAuthService) {
	a.oauthService = oauthService
}

// BootstrapAdminToken creates initial admin token if none exist and ADMIN_TOKEN is set
func (a *AuthService) BootstrapAdminToken(ctx context.Context, adminToken string) error {
	if adminToken == "" {
		return nil
	}

	count, err := a.store.TokenCount(ctx)
	if err != nil {
		return err
	}

	if count > 0 {
		return nil // Tokens already exist, skip bootstrap
	}

	_, err = a.store.CreateToken(ctx, "admin", adminToken, store.RoleAdmin)
	if err != nil {
		return err
	}

	log.Info().Str("token_name", "admin").Msg("bootstrapped admin token from ADMIN_TOKEN")
	return nil
}

// Middleware creates authentication middleware for protected routes
func (a *AuthService) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Apply rate limiting to auth attempts
		clientIP := getClientIP(c)
		allowed, backoffDuration := a.rateLimiter.IsAllowed(clientIP)
		if !allowed {
			retryAfter := "60"
			if backoffDuration > 0 {
				retryAfter = fmt.Sprintf("%.0f", backoffDuration.Seconds())
			}

			c.Header("Retry-After", retryAfter)
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate limit exceeded",
				"retry_after": retryAfter,
				"message":     "Too many authentication attempts. Please try again later.",
			})
			c.Abort()
			return
		}

		// Try session authentication first (if OAuth service is configured)
		if a.oauthService != nil {
			if sessionCookie, err := c.Cookie("glinr_session"); err == nil {
				if user, err := a.oauthService.VerifySessionCookie(sessionCookie); err == nil {
					// Session authentication successful
					c.Set("user_id", user.ID)
					c.Set("user_login", user.Login)
					c.Set("user_role", user.Role)
					c.Set("auth_method", "session")
					c.Next()
					return
				}
			}
		}

		var token string

		// Try Authorization header first
		authHeader := c.GetHeader("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			token = strings.TrimPrefix(authHeader, "Bearer ")
		}

		// For WebSocket connections, also check query parameters
		if token == "" {
			// Check for token in query parameters (for WebSocket auth)
			if queryToken := c.Query("token"); queryToken != "" {
				token = queryToken
			} else if queryAuth := c.Query("authorization"); queryAuth != "" && strings.HasPrefix(queryAuth, "Bearer ") {
				token = strings.TrimPrefix(queryAuth, "Bearer ")
			}
		}

		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing authentication"})
			c.Abort()
			return
		}

		ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
		defer cancel()

		tokenName, err := a.store.VerifyToken(ctx, token)
		if err != nil {
			// Don't record failure for rate limiting here - auth attempts count regardless of validity
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			c.Abort()
			return
		}

		// Get full token with role information
		fullToken, err := a.store.GetTokenByName(ctx, tokenName)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
			c.Abort()
			return
		}

		// Update last used timestamp
		if err := a.store.TouchToken(ctx, tokenName); err != nil {
			log.Warn().Err(err).Str("token_name", tokenName).Msg("failed to update token last_used_at")
		}

		// Store token name and role in context for handlers
		c.Set("token_name", tokenName)
		c.Set("token_role", fullToken.Role)
		c.Set("auth_method", "token")
		c.Next()
	}
}

// RequireRole creates middleware that requires a minimum role level
func (a *AuthService) RequireRole(minRole string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check for session-based role first
		if userRole, exists := c.Get("user_role"); exists {
			if !hasPermission(userRole.(string), minRole) {
				c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
				c.Abort()
				return
			}
			c.Next()
			return
		}

		// Fallback to token-based role
		role, exists := c.Get("token_role")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "authentication required"})
			c.Abort()
			return
		}

		userRole := role.(string)
		if !hasPermission(userRole, minRole) {
			c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequireAdminRole is a convenience middleware for admin-only endpoints
func (a *AuthService) RequireAdminRole() gin.HandlerFunc {
	return a.RequireRole(store.RoleAdmin)
}

// hasPermission checks if userRole has permission for the required minRole
func hasPermission(userRole, minRole string) bool {
	// Admin has access to everything
	if userRole == store.RoleAdmin {
		return true
	}

	// Deployer has access to deployer and viewer resources
	if userRole == store.RoleDeployer {
		return minRole == store.RoleDeployer || minRole == store.RoleViewer
	}

	// Viewer only has access to viewer resources
	if userRole == store.RoleViewer {
		return minRole == store.RoleViewer
	}

	return false
}

// CurrentRole retrieves the current user's role from context
func CurrentRole(c *gin.Context) string {
	role, exists := c.Get("token_role")
	if !exists {
		return ""
	}
	return role.(string)
}

// CurrentTokenName retrieves the current user's token name from context
func CurrentTokenName(c *gin.Context) string {
	name, exists := c.Get("token_name")
	if !exists {
		return ""
	}
	return name.(string)
}

// getClientIP extracts the real client IP from the request
func getClientIP(c *gin.Context) string {
	// Check X-Forwarded-For header (load balancer/proxy)
	if xff := c.GetHeader("X-Forwarded-For"); xff != "" {
		// Take first IP if multiple
		if len(xff) > 0 {
			return parseIP(xff)
		}
	}

	// Check X-Real-IP header (nginx proxy)
	if xri := c.GetHeader("X-Real-IP"); xri != "" {
		return parseIP(xri)
	}

	// Fall back to direct connection IP
	return parseIP(c.ClientIP())
}

// parseIP extracts the first IP from a potentially comma-separated string
func parseIP(ipStr string) string {
	if ipStr == "" {
		return "unknown"
	}

	// Handle comma-separated IPs (X-Forwarded-For)
	for i, r := range ipStr {
		if r == ',' || r == ' ' {
			return ipStr[:i]
		}
	}
	return ipStr
}
