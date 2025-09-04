package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/GLINCKER/glinrdock/internal/crypto"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
)

// mockEnvVarStore implements the EnvVarStore interface for testing
type mockEnvVarStore struct {
	envVars map[string]store.EnvVar
	service *store.Service
}

func newMockEnvVarStore() *mockEnvVarStore {
	return &mockEnvVarStore{
		envVars: make(map[string]store.EnvVar),
		service: &store.Service{
			ID:        1,
			ProjectID: 1,
			Name:      "test-service",
			Image:     "nginx:latest",
		},
	}
}

func (m *mockEnvVarStore) SetEnvVar(ctx context.Context, serviceID int64, key, value string, isSecret bool, nonce, ciphertext []byte) error {
	if serviceID != 1 {
		return store.ErrNotFound
	}
	
	envVar := store.EnvVar{
		ID:         int64(len(m.envVars) + 1),
		ServiceID:  serviceID,
		Key:        key,
		Value:      value,
		IsSecret:   isSecret,
		Nonce:      nonce,
		Ciphertext: ciphertext,
	}
	
	m.envVars[key] = envVar
	return nil
}

func (m *mockEnvVarStore) GetEnvVar(ctx context.Context, serviceID int64, key string) (store.EnvVar, error) {
	if serviceID != 1 {
		return store.EnvVar{}, store.ErrNotFound
	}
	
	envVar, exists := m.envVars[key]
	if !exists {
		return store.EnvVar{}, store.ErrNotFound
	}
	
	return envVar, nil
}

func (m *mockEnvVarStore) ListEnvVars(ctx context.Context, serviceID int64) ([]store.EnvVar, error) {
	if serviceID != 1 {
		return nil, store.ErrNotFound
	}
	
	var envVars []store.EnvVar
	for _, envVar := range m.envVars {
		envVars = append(envVars, envVar)
	}
	
	return envVars, nil
}

func (m *mockEnvVarStore) DeleteEnvVar(ctx context.Context, serviceID int64, key string) error {
	if serviceID != 1 {
		return store.ErrNotFound
	}
	
	if _, exists := m.envVars[key]; !exists {
		return store.ErrNotFound
	}
	
	delete(m.envVars, key)
	return nil
}

func (m *mockEnvVarStore) BulkSetEnvVars(ctx context.Context, serviceID int64, envVars []store.EnvVarUpdate) error {
	if serviceID != 1 {
		return store.ErrNotFound
	}
	
	for _, update := range envVars {
		err := m.SetEnvVar(ctx, serviceID, update.Key, update.Value, update.IsSecret, update.Nonce, update.Ciphertext)
		if err != nil {
			return err
		}
	}
	
	return nil
}

func (m *mockEnvVarStore) BulkDeleteEnvVars(ctx context.Context, serviceID int64, keys []string) error {
	if serviceID != 1 {
		return store.ErrNotFound
	}
	
	for _, key := range keys {
		delete(m.envVars, key)
	}
	
	return nil
}

func (m *mockEnvVarStore) GetService(ctx context.Context, id int64) (store.Service, error) {
	if id != 1 {
		return store.Service{}, store.ErrNotFound
	}
	return *m.service, nil
}

func setupTestHandlers() (*Handlers, *mockEnvVarStore) {
	mockStore := newMockEnvVarStore()
	handlers := &Handlers{
		envVarStore: mockStore,
	}
	return handlers, mockStore
}

func TestGetServiceEnvVars(t *testing.T) {
	// Set up environment with valid secret key for testing
	originalEnv := os.Getenv("GLINRDOCK_SECRET")
	defer func() {
		if originalEnv != "" {
			os.Setenv("GLINRDOCK_SECRET", originalEnv)
		} else {
			os.Unsetenv("GLINRDOCK_SECRET")
		}
	}()
	
	// Generate test key
	testKey := make([]byte, 32)
	for i := range testKey {
		testKey[i] = byte(i)
	}
	os.Setenv("GLINRDOCK_SECRET", "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=")
	
	handlers, mockStore := setupTestHandlers()

	// Add some test data
	mockStore.SetEnvVar(context.Background(), 1, "PLAIN_VAR", "plain_value", false, nil, nil)
	
	// Add a secret var with encryption
	masterKey, _ := crypto.LoadMasterKeyFromEnv()
	nonce, ciphertext, _ := crypto.Encrypt(masterKey, []byte("secret_value"))
	mockStore.SetEnvVar(context.Background(), 1, "SECRET_VAR", "", true, nonce, ciphertext)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	
	t.Run("ViewerRole", func(t *testing.T) {
		router.GET("/services/:id/env-vars", func(c *gin.Context) {
			c.Set("user_role", store.RoleViewer)
			handlers.GetServiceEnvVars(c)
		})

		req := httptest.NewRequest("GET", "/services/1/env-vars", nil)
		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		if resp.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", resp.Code)
		}

		var response map[string][]EnvVarResponse
		err := json.Unmarshal(resp.Body.Bytes(), &response)
		if err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		envVars := response["env_vars"]
		if len(envVars) != 2 {
			t.Errorf("Expected 2 env vars, got %d", len(envVars))
		}

		// Check that secret is masked for viewer
		for _, envVar := range envVars {
			if envVar.Key == "SECRET_VAR" {
				if envVar.Value != "******" {
					t.Errorf("Expected secret to be masked for viewer, got %q", envVar.Value)
				}
				if !envVar.IsSecret {
					t.Error("Expected IsSecret to be true")
				}
			} else if envVar.Key == "PLAIN_VAR" {
				if envVar.Value != "plain_value" {
					t.Errorf("Expected plain value to be visible, got %q", envVar.Value)
				}
				if envVar.IsSecret {
					t.Error("Expected IsSecret to be false")
				}
			}
		}
	})

	t.Run("DeployerRole", func(t *testing.T) {
		router.GET("/services/:id/env-vars-deployer", func(c *gin.Context) {
			c.Set("user_role", store.RoleDeployer)
			handlers.GetServiceEnvVars(c)
		})

		req := httptest.NewRequest("GET", "/services/1/env-vars-deployer", nil)
		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)

		if resp.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d", resp.Code)
		}

		var response map[string][]EnvVarResponse
		err := json.Unmarshal(resp.Body.Bytes(), &response)
		if err != nil {
			t.Fatalf("Failed to parse response: %v", err)
		}

		envVars := response["env_vars"]
		
		// Check that secret is decrypted for deployer
		for _, envVar := range envVars {
			if envVar.Key == "SECRET_VAR" {
				if envVar.Value != "secret_value" {
					t.Errorf("Expected secret to be decrypted for deployer, got %q", envVar.Value)
				}
			}
		}
	})
}

func TestSetServiceEnvVar(t *testing.T) {
	// Set up environment with valid secret key
	originalEnv := os.Getenv("GLINRDOCK_SECRET")
	defer func() {
		if originalEnv != "" {
			os.Setenv("GLINRDOCK_SECRET", originalEnv)
		} else {
			os.Unsetenv("GLINRDOCK_SECRET")
		}
	}()
	os.Setenv("GLINRDOCK_SECRET", "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=")

	handlers, mockStore := setupTestHandlers()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.PUT("/services/:id/env-vars", func(c *gin.Context) {
		c.Set("user_role", store.RoleDeployer)
		handlers.SetServiceEnvVar(c)
	})

	t.Run("SetPlainVar", func(t *testing.T) {
		req := EnvVarRequest{
			Key:      "TEST_VAR",
			Value:    "test_value",
			IsSecret: false,
		}

		reqBody, _ := json.Marshal(req)
		httpReq := httptest.NewRequest("PUT", "/services/1/env-vars", bytes.NewReader(reqBody))
		httpReq.Header.Set("Content-Type", "application/json")
		
		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, httpReq)

		if resp.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d: %s", resp.Code, resp.Body.String())
		}

		// Verify it was stored
		envVar, err := mockStore.GetEnvVar(context.Background(), 1, "TEST_VAR")
		if err != nil {
			t.Errorf("Failed to get stored env var: %v", err)
		}

		if envVar.Value != "test_value" {
			t.Errorf("Expected stored value 'test_value', got %q", envVar.Value)
		}
		if envVar.IsSecret {
			t.Error("Expected IsSecret to be false")
		}
	})

	t.Run("SetSecretVar", func(t *testing.T) {
		req := EnvVarRequest{
			Key:      "SECRET_TEST",
			Value:    "secret_test_value",
			IsSecret: true,
		}

		reqBody, _ := json.Marshal(req)
		httpReq := httptest.NewRequest("PUT", "/services/1/env-vars", bytes.NewReader(reqBody))
		httpReq.Header.Set("Content-Type", "application/json")
		
		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, httpReq)

		if resp.Code != http.StatusOK {
			t.Errorf("Expected status 200, got %d: %s", resp.Code, resp.Body.String())
		}

		// Verify it was stored encrypted
		envVar, err := mockStore.GetEnvVar(context.Background(), 1, "SECRET_TEST")
		if err != nil {
			t.Errorf("Failed to get stored env var: %v", err)
		}

		if envVar.Value != "" {
			t.Errorf("Expected empty value for secret, got %q", envVar.Value)
		}
		if !envVar.IsSecret {
			t.Error("Expected IsSecret to be true")
		}
		if len(envVar.Nonce) == 0 || len(envVar.Ciphertext) == 0 {
			t.Error("Expected nonce and ciphertext to be set")
		}

		// Verify we can decrypt it
		masterKey, _ := crypto.LoadMasterKeyFromEnv()
		decrypted, err := crypto.Decrypt(masterKey, envVar.Nonce, envVar.Ciphertext)
		if err != nil {
			t.Errorf("Failed to decrypt stored secret: %v", err)
		}
		if string(decrypted) != "secret_test_value" {
			t.Errorf("Expected decrypted value 'secret_test_value', got %q", decrypted)
		}
	})

	t.Run("ViewerPermissions", func(t *testing.T) {
		router.PUT("/services/:id/env-vars-viewer", func(c *gin.Context) {
			c.Set("user_role", store.RoleViewer)
			handlers.SetServiceEnvVar(c)
		})

		req := EnvVarRequest{
			Key:      "FORBIDDEN",
			Value:    "test",
			IsSecret: false,
		}

		reqBody, _ := json.Marshal(req)
		httpReq := httptest.NewRequest("PUT", "/services/1/env-vars-viewer", bytes.NewReader(reqBody))
		httpReq.Header.Set("Content-Type", "application/json")
		
		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, httpReq)

		if resp.Code != http.StatusForbidden {
			t.Errorf("Expected status 403 for viewer, got %d", resp.Code)
		}
	})
}

func TestDeleteServiceEnvVar(t *testing.T) {
	handlers, mockStore := setupTestHandlers()

	// Add test data
	mockStore.SetEnvVar(context.Background(), 1, "TO_DELETE", "value", false, nil, nil)

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.DELETE("/services/:id/env-vars/:key", func(c *gin.Context) {
		c.Set("user_role", store.RoleDeployer)
		handlers.DeleteServiceEnvVar(c)
	})

	req := httptest.NewRequest("DELETE", "/services/1/env-vars/TO_DELETE", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d: %s", resp.Code, resp.Body.String())
	}

	// Verify it was deleted
	_, err := mockStore.GetEnvVar(context.Background(), 1, "TO_DELETE")
	if err != store.ErrNotFound {
		t.Error("Expected env var to be deleted")
	}
}

func TestInvalidServiceID(t *testing.T) {
	handlers, _ := setupTestHandlers()

	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.GET("/services/:id/env-vars", func(c *gin.Context) {
		c.Set("user_role", store.RoleDeployer)
		handlers.GetServiceEnvVars(c)
	})

	req := httptest.NewRequest("GET", "/services/999/env-vars", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusNotFound {
		t.Errorf("Expected status 404 for invalid service ID, got %d", resp.Code)
	}
}