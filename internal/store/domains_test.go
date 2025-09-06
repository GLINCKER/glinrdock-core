package store

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStore_CreateDomain(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()
	ctx := context.Background()

	// Test creating a domain with minimal fields
	domain := &Domain{
		Name: "example.com",
	}

	id, err := store.CreateDomain(ctx, domain)
	require.NoError(t, err)
	assert.Greater(t, id, int64(0))
	assert.NotEmpty(t, domain.VerificationToken)
	assert.Equal(t, DomainStatusPending, domain.Status)

	// Test creating domain with all fields
	domain2 := &Domain{
		Name:              "test.com",
		Status:            DomainStatusVerified,
		Provider:          stringPtr("cloudflare"),
		ZoneID:            stringPtr("abc123"),
		VerificationToken: "custom-token",
	}

	id2, err := store.CreateDomain(ctx, domain2)
	require.NoError(t, err)
	assert.Greater(t, id2, int64(0))
	assert.NotEqual(t, id, id2)

	// Test creating duplicate domain (should fail)
	duplicate := &Domain{
		Name: "example.com",
	}
	_, err = store.CreateDomain(ctx, duplicate)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "already exists")
}

func TestStore_CreateDomain_InvalidInput(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()
	ctx := context.Background()

	// Test creating domain with empty name
	domain := &Domain{
		Name: "",
	}

	_, err := store.CreateDomain(ctx, domain)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "domain name cannot be empty")
}

func TestStore_GetDomainByName(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()
	ctx := context.Background()

	// Create a test domain
	domain := &Domain{
		Name:     "example.com",
		Status:   DomainStatusVerified,
		Provider: stringPtr("cloudflare"),
		ZoneID:   stringPtr("zone123"),
	}

	id, err := store.CreateDomain(ctx, domain)
	require.NoError(t, err)

	// Test retrieving the domain
	retrieved, err := store.GetDomainByName(ctx, "example.com")
	require.NoError(t, err)
	assert.Equal(t, id, retrieved.ID)
	assert.Equal(t, "example.com", retrieved.Name)
	assert.Equal(t, DomainStatusVerified, retrieved.Status)
	assert.NotNil(t, retrieved.Provider)
	assert.Equal(t, "cloudflare", *retrieved.Provider)
	assert.NotNil(t, retrieved.ZoneID)
	assert.Equal(t, "zone123", *retrieved.ZoneID)
	assert.NotEmpty(t, retrieved.VerificationToken)
	assert.NotZero(t, retrieved.CreatedAt)
	assert.NotZero(t, retrieved.UpdatedAt)

	// Test retrieving non-existent domain
	_, err = store.GetDomainByName(ctx, "nonexistent.com")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "domain not found")
}

func TestStore_ListDomains(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()
	ctx := context.Background()

	// Create test domains with different statuses
	domains := []*Domain{
		{Name: "pending.com", Status: DomainStatusPending},
		{Name: "verifying.com", Status: DomainStatusVerifying},
		{Name: "verified.com", Status: DomainStatusVerified},
		{Name: "active.com", Status: DomainStatusActive},
		{Name: "error.com", Status: DomainStatusError},
	}

	var createdIDs []int64
	for _, domain := range domains {
		id, err := store.CreateDomain(ctx, domain)
		require.NoError(t, err)
		createdIDs = append(createdIDs, id)
	}

	// Test listing all domains
	allDomains, err := store.ListDomains(ctx, nil)
	require.NoError(t, err)
	assert.Len(t, allDomains, 5)

	// Verify domains are sorted by created_at DESC (at least check all domains are returned)
	var domainNames []string
	for _, domain := range allDomains {
		domainNames = append(domainNames, domain.Name)
	}
	assert.Contains(t, domainNames, "pending.com")
	assert.Contains(t, domainNames, "error.com")

	// Test filtering by single status
	pendingDomains, err := store.ListDomains(ctx, []string{DomainStatusPending})
	require.NoError(t, err)
	assert.Len(t, pendingDomains, 1)
	assert.Equal(t, "pending.com", pendingDomains[0].Name)
	assert.Equal(t, DomainStatusPending, pendingDomains[0].Status)

	// Test filtering by multiple statuses
	activeDomains, err := store.ListDomains(ctx, []string{DomainStatusActive, DomainStatusVerified})
	require.NoError(t, err)
	assert.Len(t, activeDomains, 2)

	// Verify both domains are returned
	names := []string{activeDomains[0].Name, activeDomains[1].Name}
	assert.Contains(t, names, "active.com")
	assert.Contains(t, names, "verified.com")

	// Test filtering by non-existent status
	nonExistent, err := store.ListDomains(ctx, []string{"nonexistent"})
	require.NoError(t, err)
	assert.Len(t, nonExistent, 0)
}

func TestStore_UpdateDomainStatus(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()
	ctx := context.Background()

	// Create a test domain
	domain := &Domain{
		Name:   "example.com",
		Status: DomainStatusPending,
	}

	id, err := store.CreateDomain(ctx, domain)
	require.NoError(t, err)

	// Test updating status without certificate ID
	err = store.UpdateDomainStatus(ctx, id, DomainStatusVerified, nil)
	require.NoError(t, err)

	// Verify the update
	updated, err := store.GetDomainByName(ctx, "example.com")
	require.NoError(t, err)
	assert.Equal(t, DomainStatusVerified, updated.Status)
	assert.Nil(t, updated.CertificateID)

	// Test updating status with certificate ID
	certID := int64(123)
	err = store.UpdateDomainStatus(ctx, id, DomainStatusActive, &certID)
	require.NoError(t, err)

	// Verify the update
	updated, err = store.GetDomainByName(ctx, "example.com")
	require.NoError(t, err)
	assert.Equal(t, DomainStatusActive, updated.Status)
	assert.NotNil(t, updated.CertificateID)
	assert.Equal(t, certID, *updated.CertificateID)

	// Test updating with invalid status
	err = store.UpdateDomainStatus(ctx, id, "invalid-status", nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid domain status")

	// Test updating non-existent domain
	err = store.UpdateDomainStatus(ctx, 999999, DomainStatusActive, nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "domain not found")
}

func TestStore_Domain_UniqueConstraint(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()
	ctx := context.Background()

	// Create first domain
	domain1 := &Domain{
		Name: "unique.com",
	}

	_, err := store.CreateDomain(ctx, domain1)
	require.NoError(t, err)

	// Try to create duplicate domain
	domain2 := &Domain{
		Name: "unique.com", // Same name
	}

	_, err = store.CreateDomain(ctx, domain2)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "already exists")

	// Verify only one domain exists
	domains, err := store.ListDomains(ctx, nil)
	require.NoError(t, err)
	assert.Len(t, domains, 1)
}

func TestStore_Domain_TimestampsUpdate(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()
	ctx := context.Background()

	// Create a domain
	domain := &Domain{
		Name: "timestamps.com",
	}

	id, err := store.CreateDomain(ctx, domain)
	require.NoError(t, err)

	// Get initial timestamps
	initial, err := store.GetDomainByName(ctx, "timestamps.com")
	require.NoError(t, err)
	initialCreated := initial.CreatedAt
	initialUpdated := initial.UpdatedAt

	// Update the domain status
	err = store.UpdateDomainStatus(ctx, id, DomainStatusVerified, nil)
	require.NoError(t, err)

	// Get updated timestamps
	updated, err := store.GetDomainByName(ctx, "timestamps.com")
	require.NoError(t, err)

	// Verify created_at stays the same, updated_at changes
	assert.Equal(t, initialCreated, updated.CreatedAt)
	assert.True(t, updated.UpdatedAt.After(initialUpdated) || updated.UpdatedAt.Equal(initialUpdated))
}
