package store

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestStore_CreateCertificate(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()
	ctx := context.Background()

	certData := "-----BEGIN CERTIFICATE-----\nMIIC..."
	keyData := "-----BEGIN PRIVATE KEY-----\nMIIE..."

	// Test creating certificate with required fields
	spec := CertificateSpec{
		Domain:   "example.com",
		Type:     "uploaded",
		CertData: &certData,
		KeyData:  &keyData,
	}
	cert, err := store.CreateCertificate(ctx, spec)
	require.NoError(t, err)
	assert.Equal(t, "example.com", cert.Domain)
	assert.Equal(t, "uploaded", cert.Type)
	assert.Equal(t, certData, *cert.CertData)
	assert.Equal(t, keyData, *cert.KeyData)
	assert.True(t, cert.AutoRenew) // Default should be true
	assert.Greater(t, cert.ID, int64(0))
	assert.NotZero(t, cert.CreatedAt)
	assert.NotZero(t, cert.UpdatedAt)

	// Test creating certificate with auto_renew set to false
	falseVal := false
	spec2 := CertificateSpec{
		Domain:    "test.example.com",
		Type:      "letsencrypt",
		AutoRenew: &falseVal,
	}
	cert2, err := store.CreateCertificate(ctx, spec2)
	require.NoError(t, err)
	assert.False(t, cert2.AutoRenew)

	// Test validation - empty domain
	spec3 := CertificateSpec{
		Type: "uploaded",
	}
	_, err = store.CreateCertificate(ctx, spec3)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "domain cannot be empty")

	// Test validation - domain too long
	longDomain := string(make([]byte, 254)) // 254 characters
	spec4 := CertificateSpec{
		Domain: longDomain,
		Type:   "uploaded",
	}
	_, err = store.CreateCertificate(ctx, spec4)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "domain too long")
}

func TestStore_GetCertificate(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()
	ctx := context.Background()

	// Create certificate first
	certData := "-----BEGIN CERTIFICATE-----\nMIIC..."
	spec := CertificateSpec{
		Domain:   "example.com",
		Type:     "uploaded",
		CertData: &certData,
	}
	created, err := store.CreateCertificate(ctx, spec)
	require.NoError(t, err)

	// Test GetCertificate by ID
	cert, err := store.GetCertificate(ctx, created.ID)
	require.NoError(t, err)
	assert.Equal(t, created.ID, cert.ID)
	assert.Equal(t, "example.com", cert.Domain)
	assert.Equal(t, "uploaded", cert.Type)
	assert.Equal(t, certData, *cert.CertData)

	// Test GetCertificate with non-existent ID
	_, err = store.GetCertificate(ctx, 99999)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "certificate not found")
}

func TestStore_GetCertificateByDomain(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()
	ctx := context.Background()

	// Create certificate first
	spec := CertificateSpec{
		Domain: "example.com",
		Type:   "letsencrypt",
	}
	created, err := store.CreateCertificate(ctx, spec)
	require.NoError(t, err)

	// Test GetCertificateByDomain
	cert, err := store.GetCertificateByDomain(ctx, "example.com")
	require.NoError(t, err)
	assert.Equal(t, created.ID, cert.ID)
	assert.Equal(t, "example.com", cert.Domain)
	assert.Equal(t, "letsencrypt", cert.Type)

	// Test GetCertificateByDomain with non-existent domain
	_, err = store.GetCertificateByDomain(ctx, "nonexistent.com")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "certificate not found for domain")
}

func TestStore_ListCertificates(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()
	ctx := context.Background()

	// Initially should be empty
	certs, err := store.ListCertificates(ctx)
	require.NoError(t, err)
	assert.Empty(t, certs)

	// Create multiple certificates
	domains := []string{"a.example.com", "z.example.com", "m.example.com"}
	for _, domain := range domains {
		spec := CertificateSpec{
			Domain: domain,
			Type:   "uploaded",
		}
		_, err := store.CreateCertificate(ctx, spec)
		require.NoError(t, err)
	}

	// List certificates - should be ordered by domain
	certs, err = store.ListCertificates(ctx)
	require.NoError(t, err)
	assert.Len(t, certs, 3)
	assert.Equal(t, "a.example.com", certs[0].Domain)
	assert.Equal(t, "m.example.com", certs[1].Domain) 
	assert.Equal(t, "z.example.com", certs[2].Domain)

	// Verify all fields are populated
	for _, cert := range certs {
		assert.Greater(t, cert.ID, int64(0))
		assert.NotEmpty(t, cert.Domain)
		assert.Equal(t, "uploaded", cert.Type)
		assert.NotZero(t, cert.CreatedAt)
		assert.NotZero(t, cert.UpdatedAt)
	}
}

func TestStore_UpdateCertificate(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()
	ctx := context.Background()

	// Create certificate first
	originalCertData := "-----BEGIN CERTIFICATE-----\nORIGINAL..."
	originalKeyData := "-----BEGIN PRIVATE KEY-----\nORIGINAL..."
	spec := CertificateSpec{
		Domain:   "example.com",
		Type:     "uploaded",
		CertData: &originalCertData,
		KeyData:  &originalKeyData,
	}
	created, err := store.CreateCertificate(ctx, spec)
	require.NoError(t, err)

	// Update the certificate
	updatedCertData := "-----BEGIN CERTIFICATE-----\nUPDATED..."
	updatedKeyData := "-----BEGIN PRIVATE KEY-----\nUPDATED..."
	falseVal := false
	updateSpec := CertificateSpec{
		Domain:    "updated.example.com",
		Type:      "letsencrypt",
		CertData:  &updatedCertData,
		KeyData:   &updatedKeyData,
		AutoRenew: &falseVal,
	}

	updated, err := store.UpdateCertificate(ctx, created.ID, updateSpec)
	require.NoError(t, err)
	assert.Equal(t, created.ID, updated.ID)
	assert.Equal(t, "updated.example.com", updated.Domain)
	assert.Equal(t, "letsencrypt", updated.Type)
	assert.Equal(t, updatedCertData, *updated.CertData)
	assert.Equal(t, updatedKeyData, *updated.KeyData)
	assert.False(t, updated.AutoRenew)
	assert.Equal(t, created.CreatedAt, updated.CreatedAt) // CreatedAt should not change
	// UpdatedAt should be equal or after (SQLite CURRENT_TIMESTAMP might be the same)
	assert.True(t, updated.UpdatedAt.After(created.UpdatedAt) || updated.UpdatedAt.Equal(created.UpdatedAt))

	// Test updating non-existent certificate
	_, err = store.UpdateCertificate(ctx, 99999, updateSpec)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "certificate not found")

	// Test validation on update
	invalidSpec := CertificateSpec{
		Domain: "", // Empty domain
		Type:   "uploaded",
	}
	_, err = store.UpdateCertificate(ctx, created.ID, invalidSpec)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "domain cannot be empty")
}

func TestStore_DeleteCertificate(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()
	ctx := context.Background()

	// Create certificate first
	spec := CertificateSpec{
		Domain: "example.com",
		Type:   "uploaded",
	}
	created, err := store.CreateCertificate(ctx, spec)
	require.NoError(t, err)

	// Verify certificate exists
	_, err = store.GetCertificate(ctx, created.ID)
	require.NoError(t, err)

	// Delete certificate
	err = store.DeleteCertificate(ctx, created.ID)
	require.NoError(t, err)

	// Verify certificate no longer exists
	_, err = store.GetCertificate(ctx, created.ID)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "certificate not found")

	// Test deleting non-existent certificate
	err = store.DeleteCertificate(ctx, 99999)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "certificate not found")
}

func TestStore_CertificateIntegration(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()
	ctx := context.Background()

	// Test complete CRUD lifecycle
	certData := "-----BEGIN CERTIFICATE-----\nTEST..."
	keyData := "-----BEGIN PRIVATE KEY-----\nTEST..."

	// Create
	spec := CertificateSpec{
		Domain:   "test.example.com",
		Type:     "uploaded",
		CertData: &certData,
		KeyData:  &keyData,
	}
	cert, err := store.CreateCertificate(ctx, spec)
	require.NoError(t, err)
	originalID := cert.ID

	// Read by ID
	cert, err = store.GetCertificate(ctx, originalID)
	require.NoError(t, err)
	assert.Equal(t, "test.example.com", cert.Domain)

	// Read by Domain
	cert, err = store.GetCertificateByDomain(ctx, "test.example.com")
	require.NoError(t, err)
	assert.Equal(t, originalID, cert.ID)

	// List
	certs, err := store.ListCertificates(ctx)
	require.NoError(t, err)
	assert.Len(t, certs, 1)
	assert.Equal(t, originalID, certs[0].ID)

	// Update
	falseVal := false
	updateSpec := CertificateSpec{
		Domain:    "updated.test.example.com",
		Type:      "letsencrypt",
		AutoRenew: &falseVal,
	}
	cert, err = store.UpdateCertificate(ctx, originalID, updateSpec)
	require.NoError(t, err)
	assert.Equal(t, "updated.test.example.com", cert.Domain)
	assert.Equal(t, "letsencrypt", cert.Type)
	assert.False(t, cert.AutoRenew)

	// Verify update reflected in domain lookup
	_, err = store.GetCertificateByDomain(ctx, "test.example.com")
	assert.Error(t, err) // Old domain should not exist

	cert, err = store.GetCertificateByDomain(ctx, "updated.test.example.com")
	require.NoError(t, err)
	assert.Equal(t, originalID, cert.ID)

	// Delete
	err = store.DeleteCertificate(ctx, originalID)
	require.NoError(t, err)

	// Verify delete
	certs, err = store.ListCertificates(ctx)
	require.NoError(t, err)
	assert.Empty(t, certs)
}

func TestStore_CertificateWithNullableFields(t *testing.T) {
	store := setupTestStore(t)
	defer store.Close()
	ctx := context.Background()

	// Test certificate with nil CertData and KeyData (like letsencrypt before provisioned)
	spec := CertificateSpec{
		Domain: "letsencrypt.example.com",
		Type:   "letsencrypt",
		// CertData and KeyData are nil
	}
	cert, err := store.CreateCertificate(ctx, spec)
	require.NoError(t, err)
	assert.Nil(t, cert.CertData)
	assert.Nil(t, cert.KeyData)
	assert.Nil(t, cert.ExpiresAt) // Should be nil until certificate is provisioned

	// Later update with actual certificate data
	certData := "-----BEGIN CERTIFICATE-----\nLETSENCRYPT..."
	keyData := "-----BEGIN PRIVATE KEY-----\nLETSENCRYPT..."

	// Note: We can't update ExpiresAt through the API since it's not in CertificateSpec,
	// but we can verify the cert_data and key_data are properly handled
	updateSpec := CertificateSpec{
		Domain:   "letsencrypt.example.com",
		Type:     "letsencrypt",
		CertData: &certData,
		KeyData:  &keyData,
	}
	updated, err := store.UpdateCertificate(ctx, cert.ID, updateSpec)
	require.NoError(t, err)
	assert.Equal(t, certData, *updated.CertData)
	assert.Equal(t, keyData, *updated.KeyData)
}