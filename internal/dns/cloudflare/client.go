package cloudflare

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"time"
)

var (
	baseURL = "https://api.cloudflare.com/client/v4"
)

type Client struct {
	apiToken   string
	httpClient *http.Client
}

type Config struct {
	APIToken string
}

func NewClient(config Config) *Client {
	return &Client{
		apiToken: config.APIToken,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

type ZoneResponse struct {
	Result []Zone `json:"result"`
	Success bool `json:"success"`
	Errors []APIError `json:"errors"`
	Messages []string `json:"messages"`
}

type Zone struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type RecordResponse struct {
	Result []Record `json:"result"`
	Success bool `json:"success"`
	Errors []APIError `json:"errors"`
	Messages []string `json:"messages"`
}

type Record struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Name    string `json:"name"`
	Content string `json:"content"`
	Proxied bool   `json:"proxied"`
	TTL     int    `json:"ttl"`
}

type CreateRecordRequest struct {
	Type    string `json:"type"`
	Name    string `json:"name"`
	Content string `json:"content"`
	Proxied bool   `json:"proxied"`
	TTL     int    `json:"ttl,omitempty"`
}

type UpdateRecordRequest struct {
	Type    string `json:"type"`
	Name    string `json:"name"`
	Content string `json:"content"`
	Proxied bool   `json:"proxied"`
	TTL     int    `json:"ttl,omitempty"`
}

type APIError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

func (e APIError) Error() string {
	return fmt.Sprintf("Cloudflare API error %d: %s", e.Code, e.Message)
}

type CloudflareError struct {
	Message string
	Code    int
	Errors  []APIError
}

func (e *CloudflareError) Error() string {
	if len(e.Errors) > 0 {
		return fmt.Sprintf("Cloudflare: %s (code: %d, api_error: %s)", e.Message, e.Code, e.Errors[0].Message)
	}
	return fmt.Sprintf("Cloudflare: %s (code: %d)", e.Message, e.Code)
}

func (c *Client) makeRequest(ctx context.Context, method, url string, body interface{}) (*http.Response, error) {
	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewBuffer(jsonBody)
	}

	req, err := http.NewRequestWithContext(ctx, method, url, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.apiToken)
	req.Header.Set("Content-Type", "application/json")

	for {
		resp, err := c.httpClient.Do(req)
		if err != nil {
			return nil, fmt.Errorf("failed to make request: %w", err)
		}

		// Handle rate limiting
		if resp.StatusCode == 429 {
			retryAfter := resp.Header.Get("Retry-After")
			if retryAfter != "" {
				seconds, err := strconv.Atoi(retryAfter)
				if err == nil {
					resp.Body.Close()
					select {
					case <-ctx.Done():
						return nil, ctx.Err()
					case <-time.After(time.Duration(seconds) * time.Second):
						continue
					}
				}
			}
			resp.Body.Close()
			return nil, &CloudflareError{
				Message: "Rate limit exceeded",
				Code:    429,
			}
		}

		return resp, nil
	}
}

func (c *Client) GetZoneID(ctx context.Context, domain string) (string, error) {
	url := fmt.Sprintf("%s/zones?name=%s", baseURL, domain)
	
	resp, err := c.makeRequest(ctx, "GET", url, nil)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var zoneResp ZoneResponse
	if err := json.NewDecoder(resp.Body).Decode(&zoneResp); err != nil {
		return "", &CloudflareError{
			Message: "Failed to decode zone response",
			Code:    resp.StatusCode,
		}
	}

	if !zoneResp.Success {
		return "", &CloudflareError{
			Message: "Zone lookup failed",
			Code:    resp.StatusCode,
			Errors:  zoneResp.Errors,
		}
	}

	if len(zoneResp.Result) == 0 {
		return "", &CloudflareError{
			Message: fmt.Sprintf("Zone not found for domain: %s", domain),
			Code:    404,
		}
	}

	return zoneResp.Result[0].ID, nil
}

func (c *Client) EnsureRecord(ctx context.Context, zoneID, recordType, name, content string, proxied bool) (*Record, error) {
	// First, check if the record already exists
	existing, err := c.findExistingRecord(ctx, zoneID, recordType, name)
	if err != nil {
		return nil, err
	}

	if existing != nil {
		// Update existing record if content or proxied status differs
		if existing.Content == content && existing.Proxied == proxied {
			return existing, nil // No change needed
		}

		return c.updateRecord(ctx, zoneID, existing.ID, recordType, name, content, proxied)
	}

	// Create new record
	return c.createRecord(ctx, zoneID, recordType, name, content, proxied)
}

func (c *Client) EnsureTXT(ctx context.Context, zoneID, name, content string) (*Record, error) {
	return c.EnsureRecord(ctx, zoneID, "TXT", name, content, false)
}

func (c *Client) DeleteRecord(ctx context.Context, zoneID, recordID string) error {
	url := fmt.Sprintf("%s/zones/%s/dns_records/%s", baseURL, zoneID, recordID)
	
	resp, err := c.makeRequest(ctx, "DELETE", url, nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 404 {
		// Record not found - consider it successfully deleted
		return nil
	}

	var result struct {
		Success bool `json:"success"`
		Errors []APIError `json:"errors"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return &CloudflareError{
			Message: "Failed to decode delete response",
			Code:    resp.StatusCode,
		}
	}

	if !result.Success {
		return &CloudflareError{
			Message: "Failed to delete record",
			Code:    resp.StatusCode,
			Errors:  result.Errors,
		}
	}

	return nil
}

func (c *Client) findExistingRecord(ctx context.Context, zoneID, recordType, name string) (*Record, error) {
	url := fmt.Sprintf("%s/zones/%s/dns_records?type=%s&name=%s", baseURL, zoneID, recordType, name)
	
	resp, err := c.makeRequest(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var recordResp RecordResponse
	if err := json.NewDecoder(resp.Body).Decode(&recordResp); err != nil {
		return nil, &CloudflareError{
			Message: "Failed to decode record response",
			Code:    resp.StatusCode,
		}
	}

	if !recordResp.Success {
		return nil, &CloudflareError{
			Message: "Failed to list records",
			Code:    resp.StatusCode,
			Errors:  recordResp.Errors,
		}
	}

	if len(recordResp.Result) == 0 {
		return nil, nil // No existing record
	}

	return &recordResp.Result[0], nil
}

func (c *Client) createRecord(ctx context.Context, zoneID, recordType, name, content string, proxied bool) (*Record, error) {
	url := fmt.Sprintf("%s/zones/%s/dns_records", baseURL, zoneID)
	
	req := CreateRecordRequest{
		Type:    recordType,
		Name:    name,
		Content: content,
		Proxied: proxied,
	}

	resp, err := c.makeRequest(ctx, "POST", url, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Result  Record     `json:"result"`
		Success bool       `json:"success"`
		Errors  []APIError `json:"errors"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, &CloudflareError{
			Message: "Failed to decode create response",
			Code:    resp.StatusCode,
		}
	}

	if !result.Success {
		return nil, &CloudflareError{
			Message: "Failed to create record",
			Code:    resp.StatusCode,
			Errors:  result.Errors,
		}
	}

	return &result.Result, nil
}

func (c *Client) updateRecord(ctx context.Context, zoneID, recordID, recordType, name, content string, proxied bool) (*Record, error) {
	url := fmt.Sprintf("%s/zones/%s/dns_records/%s", baseURL, zoneID, recordID)
	
	req := UpdateRecordRequest{
		Type:    recordType,
		Name:    name,
		Content: content,
		Proxied: proxied,
	}

	resp, err := c.makeRequest(ctx, "PUT", url, req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Result  Record     `json:"result"`
		Success bool       `json:"success"`
		Errors  []APIError `json:"errors"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, &CloudflareError{
			Message: "Failed to decode update response",
			Code:    resp.StatusCode,
		}
	}

	if !result.Success {
		return nil, &CloudflareError{
			Message: "Failed to update record",
			Code:    resp.StatusCode,
			Errors:  result.Errors,
		}
	}

	return &result.Result, nil
}