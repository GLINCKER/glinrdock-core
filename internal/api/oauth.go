package api

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// GitHubLoginHandler initiates GitHub OAuth flow
func (h *Handlers) GitHubLoginHandler(c *gin.Context) {
	ctx := c.Request.Context()

	// Check if OAuth is configured via settings
	if h.settingsHandlers == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "settings service not available"})
		return
	}

	config, err := h.settingsHandlers.settingsService.GetIntegrationsConfig(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to get integrations config")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get OAuth configuration"})
		return
	}

	if config.GitHubOAuth == nil || config.GitHubOAuth.Mode == "off" {
		c.JSON(http.StatusNotImplemented, gin.H{
			"error":   "GitHub OAuth is not configured or disabled",
			"details": "OAuth mode is set to 'off' or not configured",
		})
		return
	}

	if h.oauthService == nil || !h.oauthService.IsConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "GitHub OAuth service not initialized"})
		return
	}

	// Generate GitHub authorization URL with PKCE support
	authURL, state, err := h.oauthService.GenerateAuthURL(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to generate OAuth URL")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate authorization URL"})
		return
	}

	// Set secure state cookie
	stateCookie := h.oauthService.CreateStateCookie(state)
	http.SetCookie(c.Writer, stateCookie)

	// Redirect to GitHub
	c.Redirect(http.StatusTemporaryRedirect, authURL)
}

// GitHubCallbackHandler handles GitHub OAuth callback
func (h *Handlers) GitHubCallbackHandler(c *gin.Context) {
	if h.oauthService == nil || !h.oauthService.IsConfigured() {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "GitHub OAuth not configured"})
		return
	}

	ctx := c.Request.Context()

	// Get authorization code and state from query parameters
	code := c.Query("code")
	state := c.Query("state")

	if code == "" || state == "" {
		log.Warn().Str("error", c.Query("error")).Str("error_description", c.Query("error_description")).
			Msg("GitHub OAuth callback missing parameters")
		c.Redirect(http.StatusTemporaryRedirect, "/app/login?error=oauth_failed")
		return
	}

	// Verify state token from cookie
	stateCookie, err := c.Cookie("oauth_state")
	if err != nil || stateCookie != state {
		log.Warn().Err(err).Str("expected", stateCookie).Str("received", state).
			Msg("OAuth state mismatch")
		c.Redirect(http.StatusTemporaryRedirect, "/app/login?error=csrf_failed")
		return
	}

	// Verify state token signature and expiry
	if !h.oauthService.VerifyStateToken(state) {
		log.Warn().Msg("Invalid OAuth state token")
		c.Redirect(http.StatusTemporaryRedirect, "/app/login?error=invalid_state")
		return
	}

	// Exchange code for access token (with PKCE support)
	accessToken, err := h.oauthService.ExchangeCodeForToken(ctx, code, state)
	if err != nil {
		log.Error().Err(err).Msg("failed to exchange OAuth code for token")
		c.Redirect(http.StatusTemporaryRedirect, "/app/login?error=token_exchange_failed")
		return
	}

	// Fetch user from GitHub API
	githubUser, err := h.oauthService.FetchGitHubUser(ctx, accessToken)
	if err != nil {
		log.Error().Err(err).Msg("failed to fetch GitHub user")
		c.Redirect(http.StatusTemporaryRedirect, "/app/login?error=user_fetch_failed")
		return
	}

	// Authenticate/create user
	user, err := h.oauthService.AuthenticateUser(ctx, githubUser)
	if err != nil {
		log.Error().Err(err).Msg("failed to authenticate user")
		c.Redirect(http.StatusTemporaryRedirect, "/app/login?error=auth_failed")
		return
	}

	// Create session cookie
	sessionCookie, err := h.oauthService.CreateSessionCookie(user)
	if err != nil {
		log.Error().Err(err).Msg("failed to create session cookie")
		c.Redirect(http.StatusTemporaryRedirect, "/app/login?error=session_failed")
		return
	}

	// Set session cookie
	http.SetCookie(c.Writer, sessionCookie)

	// Clear state cookie
	clearStateCookie := &http.Cookie{
		Name:     "oauth_state",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   strings.HasPrefix(c.Request.Host, "https://") || c.GetHeader("X-Forwarded-Proto") == "https", // Only secure in production
		SameSite: http.SameSiteLaxMode,
	}
	http.SetCookie(c.Writer, clearStateCookie)

	log.Info().Str("login", user.Login).Str("role", user.Role).
		Msg("user logged in via GitHub OAuth")

	// Redirect to app
	c.Redirect(http.StatusTemporaryRedirect, "/app/")
}

// OAuthLogoutHandler clears the session cookie
func (h *Handlers) OAuthLogoutHandler(c *gin.Context) {
	if h.oauthService == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "OAuth service not available"})
		return
	}

	// Get current user for logging
	if sessionCookie, err := c.Cookie("glinr_session"); err == nil {
		if user, err := h.oauthService.VerifySessionCookie(sessionCookie); err == nil {
			log.Info().Str("login", user.Login).Msg("user logged out")
		}
	}

	// Clear session cookie
	clearCookie := h.oauthService.ClearSessionCookie()
	http.SetCookie(c.Writer, clearCookie)

	c.JSON(http.StatusOK, gin.H{"message": "logged out successfully"})
}

// AuthMeHandler returns current authenticated user info
func (h *Handlers) AuthMeHandler(c *gin.Context) {
	// Try to get user from session first (OAuth)
	if sessionCookie, err := c.Cookie("glinr_session"); err == nil && h.oauthService != nil {
		if user, err := h.oauthService.VerifySessionCookie(sessionCookie); err == nil {
			c.JSON(http.StatusOK, gin.H{
				"authenticated": true,
				"user":          user,
				"auth_method":   "oauth",
			})
			return
		}
	}

	// Fallback to token auth
	tokenName, exists := c.Get("token_name")
	if !exists {
		c.JSON(http.StatusOK, gin.H{
			"authenticated": false,
		})
		return
	}

	role, _ := c.Get("token_role")

	c.JSON(http.StatusOK, gin.H{
		"authenticated": true,
		"user": gin.H{
			"login": tokenName,
			"role":  role,
		},
		"auth_method": "token",
	})
}
