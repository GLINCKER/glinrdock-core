package crypto

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestEncryptDecrypt(t *testing.T) {
	tests := []struct {
		name      string
		plaintext string
		key       string
	}{
		{
			name:      "basic encryption",
			plaintext: "hello world",
			key:       "test-key-32-bytes-long-for-aes!",
		},
		{
			name:      "empty string",
			plaintext: "",
			key:       "test-key-32-bytes-long-for-aes!",
		},
		{
			name:      "long text",
			plaintext: "This is a very long text that should be encrypted and decrypted properly without any issues. It contains multiple sentences and should test the encryption with larger data sizes.",
			key:       "test-key-32-bytes-long-for-aes!",
		},
		{
			name:      "special characters",
			plaintext: "Special chars: !@#$%^&*()_+{}|:<>?[]\\;',./`~",
			key:       "test-key-32-bytes-long-for-aes!",
		},
		{
			name:      "unicode characters",
			plaintext: "Unicode: 你好世界 🌍 emoji test",
			key:       "test-key-32-bytes-long-for-aes!",
		},
		{
			name:      "json data",
			plaintext: `{"client_id":"test","client_secret":"secret123","app_id":12345}`,
			key:       "test-key-32-bytes-long-for-aes!",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Encrypt the plaintext
			encrypted, err := Encrypt(tt.plaintext, tt.key)
			require.NoError(t, err)
			assert.NotEmpty(t, encrypted)
			assert.NotEqual(t, tt.plaintext, encrypted)

			// Decrypt the ciphertext
			decrypted, err := Decrypt(encrypted, tt.key)
			require.NoError(t, err)
			assert.Equal(t, tt.plaintext, decrypted)
		})
	}
}

func TestEncryptDecrypt_DifferentKeys(t *testing.T) {
	plaintext := "test message"
	key1 := "test-key-32-bytes-long-for-aes!"
	key2 := "different-key-32-bytes-long-!!!"

	// Encrypt with key1
	encrypted, err := Encrypt(plaintext, key1)
	require.NoError(t, err)

	// Try to decrypt with key2 - should fail
	_, err = Decrypt(encrypted, key2)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "cipher: message authentication failed")
}

func TestEncrypt_InvalidKeySize(t *testing.T) {
	tests := []struct {
		name string
		key  string
	}{
		{"too short", "short"},
		{"too long", "this-key-is-way-too-long-for-aes-256-encryption"},
		{"empty", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Encrypt("test", tt.key)
			assert.Error(t, err)
		})
	}
}

func TestDecrypt_InvalidInput(t *testing.T) {
	key := "test-key-32-bytes-long-for-aes!"
	
	tests := []struct {
		name      string
		encrypted string
	}{
		{"empty string", ""},
		{"invalid base64", "not-base64!@#"},
		{"too short", "dGVzdA=="}, // "test" in base64, but too short for nonce+ciphertext
		{"invalid format", "dGhpcyBpcyBub3QgdmFsaWQgZW5jcnlwdGVkIGRhdGE="}, // valid base64 but invalid encrypted data
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Decrypt(tt.encrypted, key)
			assert.Error(t, err)
		})
	}
}

func TestEncrypt_RandomNonce(t *testing.T) {
	plaintext := "test message"
	key := "test-key-32-bytes-long-for-aes!"

	// Encrypt the same plaintext multiple times
	encrypted1, err := Encrypt(plaintext, key)
	require.NoError(t, err)

	encrypted2, err := Encrypt(plaintext, key)
	require.NoError(t, err)

	// The encrypted results should be different due to random nonce
	assert.NotEqual(t, encrypted1, encrypted2)

	// But both should decrypt to the same plaintext
	decrypted1, err := Decrypt(encrypted1, key)
	require.NoError(t, err)
	assert.Equal(t, plaintext, decrypted1)

	decrypted2, err := Decrypt(encrypted2, key)
	require.NoError(t, err)
	assert.Equal(t, plaintext, decrypted2)
}

func TestGenerate32ByteKey(t *testing.T) {
	tests := []struct {
		name     string
		password string
	}{
		{"short password", "test"},
		{"long password", "this is a very long password with many characters"},
		{"empty password", ""},
		{"special chars", "p@ssw0rd!@#$%^&*()"},
		{"unicode", "пароль密码パスワード"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			key := Generate32ByteKey(tt.password)
			
			// Key should always be 32 bytes
			assert.Len(t, key, 32)
			
			// Key should be deterministic for the same input
			key2 := Generate32ByteKey(tt.password)
			assert.Equal(t, key, key2)
			
			// Key should be valid for AES-256
			testData := "test encryption"
			encrypted, err := Encrypt(testData, key)
			require.NoError(t, err)
			
			decrypted, err := Decrypt(encrypted, key)
			require.NoError(t, err)
			assert.Equal(t, testData, decrypted)
		})
	}
}

func TestGenerate32ByteKey_DifferentInputs(t *testing.T) {
	key1 := Generate32ByteKey("password1")
	key2 := Generate32ByteKey("password2")
	key3 := Generate32ByteKey("password1") // Same as key1

	// Different passwords should produce different keys
	assert.NotEqual(t, key1, key2)
	
	// Same password should produce the same key
	assert.Equal(t, key1, key3)
}

func BenchmarkEncrypt(b *testing.B) {
	plaintext := "This is a test message for benchmarking encryption performance"
	key := "test-key-32-bytes-long-for-aes!"
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := Encrypt(plaintext, key)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkDecrypt(b *testing.B) {
	plaintext := "This is a test message for benchmarking decryption performance"
	key := "test-key-32-bytes-long-for-aes!"
	
	// Pre-encrypt the data
	encrypted, err := Encrypt(plaintext, key)
	if err != nil {
		b.Fatal(err)
	}
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := Decrypt(encrypted, key)
		if err != nil {
			b.Fatal(err)
		}
	}
}

func BenchmarkGenerate32ByteKey(b *testing.B) {
	password := "test-password-for-benchmarking"
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Generate32ByteKey(password)
	}
}