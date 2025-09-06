package dns

import (
	"context"
	"fmt"
	"net"
	"strings"
	"sync"
	"time"

	"github.com/miekg/dns"
)

// DefaultTTL is the default cache TTL for DNS records
const DefaultTTL = 60 * time.Second

// Resolver interface for DNS resolution - allows for easy testing and mocking
type Resolver interface {
	LookupA(ctx context.Context, name string) ([]net.IP, error)
	LookupAAAA(ctx context.Context, name string) ([]net.IP, error)
	LookupCNAME(ctx context.Context, name string) (string, error)
	LookupTXT(ctx context.Context, name string) ([]string, error)
}

// cacheEntry represents a cached DNS response with expiration time
type cacheEntry struct {
	value     interface{}
	expiresAt time.Time
}

// isExpired checks if the cache entry has expired
func (c *cacheEntry) isExpired() bool {
	return time.Now().After(c.expiresAt)
}

// MultiResolver provides DNS resolution with multiple resolvers and caching
type MultiResolver struct {
	servers []string               // DNS server addresses
	cache   map[string]*cacheEntry // In-memory cache
	cacheMu sync.RWMutex           // Cache mutex for concurrent access
	client  *dns.Client            // DNS client
	ttl     time.Duration          // Cache TTL
}

// NewMultiResolver creates a new multi-resolver DNS client
func NewMultiResolver(servers []string) *MultiResolver {
	if len(servers) == 0 {
		servers = []string{"1.1.1.1:53", "8.8.8.8:53"} // Default to Cloudflare and Google DNS
	}

	return &MultiResolver{
		servers: servers,
		cache:   make(map[string]*cacheEntry),
		client:  &dns.Client{Timeout: 5 * time.Second},
		ttl:     DefaultTTL,
	}
}

// SetTTL sets the cache TTL for DNS records
func (r *MultiResolver) SetTTL(ttl time.Duration) {
	r.ttl = ttl
}

// getCacheKey generates a cache key for DNS queries
func (r *MultiResolver) getCacheKey(qtype string, name string) string {
	return fmt.Sprintf("%s:%s", qtype, strings.ToLower(name))
}

// getFromCache retrieves a cached DNS response
func (r *MultiResolver) getFromCache(key string) (interface{}, bool) {
	r.cacheMu.RLock()
	defer r.cacheMu.RUnlock()

	entry, exists := r.cache[key]
	if !exists || entry.isExpired() {
		return nil, false
	}

	return entry.value, true
}

// setCache stores a DNS response in cache with TTL
func (r *MultiResolver) setCache(key string, value interface{}, ttl time.Duration) {
	r.cacheMu.Lock()
	defer r.cacheMu.Unlock()

	r.cache[key] = &cacheEntry{
		value:     value,
		expiresAt: time.Now().Add(ttl),
	}
}

// CleanExpiredEntries removes expired entries from cache
func (r *MultiResolver) CleanExpiredEntries() {
	r.cacheMu.Lock()
	defer r.cacheMu.Unlock()

	for key, entry := range r.cache {
		if entry.isExpired() {
			delete(r.cache, key)
		}
	}
}

// queryDNS performs a DNS query against all configured servers until one succeeds
func (r *MultiResolver) queryDNS(ctx context.Context, name string, qtype uint16) (*dns.Msg, error) {
	// Ensure name ends with dot for FQDN
	if !strings.HasSuffix(name, ".") {
		name += "."
	}

	// Create DNS message
	msg := new(dns.Msg)
	msg.SetQuestion(name, qtype)
	msg.RecursionDesired = true

	var lastErr error

	// Try each server until one succeeds
	for _, server := range r.servers {
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		resp, _, err := r.client.ExchangeContext(ctx, msg, server)
		if err != nil {
			lastErr = err
			continue
		}

		if resp.Rcode != dns.RcodeSuccess {
			lastErr = fmt.Errorf("DNS query failed with rcode: %s", dns.RcodeToString[resp.Rcode])
			continue
		}

		return resp, nil
	}

	if lastErr != nil {
		return nil, fmt.Errorf("all DNS servers failed, last error: %w", lastErr)
	}

	return nil, fmt.Errorf("no DNS servers configured")
}

// LookupA performs A record lookup with caching
func (r *MultiResolver) LookupA(ctx context.Context, name string) ([]net.IP, error) {
	cacheKey := r.getCacheKey("A", name)

	// Check cache first
	if cached, found := r.getFromCache(cacheKey); found {
		return cached.([]net.IP), nil
	}

	// Query DNS
	resp, err := r.queryDNS(ctx, name, dns.TypeA)
	if err != nil {
		return nil, err
	}

	var ips []net.IP
	cacheTTL := r.ttl

	for _, rr := range resp.Answer {
		if a, ok := rr.(*dns.A); ok {
			ips = append(ips, a.A)
			// Use the record's TTL if available, otherwise use default
			if time.Duration(a.Hdr.Ttl)*time.Second < cacheTTL {
				cacheTTL = time.Duration(a.Hdr.Ttl) * time.Second
			}
		}
	}

	// Cache the result
	r.setCache(cacheKey, ips, cacheTTL)

	return ips, nil
}

// LookupAAAA performs AAAA record lookup with caching
func (r *MultiResolver) LookupAAAA(ctx context.Context, name string) ([]net.IP, error) {
	cacheKey := r.getCacheKey("AAAA", name)

	// Check cache first
	if cached, found := r.getFromCache(cacheKey); found {
		return cached.([]net.IP), nil
	}

	// Query DNS
	resp, err := r.queryDNS(ctx, name, dns.TypeAAAA)
	if err != nil {
		return nil, err
	}

	var ips []net.IP
	cacheTTL := r.ttl

	for _, rr := range resp.Answer {
		if aaaa, ok := rr.(*dns.AAAA); ok {
			ips = append(ips, aaaa.AAAA)
			// Use the record's TTL if available, otherwise use default
			if time.Duration(aaaa.Hdr.Ttl)*time.Second < cacheTTL {
				cacheTTL = time.Duration(aaaa.Hdr.Ttl) * time.Second
			}
		}
	}

	// Cache the result
	r.setCache(cacheKey, ips, cacheTTL)

	return ips, nil
}

// LookupCNAME performs CNAME record lookup with caching
func (r *MultiResolver) LookupCNAME(ctx context.Context, name string) (string, error) {
	cacheKey := r.getCacheKey("CNAME", name)

	// Check cache first
	if cached, found := r.getFromCache(cacheKey); found {
		return cached.(string), nil
	}

	// Query DNS
	resp, err := r.queryDNS(ctx, name, dns.TypeCNAME)
	if err != nil {
		return "", err
	}

	var cname string
	cacheTTL := r.ttl

	for _, rr := range resp.Answer {
		if c, ok := rr.(*dns.CNAME); ok {
			// Remove trailing dot from CNAME target
			cname = strings.TrimSuffix(c.Target, ".")
			// Use the record's TTL if available, otherwise use default
			if time.Duration(c.Hdr.Ttl)*time.Second < cacheTTL {
				cacheTTL = time.Duration(c.Hdr.Ttl) * time.Second
			}
			break // Only return the first CNAME record
		}
	}

	if cname == "" {
		return "", fmt.Errorf("no CNAME record found for %s", name)
	}

	// Cache the result
	r.setCache(cacheKey, cname, cacheTTL)

	return cname, nil
}

// LookupTXT performs TXT record lookup with caching
func (r *MultiResolver) LookupTXT(ctx context.Context, name string) ([]string, error) {
	cacheKey := r.getCacheKey("TXT", name)

	// Check cache first
	if cached, found := r.getFromCache(cacheKey); found {
		return cached.([]string), nil
	}

	// Query DNS
	resp, err := r.queryDNS(ctx, name, dns.TypeTXT)
	if err != nil {
		return nil, err
	}

	var txtRecords []string
	cacheTTL := r.ttl

	for _, rr := range resp.Answer {
		if txt, ok := rr.(*dns.TXT); ok {
			// Join all TXT strings for this record
			txtRecords = append(txtRecords, strings.Join(txt.Txt, ""))
			// Use the record's TTL if available, otherwise use default
			if time.Duration(txt.Hdr.Ttl)*time.Second < cacheTTL {
				cacheTTL = time.Duration(txt.Hdr.Ttl) * time.Second
			}
		}
	}

	// Cache the result
	r.setCache(cacheKey, txtRecords, cacheTTL)

	return txtRecords, nil
}

// GetCacheStats returns cache statistics for monitoring
func (r *MultiResolver) GetCacheStats() map[string]interface{} {
	r.cacheMu.RLock()
	defer r.cacheMu.RUnlock()

	expired := 0
	for _, entry := range r.cache {
		if entry.isExpired() {
			expired++
		}
	}

	return map[string]interface{}{
		"total_entries":      len(r.cache),
		"expired_entries":    expired,
		"active_entries":     len(r.cache) - expired,
		"configured_servers": len(r.servers),
		"cache_ttl_seconds":  int(r.ttl.Seconds()),
	}
}
