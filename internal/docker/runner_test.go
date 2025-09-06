package docker

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestTestRunner_BuildImage(t *testing.T) {
	runner := NewTestRunner()

	ctx := context.Background()
	spec := BuildSpec{
		GitURL:      "https://github.com/example/repo.git",
		GitRef:      "main",
		ContextPath: ".",
		Dockerfile:  "Dockerfile",
		ImageTag:    "test:latest",
		LogWriter:   nil,
	}

	result, err := runner.BuildImage(ctx, spec)

	require.NoError(t, err)
	assert.True(t, result.Success)
	assert.Equal(t, "test:latest", result.ImageTag)
	assert.Equal(t, "sha256:test123", result.ImageID)
	assert.Contains(t, result.LogOutput, "Successfully built test:latest")
	assert.Greater(t, result.Duration, time.Duration(0))

	// Verify image was added to runner
	exists, err := runner.ImageExists(ctx, "test:latest")
	require.NoError(t, err)
	assert.True(t, exists)
}

func TestTestRunner_BuildImage_WithContext(t *testing.T) {
	runner := NewTestRunner()
	runner.SetBuildDelay(200 * time.Millisecond)

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	spec := BuildSpec{
		GitURL:      "https://github.com/example/repo.git",
		GitRef:      "main",
		ContextPath: ".",
		Dockerfile:  "Dockerfile",
		ImageTag:    "test:timeout",
	}

	result, err := runner.BuildImage(ctx, spec)

	assert.Error(t, err)
	assert.Equal(t, context.DeadlineExceeded, err)
	assert.False(t, result.Success)
	assert.Equal(t, context.DeadlineExceeded, result.Error)
}

func TestTestRunner_BuildImage_Failure(t *testing.T) {
	runner := NewTestRunner()
	runner.SetFailBuilds([]string{"test:fail"})

	ctx := context.Background()
	spec := BuildSpec{
		GitURL:      "https://github.com/example/repo.git",
		GitRef:      "main",
		ContextPath: ".",
		Dockerfile:  "Dockerfile",
		ImageTag:    "test:fail",
	}

	result, err := runner.BuildImage(ctx, spec)

	assert.Error(t, err)
	assert.False(t, result.Success)
	assert.Contains(t, err.Error(), "simulated build failure")
	assert.Contains(t, result.LogOutput, "ERROR: Build failed")
}

func TestTestRunner_BuildImage_WithLogWriter(t *testing.T) {
	runner := NewTestRunner()

	var logOutput strings.Builder

	ctx := context.Background()
	spec := BuildSpec{
		GitURL:      "https://github.com/example/repo.git",
		GitRef:      "main",
		ContextPath: ".",
		Dockerfile:  "Dockerfile",
		ImageTag:    "test:logs",
		LogWriter:   &logOutput,
	}

	result, err := runner.BuildImage(ctx, spec)

	require.NoError(t, err)
	assert.True(t, result.Success)

	logs := logOutput.String()
	assert.Contains(t, logs, "Building image test:logs...")
	assert.Contains(t, logs, "Step 1/3: FROM alpine")
	assert.Contains(t, logs, "Successfully built test:logs")
}

func TestTestRunner_PushImage(t *testing.T) {
	runner := NewTestRunner()
	runner.AddImage("test:push")

	ctx := context.Background()

	err := runner.PushImage(ctx, "test:push")
	assert.NoError(t, err)
}

func TestTestRunner_PushImage_ImageNotFound(t *testing.T) {
	runner := NewTestRunner()

	ctx := context.Background()

	err := runner.PushImage(ctx, "test:notfound")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestTestRunner_PushImage_Failure(t *testing.T) {
	runner := NewTestRunner()
	runner.AddImage("test:pushfail")
	runner.SetFailPush([]string{"test:pushfail"})

	ctx := context.Background()

	err := runner.PushImage(ctx, "test:pushfail")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "simulated push failure")
}

func TestTestRunner_PullImage(t *testing.T) {
	runner := NewTestRunner()

	ctx := context.Background()

	err := runner.PullImage(ctx, "test:pull")
	assert.NoError(t, err)

	// Verify image was added
	exists, err := runner.ImageExists(ctx, "test:pull")
	require.NoError(t, err)
	assert.True(t, exists)
}

func TestTestRunner_PullImage_Failure(t *testing.T) {
	runner := NewTestRunner()
	runner.SetFailPull([]string{"test:pullfail"})

	ctx := context.Background()

	err := runner.PullImage(ctx, "test:pullfail")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "simulated pull failure")
}

func TestTestRunner_TagImage(t *testing.T) {
	runner := NewTestRunner()
	runner.AddImage("source:tag")

	ctx := context.Background()

	err := runner.TagImage(ctx, "source:tag", "target:tag")
	assert.NoError(t, err)

	// Verify target tag exists
	exists, err := runner.ImageExists(ctx, "target:tag")
	require.NoError(t, err)
	assert.True(t, exists)
}

func TestTestRunner_TagImage_SourceNotFound(t *testing.T) {
	runner := NewTestRunner()

	ctx := context.Background()

	err := runner.TagImage(ctx, "notfound:tag", "target:tag")
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "not found")
}

func TestTestRunner_ImageExists(t *testing.T) {
	runner := NewTestRunner()

	ctx := context.Background()

	// Non-existent image
	exists, err := runner.ImageExists(ctx, "test:nonexistent")
	require.NoError(t, err)
	assert.False(t, exists)

	// Add image and test again
	runner.AddImage("test:exists")
	exists, err = runner.ImageExists(ctx, "test:exists")
	require.NoError(t, err)
	assert.True(t, exists)
}

func TestTestRunner_ListImages(t *testing.T) {
	runner := NewTestRunner()

	// Initially empty
	images := runner.ListImages()
	assert.Empty(t, images)

	// Add some images
	runner.AddImage("image1:tag")
	runner.AddImage("image2:tag")

	images = runner.ListImages()
	assert.Len(t, images, 2)
	assert.Contains(t, images, "image1:tag")
	assert.Contains(t, images, "image2:tag")
}

func TestTestRunner_RemoveImage(t *testing.T) {
	runner := NewTestRunner()
	runner.AddImage("test:remove")

	ctx := context.Background()

	// Verify image exists
	exists, err := runner.ImageExists(ctx, "test:remove")
	require.NoError(t, err)
	assert.True(t, exists)

	// Remove image
	runner.RemoveImage("test:remove")

	// Verify image is gone
	exists, err = runner.ImageExists(ctx, "test:remove")
	require.NoError(t, err)
	assert.False(t, exists)
}

func TestMockBuildSuccess(t *testing.T) {
	result := MockBuildSuccess("test:mock", 5*time.Second)

	assert.Equal(t, "test:mock", result.ImageTag)
	assert.Equal(t, "sha256:abc123", result.ImageID)
	assert.True(t, result.Success)
	assert.Nil(t, result.Error)
	assert.Equal(t, 5*time.Second, result.Duration)
	assert.Contains(t, result.LogOutput, "Successfully built test:mock")
}

func TestMockBuildFailure(t *testing.T) {
	testErr := assert.AnError
	result := MockBuildFailure("test:mockfail", 3*time.Second, testErr)

	assert.Equal(t, "test:mockfail", result.ImageTag)
	assert.Empty(t, result.ImageID)
	assert.False(t, result.Success)
	assert.Equal(t, testErr, result.Error)
	assert.Equal(t, 3*time.Second, result.Duration)
	assert.Contains(t, result.LogOutput, "Failed to build test:mockfail")
}
