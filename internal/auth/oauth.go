package auth

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/GLINCKER/glinrdock/internal/crypto"
	"github.com/rs/zerolog/log"
)

// UserStore interface for GitHub OAuth user operations
type UserStore interface {
	UpsertUser(ctx context.Context, user User) (User, error)
	GetUserByGitHubID(ctx context.Context, githubID int64) (User, error)
	GetUserByID(ctx context.Context, id int64) (User, error)
	CountUsers(ctx context.Context) (int, error)
	UpdateUserLastLogin(ctx context.Context, id int64) error
}

// StateStore interface for OAuth state and PKCE verifier storage
type StateStore interface {
	StoreOAuthState(ctx context.Context, state string, encryptedVerifier []byte, expiresAt time.Time) error
	GetOAuthState(ctx context.Context, state string) ([]byte, error)
	DeleteOAuthState(ctx context.Context, state string) error
}

// User represents a GitHub authenticated user
type User struct {
	ID          int64      `json:"id" db:"id"`
	GitHubID    int64      `json:"github_id" db:"github_id"`
	Login       string     `json:"login" db:"login"`
	Name        string     `json:"name" db:"name"`
	AvatarURL   string     `json:"avatar_url" db:"avatar_url"`
	Role        string     `json:"role" db:"role"`
	CreatedAt   time.Time  `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at" db:"updated_at"`
	LastLoginAt *time.Time `json:"last_login_at" db:"last_login_at"`
}

// OAuthState represents stored OAuth state for CSRF protection and PKCE
type OAuthState struct {
	State        string    `json:"state"`
	VerifierHash []byte    `json:"verifier_hash,omitempty"` // Encrypted PKCE code_verifier
	CreatedAt    time.Time `json:"created_at"`
	ExpiresAt    time.Time `json:"expires_at"`
}

// GitHubUser represents GitHub API user response
type GitHubUser struct {
	ID        int64  `json:"id"`
	Login     string `json:"login"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
}

// GitHubEmail represents GitHub API email response
type GitHubEmail struct {
	Email    string `json:"email"`
	Primary  bool   `json:"primary"`
	Verified bool   `json:"verified"`
}

// OAuthConfig holds GitHub OAuth configuration
type OAuthConfig struct {
	Mode         string // "off", "pkce", "confidential"
	ClientID     string
	ClientSecret string // Only used in confidential mode
	BaseURL      string
	Secret       string // Master secret for HMAC and encryption
}

// OAuthService handles GitHub OAuth authentication
type OAuthService struct {
	config     OAuthConfig
	userStore  UserStore
	stateStore StateStore
	client     *http.Client
}

// NewOAuthService creates a new OAuth service
func NewOAuthService(config OAuthConfig, userStore UserStore, stateStore StateStore) *OAuthService {
	return &OAuthService{
		config:     config,
		userStore:  userStore,
		stateStore: stateStore,
		client:     &http.Client{Timeout: 10 * time.Second},
	}
}

// IsConfigured returns true if OAuth is properly configured
func (o *OAuthService) IsConfigured() bool {
	if o.config.Mode == "off" {
		return false
	}

	// Basic requirements for all modes
	if o.config.ClientID == "" || o.config.BaseURL == "" || o.config.Secret == "" {
		return false
	}

	// Confidential mode requires client secret
	if o.config.Mode == "confidential" && o.config.ClientSecret == "" {
		return false
	}

	return o.config.Mode == "pkce" || o.config.Mode == "confidential"
}

// generateCodeVerifier generates a PKCE code verifier (43-128 characters)
func (o *OAuthService) generateCodeVerifier() (string, error) {
	// Generate 64 random bytes (will become 88 base64url characters without padding)
	randomBytes := make([]byte, 64)
	if _, err := rand.Read(randomBytes); err != nil {
		return "", fmt.Errorf("failed to generate random bytes: %w", err)
	}

	// Use base64url encoding without padding
	verifier := base64.RawURLEncoding.EncodeToString(randomBytes)

	// Ensure it's within the valid range (43-128 characters)
	if len(verifier) < 43 {
		return "", fmt.Errorf("code verifier too short: %d characters", len(verifier))
	}
	if len(verifier) > 128 {
		verifier = verifier[:128] // Truncate if too long
	}

	return verifier, nil
}

// generateCodeChallenge generates S256 code challenge from verifier
func (o *OAuthService) generateCodeChallenge(verifier string) string {
	hash := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(hash[:])
}

// encryptVerifier encrypts the PKCE verifier for storage
func (o *OAuthService) encryptVerifier(verifier string) ([]byte, error) {
	masterKey, err := crypto.LoadMasterKeyFromEnv()
	if err != nil {
		return nil, fmt.Errorf("master key not available: %w", err)
	}

	nonce, ciphertext, err := crypto.Encrypt(masterKey, []byte(verifier))
	if err != nil {
		return nil, fmt.Errorf("failed to encrypt verifier: %w", err)
	}

	// Store nonce + ciphertext together
	result := make([]byte, len(nonce)+len(ciphertext))
	copy(result, nonce)
	copy(result[len(nonce):], ciphertext)

	return result, nil
}

// decryptVerifier decrypts the PKCE verifier from storage
func (o *OAuthService) decryptVerifier(encryptedData []byte) (string, error) {
	if len(encryptedData) < 12 {
		return "", fmt.Errorf("invalid encrypted verifier: too short")
	}

	masterKey, err := crypto.LoadMasterKeyFromEnv()
	if err != nil {
		return "", fmt.Errorf("master key not available: %w", err)
	}

	// Extract nonce and ciphertext (nonce is first 12 bytes)
	nonce := encryptedData[:12]
	ciphertext := encryptedData[12:]

	plaintext, err := crypto.Decrypt(masterKey, nonce, ciphertext)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt verifier: %w", err)
	}

	return string(plaintext), nil
}

// GenerateAuthURL creates the GitHub OAuth authorization URL and manages state/PKCE
func (o *OAuthService) GenerateAuthURL(ctx context.Context) (string, string, error) {
	// Generate and sign state token
	state := o.CreateStateToken()

	var encryptedVerifier []byte

	// For PKCE mode, generate verifier and challenge
	if o.config.Mode == "pkce" {
		verifier, err := o.generateCodeVerifier()
		if err != nil {
			return "", "", fmt.Errorf("failed to generate code verifier: %w", err)
		}

		challenge := o.generateCodeChallenge(verifier)

		// Encrypt and store verifier
		encryptedVerifier, err = o.encryptVerifier(verifier)
		if err != nil {
			return "", "", fmt.Errorf("failed to encrypt verifier: %w", err)
		}

		// Store state and encrypted verifier
		expiresAt := time.Now().Add(10 * time.Minute)
		if err := o.stateStore.StoreOAuthState(ctx, state, encryptedVerifier, expiresAt); err != nil {
			return "", "", fmt.Errorf("failed to store OAuth state: %w", err)
		}

		// Build URL with PKCE parameters
		params := url.Values{
			"client_id":             {o.config.ClientID},
			"scope":                 {"read:user user:email"},
			"state":                 {state},
			"redirect_uri":          {o.config.BaseURL + "/v1/auth/github/callback"},
			"code_challenge":        {challenge},
			"code_challenge_method": {"S256"},
		}

		return "https://github.com/login/oauth/authorize?" + params.Encode(), state, nil
	}

	// For confidential mode (or fallback)
	expiresAt := time.Now().Add(10 * time.Minute)
	if err := o.stateStore.StoreOAuthState(ctx, state, nil, expiresAt); err != nil {
		return "", "", fmt.Errorf("failed to store OAuth state: %w", err)
	}

	params := url.Values{
		"client_id":    {o.config.ClientID},
		"scope":        {"read:user user:email"},
		"state":        {state},
		"redirect_uri": {o.config.BaseURL + "/v1/auth/github/callback"},
	}

	return "https://github.com/login/oauth/authorize?" + params.Encode(), state, nil
}

// CreateStateToken generates a CSRF-protected state token
func (o *OAuthService) CreateStateToken() string {
	// Generate random bytes
	randomBytes := make([]byte, 16)
	if _, err := rand.Read(randomBytes); err != nil {
		log.Error().Err(err).Msg("failed to generate random bytes for state token")
		return ""
	}

	// Create timestamp + random data
	state := fmt.Sprintf("%d:%s", time.Now().Unix(), base64.URLEncoding.EncodeToString(randomBytes))

	// Sign with HMAC
	h := hmac.New(sha256.New, []byte(o.config.Secret))
	h.Write([]byte(state))
	signature := base64.URLEncoding.EncodeToString(h.Sum(nil))

	return fmt.Sprintf("%s.%s", state, signature)
}

// VerifyStateToken validates a CSRF state token
func (o *OAuthService) VerifyStateToken(token string) bool {
	parts := []byte(token)

	// Find last dot separator
	var lastDot int
	for i := len(parts) - 1; i >= 0; i-- {
		if parts[i] == '.' {
			lastDot = i
			break
		}
	}

	if lastDot == 0 {
		return false
	}

	state := string(parts[:lastDot])
	signature := string(parts[lastDot+1:])

	// Verify signature
	h := hmac.New(sha256.New, []byte(o.config.Secret))
	h.Write([]byte(state))
	expectedSignature := base64.URLEncoding.EncodeToString(h.Sum(nil))

	if !hmac.Equal([]byte(signature), []byte(expectedSignature)) {
		return false
	}

	// Check timestamp (tokens valid for 10 minutes)
	parts = []byte(state)
	colonIdx := -1
	for i, b := range parts {
		if b == ':' {
			colonIdx = i
			break
		}
	}

	if colonIdx == -1 {
		return false
	}

	timestampStr := string(parts[:colonIdx])
	var timestamp int64
	if _, err := fmt.Sscanf(timestampStr, "%d", &timestamp); err != nil {
		return false
	}

	// Check if token is expired (10 minutes)
	if time.Now().Unix()-timestamp > 600 {
		return false
	}

	return true
}

// ExchangeCodeForToken exchanges authorization code for access token with PKCE or client secret
func (o *OAuthService) ExchangeCodeForToken(ctx context.Context, code, state string) (string, error) {
	// Retrieve and delete stored state
	encryptedVerifier, err := o.stateStore.GetOAuthState(ctx, state)
	if err != nil {
		return "", fmt.Errorf("failed to retrieve OAuth state: %w", err)
	}

	// Clean up state after use
	defer func() {
		if err := o.stateStore.DeleteOAuthState(ctx, state); err != nil {
			log.Warn().Err(err).Str("state", state).Msg("failed to delete OAuth state")
		}
	}()

	data := url.Values{
		"client_id": {o.config.ClientID},
		"code":      {code},
	}

	// Add PKCE verifier or client secret based on mode
	if o.config.Mode == "pkce" && encryptedVerifier != nil {
		verifier, err := o.decryptVerifier(encryptedVerifier)
		if err != nil {
			return "", fmt.Errorf("failed to decrypt code verifier: %w", err)
		}
		data.Set("code_verifier", verifier)
	} else if o.config.Mode == "confidential" {
		data.Set("client_secret", o.config.ClientSecret)
	} else {
		return "", fmt.Errorf("unsupported OAuth mode: %s", o.config.Mode)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://github.com/login/oauth/access_token",
		strings.NewReader(data.Encode()))
	if err != nil {
		return "", fmt.Errorf("failed to create token request: %w", err)
	}

	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	resp, err := o.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("token request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("token request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
		Scope       string `json:"scope"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", fmt.Errorf("failed to decode token response: %w", err)
	}

	if tokenResp.Error != "" {
		return "", fmt.Errorf("OAuth error: %s - %s", tokenResp.Error, tokenResp.ErrorDesc)
	}

	if tokenResp.AccessToken == "" {
		return "", fmt.Errorf("no access token in response")
	}

	return tokenResp.AccessToken, nil
}

// FetchGitHubUser fetches user information from GitHub API
func (o *OAuthService) FetchGitHubUser(ctx context.Context, accessToken string) (*GitHubUser, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://api.github.com/user", nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create user request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	resp, err := o.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("user request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("user request failed with status %d: %s", resp.StatusCode, string(body))
	}

	var user GitHubUser
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode user response: %w", err)
	}

	return &user, nil
}

// AuthenticateUser processes GitHub OAuth callback and creates/updates user
func (o *OAuthService) AuthenticateUser(ctx context.Context, githubUser *GitHubUser) (*User, error) {
	// Determine role - first user becomes admin
	userCount, err := o.userStore.CountUsers(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to count users: %w", err)
	}

	role := "viewer" // Default role
	if userCount == 0 {
		role = "admin" // First user becomes admin
	}

	// Upsert user
	user := User{
		GitHubID:  githubUser.ID,
		Login:     githubUser.Login,
		Name:      githubUser.Name,
		AvatarURL: githubUser.AvatarURL,
		Role:      role,
	}

	// For existing users, preserve their current role
	if existingUser, err := o.userStore.GetUserByGitHubID(ctx, githubUser.ID); err == nil {
		user.Role = existingUser.Role
	}

	user, err = o.userStore.UpsertUser(ctx, user)
	if err != nil {
		return nil, fmt.Errorf("failed to upsert user: %w", err)
	}

	// Update last login
	if err := o.userStore.UpdateUserLastLogin(ctx, user.ID); err != nil {
		log.Warn().Err(err).Int64("user_id", user.ID).Msg("failed to update last login")
	}

	return &user, nil
}

// CreateSessionCookie creates a signed session cookie for the user
func (o *OAuthService) CreateSessionCookie(user *User) (*http.Cookie, error) {
	// Create session payload
	session := struct {
		UserID    int64  `json:"user_id"`
		Login     string `json:"login"`
		Role      string `json:"role"`
		IssuedAt  int64  `json:"iat"`
		ExpiresAt int64  `json:"exp"`
	}{
		UserID:    user.ID,
		Login:     user.Login,
		Role:      user.Role,
		IssuedAt:  time.Now().Unix(),
		ExpiresAt: time.Now().Add(24 * time.Hour).Unix(), // 24 hour sessions
	}

	sessionJSON, err := json.Marshal(session)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal session: %w", err)
	}

	// Sign session with HMAC
	h := hmac.New(sha256.New, []byte(o.config.Secret))
	h.Write(sessionJSON)
	signature := base64.URLEncoding.EncodeToString(h.Sum(nil))

	sessionToken := fmt.Sprintf("%s.%s",
		base64.URLEncoding.EncodeToString(sessionJSON),
		signature)

	return &http.Cookie{
		Name:     "glinr_session",
		Value:    sessionToken,
		Path:     "/",
		MaxAge:   24 * 60 * 60, // 24 hours
		HttpOnly: true,
		Secure:   strings.HasPrefix(o.config.BaseURL, "https://"), // Only secure in production
		SameSite: http.SameSiteLaxMode,
	}, nil
}

// VerifySessionCookie validates and parses a session cookie
func (o *OAuthService) VerifySessionCookie(cookieValue string) (*User, error) {
	if cookieValue == "" {
		return nil, fmt.Errorf("empty session cookie")
	}

	parts := []byte(cookieValue)

	// Find last dot separator
	var lastDot int
	for i := len(parts) - 1; i >= 0; i-- {
		if parts[i] == '.' {
			lastDot = i
			break
		}
	}

	if lastDot == 0 {
		return nil, fmt.Errorf("invalid session format")
	}

	sessionB64 := string(parts[:lastDot])
	signature := string(parts[lastDot+1:])

	// Decode session
	sessionJSON, err := base64.URLEncoding.DecodeString(sessionB64)
	if err != nil {
		return nil, fmt.Errorf("failed to decode session: %w", err)
	}

	// Verify signature
	h := hmac.New(sha256.New, []byte(o.config.Secret))
	h.Write(sessionJSON)
	expectedSignature := base64.URLEncoding.EncodeToString(h.Sum(nil))

	if !hmac.Equal([]byte(signature), []byte(expectedSignature)) {
		return nil, fmt.Errorf("invalid session signature")
	}

	// Parse session
	var session struct {
		UserID    int64  `json:"user_id"`
		Login     string `json:"login"`
		Role      string `json:"role"`
		IssuedAt  int64  `json:"iat"`
		ExpiresAt int64  `json:"exp"`
	}

	if err := json.Unmarshal(sessionJSON, &session); err != nil {
		return nil, fmt.Errorf("failed to parse session: %w", err)
	}

	// Check expiry
	if time.Now().Unix() > session.ExpiresAt {
		return nil, fmt.Errorf("session expired")
	}

	return &User{
		ID:    session.UserID,
		Login: session.Login,
		Role:  session.Role,
	}, nil
}

// ClearSessionCookie creates a cookie that clears the session
func (o *OAuthService) ClearSessionCookie() *http.Cookie {
	return &http.Cookie{
		Name:     "glinr_session",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   strings.HasPrefix(o.config.BaseURL, "https://"), // Only secure in production
		SameSite: http.SameSiteLaxMode,
	}
}

// CreateStateCookie creates an HMAC-signed state cookie for CSRF protection
func (o *OAuthService) CreateStateCookie(state string) *http.Cookie {
	return &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/",
		MaxAge:   600, // 10 minutes
		HttpOnly: true,
		Secure:   strings.HasPrefix(o.config.BaseURL, "https://"), // Only secure in production
		SameSite: http.SameSiteLaxMode,
	}
}
