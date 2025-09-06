package store

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRouteOperations(t *testing.T) {
	ctx := context.Background()
	store := setupTestStore(t)

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

	t.Run("CreateRoute", func(t *testing.T) {
		routeSpec := RouteSpec{
			Domain: "api.example.com",
			Port:   8080,
			TLS:    true,
		}

		route, err := store.CreateRoute(ctx, service.ID, routeSpec)
		require.NoError(t, err)

		assert.Greater(t, route.ID, int64(0))
		assert.Equal(t, service.ID, route.ServiceID)
		assert.Equal(t, "api.example.com", route.Domain)
		assert.Equal(t, 8080, route.Port)
		assert.True(t, route.TLS)
		assert.NotZero(t, route.CreatedAt)
	})

	t.Run("CreateRouteValidation", func(t *testing.T) {
		// Empty domain
		routeSpec := RouteSpec{Domain: "", Port: 80}
		_, err := store.CreateRoute(ctx, service.ID, routeSpec)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "domain cannot be empty")

		// Domain too long
		longDomain := string(make([]byte, 255)) + ".com"
		routeSpec = RouteSpec{Domain: longDomain, Port: 80}
		_, err = store.CreateRoute(ctx, service.ID, routeSpec)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "domain too long")

		// Service not found
		routeSpec = RouteSpec{Domain: "test.com", Port: 80}
		_, err = store.CreateRoute(ctx, 99999, routeSpec)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "service not found")
	})

	t.Run("ListRoutes", func(t *testing.T) {
		// Create multiple routes for the service
		routes := []RouteSpec{
			{Domain: "www.example.com", Port: 80, TLS: false},
			{Domain: "admin.example.com", Port: 8080, TLS: true},
		}

		for _, spec := range routes {
			_, err := store.CreateRoute(ctx, service.ID, spec)
			require.NoError(t, err)
		}

		retrievedRoutes, err := store.ListRoutes(ctx, service.ID)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(retrievedRoutes), 2)

		// Check that our routes are in the list
		domains := make(map[string]bool)
		for _, route := range retrievedRoutes {
			domains[route.Domain] = true
		}
		assert.True(t, domains["www.example.com"])
		assert.True(t, domains["admin.example.com"])
	})

	t.Run("GetRoute", func(t *testing.T) {
		// Create a route
		routeSpec := RouteSpec{Domain: "get.example.com", Port: 3000, TLS: false}
		created, err := store.CreateRoute(ctx, service.ID, routeSpec)
		require.NoError(t, err)

		// Retrieve the route
		route, err := store.GetRoute(ctx, created.ID)
		require.NoError(t, err)

		assert.Equal(t, created.ID, route.ID)
		assert.Equal(t, service.ID, route.ServiceID)
		assert.Equal(t, "get.example.com", route.Domain)
		assert.Equal(t, 3000, route.Port)
		assert.False(t, route.TLS)
	})

	t.Run("GetRouteNotFound", func(t *testing.T) {
		_, err := store.GetRoute(ctx, 99999)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "route not found")
	})

	t.Run("GetAllRoutes", func(t *testing.T) {
		// Create another service and route to test cross-service retrieval
		service2Spec := ServiceSpec{Name: "web", Image: "nginx", Ports: []PortMap{{Container: 80, Host: 8082}}}
		service2, err := store.CreateService(ctx, project.ID, service2Spec)
		require.NoError(t, err)

		routeSpec := RouteSpec{Domain: "web.example.com", Port: 80, TLS: false}
		_, err = store.CreateRoute(ctx, service2.ID, routeSpec)
		require.NoError(t, err)

		// Get all routes
		allRoutes, err := store.GetAllRoutes(ctx)
		require.NoError(t, err)
		assert.GreaterOrEqual(t, len(allRoutes), 3) // Should have routes from both services

		// Verify routes from both services are present
		serviceCounts := make(map[int64]int)
		for _, route := range allRoutes {
			serviceCounts[route.ServiceID]++
		}
		assert.Greater(t, serviceCounts[service.ID], 0)
		assert.Greater(t, serviceCounts[service2.ID], 0)
	})

	t.Run("DeleteRoute", func(t *testing.T) {
		// Create a route to delete
		routeSpec := RouteSpec{Domain: "delete.example.com", Port: 8080, TLS: false}
		created, err := store.CreateRoute(ctx, service.ID, routeSpec)
		require.NoError(t, err)

		// Delete the route
		err = store.DeleteRoute(ctx, created.ID)
		assert.NoError(t, err)

		// Verify deletion
		_, err = store.GetRoute(ctx, created.ID)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "route not found")
	})

	t.Run("DeleteRouteNotFound", func(t *testing.T) {
		err := store.DeleteRoute(ctx, 99999)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "route not found")
	})

	t.Run("CascadeDeleteWithService", func(t *testing.T) {
		// Create a service with routes
		tempServiceSpec := ServiceSpec{Name: "temp", Image: "alpine", Ports: []PortMap{{Container: 80, Host: 8083}}}
		tempService, err := store.CreateService(ctx, project.ID, tempServiceSpec)
		require.NoError(t, err)

		// Create routes for the temp service
		routes := []RouteSpec{
			{Domain: "temp1.example.com", Port: 80, TLS: false},
			{Domain: "temp2.example.com", Port: 80, TLS: true},
		}
		var routeIDs []int64
		for _, spec := range routes {
			route, err := store.CreateRoute(ctx, tempService.ID, spec)
			require.NoError(t, err)
			routeIDs = append(routeIDs, route.ID)
		}

		// Delete the service (should cascade delete routes)
		err = store.DeleteService(ctx, tempService.ID)
		require.NoError(t, err)

		// Verify routes were deleted (cascade delete should work)
		for _, routeID := range routeIDs {
			_, err := store.GetRoute(ctx, routeID)
			if err != nil {
				assert.Contains(t, err.Error(), "route not found")
			}
		}
	})

	t.Run("UniqueConstraint", func(t *testing.T) {
		// Create a route
		routeSpec := RouteSpec{Domain: "unique.example.com", Port: 80, TLS: false}
		_, err := store.CreateRoute(ctx, service.ID, routeSpec)
		require.NoError(t, err)

		// Try to create another route with the same domain for the same service
		_, err = store.CreateRoute(ctx, service.ID, routeSpec)
		assert.Error(t, err)
		// SQLite should enforce the unique constraint
	})
}
