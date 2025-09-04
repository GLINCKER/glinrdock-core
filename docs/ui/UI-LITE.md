# UI-Lite Documentation

UI-Lite is the modern, lightweight React/Preact-based web interface for glinrdock. It provides a clean, responsive user experience for managing containerized applications.

## Architecture

UI-Lite is built using:
- **Preact** - Lightweight React alternative for fast performance
- **TypeScript** - Type safety and better developer experience  
- **Tailwind CSS** - Utility-first styling for consistent design
- **Vite** - Fast development and build tooling

## Features Overview

### Service Lifecycle Management

UI-Lite provides intuitive controls for managing service lifecycles directly from the Projects page:

- **Start Services** - Launch stopped or failed services
- **Stop Services** - Gracefully stop running services
- **Restart Services** - Restart services with a single click
- **Real-time Status** - Live status updates with visual indicators

#### Service Status Indicators

Services display color-coded status badges:

- 🟢 **Running** - Service is active and responding
- ⚫ **Stopped** - Service is stopped
- 🟡 **Starting** - Service is in the process of starting  
- 🟠 **Stopping** - Service is in the process of stopping
- 🔴 **Error** - Service encountered an error

### Service Detail

The **Service Detail** page provides comprehensive information about individual services with a dedicated view accessible at `/app/services/:id`.

#### Features

- **Comprehensive Overview** - Display service name, status, image information, and project association
- **Runtime Information** - Container ID, creation time, last deployment, and state reason
- **Networking Details** - Port mappings with host and container port visualization  
- **Volume Configuration** - Host-to-container volume mounts with read/write permissions
- **Environment Summary** - Count of environment variables (values hidden for security)
- **Live Status Updates** - Real-time status polling every 5 seconds with toggle control
- **Quick Actions** - Copy Docker run command and service ID to clipboard
- **RBAC Integration** - Role-based access control for service management actions

#### Navigation

Services can be accessed by clicking on any service card from:
- Services page (`/app/services`) 
- Project detail pages
- Service template deployments

#### Service Management Actions

**For Deployer+ roles:**
- **Start** - Launch the service container
- **Stop** - Gracefully stop the service
- **Restart** - Restart the service container
- **View Logs** - Open the logs drawer for real-time log viewing

**For Viewer roles:**
- Service control actions are hidden and replaced with a locked state indicator
- View Logs remains accessible for monitoring purposes
- Tooltip explains that "Deployer+ role required for service control"

#### Service Information Cards

**Runtime Information:**
- Container ID (short format)
- Service status with visual indicator
- Creation timestamp (human-readable)
- Last deployment time

**Networking:**
- Table of port mappings (host → container)
- Protocol information (TCP)
- Visual distinction between host and container ports
- Service networking alias and internal connectivity information
- Service links management for microservice communication

**Volumes:**
- Host path and container path mappings
- Read-only/Read-write permissions
- Visual indication of volume mount types

#### Live Updates

The service detail page automatically refreshes service information every 5 seconds when "Live" mode is enabled. Users can:
- Toggle between "🟢 Live" and "⏸️ Static" modes
- Manually refresh service data with the refresh button
- View last update timestamp in the status panel

#### Quick Actions Panel

Located in the right rail, provides convenient utilities:
- **Copy Docker Run Command** - Generates and copies equivalent `docker run` command
- **Copy Service ID** - Copies the service identifier to clipboard

#### Service Detail Tabs

The Service Detail page features a tabbed interface for organized information:

**Overview Tab:**
- Service summary with runtime information
- Port mappings and volume configurations  
- Environment variable count and last deployment details
- Docker run command generation

**Logs Tab:**
- Real-time log streaming with auto-scroll
- Historical log browsing with timestamp filters
- Log level filtering and search capabilities
- Download logs functionality

**Config Tab:**
- Environment variables configuration
- Port mapping management
- Volume mount settings
- Service restart and update controls

**Environment Tab:**
- Detailed environment variable editor
- Add, edit, and remove environment variables
- Import from .env files
- Export current configuration

**Ports Tab:**  
- Port mapping configuration
- Add and remove port bindings
- Protocol selection (TCP/UDP)
- Port conflict detection

**Volumes Tab:**
- Volume mount configuration
- Host path and container path mapping
- Read-only and read-write permissions
- Volume type selection

**Networking Tab:**
- **Service Aliases**: Display all DNS aliases for inter-service communication
  - Short aliases: `service-name` (same-project access)
  - Full aliases: `service-name.project-name.local` (qualified names)
  - Copy buttons for easy integration
- **Network Information**: Project network details and connection examples
- **Connection Examples**: Ready-to-use DNS addresses and curl commands
- **Connectivity Testing**: Built-in tools to test service-to-service communication
- **Service Links Management**: Configure and manage connections to other services
- **Network Diagnostics**: Debug connectivity issues between services

**Advanced Tab:**
- Service deletion and management
- Advanced Docker configuration options  
- Resource limits and constraints
- Health check configuration
- Environment variables count display (values hidden for security)

### Service Networking

UI-Lite provides comprehensive networking management through a dedicated **Networking** tab in the Service Detail page.

#### Internal Service Communication

The networking tab displays essential information for connecting microservices:

**Internal Address Card:**
- **Service Alias** - Deterministic DNS name using format: `svc-{project_slug}-{service_slug}`
- **Network Name** - Docker network used (always `glinr_default`)
- **Internal Ports** - Container ports accessible to other services
- **Copy Actions** - One-click copying of DNS addresses and curl examples

**Connection Examples:**
```bash
# DNS resolution
nslookup svc-my-project-api

# HTTP request example  
curl http://svc-my-project-api:8080/health

# Database connection example
postgresql://svc-my-project-database:5432/mydb
```

#### Service Links Management

**Service Links Card:**
- **Multi-Select Interface** - Choose which services this service should connect to
- **Visual Indicators** - Clear distinction between linked and unlinked services
- **Real-time Updates** - Changes reflected immediately in the interface
- **RBAC Enforcement** - Deployer+ role required for modifying links

**Features:**
- **Smart Filtering** - Self-links are automatically filtered out
- **Bulk Selection** - Select/deselect multiple services efficiently
- **Live Preview** - Preview connections before saving changes
- **Error Handling** - Clear feedback for validation errors

#### Connectivity Testing

**Test Connectivity Button:**
- **Network Validation** - Verify services can reach their linked dependencies
- **Health Checks** - Test common ports and endpoints
- **Diagnostic Information** - Detailed connectivity reports
- **Troubleshooting** - Helpful hints for resolving connection issues

#### Technical Implementation

The networking features integrate with the API:

```typescript
interface ServiceNetwork {
  alias: string
  network: string
  ipv4?: string
  ports_internal: InternalPortMapping[]
  dns_hint: string
  curl_hint: string
}

interface LinkedService {
  id: number
  name: string
  alias: string
}
```

**API Endpoints:**
- `GET /v1/services/:id/network` - Fetch networking information
- `GET /v1/services/:id/links` - Retrieve current service links
- `POST /v1/services/:id/links` - Update service link relationships

### Logs Drawer

The **LogsDrawer** component provides a comprehensive log viewing experience:

#### Features

- **Real-time Polling** - Auto-refreshes logs every 3 seconds
- **Configurable Tail** - View 25, 50, 100, 200, or 500 lines
- **Manual Refresh** - On-demand log refresh with loading indicators
- **Auto-scroll** - Automatically scrolls to the bottom of new logs
- **Line Numbers** - Easy log navigation with numbered lines
- **Terminal Styling** - Dark theme with syntax highlighting
- **Error Handling** - Graceful error states with retry options

#### Usage

The logs drawer is accessible from the Projects page:

1. Navigate to **Projects** page
2. Click **View** on any project to see services
3. Click the **📄 Logs** button next to any service
4. The drawer slides in from the right side of the screen

#### Controls

- **Lines Selector** - Choose how many log lines to display (25-500)
- **Auto/Manual Toggle** - Enable/disable automatic refresh every 3 seconds
- **Refresh Button** - Manually refresh logs with loading indicator
- **Scroll to Bottom** - Jump to the most recent log entries
- **Close Button** - Close the drawer and return to project view

#### Technical Implementation

The LogsDrawer component:

```typescript
interface LogsDrawerProps {
  isOpen: boolean
  onClose: () => void
  serviceId: string
  serviceName: string
}
```

**Key features:**
- Polls the REST endpoint `/v1/services/:id/logs/tail?tail=N`
- Uses `useEffect` hooks for lifecycle management
- Implements proper cleanup to prevent memory leaks
- Handles loading, error, and empty states gracefully

#### API Integration

The logs drawer uses the REST API instead of WebSockets for better compatibility:

```typescript
// API Client Method
async getServiceLogs(id: string, lines = 50): Promise<{
  service_id: number
  container: string
  tail_lines: number
  total_lines: number
  logs: string[]
}> {
  return this.get(`/services/${id}/logs/tail?tail=${lines}`)
}
```

**Benefits of REST over WebSocket:**
- Better error handling and retry logic
- Simpler implementation for polling scenarios
- Lower resource usage for periodic updates
- Better compatibility with proxies and load balancers

### Role-Based Access Control

UI-Lite implements comprehensive RBAC throughout the interface:

#### Service Management Permissions

- **Viewer** - Can view services and access logs
- **Deployer+** - Can start/stop/restart services + viewer permissions  
- **Admin** - Full access to all service operations

#### Visual Indicators

- Buttons are only shown to users with appropriate permissions
- Disabled states with helpful tooltips for unauthorized actions
- Role badges displayed in user interface elements

### Error Handling

UI-Lite provides comprehensive error handling:

#### Service Operations
- **Optimistic UI** - Immediate visual feedback with loading states
- **Error Recovery** - Clear error messages with retry options
- **Timeout Handling** - Prevents hanging operations

#### Logs Viewer
- **Connection Errors** - Graceful degradation with retry buttons
- **Empty States** - Helpful messages when no logs are available
- **Rate Limiting** - Respects API limits with proper backoff

### Testing

UI-Lite includes comprehensive test coverage:

#### Test Files
- `services-lifecycle.test.tsx` - Service lifecycle control tests
- `logs-drawer.test.tsx` - LogsDrawer component tests

#### Test Coverage Areas
- Component rendering and interaction
- API integration and error handling
- Role-based access control
- Loading states and error boundaries
- Auto-refresh and polling behavior

### Performance Optimizations

#### Efficient Rendering
- Uses Preact for minimal bundle size
- Implements proper component memoization
- Optimizes re-renders with careful state management

#### Network Efficiency
- Configurable polling intervals
- Request debouncing for user interactions
- Proper cleanup of network requests

#### Memory Management
- Clears intervals and timeouts on component unmount
- Proper cleanup of event listeners
- Avoids memory leaks in long-running components

## Customization

### Styling

UI-Lite uses Tailwind CSS with custom design tokens:

```css
/* Custom animations for drawer */
.animate-slide-in {
  animation: slideInRight 0.3s ease-out;
}

@keyframes slideInRight {
  from { 
    opacity: 0;
    transform: translateX(100%);
  }
  to { 
    opacity: 1;
    transform: translateX(0);
  }
}
```

### Configuration

Key configuration options in `vite.config.ts`:

```typescript
export default defineConfig({
  plugins: [preact()],
  base: '/',
  build: {
    outDir: '../static/ui-lite',
    emptyOutDir: true,
  },
})
```

## Development

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm run test

# Build for production  
npm run build
```

### Code Style

- TypeScript strict mode enabled
- ESLint and Prettier for code formatting
- Consistent component patterns
- Proper error boundaries and loading states

## Future Enhancements

### Planned Features
- Real-time WebSocket integration for live updates
- Advanced log filtering and search
- Export logs functionality  
- Service health monitoring dashboard
- Bulk service operations

### Performance Improvements
- Virtual scrolling for large log files
- Progressive loading of log history
- Caching strategies for frequently accessed data
- Bundle splitting for better loading performance