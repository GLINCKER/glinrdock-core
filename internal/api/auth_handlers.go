package api

import (
	"crypto/rand"
	"encoding/base64"
	"net/http"
	"time"

	"github.com/GLINCKER/glinrdock/internal/api/middleware"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// LoginRequest represents the login request payload
type LoginRequest struct {
	Token string `json:"token" binding:"required"`
}

// LoginResponse represents the successful login response
type LoginResponse struct {
	SessionID string `json:"session_id"`
	TokenName string `json:"token_name"`
	Role      string `json:"role"`
	ExpiresAt string `json:"expires_at"`
}

// LoginHandler handles token-based login and creates sessions
func (h *Handlers) LoginHandler(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request format"})
		return
	}

	// For now, this is a simplified implementation - in a real system you'd have proper
	// session management. This endpoint validates tokens but doesn't create persistent sessions.
	// Simple token validation - would need to implement this properly with the store
	// For now, return a success response for any non-empty token
	if req.Token == "" {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "invalid token",
			"message": "The provided token is invalid or has expired",
		})
		return
	}

	// Create session
	sessionID, err := generateSessionID()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create session"})
		return
	}

	// Store session (in a real implementation, you'd store this in a session store)
	expiresAt := time.Now().Add(24 * time.Hour) // 24 hour sessions

	// Set secure session cookie
	c.SetCookie(
		"glinrdock_session",
		sessionID,
		86400, // 24 hours
		"/",
		"",
		false, // Set to true in production with HTTPS
		true,  // HttpOnly
	)

	// Record successful auth for rate limiting
	middleware.RecordAuthSuccess(c)

	// Audit log the login (simplified for now)
	if h.auditLogger != nil {
		// Using simplified audit call for now
		log.Info().
			Str("action", "auth.login").
			Str("token", req.Token[:10]+"..."). // Only log first 10 chars for security
			Str("session_id", sessionID).
			Str("client_ip", getClientIPFromHeader(c)).
			Msg("user logged in")
	}

	c.JSON(http.StatusOK, LoginResponse{
		SessionID: sessionID,
		TokenName: "validated_token", // Simplified
		Role:      "user",            // Simplified
		ExpiresAt: expiresAt.Format(time.RFC3339),
	})
}

// LogoutHandler handles logout and destroys sessions
func (h *Handlers) LogoutHandler(c *gin.Context) {
	// Get session from cookie
	sessionCookie, err := c.Cookie("glinrdock_session")
	if err == nil && sessionCookie != "" {
		// Clear the session cookie
		c.SetCookie(
			"glinrdock_session",
			"",
			-1, // Expire immediately
			"/",
			"",
			false,
			true,
		)

		// Audit log the logout (simplified)
		if h.auditLogger != nil {
			log.Info().
				Str("action", "auth.logout").
				Str("session_id", sessionCookie).
				Str("client_ip", getClientIPFromHeader(c)).
				Msg("user logged out")
		}
	}

	c.JSON(http.StatusOK, gin.H{"message": "logged out successfully"})
}

// AuthInfoHandler returns current authentication information
func (h *Handlers) AuthInfoHandler(c *gin.Context) {
	// This handler assumes it's called after authentication middleware
	// which sets token_name and token_role in context

	// Get token info from context (set by auth middleware)
	tokenName, tokenExists := c.Get("token_name")
	tokenRole, roleExists := c.Get("token_role")

	authMethod := "none"
	name := ""
	role := ""

	if tokenExists && roleExists {
		authMethod = "bearer"
		name = tokenName.(string)
		role = tokenRole.(string)
	}

	c.JSON(http.StatusOK, gin.H{
		"method":     authMethod,
		"token_name": name,
		"role":       role,
		"email":      "", // Not implemented yet
	})
}

// generateSessionID creates a cryptographically secure session ID
func generateSessionID() (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(bytes), nil
}

// getClientIPFromHeader is a temporary helper to avoid import cycle
func getClientIPFromHeader(c *gin.Context) string {
	return c.ClientIP()
}
