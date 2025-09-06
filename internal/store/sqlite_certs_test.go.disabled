package store

import (
	"context"
	"database/sql"
	"path/filepath"
	"testing"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCertCRUD(t *testing.T) {
	store, cleanup := setupTestStoreForCerts(t)
	defer cleanup()

	ctx := context.Background()

	// Test UpsertCert (create)
	domain := "example.com"
	email := "test@example.com"
	expiresAt := time.Now().Add(90 * 24 * time.Hour) // 90 days from now

	err := store.UpsertCert(ctx, domain, email, "issued", &expiresAt)
	require.NoError(t, err)

	// Test GetCert
	cert, err := store.GetCert(ctx, domain)
	require.NoError(t, err)
	assert.Equal(t, domain, cert.Domain)
	assert.Equal(t, email, cert.Email)
	assert.Equal(t, "issued", cert.Status)
	assert.NotNil(t, cert.LastIssuedAt)
	assert.NotNil(t, cert.ExpiresAt)
	assert.WithinDuration(t, expiresAt, *cert.ExpiresAt, time.Second)

	// Test UpsertCert (update)
	newExpiresAt := time.Now().Add(180 * 24 * time.Hour) // 180 days from now
	err = store.UpsertCert(ctx, domain, email, "renewed", &newExpiresAt)
	require.NoError(t, err)

	// Verify update
	updatedCert, err := store.GetCert(ctx, domain)
	require.NoError(t, err)
	assert.Equal(t, "renewed", updatedCert.Status)
	assert.WithinDuration(t, newExpiresAt, *updatedCert.ExpiresAt, time.Second)
	assert.Equal(t, cert.ID, updatedCert.ID) // Should be same ID
}

func TestGetCert_NotFound(t *testing.T) {
	store, cleanup := setupTestStoreForCerts(t)
	defer cleanup()

	ctx := context.Background()

	_, err := store.GetCert(ctx, "nonexistent.com")
	assert.Equal(t, ErrNotFound, err)
}

func TestListCerts(t *testing.T) {
	store, cleanup := setupTestStoreForCerts(t)
	defer cleanup()

	ctx := context.Background()

	// Create test certificates
	certs := []struct {
		domain string
		email  string
		status string
	}{
		{"example1.com", "test1@example.com", "issued"},
		{"example2.com", "test2@example.com", "failed"},
		{"example3.com", "test3@example.com", "renewing"},
	}

	for _, c := range certs {
		err := store.UpsertCert(ctx, c.domain, c.email, c.status, nil)
		require.NoError(t, err)
	}

	// Test ListCerts
	result, err := store.ListCerts(ctx)
	require.NoError(t, err)
	assert.Len(t, result, 3)

	// Verify certificates are sorted by domain
	assert.Equal(t, "example1.com", result[0].Domain)
	assert.Equal(t, "example2.com", result[1].Domain)
	assert.Equal(t, "example3.com", result[2].Domain)

	// Verify statuses
	assert.Equal(t, "issued", result[0].Status)
	assert.Equal(t, "failed", result[1].Status)
	assert.Equal(t, "renewing", result[2].Status)
}

func TestListCertsExpiringSoon(t *testing.T) {
	store, cleanup := setupTestStoreForCerts(t)
	defer cleanup()

	ctx := context.Background()
	now := time.Now()

	// Create certificates with different expiry times
	testCases := []struct {
		domain    string
		email     string
		expiresAt time.Time
		status    string
	}{
		{"expire-soon.com", "test1@example.com", now.Add(10 * 24 * time.Hour), "issued"},  // 10 days - should be included
		{"expire-later.com", "test2@example.com", now.Add(50 * 24 * time.Hour), "issued"}, // 50 days - should not be included
		{"no-expiry.com", "test3@example.com", time.Time{}, "queued"},                     // no expiry set
	}

	for _, tc := range testCases {
		var expiresAt *time.Time
		if !tc.expiresAt.IsZero() {
			expiresAt = &tc.expiresAt
		}
		err := store.UpsertCert(ctx, tc.domain, tc.email, tc.status, expiresAt)
		require.NoError(t, err)
	}

	// Test ListCertsExpiringSoon with 30 day threshold
	result, err := store.ListCertsExpiringSoon(ctx, 30*24*time.Hour)
	require.NoError(t, err)
	assert.Len(t, result, 1)
	assert.Equal(t, "expire-soon.com", result[0].Domain)
}

func TestListCertsExpiringSoon_Empty(t *testing.T) {
	store, cleanup := setupTestStoreForCerts(t)
	defer cleanup()

	ctx := context.Background()

	// Create certificate that expires far in the future
	futureExpiry := time.Now().Add(365 * 24 * time.Hour) // 1 year from now
	err := store.UpsertCert(ctx, "future.com", "test@example.com", "issued", &futureExpiry)
	require.NoError(t, err)

	// Test with 30 day threshold - should return empty
	result, err := store.ListCertsExpiringSoon(ctx, 30*24*time.Hour)
	require.NoError(t, err)
	assert.Empty(t, result)
}

func TestUpsertCert_StatusHandling(t *testing.T) {
	store, cleanup := setupTestStoreForCerts(t)
	defer cleanup()

	ctx := context.Background()
	domain := "test.com"
	email := "test@example.com"

	// Test queued status (no last_issued_at)
	err := store.UpsertCert(ctx, domain, email, "queued", nil)
	require.NoError(t, err)

	cert, err := store.GetCert(ctx, domain)
	require.NoError(t, err)
	assert.Equal(t, "queued", cert.Status)
	assert.Nil(t, cert.LastIssuedAt)

	// Test issued status (should set last_issued_at)
	expiresAt := time.Now().Add(90 * 24 * time.Hour)
	err = store.UpsertCert(ctx, domain, email, "issued", &expiresAt)
	require.NoError(t, err)

	cert, err = store.GetCert(ctx, domain)
	require.NoError(t, err)
	assert.Equal(t, "issued", cert.Status)
	assert.NotNil(t, cert.LastIssuedAt)
	assert.WithinDuration(t, time.Now(), *cert.LastIssuedAt, 5*time.Second)

	// Test failed status (should not update last_issued_at)
	previousIssuedAt := cert.LastIssuedAt
	err = store.UpsertCert(ctx, domain, email, "failed", nil)
	require.NoError(t, err)

	cert, err = store.GetCert(ctx, domain)
	require.NoError(t, err)
	assert.Equal(t, "failed", cert.Status)
	assert.Equal(t, previousIssuedAt, cert.LastIssuedAt) // Should remain unchanged
}

func TestCertConstraints(t *testing.T) {
	store, cleanup := setupTestStoreForCerts(t)
	defer cleanup()

	ctx := context.Background()
	domain := "test.com"
	email := "test@example.com"

	// Create first certificate
	err := store.UpsertCert(ctx, domain, email, "issued", nil)
	require.NoError(t, err)

	// Try to create duplicate - should update, not create new
	err = store.UpsertCert(ctx, domain, "updated@example.com", "renewed", nil)
	require.NoError(t, err)

	// Verify only one certificate exists with updated email
	certs, err := store.ListCerts(ctx)
	require.NoError(t, err)
	assert.Len(t, certs, 1)
	assert.Equal(t, "updated@example.com", certs[0].Email)
	assert.Equal(t, "renewed", certs[0].Status)
}

// setupTestStoreForCerts creates a test store with migrations applied for cert tests
func setupTestStoreForCerts(t *testing.T) (*Store, func()) {
	// Create temporary database file
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test_certs.db")

	db, err := sql.Open("sqlite3", dbPath)
	require.NoError(t, err)

	store := &Store{db: db}

	// Run migrations
	ctx := context.Background()
	err = store.Migrate(ctx)
	require.NoError(t, err)

	return store, func() {
		db.Close()
	}
}
