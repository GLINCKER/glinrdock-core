package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Simple mock for testing RBAC token functionality
type SimpleTokenStore struct {
	tokens []store.Token
	nextID int64
}

func (s *SimpleTokenStore) CreateToken(ctx context.Context, name, plain, role string) (store.Token, error) {
	if name == "" || plain == "" {
		return store.Token{}, fmt.Errorf("name and plain are required")
	}
	if !store.IsRoleValid(role) {
		return store.Token{}, fmt.Errorf("invalid role: %s", role)
	}
	
	s.nextID++
	token := store.Token{
		ID:   s.nextID,
		Name: name,
		Role: role,
	}
	s.tokens = append(s.tokens, token)
	return token, nil
}

func (s *SimpleTokenStore) ListTokens(ctx context.Context) ([]store.Token, error) {
	return s.tokens, nil
}

func (s *SimpleTokenStore) DeleteTokenByName(ctx context.Context, name string) error {
	for i, token := range s.tokens {
		if token.Name == name {
			s.tokens = append(s.tokens[:i], s.tokens[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("token not found: %s", name)
}

func setupSimpleTokenRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	
	tokenStore := &SimpleTokenStore{nextID: 0}
	handlers := &Handlers{tokenStore: tokenStore}
	
	// Mock auth middleware
	r.Use(func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		switch authHeader {
		case "Bearer admin-token":
			c.Set("token_role", store.RoleAdmin)
			c.Set("token_name", "admin-token")
		case "Bearer deployer-token":
			c.Set("token_role", store.RoleDeployer)
			c.Set("token_name", "deployer-token")
		case "Bearer viewer-token":
			c.Set("token_role", store.RoleViewer)
			c.Set("token_name", "viewer-token")
		default:
			c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
			c.Abort()
			return
		}
		c.Next()
	})
	
	// Token endpoints with admin-only middleware
	tokens := r.Group("/tokens")
	tokens.Use(func(c *gin.Context) {
		role, exists := c.Get("token_role")
		if !exists || role.(string) != store.RoleAdmin {
			c.JSON(http.StatusForbidden, gin.H{"error": "insufficient permissions"})
			c.Abort()
			return
		}
		c.Next()
	})
	
	tokens.POST("", handlers.CreateToken)
	tokens.GET("", handlers.ListTokens)
	tokens.DELETE("/:name", handlers.DeleteToken)
	
	return r
}

func TestTokenRBAC_AdminCanCreateTokens(t *testing.T) {
	router := setupSimpleTokenRouter()
	
	tests := []struct {
		role string
		desc string
	}{
		{store.RoleAdmin, "create admin token"},
		{store.RoleDeployer, "create deployer token"},
		{store.RoleViewer, "create viewer token"},
	}
	
	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			reqBody := CreateTokenRequest{
				Name:  fmt.Sprintf("test-%s-token", test.role),
				Plain: "secret123",
				Role:  test.role,
			}
			bodyBytes, _ := json.Marshal(reqBody)
			
			req := httptest.NewRequest("POST", "/tokens", bytes.NewBuffer(bodyBytes))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer admin-token")
			w := httptest.NewRecorder()
			
			router.ServeHTTP(w, req)
			
			assert.Equal(t, http.StatusCreated, w.Code, "Admin should be able to create %s tokens", test.role)
			
			var response map[string]interface{}
			err := json.Unmarshal(w.Body.Bytes(), &response)
			require.NoError(t, err)
			
			assert.Equal(t, test.role, response["role"])
			assert.Equal(t, fmt.Sprintf("test-%s-token", test.role), response["name"])
		})
	}
}

func TestTokenRBAC_NonAdminCannotAccessTokens(t *testing.T) {
	router := setupSimpleTokenRouter()
	
	tests := []struct {
		token   string
		role    string
		method  string
		path    string
		desc    string
	}{
		{"Bearer deployer-token", store.RoleDeployer, "POST", "/tokens", "deployer cannot create tokens"},
		{"Bearer deployer-token", store.RoleDeployer, "GET", "/tokens", "deployer cannot list tokens"},
		{"Bearer deployer-token", store.RoleDeployer, "DELETE", "/tokens/test", "deployer cannot delete tokens"},
		{"Bearer viewer-token", store.RoleViewer, "POST", "/tokens", "viewer cannot create tokens"},
		{"Bearer viewer-token", store.RoleViewer, "GET", "/tokens", "viewer cannot list tokens"},
		{"Bearer viewer-token", store.RoleViewer, "DELETE", "/tokens/test", "viewer cannot delete tokens"},
	}
	
	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			var req *http.Request
			
			if test.method == "POST" {
				reqBody := CreateTokenRequest{
					Name:  "test-token",
					Plain: "secret123",
					Role:  store.RoleViewer,
				}
				bodyBytes, _ := json.Marshal(reqBody)
				req = httptest.NewRequest(test.method, test.path, bytes.NewBuffer(bodyBytes))
				req.Header.Set("Content-Type", "application/json")
			} else {
				req = httptest.NewRequest(test.method, test.path, nil)
			}
			
			req.Header.Set("Authorization", test.token)
			w := httptest.NewRecorder()
			
			router.ServeHTTP(w, req)
			
			assert.Equal(t, http.StatusForbidden, w.Code, "%s should be forbidden", test.desc)
			assert.Contains(t, w.Body.String(), "insufficient permissions")
		})
	}
}

func TestTokenRBAC_InvalidToken(t *testing.T) {
	router := setupSimpleTokenRouter()
	
	req := httptest.NewRequest("GET", "/tokens", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")
	w := httptest.NewRecorder()
	
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Contains(t, w.Body.String(), "unauthorized")
}

func TestTokenRBAC_NoToken(t *testing.T) {
	router := setupSimpleTokenRouter()
	
	req := httptest.NewRequest("GET", "/tokens", nil)
	w := httptest.NewRecorder()
	
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Contains(t, w.Body.String(), "unauthorized")
}

func TestTokenRBAC_RoleValidation(t *testing.T) {
	router := setupSimpleTokenRouter()
	
	tests := []struct {
		role      string
		valid     bool
		expectMsg string
		desc      string
	}{
		{store.RoleAdmin, true, "", "admin role is valid"},
		{store.RoleDeployer, true, "", "deployer role is valid"},
		{store.RoleViewer, true, "", "viewer role is valid"},
		{"invalid", false, "invalid role", "invalid role is rejected"},
		{"ADMIN", false, "invalid role", "case sensitive role check"},
		{"", false, "invalid role", "empty role is rejected"},
	}
	
	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			reqBody := CreateTokenRequest{
				Name:  "test-token",
				Plain: "secret123",
				Role:  test.role,
			}
			bodyBytes, _ := json.Marshal(reqBody)
			
			req := httptest.NewRequest("POST", "/tokens", bytes.NewBuffer(bodyBytes))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("Authorization", "Bearer admin-token")
			w := httptest.NewRecorder()
			
			router.ServeHTTP(w, req)
			
			if test.valid {
				assert.Equal(t, http.StatusCreated, w.Code, "Valid role should be accepted")
			} else {
				assert.Equal(t, http.StatusBadRequest, w.Code, "Invalid role should be rejected")
				assert.Contains(t, w.Body.String(), test.expectMsg)
			}
		})
	}
}

func TestTokenRBAC_TokenListIncludesRoles(t *testing.T) {
	router := setupSimpleTokenRouter()
	
	// Create tokens with different roles
	roles := []string{store.RoleAdmin, store.RoleDeployer, store.RoleViewer}
	for i, role := range roles {
		reqBody := CreateTokenRequest{
			Name:  fmt.Sprintf("token-%d", i),
			Plain: "secret123",
			Role:  role,
		}
		bodyBytes, _ := json.Marshal(reqBody)
		
		req := httptest.NewRequest("POST", "/tokens", bytes.NewBuffer(bodyBytes))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer admin-token")
		w := httptest.NewRecorder()
		
		router.ServeHTTP(w, req)
		require.Equal(t, http.StatusCreated, w.Code)
	}
	
	// List tokens and verify roles are included
	req := httptest.NewRequest("GET", "/tokens", nil)
	req.Header.Set("Authorization", "Bearer admin-token")
	w := httptest.NewRecorder()
	
	router.ServeHTTP(w, req)
	
	assert.Equal(t, http.StatusOK, w.Code)
	
	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)
	
	tokens := response["tokens"].([]interface{})
	assert.Len(t, tokens, 3)
	
	// Verify each token has the correct role
	expectedRoles := map[string]string{
		"token-0": store.RoleAdmin,
		"token-1": store.RoleDeployer,
		"token-2": store.RoleViewer,
	}
	
	for _, tokenIntf := range tokens {
		token := tokenIntf.(map[string]interface{})
		name := token["name"].(string)
		role := token["role"].(string)
		assert.Equal(t, expectedRoles[name], role, "Token %s should have role %s", name, expectedRoles[name])
	}
}