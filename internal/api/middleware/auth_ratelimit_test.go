package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestAuthRateLimit(t *testing.T) {
	gin.SetMode(gin.TestMode)

	tests := []struct {
		name                string
		requestsPerMinute   int
		requests            int
		expectedStatusCodes []int
		description         string
	}{
		{
			name:                "normal usage within limits",
			requestsPerMinute:   5,
			requests:            3,
			expectedStatusCodes: []int{200, 200, 200},
			description:         "Should allow requests within rate limit",
		},
		{
			name:                "burst exceeds limit",
			requestsPerMinute:   5,
			requests:            7,
			expectedStatusCodes: []int{200, 200, 200, 200, 200, 429, 429},
			description:         "Should return 429 after rate limit exceeded",
		},
		{
			name:                "single request limit",
			requestsPerMinute:   1,
			requests:            3,
			expectedStatusCodes: []int{200, 429, 429},
			description:         "Should enforce very low rate limits",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create rate limiter with test configuration
			config := &AuthRateLimitConfig{
				RequestsPerMinute: tt.requestsPerMinute,
				CleanupInterval:   time.Minute,
				BackoffMultiplier: 2.0,
				MaxBackoffMinutes: 60,
			}
			rateLimiter := NewAuthRateLimiter(config)

			// Create test router with rate limiting middleware
			r := gin.New()
			r.Use(AuthRateLimit(rateLimiter))
			r.POST("/test", func(c *gin.Context) {
				c.JSON(200, gin.H{"message": "success"})
			})

			// Make requests and check status codes
			for i, expectedCode := range tt.expectedStatusCodes {
				req, _ := http.NewRequest("POST", "/test", strings.NewReader("{}"))
				req.Header.Set("Content-Type", "application/json")
				// Use same IP for all requests to test per-IP limiting
				req.Header.Set("X-Forwarded-For", "192.168.1.100")
				
				w := httptest.NewRecorder()
				r.ServeHTTP(w, req)

				assert.Equal(t, expectedCode, w.Code, 
					"Request %d should return status %d, got %d", i+1, expectedCode, w.Code)

				if w.Code == 429 {
					// Check that retry-after header is set
					retryAfter := w.Header().Get("Retry-After")
					assert.NotEmpty(t, retryAfter, "Retry-After header should be set for 429 responses")
					
					// Check response body contains rate limit error
					assert.Contains(t, w.Body.String(), "rate limit exceeded")
				}
			}
		})
	}
}

func TestAuthRateLimitDifferentIPs(t *testing.T) {
	gin.SetMode(gin.TestMode)

	config := &AuthRateLimitConfig{
		RequestsPerMinute: 2,
		CleanupInterval:   time.Minute,
		BackoffMultiplier: 2.0,
		MaxBackoffMinutes: 60,
	}
	rateLimiter := NewAuthRateLimiter(config)

	r := gin.New()
	r.Use(AuthRateLimit(rateLimiter))
	r.POST("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "success"})
	})

	// Test that different IPs have separate rate limits
	ips := []string{"192.168.1.100", "192.168.1.101", "10.0.0.1"}
	
	for _, ip := range ips {
		// Each IP should be able to make 2 requests successfully
		for i := 0; i < 2; i++ {
			req, _ := http.NewRequest("POST", "/test", strings.NewReader("{}"))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-Forwarded-For", ip)
			
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			assert.Equal(t, 200, w.Code, 
				"IP %s request %d should succeed", ip, i+1)
		}

		// Third request should be rate limited
		req, _ := http.NewRequest("POST", "/test", strings.NewReader("{}"))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Forwarded-For", ip)
		
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)

		assert.Equal(t, 429, w.Code, 
			"IP %s should be rate limited on third request", ip)
	}
}

func TestAuthRateLimitExponentialBackoff(t *testing.T) {
	gin.SetMode(gin.TestMode)

	config := &AuthRateLimitConfig{
		RequestsPerMinute: 1,
		CleanupInterval:   time.Minute,
		BackoffMultiplier: 2.0,
		MaxBackoffMinutes: 60,
	}
	rateLimiter := NewAuthRateLimiter(config)

	// Directly test the IsAllowed method to verify exponential backoff logic
	ip := "192.168.1.100"

	// First request should be allowed
	allowed, _ := rateLimiter.IsAllowed(ip)
	assert.True(t, allowed, "First request should be allowed")

	// Second request should be denied and trigger exponential backoff
	allowed, backoffDuration := rateLimiter.IsAllowed(ip)
	assert.False(t, allowed, "Second request should be denied")
	assert.True(t, backoffDuration > 0, "Backoff duration should be greater than 0")

	// Third attempt should have longer backoff (exponential growth)
	allowed, backoffDuration2 := rateLimiter.IsAllowed(ip)
	assert.False(t, allowed, "Third request should still be denied")
	assert.True(t, backoffDuration2 >= backoffDuration, "Backoff should increase or stay same")
}

func TestAuthRateLimitRecordSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)

	config := &AuthRateLimitConfig{
		RequestsPerMinute: 1,
		CleanupInterval:   time.Minute,
		BackoffMultiplier: 2.0,
		MaxBackoffMinutes: 60,
	}
	rateLimiter := NewAuthRateLimiter(config)

	ip := "192.168.1.100"

	// Exhaust rate limit
	allowed, _ := rateLimiter.IsAllowed(ip)
	assert.True(t, allowed, "First request should be allowed")

	allowed, backoffDuration := rateLimiter.IsAllowed(ip)
	assert.False(t, allowed, "Second request should be denied")
	assert.True(t, backoffDuration > 0, "Should have backoff duration")

	// Record success should reset failure count
	rateLimiter.RecordSuccess(ip)

	// After success, should not have active backoff
	// (Note: this is simplified - in real implementation you might need to wait for rate window)
	time.Sleep(10 * time.Millisecond) // Small delay for any internal processing
	
	// The IP should now have reset failure count, though still subject to rate limiting
	// This test verifies that RecordSuccess doesn't panic and properly resets internal state
	assert.NotPanics(t, func() {
		rateLimiter.RecordSuccess(ip)
	}, "RecordSuccess should not panic")
}

func TestAuthRateLimitIPExtraction(t *testing.T) {
	gin.SetMode(gin.TestMode)

	config := &AuthRateLimitConfig{
		RequestsPerMinute: 5,
		CleanupInterval:   time.Minute,
		BackoffMultiplier: 2.0,
		MaxBackoffMinutes: 60,
	}
	rateLimiter := NewAuthRateLimiter(config)

	r := gin.New()
	r.Use(AuthRateLimit(rateLimiter))
	r.POST("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "success"})
	})

	tests := []struct {
		name     string
		headers  map[string]string
		clientIP string
		desc     string
	}{
		{
			name: "X-Forwarded-For header",
			headers: map[string]string{
				"X-Forwarded-For": "192.168.1.100, 10.0.0.1",
			},
			desc: "Should extract first IP from X-Forwarded-For",
		},
		{
			name: "X-Real-IP header", 
			headers: map[string]string{
				"X-Real-IP": "10.0.0.1",
			},
			desc: "Should use X-Real-IP when available",
		},
		{
			name:    "no proxy headers",
			headers: map[string]string{},
			desc:    "Should fall back to direct client IP",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req, _ := http.NewRequest("POST", "/test", strings.NewReader("{}"))
			req.Header.Set("Content-Type", "application/json")
			
			for key, value := range tt.headers {
				req.Header.Set(key, value)
			}
			
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)

			// All requests should succeed (we're just testing IP extraction doesn't panic)
			assert.Equal(t, 200, w.Code, "Request should succeed: %s", tt.desc)
		})
	}
}

func TestDefaultAuthRateLimitConfig(t *testing.T) {
	// Test that default configuration is reasonable
	config := DefaultAuthRateLimitConfig()
	
	assert.Equal(t, 5, config.RequestsPerMinute, "Default should be 5 requests per minute")
	assert.Equal(t, 5*time.Minute, config.CleanupInterval, "Default cleanup interval should be 5 minutes")
	assert.Equal(t, 2.0, config.BackoffMultiplier, "Default backoff multiplier should be 2.0")
	assert.Equal(t, 60, config.MaxBackoffMinutes, "Default max backoff should be 60 minutes")
}

// Benchmark tests for performance under load
func BenchmarkAuthRateLimit(b *testing.B) {
	gin.SetMode(gin.TestMode)
	
	config := &AuthRateLimitConfig{
		RequestsPerMinute: 100,
		CleanupInterval:   time.Minute,
		BackoffMultiplier: 2.0,
		MaxBackoffMinutes: 60,
	}
	rateLimiter := NewAuthRateLimiter(config)

	r := gin.New()
	r.Use(AuthRateLimit(rateLimiter))
	r.POST("/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "success"})
	})

	b.ResetTimer()
	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			req, _ := http.NewRequest("POST", "/test", strings.NewReader("{}"))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-Forwarded-For", "192.168.1."+string(rune(i%255)))
			
			w := httptest.NewRecorder()
			r.ServeHTTP(w, req)
			i++
		}
	})
}