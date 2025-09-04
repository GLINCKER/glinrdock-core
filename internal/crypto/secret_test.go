package crypto

import (
	"encoding/base64"
	"os"
	"testing"
)

func TestEncryptDecrypt(t *testing.T) {
	// Test basic encryption/decryption
	key := make([]byte, KeySize)
	for i := range key {
		key[i] = byte(i % 256)
	}

	plaintext := []byte("Hello, World! This is a secret message.")

	// Test encryption
	nonce, ciphertext, err := Encrypt(key, plaintext)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	if len(nonce) != NonceSize {
		t.Errorf("Expected nonce size %d, got %d", NonceSize, len(nonce))
	}

	if len(ciphertext) == 0 {
		t.Error("Ciphertext should not be empty")
	}

	// Test decryption
	decrypted, err := Decrypt(key, nonce, ciphertext)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}

	if string(decrypted) != string(plaintext) {
		t.Errorf("Expected %q, got %q", plaintext, decrypted)
	}
}

func TestEncryptDecryptEmptyMessage(t *testing.T) {
	key := make([]byte, KeySize)
	plaintext := []byte("")

	nonce, ciphertext, err := Encrypt(key, plaintext)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	decrypted, err := Decrypt(key, nonce, ciphertext)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}

	if string(decrypted) != string(plaintext) {
		t.Errorf("Expected %q, got %q", plaintext, decrypted)
	}
}

func TestInvalidKeySize(t *testing.T) {
	// Test with invalid key size
	invalidKey := make([]byte, 16) // Should be 32 bytes
	plaintext := []byte("test")

	_, _, err := Encrypt(invalidKey, plaintext)
	if err != ErrInvalidKeySize {
		t.Errorf("Expected ErrInvalidKeySize, got %v", err)
	}

	// Test decryption with invalid key size
	nonce := make([]byte, NonceSize)
	ciphertext := []byte("dummy")

	_, err = Decrypt(invalidKey, nonce, ciphertext)
	if err != ErrInvalidKeySize {
		t.Errorf("Expected ErrInvalidKeySize, got %v", err)
	}
}

func TestInvalidNonceSize(t *testing.T) {
	key := make([]byte, KeySize)
	invalidNonce := make([]byte, 8) // Should be 12 bytes
	ciphertext := []byte("dummy")

	_, err := Decrypt(key, invalidNonce, ciphertext)
	if err != ErrInvalidNonceSize {
		t.Errorf("Expected ErrInvalidNonceSize, got %v", err)
	}
}

func TestLoadMasterKeyFromEnv(t *testing.T) {
	// Save original environment variable
	originalEnv := os.Getenv("GLINRDOCK_SECRET")
	defer func() {
		if originalEnv != "" {
			os.Setenv("GLINRDOCK_SECRET", originalEnv)
		} else {
			os.Unsetenv("GLINRDOCK_SECRET")
		}
	}()

	// Test with missing environment variable
	os.Unsetenv("GLINRDOCK_SECRET")
	_, err := LoadMasterKeyFromEnv()
	if err != ErrMissingSecretKey {
		t.Errorf("Expected ErrMissingSecretKey, got %v", err)
	}

	// Test with invalid base64
	os.Setenv("GLINRDOCK_SECRET", "invalid-base64!")
	_, err = LoadMasterKeyFromEnv()
	if err != ErrInvalidBase64 {
		t.Errorf("Expected ErrInvalidBase64, got %v", err)
	}

	// Test with wrong key size (valid base64 but wrong length)
	wrongSizeKey := base64.StdEncoding.EncodeToString(make([]byte, 16))
	os.Setenv("GLINRDOCK_SECRET", wrongSizeKey)
	_, err = LoadMasterKeyFromEnv()
	if err != ErrInvalidKeySize {
		t.Errorf("Expected ErrInvalidKeySize, got %v", err)
	}

	// Test with valid key
	validKey := make([]byte, KeySize)
	for i := range validKey {
		validKey[i] = byte(i % 256)
	}
	validKeyB64 := base64.StdEncoding.EncodeToString(validKey)
	os.Setenv("GLINRDOCK_SECRET", validKeyB64)

	loadedKey, err := LoadMasterKeyFromEnv()
	if err != nil {
		t.Fatalf("LoadMasterKeyFromEnv failed: %v", err)
	}

	if len(loadedKey) != KeySize {
		t.Errorf("Expected key size %d, got %d", KeySize, len(loadedKey))
	}

	// Verify the key matches
	for i, b := range loadedKey {
		if b != validKey[i] {
			t.Errorf("Key byte %d: expected %d, got %d", i, validKey[i], b)
		}
	}
}

func TestEndToEndWithEnvKey(t *testing.T) {
	// Save original environment variable
	originalEnv := os.Getenv("GLINRDOCK_SECRET")
	defer func() {
		if originalEnv != "" {
			os.Setenv("GLINRDOCK_SECRET", originalEnv)
		} else {
			os.Unsetenv("GLINRDOCK_SECRET")
		}
	}()

	// Generate a valid key and set in environment
	key := make([]byte, KeySize)
	for i := range key {
		key[i] = byte(i % 256)
	}
	keyB64 := base64.StdEncoding.EncodeToString(key)
	os.Setenv("GLINRDOCK_SECRET", keyB64)

	// Load key from environment
	envKey, err := LoadMasterKeyFromEnv()
	if err != nil {
		t.Fatalf("LoadMasterKeyFromEnv failed: %v", err)
	}

	// Test encryption with env key
	plaintext := []byte("This is a secret message using the environment key!")
	nonce, ciphertext, err := Encrypt(envKey, plaintext)
	if err != nil {
		t.Fatalf("Encrypt failed: %v", err)
	}

	// Test decryption
	decrypted, err := Decrypt(envKey, nonce, ciphertext)
	if err != nil {
		t.Fatalf("Decrypt failed: %v", err)
	}

	if string(decrypted) != string(plaintext) {
		t.Errorf("End-to-end test failed: expected %q, got %q", plaintext, decrypted)
	}
}

func TestDifferentPlaintexts(t *testing.T) {
	key := make([]byte, KeySize)
	
	testCases := [][]byte{
		[]byte("short"),
		[]byte("A longer message that spans multiple blocks and should still work correctly"),
		[]byte("Special characters: !@#$%^&*()_+-=[]{}|;':\",./<>?"),
		[]byte("Unicode: 你好世界 🌟 مرحبا بالعالم"),
		make([]byte, 1024), // Large message
	}

	// Fill the large message with data
	for i := range testCases[len(testCases)-1] {
		testCases[len(testCases)-1][i] = byte(i % 256)
	}

	for i, plaintext := range testCases {
		t.Run(string(rune(i)), func(t *testing.T) {
			nonce, ciphertext, err := Encrypt(key, plaintext)
			if err != nil {
				t.Fatalf("Encrypt failed: %v", err)
			}

			decrypted, err := Decrypt(key, nonce, ciphertext)
			if err != nil {
				t.Fatalf("Decrypt failed: %v", err)
			}

			if string(decrypted) != string(plaintext) {
				t.Errorf("Mismatch for test case %d", i)
			}
		})
	}
}

func TestNonceUniqueness(t *testing.T) {
	key := make([]byte, KeySize)
	plaintext := []byte("same message")

	// Generate multiple encryptions of the same message
	nonces := make([][]byte, 100)
	for i := 0; i < 100; i++ {
		nonce, _, err := Encrypt(key, plaintext)
		if err != nil {
			t.Fatalf("Encrypt failed: %v", err)
		}
		nonces[i] = nonce
	}

	// Verify all nonces are unique
	nonceSet := make(map[string]bool)
	for i, nonce := range nonces {
		nonceStr := string(nonce)
		if nonceSet[nonceStr] {
			t.Errorf("Duplicate nonce found at index %d", i)
		}
		nonceSet[nonceStr] = true
	}
}