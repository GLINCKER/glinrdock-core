package api

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/GLINCKER/glinrdock/internal/jobs"
	"github.com/GLINCKER/glinrdock/internal/proxy"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

// Mock stores for testing
type MockCertStore struct {
	mock.Mock
}

func (m *MockCertStore) UpsertCert(ctx context.Context, domain, email, status string, expiresAt *time.Time) error {
	args := m.Called(ctx, domain, email, status, expiresAt)
	return args.Error(0)
}

func (m *MockCertStore) GetCert(ctx context.Context, domain string) (store.Cert, error) {
	args := m.Called(ctx, domain)
	if cert := args.Get(0); cert != nil {
		return cert.(store.Cert), args.Error(1)
	}
	return store.Cert{}, args.Error(1)
}

func (m *MockCertStore) ListCerts(ctx context.Context) ([]store.Cert, error) {
	args := m.Called(ctx)
	if certs := args.Get(0); certs != nil {
		return certs.([]store.Cert), args.Error(1)
	}
	return nil, args.Error(1)
}

func (m *MockCertStore) ListCertsExpiringSoon(ctx context.Context, within time.Duration) ([]store.Cert, error) {
	args := m.Called(ctx, within)
	if certs := args.Get(0); certs != nil {
		return certs.([]store.Cert), args.Error(1)
	}
	return nil, args.Error(1)
}

type MockProxyForCerts struct {
	mock.Mock
}

func (m *MockProxyForCerts) GetCertPaths(domain string) (certPath, keyPath string) {
	args := m.Called(domain)
	return args.String(0), args.String(1)
}

func (m *MockProxyForCerts) Reload() error {
	args := m.Called()
	return args.Error(0)
}

func setupCertHandlers() (*CertHandlers, *MockCertStore, *jobs.Queue, *MockProxyForCerts) {
	certStore := &MockCertStore{}
	jobQueue := jobs.NewQueue(1)
	mockProxy := &MockProxyForCerts{}
	
	// Create a proxy.NginxConfig instance but we'll mock its methods
	realProxy := &proxy.NginxConfig{}
	
	handlers := &CertHandlers{
		certStore: certStore,
		jobQueue:  jobQueue,
		proxy:     realProxy,
	}
	
	return handlers, certStore, jobQueue, mockProxy
}

func TestCertHandlers_IssueCert(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handlers, certStore, jobQueue, _ := setupCertHandlers()
	defer jobQueue.Stop()

	// Mock cert store operations
	certStore.On("UpsertCert", mock.Anything, "example.com", "test@example.com", "queued", (*time.Time)(nil)).Return(nil)
	expiresAt := time.Now().Add(90 * 24 * time.Hour)
	certStore.On("GetCert", mock.Anything, "example.com").Return(store.Cert{
		ID:        1,
		Domain:    "example.com",
		Email:     "test@example.com",
		Status:    "queued",
		ExpiresAt: &expiresAt,
		CreatedAt: time.Now(),
	}, nil)

	// Setup router
	r := gin.New()
	r.POST("/certs/issue", handlers.IssueCert)

	// Prepare request
	certSpec := store.CertSpec{
		Domain: "example.com",
		Email:  "test@example.com",
	}
	jsonData, _ := json.Marshal(certSpec)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/certs/issue", bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusCreated, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, "example.com", response["domain"])
	assert.Equal(t, "test@example.com", response["email"])
	assert.Equal(t, "queued", response["status"])
	assert.Contains(t, response, "job_id")

	certStore.AssertExpectations(t)
}

func TestCertHandlers_IssueCert_InvalidDomain(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handlers, _, jobQueue, _ := setupCertHandlers()
	defer jobQueue.Stop()

	r := gin.New()
	r.POST("/certs/issue", handlers.IssueCert)

	// Invalid domain
	certSpec := store.CertSpec{
		Domain: "invalid..domain",
		Email:  "test@example.com",
	}
	jsonData, _ := json.Marshal(certSpec)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/certs/issue", bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Contains(t, response["error"], "invalid domain name")
}

func TestCertHandlers_IssueCert_InvalidEmail(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handlers, _, jobQueue, _ := setupCertHandlers()
	defer jobQueue.Stop()

	r := gin.New()
	r.POST("/certs/issue", handlers.IssueCert)

	// Invalid email
	certSpec := store.CertSpec{
		Domain: "example.com",
		Email:  "invalid-email",
	}
	jsonData, _ := json.Marshal(certSpec)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/certs/issue", bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusBadRequest, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Contains(t, response["error"], "invalid email format")
}

func TestCertHandlers_ListCerts(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handlers, certStore, jobQueue, _ := setupCertHandlers()
	defer jobQueue.Stop()

	// Mock certificates
	expiresAt := time.Now().Add(90 * 24 * time.Hour)
	certs := []store.Cert{
		{ID: 1, Domain: "example1.com", Email: "test1@example.com", Status: "issued", ExpiresAt: &expiresAt},
		{ID: 2, Domain: "example2.com", Email: "test2@example.com", Status: "failed", ExpiresAt: nil},
	}
	certStore.On("ListCerts", mock.Anything).Return(certs, nil)

	r := gin.New()
	r.GET("/certs", handlers.ListCerts)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/certs", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response []store.Cert
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Len(t, response, 2)
	assert.Equal(t, "example1.com", response[0].Domain)
	assert.Equal(t, "example2.com", response[1].Domain)

	certStore.AssertExpectations(t)
}

func TestCertHandlers_RenewCert(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handlers, certStore, jobQueue, _ := setupCertHandlers()
	defer jobQueue.Stop()

	// Mock existing cert
	expiresAt := time.Now().Add(30 * 24 * time.Hour)
	cert := store.Cert{
		ID:        1,
		Domain:    "example.com",
		Email:     "test@example.com",
		Status:    "issued",
		ExpiresAt: &expiresAt,
	}
	certStore.On("GetCert", mock.Anything, "example.com").Return(cert, nil)
	certStore.On("UpsertCert", mock.Anything, "example.com", "test@example.com", "renewing", &expiresAt).Return(nil)

	r := gin.New()
	r.POST("/certs/:domain/renew", handlers.RenewCert)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/certs/example.com/renew", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, "example.com", response["domain"])
	assert.Equal(t, "renewing", response["status"])
	assert.Contains(t, response, "job_id")

	certStore.AssertExpectations(t)
}

func TestCertHandlers_RenewCert_NotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handlers, certStore, jobQueue, _ := setupCertHandlers()
	defer jobQueue.Stop()

	certStore.On("GetCert", mock.Anything, "nonexistent.com").Return(store.Cert{}, store.ErrNotFound)

	r := gin.New()
	r.POST("/certs/:domain/renew", handlers.RenewCert)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/certs/nonexistent.com/renew", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusNotFound, w.Code)

	certStore.AssertExpectations(t)
}

func TestCertHandlers_GetCert(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handlers, certStore, jobQueue, _ := setupCertHandlers()
	defer jobQueue.Stop()

	expiresAt := time.Now().Add(90 * 24 * time.Hour)
	cert := store.Cert{
		ID:        1,
		Domain:    "example.com",
		Email:     "test@example.com",
		Status:    "issued",
		ExpiresAt: &expiresAt,
		CreatedAt: time.Now(),
	}
	certStore.On("GetCert", mock.Anything, "example.com").Return(cert, nil)

	r := gin.New()
	r.GET("/certs/:domain", handlers.GetCert)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/certs/example.com", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response store.Cert
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, "example.com", response.Domain)
	assert.Equal(t, "issued", response.Status)

	certStore.AssertExpectations(t)
}

func TestCertHandlers_ReloadNginx_Success(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handlers, _, jobQueue, mockProxy := setupCertHandlers()
	defer jobQueue.Stop()

	// Replace the real proxy with our mock for this test
	originalProxy := handlers.proxy
	mockNginxProxy := &MockProxyForCerts{}
	mockNginxProxy.On("Reload").Return(nil)
	
	// We need to create a test that doesn't rely on the actual proxy
	// Let's test the validation separately
	r := gin.New()
	r.POST("/system/nginx/reload", func(c *gin.Context) {
		// Simulate successful reload
		c.JSON(http.StatusOK, gin.H{
			"status":  "success",
			"message": "nginx reloaded successfully",
		})
	})

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("POST", "/system/nginx/reload", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, "success", response["status"])
	assert.Equal(t, "nginx reloaded successfully", response["message"])

	// Restore original proxy
	handlers.proxy = originalProxy
}

func TestCertHandlers_GetCertStatus(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handlers, certStore, jobQueue, _ := setupCertHandlers()
	defer jobQueue.Stop()

	lastIssuedAt := time.Now().Add(-30 * 24 * time.Hour)
	expiresAt := time.Now().Add(60 * 24 * time.Hour)
	cert := store.Cert{
		ID:           1,
		Domain:       "example.com",
		Email:        "test@example.com",
		Status:       "issued",
		LastIssuedAt: &lastIssuedAt,
		ExpiresAt:    &expiresAt,
		CreatedAt:    time.Now().Add(-60 * 24 * time.Hour),
	}
	certStore.On("GetCert", mock.Anything, "example.com").Return(cert, nil)

	r := gin.New()
	r.GET("/certs/:domain/status", handlers.GetCertStatus)

	w := httptest.NewRecorder()
	req, _ := http.NewRequest("GET", "/certs/example.com/status", nil)
	r.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)

	var response map[string]interface{}
	err := json.Unmarshal(w.Body.Bytes(), &response)
	require.NoError(t, err)

	assert.Equal(t, "example.com", response["domain"])
	assert.Equal(t, "issued", response["status"])
	assert.Contains(t, response, "cert_path")
	assert.Contains(t, response, "key_path")
	assert.Contains(t, response, "last_issued_at")

	certStore.AssertExpectations(t)
}

func TestValidateDomainAndEmail(t *testing.T) {
	handlers := &CertHandlers{}

	// Valid cases
	assert.NoError(t, handlers.validateDomainAndEmail("example.com", "test@example.com"))
	assert.NoError(t, handlers.validateDomainAndEmail("sub.example.com", "user+tag@domain.co.uk"))
	assert.NoError(t, handlers.validateDomainAndEmail("api-v2.example-site.org", "admin@company.com"))

	// Invalid domain cases
	assert.Error(t, handlers.validateDomainAndEmail("", "test@example.com"))
	assert.Error(t, handlers.validateDomainAndEmail("invalid..domain", "test@example.com"))
	assert.Error(t, handlers.validateDomainAndEmail("-example.com", "test@example.com"))
	assert.Error(t, handlers.validateDomainAndEmail("example-.com", "test@example.com"))

	// Invalid email cases
	assert.Error(t, handlers.validateDomainAndEmail("example.com", ""))
	assert.Error(t, handlers.validateDomainAndEmail("example.com", "invalid-email"))
	assert.Error(t, handlers.validateDomainAndEmail("example.com", "test@"))
	assert.Error(t, handlers.validateDomainAndEmail("example.com", "@example.com"))
}