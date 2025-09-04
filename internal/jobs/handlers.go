package jobs

import (
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/GLINCKER/glinrdock/internal/docker"
	"github.com/GLINCKER/glinrdock/internal/metrics"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/rs/zerolog/log"
)

// BuildJobHandler handles build jobs
type BuildJobHandler struct {
	dockerRunner docker.Runner
	store        BuildStore
	logDir       string
	queue        *Queue // For progress updates
}

// BuildStore interface for build-related database operations
type BuildStore interface {
	CreateBuild(ctx context.Context, build *store.Build) error
	UpdateBuildStatus(ctx context.Context, buildID int64, status string, logPath *string, startedAt, finishedAt *int64) error
}

// NewBuildJobHandler creates a new build job handler
func NewBuildJobHandler(dockerRunner docker.Runner, buildStore BuildStore, logDir string, queue *Queue) *BuildJobHandler {
	return &BuildJobHandler{
		dockerRunner: dockerRunner,
		store:        buildStore,
		logDir:       logDir,
		queue:        queue,
	}
}

// Handle processes a build job
func (h *BuildJobHandler) Handle(ctx context.Context, job *Job) error {
	// Extract build data from job
	buildData, ok := job.Data["build"].(*store.Build)
	if !ok {
		return fmt.Errorf("invalid build data in job")
	}

	// Update progress
	h.queue.UpdateJobProgress(job.ID, 10)

	// Create log file
	logPath := filepath.Join(h.logDir, fmt.Sprintf("build_%d.log", buildData.ID))
	logFile, err := os.Create(logPath)
	if err != nil {
		return fmt.Errorf("failed to create log file: %w", err)
	}
	defer logFile.Close()

	// Update build status to building
	buildData.Status = "building"
	if err := h.store.UpdateBuildStatus(ctx, buildData.ID, "building", &logPath, nil, nil); err != nil {
		log.Error().Err(err).Int64("build_id", buildData.ID).Msg("failed to update build status")
	}

	h.queue.UpdateJobProgress(job.ID, 20)

	// Prepare build spec
	buildSpec := docker.BuildSpec{
		GitURL:      buildData.GitURL,
		GitRef:      buildData.GitRef,
		ContextPath: buildData.ContextPath,
		Dockerfile:  buildData.Dockerfile,
		ImageTag:    buildData.ImageTag,
		LogWriter:   logFile,
	}

	h.queue.UpdateJobProgress(job.ID, 30)

	// Perform the build and record metrics
	buildStart := time.Now()
	result, err := h.dockerRunner.BuildImage(ctx, buildSpec)
	buildDuration := time.Since(buildStart)

	h.queue.UpdateJobProgress(job.ID, 90)

	// Update build status based on result
	var status string
	var finishedAt int64
	success := true
	if err != nil || (result != nil && !result.Success) {
		status = "failed"
		success = false
		if result != nil {
			finishedAt = result.Duration.Nanoseconds()
		}
	} else {
		status = "success"
		if result != nil {
			finishedAt = result.Duration.Nanoseconds()
		}
	}
	
	// Record build metrics
	metrics.RecordBuild(success, buildDuration)

	updateErr := h.store.UpdateBuildStatus(ctx, buildData.ID, status, &logPath, nil, &finishedAt)
	if updateErr != nil {
		log.Error().Err(updateErr).Int64("build_id", buildData.ID).Msg("failed to update final build status")
	}

	h.queue.UpdateJobProgress(job.ID, 100)

	// Return the original build error if there was one
	if err != nil {
		return fmt.Errorf("build failed: %w", err)
	}

	if result != nil && !result.Success {
		return fmt.Errorf("build failed: %v", result.Error)
	}

	log.Info().Int64("build_id", buildData.ID).Str("image_tag", buildData.ImageTag).Msg("build completed successfully")
	return nil
}

// DeployJobHandler handles deployment jobs
type DeployJobHandler struct {
	dockerRunner docker.Runner
	store        DeployStore
	queue        *Queue // For progress updates
}

// DeployStore interface for deployment-related database operations
type DeployStore interface {
	GetService(ctx context.Context, serviceID int64) (*store.Service, error)
	UpdateService(ctx context.Context, serviceID int64, updates map[string]interface{}) error
	CreateDeployment(ctx context.Context, deployment *store.Deployment) error
	UpdateDeploymentStatus(ctx context.Context, deploymentID int64, status string, reason *string) error
}

// NewDeployJobHandler creates a new deploy job handler
func NewDeployJobHandler(dockerRunner docker.Runner, deployStore DeployStore, queue *Queue) *DeployJobHandler {
	return &DeployJobHandler{
		dockerRunner: dockerRunner,
		store:        deployStore,
		queue:        queue,
	}
}

// Handle processes a deployment job
func (h *DeployJobHandler) Handle(ctx context.Context, job *Job) error {
	// Extract deployment data from job
	deployData, ok := job.Data["deployment"].(*store.Deployment)
	if !ok {
		return fmt.Errorf("invalid deployment data in job")
	}
	
	// Track deployment duration for metrics
	deployStart := time.Now()
	deploySuccess := true

	h.queue.UpdateJobProgress(job.ID, 10)

	// Get service details
	_, err := h.store.GetService(ctx, deployData.ServiceID)
	if err != nil {
		deploySuccess = false
		metrics.RecordDeployment(deploySuccess, time.Since(deployStart))
		return fmt.Errorf("failed to get service: %w", err)
	}

	h.queue.UpdateJobProgress(job.ID, 20)

	// Update deployment status to deploying
	deployData.Status = "deploying"
	if err := h.store.UpdateDeploymentStatus(ctx, deployData.ID, "deploying", nil); err != nil {
		log.Error().Err(err).Int64("deployment_id", deployData.ID).Msg("failed to update deployment status")
	}

	h.queue.UpdateJobProgress(job.ID, 30)

	// Check if the new image exists or pull it
	imageExists, err := h.dockerRunner.ImageExists(ctx, deployData.ImageTag)
	if err != nil {
		return fmt.Errorf("failed to check image existence: %w", err)
	}

	if !imageExists {
		log.Info().Str("image_tag", deployData.ImageTag).Msg("pulling image for deployment")
		if err := h.dockerRunner.PullImage(ctx, deployData.ImageTag); err != nil {
			reason := fmt.Sprintf("Failed to pull image: %v", err)
			h.store.UpdateDeploymentStatus(ctx, deployData.ID, "failed", &reason)
			deploySuccess = false
			metrics.RecordDeployment(deploySuccess, time.Since(deployStart))
			return fmt.Errorf("failed to pull image %s: %w", deployData.ImageTag, err)
		}
	}

	h.queue.UpdateJobProgress(job.ID, 60)

	// Update the service with the new image
	updates := map[string]interface{}{
		"image": deployData.ImageTag,
	}

	if err := h.store.UpdateService(ctx, deployData.ServiceID, updates); err != nil {
		reason := fmt.Sprintf("Failed to update service: %v", err)
		h.store.UpdateDeploymentStatus(ctx, deployData.ID, "failed", &reason)
		deploySuccess = false
		metrics.RecordDeployment(deploySuccess, time.Since(deployStart))
		return fmt.Errorf("failed to update service: %w", err)
	}

	h.queue.UpdateJobProgress(job.ID, 90)

	// Update deployment status to success
	if err := h.store.UpdateDeploymentStatus(ctx, deployData.ID, "success", nil); err != nil {
		log.Error().Err(err).Int64("deployment_id", deployData.ID).Msg("failed to update deployment status to success")
	}

	h.queue.UpdateJobProgress(job.ID, 100)

	// Record successful deployment metrics
	metrics.RecordDeployment(deploySuccess, time.Since(deployStart))

	log.Info().
		Int64("deployment_id", deployData.ID).
		Int64("service_id", deployData.ServiceID).
		Str("image_tag", deployData.ImageTag).
		Msg("deployment completed successfully")

	return nil
}

// LogWriter wraps an io.Writer to provide progress updates during builds
type LogWriter struct {
	writer     io.Writer
	queue      *Queue
	jobID      string
	baseProgress int
	maxProgress  int
	lineCount    int
	targetLines  int
}

// NewLogWriter creates a new LogWriter that updates job progress
func NewLogWriter(writer io.Writer, queue *Queue, jobID string, baseProgress, maxProgress, estimatedLines int) *LogWriter {
	return &LogWriter{
		writer:      writer,
		queue:       queue,
		jobID:       jobID,
		baseProgress: baseProgress,
		maxProgress:  maxProgress,
		targetLines:  estimatedLines,
	}
}

// Write implements io.Writer and updates progress based on log output
func (w *LogWriter) Write(p []byte) (n int, err error) {
	n, err = w.writer.Write(p)
	
	// Count lines to estimate progress
	for _, b := range p[:n] {
		if b == '\n' {
			w.lineCount++
		}
	}
	
	// Update progress based on line count
	if w.targetLines > 0 {
		progressRange := w.maxProgress - w.baseProgress
		lineProgress := (w.lineCount * progressRange) / w.targetLines
		currentProgress := w.baseProgress + lineProgress
		
		if currentProgress > w.maxProgress {
			currentProgress = w.maxProgress
		}
		
		w.queue.UpdateJobProgress(w.jobID, currentProgress)
	}
	
	return n, err
}