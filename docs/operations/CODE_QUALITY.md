# Code Quality Standards

## Required Patterns

### Logging with Zerolog
```go
// ✅ Good - structured fields
log.Info().Str("container_id", id).Int("port", 8080).Msg("container started")

// ❌ Bad - string concatenation  
log.Info().Msg("container " + id + " started on port " + strconv.Itoa(port))
```

### Error Handling
```go
// ✅ Good - wrap with context
return fmt.Errorf("failed to start container %s: %w", id, err)

// ❌ Bad - lose original error
return errors.New("container start failed")
```

## Size Guidelines

### Functions
- **Maximum**: 50 lines of code
- **Ideal**: 10-20 lines  
- **Exception**: Table-driven tests may be longer

### Files
- **Maximum**: 500 lines of code
- **Ideal**: 100-300 lines
- **Split**: When a single responsibility grows beyond limits

### Packages  
- **Focused**: Single clear responsibility
- **Minimal**: Avoid god packages
- **Testable**: Easy to mock and test in isolation

## Dependency Rules

### New Dependencies
- Must be approved by maintainers before adding
- Justify necessity and evaluate alternatives
- Prefer standard library solutions
- Consider binary size and build time impact

### Allowed Categories
- **Core**: HTTP, JSON, logging, database drivers
- **Testing**: Testify, HTTP testing utilities  
- **Security**: Crypto, validation libraries
- **Build**: Development and CI tools only

### Forbidden Categories
- Heavy frameworks (except Gin for HTTP)
- GUI toolkits
- Complex ORMs
- Bloated utility libraries

## Performance Budget

### Memory Usage
- **Idle**: < 20MB RSS
- **Per Request**: < 1MB additional allocation
- **Database**: Connection pooling with limits

### Response Times  
- **Health/System**: < 10ms p99
- **Container Operations**: < 100ms p99
- **Bulk Operations**: < 1s p99

### Profiling
```bash
# Enable pprof in development
go tool pprof http://localhost:8080/debug/pprof/heap
go tool pprof http://localhost:8080/debug/pprof/profile?seconds=30
```

## Code Organization

### Package Structure
```
internal/
├── api/           # HTTP handlers and routes
├── auth/          # Authentication logic  
├── container/     # Container management
├── store/         # Database operations
└── util/          # Shared utilities
```

### Naming Conventions
- **Packages**: Short, lowercase, no underscores
- **Types**: PascalCase, descriptive nouns
- **Functions**: PascalCase (exported), camelCase (private)
- **Constants**: ALL_CAPS for package-level constants