package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"testing"
)

// StubTransport implements http.RoundTripper for testing
type StubTransport struct {
	responses map[string]*http.Response
	requests  []*http.Request
}

func NewStubTransport() *StubTransport {
	return &StubTransport{
		responses: make(map[string]*http.Response),
		requests:  make([]*http.Request, 0),
	}
}

func (s *StubTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// Store request for inspection
	s.requests = append(s.requests, req)
	
	// Create key from method and URL
	key := req.Method + " " + req.URL.String()
	
	if resp, exists := s.responses[key]; exists {
		return resp, nil
	}
	
	// Default 404 response
	return &http.Response{
		StatusCode: 404,
		Body:       io.NopCloser(bytes.NewBufferString(`{"success":false,"errors":[{"code":404,"message":"Not found"}]}`)),
		Header:     make(http.Header),
	}, nil
}

func (s *StubTransport) AddResponse(method, url string, statusCode int, body interface{}) {
	key := method + " " + url
	
	var bodyBytes []byte
	if body != nil {
		var err error
		bodyBytes, err = json.Marshal(body)
		if err != nil {
			panic(err)
		}
	}
	
	s.responses[key] = &http.Response{
		StatusCode: statusCode,
		Body:       io.NopCloser(bytes.NewBuffer(bodyBytes)),
		Header:     make(http.Header),
	}
}

func (s *StubTransport) GetRequests() []*http.Request {
	return s.requests
}

func (s *StubTransport) ClearRequests() {
	s.requests = make([]*http.Request, 0)
}

func TestCloudflareProvider_DiscoverZone(t *testing.T) {
	transport := NewStubTransport()
	client := &http.Client{Transport: transport}
	
	config := CloudflareConfig{
		APIToken:       "test-token",
		ProxiedDefault: true,
	}
	provider := NewCloudflareProvider(config, client)
	
	// Mock zones response for sub.example.com (will return empty)
	transport.AddResponse("GET", "https://api.cloudflare.com/client/v4/zones?name=sub.example.com", 200, CloudflareResponse{
		Success: true,
		Result:  []CloudflareZone{},
	})
	
	// Mock zones response for example.com (will return the zone)
	zones := []CloudflareZone{
		{ID: "zone123", Name: "example.com", Status: "active"},
	}
	transport.AddResponse("GET", "https://api.cloudflare.com/client/v4/zones?name=example.com", 200, CloudflareResponse{
		Success: true,
		Result:  zones,
	})
	
	ctx := context.Background()
	zone, err := provider.discoverZone(ctx, "sub.example.com")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	
	if zone.ID != "zone123" {
		t.Errorf("Expected zone ID 'zone123', got '%s'", zone.ID)
	}
	
	if zone.Name != "example.com" {
		t.Errorf("Expected zone name 'example.com', got '%s'", zone.Name)
	}
}

func TestCloudflareProvider_EnsureA_Create(t *testing.T) {
	transport := NewStubTransport()
	client := &http.Client{Transport: transport}
	
	config := CloudflareConfig{
		APIToken:       "test-token",
		ProxiedDefault: false,
	}
	provider := NewCloudflareProvider(config, client)
	
	// Mock zones response for test.example.com (will return empty)
	transport.AddResponse("GET", "https://api.cloudflare.com/client/v4/zones?name=test.example.com", 200, CloudflareResponse{
		Success: true,
		Result:  []CloudflareZone{},
	})
	
	// Mock zones response for example.com (will return the zone)
	zones := []CloudflareZone{
		{ID: "zone123", Name: "example.com", Status: "active"},
	}
	transport.AddResponse("GET", "https://api.cloudflare.com/client/v4/zones?name=example.com", 200, CloudflareResponse{
		Success: true,
		Result:  zones,
	})
	
	// Mock empty records response (no existing A record)
	transport.AddResponse("GET", "https://api.cloudflare.com/client/v4/zones/zone123/dns_records?type=A&name=test.example.com", 200, CloudflareResponse{
		Success: true,
		Result:  []CloudflareRecord{},
	})
	
	// Mock create record response
	transport.AddResponse("POST", "https://api.cloudflare.com/client/v4/zones/zone123/dns_records", 200, CloudflareResponse{
		Success: true,
		Result: CloudflareRecord{
			ID:      "record123",
			ZoneID:  "zone123",
			Name:    "test.example.com",
			Type:    "A",
			Content: "1.2.3.4",
		},
	})
	
	ctx := context.Background()
	err := provider.EnsureA(ctx, "test.example.com", "1.2.3.4", true)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	
	// Verify the create request was made
	requests := transport.GetRequests()
	createRequest := requests[len(requests)-1] // Last request should be the create
	
	if createRequest.Method != "POST" {
		t.Errorf("Expected POST request, got %s", createRequest.Method)
	}
	
	// Read and verify request body
	body, err := io.ReadAll(createRequest.Body)
	if err != nil {
		t.Fatalf("Failed to read request body: %v", err)
	}
	
	var record CloudflareRecord
	if err := json.Unmarshal(body, &record); err != nil {
		t.Fatalf("Failed to unmarshal request body: %v", err)
	}
	
	if record.Name != "test.example.com" {
		t.Errorf("Expected name 'test.example.com', got '%s'", record.Name)
	}
	
	if record.Content != "1.2.3.4" {
		t.Errorf("Expected content '1.2.3.4', got '%s'", record.Content)
	}
	
	if record.Proxied == nil || *record.Proxied != true {
		t.Errorf("Expected proxied=true, got %v", record.Proxied)
	}
}

func TestCloudflareProvider_EnsureA_Update(t *testing.T) {
	transport := NewStubTransport()
	client := &http.Client{Transport: transport}
	
	config := CloudflareConfig{
		APIToken:       "test-token",
		ProxiedDefault: false,
	}
	provider := NewCloudflareProvider(config, client)
	
	// Mock zones response for test.example.com (will return empty)
	transport.AddResponse("GET", "https://api.cloudflare.com/client/v4/zones?name=test.example.com", 200, CloudflareResponse{
		Success: true,
		Result:  []CloudflareZone{},
	})
	
	// Mock zones response for example.com (will return the zone)
	zones := []CloudflareZone{
		{ID: "zone123", Name: "example.com", Status: "active"},
	}
	transport.AddResponse("GET", "https://api.cloudflare.com/client/v4/zones?name=example.com", 200, CloudflareResponse{
		Success: true,
		Result:  zones,
	})
	
	// Mock existing record response
	existingRecords := []CloudflareRecord{
		{
			ID:      "record123",
			ZoneID:  "zone123",
			Name:    "test.example.com",
			Type:    "A",
			Content: "1.1.1.1", // Different IP
		},
	}
	transport.AddResponse("GET", "https://api.cloudflare.com/client/v4/zones/zone123/dns_records?type=A&name=test.example.com", 200, CloudflareResponse{
		Success: true,
		Result:  existingRecords,
	})
	
	// Mock update record response
	transport.AddResponse("PUT", "https://api.cloudflare.com/client/v4/zones/zone123/dns_records/record123", 200, CloudflareResponse{
		Success: true,
		Result: CloudflareRecord{
			ID:      "record123",
			ZoneID:  "zone123",
			Name:    "test.example.com",
			Type:    "A",
			Content: "1.2.3.4",
		},
	})
	
	ctx := context.Background()
	err := provider.EnsureA(ctx, "test.example.com", "1.2.3.4", false)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	
	// Verify the update request was made
	requests := transport.GetRequests()
	updateRequest := requests[len(requests)-1] // Last request should be the update
	
	if updateRequest.Method != "PUT" {
		t.Errorf("Expected PUT request, got %s", updateRequest.Method)
	}
}

func TestCloudflareProvider_EnsureTXT(t *testing.T) {
	transport := NewStubTransport()
	client := &http.Client{Transport: transport}
	
	config := CloudflareConfig{
		APIToken:       "test-token",
		ProxiedDefault: false,
	}
	provider := NewCloudflareProvider(config, client)
	
	// Mock zones response for _acme-challenge.example.com (will return empty)
	transport.AddResponse("GET", "https://api.cloudflare.com/client/v4/zones?name=_acme-challenge.example.com", 200, CloudflareResponse{
		Success: true,
		Result:  []CloudflareZone{},
	})
	
	// Mock zones response for example.com (will return the zone)
	zones := []CloudflareZone{
		{ID: "zone123", Name: "example.com", Status: "active"},
	}
	transport.AddResponse("GET", "https://api.cloudflare.com/client/v4/zones?name=example.com", 200, CloudflareResponse{
		Success: true,
		Result:  zones,
	})
	
	// Mock empty records response
	transport.AddResponse("GET", "https://api.cloudflare.com/client/v4/zones/zone123/dns_records?type=TXT&name=_acme-challenge.example.com", 200, CloudflareResponse{
		Success: true,
		Result:  []CloudflareRecord{},
	})
	
	// Mock create record response
	transport.AddResponse("POST", "https://api.cloudflare.com/client/v4/zones/zone123/dns_records", 200, CloudflareResponse{
		Success: true,
		Result: CloudflareRecord{
			ID:      "txtrecord123",
			ZoneID:  "zone123",
			Name:    "_acme-challenge.example.com",
			Type:    "TXT",
			Content: "challenge-value",
			TTL:     120,
		},
	})
	
	ctx := context.Background()
	err := provider.EnsureTXT(ctx, "_acme-challenge.example.com", "challenge-value", 120)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	
	// Verify the create request was made
	requests := transport.GetRequests()
	createRequest := requests[len(requests)-1] // Last request should be the create
	
	if createRequest.Method != "POST" {
		t.Errorf("Expected POST request, got %s", createRequest.Method)
	}
}

func TestCloudflareProvider_DeleteTXT(t *testing.T) {
	transport := NewStubTransport()
	client := &http.Client{Transport: transport}
	
	config := CloudflareConfig{
		APIToken:       "test-token",
		ProxiedDefault: false,
	}
	provider := NewCloudflareProvider(config, client)
	
	// Mock zones response for _acme-challenge.example.com (will return empty)
	transport.AddResponse("GET", "https://api.cloudflare.com/client/v4/zones?name=_acme-challenge.example.com", 200, CloudflareResponse{
		Success: true,
		Result:  []CloudflareZone{},
	})
	
	// Mock zones response for example.com (will return the zone)
	zones := []CloudflareZone{
		{ID: "zone123", Name: "example.com", Status: "active"},
	}
	transport.AddResponse("GET", "https://api.cloudflare.com/client/v4/zones?name=example.com", 200, CloudflareResponse{
		Success: true,
		Result:  zones,
	})
	
	// Mock existing TXT records response
	existingRecords := []CloudflareRecord{
		{
			ID:      "txtrecord123",
			ZoneID:  "zone123",
			Name:    "_acme-challenge.example.com",
			Type:    "TXT",
			Content: "challenge-value",
		},
		{
			ID:      "txtrecord456",
			ZoneID:  "zone123",
			Name:    "_acme-challenge.example.com", 
			Type:    "TXT",
			Content: "other-value", // Different value, should not be deleted
		},
	}
	transport.AddResponse("GET", "https://api.cloudflare.com/client/v4/zones/zone123/dns_records?type=TXT&name=_acme-challenge.example.com", 200, CloudflareResponse{
		Success: true,
		Result:  existingRecords,
	})
	
	// Mock delete record response
	transport.AddResponse("DELETE", "https://api.cloudflare.com/client/v4/zones/zone123/dns_records/txtrecord123", 200, CloudflareResponse{
		Success: true,
		Result:  map[string]string{"id": "txtrecord123"},
	})
	
	ctx := context.Background()
	err := provider.DeleteTXT(ctx, "_acme-challenge.example.com", "challenge-value")
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	
	// Verify the delete request was made for the correct record
	requests := transport.GetRequests()
	deleteRequest := requests[len(requests)-1] // Last request should be the delete
	
	if deleteRequest.Method != "DELETE" {
		t.Errorf("Expected DELETE request, got %s", deleteRequest.Method)
	}
	
	expectedURL := "https://api.cloudflare.com/client/v4/zones/zone123/dns_records/txtrecord123"
	if deleteRequest.URL.String() != expectedURL {
		t.Errorf("Expected DELETE URL %s, got %s", expectedURL, deleteRequest.URL.String())
	}
}

func TestCloudflareProvider_ErrorHandling(t *testing.T) {
	transport := NewStubTransport()
	client := &http.Client{Transport: transport}
	
	config := CloudflareConfig{
		APIToken:       "invalid-token",
		ProxiedDefault: false,
	}
	provider := NewCloudflareProvider(config, client)
	
	// Mock error response
	transport.AddResponse("GET", "https://api.cloudflare.com/client/v4/zones?name=example.com", 401, CloudflareResponse{
		Success: false,
		Errors: []CloudflareError{
			{Code: 10000, Message: "Invalid API Token"},
		},
	})
	
	ctx := context.Background()
	_, err := provider.discoverZone(ctx, "example.com")
	if err == nil {
		t.Fatal("Expected error, got nil")
	}
	
	if !bytes.Contains([]byte(err.Error()), []byte("Invalid API Token")) {
		t.Errorf("Expected error to contain 'Invalid API Token', got %v", err)
	}
}