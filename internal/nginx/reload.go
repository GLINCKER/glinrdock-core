package nginx

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/rs/zerolog/log"
)

// Reloader handles nginx configuration reload operations
type Reloader struct {
	nginxPath       string
	dockerContainer string
	useDocker       bool
	timeout         time.Duration
}

// NewReloader creates a new nginx configuration reloader
func NewReloader() *Reloader {
	return &Reloader{
		nginxPath:       "nginx", // Default nginx binary path
		dockerContainer: getDockerContainerName(),
		useDocker:       shouldUseDockerReload(),
		timeout:         30 * time.Second,
	}
}

// Reload reloads nginx configuration (docker exec method for dev)
func (r *Reloader) Reload(ctx context.Context) error {
	// Create context with timeout
	reloadCtx, cancel := context.WithTimeout(ctx, r.timeout)
	defer cancel()

	if !r.useDocker {
		log.Debug().Msg("docker reload disabled, skipping nginx reload")
		return nil
	}

	if r.dockerContainer == "" {
		log.Warn().Msg("no docker container name specified, skipping nginx reload")
		return nil
	}

	log.Info().
		Str("container", r.dockerContainer).
		Msg("reloading nginx configuration")

	// Check if docker container exists and is running
	if !r.isContainerRunning(reloadCtx) {
		log.Warn().
			Str("container", r.dockerContainer).
			Msg("docker container not found or not running, skipping nginx reload")
		return nil
	}

	// Execute nginx reload command via docker exec
	cmd := exec.CommandContext(reloadCtx, "docker", "exec", r.dockerContainer, "nginx", "-s", "reload")
	output, err := cmd.CombinedOutput()

	if err != nil {
		log.Error().
			Str("container", r.dockerContainer).
			Str("output", string(output)).
			Err(err).
			Msg("nginx reload failed")
		return fmt.Errorf("nginx reload failed: %w", err)
	}

	log.Info().
		Str("container", r.dockerContainer).
		Str("output", string(output)).
		Msg("nginx configuration reloaded successfully")

	return nil
}

// ReloadConfiguration reloads nginx with the new configuration (legacy method)
func (r *Reloader) ReloadConfiguration(ctx context.Context, configPath string) error {
	log.Info().Str("config_path", configPath).Msg("reloading nginx configuration")

	// Use docker reload if enabled
	if r.useDocker {
		return r.Reload(ctx)
	}

	// Check if nginx binary is available
	if _, err := exec.LookPath(r.nginxPath); err != nil {
		log.Warn().Err(err).Msg("nginx binary not found, skipping reload")
		return nil // Don't fail if nginx is not installed locally
	}

	// Run nginx reload command
	cmd := exec.CommandContext(ctx, r.nginxPath, "-s", "reload", "-c", configPath)
	output, err := cmd.CombinedOutput()

	if err != nil {
		log.Error().
			Str("config_path", configPath).
			Str("output", string(output)).
			Err(err).
			Msg("nginx configuration reload failed")
		return fmt.Errorf("nginx configuration reload failed: %w", err)
	}

	log.Info().
		Str("config_path", configPath).
		Str("output", string(output)).
		Msg("nginx configuration reloaded successfully")

	return nil
}

// isContainerRunning checks if the docker container is running
func (r *Reloader) isContainerRunning(ctx context.Context) bool {
	cmd := exec.CommandContext(ctx, "docker", "ps", "-q", "-f", "name="+r.dockerContainer)
	output, err := cmd.CombinedOutput()
	if err != nil {
		log.Debug().
			Str("container", r.dockerContainer).
			Err(err).
			Msg("failed to check container status")
		return false
	}

	return strings.TrimSpace(string(output)) != ""
}

// SetNginxPath allows setting a custom path to the nginx binary
func (r *Reloader) SetNginxPath(path string) {
	r.nginxPath = path
}

// SetTimeout sets the timeout for reload operations
func (r *Reloader) SetTimeout(timeout time.Duration) {
	r.timeout = timeout
}

// SetDockerContainer sets the docker container name
func (r *Reloader) SetDockerContainer(name string) {
	r.dockerContainer = name
}

// EnableDockerReload enables docker-based reloading
func (r *Reloader) EnableDockerReload() {
	r.useDocker = true
}

// DisableDockerReload disables docker-based reloading
func (r *Reloader) DisableDockerReload() {
	r.useDocker = false
}

// getDockerContainerName returns the docker container name from environment
func getDockerContainerName() string {
	// Check DEV_NGINX_DOCKER_NAME first (as specified in prompt)
	if name := os.Getenv("DEV_NGINX_DOCKER_NAME"); name != "" {
		return name
	}
	// Fallback to default
	return "nginx-proxy"
}

// shouldUseDockerReload determines if docker reload should be used
func shouldUseDockerReload() bool {
	// Check if DEV_NGINX_DOCKER_NAME is set (indicates development environment)
	return os.Getenv("DEV_NGINX_DOCKER_NAME") != ""
}
