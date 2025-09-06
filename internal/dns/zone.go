package dns

import (
	"context"
	"fmt"
	"strings"
)

// ZoneInfo contains information about a DNS zone and its provider
type ZoneInfo struct {
	Zone     string
	Provider string
	NS       []string
}

// Provider constants
const (
	ProviderCloudflare = "cloudflare"
	ProviderManual     = "manual"
)

// ZoneDetector handles zone detection and provider identification
type ZoneDetector struct {
	inspector DNSInspector
}

// NewZoneDetector creates a new zone detector
func NewZoneDetector() *ZoneDetector {
	return &ZoneDetector{
		inspector: NewInspector(),
	}
}

// NewZoneDetectorWithInspector creates a zone detector with a custom inspector
func NewZoneDetectorWithInspector(inspector DNSInspector) *ZoneDetector {
	return &ZoneDetector{
		inspector: inspector,
	}
}

// FindZone finds the authoritative zone for a domain by walking up the domain hierarchy
func (zd *ZoneDetector) FindZone(ctx context.Context, domain string) (string, error) {
	if domain == "" {
		return "", fmt.Errorf("domain cannot be empty")
	}

	// Normalize domain
	domain = strings.TrimSpace(domain)
	domain = strings.ToLower(domain)
	domain = strings.TrimSuffix(domain, ".")

	// Try the domain itself and walk up the hierarchy
	parts := strings.Split(domain, ".")

	// Try each level starting from the full domain
	for i := 0; i < len(parts)-1; i++ { // Don't try just the TLD
		currentDomain := strings.Join(parts[i:], ".")
		ns, err := zd.inspector.DetectAuthoritativeNS(ctx, currentDomain)
		if err == nil && len(ns) > 0 {
			return currentDomain, nil
		}
	}

	return "", fmt.Errorf("no authoritative zone found for domain: %s", domain)
}

// DetectProvider determines the DNS provider based on nameservers
func (zd *ZoneDetector) DetectProvider(ctx context.Context, zone string) (string, error) {
	ns, err := zd.inspector.DetectAuthoritativeNS(ctx, zone)
	if err != nil {
		return "", fmt.Errorf("failed to detect nameservers for zone %s: %w", zone, err)
	}

	return zd.detectProviderFromNS(ns), nil
}

// detectProviderFromNS determines provider based on nameserver hostnames
func (zd *ZoneDetector) detectProviderFromNS(nameservers []string) string {
	for _, ns := range nameservers {
		ns = strings.ToLower(ns)

		// Check for Cloudflare nameservers
		if strings.Contains(ns, "cloudflare.com") {
			return ProviderCloudflare
		}

		// Add more provider detection logic here as needed
		// Example patterns:
		// if strings.Contains(ns, "amazonaws.com") {
		//     return "route53"
		// }
		// if strings.Contains(ns, "googledomains.com") {
		//     return "google"
		// }
	}

	// Default to manual if no known provider is detected
	return ProviderManual
}

// GetZoneInfo retrieves comprehensive zone information including provider detection
func (zd *ZoneDetector) GetZoneInfo(ctx context.Context, domain string) (*ZoneInfo, error) {
	zone, err := zd.FindZone(ctx, domain)
	if err != nil {
		return nil, fmt.Errorf("failed to find zone for domain %s: %w", domain, err)
	}

	ns, err := zd.inspector.DetectAuthoritativeNS(ctx, zone)
	if err != nil {
		return nil, fmt.Errorf("failed to get nameservers for zone %s: %w", zone, err)
	}

	provider := zd.detectProviderFromNS(ns)

	return &ZoneInfo{
		Zone:     zone,
		Provider: provider,
		NS:       ns,
	}, nil
}

// ValidateZoneOwnership validates that a domain belongs to the expected zone
func (zd *ZoneDetector) ValidateZoneOwnership(ctx context.Context, domain, expectedZone string) (bool, error) {
	actualZone, err := zd.FindZone(ctx, domain)
	if err != nil {
		return false, fmt.Errorf("failed to find zone for domain %s: %w", domain, err)
	}

	// Normalize both zones for comparison
	actualZone = strings.TrimSuffix(strings.ToLower(actualZone), ".")
	expectedZone = strings.TrimSuffix(strings.ToLower(expectedZone), ".")

	return actualZone == expectedZone, nil
}
