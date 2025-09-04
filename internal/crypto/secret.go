package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"os"
)

const (
	NonceSize = 12 // AES-GCM standard nonce size
	KeySize   = 32 // AES-256 key size
)

var (
	ErrInvalidKeySize   = errors.New("invalid key size: must be 32 bytes")
	ErrInvalidNonceSize = errors.New("invalid nonce size: must be 12 bytes")
	ErrEncryptionFailed = errors.New("encryption failed")
	ErrDecryptionFailed = errors.New("decryption failed")
	ErrMissingSecretKey = errors.New("GLINRDOCK_SECRET environment variable is required")
	ErrInvalidBase64    = errors.New("GLINRDOCK_SECRET must be valid base64")
)

// LoadMasterKeyFromEnv loads the master encryption key from GLINRDOCK_SECRET environment variable.
// The key must be base64 encoded and decode to exactly 32 bytes.
func LoadMasterKeyFromEnv() ([]byte, error) {
	secretEnv := os.Getenv("GLINRDOCK_SECRET")
	if secretEnv == "" {
		return nil, ErrMissingSecretKey
	}

	key, err := base64.StdEncoding.DecodeString(secretEnv)
	if err != nil {
		return nil, ErrInvalidBase64
	}

	if len(key) != KeySize {
		return nil, ErrInvalidKeySize
	}

	return key, nil
}

// Encrypt encrypts plaintext using AES-GCM with the provided key.
// Returns a 12-byte nonce and the ciphertext.
func Encrypt(key, plaintext []byte) (nonce, ciphertext []byte, err error) {
	if len(key) != KeySize {
		return nil, nil, ErrInvalidKeySize
	}

	// Create AES cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, nil, ErrEncryptionFailed
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, nil, ErrEncryptionFailed
	}

	// Generate random nonce
	nonce = make([]byte, NonceSize)
	if _, err := rand.Read(nonce); err != nil {
		return nil, nil, ErrEncryptionFailed
	}

	// Encrypt
	ciphertext = gcm.Seal(nil, nonce, plaintext, nil)

	return nonce, ciphertext, nil
}

// Decrypt decrypts ciphertext using AES-GCM with the provided key and nonce.
func Decrypt(key, nonce, ciphertext []byte) ([]byte, error) {
	if len(key) != KeySize {
		return nil, ErrInvalidKeySize
	}

	if len(nonce) != NonceSize {
		return nil, ErrInvalidNonceSize
	}

	// Create AES cipher
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, ErrDecryptionFailed
	}

	// Create GCM mode
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, ErrDecryptionFailed
	}

	// Decrypt
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return nil, ErrDecryptionFailed
	}

	return plaintext, nil
}