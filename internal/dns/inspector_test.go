package dns

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMockInspector_DetectAuthoritativeNS(t *testing.T) {
	tests := []struct {
		name        string
		setupMock   func(*MockResolver)
		domain      string
		expected    []string
		expectError bool
	}{
		{
			name: "exact domain match",
			setupMock: func(mr *MockResolver) {
				mr.AddNSRecord("example.com", "ns1.cloudflare.com", "ns2.cloudflare.com")
			},
			domain:   "example.com",
			expected: []string{"ns1.cloudflare.com", "ns2.cloudflare.com"},
		},
		{
			name: "subdomain without NS records returns error",
			setupMock: func(mr *MockResolver) {
				mr.AddNSRecord("example.com", "ns1.cloudflare.com", "ns2.cloudflare.com")
			},
			domain:      "subdomain.example.com",
			expectError: true,
		},
		{
			name: "deep subdomain without NS records returns error",
			setupMock: func(mr *MockResolver) {
				mr.AddNSRecord("example.com", "ns1.cloudflare.com", "ns2.cloudflare.com")
			},
			domain:      "very.deep.subdomain.example.com",
			expectError: true,
		},
		{
			name: "non-existent domain",
			setupMock: func(mr *MockResolver) {
				// No records added
			},
			domain:      "nonexistent.com",
			expectError: true,
		},
		{
			name: "domain with trailing dot",
			setupMock: func(mr *MockResolver) {
				mr.AddNSRecord("example.com", "ns1.cloudflare.com", "ns2.cloudflare.com")
			},
			domain:   "example.com.",
			expected: []string{"ns1.cloudflare.com", "ns2.cloudflare.com"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockResolver := NewMockResolver()
			tt.setupMock(mockResolver)
			inspector := NewMockInspector(mockResolver)

			result, err := inspector.DetectAuthoritativeNS(context.Background(), tt.domain)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}

func TestMockInspector_LookupTXT(t *testing.T) {
	tests := []struct {
		name      string
		setupMock func(*MockResolver)
		fqdn      string
		expected  []string
	}{
		{
			name: "single TXT record",
			setupMock: func(mr *MockResolver) {
				mr.AddTXTRecord("_verification.example.com", "verification-token-123")
			},
			fqdn:     "_verification.example.com",
			expected: []string{"verification-token-123"},
		},
		{
			name: "multiple TXT records",
			setupMock: func(mr *MockResolver) {
				mr.AddTXTRecord("example.com", "v=spf1 include:_spf.google.com ~all")
				mr.AddTXTRecord("example.com", "verification-token-456")
			},
			fqdn:     "example.com",
			expected: []string{"v=spf1 include:_spf.google.com ~all", "verification-token-456"},
		},
		{
			name: "no TXT records",
			setupMock: func(mr *MockResolver) {
				// No records added
			},
			fqdn:     "nonexistent.example.com",
			expected: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockResolver := NewMockResolver()
			tt.setupMock(mockResolver)
			inspector := NewMockInspector(mockResolver)

			result, err := inspector.LookupTXT(context.Background(), tt.fqdn)

			require.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestMockInspector_LookupA(t *testing.T) {
	tests := []struct {
		name      string
		setupMock func(*MockResolver)
		hostname  string
		expected  []string
	}{
		{
			name: "single A record",
			setupMock: func(mr *MockResolver) {
				mr.AddARecord("example.com", "192.168.1.1")
			},
			hostname: "example.com",
			expected: []string{"192.168.1.1"},
		},
		{
			name: "multiple A records",
			setupMock: func(mr *MockResolver) {
				mr.AddARecord("example.com", "192.168.1.1")
				mr.AddARecord("example.com", "192.168.1.2")
			},
			hostname: "example.com",
			expected: []string{"192.168.1.1", "192.168.1.2"},
		},
		{
			name: "no A records",
			setupMock: func(mr *MockResolver) {
				// No records added
			},
			hostname: "nonexistent.example.com",
			expected: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockResolver := NewMockResolver()
			tt.setupMock(mockResolver)
			inspector := NewMockInspector(mockResolver)

			result, err := inspector.LookupA(context.Background(), tt.hostname)

			require.NoError(t, err)

			var resultStrings []string
			for _, ip := range result {
				resultStrings = append(resultStrings, ip.String())
			}
			assert.ElementsMatch(t, tt.expected, resultStrings)
		})
	}
}

func TestMockInspector_LookupAAAA(t *testing.T) {
	tests := []struct {
		name      string
		setupMock func(*MockResolver)
		hostname  string
		expected  []string
	}{
		{
			name: "single AAAA record",
			setupMock: func(mr *MockResolver) {
				mr.AddAAAARecord("example.com", "2001:db8::1")
			},
			hostname: "example.com",
			expected: []string{"2001:db8::1"},
		},
		{
			name: "multiple AAAA records",
			setupMock: func(mr *MockResolver) {
				mr.AddAAAARecord("example.com", "2001:db8::1")
				mr.AddAAAARecord("example.com", "2001:db8::2")
			},
			hostname: "example.com",
			expected: []string{"2001:db8::1", "2001:db8::2"},
		},
		{
			name: "no AAAA records",
			setupMock: func(mr *MockResolver) {
				// No records added
			},
			hostname: "nonexistent.example.com",
			expected: []string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockResolver := NewMockResolver()
			tt.setupMock(mockResolver)
			inspector := NewMockInspector(mockResolver)

			result, err := inspector.LookupAAAA(context.Background(), tt.hostname)

			require.NoError(t, err)

			var resultStrings []string
			for _, ip := range result {
				resultStrings = append(resultStrings, ip.String())
			}
			assert.ElementsMatch(t, tt.expected, resultStrings)
		})
	}
}

func TestMockInspector_LookupCNAME(t *testing.T) {
	tests := []struct {
		name      string
		setupMock func(*MockResolver)
		hostname  string
		expected  string
	}{
		{
			name: "CNAME exists",
			setupMock: func(mr *MockResolver) {
				mr.AddCNAMERecord("www.example.com", "example.com")
			},
			hostname: "www.example.com",
			expected: "example.com",
		},
		{
			name: "no CNAME record",
			setupMock: func(mr *MockResolver) {
				// No records added
			},
			hostname: "nonexistent.example.com",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockResolver := NewMockResolver()
			tt.setupMock(mockResolver)
			inspector := NewMockInspector(mockResolver)

			result, err := inspector.LookupCNAME(context.Background(), tt.hostname)

			require.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestMockInspector_LookupMX(t *testing.T) {
	tests := []struct {
		name      string
		setupMock func(*MockResolver)
		hostname  string
		expected  []struct {
			host string
			pref uint16
		}
	}{
		{
			name: "single MX record",
			setupMock: func(mr *MockResolver) {
				mr.AddMXRecord("example.com", "mail.example.com", 10)
			},
			hostname: "example.com",
			expected: []struct {
				host string
				pref uint16
			}{
				{"mail.example.com", 10},
			},
		},
		{
			name: "multiple MX records",
			setupMock: func(mr *MockResolver) {
				mr.AddMXRecord("example.com", "mail1.example.com", 10)
				mr.AddMXRecord("example.com", "mail2.example.com", 20)
			},
			hostname: "example.com",
			expected: []struct {
				host string
				pref uint16
			}{
				{"mail1.example.com", 10},
				{"mail2.example.com", 20},
			},
		},
		{
			name: "no MX records",
			setupMock: func(mr *MockResolver) {
				// No records added
			},
			hostname: "nonexistent.example.com",
			expected: []struct {
				host string
				pref uint16
			}{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockResolver := NewMockResolver()
			tt.setupMock(mockResolver)
			inspector := NewMockInspector(mockResolver)

			result, err := inspector.LookupMX(context.Background(), tt.hostname)

			require.NoError(t, err)
			assert.Len(t, result, len(tt.expected))

			for i, expected := range tt.expected {
				if i < len(result) {
					assert.Equal(t, expected.host, result[i].Host)
					assert.Equal(t, expected.pref, result[i].Pref)
				}
			}
		})
	}
}

func TestMockInspector_ValidateDomain(t *testing.T) {
	tests := []struct {
		name        string
		setupMock   func(*MockResolver)
		domain      string
		expectError bool
	}{
		{
			name: "valid domain with NS records",
			setupMock: func(mr *MockResolver) {
				mr.AddNSRecord("example.com", "ns1.cloudflare.com")
			},
			domain:      "example.com",
			expectError: false,
		},
		{
			name: "empty domain",
			setupMock: func(mr *MockResolver) {
				// No setup needed
			},
			domain:      "",
			expectError: true,
		},
		{
			name: "domain without NS records",
			setupMock: func(mr *MockResolver) {
				// No records added
			},
			domain:      "nonexistent.com",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockResolver := NewMockResolver()
			tt.setupMock(mockResolver)
			inspector := NewMockInspector(mockResolver)

			err := inspector.ValidateDomain(context.Background(), tt.domain)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
