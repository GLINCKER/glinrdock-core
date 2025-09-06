package domains

import (
	"context"
	"database/sql"
	"net"
	"testing"
	"time"

	"github.com/GLINCKER/glinrdock/internal/util"
	_ "github.com/mattn/go-sqlite3"
)

// MockResolver implements dns.Resolver for testing
type MockResolver struct {
	ARecords     map[string][]net.IP
	AAAARecords  map[string][]net.IP
	CNAMERecords map[string]string
	TXTRecords   map[string][]string
	Errors       map[string]error
}

func NewMockResolver() *MockResolver {
	return &MockResolver{
		ARecords:     make(map[string][]net.IP),
		AAAARecords:  make(map[string][]net.IP),
		CNAMERecords: make(map[string]string),
		TXTRecords:   make(map[string][]string),
		Errors:       make(map[string]error),
	}
}

func (m *MockResolver) LookupA(ctx context.Context, name string) ([]net.IP, error) {
	if err, exists := m.Errors[name]; exists {
		return nil, err
	}
	if ips, exists := m.ARecords[name]; exists {
		return ips, nil
	}
	return []net.IP{}, nil
}

func (m *MockResolver) LookupAAAA(ctx context.Context, name string) ([]net.IP, error) {
	if err, exists := m.Errors[name]; exists {
		return nil, err
	}
	if ips, exists := m.AAAARecords[name]; exists {
		return ips, nil
	}
	return []net.IP{}, nil
}

func (m *MockResolver) LookupCNAME(ctx context.Context, name string) (string, error) {
	if err, exists := m.Errors[name]; exists {
		return "", err
	}
	if cname, exists := m.CNAMERecords[name]; exists {
		return cname, nil
	}
	return "", nil
}

func (m *MockResolver) LookupTXT(ctx context.Context, name string) ([]string, error) {
	if err, exists := m.Errors[name]; exists {
		return nil, err
	}
	if txt, exists := m.TXTRecords[name]; exists {
		return txt, nil
	}
	return []string{}, nil
}

// setupTestDB creates an in-memory SQLite database for testing
func setupTestDB(t *testing.T) *sql.DB {
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatalf("Failed to create test database: %v", err)
	}

	// Create required tables
	schemas := []string{
		`CREATE TABLE domains (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			domain TEXT UNIQUE NOT NULL,
			provider_id INTEGER,
			auto_manage BOOLEAN DEFAULT false,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL
		)`,
		`CREATE TABLE domain_verifications (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			domain_id INTEGER NOT NULL,
			method TEXT NOT NULL,
			challenge TEXT NOT NULL,
			status TEXT NOT NULL DEFAULT 'pending',
			last_checked_at DATETIME,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			FOREIGN KEY (domain_id) REFERENCES domains(id)
		)`,
		`CREATE TABLE dns_providers (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			type TEXT NOT NULL,
			config_json TEXT NOT NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL
		)`,
	}

	for _, schema := range schemas {
		if _, err := db.Exec(schema); err != nil {
			t.Fatalf("Failed to create schema: %v", err)
		}
	}

	return db
}

func TestVerificationService_IssueVerification(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	tests := []struct {
		name           string
		config         *util.Config
		domain         string
		expectedMethod string
		expectedError  bool
		expectedCode   int
	}{
		{
			name: "verification disabled",
			config: &util.Config{
				DNSVerifyEnabled: false,
			},
			domain:        "example.com",
			expectedError: true,
			expectedCode:  501,
		},
		{
			name: "TXT only verification",
			config: &util.Config{
				DNSVerifyEnabled: true,
			},
			domain:         "example.com",
			expectedMethod: "TXT",
			expectedError:  false,
		},
		{
			name: "CNAME verification with hostname",
			config: &util.Config{
				DNSVerifyEnabled: true,
				PublicEdgeHost:   "edge.example.com",
			},
			domain:         "test.example.com",
			expectedMethod: "CNAME",
			expectedError:  false,
		},
		{
			name: "A record verification with IPv4",
			config: &util.Config{
				DNSVerifyEnabled: true,
				PublicEdgeIPv4:   "203.0.113.1",
			},
			domain:         "test.example.com",
			expectedMethod: "A",
			expectedError:  false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resolver := NewMockResolver()
			service := NewVerificationService(db, tt.config, resolver)

			ctx := context.Background()
			result, err := service.IssueVerification(ctx, tt.domain)

			if tt.expectedError {
				if err == nil {
					t.Fatal("Expected error, got nil")
				}

				verErr, ok := err.(*VerificationError)
				if !ok {
					t.Fatalf("Expected VerificationError, got %T", err)
				}

				if verErr.Code != tt.expectedCode {
					t.Errorf("Expected error code %d, got %d", tt.expectedCode, verErr.Code)
				}
				return
			}

			if err != nil {
				t.Fatalf("Unexpected error: %v", err)
			}

			if result.Domain != tt.domain {
				t.Errorf("Expected domain %s, got %s", tt.domain, result.Domain)
			}

			if result.Method != tt.expectedMethod {
				t.Errorf("Expected method %s, got %s", tt.expectedMethod, result.Method)
			}

			if result.Status != "pending" {
				t.Errorf("Expected status 'pending', got %s", result.Status)
			}

			if len(result.Token) != 64 { // 32 bytes = 64 hex characters
				t.Errorf("Expected token length 64, got %d", len(result.Token))
			}

			// Test target hint based on method
			switch tt.expectedMethod {
			case "CNAME":
				if result.TargetHint == nil || *result.TargetHint != tt.config.PublicEdgeHost {
					t.Errorf("Expected target hint %s, got %v", tt.config.PublicEdgeHost, result.TargetHint)
				}
			case "A":
				if result.TargetHint == nil || *result.TargetHint != tt.config.PublicEdgeIPv4 {
					t.Errorf("Expected target hint %s, got %v", tt.config.PublicEdgeIPv4, result.TargetHint)
				}
			case "TXT":
				if result.TargetHint != nil {
					t.Errorf("Expected no target hint for TXT method, got %v", result.TargetHint)
				}
			}

			// Verify domain was created in database
			var domainID int64
			err = db.QueryRowContext(ctx, "SELECT id FROM domains WHERE domain = ?", tt.domain).Scan(&domainID)
			if err != nil {
				t.Errorf("Expected domain to be created in database, got error: %v", err)
			}

			if result.DomainID != domainID {
				t.Errorf("Expected domain ID %d, got %d", domainID, result.DomainID)
			}
		})
	}
}

func TestVerificationService_CheckVerification_TXTOnly(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := &util.Config{
		DNSVerifyEnabled: true,
	}

	resolver := NewMockResolver()
	service := NewVerificationService(db, config, resolver)

	ctx := context.Background()

	// Create a verification
	result, err := service.IssueVerification(ctx, "example.com")
	if err != nil {
		t.Fatalf("Failed to issue verification: %v", err)
	}

	// Test successful TXT verification
	t.Run("successful TXT verification", func(t *testing.T) {
		// Setup DNS response
		resolver.TXTRecords["_glinr-verify.example.com"] = []string{result.Token}

		checkResult, err := service.CheckVerification(ctx, "example.com")
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		if checkResult.Status != "verified" {
			t.Errorf("Expected status 'verified', got %s", checkResult.Status)
		}

		if checkResult.LastCheckedAt == nil {
			t.Error("Expected last_checked_at timestamp to be set")
		}
	})

	// Test failed TXT verification
	t.Run("failed TXT verification", func(t *testing.T) {
		// Clear DNS response
		resolver.TXTRecords["_glinr-verify.example.com"] = []string{}

		checkResult, err := service.CheckVerification(ctx, "example.com")
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		if checkResult.Status != "failed" {
			t.Errorf("Expected status 'failed', got %s", checkResult.Status)
		}
	})
}

func TestVerificationService_CheckVerification_WithEdgeConfig(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := &util.Config{
		DNSVerifyEnabled: true,
		PublicEdgeHost:   "edge.example.com",
		PublicEdgeIPv4:   "203.0.113.1",
		PublicEdgeIPv6:   "2001:db8::1",
	}

	resolver := NewMockResolver()
	service := NewVerificationService(db, config, resolver)

	ctx := context.Background()

	// Create a verification
	result, err := service.IssueVerification(ctx, "test.example.com")
	if err != nil {
		t.Fatalf("Failed to issue verification: %v", err)
	}

	t.Run("successful verification with A record", func(t *testing.T) {
		// Setup DNS responses
		resolver.TXTRecords["_glinr-verify.test.example.com"] = []string{result.Token}
		resolver.ARecords["test.example.com"] = []net.IP{net.ParseIP("203.0.113.1")}

		checkResult, err := service.CheckVerification(ctx, "test.example.com")
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		if checkResult.Status != "verified" {
			t.Errorf("Expected status 'verified', got %s", checkResult.Status)
		}
	})

	t.Run("successful verification with AAAA record", func(t *testing.T) {
		// Clear A records and setup AAAA
		resolver.ARecords["test.example.com"] = []net.IP{}
		resolver.AAAARecords["test.example.com"] = []net.IP{net.ParseIP("2001:db8::1")}

		checkResult, err := service.CheckVerification(ctx, "test.example.com")
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		if checkResult.Status != "verified" {
			t.Errorf("Expected status 'verified', got %s", checkResult.Status)
		}
	})

	t.Run("successful verification with CNAME record", func(t *testing.T) {
		// Clear other records and setup CNAME
		resolver.ARecords["test.example.com"] = []net.IP{}
		resolver.AAAARecords["test.example.com"] = []net.IP{}
		resolver.CNAMERecords["test.example.com"] = "edge.example.com"

		checkResult, err := service.CheckVerification(ctx, "test.example.com")
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		if checkResult.Status != "verified" {
			t.Errorf("Expected status 'verified', got %s", checkResult.Status)
		}
	})

	t.Run("failed verification - wrong IP", func(t *testing.T) {
		// Setup wrong IP
		resolver.CNAMERecords["test.example.com"] = ""
		resolver.ARecords["test.example.com"] = []net.IP{net.ParseIP("192.0.2.1")}

		checkResult, err := service.CheckVerification(ctx, "test.example.com")
		if err != nil {
			t.Fatalf("Unexpected error: %v", err)
		}

		if checkResult.Status != "failed" {
			t.Errorf("Expected status 'failed', got %s", checkResult.Status)
		}
	})
}

func TestVerificationService_CheckVerification_Disabled(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := &util.Config{
		DNSVerifyEnabled: false,
	}

	resolver := NewMockResolver()
	service := NewVerificationService(db, config, resolver)

	ctx := context.Background()

	_, err := service.CheckVerification(ctx, "example.com")
	if err == nil {
		t.Fatal("Expected error for disabled verification")
	}

	verErr, ok := err.(*VerificationError)
	if !ok {
		t.Fatalf("Expected VerificationError, got %T", err)
	}

	if verErr.Code != 501 {
		t.Errorf("Expected error code 501, got %d", verErr.Code)
	}
}

func TestVerificationService_AutoManagedProvider(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	config := &util.Config{
		DNSVerifyEnabled: true,
		PublicEdgeHost:   "edge.example.com",
	}

	resolver := NewMockResolver()
	service := NewVerificationService(db, config, resolver)

	ctx := context.Background()

	// Insert test data
	// Create DNS provider
	_, err := db.ExecContext(ctx, `
		INSERT INTO dns_providers (id, name, type, config_json, created_at, updated_at)
		VALUES (1, 'Test Cloudflare', 'cloudflare', '{"api_token":"test-token"}', ?, ?)
	`, time.Now(), time.Now())
	if err != nil {
		t.Fatalf("Failed to insert DNS provider: %v", err)
	}

	// Create domain with auto-managed provider
	_, err = db.ExecContext(ctx, `
		INSERT INTO domains (domain, provider_id, auto_manage, created_at, updated_at)
		VALUES ('auto.example.com', 1, true, ?, ?)
	`, time.Now(), time.Now())
	if err != nil {
		t.Fatalf("Failed to insert domain: %v", err)
	}

	// Test auto-managed provider detection
	provider, err := service.getAutoManagedProvider(ctx, "auto.example.com")
	if err != nil {
		t.Fatalf("Failed to get auto-managed provider: %v", err)
	}

	if provider.Type != "cloudflare" {
		t.Errorf("Expected provider type 'cloudflare', got %s", provider.Type)
	}

	// Test domain without auto-managed provider
	_, err = service.getAutoManagedProvider(ctx, "manual.example.com")
	if err != sql.ErrNoRows {
		t.Errorf("Expected sql.ErrNoRows for non-existent domain, got %v", err)
	}
}

func TestGenerateVerificationToken(t *testing.T) {
	token1, err := generateVerificationToken()
	if err != nil {
		t.Fatalf("Failed to generate token: %v", err)
	}

	token2, err := generateVerificationToken()
	if err != nil {
		t.Fatalf("Failed to generate second token: %v", err)
	}

	// Tokens should be different
	if token1 == token2 {
		t.Error("Generated tokens should be unique")
	}

	// Tokens should be 64 characters (32 bytes hex-encoded)
	if len(token1) != 64 {
		t.Errorf("Expected token length 64, got %d", len(token1))
	}

	// Tokens should be valid hex
	for _, char := range token1 {
		if !((char >= '0' && char <= '9') || (char >= 'a' && char <= 'f')) {
			t.Errorf("Token contains invalid hex character: %c", char)
			break
		}
	}
}

func TestVerificationService_EnsureDomainExists(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()

	resolver := NewMockResolver()
	config := &util.Config{DNSVerifyEnabled: true}
	service := NewVerificationService(db, config, resolver)

	ctx := context.Background()

	// Test creating new domain
	domainID1, err := service.ensureDomainExists(ctx, "new.example.com")
	if err != nil {
		t.Fatalf("Failed to create new domain: %v", err)
	}

	if domainID1 <= 0 {
		t.Errorf("Expected positive domain ID, got %d", domainID1)
	}

	// Test getting existing domain
	domainID2, err := service.ensureDomainExists(ctx, "new.example.com")
	if err != nil {
		t.Fatalf("Failed to get existing domain: %v", err)
	}

	if domainID1 != domainID2 {
		t.Errorf("Expected same domain ID %d, got %d", domainID1, domainID2)
	}

	// Verify domain exists in database
	var domain string
	err = db.QueryRowContext(ctx, "SELECT domain FROM domains WHERE id = ?", domainID1).Scan(&domain)
	if err != nil {
		t.Fatalf("Failed to verify domain in database: %v", err)
	}

	if domain != "new.example.com" {
		t.Errorf("Expected domain 'new.example.com', got %s", domain)
	}
}
