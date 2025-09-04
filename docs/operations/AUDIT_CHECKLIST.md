# Audit Checklist

## Pre-Release Checklist

### Security Review
- [ ] No hardcoded secrets or tokens in code
- [ ] All user inputs validated and sanitized  
- [x] Error messages don't leak sensitive information
- [ ] Authentication and authorization working correctly
- [ ] SQL injection prevention via parameterized queries
- [x] Rate limiting implemented on API endpoints
- [ ] HTTPS enforced in production configurations
- [ ] Security headers configured (when Nginx added)

### Code Quality Review
- [ ] All functions under 50 lines
- [ ] No code duplication (DRY principle followed)
- [ ] Consistent error handling with context
- [x] Structured logging with zerolog fields
- [ ] No panics in library code
- [ ] Proper resource cleanup (defer statements)
- [ ] Race conditions prevented with proper synchronization

### Testing and Coverage
- [x] All new features have unit tests
- [x] Service detail functionality has comprehensive test coverage
- [x] Service networking features have comprehensive test coverage
- [x] Service links management functionality tested
- [x] RBAC restrictions tested for viewer/deployer roles
- [x] API error handling tested (NotFoundError mapping)
- [x] Database migrations tested for service_links table
- [x] Service alias generation utility functions tested
- [ ] Integration tests pass with real dependencies
- [ ] Code coverage ≥80% overall
- [ ] Performance tests show no regressions
- [ ] Memory leaks checked with pprof

### Documentation
- [x] API documentation updated (including search endpoints with operator syntax)
- [x] Service detail endpoint documented with new fields
- [x] Service networking endpoints documented (GET /network, GET/POST /links)
- [x] UI-LITE.md updated with Service Detail section
- [x] Service Networking section added to UI-LITE documentation
- [x] RBAC implications documented for service control actions
- [x] Service links management permissions documented
- [ ] Security implications documented
- [ ] Configuration examples provided
- [ ] Deployment guide updated
- [ ] CHANGELOG.md updated with user-facing changes
- [ ] Breaking changes clearly marked

### Build and Deploy
- [ ] Binary builds successfully with `make pack`
- [ ] Binary size under 10MB
- [ ] Static analysis tools pass (golangci-lint)
- [ ] Vulnerability scan passes (govulncheck)
- [ ] Container image scanned for vulnerabilities
- [ ] Deployment tested in staging environment

## Code Review Checklist

Copy this checklist into pull request descriptions:

```markdown
### Code Review Checklist
- [ ] **Functionality**: Code works as intended and handles edge cases
- [ ] **Security**: No security vulnerabilities or information leakage
- [ ] **Performance**: No performance regressions, efficient algorithms
- [ ] **Style**: Follows Go conventions and project coding standards
- [ ] **Tests**: Adequate test coverage with meaningful test cases  
- [ ] **Documentation**: Public APIs documented, complex logic explained
- [ ] **Error Handling**: Errors properly wrapped with context
- [ ] **Logging**: Uses structured logging with appropriate levels
- [ ] **Dependencies**: New dependencies justified and approved
- [ ] **Breaking Changes**: Backwards compatibility considered
```

## Security Audit Steps

### Static Analysis
```bash
make audit          # Run all quality checks
make vuln           # Check for known vulnerabilities  
golangci-lint run   # Comprehensive linting
```

### Runtime Analysis  
```bash
# Check for race conditions
go test -race ./...

# Profile memory usage
go tool pprof http://localhost:8080/debug/pprof/heap

# Check for goroutine leaks
go tool pprof http://localhost:8080/debug/pprof/goroutine
```

### Manual Review Areas
- Token handling and comparison logic
- Input validation for container configurations  
- SQL query construction
- File path handling and directory traversal prevention
- Docker socket access patterns
- Service links validation and RBAC enforcement
- Network information exposure in API responses
- Service alias generation security implications