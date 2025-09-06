package dns

import (
	"context"
	"fmt"
	"log"
	"net"

	"github.com/GLINCKER/glinrdock/internal/util"
)

// Example showing how to use the DNS resolver with system configuration
func ExampleMultiResolver() {
	// Create resolver from system configuration
	config := &util.Config{
		DNSResolvers: []string{"1.1.1.1:53", "8.8.8.8:53"},
	}
	resolver := NewFromConfig(config)

	ctx := context.Background()

	// Look up A records
	ips, err := resolver.LookupA(ctx, "example.com")
	if err != nil {
		log.Printf("A lookup failed: %v", err)
	}
	for _, ip := range ips {
		fmt.Printf("A record: %s\n", ip)
	}

	// Look up TXT records
	txtRecords, err := resolver.LookupTXT(ctx, "example.com")
	if err != nil {
		log.Printf("TXT lookup failed: %v", err)
	}
	for _, txt := range txtRecords {
		fmt.Printf("TXT record: %s\n", txt)
	}

	// Get cache statistics
	stats := resolver.GetCacheStats()
	fmt.Printf("Cache stats: %+v\n", stats)
}

// Example showing how to use the global resolver
func ExampleGlobalResolver() {
	// Initialize global resolver
	config := &util.Config{
		DNSResolvers: []string{"9.9.9.9:53"}, // Quad9 DNS
	}
	InitGlobalResolver(config)

	// Use the global resolver anywhere in the application
	resolver := GetGlobalResolver()

	ctx := context.Background()
	cname, err := resolver.LookupCNAME(ctx, "www.example.com")
	if err != nil {
		log.Printf("CNAME lookup failed: %v", err)
		return
	}

	fmt.Printf("CNAME: %s\n", cname)
}

// Example showing how to use the fake resolver for testing
func ExampleFakeResolver_testing() {
	// Create a fake resolver for testing
	fake := NewFakeResolver()

	// Setup test data
	fake.ARecords["test.example.com"] = []net.IP{
		net.ParseIP("192.0.2.1"),
		net.ParseIP("192.0.2.2"),
	}
	fake.TXTRecords["test.example.com"] = []string{
		"v=spf1 include:_spf.example.com ~all",
		"google-site-verification=abc123",
	}

	// Set as global resolver for testing
	SetGlobalResolver(fake)

	// Now all DNS lookups will use the fake data
	ctx := context.Background()
	resolver := GetGlobalResolver()

	ips, _ := resolver.LookupA(ctx, "test.example.com")
	fmt.Printf("Test A records: %v\n", ips)

	// Check how many times the method was called
	fmt.Printf("LookupA called %d times\n", fake.CallCounts["LookupA"])

	// Output:
	// Test A records: [192.0.2.1 192.0.2.2]
	// LookupA called 1 times
}
