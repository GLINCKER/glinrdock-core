# GLINRDOCK UI-LITE Routes Documentation

## Routes UI Components

### Global Routes List (`/pages/Routes.tsx`)

The main routes page displays all routes across all services with administrative capabilities.

**Features:**
- Global route listing with service information
- HTTPS/TLS badge indicators
- Admin-only nginx reload functionality
- Route creation via modal
- Route deletion with confirmation
- RBAC enforcement for admin operations

**UI Elements:**
- **Add Route Button**: Links to Route Creation Wizard for guided setup
- **Reload Nginx Button**: Admin-only, reloads nginx configuration with confirmation
- **Route Cards**: Display domain, path, port, TLS status, health status, and service name
- **Health Check Button**: Blue search icon to manually trigger route health check
- **Health Badge**: Tiny status indicator showing OK (green), FAIL (red), or — (gray)
- **Delete Action**: Trash icon with confirmation for route deletion
- **Empty State**: Shows when no services exist with call-to-action

**Permissions:**
- Admin users see nginx reload button
- All users can view routes (respecting project permissions)
- Route management permissions based on service access

### Service Routes Tab (`/pages/Services/RoutesTab.tsx`)

Service-scoped routes management within the service detail view.

**Features:**
- Service-specific route listing
- Inline route creation form
- Real-time validation
- Optimistic UI updates
- Loading states and error handling

**UI Elements:**
- **Add Route/Add First Route Button**: Toggles inline creation form
- **Create in Wizard Button**: Links to Route Creation Wizard for guided setup
- **Route Form**: Inline form with domain, path, port, and TLS checkbox
- **Route List**: Cards showing route details with created dates and health status
- **Health Check Button**: Search icon with loading animation during checks
- **Health Badge**: Compact status indicator with timestamp tooltip
- **Delete Icons**: Per-route deletion with confirmation
- **Validation Messages**: Real-time form validation feedback
- **Toast Notifications**: Success and error feedback

**Form Validation:**
- Domain: Required, RFC 1123 compliant format
- Path: Must start with "/", defaults to "/"
- Port: Range 1-65535
- TLS: Optional checkbox

### Route Creation Wizard (`/pages/Routes/Wizard.tsx`)

A guided 3-step wizard for creating routes with safe reload UX.

**Flow:**
1. **Project Selection**: Choose from available projects
2. **Service Selection**: Pick a service within the selected project  
3. **Route Configuration**: Enter domain, path, port, and TLS settings
4. **Route Creation**: Submit route with validation
5. **Configuration Apply**: Admin users can reload nginx, non-admin get guidance

**Features:**
- Step-by-step guided interface with progress indicators
- Comprehensive client-side validation with helpful error messages
- Auto-fill port from selected service
- Server-side validation error handling with field-specific feedback
- Admin/non-admin flow differentiation for nginx reload
- Safe configuration apply with confirmation modals
- Success feedback and automatic navigation

**UI Elements:**
- **Progress Steps**: Visual indicator showing current step (1/3)
- **Project Cards**: Clickable cards for each available project
- **Service Cards**: Service list with port information
- **Route Form**: Domain, path, port, and TLS configuration
- **Validation Messages**: Real-time form validation with helpful hints
- **Back Navigation**: Buttons to navigate between steps
- **Apply Configuration Modal**: Admin-only nginx reload confirmation
- **Success Guidance**: Non-admin users get instruction about pending configuration

**RBAC Integration:**
- Admin users: Full flow with nginx reload capability
- Non-admin users: Route creation with disabled reload and guidance message
- Permission-based service access (respects project membership)

**Error Handling:**
- Client-side validation for domain format, path structure, port range
- Server-side validation with field-specific error mapping
- Network error handling with user-friendly messages
- Loading states during all async operations

**Why the Wizard?**
The wizard provides a more guided experience compared to forms, especially useful for:
- New users who need context about projects and services
- Complex route configurations requiring multiple steps
- Clear RBAC feedback about configuration apply permissions
- Better error handling with step-specific validation

### Route Creation Modal (`/components/CreateRouteModal.tsx`)

Global route creation modal with service selection (legacy component).

**Features:**
- Service dropdown with project grouping
- Auto-fill port from selected service
- Comprehensive form validation
- Loading states during submission

**UI Elements:**
- **Service Selection**: Grouped dropdown by project
- **Domain Input**: Text input with validation
- **Path Input**: Defaults to "/"
- **Port Input**: Number input, auto-filled from service
- **TLS Checkbox**: Enable HTTPS
- **Create/Cancel Buttons**: Form actions with loading states

### Route Health Indicators

Lightweight health checking system for route monitoring with minimal overhead.

**Features:**
- **Manual Health Checks**: On-demand route health verification with 1-second timeout
- **Visual Status Indicators**: Tiny badges showing OK/FAIL/Unknown status
- **Last Check Timestamps**: Tooltip showing when route was last checked
- **Safe Timeouts**: Fast checks that don't block user operations
- **Error Handling**: Network failures and timeouts treated as FAIL status

**Health Check Flow:**
1. User clicks health check button (🔍 icon)
2. System makes HEAD request to `/v1/routes/:id/check` with 1s timeout
3. Backend proxies request to upstream service
4. Response stored in-memory cache with timestamp
5. UI updates with new status and timestamp

**Status Meanings:**
- **OK** (Green ✓): Route responded with 200 OK within timeout
- **FAIL** (Red ✕): Route returned error, timeout, or network failure  
- **—** (Gray): Route has never been checked or status unknown

**UI Integration:**
- Health badges appear next to HTTPS badges in route lists
- Check buttons provide manual trigger with loading states
- Status persists across page refreshes via backend cache
- Non-blocking operations - failures don't interrupt workflow

**Technical Implementation:**
- `HEAD /v1/routes/:id/check` endpoint with 1-second timeout
- In-memory cache storing `last_check_at` and `last_status`
- Client-side state management preventing duplicate concurrent checks
- Graceful error handling with user-friendly feedback

**Use Cases:**
- **Spot Checks**: Quick verification that routes are accessible
- **Deployment Validation**: Confirm new routes are working after nginx reload
- **Troubleshooting**: Identify failing routes during incident response
- **Monitoring**: Lightweight alternative to heavy monitoring systems

**Not Intended For:**
- Continuous monitoring (use dedicated monitoring tools)
- Performance metrics or response time tracking
- Automated alerting or notification systems
- High-frequency health checking

### Confirmation Modal (`/components/ConfirmModal.tsx`)

Reusable confirmation dialog for destructive actions.

**Features:**
- Configurable title, message, and button text
- Different confirmation styles (primary, danger, warning)
- Disabled state support
- Keyboard navigation

**Usage:**
- Route deletion confirmation
- Nginx reload confirmation
- Other destructive operations

## Route Data Model

```typescript
interface Route {
  id: number
  service_id: number
  domain: string
  path: string
  port: number
  tls: boolean
  created_at: string
}
```

## Validation Patterns

### Domain Validation
```regex
^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$
```

### Path Validation
- Must start with "/"
- No additional restrictions (backend validates)

### Port Validation
- Integer between 1 and 65535
- Number input with validation

## User Experience Patterns

### Loading States
- Skeleton loaders for initial page loads
- Button loading states with spinner icons
- Disabled form inputs during submission
- Loading text changes (e.g., "Creating..." vs "Create Route")

### Error Handling
- Toast notifications for async operations
- Inline form validation messages
- Error boundaries for component failures
- Network error handling with user-friendly messages

### Success Feedback
- Toast notifications for successful operations
- Form reset after successful submission
- List refresh after create/delete operations
- Visual confirmation of state changes

### RBAC Integration
- Conditional rendering based on user roles
- Admin-only nginx reload functionality
- Project-scoped route access
- Permission-aware UI elements

## Design System Integration

### CSS Classes
- Uses existing Tailwind utility classes
- Consistent button styles (`btn`, `btn-primary`, `btn-danger`)
- Input styling (`input`)
- Card layouts with consistent spacing
- Dark mode support throughout

### Icons
- Trash icon for delete actions
- Plus icon for add actions
- Shield icon for HTTPS/TLS indicators
- Spinner for loading states
- Check/error icons for validation states

### Responsive Design
- Mobile-friendly layouts
- Responsive grid systems
- Collapsible sections on smaller screens
- Touch-friendly interactive elements

## Testing Coverage

### Test Files
- `routes-list.test.tsx`: Global routes page functionality
- `routes-service.test.tsx`: Service routes tab functionality
- `api.test.ts`: Routes API client methods

### Test Scenarios
- Route CRUD operations
- Form validation edge cases
- RBAC permission enforcement
- Error handling and recovery
- Loading states and UI feedback
- Modal interactions
- Toast notifications

## Accessibility Features

- Semantic HTML structure
- ARIA labels for interactive elements
- Keyboard navigation support
- Screen reader friendly
- Color contrast compliance
- Focus management in modals

## Frequently Asked Questions

### Why do I need to reload nginx configuration?

When you create or delete routes, the changes are stored in the database but nginx (the reverse proxy) doesn't automatically know about them. Reloading the nginx configuration:

1. **Updates Active Routes**: Makes your new routes immediately accessible via HTTP/HTTPS
2. **Removes Stale Routes**: Ensures deleted routes stop working and don't cause 404 errors
3. **Applies SSL Changes**: Activates or deactivates TLS certificates for domains
4. **Refreshes Load Balancing**: Updates upstream server configurations

**Admin vs Non-Admin Users:**
- **Admins** can reload nginx immediately after creating routes
- **Non-admin users** can create routes but need an admin to apply the configuration
- Routes remain "pending" until configuration is applied

**When to Reload:**
- After creating new routes (to make them active)
- After deleting routes (to prevent stale routing)
- When TLS settings change (to update certificates)
- Periodically to ensure configuration consistency