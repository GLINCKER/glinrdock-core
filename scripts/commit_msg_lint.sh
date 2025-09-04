#!/bin/bash
set -e

# Read the commit message
commit_msg=$(cat "$1")
first_line=$(echo "$commit_msg" | head -n1)

# Allowed conventional commit types
allowed_types="feat|fix|docs|test|refactor|perf|build|ci|chore|security"

# Conventional commit pattern: type(scope): description
pattern="^(${allowed_types})(\(.+\))?: .{1,50}$"

if [[ ! $first_line =~ $pattern ]]; then
    echo "❌ Commit message does not follow Conventional Commits format"
    echo ""
    echo "Current: $first_line"
    echo ""
    echo "Expected format: type(scope): description"
    echo ""
    echo "Allowed types: feat, fix, docs, test, refactor, perf, build, ci, chore, security"
    echo ""
    echo "Examples:"
    echo "  feat: add container health check endpoint"
    echo "  fix(auth): handle empty bearer token gracefully"
    echo "  docs: update API documentation"
    echo "  security: validate container name input"
    exit 1
fi

echo "✅ Commit message format is valid"