# glinrdock

A lightweight Docker container management system with nginx proxy support and minimal resource footprint.

## Quick Start

```bash
make build
make run
```

## API Preview

### Public Endpoints
- `GET /v1/health` - Server health status
- `GET /v1/system` - System information including Docker status

### Protected Endpoints (require Bearer token with appropriate role)
- `POST /v1/tokens` - Create API tokens (**Admin only**)
- `GET /v1/tokens` - List tokens (**Admin only**)
- `DELETE /v1/tokens/:name` - Remove token (**Admin only**)
- `POST /v1/projects` - Create project (**Deployer+**)
- `GET /v1/projects` - List projects (**Viewer+**)
- `GET /v1/projects/:id` - Get project (**Viewer+**)
- `DELETE /v1/projects/:id` - Remove project (**Deployer+**)
- `POST /v1/certs/issue` - Issue HTTPS certificates (**Admin only**)
- `GET /v1/certs` - List certificates (**Admin only**)
- `POST /v1/certs/:domain/renew` - Renew certificate (**Admin only**)
- `POST /v1/system/backup` - Create system backup (**Admin only**)
- `POST /v1/system/restore` - Restore from backup (**Admin only**)
- `GET /v1/metrics` - Prometheus metrics (**Viewer+**)

See [docs/reference/API.md](docs/reference/API.md) for complete API reference.

## Encrypted Secrets-at-Rest

glinrdock supports encrypted environment variables for sensitive configuration data:

### Quick Setup
```bash
# Generate a secure encryption key
export GLINRDOCK_SECRET=$(openssl rand -base64 32)

# Start glinrdock with encryption enabled
./glinrdockd
```

### API Endpoints
- `GET /v1/services/:id/env-vars` - List environment variables (role-based masking)
- `PUT /v1/services/:id/env-vars` - Set single environment variable (**Deployer+**)
- `POST /v1/services/:id/env-vars/bulk` - Set multiple environment variables (**Deployer+**)
- `DELETE /v1/services/:id/env-vars/:key` - Delete environment variable (**Deployer+**)

### Security Features
- **AES-GCM encryption** with 256-bit keys
- **Role-based access control** - secrets are masked for viewers
- **Authenticated encryption** prevents tampering
- **Unique nonces** for each encryption operation

See [docs/reference/SECRETS_API.md](docs/reference/SECRETS_API.md) for detailed documentation.

## Quality and Security

We maintain high standards for code quality, security, and reliability:

### Running Quality Checks
```bash
make audit       # Run comprehensive quality audit
make vuln        # Check for known vulnerabilities
make test-race   # Run tests with race detection
```

### Development Setup

#### Quick Start for Local Development

For the fastest development experience, use our startup scripts:

```bash
# Start both frontend and backend together
./dev-start.sh

# Or start individually in separate terminals:
./dev-backend.sh   # Backend only (Go server on port 8080)
./dev-frontend.sh  # Frontend only (Vite dev server on port 5173)
```

**Default Configuration:**
- **Backend**: http://localhost:8080 (Go server with hot reload)
- **Frontend**: http://localhost:5173 (Vite dev server with HMR)
- **Admin Token**: `test-token` (configurable via `ADMIN_TOKEN` env var)
- **Data Directory**: `./dev-data` (configurable via `DATA_DIR` env var)
- **Encryption Key**: Auto-generated for secrets (configurable via `GLINRDOCK_SECRET` env var)

#### Prerequisites

- **Go 1.21+** - Backend development
- **Node.js 18+** - Frontend development
- **Docker** - Container management (optional for basic dev)

#### Development Tools Setup
```bash
make dev-setup   # Install git hooks and development tools
```

This will install lefthook git hooks that automatically:
- Validate commit message format (Conventional Commits)
- Run `go fmt`, `go vet`, and `golangci-lint` on pre-commit
- Run tests with race detection on pre-push

#### Troubleshooting Development Issues

**Port Already in Use:**
```bash
# The scripts automatically handle this, but if you need manual cleanup:
lsof -ti:8080 | xargs kill -9    # Kill backend processes
lsof -ti:5173 | xargs kill -9    # Kill frontend processes
```

**Backend Won't Start:**
```bash
# Check Go installation and dependencies
go version
go mod download
go mod verify

# Test backend directly
make run
```

**Frontend Won't Start:**
```bash
# Check Node.js and install dependencies
node --version
npm --version
cd web/ui-lite && npm install

# Test frontend directly
cd web/ui-lite && npm run dev
```

**API Connection Issues:**
```bash
# Test backend health endpoint
curl http://localhost:8080/v1/health

# Test with authentication
curl -H "Authorization: Bearer test-token" \
     http://localhost:8080/v1/system
```

**Database/Data Issues:**
```bash
# Reset development database
rm -rf ./dev-data
./dev-backend.sh  # Will recreate with migrations
```

**Build Issues:**
```bash
# Clean and rebuild everything
make clean
make build

# Run quality checks
make audit
make test
```

### Security Documentation
- [RBAC (Role-Based Access Control)](docs/reference/RBAC.md) - Multi-user roles and permissions
- [Security Policy](docs/reference/SECURITY.md) - Vulnerability reporting and runtime hardening
- [Threat Model](docs/concepts/THREAT_MODEL.md) - System risks and mitigations
- [Certificate Management](docs/reference/CERTS.md) - HTTPS certificate automation and troubleshooting
- [Code Quality Standards](docs/operations/CODE_QUALITY.md) - Coding patterns and guidelines

## Goals

- **Speed**: Fast startup and response times
- **Clarity**: Simple, readable codebase
- **Efficiency**: Minimal memory and CPU usage
- **Simplicity**: Single binary deployment

## Non-Goals

- Multi-node orchestration
- Complex service mesh features
- Heavy resource consumption
- Complex configuration

## First Admin Token Bootstrap

On first run, set the `ADMIN_TOKEN` environment variable to create an initial admin token:

```bash
ADMIN_TOKEN=your-strong-secret make run
```

This automatically creates an "admin" token in the database. Use this token to create additional tokens via the API.

### Example API Usage

```bash
# Create a new deployer token (admin only)
curl -H "Authorization: Bearer your-strong-secret" \
  -X POST http://localhost:8080/v1/tokens \
  -H "Content-Type: application/json" \
  -d '{"name": "ci-deployer", "plain": "ci-secret", "role": "deployer"}'

# Create a project (deployer+ role required)
curl -H "Authorization: Bearer ci-secret" \
  -X POST http://localhost:8080/v1/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "demo-app"}'

# List projects (viewer+ role required)
curl -H "Authorization: Bearer ci-secret" \
  http://localhost:8080/v1/projects
```

## Monitoring

glinrdock exposes Prometheus-compatible metrics for observability:

```bash
# Get metrics (requires authentication)
curl -H "Authorization: Bearer <token>" \
  http://localhost:8080/v1/metrics
```

Metrics include system health, service status, build/deployment statistics, and job queue monitoring. See [docs/reference/METRICS.md](docs/reference/METRICS.md) for complete metrics documentation and Grafana dashboard examples.

## Documentation

**App Help (in-product)**: User-friendly help documentation at [appdocs/README.md](appdocs/README.md)

**Technical Documentation**: For comprehensive guides, API reference, and operational procedures, see [docs/README.md](docs/README.md)

For community support, issues, and release announcements, visit the [glinrdock-release](https://github.com/GLINCKER/glinrdock-release) repository.