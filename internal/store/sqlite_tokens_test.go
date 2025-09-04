package store

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStore_CreateToken_WithRole(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()
	ctx := context.Background()

	// Test creating token with admin role
	token, err := store.CreateToken(ctx, "admin-token", "secret", RoleAdmin)
	require.NoError(t, err)
	assert.Equal(t, "admin-token", token.Name)
	assert.Equal(t, RoleAdmin, token.Role)
	assert.NotEmpty(t, token.Hash)

	// Test creating token with deployer role
	token, err = store.CreateToken(ctx, "deployer-token", "secret", RoleDeployer)
	require.NoError(t, err)
	assert.Equal(t, "deployer-token", token.Name)
	assert.Equal(t, RoleDeployer, token.Role)

	// Test creating token with viewer role
	token, err = store.CreateToken(ctx, "viewer-token", "secret", RoleViewer)
	require.NoError(t, err)
	assert.Equal(t, "viewer-token", token.Name)
	assert.Equal(t, RoleViewer, token.Role)

	// Test creating token with invalid role
	_, err = store.CreateToken(ctx, "bad-token", "secret", "invalid")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid role")
}

func TestStore_ListTokens_WithRoles(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()
	ctx := context.Background()

	// Create tokens with different roles
	_, err := store.CreateToken(ctx, "admin-token", "secret1", RoleAdmin)
	require.NoError(t, err)
	_, err = store.CreateToken(ctx, "deployer-token", "secret2", RoleDeployer)
	require.NoError(t, err)
	_, err = store.CreateToken(ctx, "viewer-token", "secret3", RoleViewer)
	require.NoError(t, err)

	// List all tokens
	tokens, err := store.ListTokens(ctx)
	require.NoError(t, err)
	require.Len(t, tokens, 3)

	// Check roles are included
	roleMap := make(map[string]string)
	for _, token := range tokens {
		roleMap[token.Name] = token.Role
	}

	assert.Equal(t, RoleAdmin, roleMap["admin-token"])
	assert.Equal(t, RoleDeployer, roleMap["deployer-token"])
	assert.Equal(t, RoleViewer, roleMap["viewer-token"])
}

func TestStore_GetTokenByName_WithRole(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()
	ctx := context.Background()

	// Create token with specific role
	_, err := store.CreateToken(ctx, "test-token", "secret", RoleDeployer)
	require.NoError(t, err)

	// Get token by name
	token, err := store.GetTokenByName(ctx, "test-token")
	require.NoError(t, err)
	assert.Equal(t, "test-token", token.Name)
	assert.Equal(t, RoleDeployer, token.Role)
	assert.NotEmpty(t, token.Hash)

	// Test getting non-existent token
	_, err = store.GetTokenByName(ctx, "non-existent")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "token not found")
}

func TestIsRoleValid(t *testing.T) {
	tests := []struct {
		role  string
		valid bool
	}{
		{RoleAdmin, true},
		{RoleDeployer, true},
		{RoleViewer, true},
		{"invalid", false},
		{"", false},
		{"ADMIN", false}, // Case sensitive
		{"admin ", false}, // No spaces
	}

	for _, test := range tests {
		t.Run(test.role, func(t *testing.T) {
			assert.Equal(t, test.valid, IsRoleValid(test.role))
		})
	}
}

func TestCanAccessResource(t *testing.T) {
	tests := []struct {
		userRole   string
		targetRole string
		canAccess  bool
		desc       string
	}{
		// Admin can access all
		{RoleAdmin, RoleAdmin, true, "admin accessing admin"},
		{RoleAdmin, RoleDeployer, true, "admin accessing deployer"},
		{RoleAdmin, RoleViewer, true, "admin accessing viewer"},
		
		// Deployer can access deployer and viewer
		{RoleDeployer, RoleAdmin, false, "deployer accessing admin"},
		{RoleDeployer, RoleDeployer, true, "deployer accessing deployer"},
		{RoleDeployer, RoleViewer, true, "deployer accessing viewer"},
		
		// Viewer can only access viewer
		{RoleViewer, RoleAdmin, false, "viewer accessing admin"},
		{RoleViewer, RoleDeployer, false, "viewer accessing deployer"},
		{RoleViewer, RoleViewer, true, "viewer accessing viewer"},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			assert.Equal(t, test.canAccess, CanAccessResource(test.userRole, test.targetRole))
		})
	}
}

func TestCanCreateRole(t *testing.T) {
	tests := []struct {
		userRole   string
		targetRole string
		canCreate  bool
		desc       string
	}{
		// Admin can create any valid role
		{RoleAdmin, RoleAdmin, true, "admin creating admin"},
		{RoleAdmin, RoleDeployer, true, "admin creating deployer"},
		{RoleAdmin, RoleViewer, true, "admin creating viewer"},
		{RoleAdmin, "invalid", false, "admin creating invalid role"},
		
		// Non-admin cannot create tokens
		{RoleDeployer, RoleAdmin, false, "deployer creating admin"},
		{RoleDeployer, RoleDeployer, false, "deployer creating deployer"},
		{RoleDeployer, RoleViewer, false, "deployer creating viewer"},
		
		{RoleViewer, RoleAdmin, false, "viewer creating admin"},
		{RoleViewer, RoleDeployer, false, "viewer creating deployer"},
		{RoleViewer, RoleViewer, false, "viewer creating viewer"},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			assert.Equal(t, test.canCreate, CanCreateRole(test.userRole, test.targetRole))
		})
	}
}