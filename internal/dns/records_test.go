package dns

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRecordComparator_GetCurrentRecords(t *testing.T) {
	tests := []struct {
		name       string
		setupMock  func(*MockResolver)
		recordName string
		recordType RecordType
		expected   []DNSRecord
	}{
		{
			name: "get A records",
			setupMock: func(mr *MockResolver) {
				mr.AddARecord("example.com", "192.168.1.1")
				mr.AddARecord("example.com", "192.168.1.2")
			},
			recordName: "example.com",
			recordType: RecordTypeA,
			expected: []DNSRecord{
				{Name: "example.com", Type: RecordTypeA, Value: "192.168.1.1"},
				{Name: "example.com", Type: RecordTypeA, Value: "192.168.1.2"},
			},
		},
		{
			name: "get AAAA records",
			setupMock: func(mr *MockResolver) {
				mr.AddAAAARecord("example.com", "2001:db8::1")
			},
			recordName: "example.com",
			recordType: RecordTypeAAAA,
			expected: []DNSRecord{
				{Name: "example.com", Type: RecordTypeAAAA, Value: "2001:db8::1"},
			},
		},
		{
			name: "get TXT records",
			setupMock: func(mr *MockResolver) {
				mr.AddTXTRecord("example.com", "v=spf1 include:_spf.google.com ~all")
				mr.AddTXTRecord("example.com", "google-site-verification=abc123")
			},
			recordName: "example.com",
			recordType: RecordTypeTXT,
			expected: []DNSRecord{
				{Name: "example.com", Type: RecordTypeTXT, Value: "v=spf1 include:_spf.google.com ~all"},
				{Name: "example.com", Type: RecordTypeTXT, Value: "google-site-verification=abc123"},
			},
		},
		{
			name: "get CNAME record",
			setupMock: func(mr *MockResolver) {
				mr.AddCNAMERecord("www.example.com", "example.com")
			},
			recordName: "www.example.com",
			recordType: RecordTypeCNAME,
			expected: []DNSRecord{
				{Name: "www.example.com", Type: RecordTypeCNAME, Value: "example.com"},
			},
		},
		{
			name: "get MX records",
			setupMock: func(mr *MockResolver) {
				mr.AddMXRecord("example.com", "mail1.example.com", 10)
				mr.AddMXRecord("example.com", "mail2.example.com", 20)
			},
			recordName: "example.com",
			recordType: RecordTypeMX,
			expected: []DNSRecord{
				{Name: "example.com", Type: RecordTypeMX, Value: "mail1.example.com", Priority: 10},
				{Name: "example.com", Type: RecordTypeMX, Value: "mail2.example.com", Priority: 20},
			},
		},
		{
			name: "get NS records",
			setupMock: func(mr *MockResolver) {
				mr.AddNSRecord("example.com", "ns1.example.com", "ns2.example.com")
			},
			recordName: "example.com",
			recordType: RecordTypeNS,
			expected: []DNSRecord{
				{Name: "example.com", Type: RecordTypeNS, Value: "ns1.example.com"},
				{Name: "example.com", Type: RecordTypeNS, Value: "ns2.example.com"},
			},
		},
		{
			name: "no records found",
			setupMock: func(mr *MockResolver) {
				// No records added
			},
			recordName: "nonexistent.example.com",
			recordType: RecordTypeA,
			expected:   []DNSRecord{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockResolver := NewMockResolver()
			tt.setupMock(mockResolver)
			inspector := NewMockInspector(mockResolver)
			comparator := NewRecordComparatorWithInspector(inspector)

			result, err := comparator.GetCurrentRecords(context.Background(), tt.recordName, tt.recordType)

			require.NoError(t, err)
			assert.ElementsMatch(t, tt.expected, result)
		})
	}
}

func TestRecordComparator_CompareRecords(t *testing.T) {
	tests := []struct {
		name            string
		setupMock       func(*MockResolver)
		desiredRecords  []DNSRecord
		expectedMissing []DNSRecord
		expectedExtra   []DNSRecord
		expectedMatch   []DNSRecord
	}{
		{
			name: "all records match",
			setupMock: func(mr *MockResolver) {
				mr.AddARecord("example.com", "192.168.1.1")
				mr.AddTXTRecord("example.com", "verification-token")
			},
			desiredRecords: []DNSRecord{
				{Name: "example.com", Type: RecordTypeA, Value: "192.168.1.1"},
				{Name: "example.com", Type: RecordTypeTXT, Value: "verification-token"},
			},
			expectedMissing: []DNSRecord{},
			expectedExtra:   []DNSRecord{},
			expectedMatch: []DNSRecord{
				{Name: "example.com", Type: RecordTypeA, Value: "192.168.1.1"},
				{Name: "example.com", Type: RecordTypeTXT, Value: "verification-token"},
			},
		},
		{
			name: "missing records",
			setupMock: func(mr *MockResolver) {
				// Only add one of the desired records
				mr.AddARecord("example.com", "192.168.1.1")
			},
			desiredRecords: []DNSRecord{
				{Name: "example.com", Type: RecordTypeA, Value: "192.168.1.1"},
				{Name: "example.com", Type: RecordTypeTXT, Value: "verification-token"},
			},
			expectedMissing: []DNSRecord{
				{Name: "example.com", Type: RecordTypeTXT, Value: "verification-token"},
			},
			expectedExtra: []DNSRecord{},
			expectedMatch: []DNSRecord{
				{Name: "example.com", Type: RecordTypeA, Value: "192.168.1.1"},
			},
		},
		{
			name: "extra records",
			setupMock: func(mr *MockResolver) {
				mr.AddARecord("example.com", "192.168.1.1")
				mr.AddARecord("example.com", "192.168.1.2") // Extra record
			},
			desiredRecords: []DNSRecord{
				{Name: "example.com", Type: RecordTypeA, Value: "192.168.1.1"},
			},
			expectedMissing: []DNSRecord{},
			expectedExtra: []DNSRecord{
				{Name: "example.com", Type: RecordTypeA, Value: "192.168.1.2"},
			},
			expectedMatch: []DNSRecord{
				{Name: "example.com", Type: RecordTypeA, Value: "192.168.1.1"},
			},
		},
		{
			name: "MX record comparison with priorities",
			setupMock: func(mr *MockResolver) {
				mr.AddMXRecord("example.com", "mail1.example.com", 10)
				mr.AddMXRecord("example.com", "mail2.example.com", 30) // Different priority
			},
			desiredRecords: []DNSRecord{
				{Name: "example.com", Type: RecordTypeMX, Value: "mail1.example.com", Priority: 10},
				{Name: "example.com", Type: RecordTypeMX, Value: "mail2.example.com", Priority: 20}, // Desired priority
			},
			expectedMissing: []DNSRecord{
				{Name: "example.com", Type: RecordTypeMX, Value: "mail2.example.com", Priority: 20},
			},
			expectedExtra: []DNSRecord{
				{Name: "example.com", Type: RecordTypeMX, Value: "mail2.example.com", Priority: 30},
			},
			expectedMatch: []DNSRecord{
				{Name: "example.com", Type: RecordTypeMX, Value: "mail1.example.com", Priority: 10},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mockResolver := NewMockResolver()
			tt.setupMock(mockResolver)
			inspector := NewMockInspector(mockResolver)
			comparator := NewRecordComparatorWithInspector(inspector)

			result, err := comparator.CompareRecords(context.Background(), tt.desiredRecords)

			require.NoError(t, err)
			assert.ElementsMatch(t, tt.expectedMissing, result.Missing)
			assert.ElementsMatch(t, tt.expectedExtra, result.Extra)
			assert.ElementsMatch(t, tt.expectedMatch, result.Match)
		})
	}
}

func TestRecordDiff_HasDifferences(t *testing.T) {
	tests := []struct {
		name     string
		diff     RecordDiff
		expected bool
	}{
		{
			name:     "no differences",
			diff:     RecordDiff{},
			expected: false,
		},
		{
			name: "has missing records",
			diff: RecordDiff{
				Missing: []DNSRecord{{Name: "example.com", Type: RecordTypeA, Value: "192.168.1.1"}},
			},
			expected: true,
		},
		{
			name: "has extra records",
			diff: RecordDiff{
				Extra: []DNSRecord{{Name: "example.com", Type: RecordTypeA, Value: "192.168.1.1"}},
			},
			expected: true,
		},
		{
			name: "only matching records",
			diff: RecordDiff{
				Match: []DNSRecord{{Name: "example.com", Type: RecordTypeA, Value: "192.168.1.1"}},
			},
			expected: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.diff.HasDifferences()
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestRecordDiff_Summary(t *testing.T) {
	tests := []struct {
		name     string
		diff     RecordDiff
		expected string
	}{
		{
			name:     "empty diff",
			diff:     RecordDiff{},
			expected: "no records",
		},
		{
			name: "only matches",
			diff: RecordDiff{
				Match: []DNSRecord{{}, {}}, // 2 records
			},
			expected: "2 matching",
		},
		{
			name: "missing and extra",
			diff: RecordDiff{
				Missing: []DNSRecord{{}},     // 1 record
				Extra:   []DNSRecord{{}, {}}, // 2 records
			},
			expected: "1 missing, 2 extra",
		},
		{
			name: "all types",
			diff: RecordDiff{
				Match:   []DNSRecord{{}},         // 1 record
				Missing: []DNSRecord{{}, {}},     // 2 records
				Extra:   []DNSRecord{{}, {}, {}}, // 3 records
			},
			expected: "1 matching, 2 missing, 3 extra",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.diff.Summary()
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestRecordBuilder_BuildRecords(t *testing.T) {
	builder := NewRecordBuilder()

	tests := []struct {
		name     string
		buildFn  func() DNSRecord
		expected DNSRecord
	}{
		{
			name: "build A record",
			buildFn: func() DNSRecord {
				return builder.BuildARecord("example.com", "192.168.1.1")
			},
			expected: DNSRecord{
				Name:  "example.com",
				Type:  RecordTypeA,
				Value: "192.168.1.1",
			},
		},
		{
			name: "build AAAA record",
			buildFn: func() DNSRecord {
				return builder.BuildAAAARecord("example.com", "2001:db8::1")
			},
			expected: DNSRecord{
				Name:  "example.com",
				Type:  RecordTypeAAAA,
				Value: "2001:db8::1",
			},
		},
		{
			name: "build CNAME record",
			buildFn: func() DNSRecord {
				return builder.BuildCNAMERecord("www.example.com", "example.com")
			},
			expected: DNSRecord{
				Name:  "www.example.com",
				Type:  RecordTypeCNAME,
				Value: "example.com",
			},
		},
		{
			name: "build TXT record",
			buildFn: func() DNSRecord {
				return builder.BuildTXTRecord("example.com", "verification-token")
			},
			expected: DNSRecord{
				Name:  "example.com",
				Type:  RecordTypeTXT,
				Value: "verification-token",
			},
		},
		{
			name: "build MX record",
			buildFn: func() DNSRecord {
				return builder.BuildMXRecord("example.com", "mail.example.com", 10)
			},
			expected: DNSRecord{
				Name:     "example.com",
				Type:     RecordTypeMX,
				Value:    "mail.example.com",
				Priority: 10,
			},
		},
		{
			name: "build verification TXT record",
			buildFn: func() DNSRecord {
				return builder.BuildVerificationTXTRecord("example.com", "verification-token-123")
			},
			expected: DNSRecord{
				Name:  "_glinrdock-challenge.example.com",
				Type:  RecordTypeTXT,
				Value: "verification-token-123",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.buildFn()
			assert.Equal(t, tt.expected, result)
		})
	}
}

func TestRecordBuilder_ValidateRecord(t *testing.T) {
	builder := NewRecordBuilder()

	tests := []struct {
		name        string
		record      DNSRecord
		expectError bool
	}{
		{
			name: "valid A record",
			record: DNSRecord{
				Name:  "example.com",
				Type:  RecordTypeA,
				Value: "192.168.1.1",
			},
			expectError: false,
		},
		{
			name: "invalid A record - not IPv4",
			record: DNSRecord{
				Name:  "example.com",
				Type:  RecordTypeA,
				Value: "2001:db8::1",
			},
			expectError: true,
		},
		{
			name: "valid AAAA record",
			record: DNSRecord{
				Name:  "example.com",
				Type:  RecordTypeAAAA,
				Value: "2001:db8::1",
			},
			expectError: false,
		},
		{
			name: "invalid AAAA record - IPv4 address",
			record: DNSRecord{
				Name:  "example.com",
				Type:  RecordTypeAAAA,
				Value: "192.168.1.1",
			},
			expectError: true,
		},
		{
			name: "valid MX record",
			record: DNSRecord{
				Name:     "example.com",
				Type:     RecordTypeMX,
				Value:    "mail.example.com",
				Priority: 10,
			},
			expectError: false,
		},
		{
			name: "invalid MX record - negative priority",
			record: DNSRecord{
				Name:     "example.com",
				Type:     RecordTypeMX,
				Value:    "mail.example.com",
				Priority: -1,
			},
			expectError: true,
		},
		{
			name: "invalid record - empty name",
			record: DNSRecord{
				Name:  "",
				Type:  RecordTypeA,
				Value: "192.168.1.1",
			},
			expectError: true,
		},
		{
			name: "invalid record - empty value",
			record: DNSRecord{
				Name:  "example.com",
				Type:  RecordTypeA,
				Value: "",
			},
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := builder.ValidateRecord(tt.record)

			if tt.expectError {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}

func TestSortRecords(t *testing.T) {
	records := []DNSRecord{
		{Name: "z.example.com", Type: RecordTypeA, Value: "192.168.1.1"},
		{Name: "a.example.com", Type: RecordTypeAAAA, Value: "2001:db8::1"},
		{Name: "a.example.com", Type: RecordTypeA, Value: "192.168.1.2"},
		{Name: "a.example.com", Type: RecordTypeA, Value: "192.168.1.1"},
		{Name: "example.com", Type: RecordTypeMX, Value: "mail1.example.com", Priority: 20},
		{Name: "example.com", Type: RecordTypeMX, Value: "mail1.example.com", Priority: 10},
	}

	SortRecords(records)

	expected := []DNSRecord{
		{Name: "a.example.com", Type: RecordTypeA, Value: "192.168.1.1"},
		{Name: "a.example.com", Type: RecordTypeA, Value: "192.168.1.2"},
		{Name: "a.example.com", Type: RecordTypeAAAA, Value: "2001:db8::1"},
		{Name: "example.com", Type: RecordTypeMX, Value: "mail1.example.com", Priority: 10},
		{Name: "example.com", Type: RecordTypeMX, Value: "mail1.example.com", Priority: 20},
		{Name: "z.example.com", Type: RecordTypeA, Value: "192.168.1.1"},
	}

	assert.Equal(t, expected, records)
}
