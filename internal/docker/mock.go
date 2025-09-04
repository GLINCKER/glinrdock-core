package docker

import (
	"context"
	"fmt"
	"time"

	"github.com/stretchr/testify/mock"
)

// MockRunner is a mock implementation of the Runner interface for testing
type MockRunner struct {
	mock.Mock
}

// BuildImage mocks building a Docker image
func (m *MockRunner) BuildImage(ctx context.Context, spec BuildSpec) (*BuildResult, error) {
	args := m.Called(ctx, spec)
	
	if result := args.Get(0); result != nil {
		return result.(*BuildResult), args.Error(1)
	}
	
	return nil, args.Error(1)
}

// PushImage mocks pushing a Docker image
func (m *MockRunner) PushImage(ctx context.Context, imageTag string) error {
	args := m.Called(ctx, imageTag)
	return args.Error(0)
}

// PullImage mocks pulling a Docker image
func (m *MockRunner) PullImage(ctx context.Context, imageTag string) error {
	args := m.Called(ctx, imageTag)
	return args.Error(0)
}

// TagImage mocks tagging a Docker image
func (m *MockRunner) TagImage(ctx context.Context, sourceTag, targetTag string) error {
	args := m.Called(ctx, sourceTag, targetTag)
	return args.Error(0)
}

// ImageExists mocks checking if a Docker image exists
func (m *MockRunner) ImageExists(ctx context.Context, imageTag string) (bool, error) {
	args := m.Called(ctx, imageTag)
	return args.Bool(0), args.Error(1)
}

// Helper methods for creating mock responses

// MockBuildSuccess creates a successful build result
func MockBuildSuccess(imageTag string, duration time.Duration) *BuildResult {
	return &BuildResult{
		ImageTag:  imageTag,
		ImageID:   "sha256:abc123",
		Success:   true,
		Error:     nil,
		Duration:  duration,
		LogOutput: fmt.Sprintf("Successfully built %s", imageTag),
	}
}

// MockBuildFailure creates a failed build result
func MockBuildFailure(imageTag string, duration time.Duration, err error) *BuildResult {
	return &BuildResult{
		ImageTag:  imageTag,
		ImageID:   "",
		Success:   false,
		Error:     err,
		Duration:  duration,
		LogOutput: fmt.Sprintf("Failed to build %s: %v", imageTag, err),
	}
}

// TestRunner is a simple in-memory runner for testing
type TestRunner struct {
	images     map[string]bool
	buildDelay time.Duration
	pushDelay  time.Duration
	pullDelay  time.Duration
	failBuilds []string // Images that should fail to build
	failPush   []string // Images that should fail to push
	failPull   []string // Images that should fail to pull
}

// NewTestRunner creates a new test runner
func NewTestRunner() *TestRunner {
	return &TestRunner{
		images:     make(map[string]bool),
		buildDelay: 100 * time.Millisecond,
		pushDelay:  50 * time.Millisecond,
		pullDelay:  50 * time.Millisecond,
	}
}

// SetBuildDelay sets the artificial delay for build operations
func (t *TestRunner) SetBuildDelay(delay time.Duration) {
	t.buildDelay = delay
}

// SetPushDelay sets the artificial delay for push operations
func (t *TestRunner) SetPushDelay(delay time.Duration) {
	t.pushDelay = delay
}

// SetPullDelay sets the artificial delay for pull operations
func (t *TestRunner) SetPullDelay(delay time.Duration) {
	t.pullDelay = delay
}

// SetFailBuilds sets which images should fail to build
func (t *TestRunner) SetFailBuilds(images []string) {
	t.failBuilds = images
}

// SetFailPush sets which images should fail to push
func (t *TestRunner) SetFailPush(images []string) {
	t.failPush = images
}

// SetFailPull sets which images should fail to pull
func (t *TestRunner) SetFailPull(images []string) {
	t.failPull = images
}

// BuildImage simulates building a Docker image
func (t *TestRunner) BuildImage(ctx context.Context, spec BuildSpec) (*BuildResult, error) {
	startTime := time.Now()
	
	// Simulate build time
	select {
	case <-time.After(t.buildDelay):
	case <-ctx.Done():
		return &BuildResult{
			ImageTag: spec.ImageTag,
			Success:  false,
			Error:    ctx.Err(),
			Duration: time.Since(startTime),
		}, ctx.Err()
	}

	// Check if this build should fail
	for _, failImage := range t.failBuilds {
		if failImage == spec.ImageTag {
			err := fmt.Errorf("simulated build failure for %s", spec.ImageTag)
			return &BuildResult{
				ImageTag:  spec.ImageTag,
				Success:   false,
				Error:     err,
				Duration:  time.Since(startTime),
				LogOutput: fmt.Sprintf("ERROR: Build failed for %s", spec.ImageTag),
			}, err
		}
	}

	// Simulate writing logs
	if spec.LogWriter != nil {
		fmt.Fprintf(spec.LogWriter, "Building image %s...\n", spec.ImageTag)
		fmt.Fprintf(spec.LogWriter, "Step 1/3: FROM alpine\n")
		fmt.Fprintf(spec.LogWriter, "Step 2/3: COPY . /app\n")
		fmt.Fprintf(spec.LogWriter, "Step 3/3: CMD [\"./app\"]\n")
		fmt.Fprintf(spec.LogWriter, "Successfully built %s\n", spec.ImageTag)
	}

	// Mark image as available
	t.images[spec.ImageTag] = true

	return &BuildResult{
		ImageTag:  spec.ImageTag,
		ImageID:   "sha256:test123",
		Success:   true,
		Error:     nil,
		Duration:  time.Since(startTime),
		LogOutput: fmt.Sprintf("Successfully built %s", spec.ImageTag),
	}, nil
}

// PushImage simulates pushing a Docker image
func (t *TestRunner) PushImage(ctx context.Context, imageTag string) error {
	// Simulate push time
	select {
	case <-time.After(t.pushDelay):
	case <-ctx.Done():
		return ctx.Err()
	}

	// Check if this push should fail
	for _, failImage := range t.failPush {
		if failImage == imageTag {
			return fmt.Errorf("simulated push failure for %s", imageTag)
		}
	}

	// Check if image exists
	if !t.images[imageTag] {
		return fmt.Errorf("image %s not found", imageTag)
	}

	return nil
}

// PullImage simulates pulling a Docker image
func (t *TestRunner) PullImage(ctx context.Context, imageTag string) error {
	// Simulate pull time
	select {
	case <-time.After(t.pullDelay):
	case <-ctx.Done():
		return ctx.Err()
	}

	// Check if this pull should fail
	for _, failImage := range t.failPull {
		if failImage == imageTag {
			return fmt.Errorf("simulated pull failure for %s", imageTag)
		}
	}

	// Mark image as available
	t.images[imageTag] = true

	return nil
}

// TagImage simulates tagging a Docker image
func (t *TestRunner) TagImage(ctx context.Context, sourceTag, targetTag string) error {
	// Check if source image exists
	if !t.images[sourceTag] {
		return fmt.Errorf("source image %s not found", sourceTag)
	}

	// Create target tag
	t.images[targetTag] = true

	return nil
}

// ImageExists checks if a Docker image exists in the test runner
func (t *TestRunner) ImageExists(ctx context.Context, imageTag string) (bool, error) {
	return t.images[imageTag], nil
}

// AddImage manually adds an image to the test runner (for test setup)
func (t *TestRunner) AddImage(imageTag string) {
	t.images[imageTag] = true
}

// RemoveImage manually removes an image from the test runner
func (t *TestRunner) RemoveImage(imageTag string) {
	delete(t.images, imageTag)
}

// ListImages returns all images in the test runner
func (t *TestRunner) ListImages() []string {
	var images []string
	for image := range t.images {
		images = append(images, image)
	}
	return images
}