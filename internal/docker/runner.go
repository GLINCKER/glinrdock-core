package docker

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

// Runner interface for Docker operations
type Runner interface {
	BuildImage(ctx context.Context, spec BuildSpec) (*BuildResult, error)
	PushImage(ctx context.Context, imageTag string) error
	PullImage(ctx context.Context, imageTag string) error
	TagImage(ctx context.Context, sourceTag, targetTag string) error
	ImageExists(ctx context.Context, imageTag string) (bool, error)
}

// BuildSpec represents the specification for building a Docker image
type BuildSpec struct {
	GitURL      string
	GitRef      string
	ContextPath string
	Dockerfile  string
	ImageTag    string
	LogWriter   io.Writer
}

// BuildResult represents the result of a Docker build
type BuildResult struct {
	ImageTag  string
	ImageID   string
	Success   bool
	Error     error
	Duration  time.Duration
	LogOutput string
}

// BuildKitRunner implements Runner using Docker BuildKit
type BuildKitRunner struct {
	dockerCmd string
}

// NewBuildKitRunner creates a new BuildKit-based Docker runner
func NewBuildKitRunner() (*BuildKitRunner, error) {
	// Check if docker command is available
	dockerCmd, err := exec.LookPath("docker")
	if err != nil {
		return nil, fmt.Errorf("docker command not found: %w", err)
	}

	return &BuildKitRunner{
		dockerCmd: dockerCmd,
	}, nil
}

// BuildImage builds a Docker image using BuildKit
func (r *BuildKitRunner) BuildImage(ctx context.Context, spec BuildSpec) (*BuildResult, error) {
	startTime := time.Now()

	result := &BuildResult{
		ImageTag: spec.ImageTag,
	}

	// Clone the repository to a temporary directory
	tmpDir, err := r.cloneRepo(ctx, spec.GitURL, spec.GitRef)
	if err != nil {
		result.Error = fmt.Errorf("failed to clone repository: %w", err)
		result.Duration = time.Since(startTime)
		return result, result.Error
	}

	// Build context path
	contextPath := filepath.Join(tmpDir, spec.ContextPath)
	dockerfilePath := filepath.Join(contextPath, spec.Dockerfile)

	// Build Docker command
	args := []string{
		"buildx", "build",
		"--platform", "linux/amd64",
		"-t", spec.ImageTag,
		"-f", dockerfilePath,
		contextPath,
	}

	cmd := exec.CommandContext(ctx, r.dockerCmd, args...)

	// Set up output capture
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		result.Error = fmt.Errorf("failed to create stdout pipe: %w", err)
		result.Duration = time.Since(startTime)
		return result, result.Error
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		result.Error = fmt.Errorf("failed to create stderr pipe: %w", err)
		result.Duration = time.Since(startTime)
		return result, result.Error
	}

	// Start the command
	if err := cmd.Start(); err != nil {
		result.Error = fmt.Errorf("failed to start docker build: %w", err)
		result.Duration = time.Since(startTime)
		return result, result.Error
	}

	// Read output in goroutines
	var logOutput strings.Builder

	go r.streamOutput(stdout, spec.LogWriter, &logOutput)
	go r.streamOutput(stderr, spec.LogWriter, &logOutput)

	// Wait for command to complete
	err = cmd.Wait()
	result.Duration = time.Since(startTime)
	result.LogOutput = logOutput.String()

	if err != nil {
		result.Error = fmt.Errorf("docker build failed: %w", err)
		result.Success = false
		return result, result.Error
	}

	// Get image ID
	imageID, err := r.getImageID(ctx, spec.ImageTag)
	if err != nil {
		log.Warn().Err(err).Str("tag", spec.ImageTag).Msg("failed to get image ID")
	} else {
		result.ImageID = imageID
	}

	result.Success = true
	return result, nil
}

// PushImage pushes a Docker image to a registry
func (r *BuildKitRunner) PushImage(ctx context.Context, imageTag string) error {
	cmd := exec.CommandContext(ctx, r.dockerCmd, "push", imageTag)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to push image %s: %w\nOutput: %s", imageTag, err, output)
	}

	return nil
}

// PullImage pulls a Docker image from a registry
func (r *BuildKitRunner) PullImage(ctx context.Context, imageTag string) error {
	cmd := exec.CommandContext(ctx, r.dockerCmd, "pull", imageTag)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to pull image %s: %w\nOutput: %s", imageTag, err, output)
	}

	return nil
}

// TagImage creates a new tag for an existing image
func (r *BuildKitRunner) TagImage(ctx context.Context, sourceTag, targetTag string) error {
	cmd := exec.CommandContext(ctx, r.dockerCmd, "tag", sourceTag, targetTag)

	output, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("failed to tag image %s -> %s: %w\nOutput: %s", sourceTag, targetTag, err, output)
	}

	return nil
}

// ImageExists checks if a Docker image exists locally
func (r *BuildKitRunner) ImageExists(ctx context.Context, imageTag string) (bool, error) {
	cmd := exec.CommandContext(ctx, r.dockerCmd, "image", "inspect", imageTag)

	err := cmd.Run()
	if err != nil {
		if exitError, ok := err.(*exec.ExitError); ok && exitError.ExitCode() == 1 {
			return false, nil // Image doesn't exist
		}
		return false, fmt.Errorf("failed to check image existence: %w", err)
	}

	return true, nil
}

// Helper methods

func (r *BuildKitRunner) cloneRepo(ctx context.Context, gitURL, gitRef string) (string, error) {
	// Create temporary directory
	cmd := exec.CommandContext(ctx, "mktemp", "-d")
	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to create temp directory: %w", err)
	}

	tmpDir := strings.TrimSpace(string(output))

	// Clone repository
	cloneCmd := exec.CommandContext(ctx, "git", "clone", "--depth=1", "-b", gitRef, gitURL, tmpDir)
	if err := cloneCmd.Run(); err != nil {
		// Try cloning without branch specification (for commits/tags)
		cloneCmd = exec.CommandContext(ctx, "git", "clone", gitURL, tmpDir)
		if err := cloneCmd.Run(); err != nil {
			return "", fmt.Errorf("failed to clone repository: %w", err)
		}

		// Checkout the specific ref
		checkoutCmd := exec.CommandContext(ctx, "git", "-C", tmpDir, "checkout", gitRef)
		if err := checkoutCmd.Run(); err != nil {
			return "", fmt.Errorf("failed to checkout ref %s: %w", gitRef, err)
		}
	}

	return tmpDir, nil
}

func (r *BuildKitRunner) streamOutput(reader io.Reader, logWriter io.Writer, buffer *strings.Builder) {
	scanner := bufio.NewScanner(reader)
	for scanner.Scan() {
		line := scanner.Text()

		// Write to log file if provided
		if logWriter != nil {
			fmt.Fprintln(logWriter, line)
		}

		// Store in buffer for result
		buffer.WriteString(line + "\n")
	}
}

func (r *BuildKitRunner) getImageID(ctx context.Context, imageTag string) (string, error) {
	cmd := exec.CommandContext(ctx, r.dockerCmd, "image", "inspect", "--format={{.Id}}", imageTag)

	output, err := cmd.Output()
	if err != nil {
		return "", fmt.Errorf("failed to get image ID: %w", err)
	}

	return strings.TrimSpace(string(output)), nil
}
