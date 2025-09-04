package middleware

import (
	"fmt"
	"math"
	"net/http"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
)

// AuthRateLimitConfig holds rate limiting configuration
type AuthRateLimitConfig struct {
	RequestsPerMinute int           // Number of requests allowed per minute
	CleanupInterval   time.Duration // How often to clean up old entries
	BackoffMultiplier float64       // Exponential backoff multiplier
	MaxBackoffMinutes int           // Maximum backoff duration in minutes
}

// DefaultAuthRateLimitConfig returns default rate limiting configuration
func DefaultAuthRateLimitConfig() *AuthRateLimitConfig {
	requestsPerMin := 1000 // Increased from 5 to allow normal app usage
	if env := getEnv("AUTH_RL_PER_MIN", ""); env != "" {
		if parsed, err := strconv.Atoi(env); err == nil && parsed > 0 {
			requestsPerMin = parsed
		}
	}

	return &AuthRateLimitConfig{
		RequestsPerMinute: requestsPerMin,
		CleanupInterval:   5 * time.Minute,
		BackoffMultiplier: 2.0,
		MaxBackoffMinutes: 60,
	}
}

// AuthRateLimiter tracks request rates and failures per IP
type AuthRateLimiter struct {
	config   *AuthRateLimitConfig
	requests map[string]*ipRequestTracker
	mutex    sync.RWMutex
}

// ipRequestTracker tracks requests and failures for a single IP
type ipRequestTracker struct {
	requests     []time.Time
	failures     int
	lastFailure  time.Time
	backoffUntil time.Time
}

// NewAuthRateLimiter creates a new auth rate limiter
func NewAuthRateLimiter(config *AuthRateLimitConfig) *AuthRateLimiter {
	limiter := &AuthRateLimiter{
		config:   config,
		requests: make(map[string]*ipRequestTracker),
	}
	
	// Start cleanup goroutine
	go limiter.cleanup()
	
	return limiter
}

// cleanup removes old entries periodically
func (rl *AuthRateLimiter) cleanup() {
	ticker := time.NewTicker(rl.config.CleanupInterval)
	defer ticker.Stop()
	
	for range ticker.C {
		rl.mutex.Lock()
		cutoff := time.Now().Add(-2 * time.Minute) // Keep last 2 minutes
		
		for ip, tracker := range rl.requests {
			// Remove old requests
			var recentRequests []time.Time
			for _, reqTime := range tracker.requests {
				if reqTime.After(cutoff) {
					recentRequests = append(recentRequests, reqTime)
				}
			}
			tracker.requests = recentRequests
			
			// Remove IPs with no recent activity and no active backoff
			if len(tracker.requests) == 0 && time.Now().After(tracker.backoffUntil) {
				delete(rl.requests, ip)
			}
		}
		rl.mutex.Unlock()
	}
}

// IsAllowed checks if a request from the given IP is allowed (exported for use in auth service)
func (rl *AuthRateLimiter) IsAllowed(ip string) (bool, time.Duration) {
	rl.mutex.Lock()
	defer rl.mutex.Unlock()
	
	now := time.Now()
	tracker, exists := rl.requests[ip]
	if !exists {
		tracker = &ipRequestTracker{
			requests: make([]time.Time, 0),
		}
		rl.requests[ip] = tracker
	}
	
	// Check if IP is in backoff period
	if now.Before(tracker.backoffUntil) {
		return false, tracker.backoffUntil.Sub(now)
	}
	
	// Clean up requests older than 1 minute
	cutoff := now.Add(-1 * time.Minute)
	var recentRequests []time.Time
	for _, reqTime := range tracker.requests {
		if reqTime.After(cutoff) {
			recentRequests = append(recentRequests, reqTime)
		}
	}
	tracker.requests = recentRequests
	
	// Check rate limit
	if len(tracker.requests) >= rl.config.RequestsPerMinute {
		// Rate limit exceeded, start exponential backoff
		tracker.failures++
		tracker.lastFailure = now
		
		// Calculate exponential backoff duration
		backoffMinutes := int(math.Min(
			math.Pow(rl.config.BackoffMultiplier, float64(tracker.failures)),
			float64(rl.config.MaxBackoffMinutes),
		))
		tracker.backoffUntil = now.Add(time.Duration(backoffMinutes) * time.Minute)
		
		return false, tracker.backoffUntil.Sub(now)
	}
	
	// Request allowed, add to tracker
	tracker.requests = append(tracker.requests, now)
	return true, 0
}

// RecordSuccess resets failure count for successful authentications (exported)
func (rl *AuthRateLimiter) RecordSuccess(ip string) {
	rl.mutex.Lock()
	defer rl.mutex.Unlock()
	
	if tracker, exists := rl.requests[ip]; exists {
		tracker.failures = 0
		tracker.backoffUntil = time.Time{} // Clear any backoff
	}
}

// AuthRateLimit returns middleware that enforces rate limits on auth endpoints
func AuthRateLimit(limiter *AuthRateLimiter) gin.HandlerFunc {
	return func(c *gin.Context) {
		clientIP := getClientIP(c)
		
		allowed, backoffDuration := limiter.IsAllowed(clientIP)
		if !allowed {
			var retryAfter string
			if backoffDuration > 0 {
				retryAfter = fmt.Sprintf("%.0f", backoffDuration.Seconds())
			} else {
				retryAfter = "60" // Default retry after 1 minute
			}
			
			c.Header("Retry-After", retryAfter)
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "rate limit exceeded",
				"retry_after": retryAfter,
				"message":     "Too many authentication attempts. Please try again later.",
			})
			c.Abort()
			return
		}
		
		// Store limiter in context for success recording
		c.Set("auth_rate_limiter", limiter)
		c.Set("client_ip", clientIP)
		
		c.Next()
	}
}

// RecordAuthSuccess should be called after successful authentication to reset failure count
func RecordAuthSuccess(c *gin.Context) {
	if limiter, exists := c.Get("auth_rate_limiter"); exists {
		if rl, ok := limiter.(*AuthRateLimiter); ok {
			if clientIP, exists := c.Get("client_ip"); exists {
				if ip, ok := clientIP.(string); ok {
					rl.RecordSuccess(ip)
				}
			}
		}
	}
}

// getClientIP extracts the real client IP from the request
func getClientIP(c *gin.Context) string {
	// Check X-Forwarded-For header (load balancer/proxy)
	if xff := c.GetHeader("X-Forwarded-For"); xff != "" {
		// Take first IP if multiple
		if len(xff) > 0 {
			return parseIP(xff)
		}
	}
	
	// Check X-Real-IP header (nginx proxy)
	if xri := c.GetHeader("X-Real-IP"); xri != "" {
		return parseIP(xri)
	}
	
	// Fall back to direct connection IP
	return parseIP(c.ClientIP())
}

// parseIP extracts the first IP from a potentially comma-separated string
func parseIP(ipStr string) string {
	if ipStr == "" {
		return "unknown"
	}
	
	// Handle comma-separated IPs (X-Forwarded-For)
	for i, r := range ipStr {
		if r == ',' || r == ' ' {
			return ipStr[:i]
		}
	}
	return ipStr
}

// getEnv returns environment variable value or default
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}