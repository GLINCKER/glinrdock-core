package license

import (
	"crypto/ed25519"
	"testing"
	"time"
)

func TestLicense_IsValid(t *testing.T) {
	tests := []struct {
		name    string
		license License
		wantErr bool
	}{
		{
			name: "valid license",
			license: License{
				Plan:     "PRO",
				Name:     "Test User",
				Expiry:   time.Now().Add(30 * 24 * time.Hour),
				IssuedAt: time.Now(),
				Nonce:    "test-nonce",
			},
			wantErr: false,
		},
		{
			name: "missing plan",
			license: License{
				Name:     "Test User",
				Expiry:   time.Now().Add(30 * 24 * time.Hour),
				IssuedAt: time.Now(),
				Nonce:    "test-nonce",
			},
			wantErr: true,
		},
		{
			name: "invalid plan",
			license: License{
				Plan:     "INVALID",
				Name:     "Test User",
				Expiry:   time.Now().Add(30 * 24 * time.Hour),
				IssuedAt: time.Now(),
				Nonce:    "test-nonce",
			},
			wantErr: true,
		},
		{
			name: "expired license",
			license: License{
				Plan:     "PRO",
				Name:     "Test User",
				Expiry:   time.Now().Add(-24 * time.Hour),
				IssuedAt: time.Now().Add(-48 * time.Hour),
				Nonce:    "test-nonce",
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.license.IsValid()
			if (err != nil) != tt.wantErr {
				t.Errorf("License.IsValid() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestLicense_HasFeature(t *testing.T) {
	license := License{
		Features: []string{"smtp", "multi_node"},
	}

	if !license.HasFeature("smtp") {
		t.Error("Expected license to have smtp feature")
	}

	if license.HasFeature("nonexistent") {
		t.Error("Expected license to not have nonexistent feature")
	}
}

func TestVerifyAndSign(t *testing.T) {
	// Generate a test key pair
	pubKey, privKey, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("Failed to generate key pair: %v", err)
	}

	// Create a test license
	license := &License{
		Plan:     "PRO",
		Name:     "Test User",
		Org:      "Test Org",
		Expiry:   time.Now().Add(30 * 24 * time.Hour),
		Features: []string{"smtp", "multi_node"},
		IssuedAt: time.Now(),
		Nonce:    "test-nonce-123",
	}

	// Sign the license
	signedData, err := Sign(license, privKey)
	if err != nil {
		t.Fatalf("Failed to sign license: %v", err)
	}

	// Verify the signed license
	verified, err := Verify(signedData, pubKey)
	if err != nil {
		t.Fatalf("Failed to verify license: %v", err)
	}

	// Check that the verified license matches the original
	if verified.Plan != license.Plan {
		t.Errorf("Plan mismatch: got %s, want %s", verified.Plan, license.Plan)
	}
	if verified.Name != license.Name {
		t.Errorf("Name mismatch: got %s, want %s", verified.Name, license.Name)
	}
	if verified.Org != license.Org {
		t.Errorf("Org mismatch: got %s, want %s", verified.Org, license.Org)
	}
	if verified.Nonce != license.Nonce {
		t.Errorf("Nonce mismatch: got %s, want %s", verified.Nonce, license.Nonce)
	}
}

func TestVerify_InvalidSignature(t *testing.T) {
	// Generate two different key pairs
	pubKey1, _, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("Failed to generate key pair 1: %v", err)
	}

	_, privKey2, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("Failed to generate key pair 2: %v", err)
	}

	// Create and sign license with privKey2
	license := &License{
		Plan:     "PRO",
		Name:     "Test User",
		Expiry:   time.Now().Add(30 * 24 * time.Hour),
		IssuedAt: time.Now(),
		Nonce:    "test-nonce",
	}

	signedData, err := Sign(license, privKey2)
	if err != nil {
		t.Fatalf("Failed to sign license: %v", err)
	}

	// Try to verify with pubKey1 (should fail)
	_, err = Verify(signedData, pubKey1)
	if err == nil {
		t.Error("Expected verification to fail with wrong public key")
	}
}

func TestVerify_MalformedData(t *testing.T) {
	pubKey, _, err := ed25519.GenerateKey(nil)
	if err != nil {
		t.Fatalf("Failed to generate key pair: %v", err)
	}

	tests := []struct {
		name string
		data []byte
	}{
		{"empty data", []byte{}},
		{"invalid json", []byte("not json")},
		{"missing signature", []byte(`{"license":"dGVzdA=="}`)},
		{"invalid base64 license", []byte(`{"license":"invalid base64","signature":"dGVzdA=="}`)},
		{"invalid base64 signature", []byte(`{"license":"dGVzdA==","signature":"invalid base64"}`)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Verify(tt.data, pubKey)
			if err == nil {
				t.Errorf("Expected verification to fail for %s", tt.name)
			}
		})
	}
}

func TestLicense_IsExpiringSoon(t *testing.T) {
	tests := []struct {
		name   string
		expiry time.Time
		want   bool
	}{
		{"expires in 31 days", time.Now().Add(31 * 24 * time.Hour), false},
		{"expires in 29 days", time.Now().Add(29 * 24 * time.Hour), true},
		{"expires in 1 day", time.Now().Add(24 * time.Hour), true},
		{"already expired", time.Now().Add(-24 * time.Hour), true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			license := License{
				Plan:     "PRO",
				Name:     "Test",
				Expiry:   tt.expiry,
				IssuedAt: time.Now().Add(-48 * time.Hour),
				Nonce:    "test",
			}
			if got := license.IsExpiringSoon(); got != tt.want {
				t.Errorf("License.IsExpiringSoon() = %v, want %v", got, tt.want)
			}
		})
	}
}
