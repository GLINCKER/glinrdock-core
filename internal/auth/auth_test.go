package auth

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// MockStore implements Store interface for testing
type MockStore struct {
	mock.Mock
}

func (m *MockStore) VerifyToken(ctx context.Context, plain string) (string, error) {
	args := m.Called(ctx, plain)
	return args.String(0), args.Error(1)
}

func (m *MockStore) TouchToken(ctx context.Context, name string) error {
	args := m.Called(ctx, name)
	return args.Error(0)
}

func (m *MockStore) TokenCount(ctx context.Context) (int, error) {
	args := m.Called(ctx)
	return args.Int(0), args.Error(1)
}

func (m *MockStore) CreateToken(ctx context.Context, name, plain, role string) (store.Token, error) {
	args := m.Called(ctx, name, plain, role)
	return args.Get(0).(store.Token), args.Error(1)
}

func (m *MockStore) GetTokenByName(ctx context.Context, name string) (store.Token, error) {
	args := m.Called(ctx, name)
	return args.Get(0).(store.Token), args.Error(1)
}

func TestAuthService_Middleware(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("ValidToken", func(t *testing.T) {
		mockStore := &MockStore{}
		token := store.Token{
			Name: "test-user",
			Role: store.RoleViewer,
		}
		mockStore.On("VerifyToken", mock.Anything, "valid-token").Return("test-user", nil)
		mockStore.On("GetTokenByName", mock.Anything, "test-user").Return(token, nil)
		mockStore.On("TouchToken", mock.Anything, "test-user").Return(nil)

		authService := NewAuthService(mockStore)
		middleware := authService.Middleware()

		// Create test context
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request, _ = http.NewRequest("GET", "/test", nil)
		c.Request.Header.Set("Authorization", "Bearer valid-token")

		// Test handler that checks if middleware passed
		var called bool
		testHandler := func(c *gin.Context) {
			called = true
			tokenName, exists := c.Get("token_name")
			assert.True(t, exists)
			assert.Equal(t, "test-user", tokenName)
			tokenRole, exists := c.Get("token_role")
			assert.True(t, exists)
			assert.Equal(t, store.RoleViewer, tokenRole)
		}

		// Execute middleware and handler
		middleware(c)
		if !c.IsAborted() {
			testHandler(c)
		}

		assert.True(t, called)
		assert.Equal(t, http.StatusOK, w.Code)
		mockStore.AssertExpectations(t)
	})

	t.Run("MissingToken", func(t *testing.T) {
		mockStore := &MockStore{}
		authService := NewAuthService(mockStore)
		middleware := authService.Middleware()

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request, _ = http.NewRequest("GET", "/test", nil)

		middleware(c)

		assert.True(t, c.IsAborted())
		assert.Equal(t, http.StatusUnauthorized, w.Code)
		assert.Contains(t, w.Body.String(), "missing bearer token")
	})

	t.Run("InvalidToken", func(t *testing.T) {
		mockStore := &MockStore{}
		mockStore.On("VerifyToken", mock.Anything, "invalid-token").Return("", assert.AnError)

		authService := NewAuthService(mockStore)
		middleware := authService.Middleware()

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request, _ = http.NewRequest("GET", "/test", nil)
		c.Request.Header.Set("Authorization", "Bearer invalid-token")

		middleware(c)

		assert.True(t, c.IsAborted())
		assert.Equal(t, http.StatusUnauthorized, w.Code)
		assert.Contains(t, w.Body.String(), "invalid token")
		mockStore.AssertExpectations(t)
	})

	t.Run("EmptyBearerToken", func(t *testing.T) {
		mockStore := &MockStore{}
		authService := NewAuthService(mockStore)
		middleware := authService.Middleware()

		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request, _ = http.NewRequest("GET", "/test", nil)
		c.Request.Header.Set("Authorization", "Bearer ")

		middleware(c)

		assert.True(t, c.IsAborted())
		assert.Equal(t, http.StatusUnauthorized, w.Code)
		assert.Contains(t, w.Body.String(), "empty bearer token")
	})
}

func TestAuthService_BootstrapAdminToken(t *testing.T) {
	ctx := context.Background()

	t.Run("NoAdminTokenSet", func(t *testing.T) {
		mockStore := &MockStore{}
		authService := NewAuthService(mockStore)

		err := authService.BootstrapAdminToken(ctx, "")
		assert.NoError(t, err)
		mockStore.AssertNotCalled(t, "TokenCount")
	})

	t.Run("TokensAlreadyExist", func(t *testing.T) {
		mockStore := &MockStore{}
		mockStore.On("TokenCount", ctx).Return(5, nil)

		authService := NewAuthService(mockStore)

		err := authService.BootstrapAdminToken(ctx, "admin-secret")
		assert.NoError(t, err)
		mockStore.AssertNotCalled(t, "CreateToken")
		mockStore.AssertExpectations(t)
	})

	t.Run("CreateAdminToken", func(t *testing.T) {
		mockStore := &MockStore{}
		mockStore.On("TokenCount", ctx).Return(0, nil)
		expectedToken := store.Token{ID: 1, Name: "admin", Role: store.RoleAdmin}
		mockStore.On("CreateToken", ctx, "admin", "admin-secret", store.RoleAdmin).Return(expectedToken, nil)

		authService := NewAuthService(mockStore)

		err := authService.BootstrapAdminToken(ctx, "admin-secret")
		require.NoError(t, err)
		mockStore.AssertExpectations(t)
	})
}

func setupTestRouter(authService *AuthService) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	
	// Public endpoint
	r.GET("/public", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "public"})
	})
	
	// Protected routes
	protected := r.Group("/protected")
	protected.Use(authService.Middleware())
	{
		// Any authenticated user
		protected.GET("/viewer", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "viewer access", "role": CurrentRole(c)})
		})
		
		// Deployer+ only
		protected.POST("/deploy", authService.RequireRole(store.RoleDeployer), func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "deploy access", "role": CurrentRole(c)})
		})
		
		// Admin only
		protected.POST("/admin", authService.RequireAdminRole(), func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "admin access", "role": CurrentRole(c)})
		})
	}
	
	return r
}

func TestAuthService_RequireRole_AdminAccess(t *testing.T) {
	tests := []struct {
		userRole   string
		endpoint   string
		method     string
		expectCode int
		desc       string
	}{
		{store.RoleAdmin, "/protected/viewer", "GET", http.StatusOK, "admin accessing viewer endpoint"},
		{store.RoleAdmin, "/protected/deploy", "POST", http.StatusOK, "admin accessing deployer endpoint"},
		{store.RoleAdmin, "/protected/admin", "POST", http.StatusOK, "admin accessing admin endpoint"},
	}
	
	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			mockStore := &MockStore{}
			token := store.Token{
				Name: "admin-token",
				Role: test.userRole,
			}
			
			mockStore.On("VerifyToken", mock.Anything, "admin-token").Return("admin-token", nil)
			mockStore.On("GetTokenByName", mock.Anything, "admin-token").Return(token, nil)
			mockStore.On("TouchToken", mock.Anything, "admin-token").Return(nil)
			
			authService := NewAuthService(mockStore)
			router := setupTestRouter(authService)
			
			req := httptest.NewRequest(test.method, test.endpoint, nil)
			req.Header.Set("Authorization", "Bearer admin-token")
			w := httptest.NewRecorder()
			
			router.ServeHTTP(w, req)
			
			assert.Equal(t, test.expectCode, w.Code)
			mockStore.AssertExpectations(t)
		})
	}
}

func TestAuthService_RequireRole_DeployerAccess(t *testing.T) {
	tests := []struct {
		endpoint   string
		method     string
		expectCode int
		desc       string
	}{
		{"/protected/viewer", "GET", http.StatusOK, "deployer accessing viewer endpoint"},
		{"/protected/deploy", "POST", http.StatusOK, "deployer accessing deployer endpoint"},
		{"/protected/admin", "POST", http.StatusForbidden, "deployer accessing admin endpoint"},
	}
	
	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			mockStore := &MockStore{}
			token := store.Token{
				Name: "deployer-token",
				Role: store.RoleDeployer,
			}
			
			mockStore.On("VerifyToken", mock.Anything, "deployer-token").Return("deployer-token", nil)
			mockStore.On("GetTokenByName", mock.Anything, "deployer-token").Return(token, nil)
			mockStore.On("TouchToken", mock.Anything, "deployer-token").Return(nil)
			
			authService := NewAuthService(mockStore)
			router := setupTestRouter(authService)
			
			req := httptest.NewRequest(test.method, test.endpoint, nil)
			req.Header.Set("Authorization", "Bearer deployer-token")
			w := httptest.NewRecorder()
			
			router.ServeHTTP(w, req)
			
			assert.Equal(t, test.expectCode, w.Code)
			if test.expectCode == http.StatusForbidden {
				assert.Contains(t, w.Body.String(), "insufficient permissions")
			}
			mockStore.AssertExpectations(t)
		})
	}
}

func TestAuthService_RequireRole_ViewerAccess(t *testing.T) {
	tests := []struct {
		endpoint   string
		method     string
		expectCode int
		desc       string
	}{
		{"/protected/viewer", "GET", http.StatusOK, "viewer accessing viewer endpoint"},
		{"/protected/deploy", "POST", http.StatusForbidden, "viewer accessing deployer endpoint"},
		{"/protected/admin", "POST", http.StatusForbidden, "viewer accessing admin endpoint"},
	}
	
	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			mockStore := &MockStore{}
			token := store.Token{
				Name: "viewer-token",
				Role: store.RoleViewer,
			}
			
			mockStore.On("VerifyToken", mock.Anything, "viewer-token").Return("viewer-token", nil)
			mockStore.On("GetTokenByName", mock.Anything, "viewer-token").Return(token, nil)
			mockStore.On("TouchToken", mock.Anything, "viewer-token").Return(nil)
			
			authService := NewAuthService(mockStore)
			router := setupTestRouter(authService)
			
			req := httptest.NewRequest(test.method, test.endpoint, nil)
			req.Header.Set("Authorization", "Bearer viewer-token")
			w := httptest.NewRecorder()
			
			router.ServeHTTP(w, req)
			
			assert.Equal(t, test.expectCode, w.Code)
			if test.expectCode == http.StatusForbidden {
				assert.Contains(t, w.Body.String(), "insufficient permissions")
			}
			mockStore.AssertExpectations(t)
		})
	}
}

func TestCurrentRole(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	t.Run("returns role when set", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Set("token_role", store.RoleDeployer)
		
		role := CurrentRole(c)
		assert.Equal(t, store.RoleDeployer, role)
	})
	
	t.Run("returns empty string when not set", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		
		role := CurrentRole(c)
		assert.Equal(t, "", role)
	})
}

func TestCurrentTokenName(t *testing.T) {
	gin.SetMode(gin.TestMode)
	
	t.Run("returns token name when set", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		c.Set("token_name", "test-token")
		
		name := CurrentTokenName(c)
		assert.Equal(t, "test-token", name)
	})
	
	t.Run("returns empty string when not set", func(t *testing.T) {
		c, _ := gin.CreateTestContext(httptest.NewRecorder())
		
		name := CurrentTokenName(c)
		assert.Equal(t, "", name)
	})
}

func TestHasPermission(t *testing.T) {
	tests := []struct {
		userRole string
		minRole  string
		expected bool
		desc     string
	}{
		// Admin tests
		{store.RoleAdmin, store.RoleAdmin, true, "admin accessing admin"},
		{store.RoleAdmin, store.RoleDeployer, true, "admin accessing deployer"},
		{store.RoleAdmin, store.RoleViewer, true, "admin accessing viewer"},
		
		// Deployer tests
		{store.RoleDeployer, store.RoleAdmin, false, "deployer accessing admin"},
		{store.RoleDeployer, store.RoleDeployer, true, "deployer accessing deployer"},
		{store.RoleDeployer, store.RoleViewer, true, "deployer accessing viewer"},
		
		// Viewer tests
		{store.RoleViewer, store.RoleAdmin, false, "viewer accessing admin"},
		{store.RoleViewer, store.RoleDeployer, false, "viewer accessing deployer"},
		{store.RoleViewer, store.RoleViewer, true, "viewer accessing viewer"},
		
		// Invalid role tests
		{"invalid", store.RoleAdmin, false, "invalid role accessing admin"},
		{"invalid", store.RoleViewer, false, "invalid role accessing viewer"},
	}
	
	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			result := hasPermission(test.userRole, test.minRole)
			assert.Equal(t, test.expected, result)
		})
	}
}

func TestAuthService_RequireRole_NoAuthContext(t *testing.T) {
	mockStore := &MockStore{}
	authService := NewAuthService(mockStore)
	
	middleware := authService.RequireRole(store.RoleViewer)
	
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request, _ = http.NewRequest("GET", "/test", nil)
	
	middleware(c)
	
	assert.True(t, c.IsAborted())
	assert.Equal(t, http.StatusUnauthorized, w.Code)
	assert.Contains(t, w.Body.String(), "authentication required")
}