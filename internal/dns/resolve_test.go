package dns

import (
	"context"
	"net"
	"reflect"
	"testing"
	"time"
)

// FakeResolver implements the Resolver interface for testing
type FakeResolver struct {
	ARecords     map[string][]net.IP
	AAAARecords  map[string][]net.IP
	CNAMERecords map[string]string
	TXTRecords   map[string][]string
	Errors       map[string]error // Map of domain -> error for specific domains
	CallCounts   map[string]int   // Track method calls
}

// NewFakeResolver creates a new fake resolver for testing
func NewFakeResolver() *FakeResolver {
	return &FakeResolver{
		ARecords:     make(map[string][]net.IP),
		AAAARecords:  make(map[string][]net.IP),
		CNAMERecords: make(map[string]string),
		TXTRecords:   make(map[string][]string),
		Errors:       make(map[string]error),
		CallCounts:   make(map[string]int),
	}
}

func (f *FakeResolver) LookupA(ctx context.Context, name string) ([]net.IP, error) {
	f.CallCounts["LookupA"]++
	
	if err, exists := f.Errors[name]; exists {
		return nil, err
	}
	
	if ips, exists := f.ARecords[name]; exists {
		return ips, nil
	}
	
	return []net.IP{}, nil
}

func (f *FakeResolver) LookupAAAA(ctx context.Context, name string) ([]net.IP, error) {
	f.CallCounts["LookupAAAA"]++
	
	if err, exists := f.Errors[name]; exists {
		return nil, err
	}
	
	if ips, exists := f.AAAARecords[name]; exists {
		return ips, nil
	}
	
	return []net.IP{}, nil
}

func (f *FakeResolver) LookupCNAME(ctx context.Context, name string) (string, error) {
	f.CallCounts["LookupCNAME"]++
	
	if err, exists := f.Errors[name]; exists {
		return "", err
	}
	
	if cname, exists := f.CNAMERecords[name]; exists {
		return cname, nil
	}
	
	return "", nil
}

func (f *FakeResolver) LookupTXT(ctx context.Context, name string) ([]string, error) {
	f.CallCounts["LookupTXT"]++
	
	if err, exists := f.Errors[name]; exists {
		return nil, err
	}
	
	if txt, exists := f.TXTRecords[name]; exists {
		return txt, nil
	}
	
	return []string{}, nil
}

func TestNewMultiResolver(t *testing.T) {
	tests := []struct {
		name     string
		servers  []string
		expected []string
	}{
		{
			name:     "with custom servers",
			servers:  []string{"1.2.3.4:53", "5.6.7.8:53"},
			expected: []string{"1.2.3.4:53", "5.6.7.8:53"},
		},
		{
			name:     "with empty servers uses defaults",
			servers:  []string{},
			expected: []string{"1.1.1.1:53", "8.8.8.8:53"},
		},
		{
			name:     "with nil servers uses defaults",
			servers:  nil,
			expected: []string{"1.1.1.1:53", "8.8.8.8:53"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resolver := NewMultiResolver(tt.servers)
			
			if !reflect.DeepEqual(resolver.servers, tt.expected) {
				t.Errorf("expected servers %v, got %v", tt.expected, resolver.servers)
			}
			
			if resolver.ttl != DefaultTTL {
				t.Errorf("expected TTL %v, got %v", DefaultTTL, resolver.ttl)
			}
			
			if resolver.cache == nil {
				t.Error("expected cache to be initialized")
			}
		})
	}
}

func TestMultiResolver_SetTTL(t *testing.T) {
	resolver := NewMultiResolver([]string{"1.1.1.1:53"})
	newTTL := 30 * time.Second
	
	resolver.SetTTL(newTTL)
	
	if resolver.ttl != newTTL {
		t.Errorf("expected TTL %v, got %v", newTTL, resolver.ttl)
	}
}

func TestCacheEntry(t *testing.T) {
	t.Run("not expired", func(t *testing.T) {
		entry := &cacheEntry{
			value:     "test",
			expiresAt: time.Now().Add(5 * time.Minute),
		}
		
		if entry.isExpired() {
			t.Error("expected entry not to be expired")
		}
	})
	
	t.Run("expired", func(t *testing.T) {
		entry := &cacheEntry{
			value:     "test",
			expiresAt: time.Now().Add(-5 * time.Minute),
		}
		
		if !entry.isExpired() {
			t.Error("expected entry to be expired")
		}
	})
}

func TestMultiResolver_getCacheKey(t *testing.T) {
	resolver := NewMultiResolver([]string{"1.1.1.1:53"})
	
	tests := []struct {
		qtype    string
		name     string
		expected string
	}{
		{"A", "example.com", "A:example.com"},
		{"AAAA", "Example.Com", "AAAA:example.com"}, // Test case normalization
		{"TXT", "TEST.EXAMPLE.COM", "TXT:test.example.com"},
	}
	
	for _, tt := range tests {
		t.Run(tt.expected, func(t *testing.T) {
			result := resolver.getCacheKey(tt.qtype, tt.name)
			if result != tt.expected {
				t.Errorf("expected cache key %s, got %s", tt.expected, result)
			}
		})
	}
}

func TestMultiResolver_Cache(t *testing.T) {
	resolver := NewMultiResolver([]string{"1.1.1.1:53"})
	
	key := "test:example.com"
	value := []net.IP{net.ParseIP("1.2.3.4")}
	ttl := 10 * time.Second
	
	// Test cache miss
	if cached, found := resolver.getFromCache(key); found {
		t.Errorf("expected cache miss, got value: %v", cached)
	}
	
	// Test cache set and hit
	resolver.setCache(key, value, ttl)
	if cached, found := resolver.getFromCache(key); !found {
		t.Error("expected cache hit")
	} else if !reflect.DeepEqual(cached, value) {
		t.Errorf("expected cached value %v, got %v", value, cached)
	}
	
	// Test cache expiration
	resolver.setCache(key, value, -1*time.Second) // Already expired
	if cached, found := resolver.getFromCache(key); found {
		t.Errorf("expected cache miss for expired entry, got value: %v", cached)
	}
}

func TestMultiResolver_CleanExpiredEntries(t *testing.T) {
	resolver := NewMultiResolver([]string{"1.1.1.1:53"})
	
	// Add some entries
	resolver.setCache("valid:example.com", "valid", 10*time.Second)
	resolver.setCache("expired:example.com", "expired", -1*time.Second)
	
	// Should have 2 entries
	if len(resolver.cache) != 2 {
		t.Errorf("expected 2 cache entries, got %d", len(resolver.cache))
	}
	
	// Clean expired entries
	resolver.CleanExpiredEntries()
	
	// Should have 1 entry now
	if len(resolver.cache) != 1 {
		t.Errorf("expected 1 cache entry after cleanup, got %d", len(resolver.cache))
	}
	
	// Valid entry should still be there
	if _, found := resolver.getFromCache("valid:example.com"); !found {
		t.Error("expected valid entry to remain after cleanup")
	}
}

func TestMultiResolver_GetCacheStats(t *testing.T) {
	resolver := NewMultiResolver([]string{"1.1.1.1:53", "8.8.8.8:53"})
	resolver.SetTTL(30 * time.Second)
	
	// Add some cache entries
	resolver.setCache("active:example.com", "active", 10*time.Second)
	resolver.setCache("expired:example.com", "expired", -1*time.Second)
	
	stats := resolver.GetCacheStats()
	
	expectedStats := map[string]interface{}{
		"total_entries":      2,
		"expired_entries":    1,
		"active_entries":     1,
		"configured_servers": 2,
		"cache_ttl_seconds":  30,
	}
	
	for key, expected := range expectedStats {
		if stats[key] != expected {
			t.Errorf("expected %s = %v, got %v", key, expected, stats[key])
		}
	}
}

// Integration-style tests using the real MultiResolver
// Note: These would normally require network access, but we're testing the structure and interfaces
func TestMultiResolverInterface(t *testing.T) {
	resolver := NewMultiResolver([]string{"1.1.1.1:53"})
	ctx := context.Background()
	
	// Test that the resolver implements the Resolver interface
	var _ Resolver = resolver
	
	// Test method signatures (these will fail without network, but verify interface compliance)
	t.Run("LookupA signature", func(t *testing.T) {
		_, err := resolver.LookupA(ctx, "nonexistent.example.invalid")
		// We expect an error since this is an invalid domain and we don't have network
		if err == nil {
			t.Log("Unexpected success - might have network access")
		}
	})
	
	t.Run("LookupAAAA signature", func(t *testing.T) {
		_, err := resolver.LookupAAAA(ctx, "nonexistent.example.invalid")
		if err == nil {
			t.Log("Unexpected success - might have network access")
		}
	})
	
	t.Run("LookupCNAME signature", func(t *testing.T) {
		_, err := resolver.LookupCNAME(ctx, "nonexistent.example.invalid")
		if err == nil {
			t.Log("Unexpected success - might have network access")
		}
	})
	
	t.Run("LookupTXT signature", func(t *testing.T) {
		_, err := resolver.LookupTXT(ctx, "nonexistent.example.invalid")
		if err == nil {
			t.Log("Unexpected success - might have network access")
		}
	})
}

// Benchmark tests
func BenchmarkMultiResolver_Cache(b *testing.B) {
	resolver := NewMultiResolver([]string{"1.1.1.1:53"})
	key := "bench:example.com"
	value := []net.IP{net.ParseIP("1.2.3.4")}
	
	resolver.setCache(key, value, 10*time.Second)
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		resolver.getFromCache(key)
	}
}

func BenchmarkMultiResolver_GetCacheKey(b *testing.B) {
	resolver := NewMultiResolver([]string{"1.1.1.1:53"})
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		resolver.getCacheKey("A", "example.com")
	}
}

// Test helper for creating test IPs
func testIPv4(s string) net.IP {
	return net.ParseIP(s)
}

func testIPv6(s string) net.IP {
	return net.ParseIP(s)
}

// Example of how to use the fake resolver in tests
func ExampleFakeResolver() {
	fake := NewFakeResolver()
	
	// Setup test data
	fake.ARecords["example.com"] = []net.IP{testIPv4("1.2.3.4")}
	fake.AAAARecords["example.com"] = []net.IP{testIPv6("2001:db8::1")}
	fake.CNAMERecords["www.example.com"] = "example.com"
	fake.TXTRecords["example.com"] = []string{"v=spf1 include:_spf.example.com ~all"}
	
	ctx := context.Background()
	
	// Use the fake resolver
	ips, _ := fake.LookupA(ctx, "example.com")
	_ = ips // Use the result
	
	// Check call counts
	_ = fake.CallCounts["LookupA"] // Should be 1
}