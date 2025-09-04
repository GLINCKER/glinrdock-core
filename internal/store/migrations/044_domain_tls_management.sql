-- Migration: Domain and TLS management tables
-- Date: 2025-09-04
-- Description: Add comprehensive domain and certificate management with DNS provider support

-- DNS providers table for managing DNS service providers (Cloudflare, etc.)
CREATE TABLE dns_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'cloudflare', -- cloudflare
    config_json TEXT NOT NULL, -- Encrypted provider-specific configuration (API keys, etc.)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(name)
);

-- Domains table for managing domains with optional auto-management
CREATE TABLE domains (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain VARCHAR(255) NOT NULL,
    provider_id INTEGER NULL, -- Foreign key to dns_providers
    auto_manage BOOLEAN DEFAULT false, -- Whether to automatically manage DNS records
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(domain),
    FOREIGN KEY (provider_id) REFERENCES dns_providers(id) ON DELETE SET NULL
);

-- Domain verifications table for tracking domain ownership verification
CREATE TABLE domain_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain_id INTEGER NOT NULL,
    method VARCHAR(10) NOT NULL, -- A, CNAME, TXT
    challenge TEXT NOT NULL, -- Verification challenge data
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending, verified, failed
    last_checked_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE,
    CHECK (method IN ('A', 'CNAME', 'TXT')),
    CHECK (status IN ('pending', 'verified', 'failed'))
);

-- Enhanced certificates table (replaces basic certificates table)
CREATE TABLE certificates_enhanced (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    domain VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'acme', -- acme, uploaded
    issuer TEXT NULL, -- Certificate issuer (e.g., "Let's Encrypt")
    not_before DATETIME NULL, -- Certificate valid from
    not_after DATETIME NULL, -- Certificate valid until
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- active, expired, failed, pending
    pem_cert TEXT NULL, -- PEM certificate data
    pem_chain TEXT NULL, -- PEM certificate chain
    pem_key_enc TEXT NULL, -- Encrypted PEM private key
    pem_key_nonce TEXT NULL, -- AES-GCM nonce for key encryption
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    
    CHECK (type IN ('acme', 'uploaded')),
    CHECK (status IN ('active', 'expired', 'failed', 'pending'))
);

-- Create indexes for performance
CREATE INDEX idx_domains_domain ON domains(domain);
CREATE INDEX idx_certificates_enhanced_domain ON certificates_enhanced(domain);
CREATE INDEX idx_domain_verifications_domain_id ON domain_verifications(domain_id);
CREATE INDEX idx_domain_verifications_status ON domain_verifications(status);
CREATE INDEX idx_certificates_enhanced_status ON certificates_enhanced(status);
CREATE INDEX idx_certificates_enhanced_not_after ON certificates_enhanced(not_after);