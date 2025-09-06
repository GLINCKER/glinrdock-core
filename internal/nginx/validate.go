package nginx

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"strings"

	"github.com/rs/zerolog/log"
)

// Validator handles nginx configuration validation
type Validator struct {
	nginxPath       string
	useDocker       bool
	dockerContainer string
}

// NewValidator creates a new nginx configuration validator
func NewValidator() *Validator {
	return &Validator{
		nginxPath:       "nginx", // Default nginx binary path
		useDocker:       false,
		dockerContainer: "nginx-proxy",
	}
}

// ValidateConfiguration checks if the nginx configuration is valid
func (v *Validator) ValidateConfiguration(ctx context.Context, configPath string) error {
	log.Info().Str("config_path", configPath).Msg("validating nginx configuration")

	// Check for NGINX_CMD environment variable override
	if nginxCmd := os.Getenv("NGINX_CMD"); nginxCmd != "" {
		return v.validateWithCustomCommand(ctx, nginxCmd, configPath)
	}

	// Use docker validation in dev environment
	if v.useDocker {
		return v.validateWithDocker(ctx, configPath)
	}

	// Check if nginx binary is available
	if _, err := exec.LookPath(v.nginxPath); err != nil {
		log.Warn().Err(err).Msg("nginx binary not found, skipping validation")
		return nil // Don't fail if nginx is not installed locally
	}

	// Run nginx configuration test
	cmd := exec.CommandContext(ctx, v.nginxPath, "-t", "-c", configPath)
	output, err := cmd.CombinedOutput()

	if err != nil {
		log.Error().
			Str("config_path", configPath).
			Str("output", string(output)).
			Err(err).
			Msg("nginx configuration validation failed")
		return fmt.Errorf("nginx configuration validation failed: %w", err)
	}

	log.Info().
		Str("config_path", configPath).
		Str("output", string(output)).
		Msg("nginx configuration validation passed")

	return nil
}

// ValidateConfig validates nginx configuration string (without writing to file)
func (v *Validator) ValidateConfig(ctx context.Context, configContent string) error {
	// For now, just do basic syntax checking
	if strings.TrimSpace(configContent) == "" {
		return fmt.Errorf("nginx configuration is empty")
	}

	// Check for basic nginx syntax elements
	if !strings.Contains(configContent, "server") && !strings.Contains(configContent, "upstream") {
		log.Warn().Msg("nginx configuration may be incomplete - no server or upstream blocks found")
	}

	return nil
}

// validateWithDocker validates nginx config using docker exec
func (v *Validator) validateWithDocker(ctx context.Context, configPath string) error {
	log.Debug().Str("container", v.dockerContainer).Msg("validating nginx config with docker")

	// Check if docker container exists and is running
	checkCmd := exec.CommandContext(ctx, "docker", "ps", "-q", "-f", fmt.Sprintf("name=%s", v.dockerContainer))
	output, err := checkCmd.CombinedOutput()
	if err != nil || strings.TrimSpace(string(output)) == "" {
		log.Warn().Str("container", v.dockerContainer).Msg("docker container not found or not running, skipping validation")
		return nil
	}

	// Run nginx -t inside the docker container
	cmd := exec.CommandContext(ctx, "docker", "exec", v.dockerContainer, "nginx", "-t")
	output, err = cmd.CombinedOutput()

	if err != nil {
		log.Error().
			Str("container", v.dockerContainer).
			Str("output", string(output)).
			Err(err).
			Msg("docker nginx configuration validation failed")
		return fmt.Errorf("docker nginx configuration validation failed: %w", err)
	}

	log.Info().
		Str("container", v.dockerContainer).
		Str("output", string(output)).
		Msg("docker nginx configuration validation passed")

	return nil
}

// validateWithCustomCommand validates using a custom NGINX_CMD
func (v *Validator) validateWithCustomCommand(ctx context.Context, nginxCmd, configPath string) error {
	log.Debug().Str("nginx_cmd", nginxCmd).Msg("validating nginx config with custom command")

	// Parse the command and arguments
	parts := strings.Fields(nginxCmd)
	if len(parts) == 0 {
		return fmt.Errorf("NGINX_CMD is empty")
	}

	// Add validation flags
	args := append(parts[1:], "-t")
	if configPath != "" {
		args = append(args, "-c", configPath)
	}

	cmd := exec.CommandContext(ctx, parts[0], args...)
	output, err := cmd.CombinedOutput()

	if err != nil {
		log.Error().
			Str("nginx_cmd", nginxCmd).
			Str("output", string(output)).
			Err(err).
			Msg("custom nginx command validation failed")
		return fmt.Errorf("custom nginx command validation failed: %w", err)
	}

	log.Info().
		Str("nginx_cmd", nginxCmd).
		Str("output", string(output)).
		Msg("custom nginx command validation passed")

	return nil
}

// SetNginxPath allows setting a custom path to the nginx binary
func (v *Validator) SetNginxPath(path string) {
	v.nginxPath = path
}

// EnableDockerValidation enables validation using docker exec
func (v *Validator) EnableDockerValidation(containerName string) {
	v.useDocker = true
	if containerName != "" {
		v.dockerContainer = containerName
	}
}

// DisableDockerValidation disables docker validation and uses local nginx binary
func (v *Validator) DisableDockerValidation() {
	v.useDocker = false
}
