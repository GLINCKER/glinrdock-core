package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// CloudflareProvider implements DNSProvider for Cloudflare API v4
type CloudflareProvider struct {
	client         *http.Client
	apiToken       string
	proxiedDefault bool
	baseURL        string
}

// CloudflareConfig holds Cloudflare-specific configuration
type CloudflareConfig struct {
	APIToken       string `json:"api_token"`
	ProxiedDefault bool   `json:"proxied_default"`
}

// CloudflareZone represents a zone from the Cloudflare API
type CloudflareZone struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Status string `json:"status"`
}

// CloudflareRecord represents a DNS record from the Cloudflare API
type CloudflareRecord struct {
	ID       string `json:"id"`
	ZoneID   string `json:"zone_id"`
	ZoneName string `json:"zone_name"`
	Name     string `json:"name"`
	Type     string `json:"type"`
	Content  string `json:"content"`
	Proxied  *bool  `json:"proxied,omitempty"`
	TTL      int    `json:"ttl"`
}

// CloudflareResponse represents the standard Cloudflare API response structure
type CloudflareResponse struct {
	Success bool              `json:"success"`
	Errors  []CloudflareError `json:"errors"`
	Result  interface{}       `json:"result"`
}

// CloudflareError represents an error from the Cloudflare API
type CloudflareError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// NewCloudflareProvider creates a new Cloudflare DNS provider
func NewCloudflareProvider(config CloudflareConfig, client *http.Client) *CloudflareProvider {
	if client == nil {
		client = &http.Client{}
	}

	return &CloudflareProvider{
		client:         client,
		apiToken:       config.APIToken,
		proxiedDefault: config.ProxiedDefault,
		baseURL:        "https://api.cloudflare.com/client/v4",
	}
}

// discoverZone finds the zone ID for a given domain by checking domain suffixes
func (c *CloudflareProvider) discoverZone(ctx context.Context, domain string) (*CloudflareZone, error) {
	// Try the domain itself and all parent domains
	parts := strings.Split(domain, ".")
	for i := 0; i < len(parts); i++ {
		candidateZone := strings.Join(parts[i:], ".")

		zones, err := c.listZones(ctx, candidateZone)
		if err != nil {
			return nil, fmt.Errorf("failed to list zones for %s: %w", candidateZone, err)
		}

		for _, zone := range zones {
			if zone.Name == candidateZone && zone.Status == "active" {
				return &zone, nil
			}
		}
	}

	return nil, fmt.Errorf("no active zone found for domain %s", domain)
}

// listZones retrieves zones matching the given name
func (c *CloudflareProvider) listZones(ctx context.Context, name string) ([]CloudflareZone, error) {
	url := fmt.Sprintf("%s/zones?name=%s", c.baseURL, name)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var cfResp CloudflareResponse
	if err := json.Unmarshal(body, &cfResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if !cfResp.Success {
		return nil, fmt.Errorf("Cloudflare API error: %v", cfResp.Errors)
	}

	// Parse result as array of zones
	resultBytes, err := json.Marshal(cfResp.Result)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal result: %w", err)
	}

	var zones []CloudflareZone
	if err := json.Unmarshal(resultBytes, &zones); err != nil {
		return nil, fmt.Errorf("failed to unmarshal zones: %w", err)
	}

	return zones, nil
}

// listRecords retrieves DNS records for a zone
func (c *CloudflareProvider) listRecords(ctx context.Context, zoneID, recordType, name string) ([]CloudflareRecord, error) {
	url := fmt.Sprintf("%s/zones/%s/dns_records?type=%s&name=%s", c.baseURL, zoneID, recordType, name)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var cfResp CloudflareResponse
	if err := json.Unmarshal(body, &cfResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if !cfResp.Success {
		return nil, fmt.Errorf("Cloudflare API error: %v", cfResp.Errors)
	}

	// Parse result as array of records
	resultBytes, err := json.Marshal(cfResp.Result)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal result: %w", err)
	}

	var records []CloudflareRecord
	if err := json.Unmarshal(resultBytes, &records); err != nil {
		return nil, fmt.Errorf("failed to unmarshal records: %w", err)
	}

	return records, nil
}

// createRecord creates a new DNS record
func (c *CloudflareProvider) createRecord(ctx context.Context, zoneID string, record CloudflareRecord) error {
	url := fmt.Sprintf("%s/zones/%s/dns_records", c.baseURL, zoneID)

	recordBytes, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("failed to marshal record: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", url, bytes.NewBuffer(recordBytes))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	var cfResp CloudflareResponse
	if err := json.Unmarshal(body, &cfResp); err != nil {
		return fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if !cfResp.Success {
		return fmt.Errorf("Cloudflare API error: %v", cfResp.Errors)
	}

	return nil
}

// updateRecord updates an existing DNS record
func (c *CloudflareProvider) updateRecord(ctx context.Context, zoneID, recordID string, record CloudflareRecord) error {
	url := fmt.Sprintf("%s/zones/%s/dns_records/%s", c.baseURL, zoneID, recordID)

	recordBytes, err := json.Marshal(record)
	if err != nil {
		return fmt.Errorf("failed to marshal record: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "PUT", url, bytes.NewBuffer(recordBytes))
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	var cfResp CloudflareResponse
	if err := json.Unmarshal(body, &cfResp); err != nil {
		return fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if !cfResp.Success {
		return fmt.Errorf("Cloudflare API error: %v", cfResp.Errors)
	}

	return nil
}

// deleteRecord deletes a DNS record
func (c *CloudflareProvider) deleteRecord(ctx context.Context, zoneID, recordID string) error {
	url := fmt.Sprintf("%s/zones/%s/dns_records/%s", c.baseURL, zoneID, recordID)

	req, err := http.NewRequestWithContext(ctx, "DELETE", url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to make request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	var cfResp CloudflareResponse
	if err := json.Unmarshal(body, &cfResp); err != nil {
		return fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if !cfResp.Success {
		return fmt.Errorf("Cloudflare API error: %v", cfResp.Errors)
	}

	return nil
}

// EnsureA creates or updates an A record
func (c *CloudflareProvider) EnsureA(ctx context.Context, domain string, ip string, proxied bool) error {
	zone, err := c.discoverZone(ctx, domain)
	if err != nil {
		return fmt.Errorf("failed to discover zone for %s: %w", domain, err)
	}

	// Check if record already exists
	records, err := c.listRecords(ctx, zone.ID, "A", domain)
	if err != nil {
		return fmt.Errorf("failed to list A records for %s: %w", domain, err)
	}

	record := CloudflareRecord{
		Name:    domain,
		Type:    "A",
		Content: ip,
		Proxied: &proxied,
		TTL:     1, // TTL=1 means "automatic" when proxied
	}

	// If record exists, update it
	if len(records) > 0 {
		return c.updateRecord(ctx, zone.ID, records[0].ID, record)
	}

	// Otherwise create new record
	return c.createRecord(ctx, zone.ID, record)
}

// EnsureCNAME creates or updates a CNAME record
func (c *CloudflareProvider) EnsureCNAME(ctx context.Context, domain, target string, proxied bool) error {
	zone, err := c.discoverZone(ctx, domain)
	if err != nil {
		return fmt.Errorf("failed to discover zone for %s: %w", domain, err)
	}

	// Check if record already exists
	records, err := c.listRecords(ctx, zone.ID, "CNAME", domain)
	if err != nil {
		return fmt.Errorf("failed to list CNAME records for %s: %w", domain, err)
	}

	record := CloudflareRecord{
		Name:    domain,
		Type:    "CNAME",
		Content: target,
		Proxied: &proxied,
		TTL:     1, // TTL=1 means "automatic" when proxied
	}

	// If record exists, update it
	if len(records) > 0 {
		return c.updateRecord(ctx, zone.ID, records[0].ID, record)
	}

	// Otherwise create new record
	return c.createRecord(ctx, zone.ID, record)
}

// EnsureTXT creates or updates a TXT record
func (c *CloudflareProvider) EnsureTXT(ctx context.Context, fqdn, value string, ttl int) error {
	zone, err := c.discoverZone(ctx, fqdn)
	if err != nil {
		return fmt.Errorf("failed to discover zone for %s: %w", fqdn, err)
	}

	// Check if record already exists with this value
	records, err := c.listRecords(ctx, zone.ID, "TXT", fqdn)
	if err != nil {
		return fmt.Errorf("failed to list TXT records for %s: %w", fqdn, err)
	}

	record := CloudflareRecord{
		Name:    fqdn,
		Type:    "TXT",
		Content: value,
		TTL:     ttl,
	}

	// Check if a record with this value already exists
	for _, existing := range records {
		if existing.Content == value {
			// Update existing record
			return c.updateRecord(ctx, zone.ID, existing.ID, record)
		}
	}

	// Create new record
	return c.createRecord(ctx, zone.ID, record)
}

// DeleteTXT deletes a TXT record by value
func (c *CloudflareProvider) DeleteTXT(ctx context.Context, fqdn, value string) error {
	zone, err := c.discoverZone(ctx, fqdn)
	if err != nil {
		return fmt.Errorf("failed to discover zone for %s: %w", fqdn, err)
	}

	// Find records with matching value
	records, err := c.listRecords(ctx, zone.ID, "TXT", fqdn)
	if err != nil {
		return fmt.Errorf("failed to list TXT records for %s: %w", fqdn, err)
	}

	// Delete all records with matching value
	for _, record := range records {
		if record.Content == value {
			if err := c.deleteRecord(ctx, zone.ID, record.ID); err != nil {
				return fmt.Errorf("failed to delete TXT record for %s: %w", fqdn, err)
			}
		}
	}

	return nil
}
