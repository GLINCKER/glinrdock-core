package cloudflare

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestClient_GetZoneID(t *testing.T) {
	tests := []struct {
		name           string
		domain         string
		mockResponse   string
		mockStatusCode int
		expectedZoneID string
		expectError    bool
		errorContains  string
	}{
		{
			name:           "successful zone lookup",
			domain:         "example.com",
			mockResponse:   `{"result":[{"id":"zone123","name":"example.com"}],"success":true,"errors":[],"messages":[]}`,
			mockStatusCode: 200,
			expectedZoneID: "zone123",
			expectError:    false,
		},
		{
			name:           "zone not found",
			domain:         "notfound.com",
			mockResponse:   `{"result":[],"success":true,"errors":[],"messages":[]}`,
			mockStatusCode: 200,
			expectError:    true,
			errorContains:  "Zone not found for domain: notfound.com",
		},
		{
			name:           "API error response",
			domain:         "error.com",
			mockResponse:   `{"result":[],"success":false,"errors":[{"code":1003,"message":"Invalid API token"}],"messages":[]}`,
			mockStatusCode: 403,
			expectError:    true,
			errorContains:  "Zone lookup failed",
		},
		{
			name:           "invalid JSON response",
			domain:         "invalid.com",
			mockResponse:   `invalid json`,
			mockStatusCode: 200,
			expectError:    true,
			errorContains:  "Failed to decode zone response",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// Verify the request
				assert.Equal(t, "GET", r.Method)
				assert.Equal(t, "/zones", r.URL.Path)
				assert.Equal(t, tt.domain, r.URL.Query().Get("name"))
				assert.Equal(t, "Bearer test-token", r.Header.Get("Authorization"))
				assert.Equal(t, "application/json", r.Header.Get("Content-Type"))

				w.WriteHeader(tt.mockStatusCode)
				w.Write([]byte(tt.mockResponse))
			}))
			defer server.Close()

			client := &Client{
				apiToken: "test-token",
				httpClient: &http.Client{
					Timeout: 5 * time.Second,
				},
			}

			// Replace baseURL for testing
			originalBaseURL := baseURL
			defer func() { baseURL = originalBaseURL }()
			baseURL = server.URL

			zoneID, err := client.GetZoneID(context.Background(), tt.domain)

			if tt.expectError {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorContains)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expectedZoneID, zoneID)
			}
		})
	}
}

func TestClient_EnsureRecord_Create(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == "GET" && strings.Contains(r.URL.Path, "dns_records"):
			// No existing records
			response := `{"result":[],"success":true,"errors":[],"messages":[]}`
			w.WriteHeader(200)
			w.Write([]byte(response))
		case r.Method == "POST" && strings.Contains(r.URL.Path, "dns_records"):
			// Verify request payload
			var req CreateRecordRequest
			err := json.NewDecoder(r.Body).Decode(&req)
			require.NoError(t, err)

			assert.Equal(t, "A", req.Type)
			assert.Equal(t, "test.example.com", req.Name)
			assert.Equal(t, "1.2.3.4", req.Content)
			assert.Equal(t, false, req.Proxied) // Default to false for certificate validation

			response := `{"result":{"id":"record123","type":"A","name":"test.example.com","content":"1.2.3.4","proxied":false,"ttl":300},"success":true,"errors":[]}`
			w.WriteHeader(200)
			w.Write([]byte(response))
		default:
			w.WriteHeader(404)
		}
	}))
	defer server.Close()

	client := &Client{
		apiToken: "test-token",
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}

	// Replace baseURL for testing
	originalBaseURL := baseURL
	defer func() { baseURL = originalBaseURL }()
	baseURL = server.URL

	record, err := client.EnsureRecord(context.Background(), "zone123", "A", "test.example.com", "1.2.3.4", false)

	require.NoError(t, err)
	assert.Equal(t, "record123", record.ID)
	assert.Equal(t, "A", record.Type)
	assert.Equal(t, "test.example.com", record.Name)
	assert.Equal(t, "1.2.3.4", record.Content)
	assert.Equal(t, false, record.Proxied)
}

func TestClient_EnsureRecord_Update(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == "GET" && strings.Contains(r.URL.Path, "dns_records"):
			// Existing record with different content
			response := `{"result":[{"id":"record123","type":"A","name":"test.example.com","content":"5.6.7.8","proxied":true,"ttl":300}],"success":true,"errors":[],"messages":[]}`
			w.WriteHeader(200)
			w.Write([]byte(response))
		case r.Method == "PUT" && strings.Contains(r.URL.Path, "dns_records"):
			// Verify request payload
			var req UpdateRecordRequest
			err := json.NewDecoder(r.Body).Decode(&req)
			require.NoError(t, err)

			assert.Equal(t, "A", req.Type)
			assert.Equal(t, "test.example.com", req.Name)
			assert.Equal(t, "1.2.3.4", req.Content)
			assert.Equal(t, false, req.Proxied) // Updated to false

			response := `{"result":{"id":"record123","type":"A","name":"test.example.com","content":"1.2.3.4","proxied":false,"ttl":300},"success":true,"errors":[]}`
			w.WriteHeader(200)
			w.Write([]byte(response))
		default:
			w.WriteHeader(404)
		}
	}))
	defer server.Close()

	client := &Client{
		apiToken: "test-token",
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}

	// Replace baseURL for testing
	originalBaseURL := baseURL
	defer func() { baseURL = originalBaseURL }()
	baseURL = server.URL

	record, err := client.EnsureRecord(context.Background(), "zone123", "A", "test.example.com", "1.2.3.4", false)

	require.NoError(t, err)
	assert.Equal(t, "record123", record.ID)
	assert.Equal(t, "1.2.3.4", record.Content)
	assert.Equal(t, false, record.Proxied)
}

func TestClient_EnsureRecord_NoChange(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" && strings.Contains(r.URL.Path, "dns_records") {
			// Existing record with same content and proxied status
			response := `{"result":[{"id":"record123","type":"A","name":"test.example.com","content":"1.2.3.4","proxied":false,"ttl":300}],"success":true,"errors":[],"messages":[]}`
			w.WriteHeader(200)
			w.Write([]byte(response))
		} else {
			t.Errorf("Unexpected request: %s %s", r.Method, r.URL.Path)
			w.WriteHeader(500)
		}
	}))
	defer server.Close()

	client := &Client{
		apiToken: "test-token",
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}

	// Replace baseURL for testing
	originalBaseURL := baseURL
	defer func() { baseURL = originalBaseURL }()
	baseURL = server.URL

	record, err := client.EnsureRecord(context.Background(), "zone123", "A", "test.example.com", "1.2.3.4", false)

	require.NoError(t, err)
	assert.Equal(t, "record123", record.ID)
	assert.Equal(t, "1.2.3.4", record.Content)
	assert.Equal(t, false, record.Proxied)
}

func TestClient_EnsureTXT(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == "GET" && strings.Contains(r.URL.Path, "dns_records"):
			// No existing records
			response := `{"result":[],"success":true,"errors":[],"messages":[]}`
			w.WriteHeader(200)
			w.Write([]byte(response))
		case r.Method == "POST" && strings.Contains(r.URL.Path, "dns_records"):
			// Verify request payload
			var req CreateRecordRequest
			err := json.NewDecoder(r.Body).Decode(&req)
			require.NoError(t, err)

			assert.Equal(t, "TXT", req.Type)
			assert.Equal(t, "_glinrdock-challenge.example.com", req.Name)
			assert.Equal(t, "verification-token-123", req.Content)
			assert.Equal(t, false, req.Proxied) // TXT records should always be false

			response := `{"result":{"id":"record456","type":"TXT","name":"_glinrdock-challenge.example.com","content":"verification-token-123","proxied":false,"ttl":300},"success":true,"errors":[]}`
			w.WriteHeader(200)
			w.Write([]byte(response))
		default:
			w.WriteHeader(404)
		}
	}))
	defer server.Close()

	client := &Client{
		apiToken: "test-token",
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}

	// Replace baseURL for testing
	originalBaseURL := baseURL
	defer func() { baseURL = originalBaseURL }()
	baseURL = server.URL

	record, err := client.EnsureTXT(context.Background(), "zone123", "_glinrdock-challenge.example.com", "verification-token-123")

	require.NoError(t, err)
	assert.Equal(t, "record456", record.ID)
	assert.Equal(t, "TXT", record.Type)
	assert.Equal(t, "_glinrdock-challenge.example.com", record.Name)
	assert.Equal(t, "verification-token-123", record.Content)
	assert.Equal(t, false, record.Proxied)
}

func TestClient_DeleteRecord(t *testing.T) {
	tests := []struct {
		name           string
		recordID       string
		mockStatusCode int
		mockResponse   string
		expectError    bool
		errorContains  string
	}{
		{
			name:           "successful deletion",
			recordID:       "record123",
			mockStatusCode: 200,
			mockResponse:   `{"success":true,"errors":[]}`,
			expectError:    false,
		},
		{
			name:           "record not found - treated as success",
			recordID:       "missing123",
			mockStatusCode: 404,
			mockResponse:   `{"success":false,"errors":[{"code":81044,"message":"Record not found"}]}`,
			expectError:    false,
		},
		{
			name:           "API error",
			recordID:       "error123",
			mockStatusCode: 400,
			mockResponse:   `{"success":false,"errors":[{"code":1003,"message":"Invalid API token"}]}`,
			expectError:    true,
			errorContains:  "Failed to delete record",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, "DELETE", r.Method)
				assert.Equal(t, "/zones/zone123/dns_records/"+tt.recordID, r.URL.Path)
				assert.Equal(t, "Bearer test-token", r.Header.Get("Authorization"))

				w.WriteHeader(tt.mockStatusCode)
				if tt.mockStatusCode != 404 {
					w.Write([]byte(tt.mockResponse))
				}
			}))
			defer server.Close()

			client := &Client{
				apiToken: "test-token",
				httpClient: &http.Client{
					Timeout: 5 * time.Second,
				},
			}

			// Replace baseURL for testing
			originalBaseURL := baseURL
			defer func() { baseURL = originalBaseURL }()
			baseURL = server.URL

			err := client.DeleteRecord(context.Background(), "zone123", tt.recordID)

			if tt.expectError {
				require.Error(t, err)
				assert.Contains(t, err.Error(), tt.errorContains)
			} else {
				require.NoError(t, err)
			}
		})
	}
}

func TestClient_RateLimitHandling(t *testing.T) {
	requestCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestCount++
		if requestCount == 1 {
			// First request returns rate limit
			w.Header().Set("Retry-After", "1")
			w.WriteHeader(429)
			return
		}
		// Second request succeeds
		response := `{"result":[{"id":"zone123","name":"example.com"}],"success":true,"errors":[],"messages":[]}`
		w.WriteHeader(200)
		w.Write([]byte(response))
	}))
	defer server.Close()

	client := &Client{
		apiToken: "test-token",
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}

	// Replace baseURL for testing
	originalBaseURL := baseURL
	defer func() { baseURL = originalBaseURL }()
	baseURL = server.URL

	start := time.Now()
	zoneID, err := client.GetZoneID(context.Background(), "example.com")
	duration := time.Since(start)

	require.NoError(t, err)
	assert.Equal(t, "zone123", zoneID)
	assert.Equal(t, 2, requestCount) // Should have made 2 requests
	assert.GreaterOrEqual(t, duration, 1*time.Second) // Should have waited at least 1 second
}

func TestClient_RateLimitTimeout(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Always return rate limit
		w.Header().Set("Retry-After", "10")
		w.WriteHeader(429)
	}))
	defer server.Close()

	client := &Client{
		apiToken: "test-token",
		httpClient: &http.Client{
			Timeout: 5 * time.Second,
		},
	}

	// Replace baseURL for testing
	originalBaseURL := baseURL
	defer func() { baseURL = originalBaseURL }()
	baseURL = server.URL

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	_, err := client.GetZoneID(ctx, "example.com")
	require.Error(t, err)
	assert.Contains(t, err.Error(), "context deadline exceeded")
}

func TestClient_ProxiedFlag(t *testing.T) {
	tests := []struct {
		name            string
		recordType      string
		proxied         bool
		expectedProxied bool
	}{
		{
			name:            "A record with proxied true",
			recordType:      "A",
			proxied:         true,
			expectedProxied: true,
		},
		{
			name:            "A record with proxied false (default for cert validation)",
			recordType:      "A",
			proxied:         false,
			expectedProxied: false,
		},
		{
			name:            "TXT record always false",
			recordType:      "TXT",
			proxied:         false,
			expectedProxied: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch {
				case r.Method == "GET" && strings.Contains(r.URL.Path, "dns_records"):
					response := `{"result":[],"success":true,"errors":[],"messages":[]}`
					w.WriteHeader(200)
					w.Write([]byte(response))
				case r.Method == "POST" && strings.Contains(r.URL.Path, "dns_records"):
					var req CreateRecordRequest
					err := json.NewDecoder(r.Body).Decode(&req)
					require.NoError(t, err)

					assert.Equal(t, tt.expectedProxied, req.Proxied)

					response := `{"result":{"id":"record123","type":"` + tt.recordType + `","name":"test.example.com","content":"test-value","proxied":` + 
								(map[bool]string{true: "true", false: "false"}[tt.expectedProxied]) + `,"ttl":300},"success":true,"errors":[]}`
					w.WriteHeader(200)
					w.Write([]byte(response))
				}
			}))
			defer server.Close()

			client := &Client{
				apiToken: "test-token",
				httpClient: &http.Client{
					Timeout: 5 * time.Second,
				},
			}

			// Replace baseURL for testing
			originalBaseURL := baseURL
			defer func() { baseURL = originalBaseURL }()
			baseURL = server.URL

			record, err := client.EnsureRecord(context.Background(), "zone123", tt.recordType, "test.example.com", "test-value", tt.proxied)

			require.NoError(t, err)
			assert.Equal(t, tt.expectedProxied, record.Proxied)
		})
	}
}