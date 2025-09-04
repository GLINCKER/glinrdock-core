# Testing Guidelines

## Unit Test Conventions

### Naming
- Test files: `*_test.go`
- Test functions: `TestFunctionName`
- Benchmarks: `BenchmarkFunctionName`
- Examples: `ExampleFunctionName`

### Structure
```go
func TestContainerCreate(t *testing.T) {
    // Arrange
    client := &MockDockerClient{}
    service := NewContainerService(client)
    
    // Act
    result, err := service.Create("nginx:latest")
    
    // Assert
    require.NoError(t, err)
    assert.Equal(t, "running", result.Status)
}
```

## Table-Driven Tests

```go
func TestValidateContainerName(t *testing.T) {
    tests := []struct {
        name     string
        input    string
        wantErr  bool
        errMsg   string
    }{
        {
            name:    "valid name",
            input:   "my-app",
            wantErr: false,
        },
        {
            name:    "invalid chars",
            input:   "my_app!",
            wantErr: true,
            errMsg:  "invalid character",
        },
        {
            name:    "too long",
            input:   strings.Repeat("a", 256),
            wantErr: true,
            errMsg:  "name too long",
        },
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            err := ValidateContainerName(tt.input)
            
            if tt.wantErr {
                assert.Error(t, err)
                assert.Contains(t, err.Error(), tt.errMsg)
            } else {
                assert.NoError(t, err)
            }
        })
    }
}
```

## Integration Tests

### Docker in CI
```go
// +build integration

func TestContainerLifecycle(t *testing.T) {
    if testing.Short() {
        t.Skip("skipping integration test")
    }
    
    // Use testcontainers or docker-in-docker
    ctx := context.Background()
    client, err := docker.NewClientFromEnv()
    require.NoError(t, err)
    
    // Test real Docker operations
}
```

### Running Tests
```bash
# Unit tests only (fast)
go test -short ./...

# All tests including integration
go test ./...

# With race detection
go test -race -short ./...
```

## Coverage Measurement

### Baseline Target
- **Overall**: 80% line coverage minimum
- **Critical paths**: 90% coverage (auth, container ops)
- **Utility code**: 70% coverage acceptable

### Commands
```bash
# Generate coverage report
go test -coverprofile=coverage.out ./...

# View coverage in browser  
go tool cover -html=coverage.out

# Coverage summary
go tool cover -func=coverage.out | grep total
```

### Exclusions
- Generated code (protobuf, etc.)
- Test helper functions
- Main functions and initialization code
- Error cases that require external failures

## Mock Guidelines

### Interface-First Design
```go
// Define interface for easy mocking
type DockerClient interface {
    CreateContainer(config *Config) (*Container, error)
    StartContainer(id string) error
    StopContainer(id string) error
}

// Implementation
type dockerClient struct {
    client *docker.Client
}

// Mock for testing
type MockDockerClient struct {
    mock.Mock
}
```

### Test Doubles
- **Mock**: Behavior verification with expectations
- **Stub**: State-based testing with canned responses  
- **Fake**: Simple working implementation for tests