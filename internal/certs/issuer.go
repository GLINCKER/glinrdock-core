package certs

import (
	"context"
	"fmt"
	"time"
)

// Issuer defines the interface for certificate issuers (ACME providers)
type Issuer interface {
	Ensure(ctx context.Context, domain string) (certPEM, keyPEM []byte, exp time.Time, err error)
}

// NoopIssuer is a no-op implementation that returns an error
// Used as a placeholder until real ACME providers are implemented
type NoopIssuer struct{}

// Ensure implements the Issuer interface but always returns an error
func (n *NoopIssuer) Ensure(ctx context.Context, domain string) ([]byte, []byte, time.Time, error) {
	return nil, nil, time.Time{}, fmt.Errorf("ACME certificate issuance not implemented")
}
