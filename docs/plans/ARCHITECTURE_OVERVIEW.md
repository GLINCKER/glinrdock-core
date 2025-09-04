# GLINRDOCK Architecture Overview

**AI Context Document** - Comprehensive architecture and feature summary for AI assistance

## 🚀 Project Overview

**GLINRDOCK** is a single-node container management platform optimized for Spring Boot applications with minimal resource footprint. It provides a complete DevOps solution with Docker orchestration, reverse proxy management, monitoring, and a modern web interface.

### Core Philosophy
- **Speed**: Fast startup and response times
- **Clarity**: Simple, readable codebase
- **Efficiency**: Minimal memory and CPU usage  
- **Simplicity**: Single binary deployment

## 🏗️ System Architecture

### Backend Architecture (Go 1.21+)

#### **Entry Point**
- `cmd/glinrdockd/main.go` - Application bootstrap and dependency injection
- Single binary deployment with embedded web assets
- Graceful shutdown with signal handling
- Configuration via environment variables

#### **Core Internal Modules** (`internal/`)

| Module | Purpose | Key Components |
|--------|---------|----------------|
| **api** | HTTP handlers & routing | 60+ API endpoints, middleware, validation |
| **store** | Data persistence layer | SQLite with FTS5 search, migrations |
| **auth** | Authentication & authorization | JWT tokens, RBAC (admin/deployer/viewer) |
| **docker** | Container orchestration | Docker API integration, network management |
| **nginx** | Reverse proxy management | Configuration generation, SSL/TLS |
| **crypto** | Secrets management | AES-GCM encryption for environment variables |
| **metrics** | Monitoring & observability | Prometheus metrics, historical data |
| **audit** | Activity logging | Security audit trails, compliance |
| **events** | Real-time updates | Docker event monitoring, WebSocket streams |
| **github** | CI/CD integration | GitHub App, webhook handling |
| **proxy** | Load balancing | Traffic routing, health checks |
| **certs** | SSL/TLS automation | Let's Encrypt, certificate lifecycle |

#### **Key Dependencies**
```go
// Web framework & HTTP
"github.com/gin-gonic/gin"
"net/http"

// Docker integration  
"github.com/docker/docker/client"

// Database & persistence
"modernc.org/sqlite"  // Embedded SQLite with FTS5

// Logging & monitoring
"github.com/rs/zerolog"
"github.com/prometheus/client_golang"

// Security & crypto
"golang.org/x/crypto"
"github.com/golang-jwt/jwt"
```

### Frontend Architecture (Preact + TypeScript)

#### **Technology Stack** (`web/ui-lite/`)
```json
{
  "framework": "Preact 10.19.3",
  "language": "TypeScript 5.2.2", 
  "bundler": "Vite 5.0.8",
  "routing": "wouter 2.12.1",
  "styling": "TailwindCSS 3.4.17",
  "charts": "lightweight-charts 5.0.8",
  "icons": "lucide-preact 0.542.0",
  "markdown": "markdown-to-jsx 7.7.13"
}
```

#### **Page Structure** (`src/pages/`)

| Page | Purpose | Features |
|------|---------|----------|
| **Dashboard** | System overview | Metrics, status indicators, quick actions |
| **Services** | Container management | Deploy, monitor, scale services |
| **Routes** | Traffic routing | Domain mapping, SSL, load balancing |
| **Projects** | Application grouping | Organize services by project |
| **Settings** | System configuration | Integrations, certificates, preferences |
| **Administration** | System admin | User management, audit logs, backups |
| **Logs** | Monitoring & debugging | Real-time logs, filtering, search |
| **Help** | Documentation | Searchable help system, guides |

#### **Component Architecture**
```
src/
├── components/         # Reusable UI components
│   ├── ui/            # Base components (Modal, Toast, CodeBlock)
│   ├── charts/        # Data visualization 
│   └── forms/         # Form controls & validation
├── pages/             # Route components
├── hooks/             # Custom React hooks
├── api.ts            # API client & types
└── router.tsx        # Route configuration
```

## 📊 Core Features & Capabilities

### 1. **Container Management**
- **Service Deployment**: Docker image deployment with configuration
- **Environment Variables**: Encrypted secrets-at-rest with AES-GCM
- **Port Management**: Dynamic port allocation and mapping
- **Registry Integration**: Private container registry support
- **Health Monitoring**: Service health checks and auto-recovery

### 2. **Reverse Proxy & Networking**
- **Nginx Integration**: Automatic configuration generation
- **SSL/TLS Automation**: Let's Encrypt certificate management
- **Domain Routing**: Path-based and host-based routing
- **Load Balancing**: Multiple backend service support
- **WebSocket Support**: Real-time connection proxying

### 3. **Monitoring & Observability**
- **Prometheus Metrics**: System and application metrics
- **Historical Data**: Time-series data storage and visualization
- **Real-time Dashboard**: Live system status and performance
- **Docker Events**: Container lifecycle monitoring
- **Audit Logging**: Security and compliance tracking

### 4. **Authentication & Security**
- **Role-Based Access Control**: Admin, Deployer, Viewer roles
- **JWT Authentication**: Secure token-based auth
- **API Token Management**: Programmatic access control
- **GitHub OAuth**: Single sign-on integration (planned)
- **Secrets Encryption**: AES-256 encryption for sensitive data

### 5. **CI/CD Integration**
- **GitHub App**: Repository integration and webhooks
- **Deployment Pipelines**: Automated deployment workflows
- **Build Triggers**: Git-based deployment automation
- **Environment Management**: Multi-stage deployment support

### 6. **Search & Documentation**
- **FTS5 Search**: Full-text search across all resources
- **Command Palette**: Global search interface (Cmd/Ctrl+K)
- **Help System**: Integrated documentation with markdown rendering
- **Search Registry**: Dynamic content indexing

### 7. **Developer Experience**
- **Modern UI**: Responsive design with dark/light modes
- **Real-time Updates**: WebSocket-based live updates
- **API-First**: Complete REST API for all functionality
- **Development Tools**: Hot reload, type safety, comprehensive testing

## 🔌 API Architecture

### REST API Endpoints (`/v1/`)

#### **System & Health**
- `GET /health` - Server health status
- `GET /system` - System information and Docker status
- `GET /metrics` - Prometheus metrics endpoint

#### **Authentication** (Role-based)
- `POST /tokens` - Create API tokens (Admin only)
- `GET /tokens` - List tokens (Admin only) 
- `DELETE /tokens/:name` - Remove token (Admin only)

#### **Core Resources**
```
Projects     /v1/projects/*       (Deployer+ for writes, Viewer+ for reads)
Services     /v1/services/*       (Deployer+ for writes, Viewer+ for reads)
Routes       /v1/routes/*         (Deployer+ for writes, Viewer+ for reads)
Environment  /v1/services/:id/env-vars/*  (Deployer+ for writes)
```

#### **Advanced Features**
```
Search       /v1/search/*         (Viewer+)
Certificates /v1/certs/*         (Admin only)
Metrics      /v1/metrics/*       (Viewer+)
GitHub       /v1/github/*        (Deployer+)
Webhooks     /v1/webhooks/*      (System)
Help         /v1/help/*          (Viewer+)
```

### Database Schema (SQLite + FTS5)

#### **Core Tables**
- `tokens` - API authentication tokens
- `projects` - Application project groupings  
- `services` - Container service definitions
- `routes` - Traffic routing configuration
- `env_vars` - Encrypted environment variables
- `certificates` - SSL/TLS certificate storage
- `audit_logs` - Security audit trail

#### **Search Infrastructure**
- `search_docs` - FTS5 full-text search index
- `search_reindex_log` - Search indexing history
- Support for entity types: services, routes, projects, help

## 🚀 Recent Implementations & Features

### **Help System Integration** ✅ *Recently Completed*
- **Full-text Search**: Help documents indexed in FTS5 with intelligent ranking
- **Command Palette**: Global search with Cmd/Ctrl+K shortcut
- **Markdown Rendering**: Professional documentation viewer with anchor navigation
- **Lazy Loading**: Code-split help components for performance
- **Purple Theme**: Consistent gradient-based design system

### **Nginx Management** ✅ *Recently Completed*
- **Admin Card**: Settings → Integrations management interface
- **Configuration Validation**: Real-time nginx config validation
- **Status Monitoring**: Live nginx status with hash tracking
- **Reload Functionality**: Safe nginx configuration reloading
- **Modal Viewer**: Active configuration preview with syntax highlighting

### **Monitoring Enhancements** ✅ *Recently Completed*
- **Historical Metrics**: Time-series data collection and storage
- **Real-time Charts**: Live performance visualization
- **System Dashboard**: Comprehensive system health overview
- **Docker Integration**: Container metrics and event monitoring

### **Security Features** ✅ *Production Ready*
- **Encrypted Secrets**: AES-GCM encryption for environment variables
- **RBAC System**: Role-based access control with JWT tokens
- **Audit Logging**: Comprehensive security event tracking
- **Certificate Management**: Automated SSL/TLS certificate lifecycle

## 🛠️ Development Setup

### **Quick Start**
```bash
# Start both frontend and backend
./dev-start.sh

# Or individually:
./dev-backend.sh   # Go server on :8080
./dev-frontend.sh  # Vite dev server on :5173
```

### **Development Environment**
- **Backend**: http://localhost:8080 (Go with hot reload)
- **Frontend**: http://localhost:5173 (Vite HMR)
- **Admin Token**: `test-token` (configurable)
- **Data Directory**: `./dev-data`

### **Quality Tools**
```bash
make audit       # Comprehensive quality audit
make vuln        # Security vulnerability scan
make test-race   # Race condition testing
make dev-setup   # Git hooks and linting
```

## 📁 Project Structure

```
glinrdock/
├── cmd/glinrdockd/           # Main application entry point
├── internal/                 # Private Go modules
│   ├── api/                 # HTTP handlers & routing (60+ files)
│   ├── store/               # Data persistence layer
│   ├── auth/                # Authentication & RBAC
│   ├── docker/              # Container orchestration
│   ├── nginx/               # Reverse proxy management
│   ├── crypto/              # Secrets encryption
│   └── [15+ other modules]
├── web/ui-lite/             # Frontend application
│   ├── src/pages/          # React components (20+ pages)
│   ├── src/components/     # Reusable UI components
│   └── src/api.ts         # API client & TypeScript types
├── appdocs/                # User-facing documentation
├── docs/                   # Technical documentation
├── scripts/                # Deployment & development scripts
└── configs/                # Configuration templates
```

## 🎯 Current Status & Roadmap

### **Production Ready Features** ✅
- Container management and orchestration
- Reverse proxy with SSL/TLS automation
- Authentication and role-based access control
- Monitoring and metrics collection
- Modern web interface with real-time updates
- Full-text search with help system integration
- Encrypted secrets management
- CI/CD pipeline integration

### **Recently Enhanced** 🆕
- **Help System**: Complete documentation integration with search
- **Nginx Management**: Admin interface for proxy configuration
- **Command Palette**: Global search with intelligent relevance
- **UI Polish**: Purple gradient theme with improved UX
- **Security**: Enhanced audit logging and access controls

### **Architecture Strengths**
- **Single Binary**: Easy deployment and maintenance
- **Resource Efficient**: Optimized for minimal footprint
- **Developer Friendly**: Hot reload, TypeScript, comprehensive tooling
- **Security First**: Encryption, RBAC, audit trails
- **Extensible**: Modular architecture with clean interfaces
- **Modern Stack**: Latest technologies with proven reliability

### **Use Cases**
- **Small to Medium Teams**: Perfect for development and staging environments
- **Spring Boot Applications**: Optimized deployment workflows
- **Edge Computing**: Lightweight single-node deployment
- **Development Environments**: Fast iteration and testing
- **Microservices**: Container orchestration without complexity

## 🤖 AI Assistant Context

When working with GLINRDOCK:

1. **Architecture**: Go backend with Preact frontend, SQLite persistence
2. **Recent Work**: Help system, nginx management, monitoring enhancements
3. **Code Style**: TypeScript, functional components, modular Go architecture
4. **Development**: Use provided dev scripts, follow existing patterns
5. **Testing**: Comprehensive test suite with race detection
6. **Documentation**: Dual system (appdocs/ for users, docs/ for technical)

The codebase demonstrates modern practices with clean architecture, strong type safety, comprehensive testing, and production-ready security features.

---

*Generated: 2025-01-13 - Architecture analysis for AI development assistance*