package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/GLINCKER/glinrdock/internal/auth"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// MockOAuthService implements OAuthService for testing
type MockOAuthService struct {
	configured    bool
	shouldError   bool
	user          *auth.User
	sessionCookie *http.Cookie
}

func NewMockOAuthService() *MockOAuthService {
	return &MockOAuthService{
		configured: true,
	}
}

func (m *MockOAuthService) IsConfigured() bool {
	return m.configured
}

func (m *MockOAuthService) CreateStateToken() string {
	return "mock-state-token"
}

func (m *MockOAuthService) CreateStateCookie(state string) *http.Cookie {
	return &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/",
		MaxAge:   600,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	}
}

func (m *MockOAuthService) GenerateAuthURL(ctx context.Context) (string, string, error) {
	if m.shouldError {
		return "", "", assert.AnError
	}
	state := "mock-state-token"
	authURL := "https://github.com/login/oauth/authorize?client_id=test&state=" + state
	return authURL, state, nil
}

func (m *MockOAuthService) VerifyStateToken(state string) bool {
	return state == "mock-state-token" && !m.shouldError
}

func (m *MockOAuthService) ExchangeCodeForToken(ctx context.Context, code string, state string) (string, error) {
	if m.shouldError {
		return "", assert.AnError
	}
	return "mock-access-token", nil
}

func (m *MockOAuthService) FetchGitHubUser(ctx context.Context, accessToken string) (*auth.GitHubUser, error) {
	if m.shouldError {
		return nil, assert.AnError
	}
	return &auth.GitHubUser{
		ID:        12345,
		Login:     "testuser",
		Name:      "Test User",
		AvatarURL: "https://avatar.url/test.jpg",
	}, nil
}

func (m *MockOAuthService) AuthenticateUser(ctx context.Context, githubUser *auth.GitHubUser) (*auth.User, error) {
	if m.shouldError {
		return nil, assert.AnError
	}
	
	user := &auth.User{
		ID:        1,
		GitHubID:  githubUser.ID,
		Login:     githubUser.Login,
		Name:      githubUser.Name,
		AvatarURL: githubUser.AvatarURL,
		Role:      "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	
	m.user = user
	return user, nil
}

func (m *MockOAuthService) CreateSessionCookie(user *auth.User) (*http.Cookie, error) {
	if m.shouldError {
		return nil, assert.AnError
	}
	
	cookie := &http.Cookie{
		Name:     "glinr_session",
		Value:    "mock-session-token",
		Path:     "/",
		MaxAge:   24 * 60 * 60,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	}
	
	m.sessionCookie = cookie
	return cookie, nil
}

func (m *MockOAuthService) VerifySessionCookie(cookieValue string) (*auth.User, error) {
	if cookieValue == "mock-session-token" && m.user != nil && !m.shouldError {
		return m.user, nil
	}
	return nil, assert.AnError
}

func (m *MockOAuthService) ClearSessionCookie() *http.Cookie {
	return &http.Cookie{
		Name:     "glinr_session",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
	}
}

func setupOAuthTestServer(t *testing.T) (*gin.Engine, *Handlers, *MockOAuthService) {
	gin.SetMode(gin.TestMode)
	
	oauthService := NewMockOAuthService()
	handlers := &Handlers{
		oauthService: oauthService,
	}
	
	r := gin.New()
	r.GET("/v1/auth/github/login", handlers.GitHubLoginHandler)
	r.GET("/v1/auth/github/callback", handlers.GitHubCallbackHandler)
	r.POST("/v1/auth/oauth/logout", handlers.OAuthLogoutHandler)
	r.GET("/v1/auth/me", handlers.AuthMeHandler)
	
	return r, handlers, oauthService
}

func TestGitHubLoginHandler_Success(t *testing.T) {
	r, _, _ := setupOAuthTestServer(t)
	
	req := httptest.NewRequest("GET", "/v1/auth/github/login", nil)
	w := httptest.NewRecorder()
	
	r.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusTemporaryRedirect, w.Code)
	
	location := w.Header().Get("Location")
	assert.Contains(t, location, "https://github.com/login/oauth/authorize")
	assert.Contains(t, location, "client_id=test")
	assert.Contains(t, location, "state=mock-state-token")
	
	// Check state cookie was set
	cookies := w.Result().Cookies()
	var stateCookie *http.Cookie
	for _, cookie := range cookies {
		if cookie.Name == "oauth_state" {
			stateCookie = cookie
			break
		}
	}
	require.NotNil(t, stateCookie)
	assert.Equal(t, "mock-state-token", stateCookie.Value)
	assert.True(t, stateCookie.HttpOnly)
	assert.True(t, stateCookie.Secure)
}

func TestGitHubLoginHandler_NotConfigured(t *testing.T) {
	r, _, oauthService := setupOAuthTestServer(t)
	oauthService.configured = false
	
	req := httptest.NewRequest("GET", "/v1/auth/github/login", nil)
	w := httptest.NewRecorder()
	
	r.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusServiceUnavailable, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "GitHub OAuth not configured", response["error"])
}

func TestGitHubCallbackHandler_Success(t *testing.T) {
	r, _, oauthService := setupOAuthTestServer(t)
	
	// Create request with valid parameters
	params := url.Values{
		"code":  {"test-code"},
		"state": {"mock-state-token"},
	}
	req := httptest.NewRequest("GET", "/v1/auth/github/callback?"+params.Encode(), nil)
	req.AddCookie(&http.Cookie{
		Name:  "oauth_state",
		Value: "mock-state-token",
	})
	
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusTemporaryRedirect, w.Code)
	assert.Equal(t, "/app/", w.Header().Get("Location"))
	
	// Check session cookie was set
	cookies := w.Result().Cookies()
	var sessionCookie *http.Cookie
	for _, cookie := range cookies {
		if cookie.Name == "glinr_session" {
			sessionCookie = cookie
			break
		}
	}
	require.NotNil(t, sessionCookie)
	assert.Equal(t, "mock-session-token", sessionCookie.Value)
	
	// Verify user was created in the mock service
	assert.NotNil(t, oauthService.user)
	assert.Equal(t, "testuser", oauthService.user.Login)
}

func TestGitHubCallbackHandler_MissingParameters(t *testing.T) {
	r, _, _ := setupOAuthTestServer(t)
	
	// Missing code and state parameters
	req := httptest.NewRequest("GET", "/v1/auth/github/callback", nil)
	w := httptest.NewRecorder()
	
	r.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusTemporaryRedirect, w.Code)
	assert.Contains(t, w.Header().Get("Location"), "error=oauth_failed")
}

func TestGitHubCallbackHandler_StateMismatch(t *testing.T) {
	r, _, _ := setupOAuthTestServer(t)
	
	params := url.Values{
		"code":  {"test-code"},
		"state": {"wrong-state"},
	}
	req := httptest.NewRequest("GET", "/v1/auth/github/callback?"+params.Encode(), nil)
	req.AddCookie(&http.Cookie{
		Name:  "oauth_state",
		Value: "correct-state",
	})
	
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusTemporaryRedirect, w.Code)
	assert.Contains(t, w.Header().Get("Location"), "error=csrf_failed")
}

func TestGitHubCallbackHandler_CodeExchangeError(t *testing.T) {
	r, _, oauthService := setupOAuthTestServer(t)
	oauthService.shouldError = true
	
	params := url.Values{
		"code":  {"test-code"},
		"state": {"mock-state-token"},
	}
	req := httptest.NewRequest("GET", "/v1/auth/github/callback?"+params.Encode(), nil)
	req.AddCookie(&http.Cookie{
		Name:  "oauth_state",
		Value: "mock-state-token",
	})
	
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusTemporaryRedirect, w.Code)
	assert.Contains(t, w.Header().Get("Location"), "error=token_exchange_failed")
}

func TestOAuthLogoutHandler_Success(t *testing.T) {
	r, _, oauthService := setupOAuthTestServer(t)
	
	// Create a user session first
	user := &auth.User{
		ID:    1,
		Login: "testuser",
		Role:  "admin",
	}
	oauthService.user = user
	
	req := httptest.NewRequest("POST", "/v1/auth/oauth/logout", nil)
	req.AddCookie(&http.Cookie{
		Name:  "glinr_session",
		Value: "mock-session-token",
	})
	
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	assert.Equal(t, "logged out successfully", response["message"])
	
	// Check clear cookie was set
	cookies := w.Result().Cookies()
	var clearCookie *http.Cookie
	for _, cookie := range cookies {
		if cookie.Name == "glinr_session" {
			clearCookie = cookie
			break
		}
	}
	require.NotNil(t, clearCookie)
	assert.Equal(t, "", clearCookie.Value)
	assert.Equal(t, -1, clearCookie.MaxAge)
}

func TestAuthMeHandler_SessionAuth(t *testing.T) {
	r, handlers, oauthService := setupOAuthTestServer(t)
	
	// Set up mock user session
	user := &auth.User{
		ID:        1,
		Login:     "testuser",
		Name:      "Test User",
		AvatarURL: "https://avatar.url/test.jpg",
		Role:      "admin",
	}
	oauthService.user = user
	
	req := httptest.NewRequest("GET", "/v1/auth/me", nil)
	req.AddCookie(&http.Cookie{
		Name:  "glinr_session",
		Value: "mock-session-token",
	})
	
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	
	assert.True(t, response["authenticated"].(bool))
	assert.Equal(t, "session", response["auth_method"])
	
	userInfo := response["user"].(map[string]interface{})
	assert.Equal(t, "testuser", userInfo["login"])
	assert.Equal(t, "admin", userInfo["role"])
}

func TestAuthMeHandler_NoAuth(t *testing.T) {
	r, _, _ := setupOAuthTestServer(t)
	
	req := httptest.NewRequest("GET", "/v1/auth/me", nil)
	w := httptest.NewRecorder()
	
	r.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	
	assert.False(t, response["authenticated"].(bool))
}

func TestAuthMeHandler_TokenAuth(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	// Create handlers without OAuth service to simulate token-only auth
	handlers := &Handlers{}
	
	r := gin.New()
	
	// Add middleware to simulate token authentication
	r.Use(func(c *gin.Context) {
		c.Set("token_name", "test-token")
		c.Set("token_role", "deployer")
		c.Next()
	})
	
	r.GET("/v1/auth/me", handlers.AuthMeHandler)
	
	req := httptest.NewRequest("GET", "/v1/auth/me", nil)
	req.Header.Set("Authorization", "Bearer test-token")
	
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	
	assert.True(t, response["authenticated"].(bool))
	assert.Equal(t, "token", response["auth_method"])
	
	userInfo := response["user"].(map[string]interface{})
	assert.Equal(t, "test-token", userInfo["login"])
	assert.Equal(t, "deployer", userInfo["role"])
}