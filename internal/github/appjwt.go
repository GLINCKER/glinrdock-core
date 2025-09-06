package github

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"io/ioutil"
	"net/http"
	"strconv"
	"time"

	"github.com/golang-jwt/jwt/v4"
)

// AppConfig holds GitHub App configuration
type AppConfig struct {
	AppID          string
	PrivateKeyPath string
	WebhookSecret  string
}

// AppAuthenticator handles GitHub App JWT authentication
type AppAuthenticator struct {
	appID      int64
	privateKey *rsa.PrivateKey
}

// NewAppAuthenticator creates a new GitHub App authenticator
func NewAppAuthenticator(appID string, privateKeyPath string) (*AppAuthenticator, error) {
	// Parse app ID
	appIDInt, err := strconv.ParseInt(appID, 10, 64)
	if err != nil {
		return nil, fmt.Errorf("invalid app ID: %w", err)
	}

	// Load and parse private key
	privateKey, err := loadPrivateKey(privateKeyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to load private key: %w", err)
	}

	return &AppAuthenticator{
		appID:      appIDInt,
		privateKey: privateKey,
	}, nil
}

// CreateJWT creates a new JWT for GitHub App authentication
// JWTs are valid for 10 minutes and used to get installation tokens
func (a *AppAuthenticator) CreateJWT() (string, error) {
	now := time.Now()

	claims := jwt.MapClaims{
		"iat": now.Unix(),
		"exp": now.Add(10 * time.Minute).Unix(), // GitHub requires max 10 minutes
		"iss": a.appID,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)

	signedToken, err := token.SignedString(a.privateKey)
	if err != nil {
		return "", fmt.Errorf("failed to sign JWT: %w", err)
	}

	return signedToken, nil
}

// CreateAuthenticatedClient creates an HTTP client with JWT authentication
func (a *AppAuthenticator) CreateAuthenticatedClient() (*http.Client, error) {
	jwt, err := a.CreateJWT()
	if err != nil {
		return nil, err
	}

	// Create client with JWT in Authorization header
	client := &http.Client{
		Timeout: 30 * time.Second,
		Transport: &jwtTransport{
			transport: http.DefaultTransport,
			jwt:       jwt,
		},
	}

	return client, nil
}

// jwtTransport adds JWT authorization header to all requests
type jwtTransport struct {
	transport http.RoundTripper
	jwt       string
}

func (t *jwtTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	// Clone the request to avoid modifying the original
	reqCopy := req.Clone(req.Context())
	reqCopy.Header.Set("Authorization", "Bearer "+t.jwt)
	reqCopy.Header.Set("Accept", "application/vnd.github.v3+json")
	reqCopy.Header.Set("User-Agent", "GLINR-Dock-App/1.0")

	return t.transport.RoundTrip(reqCopy)
}

// loadPrivateKey loads and parses an RSA private key from a PEM file
func loadPrivateKey(path string) (*rsa.PrivateKey, error) {
	keyData, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read private key file: %w", err)
	}

	// Decode PEM block
	block, _ := pem.Decode(keyData)
	if block == nil {
		return nil, fmt.Errorf("failed to decode PEM block")
	}

	// Parse private key based on type
	switch block.Type {
	case "RSA PRIVATE KEY":
		return x509.ParsePKCS1PrivateKey(block.Bytes)
	case "PRIVATE KEY":
		key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
		if err != nil {
			return nil, fmt.Errorf("failed to parse PKCS8 private key: %w", err)
		}
		rsaKey, ok := key.(*rsa.PrivateKey)
		if !ok {
			return nil, fmt.Errorf("private key is not RSA")
		}
		return rsaKey, nil
	default:
		return nil, fmt.Errorf("unsupported private key type: %s", block.Type)
	}
}
