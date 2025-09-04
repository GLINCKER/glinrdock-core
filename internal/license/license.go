package license

import (
	"crypto/ed25519"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"time"
)

// License represents a GLINRDOCK license with plan limits and metadata
type License struct {
	Plan       string    `json:"plan"`         // FREE, PRO, PREMIUM
	Name       string    `json:"name"`         // Licensee name
	Org        string    `json:"org,omitempty"` // Organization name (optional)
	Seats      int       `json:"seats,omitempty"` // Number of seats (optional)
	Expiry     time.Time `json:"expiry"`       // License expiration
	Features   []string  `json:"features"`     // Feature flags
	IssuedAt   time.Time `json:"issued_at"`    // When license was issued
	Nonce      string    `json:"nonce"`        // Unique identifier
}

// SignedLicense represents the wire format of a signed license
type SignedLicense struct {
	License   string `json:"license"`   // Base64 encoded license JSON
	Signature string `json:"signature"` // Base64 encoded Ed25519 signature
}

// IsExpired checks if the license has expired
func (l *License) IsExpired() bool {
	return time.Now().After(l.Expiry)
}

// IsValid checks if the license is valid (not expired and has required fields)
func (l *License) IsValid() error {
	if l.Plan == "" {
		return fmt.Errorf("license plan is required")
	}
	if l.Plan != "FREE" && l.Plan != "PRO" && l.Plan != "PREMIUM" {
		return fmt.Errorf("invalid license plan: %s", l.Plan)
	}
	if l.Name == "" {
		return fmt.Errorf("license name is required")
	}
	if l.Nonce == "" {
		return fmt.Errorf("license nonce is required")
	}
	if l.IssuedAt.IsZero() {
		return fmt.Errorf("license issued_at is required")
	}
	if l.IsExpired() {
		return fmt.Errorf("license expired on %s", l.Expiry.Format("2006-01-02"))
	}
	return nil
}

// HasFeature checks if the license includes a specific feature
func (l *License) HasFeature(feature string) bool {
	for _, f := range l.Features {
		if f == feature {
			return true
		}
	}
	return false
}

// ExpiresIn returns the duration until the license expires
func (l *License) ExpiresIn() time.Duration {
	if l.IsExpired() {
		return 0
	}
	return l.Expiry.Sub(time.Now())
}

// IsExpiringSoon checks if the license expires within 30 days
func (l *License) IsExpiringSoon() bool {
	if l.IsExpired() {
		return true
	}
	return l.ExpiresIn() <= 30*24*time.Hour
}

// Verify verifies a signed license using Ed25519 public key
func Verify(licenseBytes []byte, pubKey []byte) (*License, error) {
	if len(licenseBytes) == 0 {
		return nil, fmt.Errorf("empty license data")
	}
	if len(pubKey) != ed25519.PublicKeySize {
		return nil, fmt.Errorf("invalid public key size: expected %d, got %d", ed25519.PublicKeySize, len(pubKey))
	}

	// Parse the signed license
	var signed SignedLicense
	if err := json.Unmarshal(licenseBytes, &signed); err != nil {
		return nil, fmt.Errorf("failed to parse signed license: %w", err)
	}

	// Decode the license data
	licenseData, err := base64.StdEncoding.DecodeString(signed.License)
	if err != nil {
		return nil, fmt.Errorf("failed to decode license data: %w", err)
	}

	// Decode the signature
	signature, err := base64.StdEncoding.DecodeString(signed.Signature)
	if err != nil {
		return nil, fmt.Errorf("failed to decode signature: %w", err)
	}

	// Verify the signature
	if !ed25519.Verify(pubKey, licenseData, signature) {
		return nil, fmt.Errorf("invalid license signature")
	}

	// Parse the license
	var license License
	if err := json.Unmarshal(licenseData, &license); err != nil {
		return nil, fmt.Errorf("failed to parse license: %w", err)
	}

	// Validate the license
	if err := license.IsValid(); err != nil {
		return nil, fmt.Errorf("invalid license: %w", err)
	}

	return &license, nil
}

// Sign creates a signed license (for testing/development)
func Sign(license *License, privKey ed25519.PrivateKey) ([]byte, error) {
	if err := license.IsValid(); err != nil {
		return nil, fmt.Errorf("invalid license: %w", err)
	}

	// Marshal the license
	licenseData, err := json.Marshal(license)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal license: %w", err)
	}

	// Sign the license data
	signature := ed25519.Sign(privKey, licenseData)

	// Create the signed license
	signed := SignedLicense{
		License:   base64.StdEncoding.EncodeToString(licenseData),
		Signature: base64.StdEncoding.EncodeToString(signature),
	}

	// Marshal the signed license
	signedData, err := json.Marshal(signed)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal signed license: %w", err)
	}

	return signedData, nil
}