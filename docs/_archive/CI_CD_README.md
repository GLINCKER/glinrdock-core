# CI/CD Pipeline - Phase 3A Implementation

This document describes the CI/CD pipeline functionality added in Phase 3A of glinrdock.

## Overview

The CI/CD pipeline provides automated building and deployment of container images using BuildKit and background job processing. It supports:

- **Git webhook integration** for automated builds on code changes
- **BuildKit-based Docker builds** with streaming logs
- **Background job processing** with progress tracking
- **One-click deployments and rollbacks**
- **Comprehensive test coverage** using mocks

## Architecture Components

### 1. Database Schema (`internal/store/migrations/004_ci_deploy.sql`)

**Builds Table:**
- Tracks build requests and their status
- Links to projects and services
- Stores Git repository information and build configuration
- Records build logs and timing information

**Deployments Table:**
- Records deployment history for services
- Tracks deployment status and reasons
- Enables rollback functionality

### 2. Data Models (`internal/store/models.go`)

**Build Model:**
```go
type Build struct {
    ID          int64      `json:"id"`
    ProjectID   int64      `json:"project_id"`
    ServiceID   int64      `json:"service_id"`
    GitURL      string     `json:"git_url"`
    GitRef      string     `json:"git_ref"`
    ContextPath string     `json:"context_path"`
    Dockerfile  string     `json:"dockerfile"`
    ImageTag    string     `json:"image_tag"`
    Status      string     `json:"status"` // queued, building, success, failed
    LogPath     *string    `json:"log_path"`
    StartedAt   *time.Time `json:"started_at"`
    FinishedAt  *time.Time `json:"finished_at"`
    CreatedAt   time.Time  `json:"created_at"`
}
```

**Deployment Model:**
```go
type Deployment struct {
    ID        int64     `json:"id"`
    ProjectID int64     `json:"project_id"`
    ServiceID int64     `json:"service_id"`
    ImageTag  string    `json:"image_tag"`
    Status    string    `json:"status"` // deploying, success, failed, rolled_back
    Reason    *string   `json:"reason"`
    CreatedAt time.Time `json:"created_at"`
}
```

### 3. Docker Runner (`internal/docker/runner.go`)

**Interface:**
```go
type Runner interface {
    BuildImage(ctx context.Context, spec BuildSpec) (*BuildResult, error)
    PushImage(ctx context.Context, imageTag string) error
    PullImage(ctx context.Context, imageTag string) error
    TagImage(ctx context.Context, sourceTag, targetTag string) error
    ImageExists(ctx context.Context, imageTag string) (bool, error)
}
```

**BuildKit Implementation:**
- Uses `docker buildx build` for modern Docker builds
- Supports multi-platform builds (defaults to linux/amd64)
- Clones Git repositories to temporary directories
- Streams build output to log files and clients
- Handles build failures gracefully

**Test Runner (`internal/docker/mock.go`):**
- In-memory implementation for testing
- Configurable delays and failure scenarios
- Mock build results with realistic output

### 4. Job Queue System (`internal/jobs/queue.go`)

**Features:**
- Concurrent worker processing with configurable worker count
- Job status tracking (queued → running → success/failed)
- Progress updates during job execution
- Context-based cancellation and timeouts
- Extensible handler system for different job types

**Job Types:**
- `JobTypeBuild`: Container image building
- `JobTypeDeploy`: Service deployment

**Job Handlers (`internal/jobs/handlers.go`):**
- **BuildJobHandler**: Manages Docker image builds with BuildKit
- **DeployJobHandler**: Handles service deployments and image updates

### 5. API Endpoints (`internal/api/cicd.go`)

**Build Endpoints:**
- `POST /v1/cicd/services/:id/build` - Trigger manual build
- `GET /v1/cicd/services/:id/builds` - List builds for service
- `GET /v1/cicd/builds/:id` - Get build details

**Deployment Endpoints:**
- `POST /v1/cicd/services/:id/deploy` - Deploy specific image
- `POST /v1/cicd/services/:id/rollback` - Rollback to previous deployment
- `GET /v1/cicd/services/:id/deployments` - List deployments for service
- `GET /v1/cicd/deployments/:id` - Get deployment details

**Webhook Endpoints:**
- `POST /v1/webhooks/github` - GitHub webhook for automated builds

**Job Monitoring:**
- `GET /v1/cicd/jobs/:id` - Get job status and progress

## Usage Examples

### 1. Trigger a Manual Build

```bash
curl -X POST http://localhost:8080/v1/cicd/services/1/build \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "git_url": "https://github.com/example/app.git",
    "git_ref": "main",
    "context_path": ".",
    "dockerfile": "Dockerfile"
  }'
```

Response:
```json
{
  "build_id": 123,
  "job_id": "1640995200000000000",
  "status": "queued"
}
```

### 2. Deploy a Built Image

```bash
curl -X POST http://localhost:8080/v1/cicd/services/1/deploy \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{
    "image_tag": "myapp:main-abc123",
    "reason": "Deploy latest features"
  }'
```

### 3. Rollback to Previous Version

```bash
curl -X POST http://localhost:8080/v1/cicd/services/1/rollback \
  -H "Authorization: Bearer <token>"
```

### 4. Monitor Job Progress

```bash
curl -X GET http://localhost:8080/v1/cicd/jobs/1640995200000000000 \
  -H "Authorization: Bearer <token>"
```

Response:
```json
{
  "id": "1640995200000000000",
  "type": "build",
  "status": "running",
  "progress": 45,
  "created_at": "2024-01-01T12:00:00Z",
  "started_at": "2024-01-01T12:00:05Z"
}
```

### 5. GitHub Webhook Configuration

Configure your GitHub repository webhook:
- **URL**: `https://your-domain.com/v1/webhooks/github`
- **Content Type**: `application/json`
- **Secret**: Configure matching secret in glinrdock
- **Events**: Select "Push events"

## Security Features

### Webhook Signature Verification
- HMAC-SHA256 signature validation for GitHub webhooks
- Prevents unauthorized build triggers
- Configurable webhook secret

### API Authentication
- All CI/CD endpoints require authentication tokens
- Webhook endpoints use signature-based security
- Service-level authorization checks

## Testing

### Test Coverage
- **Docker Runner Tests**: Mock implementations with failure scenarios
- **Job Queue Tests**: Concurrent processing, cancellation, progress tracking
- **API Endpoint Tests**: Complete HTTP request/response testing
- **Mock Integration**: No external dependencies required for tests

### Running Tests

```bash
# Run all CI/CD tests
go test ./internal/docker/...
go test ./internal/jobs/...
go test ./internal/api/... -run CICD

# Run with coverage
go test -cover ./internal/docker/...
```

## Configuration

### Environment Variables

- `WEBHOOK_SECRET`: Secret for GitHub webhook signature verification
- `BUILD_LOG_DIR`: Directory for storing build logs (default: `./logs`)
- `JOB_WORKERS`: Number of concurrent job workers (default: `2`)

### Job Queue Configuration

```go
// Start job queue with custom worker count
jobQueue := jobs.NewQueue(4)

// Register handlers
jobQueue.RegisterHandler(jobs.JobTypeBuild, buildHandler.Handle)
jobQueue.RegisterHandler(jobs.JobTypeDeploy, deployHandler.Handle)

jobQueue.Start()
defer jobQueue.Stop()
```

## Monitoring and Observability

### Build Logs
- Each build generates a dedicated log file
- Real-time log streaming during builds
- Persistent log storage for debugging

### Job Progress Tracking
- Progress updates during build and deployment phases
- Real-time status via API endpoints
- Job history and metrics

### Status Monitoring
- Build success/failure rates
- Deployment frequency tracking  
- Queue depth and processing times

## Future Enhancements

The current implementation provides a solid foundation for CI/CD operations. Potential improvements include:

1. **Multi-registry Support**: Push to multiple container registries
2. **Build Caching**: Docker layer caching for faster builds
3. **Parallel Builds**: Multiple simultaneous builds per service
4. **Advanced Rollback**: Blue-green and canary deployment strategies
5. **Notification Integration**: Slack, email, or webhook notifications
6. **Metrics Dashboard**: Visual monitoring of CI/CD pipeline health

## Troubleshooting

### Common Issues

**Build Failures:**
- Check Git repository access and authentication
- Verify Dockerfile exists at specified path
- Review build logs for specific error messages

**Deployment Issues:**
- Ensure Docker image exists and is accessible
- Check service configuration and dependencies
- Verify sufficient resources for deployment

**Webhook Problems:**
- Validate webhook signature configuration
- Check network connectivity from GitHub to your instance
- Review webhook delivery logs in GitHub settings