package dns

import (
	"context"
	"fmt"
	"net"
	"strings"
	"time"
)

// DNSInspector defines the interface for DNS query operations
type DNSInspector interface {
	DetectAuthoritativeNS(ctx context.Context, domain string) ([]string, error)
	LookupTXT(ctx context.Context, fqdn string) ([]string, error)
	LookupA(ctx context.Context, name string) ([]net.IP, error)
	LookupAAAA(ctx context.Context, name string) ([]net.IP, error)
	LookupCNAME(ctx context.Context, name string) (string, error)
	LookupMX(ctx context.Context, name string) ([]*net.MX, error)
	ValidateDomain(ctx context.Context, domain string) error
}

// Inspector provides DNS query functionality without external dependencies
type Inspector struct {
	timeout time.Duration
	resolver *net.Resolver
}

// NewInspector creates a new DNS inspector with default settings
func NewInspector() *Inspector {
	return &Inspector{
		timeout: 10 * time.Second,
		resolver: &net.Resolver{
			PreferGo: true,
			Dial: func(ctx context.Context, network, address string) (net.Conn, error) {
				d := net.Dialer{
					Timeout: 5 * time.Second,
				}
				return d.DialContext(ctx, network, address)
			},
		},
	}
}

// NewInspectorWithTimeout creates a new DNS inspector with custom timeout
func NewInspectorWithTimeout(timeout time.Duration) *Inspector {
	inspector := NewInspector()
	inspector.timeout = timeout
	return inspector
}

// DetectAuthoritativeNS queries the authoritative name servers for a domain
func (i *Inspector) DetectAuthoritativeNS(ctx context.Context, domain string) ([]string, error) {
	// Add timeout to context
	ctx, cancel := context.WithTimeout(ctx, i.timeout)
	defer cancel()

	// Ensure domain ends with a dot for DNS queries
	if !strings.HasSuffix(domain, ".") {
		domain = domain + "."
	}

	// Query NS records
	records, err := i.resolver.LookupNS(ctx, domain)
	if err != nil {
		return nil, fmt.Errorf("failed to lookup NS records for %s: %w", domain, err)
	}

	var nameservers []string
	for _, record := range records {
		ns := strings.TrimSuffix(record.Host, ".")
		nameservers = append(nameservers, ns)
	}

	if len(nameservers) == 0 {
		return nil, fmt.Errorf("no NS records found for domain: %s", domain)
	}

	return nameservers, nil
}

// LookupTXT queries TXT records for a given FQDN
func (i *Inspector) LookupTXT(ctx context.Context, fqdn string) ([]string, error) {
	// Add timeout to context
	ctx, cancel := context.WithTimeout(ctx, i.timeout)
	defer cancel()

	records, err := i.resolver.LookupTXT(ctx, fqdn)
	if err != nil {
		// Check if it's a "no such host" error
		var dnsErr *net.DNSError
		if err, ok := err.(*net.DNSError); ok && dnsErr == nil {
			if err.IsNotFound {
				return []string{}, nil // Return empty slice instead of error for not found
			}
		}
		return nil, fmt.Errorf("failed to lookup TXT records for %s: %w", fqdn, err)
	}

	return records, nil
}

// LookupA queries A records for a given name
func (i *Inspector) LookupA(ctx context.Context, name string) ([]net.IP, error) {
	// Add timeout to context
	ctx, cancel := context.WithTimeout(ctx, i.timeout)
	defer cancel()

	ips, err := i.resolver.LookupIPAddr(ctx, name)
	if err != nil {
		var dnsErr *net.DNSError
		if err, ok := err.(*net.DNSError); ok && dnsErr == nil {
			if err.IsNotFound {
				return []net.IP{}, nil // Return empty slice instead of error for not found
			}
		}
		return nil, fmt.Errorf("failed to lookup A records for %s: %w", name, err)
	}

	var ipv4s []net.IP
	for _, ip := range ips {
		if ip.IP.To4() != nil {
			ipv4s = append(ipv4s, ip.IP)
		}
	}

	return ipv4s, nil
}

// LookupAAAA queries AAAA records for a given name
func (i *Inspector) LookupAAAA(ctx context.Context, name string) ([]net.IP, error) {
	// Add timeout to context
	ctx, cancel := context.WithTimeout(ctx, i.timeout)
	defer cancel()

	ips, err := i.resolver.LookupIPAddr(ctx, name)
	if err != nil {
		var dnsErr *net.DNSError
		if err, ok := err.(*net.DNSError); ok && dnsErr == nil {
			if err.IsNotFound {
				return []net.IP{}, nil // Return empty slice instead of error for not found
			}
		}
		return nil, fmt.Errorf("failed to lookup AAAA records for %s: %w", name, err)
	}

	var ipv6s []net.IP
	for _, ip := range ips {
		if ip.IP.To4() == nil && ip.IP.To16() != nil {
			ipv6s = append(ipv6s, ip.IP)
		}
	}

	return ipv6s, nil
}

// LookupCNAME queries CNAME record for a given name
func (i *Inspector) LookupCNAME(ctx context.Context, name string) (string, error) {
	// Add timeout to context
	ctx, cancel := context.WithTimeout(ctx, i.timeout)
	defer cancel()

	cname, err := i.resolver.LookupCNAME(ctx, name)
	if err != nil {
		var dnsErr *net.DNSError
		if err, ok := err.(*net.DNSError); ok && dnsErr == nil {
			if err.IsNotFound {
				return "", nil // Return empty string instead of error for not found
			}
		}
		return "", fmt.Errorf("failed to lookup CNAME record for %s: %w", name, err)
	}

	// Remove trailing dot
	cname = strings.TrimSuffix(cname, ".")
	
	// If CNAME is the same as the original name, no CNAME exists
	if cname == name {
		return "", nil
	}

	return cname, nil
}

// LookupMX queries MX records for a given name
func (i *Inspector) LookupMX(ctx context.Context, name string) ([]*net.MX, error) {
	// Add timeout to context
	ctx, cancel := context.WithTimeout(ctx, i.timeout)
	defer cancel()

	records, err := i.resolver.LookupMX(ctx, name)
	if err != nil {
		var dnsErr *net.DNSError
		if err, ok := err.(*net.DNSError); ok && dnsErr == nil {
			if err.IsNotFound {
				return []*net.MX{}, nil // Return empty slice instead of error for not found
			}
		}
		return nil, fmt.Errorf("failed to lookup MX records for %s: %w", name, err)
	}

	return records, nil
}

// ValidateDomain performs basic domain validation
func (i *Inspector) ValidateDomain(ctx context.Context, domain string) error {
	if domain == "" {
		return fmt.Errorf("domain cannot be empty")
	}

	// Basic domain format validation
	if strings.Contains(domain, " ") || strings.Contains(domain, "_") {
		return fmt.Errorf("invalid domain format: %s", domain)
	}

	// Try to resolve at least one record type to validate domain exists
	_, err := i.DetectAuthoritativeNS(ctx, domain)
	if err != nil {
		return fmt.Errorf("domain validation failed: %w", err)
	}

	return nil
}