package provider

import (
	"context"
)

// DNSProvider interface for DNS record management
type DNSProvider interface {
	// EnsureA creates or updates an A record
	EnsureA(ctx context.Context, domain string, ip string, proxied bool) error
	
	// EnsureCNAME creates or updates a CNAME record  
	EnsureCNAME(ctx context.Context, domain, target string, proxied bool) error
	
	// EnsureTXT creates or updates a TXT record
	EnsureTXT(ctx context.Context, fqdn, value string, ttl int) error
	
	// DeleteTXT deletes a TXT record by value
	DeleteTXT(ctx context.Context, fqdn, value string) error
}