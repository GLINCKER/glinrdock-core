package store

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStore_RouteWithNewFields(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()
	ctx := context.Background()

	// Create a project and service first
	project, err := store.CreateProject(ctx, "test-project")
	require.NoError(t, err)

	serviceSpec := ServiceSpec{
		Name:  "api",
		Image: "nginx:alpine",
		Env:   map[string]string{"ENV": "test"},
		Ports: []PortMap{{Container: 8080, Host: 8081}},
	}
	service, err := store.CreateService(ctx, project.ID, serviceSpec)
	require.NoError(t, err)

	// Create a certificate
	certSpec := CertificateSpec{
		Domain: "api.example.com",
		Type:   "uploaded",
	}
	cert, err := store.CreateCertificate(ctx, certSpec)
	require.NoError(t, err)

	// Test creating route with all new fields
	path := "/api/v1"
	proxyConfig := `{"timeout": 30, "headers": {"X-Custom": "value"}}`
	routeSpec := RouteSpec{
		Domain:        "api.example.com",
		Port:          8080,
		TLS:           true,
		Path:          &path,
		CertificateID: &cert.ID,
		ProxyConfig:   &proxyConfig,
	}

	route, err := store.CreateRoute(ctx, service.ID, routeSpec)
	require.NoError(t, err)

	// Verify all fields are persisted correctly
	assert.Equal(t, "api.example.com", route.Domain)
	assert.Equal(t, 8080, route.Port)
	assert.True(t, route.TLS)
	assert.NotNil(t, route.Path)
	assert.Equal(t, "/api/v1", *route.Path)
	assert.NotNil(t, route.CertificateID)
	assert.Equal(t, cert.ID, *route.CertificateID)
	assert.NotNil(t, route.ProxyConfig)
	assert.Equal(t, proxyConfig, *route.ProxyConfig)
	assert.NotZero(t, route.CreatedAt)
	assert.NotNil(t, route.UpdatedAt)
}

func TestStore_GetRouteWithNewFields(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()
	ctx := context.Background()

	// Create prerequisites
	project, err := store.CreateProject(ctx, "test-project")
	require.NoError(t, err)

	serviceSpec := ServiceSpec{
		Name:  "web",
		Image: "nginx:alpine",
		Env:   map[string]string{},
		Ports: []PortMap{{Container: 80, Host: 8080}},
	}
	service, err := store.CreateService(ctx, project.ID, serviceSpec)
	require.NoError(t, err)

	cert, err := store.CreateCertificate(ctx, CertificateSpec{
		Domain: "web.example.com",
		Type:   "letsencrypt",
	})
	require.NoError(t, err)

	// Create route with new fields
	path := "/web"
	proxyConfig := `{"client_max_body_size": "10M"}`
	routeSpec := RouteSpec{
		Domain:        "web.example.com",
		Port:          80,
		TLS:           true,
		Path:          &path,
		CertificateID: &cert.ID,
		ProxyConfig:   &proxyConfig,
	}
	created, err := store.CreateRoute(ctx, service.ID, routeSpec)
	require.NoError(t, err)

	// Test GetRoute includes new fields
	route, err := store.GetRoute(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, created.ID, route.ID)
	assert.Equal(t, service.ID, route.ServiceID)
	assert.Equal(t, "web.example.com", route.Domain)
	assert.Equal(t, 80, route.Port)
	assert.True(t, route.TLS)
	assert.NotNil(t, route.Path)
	assert.Equal(t, "/web", *route.Path)
	assert.NotNil(t, route.CertificateID)
	assert.Equal(t, cert.ID, *route.CertificateID)
	assert.NotNil(t, route.ProxyConfig)
	assert.Equal(t, proxyConfig, *route.ProxyConfig)
	assert.NotZero(t, route.CreatedAt)
	assert.NotNil(t, route.UpdatedAt)
}

func TestStore_ListRoutesWithNewFields(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()
	ctx := context.Background()

	// Create prerequisites
	project, err := store.CreateProject(ctx, "test-project")
	require.NoError(t, err)

	serviceSpec := ServiceSpec{
		Name:  "multi",
		Image: "nginx:alpine",
		Env:   map[string]string{},
		Ports: []PortMap{{Container: 80, Host: 8080}},
	}
	service, err := store.CreateService(ctx, project.ID, serviceSpec)
	require.NoError(t, err)

	// Create routes with different configurations
	routes := []struct {
		domain        string
		path          *string
		certificateID *int64
		proxyConfig   *string
	}{
		{
			domain:        "site1.example.com",
			path:          stringPtr("/api"),
			certificateID: nil,
			proxyConfig:   stringPtr(`{"timeout": 60}`),
		},
		{
			domain:        "site2.example.com",
			path:          nil,
			certificateID: nil,
			proxyConfig:   nil,
		},
	}

	var createdRoutes []Route
	for _, r := range routes {
		routeSpec := RouteSpec{
			Domain:        r.domain,
			Port:          80,
			TLS:           false,
			Path:          r.path,
			CertificateID: r.certificateID,
			ProxyConfig:   r.proxyConfig,
		}
		created, err := store.CreateRoute(ctx, service.ID, routeSpec)
		require.NoError(t, err)
		createdRoutes = append(createdRoutes, created)
	}

	// Test ListRoutes includes new fields
	listedRoutes, err := store.ListRoutes(ctx, service.ID)
	require.NoError(t, err)
	assert.Len(t, listedRoutes, 2)

	// Verify first route
	route1 := listedRoutes[0]
	assert.Equal(t, "site1.example.com", route1.Domain)
	assert.NotNil(t, route1.Path)
	assert.Equal(t, "/api", *route1.Path)
	assert.Nil(t, route1.CertificateID)
	assert.NotNil(t, route1.ProxyConfig)
	assert.Equal(t, `{"timeout": 60}`, *route1.ProxyConfig)

	// Verify second route
	route2 := listedRoutes[1]
	assert.Equal(t, "site2.example.com", route2.Domain)
	assert.Nil(t, route2.Path)
	assert.Nil(t, route2.CertificateID)
	assert.Nil(t, route2.ProxyConfig)
}

func TestStore_GetAllRoutesWithNewFields(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()
	ctx := context.Background()

	// Create multiple projects and services with routes
	project1, err := store.CreateProject(ctx, "project1")
	require.NoError(t, err)
	project2, err := store.CreateProject(ctx, "project2")
	require.NoError(t, err)

	service1, err := store.CreateService(ctx, project1.ID, ServiceSpec{
		Name:  "service1",
		Image: "nginx",
		Ports: []PortMap{{Container: 80}},
	})
	require.NoError(t, err)

	service2, err := store.CreateService(ctx, project2.ID, ServiceSpec{
		Name:  "service2",
		Image: "nginx",
		Ports: []PortMap{{Container: 80}},
	})
	require.NoError(t, err)

	// Create certificate
	cert, err := store.CreateCertificate(ctx, CertificateSpec{
		Domain: "shared.example.com",
		Type:   "uploaded",
	})
	require.NoError(t, err)

	// Create routes with various field combinations
	routes := []RouteSpec{
		{
			Domain:        "a.example.com",
			Port:          80,
			TLS:           true,
			Path:          stringPtr("/api/v1"),
			CertificateID: &cert.ID,
			ProxyConfig:   stringPtr(`{"rate_limit": "10r/s"}`),
		},
		{
			Domain: "z.example.com",
			Port:   80,
			TLS:    false,
			// Path, CertificateID, ProxyConfig are nil
		},
	}

	_, err = store.CreateRoute(ctx, service1.ID, routes[0])
	require.NoError(t, err)
	_, err = store.CreateRoute(ctx, service2.ID, routes[1])
	require.NoError(t, err)

	// Test GetAllRoutes includes new fields and is ordered by domain
	allRoutes, err := store.GetAllRoutes(ctx)
	require.NoError(t, err)
	assert.Len(t, allRoutes, 2)

	// Verify ordering (by domain) and fields
	route1 := allRoutes[0]
	assert.Equal(t, "a.example.com", route1.Domain)
	assert.Equal(t, service1.ID, route1.ServiceID)
	assert.True(t, route1.TLS)
	assert.NotNil(t, route1.Path)
	assert.Equal(t, "/api/v1", *route1.Path)
	assert.NotNil(t, route1.CertificateID)
	assert.Equal(t, cert.ID, *route1.CertificateID)
	assert.NotNil(t, route1.ProxyConfig)
	assert.Equal(t, `{"rate_limit": "10r/s"}`, *route1.ProxyConfig)

	route2 := allRoutes[1]
	assert.Equal(t, "z.example.com", route2.Domain)
	assert.Equal(t, service2.ID, route2.ServiceID)
	assert.False(t, route2.TLS)
	assert.Nil(t, route2.Path)
	assert.Nil(t, route2.CertificateID)
	assert.Nil(t, route2.ProxyConfig)
}

func TestStore_RouteNewFieldsEdgeCases(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()
	ctx := context.Background()

	// Setup prerequisites
	project, err := store.CreateProject(ctx, "edge-test")
	require.NoError(t, err)

	service, err := store.CreateService(ctx, project.ID, ServiceSpec{
		Name:  "edge-service",
		Image: "nginx",
		Ports: []PortMap{{Container: 80}},
	})
	require.NoError(t, err)

	// Test route with empty string path (should be stored as empty string, not nil)
	emptyPath := ""
	routeSpec := RouteSpec{
		Domain: "empty-path.example.com",
		Port:   80,
		Path:   &emptyPath,
	}
	route, err := store.CreateRoute(ctx, service.ID, routeSpec)
	require.NoError(t, err)

	retrieved, err := store.GetRoute(ctx, route.ID)
	require.NoError(t, err)
	assert.NotNil(t, retrieved.Path)
	assert.Equal(t, "", *retrieved.Path)

	// Test route with empty JSON object as proxy config
	emptyJSON := "{}"
	routeSpec2 := RouteSpec{
		Domain:      "empty-json.example.com",
		Port:        80,
		ProxyConfig: &emptyJSON,
	}
	route2, err := store.CreateRoute(ctx, service.ID, routeSpec2)
	require.NoError(t, err)

	retrieved2, err := store.GetRoute(ctx, route2.ID)
	require.NoError(t, err)
	assert.NotNil(t, retrieved2.ProxyConfig)
	assert.Equal(t, "{}", *retrieved2.ProxyConfig)

	// Test route with reference to non-existent certificate (should still work)
	nonExistentCertID := int64(99999)
	routeSpec3 := RouteSpec{
		Domain:        "nonexistent-cert.example.com",
		Port:          80,
		CertificateID: &nonExistentCertID,
	}
	route3, err := store.CreateRoute(ctx, service.ID, routeSpec3)
	require.NoError(t, err)

	retrieved3, err := store.GetRoute(ctx, route3.ID)
	require.NoError(t, err)
	assert.NotNil(t, retrieved3.CertificateID)
	assert.Equal(t, nonExistentCertID, *retrieved3.CertificateID)
}

// Helper function to create string pointers
func stringPtr(s string) *string {
	return &s
}
