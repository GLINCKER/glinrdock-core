package api

import (
	"context"
	"fmt"
	"time"

	"github.com/GLINCKER/glinrdock/internal/jobs"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/rs/zerolog/log"
)

// BuildQueueAdapter adapts the existing job queue to the BuildQueue interface
type BuildQueueAdapter struct {
	jobQueue   *jobs.Queue
	buildStore BuildStore
}

// Note: BuildStore interface is defined in cicd.go

// NewBuildQueueAdapter creates a new build queue adapter
func NewBuildQueueAdapter(jobQueue *jobs.Queue, buildStore BuildStore) *BuildQueueAdapter {
	return &BuildQueueAdapter{
		jobQueue:   jobQueue,
		buildStore: buildStore,
	}
}

// EnqueueBuild implements the BuildQueue interface by creating a build record and enqueueing a job
func (a *BuildQueueAdapter) EnqueueBuild(ctx context.Context, buildRequest *BuildRequest) error {
	log.Info().
		Int64("project_id", buildRequest.ProjectID).
		Int64("repository_id", buildRequest.RepositoryID).
		Str("branch", buildRequest.Branch).
		Str("commit", buildRequest.CommitSHA).
		Msg("enqueueing GitHub App triggered build")

	// Generate image tag based on repository and commit
	imageTag := fmt.Sprintf("gh-%d-%s-%d", buildRequest.RepositoryID, buildRequest.Branch, time.Now().Unix())
	if len(buildRequest.CommitSHA) >= 7 {
		imageTag = fmt.Sprintf("gh-%d-%s-%s", buildRequest.RepositoryID, buildRequest.Branch, buildRequest.CommitSHA[:7])
	}

	// Create build record
	build := &store.Build{
		ProjectID:   buildRequest.ProjectID,
		ServiceID:   0, // GitHub App builds are not tied to specific services initially
		GitURL:      buildRequest.CloneURL,
		GitRef:      buildRequest.Branch,
		CommitSHA:   buildRequest.CommitSHA,
		CommitMsg:   buildRequest.CommitMsg,
		ImageTag:    imageTag,
		Status:      "queued",
		TriggeredBy: fmt.Sprintf("github-app:%s", buildRequest.Author),
	}

	// Set build context if provided
	if buildRequest.BuildContext != "" {
		build.ContextPath = buildRequest.BuildContext
	} else {
		build.ContextPath = "." // Default to root
	}

	// Set dockerfile path if provided in build args
	if buildRequest.BuildArgs != nil {
		if dockerfile, ok := buildRequest.BuildArgs["dockerfile"]; ok {
			build.Dockerfile = dockerfile
		} else {
			build.Dockerfile = "Dockerfile" // Default
		}
	} else {
		build.Dockerfile = "Dockerfile" // Default
	}

	// Create the build record in database
	if err := a.buildStore.CreateBuild(ctx, build); err != nil {
		return fmt.Errorf("failed to create build record: %w", err)
	}

	// Prepare job data with GitHub App specific metadata
	jobData := map[string]interface{}{
		"build":         build,
		"github_app":    true,
		"repository_id": buildRequest.RepositoryID,
		"auto_deploy":   buildRequest.AutoDeploy,
	}

	// Add build args if provided
	if buildRequest.BuildArgs != nil && len(buildRequest.BuildArgs) > 0 {
		jobData["build_args"] = buildRequest.BuildArgs
	}

	// Queue the build job
	job := a.jobQueue.Enqueue(jobs.JobTypeBuild, jobData)

	log.Info().
		Int64("build_id", build.ID).
		Str("job_id", job.ID).
		Str("image_tag", build.ImageTag).
		Bool("auto_deploy", buildRequest.AutoDeploy).
		Msg("GitHub App build queued successfully")

	return nil
}
