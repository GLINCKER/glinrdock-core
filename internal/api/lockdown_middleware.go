package api

import (
	"net/http"
	"strings"

	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
)

// LockdownMiddleware checks if system is in lockdown and restricts access accordingly
func LockdownMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Check lockdown status
		lockdownMutex.RLock()
		isLocked := lockdownState.IsLocked
		lockdownMutex.RUnlock()

		// If not locked, continue normally
		if !isLocked {
			c.Next()
			return
		}

		// Allow certain public endpoints even during lockdown
		allowedPublicPaths := []string{
			"/v1/health",
			"/v1/system/lockdown-status",
			"/v1/system/status",
		}

		path := c.Request.URL.Path
		for _, allowedPath := range allowedPublicPaths {
			if path == allowedPath {
				c.Next()
				return
			}
		}

		// Allow static assets and UI during lockdown (but functionality will be limited)
		if strings.HasPrefix(path, "/static/") ||
			strings.HasPrefix(path, "/assets/") ||
			strings.HasPrefix(path, "/app/") ||
			path == "/app" {
			c.Next()
			return
		}

		// For protected endpoints, check if user is admin
		tokenRole, exists := c.Get("token_role")
		if !exists {
			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error":   "system_lockdown",
				"message": "System is currently in lockdown mode. Authentication required.",
			})
			c.Abort()
			return
		}

		role, ok := tokenRole.(string)
		if !ok || role != store.RoleAdmin {
			// Allow lockdown lifting and status endpoints for admins
			if path == "/v1/system/lift-lockdown" || path == "/v1/system/lockdown" {
				c.Next()
				return
			}

			lockdownMutex.RLock()
			reason := lockdownState.Reason
			timestamp := lockdownState.Timestamp
			lockdownMutex.RUnlock()

			c.JSON(http.StatusServiceUnavailable, gin.H{
				"error":     "system_lockdown",
				"message":   "System is in lockdown mode. Only administrator access permitted.",
				"reason":    reason,
				"timestamp": timestamp,
			})
			c.Abort()
			return
		}

		// Admin users can access all endpoints during lockdown
		c.Next()
	}
}
