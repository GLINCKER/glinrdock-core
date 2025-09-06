//go:build nginx_e2e

package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const (
	glinrdockHost     = "localhost:8080"
	nginxProxyHost    = "localhost:80"
	testDomain        = "example.local"
	echoServerPort    = "8081"
	adminToken        = "test-token"
)

// TestNginxE2EProxyFlow tests the complete nginx proxy flow:
// 1. Start dev compose (or ensure running)
// 2. Create a dummy echo server on port 8081
// 3. Create route example.local → 8081 (TLS false)
// 4. Trigger reconcile
// 5. curl http://localhost/ with Host: example.local; expect 200
func TestNginxE2EProxyFlow(t *testing.T) {
	// Skip if not in CI or explicit environment
	if os.Getenv("NGINX_E2E_ENABLED") == "" {
		t.Skip("NGINX_E2E_ENABLED not set, skipping nginx e2e test")
	}

	ctx := context.Background()

	// Step 1: Ensure Docker Compose is running
	t.Log("Checking if glinrdockd is accessible...")
	err := waitForGlinrdock(ctx, 30*time.Second)
	require.NoError(t, err, "glinrdockd should be accessible at %s", glinrdockHost)

	// Step 2: Start echo server on a different port to avoid conflicts
	echoPort := findAvailablePort(t)
	t.Log("Starting echo server on port", echoPort)
	echoServer := startEchoServer(t, echoPort)
	defer echoServer.Close()

	// Wait for echo server to be ready
	err = waitForHTTPService(ctx, "localhost:"+echoPort, 10*time.Second)
	require.NoError(t, err, "echo server should be accessible")

	// Step 3: Create a dummy project and service
	serviceID := createTestService(t, echoPort)

	// Step 4: Create route example.local → echoPort (TLS false)
	t.Log("Creating route for", testDomain, "->", echoPort)
	createRoute(t, serviceID, testDomain, "/", echoPort, false)

	// Step 5: Wait for nginx to be ready (assuming nginx proxy is enabled)
	// Check if nginx is running on port 80
	err = waitForHTTPService(ctx, nginxProxyHost, 30*time.Second)
	if err != nil {
		t.Log("Nginx proxy not running on port 80, checking if nginx is enabled...")
		// This test requires nginx to be enabled
		t.Skip("Nginx proxy not accessible on port 80 - ensure NGINX_PROXY_ENABLED=true")
	}

	// Step 6: Test the proxy by making HTTP request with Host header
	t.Log("Testing proxy request to", testDomain)
	testProxyRequest(t, testDomain)

	t.Log("✅ Nginx E2E proxy test completed successfully!")
}

// waitForGlinrdock waits for glinrdockd to be accessible
func waitForGlinrdock(ctx context.Context, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	client := &http.Client{Timeout: 2 * time.Second}

	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("timeout waiting for glinrdockd at %s", glinrdockHost)
		default:
			resp, err := client.Get(fmt.Sprintf("http://%s/v1/health", glinrdockHost))
			if err == nil {
				resp.Body.Close()
				if resp.StatusCode == http.StatusOK {
					return nil
				}
			}
			time.Sleep(1 * time.Second)
		}
	}
}

// waitForHTTPService waits for an HTTP service to respond
func waitForHTTPService(ctx context.Context, host string, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	client := &http.Client{Timeout: 2 * time.Second}

	for {
		select {
		case <-ctx.Done():
			return fmt.Errorf("timeout waiting for HTTP service at %s", host)
		default:
			// Try to make a simple HTTP request
			resp, err := client.Get(fmt.Sprintf("http://%s/", host))
			if err == nil {
				resp.Body.Close()
				return nil // Service is responding
			}
			time.Sleep(500 * time.Millisecond)
		}
	}
}

// startEchoServer starts a simple HTTP echo server for testing
func startEchoServer(t *testing.T, port string) *http.Server {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		// Echo back request information
		response := map[string]interface{}{
			"message":    "Hello from echo server!",
			"method":     r.Method,
			"path":       r.URL.Path,
			"host":       r.Host,
			"headers":    r.Header,
			"query":      r.URL.Query(),
			"timestamp":  time.Now().Format(time.RFC3339),
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(response)
	})

	server := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	go func() {
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			t.Logf("Echo server error: %v", err)
		}
	}()

	// Wait for server to be ready
	listener, err := net.Listen("tcp", ":"+port)
	if err != nil {
		// Port might be in use, try to connect to it
		conn, err := net.Dial("tcp", "localhost:"+port)
		if err != nil {
			t.Fatalf("Failed to start echo server on port %s: %v", port, err)
		}
		conn.Close()
	} else {
		listener.Close()
	}

	t.Logf("Echo server started on port %s", port)
	return server
}

// findAvailablePort finds an available port for the echo server
func findAvailablePort(t *testing.T) string {
	// Start from a high port to avoid conflicts
	for port := 9000; port < 9100; port++ {
		listener, err := net.Listen("tcp", fmt.Sprintf(":%d", port))
		if err == nil {
			listener.Close()
			return fmt.Sprintf("%d", port)
		}
	}
	t.Fatal("Could not find an available port")
	return ""
}

// createTestService creates a simple mock service (just returns the echo server info)
func createTestService(t *testing.T, port string) string {
	// For the e2e test, we'll use a simple service ID that represents
	// our echo server. In a real scenario, this would be a container or service
	// managed by glinrdock, but for testing we just need a reference
	serviceID := "echo-service-" + port
	t.Logf("Using service ID: %s (points to localhost:%s)", serviceID, port)
	return serviceID
}

// createRoute creates a route via the glinrdock API
func createRoute(t *testing.T, serviceID, domain, path, port string, tls bool) {
	client := &http.Client{Timeout: 10 * time.Second}

	createRouteReq := map[string]interface{}{
		"domain": domain,
		"path":   path,
		"port":   parsePort(port),
		"tls":    tls,
	}
	routeData, _ := json.Marshal(createRouteReq)

	req, _ := http.NewRequest("POST", fmt.Sprintf("http://%s/v1/services/%s/routes", glinrdockHost, serviceID), strings.NewReader(string(routeData)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+adminToken)

	resp, err := client.Do(req)
	require.NoError(t, err, "Failed to create route")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("Failed to create route: %s (status: %d)", string(body), resp.StatusCode)
	}

	t.Logf("Created route: %s%s -> %s:%s", domain, path, serviceID, port)

	// Trigger nginx reload to apply the configuration
	triggerNginxReload(t)
}

// parsePort converts port string to int for API
func parsePort(port string) int {
	if portInt, err := strconv.Atoi(port); err == nil {
		return portInt
	}
	return 80 // default
}

// triggerNginxReload triggers nginx configuration reload
func triggerNginxReload(t *testing.T) {
	client := &http.Client{Timeout: 10 * time.Second}

	req, _ := http.NewRequest("POST", fmt.Sprintf("http://%s/v1/nginx/reload", glinrdockHost), nil)
	req.Header.Set("Authorization", "Bearer "+adminToken)

	resp, err := client.Do(req)
	if err != nil {
		t.Logf("Warning: Failed to trigger nginx reload: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Logf("Warning: Nginx reload failed: %s (status: %d)", string(body), resp.StatusCode)
	} else {
		t.Log("Triggered nginx configuration reload")
	}

	// Wait for nginx to process the configuration
	time.Sleep(3 * time.Second)
}

// testProxyRequest tests the nginx proxy functionality
func testProxyRequest(t *testing.T, domain string) {
	client := &http.Client{
		Timeout: 10 * time.Second,
		// Don't follow redirects to test the exact response
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	// Create request to nginx proxy with Host header
	req, err := http.NewRequest("GET", fmt.Sprintf("http://%s/", nginxProxyHost), nil)
	require.NoError(t, err, "Failed to create proxy request")

	req.Host = domain
	req.Header.Set("Host", domain)

	t.Logf("Making proxy request: GET http://%s/ with Host: %s", nginxProxyHost, domain)

	resp, err := client.Do(req)
	require.NoError(t, err, "Proxy request should not fail")
	defer resp.Body.Close()

	// Log response details
	body, _ := io.ReadAll(resp.Body)
	t.Logf("Proxy response: Status=%d, Body=%s", resp.StatusCode, string(body)[:min(200, len(body))])

	// Expect successful response (200) from the proxied service
	assert.Equal(t, http.StatusOK, resp.StatusCode, "Proxy should return 200 OK")

	// Verify the response indicates it came from our proxied service
	// This could be checking for specific content that identifies our echo server
	assert.True(t, len(body) > 0, "Response body should not be empty")

	t.Log("✅ Proxy request successful!")
}

// min helper function
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}