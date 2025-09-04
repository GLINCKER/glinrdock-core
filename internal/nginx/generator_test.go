package nginx

import (
	"crypto/sha256"
	"fmt"
	"strings"
	"testing"

	"github.com/GLINCKER/glinrdock/internal/store"
)

func TestUpstreamName(t *testing.T) {
	tests := []struct {
		name      string
		serviceID int64
		port      int
		expected  string
	}{
		{
			name:      "basic upstream name",
			serviceID: 1,
			port:      80,
			expected:  "svc_1_80",
		},
		{
			name:      "high port upstream name",
			serviceID: 123,
			port:      8080,
			expected:  "svc_123_8080",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := UpstreamName(tt.serviceID, tt.port)
			if result != tt.expected {
				t.Errorf("UpstreamName(%d, %d) = %s, want %s", tt.serviceID, tt.port, result, tt.expected)
			}
		})
	}
}

func TestGenerator_Render(t *testing.T) {
	generator := NewGenerator("", "")

	tests := []struct {
		name    string
		input   RenderInput
		wantErr bool
		checks  []func(config string) error
	}{
		{
			name: "single HTTP route",
			input: RenderInput{
				Routes: []store.RouteWithService{
					{
						Route: store.Route{
							ID:        1,
							ServiceID: 1,
							Domain:    "example.com",
							Port:      80,
							TLS:       false,
							Path:      nil,
						},
						ServiceName: "web-service",
					},
				},
				Certs: map[string]store.Certificate{},
			},
			wantErr: false,
			checks: []func(config string) error{
				func(config string) error {
					if !strings.Contains(config, "upstream svc_1_80") {
						return fmt.Errorf("missing upstream declaration for svc_1_80")
					}
					return nil
				},
				func(config string) error {
					if !strings.Contains(config, "server web-service:80;") {
						return fmt.Errorf("missing service upstream target")
					}
					return nil
				},
				func(config string) error {
					if !strings.Contains(config, "server_name example.com;") {
						return fmt.Errorf("missing server_name directive")
					}
					return nil
				},
				func(config string) error {
					if !strings.Contains(config, "listen 80;") {
						return fmt.Errorf("missing HTTP listen directive")
					}
					return nil
				},
				func(config string) error {
					if strings.Contains(config, "listen 443 ssl") {
						return fmt.Errorf("unexpected HTTPS listen directive for HTTP route")
					}
					return nil
				},
			},
		},
		{
			name: "single HTTPS route with certificate",
			input: RenderInput{
				Routes: []store.RouteWithService{
					{
						Route: store.Route{
							ID:        1,
							ServiceID: 1,
							Domain:    "secure.example.com",
							Port:      443,
							TLS:       true,
							Path:      nil,
						},
						ServiceName: "secure-service",
					},
				},
				Certs: map[string]store.Certificate{
					"secure.example.com": {
						ID:       1,
						Domain:   "secure.example.com",
						CertData: stringPtr("cert-data"),
						KeyData:  stringPtr("key-data"),
					},
				},
			},
			wantErr: false,
			checks: []func(config string) error{
				func(config string) error {
					if !strings.Contains(config, "listen 443 ssl http2;") {
						return fmt.Errorf("missing HTTPS listen directive")
					}
					return nil
				},
				func(config string) error {
					if !strings.Contains(config, "ssl_certificate /etc/nginx/certs/secure.example.com.crt;") {
						return fmt.Errorf("missing SSL certificate path")
					}
					return nil
				},
				func(config string) error {
					if !strings.Contains(config, "ssl_certificate_key /etc/nginx/certs/secure.example.com.key;") {
						return fmt.Errorf("missing SSL certificate key path")
					}
					return nil
				},
			},
		},
		{
			name: "HTTPS route without certificate",
			input: RenderInput{
				Routes: []store.RouteWithService{
					{
						Route: store.Route{
							ID:        1,
							ServiceID: 1,
							Domain:    "missing-cert.example.com",
							Port:      443,
							TLS:       true,
							Path:      nil,
						},
						ServiceName: "service",
					},
				},
				Certs: map[string]store.Certificate{},
			},
			wantErr: false,
			checks: []func(config string) error{
				func(config string) error {
					if !strings.Contains(config, "return 503;") {
						return fmt.Errorf("missing 503 return directive for missing certificate")
					}
					return nil
				},
				func(config string) error {
					if !strings.Contains(config, "# Certificate not found for missing-cert.example.com") {
						return fmt.Errorf("missing certificate not found comment")
					}
					return nil
				},
			},
		},
		{
			name: "route with custom path",
			input: RenderInput{
				Routes: []store.RouteWithService{
					{
						Route: store.Route{
							ID:        1,
							ServiceID: 1,
							Domain:    "api.example.com",
							Port:      8080,
							TLS:       false,
							Path:      stringPtr("/api"),
						},
						ServiceName: "api-service",
					},
				},
				Certs: map[string]store.Certificate{},
			},
			wantErr: false,
			checks: []func(config string) error{
				func(config string) error {
					if !strings.Contains(config, "location /api {") {
						return fmt.Errorf("missing custom path location block")
					}
					return nil
				},
			},
		},
		{
			name: "multiple routes deterministic ordering",
			input: RenderInput{
				Routes: []store.RouteWithService{
					{
						Route: store.Route{
							ID:        2,
							ServiceID: 2,
							Domain:    "b.example.com",
							Port:      80,
							TLS:       false,
						},
						ServiceName: "service-b",
					},
					{
						Route: store.Route{
							ID:        1,
							ServiceID: 1,
							Domain:    "a.example.com",
							Port:      80,
							TLS:       false,
						},
						ServiceName: "service-a",
					},
				},
				Certs: map[string]store.Certificate{},
			},
			wantErr: false,
			checks: []func(config string) error{
				func(config string) error {
					aPos := strings.Index(config, "server_name a.example.com;")
					bPos := strings.Index(config, "server_name b.example.com;")
					if aPos == -1 || bPos == -1 {
						return fmt.Errorf("missing server names")
					}
					if aPos > bPos {
						return fmt.Errorf("routes not ordered alphabetically by domain")
					}
					return nil
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config, hash, err := generator.Render(tt.input)

			if (err != nil) != tt.wantErr {
				t.Errorf("Generator.Render() error = %v, wantErr %v", err, tt.wantErr)
				return
			}

			if err != nil {
				return // Skip further checks if there was an error
			}

			// Verify hash is correct SHA256
			expectedHash := sha256.Sum256([]byte(config))
			expectedHashStr := fmt.Sprintf("%x", expectedHash)
			if hash != expectedHashStr {
				t.Errorf("Generator.Render() hash = %v, want %v", hash, expectedHashStr)
			}

			// Run custom checks
			for i, check := range tt.checks {
				if err := check(config); err != nil {
					t.Errorf("Generator.Render() check %d failed: %v", i, err)
				}
			}

			// Verify basic nginx syntax
			if !strings.Contains(config, "upstream") {
				t.Error("Generated config missing upstream blocks")
			}
			if !strings.Contains(config, "server {") {
				t.Error("Generated config missing server blocks")
			}
		})
	}
}

func TestGenerator_Render_Deterministic(t *testing.T) {
	generator := NewGenerator("", "")

	input := RenderInput{
		Routes: []store.RouteWithService{
			{
				Route: store.Route{
					ID:        1,
					ServiceID: 1,
					Domain:    "example.com",
					Port:      80,
					TLS:       false,
				},
				ServiceName: "web-service",
			},
			{
				Route: store.Route{
					ID:        2,
					ServiceID: 2,
					Domain:    "api.example.com",
					Port:      8080,
					TLS:       false,
				},
				ServiceName: "api-service",
			},
		},
		Certs: map[string]store.Certificate{},
	}

	// Generate config multiple times
	configs := make([]string, 5)
	hashes := make([]string, 5)
	for i := 0; i < 5; i++ {
		var err error
		configs[i], hashes[i], err = generator.Render(input)
		if err != nil {
			t.Fatalf("Render() failed on iteration %d: %v", i, err)
		}
	}

	// Verify all configs are identical
	firstConfig := configs[0]
	firstHash := hashes[0]
	for i := 1; i < 5; i++ {
		if configs[i] != firstConfig {
			t.Errorf("Config not deterministic: iteration %d differs from first", i)
		}
		if hashes[i] != firstHash {
			t.Errorf("Hash not deterministic: iteration %d differs from first", i)
		}
	}
}

func TestGenerator_Render_StandardProxyHeaders(t *testing.T) {
	generator := NewGenerator("", "")

	input := RenderInput{
		Routes: []store.RouteWithService{
			{
				Route: store.Route{
					ID:        1,
					ServiceID: 1,
					Domain:    "example.com",
					Port:      80,
					TLS:       false,
				},
				ServiceName: "web-service",
			},
		},
		Certs: map[string]store.Certificate{},
	}

	config, _, err := generator.Render(input)
	if err != nil {
		t.Fatalf("Render() failed: %v", err)
	}

	expectedHeaders := []string{
		"proxy_set_header Host $host;",
		"proxy_set_header X-Real-IP $remote_addr;",
		"proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;",
		"proxy_set_header X-Forwarded-Proto $scheme;",
		"proxy_set_header X-Forwarded-Host $server_name;",
		"proxy_set_header X-Forwarded-Port $server_port;",
	}

	for _, header := range expectedHeaders {
		if !strings.Contains(config, header) {
			t.Errorf("Missing standard proxy header: %s", header)
		}
	}

	expectedProxyConfig := []string{
		"proxy_connect_timeout 30s;",
		"proxy_send_timeout 30s;",
		"proxy_read_timeout 30s;",
		"proxy_redirect off;",
	}

	for _, proxyConfig := range expectedProxyConfig {
		if !strings.Contains(config, proxyConfig) {
			t.Errorf("Missing proxy configuration: %s", proxyConfig)
		}
	}
}

// Helper function to create string pointer
func stringPtr(s string) *string {
	return &s
}