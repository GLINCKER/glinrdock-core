# Architecture Overview

## MVP System Design

```
┌─────────┐    HTTP     ┌──────────────┐    Docker API    ┌─────────┐
│  Client │ ◄─────────► │  glinrdock   │ ◄──────────────► │ Docker  │
└─────────┘             │   Server     │                  │ Daemon  │
                        └──────┬───────┘                  └─────────┘
                               │
                               ▼
                        ┌──────────────┐
                        │   SQLite     │
                        │  Database    │
                        └──────────────┘
```

## Core Components

### HTTP Server (Gin)
- RESTful API endpoints
- Authentication middleware
- Request/response logging
- Graceful shutdown handling

### Container Manager
- Docker client abstraction  
- Container lifecycle operations
- Image management
- Resource monitoring

### Data Store (SQLite)
- Container metadata storage
- Configuration persistence
- Migration handling
- Backup/restore capabilities

## Future Phases

### Phase 2B: Container Operations
*To be documented when implemented*

- Container CRUD endpoints
- Image pull/push operations  
- Log streaming functionality
- Event notification system

### Phase 3: Web UI (HTMX)
*To be documented when implemented*

- Server-side rendered UI
- Real-time container status
- Log viewing interface
- Configuration management

### Phase 4: Nginx Integration  
*To be documented when implemented*

- Reverse proxy configuration
- SSL/TLS termination
- Load balancing for containers
- Static asset serving

## Design Principles

### Simplicity First
- Single binary deployment
- Minimal external dependencies
- Clear, focused APIs
- Straightforward configuration

### Performance Oriented
- Low memory footprint (<20MB idle)
- Fast startup times (<500ms)
- Efficient request handling
- Resource-aware operations

### Security by Design
- Secure defaults
- Input validation everywhere
- Principle of least privilege
- Comprehensive audit logging

## Data Flow

### Container Creation
1. Client sends POST /v1/containers
2. Validate request and authenticate
3. Pull image if not present
4. Create container via Docker API
5. Store metadata in SQLite
6. Return container details

### Status Monitoring
1. Periodic Docker API calls
2. Update container states
3. Store metrics in database
4. Expose via GET endpoints
5. Send notifications (future)

## Frontend Caching Architecture (Added August 2025)

### Multi-Layer Caching System
```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   UI Layer  │    │ Memory Cache │    │ localStorage│    │ External APIs│
│             │◄──►│   (Fast)     │◄──►│ (Persistent)│◄──►│ Docker/Icons │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
```

### Cache Configuration
- **Docker Hub API**: 10-minute TTL, persistent storage
- **Simple Icons**: 24-hour TTL, preloading enabled
- **Service Templates**: 5-minute TTL, memory only
- **Rate Limiting**: 100-200 requests/minute per service

### Performance Benefits
- ~80% reduction in external API calls
- Instant response for cached data
- Offline resilience with localStorage
- Background preloading of common resources

### Data Flow - Cached API Request
1. Check memory cache (instant response)
2. Check localStorage cache (fast response)
3. Validate TTL and rate limits
4. Make external API call if needed
5. Update both cache layers
6. Return data to UI component