package dns

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestZoneDetector_FindZone(t *testing.T) {
	tests := []struct {
		name        string
		setupMock   func(*MockResolver)
		domain      string
		expected    string
		expectError bool
	}{
		{
			name: "domain is its own zone",
			setupMock: func(mr *MockResolver) {
				mr.AddNSRecord("example.com", "ns1.cloudflare.com", "ns2.cloudflare.com")
			},
			domain:   "example.com",
			expected: "example.com",
		},
		{
			name: "subdomain belongs to parent zone",
			setupMock: func(mr *MockResolver) {
				mr.AddNSRecord("example.com", "ns1.cloudflare.com", "ns2.cloudflare.com")
			},
			domain:   "subdomain.example.com",
			expected: "example.com",
		},
		{
			name: "deep subdomain belongs to parent zone",
			setupMock: func(mr *MockResolver) {
				mr.AddNSRecord("example.com", "ns1.cloudflare.com", "ns2.cloudflare.com")
			},
			domain:   "very.deep.subdomain.example.com",
			expected: "example.com",
		},
		{
			name: "subdomain has its own zone",
			setupMock: func(mr *MockResolver) {
				mr.AddNSRecord("example.com", "ns1.example.com", "ns2.example.com")
				mr.AddNSRecord("subdomain.example.com", "ns1.cloudflare.com", "ns2.cloudflare.com")
			},
			domain:   "subdomain.example.com",
			expected: "subdomain.example.com",
		},
		{
			name: "domain with trailing dot",
			setupMock: func(mr *MockResolver) {
				mr.AddNSRecord("example.com", "ns1.cloudflare.com", "ns2.cloudflare.com")
			},
			domain:   "example.com.",
			expected: "example.com",
		},
		{
			name: "no zone found",
			setupMock: func(mr *MockResolver) {
				// No records added
			},
			domain:      "nonexistent.com",
			expectError: true,
		},
		{
			name: "empty domain",
			setupMock: func(mr *MockResolver) {
				// No setup needed
			},
			domain:      "",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockResolver := NewMockResolver()
			tt.setupMock(mockResolver)
			inspector := NewMockInspector(mockResolver)
			detector := NewZoneDetectorWithInspector(inspector)

			result, err := detector.FindZone(context.Background(), tt.domain)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}

func TestZoneDetector_DetectProvider(t *testing.T) {
	tests := []struct {
		name        string
		setupMock   func(*MockResolver)
		zone        string
		expected    string
		expectError bool
	}{
		{
			name: "cloudflare provider",
			setupMock: func(mr *MockResolver) {
				mr.AddNSRecord("example.com", "ns1.cloudflare.com", "ns2.cloudflare.com")
			},
			zone:     "example.com",
			expected: ProviderCloudflare,
		},
		{
			name: "manual provider - generic nameservers",
			setupMock: func(mr *MockResolver) {
				mr.AddNSRecord("example.com", "ns1.example.com", "ns2.example.com")
			},
			zone:     "example.com",
			expected: ProviderManual,
		},
		{
			name: "manual provider - no known provider pattern",
			setupMock: func(mr *MockResolver) {
				mr.AddNSRecord("example.com", "dns1.registrar.com", "dns2.registrar.com")
			},
			zone:     "example.com",
			expected: ProviderManual,
		},
		{
			name: "zone without nameservers",
			setupMock: func(mr *MockResolver) {
				// No records added
			},
			zone:        "nonexistent.com",
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockResolver := NewMockResolver()
			tt.setupMock(mockResolver)
			inspector := NewMockInspector(mockResolver)
			detector := NewZoneDetectorWithInspector(inspector)

			result, err := detector.DetectProvider(context.Background(), tt.zone)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expected, result)
			}
		})
	}
}

func TestZoneDetector_GetZoneInfo(t *testing.T) {
	tests := []struct {
		name             string
		setupMock        func(*MockResolver)
		domain           string
		expectedZone     string
		expectedProvider string
		expectedNS       []string
		expectError      bool
	}{
		{
			name: "complete zone info for cloudflare domain",
			setupMock: func(mr *MockResolver) {
				mr.AddNSRecord("example.com", "ns1.cloudflare.com", "ns2.cloudflare.com")
			},
			domain:           "subdomain.example.com",
			expectedZone:     "example.com",
			expectedProvider: ProviderCloudflare,
			expectedNS:       []string{"ns1.cloudflare.com", "ns2.cloudflare.com"},
		},
		{
			name: "complete zone info for manual domain",
			setupMock: func(mr *MockResolver) {
				mr.AddNSRecord("example.org", "ns1.example.org", "ns2.example.org")
			},
			domain:           "example.org",
			expectedZone:     "example.org",
			expectedProvider: ProviderManual,
			expectedNS:       []string{"ns1.example.org", "ns2.example.org"},
		},
		{
			name: "domain without zone",
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
			detector := NewZoneDetectorWithInspector(inspector)

			result, err := detector.GetZoneInfo(context.Background(), tt.domain)

			if tt.expectError {
				assert.Error(t, err)
				assert.Nil(t, result)
			} else {
				require.NoError(t, err)
				require.NotNil(t, result)
				assert.Equal(t, tt.expectedZone, result.Zone)
				assert.Equal(t, tt.expectedProvider, result.Provider)
				assert.Equal(t, tt.expectedNS, result.NS)
			}
		})
	}
}

func TestZoneDetector_ValidateZoneOwnership(t *testing.T) {
	tests := []struct {
		name           string
		setupMock      func(*MockResolver)
		domain         string
		expectedZone   string
		expectedResult bool
		expectError    bool
	}{
		{
			name: "domain belongs to expected zone",
			setupMock: func(mr *MockResolver) {
				mr.AddNSRecord("example.com", "ns1.cloudflare.com", "ns2.cloudflare.com")
			},
			domain:         "subdomain.example.com",
			expectedZone:   "example.com",
			expectedResult: true,
		},
		{
			name: "domain does not belong to expected zone",
			setupMock: func(mr *MockResolver) {
				mr.AddNSRecord("example.com", "ns1.cloudflare.com", "ns2.cloudflare.com")
				mr.AddNSRecord("other.com", "ns1.other.com", "ns2.other.com")
			},
			domain:         "subdomain.example.com",
			expectedZone:   "other.com",
			expectedResult: false,
		},
		{
			name: "case insensitive comparison",
			setupMock: func(mr *MockResolver) {
				mr.AddNSRecord("example.com", "ns1.cloudflare.com", "ns2.cloudflare.com")
			},
			domain:         "SUBDOMAIN.EXAMPLE.COM",
			expectedZone:   "example.com",
			expectedResult: true,
		},
		{
			name: "trailing dots handled correctly",
			setupMock: func(mr *MockResolver) {
				mr.AddNSRecord("example.com", "ns1.cloudflare.com", "ns2.cloudflare.com")
			},
			domain:         "subdomain.example.com.",
			expectedZone:   "example.com.",
			expectedResult: true,
		},
		{
			name: "domain has no zone",
			setupMock: func(mr *MockResolver) {
				// No records added
			},
			domain:       "nonexistent.com",
			expectedZone: "example.com",
			expectError:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockResolver := NewMockResolver()
			tt.setupMock(mockResolver)
			inspector := NewMockInspector(mockResolver)
			detector := NewZoneDetectorWithInspector(inspector)

			result, err := detector.ValidateZoneOwnership(context.Background(), tt.domain, tt.expectedZone)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				require.NoError(t, err)
				assert.Equal(t, tt.expectedResult, result)
			}
		})
	}
}

func TestZoneDetector_detectProviderFromNS(t *testing.T) {
	tests := []struct {
		name        string
		nameservers []string
		expected    string
	}{
		{
			name:        "cloudflare nameservers",
			nameservers: []string{"ns1.cloudflare.com", "ns2.cloudflare.com"},
			expected:    ProviderCloudflare,
		},
		{
			name:        "mixed nameservers with cloudflare",
			nameservers: []string{"ns1.example.com", "ns1.cloudflare.com"},
			expected:    ProviderCloudflare,
		},
		{
			name:        "case insensitive cloudflare detection",
			nameservers: []string{"NS1.CLOUDFLARE.COM", "NS2.CLOUDFLARE.COM"},
			expected:    ProviderCloudflare,
		},
		{
			name:        "generic nameservers",
			nameservers: []string{"ns1.example.com", "ns2.example.com"},
			expected:    ProviderManual,
		},
		{
			name:        "registrar nameservers",
			nameservers: []string{"dns1.registrar.com", "dns2.registrar.com"},
			expected:    ProviderManual,
		},
		{
			name:        "empty nameservers",
			nameservers: []string{},
			expected:    ProviderManual,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			detector := NewZoneDetector()
			result := detector.detectProviderFromNS(tt.nameservers)
			assert.Equal(t, tt.expected, result)
		})
	}
}
