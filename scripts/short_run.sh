#!/bin/bash
set -e

echo "🔍 Running quality checks..."

# Go fmt
echo -n "fmt: "
if go fmt ./... >/dev/null 2>&1; then
    echo "✅ passed"
else
    echo "❌ failed"
    exit 1
fi

# Go vet
echo -n "vet: "
if go vet ./... >/dev/null 2>&1; then
    echo "✅ passed" 
else
    echo "❌ failed"
    exit 1
fi

# golangci-lint
echo -n "lint: "
if golangci-lint run --timeout=2m >/dev/null 2>&1; then
    echo "✅ passed"
else
    echo "❌ failed"
    exit 1
fi

# govulncheck
echo -n "vuln: "
if govulncheck ./... >/dev/null 2>&1; then
    echo "✅ passed"
else
    echo "❌ failed"  
    exit 1
fi

echo "🎉 All quality checks passed!"