package api

import (
	"sync"
	"time"
)

// TokenBucket represents a simple token bucket for rate limiting
type TokenBucket struct {
	tokens    int
	maxTokens int
	refillRate time.Duration
	lastRefill time.Time
	mu         sync.Mutex
}

// NewTokenBucket creates a new token bucket
func NewTokenBucket(maxTokens int, refillRate time.Duration) *TokenBucket {
	return &TokenBucket{
		tokens:     maxTokens,
		maxTokens:  maxTokens,
		refillRate: refillRate,
		lastRefill: time.Now(),
	}
}

// TryConsume attempts to consume a token, returns true if successful
func (tb *TokenBucket) TryConsume() bool {
	tb.mu.Lock()
	defer tb.mu.Unlock()
	
	// Refill tokens based on elapsed time
	now := time.Now()
	elapsed := now.Sub(tb.lastRefill)
	tokensToAdd := int(elapsed / tb.refillRate)
	
	if tokensToAdd > 0 {
		tb.tokens += tokensToAdd
		if tb.tokens > tb.maxTokens {
			tb.tokens = tb.maxTokens
		}
		tb.lastRefill = now
	}
	
	// Try to consume a token
	if tb.tokens > 0 {
		tb.tokens--
		return true
	}
	
	return false
}

// RateLimiter manages rate limiting for different keys (IP/token)
type RateLimiter struct {
	buckets map[string]*TokenBucket
	mu      sync.RWMutex
	maxTokens int
	refillRate time.Duration
}

// NewRateLimiter creates a new rate limiter
func NewRateLimiter(maxTokens int, refillRate time.Duration) *RateLimiter {
	return &RateLimiter{
		buckets:    make(map[string]*TokenBucket),
		maxTokens:  maxTokens,
		refillRate: refillRate,
	}
}

// CheckLimit checks if the key is within rate limits
func (rl *RateLimiter) CheckLimit(key string) bool {
	rl.mu.RLock()
	bucket, exists := rl.buckets[key]
	rl.mu.RUnlock()
	
	if !exists {
		rl.mu.Lock()
		// Double-check after acquiring write lock
		if bucket, exists = rl.buckets[key]; !exists {
			bucket = NewTokenBucket(rl.maxTokens, rl.refillRate)
			rl.buckets[key] = bucket
		}
		rl.mu.Unlock()
	}
	
	return bucket.TryConsume()
}

// CleanupExpired removes old buckets (call periodically)
func (rl *RateLimiter) CleanupExpired() {
	rl.mu.Lock()
	defer rl.mu.Unlock()
	
	now := time.Now()
	for key, bucket := range rl.buckets {
		bucket.mu.Lock()
		// Remove buckets that haven't been used for 10 minutes
		if now.Sub(bucket.lastRefill) > 10*time.Minute {
			delete(rl.buckets, key)
		}
		bucket.mu.Unlock()
	}
}