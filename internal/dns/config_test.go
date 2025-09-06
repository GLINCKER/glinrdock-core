package dns

import (
	"reflect"
	"testing"
	"time"

	"github.com/GLINCKER/glinrdock/internal/util"
)

func TestNewFromConfig(t *testing.T) {
	tests := []struct {
		name            string
		config          *util.Config
		expectedServers []string
		expectedTTL     time.Duration
	}{
		{
			name:            "nil config uses defaults",
			config:          nil,
			expectedServers: []string{"1.1.1.1:53", "8.8.8.8:53"},
			expectedTTL:     60 * time.Second,
		},
		{
			name: "config with custom resolvers",
			config: &util.Config{
				DNSResolvers: []string{"9.9.9.9:53", "149.112.112.112:53"},
			},
			expectedServers: []string{"9.9.9.9:53", "149.112.112.112:53"},
			expectedTTL:     60 * time.Second,
		},
		{
			name: "config with empty resolvers uses defaults",
			config: &util.Config{
				DNSResolvers: []string{},
			},
			expectedServers: []string{"1.1.1.1:53", "8.8.8.8:53"},
			expectedTTL:     60 * time.Second,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resolver := NewFromConfig(tt.config)

			// NewFromConfig returns a *MultiResolver directly
			if !reflect.DeepEqual(resolver.servers, tt.expectedServers) {
				t.Errorf("expected servers %v, got %v", tt.expectedServers, resolver.servers)
			}

			if resolver.ttl != tt.expectedTTL {
				t.Errorf("expected TTL %v, got %v", tt.expectedTTL, resolver.ttl)
			}
		})
	}
}

func TestGlobalResolver(t *testing.T) {
	// Reset global state for testing
	originalGlobal := GlobalResolver
	defer func() { GlobalResolver = originalGlobal }()

	t.Run("GetGlobalResolver with uninitialized global", func(t *testing.T) {
		GlobalResolver = nil

		resolver := GetGlobalResolver()
		if resolver == nil {
			t.Error("expected resolver to be created")
		}

		// Should create default resolver
		multiResolver, ok := resolver.(*MultiResolver)
		if !ok {
			t.Fatal("expected MultiResolver instance")
		}

		expectedServers := []string{"1.1.1.1:53", "8.8.8.8:53"}
		if !reflect.DeepEqual(multiResolver.servers, expectedServers) {
			t.Errorf("expected default servers %v, got %v", expectedServers, multiResolver.servers)
		}
	})

	t.Run("InitGlobalResolver", func(t *testing.T) {
		GlobalResolver = nil

		config := &util.Config{
			DNSResolvers: []string{"1.2.3.4:53"},
		}

		InitGlobalResolver(config)

		if GlobalResolver == nil {
			t.Fatal("expected GlobalResolver to be initialized")
		}

		multiResolver, ok := GlobalResolver.(*MultiResolver)
		if !ok {
			t.Fatal("expected MultiResolver instance")
		}

		expectedServers := []string{"1.2.3.4:53"}
		if !reflect.DeepEqual(multiResolver.servers, expectedServers) {
			t.Errorf("expected servers %v, got %v", expectedServers, multiResolver.servers)
		}
	})

	t.Run("SetGlobalResolver", func(t *testing.T) {
		fake := NewFakeResolver()

		SetGlobalResolver(fake)

		if GlobalResolver != fake {
			t.Error("expected GlobalResolver to be set to fake resolver")
		}

		// Verify we can get it back
		retrieved := GetGlobalResolver()
		if retrieved != fake {
			t.Error("expected GetGlobalResolver to return fake resolver")
		}
	})
}
