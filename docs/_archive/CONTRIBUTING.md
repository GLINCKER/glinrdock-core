# Contributing

## Coding Style

- **Formatting**: Use `go fmt` - idiomatic Go only
- **Package names**: Short and all lowercase (e.g., `util`, `store`, `api`)
- **Globals**: Avoid globals, use dependency injection via small constructors
- **Functions**: Keep functions short and focused on single responsibility

## Commit Style

- Use conventional commit format for titles
- Include clear body explaining the "why" behind changes
- Example: `feat: add container health check endpoint`

## Testing Guidelines

- **Unit tests**: Fast and isolated, should be the default
- **Integration tests**: Use build tags and can run locally with real dependencies
- **Coverage**: Aim for >80% on critical paths

## Review Checklist

- [ ] Code compiles and tests pass locally
- [ ] Public APIs have comments following Go conventions
- [ ] Logs use structured fields, not string concatenation
- [ ] Errors wrap original cause with context using `fmt.Errorf`
- [ ] No `panic()` calls in library code
- [ ] No long-running goroutines without context cancellation

## Pre-commit Setup (Optional)

Install pre-commit hooks to run formatting and linting automatically:

```bash
pip install pre-commit
pre-commit install
```

This will run `go fmt`, `go vet`, and `golangci-lint` before each commit.