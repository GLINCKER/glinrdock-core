package dns

import (
	"time"

	"github.com/GLINCKER/glinrdock/internal/util"
)

// NewFromConfig creates a new MultiResolver from system configuration
func NewFromConfig(config *util.Config) *MultiResolver {
	if config == nil {
		return NewMultiResolver(nil) // Use defaults
	}
	
	resolver := NewMultiResolver(config.DNSResolvers)
	
	// Set TTL to 60 seconds by default, but could be made configurable
	resolver.SetTTL(60 * time.Second)
	
	return resolver
}

// GlobalResolver holds a package-level resolver instance
var GlobalResolver Resolver

// InitGlobalResolver initializes the global resolver from configuration
func InitGlobalResolver(config *util.Config) {
	GlobalResolver = NewFromConfig(config)
}

// GetGlobalResolver returns the global resolver instance
func GetGlobalResolver() Resolver {
	if GlobalResolver == nil {
		GlobalResolver = NewMultiResolver(nil) // Use defaults if not initialized
	}
	return GlobalResolver
}

// SetGlobalResolver sets the global resolver (useful for testing)
func SetGlobalResolver(resolver Resolver) {
	GlobalResolver = resolver
}