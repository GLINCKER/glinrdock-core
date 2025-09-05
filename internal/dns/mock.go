package dns

import (
	"context"
	"fmt"
	"net"
	"strings"
	"time"
)

// MockResolver provides an in-memory DNS resolver for testing
type MockResolver struct {
	records map[string][]string
	nsMap   map[string][]string
	mx      map[string][]*net.MX
	cname   map[string]string
}

// NewMockResolver creates a new mock DNS resolver
func NewMockResolver() *MockResolver {
	return &MockResolver{
		records: make(map[string][]string),
		nsMap:   make(map[string][]string),
		mx:      make(map[string][]*net.MX),
		cname:   make(map[string]string),
	}
}

// AddARecord adds an A record to the mock resolver
func (mr *MockResolver) AddARecord(name, ip string) {
	key := fmt.Sprintf("A:%s", strings.ToLower(name))
	mr.records[key] = append(mr.records[key], ip)
}

// AddAAAARecord adds an AAAA record to the mock resolver
func (mr *MockResolver) AddAAAARecord(name, ip string) {
	key := fmt.Sprintf("AAAA:%s", strings.ToLower(name))
	mr.records[key] = append(mr.records[key], ip)
}

// AddTXTRecord adds a TXT record to the mock resolver
func (mr *MockResolver) AddTXTRecord(name, value string) {
	key := fmt.Sprintf("TXT:%s", strings.ToLower(name))
	mr.records[key] = append(mr.records[key], value)
}

// AddNSRecord adds an NS record to the mock resolver
func (mr *MockResolver) AddNSRecord(zone string, nameservers ...string) {
	key := strings.ToLower(zone)
	mr.nsMap[key] = append(mr.nsMap[key], nameservers...)
}

// AddCNAMERecord adds a CNAME record to the mock resolver
func (mr *MockResolver) AddCNAMERecord(name, target string) {
	mr.cname[strings.ToLower(name)] = target
}

// AddMXRecord adds an MX record to the mock resolver
func (mr *MockResolver) AddMXRecord(name, host string, priority uint16) {
	key := strings.ToLower(name)
	mr.mx[key] = append(mr.mx[key], &net.MX{
		Host: host,
		Pref: priority,
	})
}

// MockInspector wraps the mock resolver to provide Inspector interface
type MockInspector struct {
	resolver *MockResolver
	timeout  time.Duration
}

// NewMockInspector creates a new mock inspector with the given resolver
func NewMockInspector(resolver *MockResolver) *MockInspector {
	return &MockInspector{
		resolver: resolver,
		timeout:  5 * time.Second,
	}
}

// DetectAuthoritativeNS implements Inspector interface
func (mi *MockInspector) DetectAuthoritativeNS(ctx context.Context, domain string) ([]string, error) {
	domain = strings.ToLower(strings.TrimSuffix(domain, "."))
	
	// Look for exact match only - don't walk up the hierarchy
	// The zone detector will do the hierarchy walking
	if ns, exists := mi.resolver.nsMap[domain]; exists {
		return ns, nil
	}
	
	return nil, &net.DNSError{
		Err:        "no such host",
		Name:       domain,
		Server:     "mock",
		IsNotFound: true,
	}
}

// LookupTXT implements Inspector interface
func (mi *MockInspector) LookupTXT(ctx context.Context, fqdn string) ([]string, error) {
	key := fmt.Sprintf("TXT:%s", strings.ToLower(fqdn))
	if records, exists := mi.resolver.records[key]; exists {
		return records, nil
	}
	
	return []string{}, nil // Return empty slice for not found
}

// LookupA implements Inspector interface
func (mi *MockInspector) LookupA(ctx context.Context, name string) ([]net.IP, error) {
	key := fmt.Sprintf("A:%s", strings.ToLower(name))
	if records, exists := mi.resolver.records[key]; exists {
		var ips []net.IP
		for _, record := range records {
			ip := net.ParseIP(record)
			if ip != nil && ip.To4() != nil {
				ips = append(ips, ip)
			}
		}
		return ips, nil
	}
	
	return []net.IP{}, nil // Return empty slice for not found
}

// LookupAAAA implements Inspector interface
func (mi *MockInspector) LookupAAAA(ctx context.Context, name string) ([]net.IP, error) {
	key := fmt.Sprintf("AAAA:%s", strings.ToLower(name))
	if records, exists := mi.resolver.records[key]; exists {
		var ips []net.IP
		for _, record := range records {
			ip := net.ParseIP(record)
			if ip != nil && ip.To4() == nil {
				ips = append(ips, ip)
			}
		}
		return ips, nil
	}
	
	return []net.IP{}, nil // Return empty slice for not found
}

// LookupCNAME implements Inspector interface
func (mi *MockInspector) LookupCNAME(ctx context.Context, name string) (string, error) {
	if cname, exists := mi.resolver.cname[strings.ToLower(name)]; exists {
		return cname, nil
	}
	
	return "", nil // Return empty string for not found
}

// LookupMX implements Inspector interface
func (mi *MockInspector) LookupMX(ctx context.Context, name string) ([]*net.MX, error) {
	if mx, exists := mi.resolver.mx[strings.ToLower(name)]; exists {
		return mx, nil
	}
	
	return []*net.MX{}, nil // Return empty slice for not found
}

// ValidateDomain implements Inspector interface
func (mi *MockInspector) ValidateDomain(ctx context.Context, domain string) error {
	if domain == "" {
		return fmt.Errorf("domain cannot be empty")
	}
	
	// Try to find NS records to validate domain exists
	_, err := mi.DetectAuthoritativeNS(ctx, domain)
	if err != nil {
		return fmt.Errorf("domain validation failed: %w", err)
	}
	
	return nil
}