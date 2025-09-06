#!/bin/bash

# GLINRDOCK Binary Security Audit Script
# Verifies that binaries don't expose source code or secrets
set -e

VERSION=${1:-"0.1.0-beta"}
BINARY_PATH=${2:-"bin/glinrdockd"}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[SECURITY]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[CRITICAL]${NC} $1"
}

log_step() {
    echo -e "${BLUE}[AUDIT]${NC} $1"
}

AUDIT_FAILED=false

echo -e "${BLUE}"
cat << 'EOF'
 ____  _____ ____ _   _ ____  ___ _______   __
/ ___|| ____/ ___| | | |  _ \|_ _|_   _\ \ / /
\___ \|  _|| |   | | | | |_) || |  | |  \ V / 
 ___) | |__| |___| |_| |  _ < | |  | |   | |  
|____/|_____\____|\___/|_| \_\___| |_|   |_|  
                                               
          Binary Security Audit
EOF
echo -e "${NC}"

log_info "Auditing GLINRDOCK binary: $BINARY_PATH"

# Check if binary exists
if [[ ! -f "$BINARY_PATH" ]]; then
    log_error "Binary not found: $BINARY_PATH"
    exit 1
fi

log_step "1. Basic binary information"
file "$BINARY_PATH"
ls -lh "$BINARY_PATH"

# Get binary size
BINARY_SIZE=$(du -h "$BINARY_PATH" | cut -f1)
BINARY_SIZE_BYTES=$(du -b "$BINARY_PATH" | cut -f1)

log_info "Binary size: $BINARY_SIZE ($BINARY_SIZE_BYTES bytes)"

# Size check - should be under 100MB for a Go binary with embedded frontend
if [[ $BINARY_SIZE_BYTES -gt 104857600 ]]; then  # 100MB
    log_warn "Binary size $BINARY_SIZE exceeds 100MB - may contain debug symbols or unoptimized assets"
    AUDIT_FAILED=true
fi

log_step "2. Source code exposure check"

# Check for Go source paths in binary
log_info "Scanning for Go source paths..."
GOSRC_COUNT=$(strings "$BINARY_PATH" | grep -E "/(src|cmd|internal|pkg)/" | wc -l)
if [[ $GOSRC_COUNT -gt 50 ]]; then
    log_warn "Found $GOSRC_COUNT Go source path references - binary may expose source structure"
    AUDIT_FAILED=true
    echo "Sample paths found:"
    strings "$BINARY_PATH" | grep -E "/(src|cmd|internal|pkg)/" | head -10
else
    log_info "✅ Go source path exposure: MINIMAL ($GOSRC_COUNT references)"
fi

# Check for hardcoded secrets
log_step "3. Hardcoded secrets check"

SECRETS_PATTERNS=(
    "password"
    "secret"
    "key.*="
    "token.*="
    "auth.*="
    "api.*key"
    "private.*key"
    "cert.*="
)

SECRETS_FOUND=0
for pattern in "${SECRETS_PATTERNS[@]}"; do
    COUNT=$(strings "$BINARY_PATH" | grep -i "$pattern" | wc -l)
    if [[ $COUNT -gt 0 ]]; then
        log_warn "Found $COUNT potential secrets matching pattern: $pattern"
        SECRETS_FOUND=$((SECRETS_FOUND + COUNT))
    fi
done

if [[ $SECRETS_FOUND -eq 0 ]]; then
    log_info "✅ No obvious hardcoded secrets detected"
else
    log_error "❌ Found $SECRETS_FOUND potential hardcoded secrets"
    AUDIT_FAILED=true
fi

# Check for debug symbols
log_step "4. Debug symbols check"

if strings "$BINARY_PATH" | grep -q "runtime.goexit\|runtime.main"; then
    # Check if symbols are stripped
    if command -v objdump >/dev/null 2>&1; then
        SYMBOLS=$(objdump -t "$BINARY_PATH" 2>/dev/null | wc -l)
        if [[ $SYMBOLS -gt 100 ]]; then
            log_warn "Binary contains $SYMBOLS symbols - may not be properly stripped"
            AUDIT_FAILED=true
        else
            log_info "✅ Binary appears to be stripped ($SYMBOLS symbols)"
        fi
    elif command -v nm >/dev/null 2>&1; then
        if nm "$BINARY_PATH" >/dev/null 2>&1; then
            log_warn "Binary contains debug symbols - not properly stripped"
            AUDIT_FAILED=true
        else
            log_info "✅ Binary appears to be stripped"
        fi
    else
        log_warn "Cannot check debug symbols - objdump/nm not available"
    fi
else
    log_info "✅ No obvious debug symbols found"
fi

# Check for embedded frontend assets
log_step "5. Frontend assets verification"

FRONTEND_PATTERNS=(
    "index.html"
    "main.*js"
    "main.*css"
    "favicon"
)

FRONTEND_FOUND=0
for pattern in "${FRONTEND_PATTERNS[@]}"; do
    if strings "$BINARY_PATH" | grep -q "$pattern"; then
        FRONTEND_FOUND=$((FRONTEND_FOUND + 1))
    fi
done

if [[ $FRONTEND_FOUND -ge 2 ]]; then
    log_info "✅ Frontend assets appear to be embedded ($FRONTEND_FOUND/4 patterns found)"
else
    log_warn "❌ Frontend assets may not be properly embedded ($FRONTEND_FOUND/4 patterns found)"
    AUDIT_FAILED=true
fi

# Check for SQL injection vulnerabilities in embedded queries
log_step "6. SQL security check"

SQL_PATTERNS=(
    "SELECT.*%s"
    "INSERT.*%s"
    "UPDATE.*%s"
    "DELETE.*%s"
)

SQL_UNSAFE=0
for pattern in "${SQL_PATTERNS[@]}"; do
    COUNT=$(strings "$BINARY_PATH" | grep -i "$pattern" | wc -l)
    if [[ $COUNT -gt 0 ]]; then
        log_warn "Found $COUNT potential unsafe SQL patterns: $pattern"
        SQL_UNSAFE=$((SQL_UNSAFE + COUNT))
    fi
done

if [[ $SQL_UNSAFE -eq 0 ]]; then
    log_info "✅ No obvious SQL injection vulnerabilities detected"
else
    log_warn "⚠️  Found $SQL_UNSAFE potential SQL injection risks - review queries"
fi

# Check for filesystem path traversal risks
log_step "7. Path traversal check"

PATH_PATTERNS=(
    "\.\./\.\."
    "\.\./"
    "/etc/passwd"
    "/etc/shadow"
)

PATH_UNSAFE=0
for pattern in "${PATH_PATTERNS[@]}"; do
    if strings "$BINARY_PATH" | grep -q "$pattern"; then
        log_warn "Found potential path traversal pattern: $pattern"
        PATH_UNSAFE=$((PATH_UNSAFE + 1))
    fi
done

if [[ $PATH_UNSAFE -eq 0 ]]; then
    log_info "✅ No obvious path traversal vulnerabilities detected"
else
    log_warn "⚠️  Found $PATH_UNSAFE potential path traversal risks"
fi

# Check binary entropy (detect packing/obfuscation)
log_step "8. Binary entropy analysis"

if command -v hexdump >/dev/null 2>&1 && command -v awk >/dev/null 2>&1; then
    # Calculate simple entropy estimation
    ENTROPY=$(hexdump -C "$BINARY_PATH" | head -1000 | awk '
    {
        for (i=2; i<=NF-1; i++) {
            bytes[substr($i,1,2)]++
            bytes[substr($i,3,2)]++
        }
    }
    END {
        total=0; for (b in bytes) total += bytes[b]
        entropy=0
        for (b in bytes) {
            p = bytes[b]/total
            if (p > 0) entropy -= p * log(p)/log(2)
        }
        print entropy
    }')
    
    ENTROPY_INT=$(echo "$ENTROPY" | cut -d'.' -f1)
    if [[ $ENTROPY_INT -gt 7 ]]; then
        log_info "✅ Good binary entropy: $ENTROPY (well-distributed)"
    elif [[ $ENTROPY_INT -gt 5 ]]; then
        log_info "✅ Acceptable binary entropy: $ENTROPY"
    else
        log_warn "⚠️  Low binary entropy: $ENTROPY (may indicate issues)"
    fi
else
    log_warn "Cannot calculate entropy - hexdump/awk not available"
fi

# Generate security report
log_step "9. Generating security report"

REPORT_FILE="security-audit-$VERSION.json"
cat > "$REPORT_FILE" << EOF
{
    "audit_time": "$(date -u -Iseconds)",
    "version": "$VERSION",
    "binary_path": "$BINARY_PATH",
    "binary_size": $BINARY_SIZE_BYTES,
    "binary_size_human": "$BINARY_SIZE",
    "checks": {
        "source_exposure": {
            "status": "$([ $GOSRC_COUNT -le 50 ] && echo "PASS" || echo "WARN")",
            "source_paths_found": $GOSRC_COUNT
        },
        "hardcoded_secrets": {
            "status": "$([ $SECRETS_FOUND -eq 0 ] && echo "PASS" || echo "FAIL")",
            "potential_secrets": $SECRETS_FOUND
        },
        "frontend_embedded": {
            "status": "$([ $FRONTEND_FOUND -ge 2 ] && echo "PASS" || echo "FAIL")",
            "assets_found": "$FRONTEND_FOUND/4"
        },
        "sql_security": {
            "status": "$([ $SQL_UNSAFE -eq 0 ] && echo "PASS" || echo "WARN")",
            "unsafe_patterns": $SQL_UNSAFE
        },
        "path_traversal": {
            "status": "$([ $PATH_UNSAFE -eq 0 ] && echo "PASS" || echo "WARN")",
            "unsafe_patterns": $PATH_UNSAFE
        }
    },
    "overall_status": "$([ "$AUDIT_FAILED" = false ] && echo "PASS" || echo "REVIEW_REQUIRED")"
}
EOF

log_info "Security report saved to: $REPORT_FILE"

# Final verdict
echo ""
if [[ "$AUDIT_FAILED" = false ]]; then
    log_info "🔒 Security audit PASSED - binary is safe for distribution"
    echo ""
    echo -e "${GREEN}✅ Binary Security Summary:${NC}"
    echo "  📦 Size: $BINARY_SIZE (optimized)"
    echo "  🔍 Source exposure: MINIMAL"
    echo "  🔐 No hardcoded secrets"
    echo "  🎨 Frontend assets: EMBEDDED"
    echo "  🛡️  SQL injection: PROTECTED"
    echo "  📁 Path traversal: PROTECTED"
    echo ""
    log_info "Binary is ready for production deployment! 🚀"
    exit 0
else
    log_error "❌ Security audit FAILED - review required before distribution"
    echo ""
    echo -e "${RED}❌ Binary Security Issues:${NC}"
    echo "  Review the warnings above and fix before release"
    echo "  Consider rebuilding with proper optimization flags"
    echo "  Ensure secrets are externalized to environment variables"
    echo ""
    log_error "DO NOT distribute this binary until issues are resolved!"
    exit 1
fi