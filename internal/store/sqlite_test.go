package store

import (
	"context"
	"database/sql"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"golang.org/x/crypto/bcrypt"
)

func setupTestStore(t *testing.T) *Store {
	// Use unique in-memory database for each test
	dsn := fmt.Sprintf("file:memdb%d_%s?mode=memory&cache=shared", time.Now().UnixNano(), t.Name())
	db, err := sql.Open("sqlite3", dsn)
	require.NoError(t, err)

	store := &Store{db: db}

	// Run migrations
	ctx := context.Background()
	err = store.Migrate(ctx)
	require.NoError(t, err)

	t.Cleanup(func() {
		store.Close()
	})

	return store
}

func TestMigrations(t *testing.T) {
	store := setupTestStore(t)
	ctx := context.Background()

	// Verify tables exist
	tables := []string{"tokens", "projects", "services", "routes", "service_links", "schema_version"}
	for _, table := range tables {
		var count int
		err := store.db.QueryRowContext(ctx,
			"SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name=?", table).Scan(&count)
		require.NoError(t, err)
		assert.Equal(t, 1, count, "table %s should exist", table)
	}

	// Verify schema version is recorded (should be latest migration version)
	var version int
	err := store.db.QueryRowContext(ctx, "SELECT MAX(version) FROM schema_version").Scan(&version)
	require.NoError(t, err)
	assert.Equal(t, 19, version) // Latest migration is 019_service_volumes.sql
}

func TestTokenOperations(t *testing.T) {
	ctx := context.Background()

	t.Run("CreateToken", func(t *testing.T) {
		store := setupTestStore(t)
		token, err := store.CreateToken(ctx, "test-token", "secret123", RoleAdmin)
		require.NoError(t, err)

		assert.Greater(t, token.ID, int64(0))
		assert.Equal(t, "test-token", token.Name)
		assert.NotEmpty(t, token.Hash)
		assert.NotEqual(t, "secret123", token.Hash) // Should be bcrypt hash

		// Verify bcrypt hash
		err = bcrypt.CompareHashAndPassword([]byte(token.Hash), []byte("secret123"))
		assert.NoError(t, err)
	})

	t.Run("CreateTokenValidation", func(t *testing.T) {
		store := setupTestStore(t)
		// Empty name
		_, err := store.CreateToken(ctx, "", "secret", RoleAdmin)
		assert.Error(t, err)

		// Name too long
		longName := string(make([]byte, 65))
		_, err = store.CreateToken(ctx, longName, "secret", RoleAdmin)
		assert.Error(t, err)
	})

	t.Run("ListTokens", func(t *testing.T) {
		store := setupTestStore(t)
		// Create multiple tokens
		_, err := store.CreateToken(ctx, "token1", "secret1", RoleViewer)
		require.NoError(t, err)
		_, err = store.CreateToken(ctx, "token2", "secret2", RoleDeployer)
		require.NoError(t, err)

		tokens, err := store.ListTokens(ctx)
		require.NoError(t, err)
		assert.Len(t, tokens, 2)

		// Verify hash is not included
		for _, token := range tokens {
			assert.Empty(t, token.Hash)
			assert.NotEmpty(t, token.Name)
		}
	})

	t.Run("DeleteToken", func(t *testing.T) {
		store := setupTestStore(t)
		_, err := store.CreateToken(ctx, "to-delete", "secret", RoleAdmin)
		require.NoError(t, err)

		err = store.DeleteTokenByName(ctx, "to-delete")
		assert.NoError(t, err)

		// Verify deletion
		err = store.DeleteTokenByName(ctx, "to-delete")
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not found")
	})

	t.Run("VerifyToken", func(t *testing.T) {
		store := setupTestStore(t)
		_, err := store.CreateToken(ctx, "verify-test", "mysecret", RoleAdmin)
		require.NoError(t, err)

		name, err := store.VerifyToken(ctx, "mysecret")
		assert.NoError(t, err)
		assert.Equal(t, "verify-test", name)

		// Wrong token
		_, err = store.VerifyToken(ctx, "wrongsecret")
		assert.Error(t, err)
	})

	t.Run("TouchToken", func(t *testing.T) {
		store := setupTestStore(t)
		_, err := store.CreateToken(ctx, "touch-test", "secret", RoleAdmin)
		require.NoError(t, err)

		err = store.TouchToken(ctx, "touch-test")
		assert.NoError(t, err)

		// Verify last_used_at is set
		token, err := store.GetTokenByName(ctx, "touch-test")
		require.NoError(t, err)
		assert.NotNil(t, token.LastUsedAt)
	})
}

func TestProjectOperations(t *testing.T) {
	ctx := context.Background()

	t.Run("CreateProject", func(t *testing.T) {
		store := setupTestStore(t)
		project, err := store.CreateProject(ctx, "test-project")
		require.NoError(t, err)

		assert.Greater(t, project.ID, int64(0))
		assert.Equal(t, "test-project", project.Name)
		assert.NotZero(t, project.CreatedAt)
	})

	t.Run("CreateProjectValidation", func(t *testing.T) {
		store := setupTestStore(t)
		// Empty name
		_, err := store.CreateProject(ctx, "")
		assert.Error(t, err)

		// Name too long
		longName := string(make([]byte, 65))
		_, err = store.CreateProject(ctx, longName)
		assert.Error(t, err)
	})

	t.Run("ListProjects", func(t *testing.T) {
		store := setupTestStore(t)
		_, err := store.CreateProject(ctx, "project1")
		require.NoError(t, err)
		_, err = store.CreateProject(ctx, "project2")
		require.NoError(t, err)

		projects, err := store.ListProjects(ctx)
		require.NoError(t, err)
		assert.Len(t, projects, 2)
	})

	t.Run("GetProject", func(t *testing.T) {
		store := setupTestStore(t)
		created, err := store.CreateProject(ctx, "get-test")
		require.NoError(t, err)

		project, err := store.GetProject(ctx, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.Name, project.Name)

		// Not found
		_, err = store.GetProject(ctx, 99999)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not found")
	})

	t.Run("DeleteProject", func(t *testing.T) {
		store := setupTestStore(t)
		created, err := store.CreateProject(ctx, "delete-test")
		require.NoError(t, err)

		err = store.DeleteProject(ctx, created.ID)
		assert.NoError(t, err)

		// Verify deletion
		_, err = store.GetProject(ctx, created.ID)
		assert.Error(t, err)
	})
}

func TestServiceOperations(t *testing.T) {
	ctx := context.Background()

	t.Run("CreateService", func(t *testing.T) {
		store := setupTestStore(t)

		// Create project first
		project, err := store.CreateProject(ctx, "test-project")
		require.NoError(t, err)

		spec := ServiceSpec{
			Name:  "web-api",
			Image: "nginx:alpine",
			Env:   map[string]string{"ENV": "test"},
			Ports: []PortMap{{Container: 80, Host: 8080}},
		}

		service, err := store.CreateService(ctx, project.ID, spec)
		require.NoError(t, err)

		assert.Greater(t, service.ID, int64(0))
		assert.Equal(t, project.ID, service.ProjectID)
		assert.Equal(t, "web-api", service.Name)
		assert.Equal(t, "nginx:alpine", service.Image)
		assert.Equal(t, map[string]string{"ENV": "test"}, service.Env)
		assert.Equal(t, []PortMap{{Container: 80, Host: 8080}}, service.Ports)
	})

	t.Run("ServiceNameValidation", func(t *testing.T) {
		store := setupTestStore(t)
		project, err := store.CreateProject(ctx, "test-project")
		require.NoError(t, err)

		// Invalid DNS label
		spec := ServiceSpec{Name: "Invalid_Name", Image: "nginx"}
		_, err = store.CreateService(ctx, project.ID, spec)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "DNS-label friendly")

		// Empty image
		spec = ServiceSpec{Name: "valid", Image: ""}
		_, err = store.CreateService(ctx, project.ID, spec)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "image cannot be empty")
	})

	t.Run("ListServices", func(t *testing.T) {
		store := setupTestStore(t)
		project, err := store.CreateProject(ctx, "test-project")
		require.NoError(t, err)

		// Create services
		spec1 := ServiceSpec{Name: "web", Image: "nginx"}
		spec2 := ServiceSpec{Name: "api", Image: "alpine"}

		_, err = store.CreateService(ctx, project.ID, spec1)
		require.NoError(t, err)
		_, err = store.CreateService(ctx, project.ID, spec2)
		require.NoError(t, err)

		services, err := store.ListServices(ctx, project.ID)
		require.NoError(t, err)
		assert.Len(t, services, 2)
	})

	t.Run("GetService", func(t *testing.T) {
		store := setupTestStore(t)
		project, err := store.CreateProject(ctx, "test-project")
		require.NoError(t, err)

		spec := ServiceSpec{Name: "test-service", Image: "nginx"}
		created, err := store.CreateService(ctx, project.ID, spec)
		require.NoError(t, err)

		service, err := store.GetService(ctx, created.ID)
		require.NoError(t, err)
		assert.Equal(t, created.Name, service.Name)
		assert.Equal(t, created.Image, service.Image)

		// Not found
		_, err = store.GetService(ctx, 99999)
		assert.Error(t, err)
		assert.Contains(t, err.Error(), "not found")
	})

	t.Run("DeleteService", func(t *testing.T) {
		store := setupTestStore(t)
		project, err := store.CreateProject(ctx, "test-project")
		require.NoError(t, err)

		spec := ServiceSpec{Name: "delete-me", Image: "nginx"}
		created, err := store.CreateService(ctx, project.ID, spec)
		require.NoError(t, err)

		err = store.DeleteService(ctx, created.ID)
		assert.NoError(t, err)

		// Verify deletion
		_, err = store.GetService(ctx, created.ID)
		assert.Error(t, err)
	})

	t.Run("JSONSerialization", func(t *testing.T) {
		store := setupTestStore(t)
		project, err := store.CreateProject(ctx, "test-project")
		require.NoError(t, err)

		spec := ServiceSpec{
			Name:  "complex-service",
			Image: "nginx:alpine",
			Env: map[string]string{
				"DATABASE_URL": "postgres://localhost/db",
				"DEBUG":        "true",
			},
			Ports: []PortMap{
				{Container: 80, Host: 8080},
				{Container: 443, Host: 8443},
			},
		}

		created, err := store.CreateService(ctx, project.ID, spec)
		require.NoError(t, err)

		// Retrieve and verify JSON fields are properly serialized/deserialized
		retrieved, err := store.GetService(ctx, created.ID)
		require.NoError(t, err)

		assert.Equal(t, spec.Env, retrieved.Env)
		assert.Equal(t, spec.Ports, retrieved.Ports)
	})
}

func TestServiceNetworking(t *testing.T) {
	ctx := context.Background()

	t.Run("GetServiceNetwork", func(t *testing.T) {
		store := setupTestStore(t)
		project, err := store.CreateProject(ctx, "test-project")
		require.NoError(t, err)

		spec := ServiceSpec{
			Name:  "web-api",
			Image: "nginx",
			Ports: []PortMap{
				{Container: 80, Host: 8080},
				{Container: 9090, Host: 0}, // Internal port only
			},
		}

		service, err := store.CreateService(ctx, project.ID, spec)
		require.NoError(t, err)

		network, err := store.GetServiceNetwork(ctx, service.ID)
		require.NoError(t, err)

		assert.Contains(t, network.Aliases, "web-api")
		assert.Equal(t, "glinr_default", network.ProjectNetwork)

		// Check internal ports
		assert.Len(t, network.PortsInternal, 2)
		expectedPorts := map[int]string{80: "tcp", 9090: "tcp"}
		for _, port := range network.PortsInternal {
			expectedProtocol, exists := expectedPorts[port.Container]
			assert.True(t, exists, "Port %d should be included", port.Container)
			assert.Equal(t, expectedProtocol, port.Protocol)
		}

		// Check hints
		assert.Contains(t, network.DNSHint, "svc-test-project-web-api:80")
		assert.Contains(t, network.CurlHint, "curl http://svc-test-project-web-api:80")
	})

	t.Run("GetServiceNetworkNotFound", func(t *testing.T) {
		store := setupTestStore(t)
		_, err := store.GetServiceNetwork(ctx, 999)
		assert.Error(t, err)
	})

	t.Run("CreateServiceLinks", func(t *testing.T) {
		store := setupTestStore(t)
		project, err := store.CreateProject(ctx, "test-project")
		require.NoError(t, err)

		// Create multiple services
		apiSpec := ServiceSpec{Name: "api", Image: "nginx"}
		api, err := store.CreateService(ctx, project.ID, apiSpec)
		require.NoError(t, err)

		dbSpec := ServiceSpec{Name: "database", Image: "postgres"}
		db, err := store.CreateService(ctx, project.ID, dbSpec)
		require.NoError(t, err)

		redisSpec := ServiceSpec{Name: "redis", Image: "redis"}
		redis, err := store.CreateService(ctx, project.ID, redisSpec)
		require.NoError(t, err)

		// Create links from API to database and redis
		targetIDs := []int64{db.ID, redis.ID}
		err = store.CreateServiceLinks(ctx, api.ID, targetIDs)
		require.NoError(t, err)

		// Verify links were created
		links, err := store.GetServiceLinks(ctx, api.ID)
		require.NoError(t, err)
		assert.Len(t, links, 2)

		// Check that links contain expected services
		linkMap := make(map[string]LinkedService)
		for _, link := range links {
			linkMap[link.Name] = link
		}

		dbLink, exists := linkMap["database"]
		assert.True(t, exists)
		assert.Equal(t, db.ID, dbLink.ID)
		assert.Equal(t, "svc-test-project-database", dbLink.Alias)

		redisLink, exists := linkMap["redis"]
		assert.True(t, exists)
		assert.Equal(t, redis.ID, redisLink.ID)
		assert.Equal(t, "svc-test-project-redis", redisLink.Alias)
	})

	t.Run("CreateServiceLinksReplaceExisting", func(t *testing.T) {
		store := setupTestStore(t)
		project, err := store.CreateProject(ctx, "test-project")
		require.NoError(t, err)

		// Create services
		apiSpec := ServiceSpec{Name: "api", Image: "nginx"}
		api, err := store.CreateService(ctx, project.ID, apiSpec)
		require.NoError(t, err)

		dbSpec := ServiceSpec{Name: "database", Image: "postgres"}
		db, err := store.CreateService(ctx, project.ID, dbSpec)
		require.NoError(t, err)

		redisSpec := ServiceSpec{Name: "redis", Image: "redis"}
		redis, err := store.CreateService(ctx, project.ID, redisSpec)
		require.NoError(t, err)

		// Create initial links
		err = store.CreateServiceLinks(ctx, api.ID, []int64{db.ID})
		require.NoError(t, err)

		// Replace with different links
		err = store.CreateServiceLinks(ctx, api.ID, []int64{redis.ID})
		require.NoError(t, err)

		// Verify only redis link exists
		links, err := store.GetServiceLinks(ctx, api.ID)
		require.NoError(t, err)
		assert.Len(t, links, 1)
		assert.Equal(t, "redis", links[0].Name)
	})

	t.Run("GetServiceLinksEmpty", func(t *testing.T) {
		store := setupTestStore(t)
		project, err := store.CreateProject(ctx, "test-project")
		require.NoError(t, err)

		spec := ServiceSpec{Name: "isolated", Image: "nginx"}
		service, err := store.CreateService(ctx, project.ID, spec)
		require.NoError(t, err)

		links, err := store.GetServiceLinks(ctx, service.ID)
		require.NoError(t, err)
		assert.Len(t, links, 0)
	})

	t.Run("CreateServiceLinksValidation", func(t *testing.T) {
		store := setupTestStore(t)
		project, err := store.CreateProject(ctx, "test-project")
		require.NoError(t, err)

		spec := ServiceSpec{Name: "api", Image: "nginx"}
		api, err := store.CreateService(ctx, project.ID, spec)
		require.NoError(t, err)

		// Test empty target IDs - should clear existing links
		err = store.CreateServiceLinks(ctx, api.ID, []int64{})
		require.NoError(t, err) // Should succeed and clear links

		// Test non-existent service as target should fail validation
		err = store.CreateServiceLinks(ctx, api.ID, []int64{999})
		assert.Error(t, err)
	})

	t.Run("ServiceLinksConstraints", func(t *testing.T) {
		store := setupTestStore(t)
		project, err := store.CreateProject(ctx, "test-project")
		require.NoError(t, err)

		api1Spec := ServiceSpec{Name: "api1", Image: "nginx"}
		api1, err := store.CreateService(ctx, project.ID, api1Spec)
		require.NoError(t, err)

		api2Spec := ServiceSpec{Name: "api2", Image: "nginx"}
		api2, err := store.CreateService(ctx, project.ID, api2Spec)
		require.NoError(t, err)

		// Create link
		err = store.CreateServiceLinks(ctx, api1.ID, []int64{api2.ID})
		require.NoError(t, err)

		// Delete target service - links should be cascade deleted
		err = store.DeleteService(ctx, api2.ID)
		require.NoError(t, err)

		// Verify links are gone
		links, err := store.GetServiceLinks(ctx, api1.ID)
		require.NoError(t, err)
		assert.Len(t, links, 0)
	})
}
