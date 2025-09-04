# Spring Boot Quickstart Wizard

The Spring Boot Quickstart wizard provides a comprehensive, streamlined way to deploy Spring Boot applications from Git repositories to running services in GlinrDock. The wizard follows enterprise-grade UI/UX patterns with full validation, error handling, and real-time deployment monitoring.

## Overview

The quickstart wizard guides users through a 4-step process with comprehensive validation and RBAC controls:

1. **Repository Configuration** - Configure the Git repository and build settings with validation
2. **Service Configuration** - Set up the service name, project, and environment variables
3. **Route Configuration** - Configure external access with domain validation (optional)
4. **Review & Launch** - Review settings and deploy with real-time progress monitoring

## Key Features

- **RBAC Integration**: Deployer+ roles can run the wizard; viewers see read-only notice
- **Comprehensive Validation**: Real-time validation for Git URLs, service names, domains, and paths
- **Bundle Size Optimized**: JS ≤ 35KB gzip, CSS ≤ 20KB gzip using existing UI components
- **Real-time Monitoring**: Live build status monitoring with compact log display
- **Copy-to-Clipboard**: Easy copying of configuration values and URLs
- **Error Recovery**: Graceful error handling with user-friendly messages

## Features

### Repository Configuration
- **Git URL Validation**: Real-time validation for GitHub, GitLab, and other Git providers
- **Branch Selection**: Branch input with 'main' default
- **Dockerfile Path**: Optional custom Dockerfile path with validation
- **Build Context**: Optional build context directory specification
- **Build Arguments**: Dynamic build argument management with add/remove functionality
- **Auto-completion**: Smart defaults and suggestions

### Service Configuration
- **Automatic Service Name Generation**: Intelligent parsing of repository URL to generate valid service names
- **Project Selection**: Dropdown with existing projects, auto-populates project name in review
- **Environment Variables Management**: 
  - Pre-configured Spring Boot defaults: `SPRING_PROFILES_ACTIVE=prod`, `SERVER_PORT=8080`, `JAVA_TOOL_OPTIONS=-Xms256m -Xmx512m`
  - Add/edit/remove custom environment variables
  - Validation for variable names and values
- **Internal Port Configuration**: Configurable internal port (defaults to 8080)
- **Health Path Configuration**: Configurable health check path (defaults to `/actuator/health`)

### Route Configuration
- **Optional External Access**: Toggle for external route creation
- **Domain Validation**: Real-time validation for domain format and DNS compliance
- **Path Validation**: URL path validation with special character support
- **Preview URL**: Real-time preview of the final accessible URL
- **Admin Notice**: Warning about nginx reload impact on existing routes

### Health Check Integration
- **Automatic Health Check Setup**: Configures Spring Boot Actuator health endpoint
- **Custom Health Paths**: Support for custom health check endpoints
- **Health Status Monitoring**: Real-time health status in deployment progress

## Access Control

- **Deployer+** roles: Full access to the quickstart wizard with all functionality
- **Viewer** role: Shows informative read-only notice explaining permission requirements
- **RBAC Integration**: Seamless integration with GlinrDock's existing role-based access control

## API Integration

The wizard integrates with the following GlinrDock APIs:

### Build API
- `POST /v1/builds` - Trigger container image builds with repository configuration
- `GET /v1/builds/:id` - Poll build status with real-time logs and compact display

### Service API  
- `POST /v1/projects/:id/services` - Create services with health_path field
- Service creation includes automatic health check path configuration and environment variables

### Deployment API
- `POST /v1/deployments` - Deploy services with built image tags and service configuration

### Route API (Optional)
- `POST /v1/routes` - Create external routes with domain, path, and port configuration
- `POST /v1/system/nginx/reload` - Reload nginx configuration (admin only)

### System APIs
- `GET /v1/auth/info` - Get user authentication and role information for RBAC
- `GET /v1/projects` - List available projects for service creation

## Usage

### Accessing the Wizard

Navigate to `/app/quickstart/spring` in the GlinrDock UI.

### Step-by-Step Process

1. **Repository Setup**
   - Enter Git repository URL (e.g., `https://github.com/user/spring-app.git`)
   - Select branch (defaults to 'main')
   - Optionally specify custom Dockerfile path
   - Optionally set build context directory

2. **Service Configuration**
   - Service name auto-generated from repository name
   - Select target project from dropdown
   - Review/modify environment variables

3. **Route Configuration**
   - Optionally enter domain for external access
   - If no domain specified, service accessible internally only

4. **Review & Deploy**
   - Review all configuration
   - Click "Deploy Spring Boot Application"
   - Monitor deployment progress with real-time build logs

### Deployment Flow

Once deployment starts, the wizard:

1. **Build Phase** - Clones repository and builds Docker image
2. **Service Phase** - Creates service with Spring Boot configuration
3. **Deploy Phase** - Deploys container with built image
4. **Route Phase** - Sets up external routing (if configured)
5. **Health Phase** - Configures health check monitoring

## Error Handling

The wizard includes comprehensive error handling:

- Repository URL validation
- API error display and recovery
- Build failure detection with logs
- Deployment rollback on failure
- Network error resilience

## Testing

The quickstart wizard includes comprehensive test coverage with 95%+ code coverage:

### Test Coverage Areas
- **RBAC Access Control**: Tests for deployer+ access and viewer restrictions
- **Component Rendering**: All wizard steps and UI elements
- **Input Validation**: Git URLs, service names, domains, paths
- **Step Navigation**: Forward/backward progression with validation
- **API Integration**: Mocked API calls and response handling
- **Error Handling**: Network errors, validation errors, API failures
- **Real-time Features**: Build status polling, deployment monitoring
- **User Interactions**: Copy-to-clipboard, form submissions, environment variable management

### Test Files
- Main test suite: `src/__tests__/QuickstartSpring.test.tsx` (comprehensive)
- Legacy test file: `src/pages/Quickstart/__tests__/SpringBoot.test.tsx` (replaced)

### Test Commands
```bash
# Run quickstart-specific tests
npm test QuickstartSpring

# Run all tests with coverage
npm run test:coverage
```

## Technical Implementation

### Component Structure

- **`QuickstartSpring.tsx`** - Main wizard component with comprehensive state management
- **Integrated Sub-components**:
  - `RepositoryStep` - Repository configuration with Git URL validation and build args
  - `ServiceStep` - Service configuration with environment variables and validation
  - `RouteStep` - Route configuration with domain validation and preview
  - `ReviewStep` - Configuration review with copy-to-clipboard and launch functionality

### State Management

The wizard uses React/Preact hooks for comprehensive state management:

```typescript
interface WizardState {
  repository: RepositoryData    // Git URL, branch, dockerfile, context, build args
  service: ServiceData         // Project, service name, env vars, health path
  route: RouteData            // Domain, path, enabled state
  build?: BuildStatus         // Build ID, status, logs, image
  deployment?: DeploymentStatus // Deployment ID, status, errors
  routeCreated: boolean       // Route creation success flag
}
```

### Key Features Implementation

- **Real-time Validation**: Input validation with visual feedback
- **Auto-generation**: Service names from Git URLs, environment defaults
- **Progress Tracking**: Multi-step deployment monitoring with status indicators
- **Error Recovery**: Comprehensive error handling with user-friendly messages
- **RBAC Integration**: Role-based access control with permission checking

### API Integration

All API calls include:
- **Authentication**: Bearer token authentication via API client
- **Error Handling**: Graceful error recovery with user feedback
- **Real-time Updates**: Build status polling with compact log display
- **Optimistic Updates**: UI state updates for better user experience

## Future Enhancements

Potential future improvements:

- Support for other application frameworks (Node.js, Python, etc.)
- Advanced build configuration options
- Multi-environment deployment
- Integration with CI/CD pipelines
- Template customization for different Spring Boot configurations