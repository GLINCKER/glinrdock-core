# Development Plan

## Phase 1: Foundation ✅ COMPLETED

- [x] **Repository Architecture & Go Module Setup**
  - [x] Go module initialization with github.com/GLINCKER/glinrdock
  - [x] Clean project structure: cmd/, internal/, web/, docs/, configs/
  - [x] Main server entry point with graceful shutdown and context cancellation
  - [x] CLI placeholder (glinrdockctl) with version printing and clean exit
- [x] **Core HTTP Server & API Foundation**
  - [x] Gin framework in release mode with zerolog structured logging
  - [x] Health endpoint (GET /v1/health) with uptime and version reporting
  - [x] System endpoint (GET /v1/system) with Go version, OS/arch, Docker status
  - [x] CORS middleware with configurable origins from GLINRDOCK_CORS_ORIGINS
  - [x] Bearer token authentication middleware for write operations
- [x] **Configuration & Environment Management**
  - [x] Environment-based config loader with sane defaults
  - [x] Configuration values: ADMIN_TOKEN, DATA_DIR, HTTP_ADDR, LOG_LEVEL, CORS_ORIGINS
  - [x] Structured logging with configurable levels and JSON output
- [x] **Database Foundation & Storage**
  - [x] SQLite integration with PRAGMA foreign_keys = ON for referential integrity
  - [x] Store scaffolding with DATA_DIR creation and migration framework
  - [x] Context-based store operations for proper request lifecycle management
  - [x] Database abstraction layer with interface-based design
- [x] **Build System & Deployment**
  - [x] CGO disabled builds for static binary compilation
  - [x] Build flags: `-a -installsuffix cgo -ldflags "-s -w"` for size optimization
  - [x] "pack" target creating stripped binary under 10MB
  - [x] CI pipeline with build, fmt, vet, lint, and test validation
- [x] **Testing Infrastructure**
  - [x] Mock-based testing preventing external Docker dependencies
  - [x] Interface abstractions enabling comprehensive unit testing
  - [x] Test coverage for core HTTP endpoints and configuration loading

## Phase 2A: Core Container Management ✅ COMPLETED

- [x] **Docker Client Integration**
  - [x] Docker SDK for Go integration with connection pooling
  - [x] Context-aware Docker operations with timeout handling
  - [x] Docker daemon health checking and status monitoring
  - [x] Container inspection and metadata retrieval
- [x] **Project & Service Management**
  - [x] Project CRUD operations with SQLite persistence and foreign key constraints
  - [x] Service CRUD with Docker image, port, and environment variable configuration
  - [x] Service-to-project relationship management with cascading deletes
  - [x] Database transaction support for atomic operations
- [x] **Authentication & API Foundation**
  - [x] Bearer token-based authentication middleware
  - [x] SHA-256 token hashing for secure storage
  - [x] Token verification with database lookup and timing-safe comparison
  - [x] Protected API endpoints with authentication requirements
- [x] **Traffic Routing System**
  - [x] Route CRUD operations with domain-to-service mapping
  - [x] Port-based routing configuration for container access
  - [x] Route validation and conflict detection
  - [x] Database persistence of routing rules with indexing
- [x] **Container Lifecycle Management**
  - [x] Docker container creation with image pulling and port mapping
  - [x] Container start/stop/restart operations with status tracking
  - [x] Container removal and cleanup with volume management
  - [x] Error handling and graceful failure recovery
- [x] **Testing Infrastructure**
  - [x] Comprehensive test coverage using Docker client mocks
  - [x] Database integration tests with SQLite in-memory mode
  - [x] API endpoint testing with HTTP request mocking
  - [x] Authentication middleware testing with token validation

## Phase 2B: Advanced Container Features ✅ COMPLETED

- [x] **Real-Time Logging System**
  - [x] WebSocket-based container log streaming with multiplexed connections
  - [x] Docker logs API integration with follow mode and timestamps
  - [x] Client connection management with graceful cleanup
  - [x] Log filtering and formatting for web display
- [x] **Container Statistics Monitoring**
  - [x] Real-time CPU, memory, and network statistics collection
  - [x] Docker stats API integration with streaming updates
  - [x] Resource usage calculation and percentage formatting
  - [x] WebSocket delivery of statistics to frontend clients
- [x] **Event System & Lifecycle Tracking**
  - [x] Docker event stream integration for container lifecycle monitoring
  - [x] Event filtering and categorization (start, stop, die, kill)
  - [x] Event broadcasting to WebSocket clients for real-time updates
  - [x] Container state change detection and notification
- [x] **Advanced Routing & Load Balancing**
  - [x] Domain-based routing with subdomain and path matching
  - [x] Multi-service routing with load balancing support
  - [x] Route priority and fallback configuration
  - [x] SSL termination and HTTPS redirect handling
- [x] **Nginx Integration & Configuration**
  - [x] Dynamic Nginx configuration generation from route database
  - [x] Upstream server configuration with health checks
  - [x] Nginx reload automation for configuration updates
  - [x] Reverse proxy setup with proper headers and caching
- [x] **Health Monitoring & Status Tracking**
  - [x] Container health check integration with Docker HEALTHCHECK
  - [x] Service availability monitoring with HTTP endpoint checks
  - [x] Health status aggregation and dashboard display
  - [x] Alerting and notification system for service failures

## Phase 2F: Web UI Prototype (HTMX) ✅ COMPLETED

- [x] Server-rendered HTML templates with HTMX integration
- [x] Interactive dashboard with real-time updates
- [x] Project and service management forms
- [x] WebSocket integration for live logs and statistics
- [x] Responsive design with CSS styling
- [x] Form-based CRUD operations without page refreshes

## Phase 3A: CI/CD Pipeline ✅ COMPLETED

- [x] **Database Schema & Build Tracking**
  - [x] Build table with status, logs, timestamps, and Git metadata
  - [x] Deployment table linking builds to services with rollback support
  - [x] Job queue system for background processing with status tracking
  - [x] Foreign key relationships ensuring data integrity
- [x] **BuildKit Integration & Docker Management**
  - [x] BuildKit-based Docker image building with streaming build logs
  - [x] Context-aware builds from Git repositories with commit tracking
  - [x] Real-time build progress via WebSocket connections
  - [x] Build artifact management and image tagging
- [x] **Background Job Processing**
  - [x] Asynchronous job queue with worker pool architecture
  - [x] Build and deployment job types with progress tracking
  - [x] Job status management (pending, running, completed, failed)
  - [x] Graceful job cancellation and cleanup mechanisms
- [x] **Git Integration & Webhooks**
  - [x] GitHub webhook integration with HMAC-SHA256 signature verification
  - [x] Automatic build triggers on push events to configured branches
  - [x] Git metadata extraction (commit hash, author, message, branch)
  - [x] Webhook validation and error handling with structured logging
- [x] **Deployment & Rollback System**
  - [x] One-click deployment with service updates and health checks
  - [x] Automatic rollback functionality to previous working deployments
  - [x] Deployment history tracking with success/failure status
  - [x] Container recreation with new images and configuration updates
- [x] **Testing & Quality Assurance**
  - [x] Comprehensive test coverage using Docker client mocks
  - [x] Build service unit tests with fake Git repositories
  - [x] Webhook signature validation testing
  - [x] Job queue and background processing tests

## Phase 3C: Role-Based Access Control (RBAC) ✅ COMPLETED

- [x] **Database Schema Enhancement**
  - [x] Added `role` column to tokens table with NOT NULL constraint
  - [x] Performance index on role column for fast permission checks
  - [x] Backward-compatible migration system with default admin role
  - [x] SHA-256 token hashing for enhanced security
- [x] **Four-Tier Role Hierarchy System**
  - [x] Admin role: Full system access including token/certificate management
  - [x] User role: Service and project management with deployment capabilities
  - [x] Viewer role: Read-only access to all resources and metrics
  - [x] Client role: Limited access for external integrations
- [x] **Authentication & Authorization Middleware**
  - [x] Enhanced bearer token validation with role extraction
  - [x] Hierarchical permission system (admin > user > viewer > client)
  - [x] RequireRole middleware for endpoint-level access control
  - [x] Bootstrap admin token creation from ADMIN_TOKEN environment variable
- [x] **API Endpoint Protection**
  - [x] Token management endpoints (admin-only): POST/GET/DELETE /v1/tokens
  - [x] Project/Service CRUD operations (user+ required for mutations)
  - [x] Route management with deployer-level permissions
  - [x] CI/CD operations restricted to user+ roles
  - [x] System operations and certificate management (admin-only)
- [x] **Security & Token Management**
  - [x] Secure token generation with cryptographic randomness
  - [x] Token usage tracking with last_used_at timestamps
  - [x] Role validation during token creation with proper error handling
  - [x] Comprehensive RBAC testing with mock-based approach

## Phase 3D: UI-Lite Interactive Dashboard ✅ COMPLETED

- [x] Static UI-Lite SPA with routing and modern styling  
- [x] Tailwind CSS integration with component library
- [x] Client-side routing for multi-page navigation
- [x] **Modern Component Architecture (2025)**
  - [x] Reusable Sidebar component with mobile responsiveness
  - [x] SVG icon system replacing emoji (lightweight & scalable)
  - [x] Responsive mobile-first design with collapsible navigation
  - [x] Modern UI patterns with backdrop blur effects
  - [x] Professional icon system with GLINR brand colors
  - [x] Improved sidebar layout with settings moved to bottom
  - [x] Fixed mobile blur effects and icon visibility
- [x] **API Integration & Real Data** 
  - [x] API client with authentication and error handling
  - [x] Connect dashboard stats to backend endpoints
  - [x] Real-time system health and metrics display
  - [x] Real project/service/route counts from backend
  - [x] Proper Go duration string parsing for uptime display
  - [x] System version formatting (v1.21.0 instead of go1.21.0)
- [x] **UI/UX Improvements (December 2024)**
  - [x] TopToolbar with live metrics and auto-refresh (30s intervals)
  - [x] Professional SVG icons replacing all emojis
  - [x] GLINR brand color integration (#ffaa40, #9c40ff, #8b008b, #e94057)
  - [x] Theme toggle component in TopToolbar
  - [x] Responsive design with progressive disclosure
  - [x] Fixed mobile sidebar backdrop blur
  - [x] Enhanced icon visibility in dark mode
- [ ] **Project Management Interface**
  - [ ] Project list page with real data
  - [ ] Modal-based project creation form
  - [ ] Project deletion with confirmation
  - [ ] Basic project details view
- [ ] **Service Management Interface**
  - [ ] Service list with real status indicators
  - [ ] Modal-based service deployment form
  - [ ] Start/stop/restart service controls with feedback
  - [ ] Basic log viewer modal (last 50 lines)
  - [ ] Service metrics display
- [ ] **Route Management**
  - [ ] Route list page with real data
  - [ ] Simple route creation (domain → service mapping)
  - [ ] Route status indicators
- [ ] **Enhanced UX Features**
  - [ ] Modal component system for forms
  - [ ] Toast notifications for user feedback
  - [x] Loading states and skeleton components
  - [x] Error boundaries and graceful degradation
  - [x] Bundle size optimization (18.39KB JS, 6.52KB CSS gzipped)

### **Preact Ecosystem Improvements for 2025**

**Recommended Libraries & Enhancements:**
- [ ] **State Management**: Consider @deepsignal/preact for complex state (currently using built-in hooks)
- [ ] **Routing**: Upgrade to TanStack Router for type-safe routing (if needed beyond current wouter)
- [ ] **Performance**: Implement code splitting with preact/async-route for dynamic imports
- [ ] **Development**: Add Storybook for component development and documentation
- [ ] **Hooks**: Consider hooked-head for SEO improvements (meta tags, titles)
- [ ] **Bundle Optimization**: Target <35KB total gzipped (current: 23KB gzipped)

**Current Stack Performance (December 2024):**
- ✅ Preact: 3KB (vs React 45KB) - 93% size reduction
- ✅ Bundle: 24.91KB gzipped total (JS: 18.39KB, CSS: 6.52KB)
- ✅ Mobile-first responsive design with fixed blur effects
- ✅ Modern component patterns with GLINR brand identity
- ✅ Professional SVG icon system
- ✅ Theme toggle component (foundation for future themes)

**SCOPE FOR LITE VERSION:**
- ✅ **Include**: Basic CRUD via modals, essential monitoring
- ❌ **Exclude**: SSL/TLS management (→ Heavy NextJS app)
- ❌ **Exclude**: Advanced metrics/charts (→ Heavy NextJS app)  
- ❌ **Exclude**: Multi-environment management (→ Heavy NextJS app)
- ❌ **Exclude**: User management beyond current token (→ Heavy NextJS app)

## Phase 3E: Modern UI Redesign & Theme System ✅ COMPLETED (January 2025)

- [x] **Advanced Theme System with Persistence**
  - [x] Three-mode theme toggle: System → Light → Dark → System
  - [x] localStorage persistence with system preference detection
  - [x] Real-time system theme change listeners
  - [x] Tailwind `darkMode: 'class'` configuration
  - [x] Comprehensive light/dark mode responsive classes
- [x] **Complete UI Redesign - Dashboard**
  - [x] Removed loading spinners, replaced with skeleton states
  - [x] Professional shadows replacing left border lines on cards
  - [x] GLINR brand color shadows (#9c40ff, #8b008b, #e94057, #10b981)
  - [x] Fixed light mode readability (text-gray-900 dark:text-white patterns)
  - [x] Enhanced card hover effects and interactions
- [x] **Complete UI Redesign - Projects Page**
  - [x] Modern header with gradient text effects
  - [x] Info cards explaining project benefits
  - [x] Professional project cards with shadow effects
  - [x] Enhanced empty states with better messaging
  - [x] Mobile-responsive design patterns
- [x] **Complete UI Redesign - Services Page**
  - [x] Full rewrite due to JSX syntax errors
  - [x] Modern layout with info cards and project selection
  - [x] Professional service cards with action buttons
  - [x] Multiple empty states for different scenarios
  - [x] Click-to-build suggestions for Docker images and ports
- [x] **Navigation & Branding Improvements**
  - [x] Updated Services icon from microphone to container icon
  - [x] Version display moved from topbar to sidebar (next to logo)
  - [x] Platform as a Service (PaaS) branding integration
  - [x] Enhanced topbar with gradient backgrounds
  - [x] Professional SVG icon system consistency
- [x] **Technical Debt Resolution**
  - [x] Fixed duplicate CSS definitions overriding light mode
  - [x] Resolved JSX syntax errors with complete component rewrites
  - [x] Systematic text color updates for light mode compatibility
  - [x] Removed unused imports and cleaned up TypeScript errors

## Phase 3F: Administration & Emergency Management ✅ COMPLETED (August 2025)

- [x] **Role-Based Access Control (RBAC) System**
  - [x] Database schema with role column and performance indexes
  - [x] Four-tier role system: admin, user, viewer, client
  - [x] Enhanced authentication middleware with RequireRole functionality
  - [x] Hierarchical permission system with role validation
  - [x] API protection with role-based access control
- [x] **Token Management System**
  - [x] Complete Administration dashboard with professional UI
  - [x] Token CRUD operations with modal-based forms
  - [x] Role-based token creation with validation and limits
  - [x] Free tier limitations (1 admin, 1 user, 1 viewer, 2 client tokens)
  - [x] Token usage tracking with visual indicators and progress bars
  - [x] RBAC overview cards showing permissions for each role
  - [x] Random token generation utility
  - [x] Upgrade prompts and tier limitation enforcement
- [x] **Emergency System Controls**
  - [x] System lockdown functionality with admin-only access and reason tracking
  - [x] Lockdown middleware with granular endpoint protection and public path exceptions
  - [x] Emergency restart system with history tracking and graceful shutdown
  - [x] Global lockdown state management with thread-safe RWMutex synchronization
  - [x] Lockdown status API endpoints (/v1/system/lockdown-status, /v1/system/lift-lockdown)
  - [x] Admin privilege verification during lockdown with 503 Service Unavailable responses
  - [x] Static asset serving during lockdown for UI accessibility
  - [x] Comprehensive system status reporting with lockdown state and restart history
  - [x] Global lockdown banner with animated danger indicators and real-time updates
- [x] **Enhanced Settings Page**
  - [x] Real-time Docker engine and system status monitoring
  - [x] Emergency controls integration with visual status indicators
  - [x] Advanced time formatting for restart history and uptime
  - [x] System information dashboard with comprehensive details
  - [x] Authentication session management and token access controls
  - [x] System configuration toggles and settings
- [x] **TopToolbar System Monitoring**
  - [x] SYSTEM API status with real-time connection indicators
  - [x] Docker engine status monitoring with appropriate icons
  - [x] Auto-refresh system (30-second intervals) for live updates
  - [x] Advanced Go duration string parsing for clean time display
  - [x] Smart uptime calculation using restart timestamps
  - [x] Platform information display (OS/architecture)
  - [x] Mobile-responsive design with progressive disclosure
- [x] **System Security & Logs**
  - [x] Multi-log file access with predefined secure paths (system, docker, nginx, auth, API, container)
  - [x] Security-restricted log path management preventing path traversal attacks
  - [x] Tail-based log reading with configurable line limits (default 50, max via query param)
  - [x] Log file existence validation with graceful empty state handling
  - [x] Admin-only log access with RBAC enforcement (/v1/system/logs endpoints)
  - [x] Structured log path metadata with descriptions and actual file locations
  - [x] Command-line log reading using secure exec.Command with tail utility
  - [x] Support logs access link for troubleshooting and system diagnostics
  - [x] Enhanced error handling and graceful degradation with structured JSON responses

## Phase 3G: Professional UI Scaling & Responsive Design ✅ COMPLETED (August 2025)

- [x] **Professional Dashboard Sizing Standards**
  - [x] Implemented industry-standard professional sizing across all components
  - [x] Base text: 14-16px, secondary text: 12-13px for optimal readability
  - [x] Reduced button padding from 16-24px to 8-12px for better information density
  - [x] Tighter spacing with 4-6 unit margins instead of 8-12 for compact layout
  - [x] Smaller icons (16-20px vs 24-32px) for professional appearance
  - [x] Optimized for both 13" and 16" display compatibility
- [x] **Administration Page UI Optimization**
  - [x] Reduced header padding and icon sizes for compact professional look
  - [x] Smaller token cards with better information density
  - [x] Compact modal designs with reduced padding and font sizes
  - [x] Professional spacing throughout (4-6 spacing vs 8-12)
  - [x] Enhanced token management UI with smaller, cleaner design
- [x] **TopToolbar Refinements**
  - [x] Removed redundant "FREE" plan badge repetition from main sidebar
  - [x] Compact toolbar sizing with reduced padding and smaller icons
  - [x] Professional badge sizing and spacing for better visual hierarchy
  - [x] Left-to-right layout improvements with consistent gap spacing
  - [x] Simplified Docker status display (just "Docker" instead of "Docker Connected")
- [x] **Responsive Design Improvements**
  - [x] Cross-device compatibility testing and optimization
  - [x] Professional information density without compromising usability
  - [x] Consistent sizing standards applied across all components
  - [x] Mobile-responsive adaptations with appropriate sizing
  - [x] Better space utilization for various screen sizes

## Phase 3H: Licensing & Release System ✅ COMPLETED (August 2025)

- [x] **Ed25519 License Verification System**
  - [x] Cryptographically secure license model with digital signatures
  - [x] Three-tier licensing: FREE/PRO/PREMIUM with feature flags and limits
  - [x] License file format: compact JSON serialized then signed
  - [x] License manager with atomic file operations and validation
  - [x] Offline-first design with no license server dependencies
- [x] **Plan Enforcement Integration**
  - [x] Enhanced PlanEnforcer to read limits from verified licenses
  - [x] License precedence over environment variable configuration
  - [x] Fallback to FREE tier when no valid license present
  - [x] Real-time plan limits with token/client/user quotas
  - [x] Feature flag system for plan-gated functionality
- [x] **License Management API**
  - [x] RESTful license API with activation, deactivation, status endpoints
  - [x] Base64 license content handling with size validation (64KB limit)
  - [x] License status reporting with expiration warnings and feature lists
  - [x] Error handling with proper HTTP status codes and messages
  - [x] Admin-only access control with RBAC integration
- [x] **Audit Logging System**
  - [x] Comprehensive audit trail for all license and system actions
  - [x] SQLite-backed audit entries with structured metadata
  - [x] Actor tracking with context-based user identification
  - [x] Action categorization: token, service, system, license, project, route, client
  - [x] Recent audit entries API with pagination support
- [x] **License Activation UI**
  - [x] Professional license management interface in Settings page
  - [x] License activation modal with textarea and file upload support
  - [x] Real-time license status display with validity indicators
  - [x] Plan limits visualization with progress bars and usage metrics
  - [x] License details display: name, organization, expiration warnings
  - [x] Support bundle generation for troubleshooting and diagnostics
- [x] **Hardened Docker Images & Release System**
  - [x] Multi-stage Docker build with distroless base image for security
  - [x] Non-root user execution (65532:65532) with minimal privileges
  - [x] Read-only filesystem support with tmpfs for writable directories
  - [x] Multi-architecture builds (linux/amd64, linux/arm64) with Docker Buildx
  - [x] Automated release packaging with signed tarballs and checksums
  - [x] Security scanning integration with Trivy vulnerability assessment
  - [x] Container security best practices: no-new-privileges, minimal capabilities
- [x] **Path-Based Routing Migration**
  - [x] Converted from parameter-based (?page=settings) to path-based routing
  - [x] Clean URLs: /app/settings, /app/projects, /app/administration
  - [x] Browser navigation support with popstate event handling  
  - [x] Bookmark-friendly URLs following modern web standards
  - [x] Maintained backward compatibility during transition
  - [x] Updated all internal links and navigation components

**Goal**: Functional lite dashboard for basic Docker container management
**Bundle Target**: Under 55KB total gzipped (✅ Currently: 24.91KB)
**Performance**: < 2s first load on slow 3G

**Security & Dependencies (December 2024):**
- ⚠️ **Development Dependencies**: 4 moderate vulnerabilities in esbuild/vite (dev-only, not affecting production)
- ✅ **Production Build**: Clean and secure (no production vulnerabilities)
- 📋 **Recommendation**: Consider upgrading Vite to v7+ when stable for dev environment
- ✅ **TypeScript**: Full type checking passes without errors

## Phase 4: Heavy NextJS Application (Post UI-Lite)

**Features Deferred to Heavy App:**
- **SSL/TLS Certificate Management**
  - Let's Encrypt integration and auto-renewal
  - Custom certificate uploads
  - Certificate monitoring and expiration alerts
- **Advanced System Monitoring** 
  - Real-time metrics dashboards with charts
  - Historical performance data
  - Resource usage trends and alerts
- **Multi-Environment Management**
  - Dev/Staging/Production environment separation
  - Environment-specific deployments
  - Cross-environment promotion workflows
- **Advanced User Management**
  - User registration and role assignment
  - Team management and permissions
  - API key management interface
- **CI/CD Pipeline Visualization**
  - Build pipeline status and logs
  - Deployment history and rollback interface
  - GitHub integration UI

## Future Phases

### Phase 3B: Advanced Deployment Strategies
- Blue-green deployments
- Canary releases with traffic splitting
- Multi-environment management (dev/staging/prod)
- Advanced rollback strategies with health checks

### Phase 4: Monitoring & Observability
- Prometheus metrics integration
- Grafana dashboards
- Log aggregation and search
- Alert management system

### Phase 5: Multi-Node Support
- Distributed container orchestration
- Node discovery and health monitoring
- Load balancing across nodes
- Shared state management

## Technical Architecture Summary

### **Core Technology Stack**
- **Backend**: Go 1.21+ with Gin framework and zerolog structured logging
- **Database**: SQLite with PRAGMA foreign_keys=ON and 6-stage incremental migrations
- **Frontend**: Preact 3KB (vs React 45KB) with Tailwind CSS and TypeScript
- **Authentication**: SHA-256 token hashing with RBAC (admin/user/viewer/client roles)
- **Build System**: CGO-disabled static binary compilation with size optimization flags
- **Docker Integration**: Docker SDK for Go with BuildKit for image building

### **Key Technical Achievements**
- ✅ **Ultra-Lightweight Frontend**: 24.91KB gzipped (target was <55KB) - 93% size reduction vs React
- ✅ **Static Binary**: Single executable <10MB with no external dependencies
- ✅ **Comprehensive Testing**: Mock-based testing with no Docker dependencies for CI/CD
- ✅ **Security-First Design**: RBAC with hierarchical permissions and secure token management
- ✅ **Real-Time Features**: WebSocket-based log streaming and container statistics
- ✅ **Emergency Management**: System lockdown with admin-only access and graceful recovery

### **Database Architecture**
- **Projects**: Container orchestration grouping with metadata
- **Services**: Docker container definitions with image, ports, environment variables
- **Routes**: Domain-to-service mapping with Nginx integration
- **Tokens**: RBAC authentication with SHA-256 hashing and usage tracking
- **Builds/Deployments**: CI/CD pipeline with Git metadata and rollback support
- **Jobs**: Background processing queue with status tracking

### **Performance Specifications**
- **Memory Usage**: <20MB idle server memory footprint
- **Request Latency**: <10ms for health/system endpoints
- **Startup Time**: <500ms from binary execution to HTTP ready
- **Build Time**: Optimized with parallel builds and caching
- **Frontend Performance**: <2s first load on slow 3G networks

### **Security Implementation**
- **Authentication**: Bearer token with timing-safe comparison
- **Authorization**: Hierarchical RBAC with endpoint-level protection
- **Input Validation**: SQL injection prevention with parameterized queries
- **Path Security**: Restricted log access preventing traversal attacks
- **Emergency Controls**: System lockdown with thread-safe state management

### **Development & Operations**
- **Testing Strategy**: Comprehensive mock-based unit/integration testing
- **Build Pipeline**: CGO-disabled static compilation with stripped binaries
- **Monitoring**: Real-time system metrics with Docker engine status
- **Logging**: Structured JSON logging with configurable levels
- **Configuration**: Environment-based config with sane defaults

## Performance Budget

- **Server idle memory**: < 20MB
- **Request latency**: < 10ms for health/system endpoints
- **Startup time**: < 500ms
- **Binary size**: < 10MB (packed)

## Build Configuration

- **CGO**: Disabled for static builds
- **Build flags**: `-a -installsuffix cgo -ldflags "-s -w"`
- **Target**: Single static binary with no external dependencies