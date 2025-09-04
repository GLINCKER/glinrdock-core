package store

import (
	"context"
	"path/filepath"
	"testing"
	"time"
)

func TestEnvVarOperations(t *testing.T) {
	// Create temporary store
	tmpDir := t.TempDir()
	store, err := Open(filepath.Join(tmpDir, "test.db"))
	if err != nil {
		t.Fatalf("Failed to open store: %v", err)
	}
	defer store.Close()

	// Run migrations
	ctx := context.Background()
	if err := store.Migrate(ctx); err != nil {
		t.Fatalf("Failed to migrate store: %v", err)
	}

	// Create a test project and service first
	project, err := store.CreateProject(ctx, "test-project")
	if err != nil {
		t.Fatalf("Failed to create test project: %v", err)
	}

	serviceSpec := ServiceSpec{
		Name:  "test-service",
		Image: "nginx:latest",
		Env:   make(map[string]string),
		Ports: []PortMap{},
	}

	service, err := store.CreateService(ctx, project.ID, serviceSpec)
	if err != nil {
		t.Fatalf("Failed to create test service: %v", err)
	}

	t.Run("SetPlainEnvVar", func(t *testing.T) {
		err := store.SetEnvVar(ctx, service.ID, "PLAIN_VAR", "plain_value", false, nil, nil)
		if err != nil {
			t.Fatalf("Failed to set plain env var: %v", err)
		}

		// Retrieve and verify
		envVar, err := store.GetEnvVar(ctx, service.ID, "PLAIN_VAR")
		if err != nil {
			t.Fatalf("Failed to get plain env var: %v", err)
		}

		if envVar.Key != "PLAIN_VAR" {
			t.Errorf("Expected key 'PLAIN_VAR', got %q", envVar.Key)
		}
		if envVar.Value != "plain_value" {
			t.Errorf("Expected value 'plain_value', got %q", envVar.Value)
		}
		if envVar.IsSecret {
			t.Error("Expected IsSecret to be false")
		}
		if len(envVar.Nonce) != 0 || len(envVar.Ciphertext) != 0 {
			t.Error("Expected empty nonce and ciphertext for plain var")
		}
	})

	t.Run("SetSecretEnvVar", func(t *testing.T) {
		nonce := make([]byte, 12)
		ciphertext := []byte("encrypted_data")
		
		err := store.SetEnvVar(ctx, service.ID, "SECRET_VAR", "", true, nonce, ciphertext)
		if err != nil {
			t.Fatalf("Failed to set secret env var: %v", err)
		}

		// Retrieve and verify
		envVar, err := store.GetEnvVar(ctx, service.ID, "SECRET_VAR")
		if err != nil {
			t.Fatalf("Failed to get secret env var: %v", err)
		}

		if envVar.Key != "SECRET_VAR" {
			t.Errorf("Expected key 'SECRET_VAR', got %q", envVar.Key)
		}
		if envVar.Value != "" {
			t.Errorf("Expected empty value for secret, got %q", envVar.Value)
		}
		if !envVar.IsSecret {
			t.Error("Expected IsSecret to be true")
		}
		if len(envVar.Nonce) != 12 {
			t.Errorf("Expected nonce length 12, got %d", len(envVar.Nonce))
		}
		if string(envVar.Ciphertext) != "encrypted_data" {
			t.Errorf("Expected ciphertext 'encrypted_data', got %q", envVar.Ciphertext)
		}
	})

	t.Run("ListEnvVars", func(t *testing.T) {
		envVars, err := store.ListEnvVars(ctx, service.ID)
		if err != nil {
			t.Fatalf("Failed to list env vars: %v", err)
		}

		if len(envVars) != 2 {
			t.Fatalf("Expected 2 env vars, got %d", len(envVars))
		}

		// Should be sorted by key
		if envVars[0].Key != "PLAIN_VAR" {
			t.Errorf("Expected first env var key to be 'PLAIN_VAR', got %q", envVars[0].Key)
		}
		if envVars[1].Key != "SECRET_VAR" {
			t.Errorf("Expected second env var key to be 'SECRET_VAR', got %q", envVars[1].Key)
		}
	})

	t.Run("UpdateEnvVar", func(t *testing.T) {
		// Update plain var
		err := store.SetEnvVar(ctx, service.ID, "PLAIN_VAR", "updated_value", false, nil, nil)
		if err != nil {
			t.Fatalf("Failed to update plain env var: %v", err)
		}

		envVar, err := store.GetEnvVar(ctx, service.ID, "PLAIN_VAR")
		if err != nil {
			t.Fatalf("Failed to get updated env var: %v", err)
		}

		if envVar.Value != "updated_value" {
			t.Errorf("Expected updated value 'updated_value', got %q", envVar.Value)
		}
	})

	t.Run("DeleteEnvVar", func(t *testing.T) {
		err := store.DeleteEnvVar(ctx, service.ID, "PLAIN_VAR")
		if err != nil {
			t.Fatalf("Failed to delete env var: %v", err)
		}

		// Verify it's deleted
		_, err = store.GetEnvVar(ctx, service.ID, "PLAIN_VAR")
		if err == nil {
			t.Error("Expected error when getting deleted env var")
		}

		// List should now only have 1
		envVars, err := store.ListEnvVars(ctx, service.ID)
		if err != nil {
			t.Fatalf("Failed to list env vars after delete: %v", err)
		}

		if len(envVars) != 1 {
			t.Errorf("Expected 1 env var after delete, got %d", len(envVars))
		}
	})

	t.Run("BulkSetEnvVars", func(t *testing.T) {
		updates := []EnvVarUpdate{
			{Key: "BULK_PLAIN1", Value: "value1", IsSecret: false},
			{Key: "BULK_PLAIN2", Value: "value2", IsSecret: false},
			{Key: "BULK_SECRET1", Value: "", IsSecret: true, Nonce: make([]byte, 12), Ciphertext: []byte("secret1")},
		}

		err := store.BulkSetEnvVars(ctx, service.ID, updates)
		if err != nil {
			t.Fatalf("Failed to bulk set env vars: %v", err)
		}

		// Verify all were created
		envVars, err := store.ListEnvVars(ctx, service.ID)
		if err != nil {
			t.Fatalf("Failed to list env vars after bulk set: %v", err)
		}

		// Should have original SECRET_VAR plus 3 new ones = 4 total
		if len(envVars) != 4 {
			t.Errorf("Expected 4 env vars after bulk set, got %d", len(envVars))
		}
	})

	t.Run("BulkDeleteEnvVars", func(t *testing.T) {
		keys := []string{"BULK_PLAIN1", "BULK_SECRET1"}
		
		err := store.BulkDeleteEnvVars(ctx, service.ID, keys)
		if err != nil {
			t.Fatalf("Failed to bulk delete env vars: %v", err)
		}

		// Verify they were deleted
		envVars, err := store.ListEnvVars(ctx, service.ID)
		if err != nil {
			t.Fatalf("Failed to list env vars after bulk delete: %v", err)
		}

		// Should have SECRET_VAR and BULK_PLAIN2 = 2 total
		if len(envVars) != 2 {
			t.Errorf("Expected 2 env vars after bulk delete, got %d", len(envVars))
		}
	})

	t.Run("ValidationErrors", func(t *testing.T) {
		// Test invalid service ID
		err := store.SetEnvVar(ctx, 99999, "TEST", "value", false, nil, nil)
		if err == nil {
			t.Error("Expected error for invalid service ID")
		}

		// Test empty key
		err = store.SetEnvVar(ctx, service.ID, "", "value", false, nil, nil)
		if err == nil {
			t.Error("Expected error for empty key")
		}

		// Test inconsistent secret data (secret=true but no nonce)
		err = store.SetEnvVar(ctx, service.ID, "BAD_SECRET", "value", true, nil, nil)
		if err == nil {
			t.Error("Expected error for secret with no nonce/ciphertext")
		}

		// Test inconsistent plain data (secret=false but has nonce)
		err = store.SetEnvVar(ctx, service.ID, "BAD_PLAIN", "value", false, make([]byte, 12), nil)
		if err == nil {
			t.Error("Expected error for plain var with nonce/ciphertext")
		}
	})

	t.Run("NonExistentVar", func(t *testing.T) {
		_, err := store.GetEnvVar(ctx, service.ID, "NONEXISTENT")
		if err == nil {
			t.Error("Expected error when getting non-existent var")
		}

		err = store.DeleteEnvVar(ctx, service.ID, "NONEXISTENT")
		if err == nil {
			t.Error("Expected error when deleting non-existent var")
		}
	})

	t.Run("TimestampFields", func(t *testing.T) {
		err := store.SetEnvVar(ctx, service.ID, "TIMESTAMP_TEST", "value", false, nil, nil)
		if err != nil {
			t.Fatalf("Failed to set timestamp test var: %v", err)
		}

		envVar, err := store.GetEnvVar(ctx, service.ID, "TIMESTAMP_TEST")
		if err != nil {
			t.Fatalf("Failed to get timestamp test var: %v", err)
		}

		// Check that timestamps are set (not zero)
		if envVar.CreatedAt.IsZero() {
			t.Error("CreatedAt should not be zero")
		}

		if envVar.UpdatedAt.IsZero() {
			t.Error("UpdatedAt should not be zero")
		}

		// Test update changes UpdatedAt
		time.Sleep(100 * time.Millisecond) // Sleep to ensure timestamp difference
		originalUpdatedAt := envVar.UpdatedAt
		
		err = store.SetEnvVar(ctx, service.ID, "TIMESTAMP_TEST", "updated_value", false, nil, nil)
		if err != nil {
			t.Fatalf("Failed to update timestamp test var: %v", err)
		}

		updatedVar, err := store.GetEnvVar(ctx, service.ID, "TIMESTAMP_TEST")
		if err != nil {
			t.Fatalf("Failed to get updated timestamp test var: %v", err)
		}

		// CreatedAt should be unchanged (allow 1 second tolerance for time zone differences)
		timeDiff := updatedVar.CreatedAt.Sub(envVar.CreatedAt)
		if timeDiff > time.Second || timeDiff < -time.Second {
			t.Errorf("CreatedAt changed significantly on update: original=%v, updated=%v, diff=%v", 
				envVar.CreatedAt, updatedVar.CreatedAt, timeDiff)
		}

		// UpdatedAt should be newer (with some tolerance)
		updateDiff := updatedVar.UpdatedAt.Sub(originalUpdatedAt)
		if updateDiff <= 0 {
			t.Errorf("UpdatedAt should be newer after update: original=%v, updated=%v", 
				originalUpdatedAt, updatedVar.UpdatedAt)
		}
	})
}