// +build integration

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/GLINCKER/glinrdock/internal/auth"
	"github.com/GLINCKER/glinrdock/internal/store"
)

// Integration test for GitHub OAuth flow
// This test requires environment variables to be set:
// - GITHUB_OAUTH_CLIENT_ID
// - GITHUB_OAUTH_CLIENT_SECRET  
// - EXTERNAL_BASE_URL
// - GLINRDOCK_SECRET
//
// Run with: go test -tags=integration -run TestOAuthIntegration
func TestOAuthIntegration(t *testing.T) {
	// Check required environment variables
	clientID := os.Getenv("GITHUB_OAUTH_CLIENT_ID")
	clientSecret := os.Getenv("GITHUB_OAUTH_CLIENT_SECRET")
	baseURL := os.Getenv("EXTERNAL_BASE_URL")
	secret := os.Getenv("GLINRDOCK_SECRET")

	if clientID == "" || clientSecret == "" || baseURL == "" || secret == "" {
		t.Skip("Skipping OAuth integration test - missing required environment variables")
	}

	// Create OAuth service
	config := auth.OAuthConfig{
		ClientID:     clientID,
		ClientSecret: clientSecret,
		BaseURL:      baseURL,
		Secret:       secret,
	}

	// Create in-memory store
	storeInstance, err := store.Open(":memory:")
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer storeInstance.Close()

	// Run migrations
	ctx := context.Background()
	if err := storeInstance.Migrate(ctx); err != nil {
		t.Fatalf("Failed to migrate store: %v", err)
	}

	oauthService := auth.NewOAuthService(config, storeInstance)

	// Test 1: OAuth service is configured
	if !oauthService.IsConfigured() {
		t.Fatal("OAuth service should be configured")
	}

	// Test 2: Create and verify state token
	state := oauthService.CreateStateToken()
	if state == "" {
		t.Fatal("State token should not be empty")
	}

	if !oauthService.VerifyStateToken(state) {
		t.Fatal("State token should be valid")
	}

	// Test 3: Generate auth URL
	authURL := oauthService.GenerateAuthURL(state)
	if !strings.Contains(authURL, "github.com/login/oauth/authorize") {
		t.Fatal("Auth URL should contain GitHub OAuth endpoint")
	}

	if !strings.Contains(authURL, clientID) {
		t.Fatal("Auth URL should contain client ID")
	}

	if !strings.Contains(authURL, state) {
		t.Fatal("Auth URL should contain state parameter")
	}

	// Test 4: Test session cookie creation and verification
	testUser := &auth.User{
		ID:        1,
		GitHubID:  12345,
		Login:     "testuser",
		Name:      "Test User",
		AvatarURL: "https://avatar.url/test.jpg",
		Role:      "admin",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	sessionCookie, err := oauthService.CreateSessionCookie(testUser)
	if err != nil {
		t.Fatalf("Failed to create session cookie: %v", err)
	}

	if sessionCookie.Name != "glinr_session" {
		t.Fatal("Session cookie should have correct name")
	}

	if !sessionCookie.HttpOnly || !sessionCookie.Secure {
		t.Fatal("Session cookie should be HttpOnly and Secure")
	}

	// Test 5: Verify session cookie
	verifiedUser, err := oauthService.VerifySessionCookie(sessionCookie.Value)
	if err != nil {
		t.Fatalf("Failed to verify session cookie: %v", err)
	}

	if verifiedUser.ID != testUser.ID || verifiedUser.Login != testUser.Login {
		t.Fatal("Verified user should match original user")
	}

	// Test 6: Test user store operations
	// First user should become admin
	userCount, err := storeInstance.CountUsers(ctx)
	if err != nil {
		t.Fatalf("Failed to count users: %v", err)
	}

	if userCount != 0 {
		t.Fatal("User count should be 0 initially")
	}

	mockGitHubUser := &auth.GitHubUser{
		ID:        67890,
		Login:     "integration-test-user",
		Name:      "Integration Test User",
		AvatarURL: "https://avatar.url/integration.jpg",
	}

	authenticatedUser, err := oauthService.AuthenticateUser(ctx, mockGitHubUser)
	if err != nil {
		t.Fatalf("Failed to authenticate user: %v", err)
	}

	if authenticatedUser.Role != "admin" {
		t.Fatal("First user should be admin")
	}

	if authenticatedUser.Login != mockGitHubUser.Login {
		t.Fatal("Authenticated user should have correct login")
	}

	// Test 7: Second user should be viewer
	secondGitHubUser := &auth.GitHubUser{
		ID:        67891,
		Login:     "second-user",
		Name:      "Second User",
		AvatarURL: "https://avatar.url/second.jpg",
	}

	secondUser, err := oauthService.AuthenticateUser(ctx, secondGitHubUser)
	if err != nil {
		t.Fatalf("Failed to authenticate second user: %v", err)
	}

	if secondUser.Role != "viewer" {
		t.Fatal("Second user should be viewer")
	}

	// Test 8: Existing user update
	// Update first user's info
	updatedGitHubUser := &auth.GitHubUser{
		ID:        67890, // Same GitHub ID
		Login:     "updated-login",
		Name:      "Updated Name",
		AvatarURL: "https://avatar.url/updated.jpg",
	}

	updatedUser, err := oauthService.AuthenticateUser(ctx, updatedGitHubUser)
	if err != nil {
		t.Fatalf("Failed to update user: %v", err)
	}

	if updatedUser.Role != "admin" {
		t.Fatal("Updated user should preserve admin role")
	}

	if updatedUser.Login != "updated-login" {
		t.Fatal("User login should be updated")
	}

	if updatedUser.Name != "Updated Name" {
		t.Fatal("User name should be updated")
	}

	fmt.Println("✅ All OAuth integration tests passed!")
}