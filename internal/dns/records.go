package dns

import (
	"context"
	"fmt"
	"net"
	"sort"
	"strings"
)

// RecordType represents different DNS record types
type RecordType string

const (
	RecordTypeA     RecordType = "A"
	RecordTypeAAAA  RecordType = "AAAA"
	RecordTypeCNAME RecordType = "CNAME"
	RecordTypeTXT   RecordType = "TXT"
	RecordTypeMX    RecordType = "MX"
	RecordTypeNS    RecordType = "NS"
)

// DNSRecord represents a generic DNS record
type DNSRecord struct {
	Name     string     `json:"name"`
	Type     RecordType `json:"type"`
	Value    string     `json:"value"`
	TTL      int        `json:"ttl,omitempty"`
	Priority int        `json:"priority,omitempty"` // For MX records
}

// RecordSet represents a collection of DNS records
type RecordSet struct {
	Records []DNSRecord `json:"records"`
}

// RecordComparator handles comparison between desired and actual DNS records
type RecordComparator struct {
	inspector DNSInspector
}

// NewRecordComparator creates a new record comparator
func NewRecordComparator() *RecordComparator {
	return &RecordComparator{
		inspector: NewInspector(),
	}
}

// NewRecordComparatorWithInspector creates a record comparator with custom inspector
func NewRecordComparatorWithInspector(inspector DNSInspector) *RecordComparator {
	return &RecordComparator{
		inspector: inspector,
	}
}

// GetCurrentRecords retrieves current DNS records for a name and type
func (rc *RecordComparator) GetCurrentRecords(ctx context.Context, name string, recordType RecordType) ([]DNSRecord, error) {
	var records []DNSRecord

	switch recordType {
	case RecordTypeA:
		ips, err := rc.inspector.LookupA(ctx, name)
		if err != nil {
			return nil, err
		}
		for _, ip := range ips {
			records = append(records, DNSRecord{
				Name:  name,
				Type:  RecordTypeA,
				Value: ip.String(),
			})
		}

	case RecordTypeAAAA:
		ips, err := rc.inspector.LookupAAAA(ctx, name)
		if err != nil {
			return nil, err
		}
		for _, ip := range ips {
			records = append(records, DNSRecord{
				Name:  name,
				Type:  RecordTypeAAAA,
				Value: ip.String(),
			})
		}

	case RecordTypeCNAME:
		cname, err := rc.inspector.LookupCNAME(ctx, name)
		if err != nil {
			return nil, err
		}
		if cname != "" {
			records = append(records, DNSRecord{
				Name:  name,
				Type:  RecordTypeCNAME,
				Value: cname,
			})
		}

	case RecordTypeTXT:
		txtRecords, err := rc.inspector.LookupTXT(ctx, name)
		if err != nil {
			return nil, err
		}
		for _, txt := range txtRecords {
			records = append(records, DNSRecord{
				Name:  name,
				Type:  RecordTypeTXT,
				Value: txt,
			})
		}

	case RecordTypeMX:
		mxRecords, err := rc.inspector.LookupMX(ctx, name)
		if err != nil {
			return nil, err
		}
		for _, mx := range mxRecords {
			records = append(records, DNSRecord{
				Name:     name,
				Type:     RecordTypeMX,
				Value:    strings.TrimSuffix(mx.Host, "."),
				Priority: int(mx.Pref),
			})
		}

	case RecordTypeNS:
		nsRecords, err := rc.inspector.DetectAuthoritativeNS(ctx, name)
		if err != nil {
			return nil, err
		}
		for _, ns := range nsRecords {
			records = append(records, DNSRecord{
				Name:  name,
				Type:  RecordTypeNS,
				Value: ns,
			})
		}

	default:
		return nil, fmt.Errorf("unsupported record type: %s", recordType)
	}

	return records, nil
}

// CompareRecords compares desired records with actual records and returns differences
func (rc *RecordComparator) CompareRecords(ctx context.Context, desired []DNSRecord) (*RecordDiff, error) {
	diff := &RecordDiff{
		Missing: []DNSRecord{},
		Extra:   []DNSRecord{},
		Match:   []DNSRecord{},
	}

	// Group desired records by name and type
	desiredMap := make(map[string][]DNSRecord)
	for _, record := range desired {
		key := fmt.Sprintf("%s:%s", strings.ToLower(record.Name), record.Type)
		desiredMap[key] = append(desiredMap[key], record)
	}

	// Check each desired record group
	for key, desiredRecords := range desiredMap {
		parts := strings.Split(key, ":")
		name, recordType := parts[0], RecordType(parts[1])

		currentRecords, err := rc.GetCurrentRecords(ctx, name, recordType)
		if err != nil {
			return nil, fmt.Errorf("failed to get current records for %s %s: %w", name, recordType, err)
		}

		// Compare records
		matches, missing, extra := rc.compareRecordSets(desiredRecords, currentRecords)
		diff.Match = append(diff.Match, matches...)
		diff.Missing = append(diff.Missing, missing...)
		diff.Extra = append(diff.Extra, extra...)
	}

	return diff, nil
}

// compareRecordSets compares two sets of records of the same type
func (rc *RecordComparator) compareRecordSets(desired, current []DNSRecord) (matches, missing, extra []DNSRecord) {
	// Create maps for easier comparison
	desiredMap := make(map[string]DNSRecord)
	currentMap := make(map[string]DNSRecord)

	for _, record := range desired {
		key := rc.recordKey(record)
		desiredMap[key] = record
	}

	for _, record := range current {
		key := rc.recordKey(record)
		currentMap[key] = record
	}

	// Find matches and missing
	for key, desiredRecord := range desiredMap {
		if _, exists := currentMap[key]; exists {
			matches = append(matches, desiredRecord)
		} else {
			missing = append(missing, desiredRecord)
		}
	}

	// Find extra records
	for key, currentRecord := range currentMap {
		if _, exists := desiredMap[key]; !exists {
			extra = append(extra, currentRecord)
		}
	}

	return matches, missing, extra
}

// recordKey generates a unique key for a DNS record
func (rc *RecordComparator) recordKey(record DNSRecord) string {
	key := fmt.Sprintf("%s:%s:%s", strings.ToLower(record.Name), record.Type, record.Value)
	if record.Type == RecordTypeMX {
		key += fmt.Sprintf(":%d", record.Priority)
	}
	return key
}

// RecordDiff represents differences between desired and actual DNS records
type RecordDiff struct {
	Missing []DNSRecord `json:"missing"` // Records that should exist but don't
	Extra   []DNSRecord `json:"extra"`   // Records that exist but shouldn't
	Match   []DNSRecord `json:"match"`   // Records that match exactly
}

// HasDifferences returns true if there are any differences
func (rd *RecordDiff) HasDifferences() bool {
	return len(rd.Missing) > 0 || len(rd.Extra) > 0
}

// Summary returns a human-readable summary of the differences
func (rd *RecordDiff) Summary() string {
	var parts []string

	if len(rd.Match) > 0 {
		parts = append(parts, fmt.Sprintf("%d matching", len(rd.Match)))
	}
	if len(rd.Missing) > 0 {
		parts = append(parts, fmt.Sprintf("%d missing", len(rd.Missing)))
	}
	if len(rd.Extra) > 0 {
		parts = append(parts, fmt.Sprintf("%d extra", len(rd.Extra)))
	}

	if len(parts) == 0 {
		return "no records"
	}

	return strings.Join(parts, ", ")
}

// RecordBuilder helps build DNS records for common scenarios
type RecordBuilder struct{}

// NewRecordBuilder creates a new record builder
func NewRecordBuilder() *RecordBuilder {
	return &RecordBuilder{}
}

// BuildARecord creates an A record
func (rb *RecordBuilder) BuildARecord(name, ip string) DNSRecord {
	return DNSRecord{
		Name:  name,
		Type:  RecordTypeA,
		Value: ip,
	}
}

// BuildAAAARecord creates an AAAA record
func (rb *RecordBuilder) BuildAAAARecord(name, ip string) DNSRecord {
	return DNSRecord{
		Name:  name,
		Type:  RecordTypeAAAA,
		Value: ip,
	}
}

// BuildCNAMERecord creates a CNAME record
func (rb *RecordBuilder) BuildCNAMERecord(name, target string) DNSRecord {
	return DNSRecord{
		Name:  name,
		Type:  RecordTypeCNAME,
		Value: target,
	}
}

// BuildTXTRecord creates a TXT record
func (rb *RecordBuilder) BuildTXTRecord(name, value string) DNSRecord {
	return DNSRecord{
		Name:  name,
		Type:  RecordTypeTXT,
		Value: value,
	}
}

// BuildMXRecord creates an MX record
func (rb *RecordBuilder) BuildMXRecord(name, mailserver string, priority int) DNSRecord {
	return DNSRecord{
		Name:     name,
		Type:     RecordTypeMX,
		Value:    mailserver,
		Priority: priority,
	}
}

// BuildVerificationTXTRecord creates a TXT record for domain verification
func (rb *RecordBuilder) BuildVerificationTXTRecord(domain, token string) DNSRecord {
	// Common verification record name patterns
	verificationName := fmt.Sprintf("_glinrdock-challenge.%s", domain)
	return DNSRecord{
		Name:  verificationName,
		Type:  RecordTypeTXT,
		Value: token,
	}
}

// ValidateRecord performs basic validation on a DNS record
func (rb *RecordBuilder) ValidateRecord(record DNSRecord) error {
	if record.Name == "" {
		return fmt.Errorf("record name cannot be empty")
	}

	if record.Value == "" {
		return fmt.Errorf("record value cannot be empty")
	}

	switch record.Type {
	case RecordTypeA:
		if net.ParseIP(record.Value) == nil || net.ParseIP(record.Value).To4() == nil {
			return fmt.Errorf("invalid IPv4 address: %s", record.Value)
		}
	case RecordTypeAAAA:
		if net.ParseIP(record.Value) == nil || net.ParseIP(record.Value).To4() != nil {
			return fmt.Errorf("invalid IPv6 address: %s", record.Value)
		}
	case RecordTypeMX:
		if record.Priority < 0 || record.Priority > 65535 {
			return fmt.Errorf("invalid MX priority: %d", record.Priority)
		}
	}

	return nil
}

// SortRecords sorts a slice of DNS records by name, type, then value
func SortRecords(records []DNSRecord) {
	sort.Slice(records, func(i, j int) bool {
		if records[i].Name != records[j].Name {
			return records[i].Name < records[j].Name
		}
		if records[i].Type != records[j].Type {
			return records[i].Type < records[j].Type
		}
		if records[i].Value != records[j].Value {
			return records[i].Value < records[j].Value
		}
		return records[i].Priority < records[j].Priority
	})
}