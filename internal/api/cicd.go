package api

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/GLINCKER/glinrdock/internal/jobs"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// CICDHandlers contains CI/CD API handlers
type CICDHandlers struct {
	buildStore      BuildStore
	deploymentStore DeploymentStore
	serviceStore    ServiceStore
	projectStore    ProjectStore
	jobQueue        *jobs.Queue
	webhookSecret   string
}

// BuildStore interface for build-related database operations
type BuildStore interface {
	CreateBuild(ctx context.Context, build *store.Build) error
	GetBuild(ctx context.Context, buildID int64) (*store.Build, error)
	ListBuilds(ctx context.Context, serviceID int64) ([]*store.Build, error)
	UpdateBuildStatus(ctx context.Context, buildID int64, status string, logPath *string, startedAt, finishedAt *int64) error
}

// DeploymentStore interface for deployment-related database operations
type DeploymentStore interface {
	CreateDeployment(ctx context.Context, deployment *store.Deployment) error
	GetDeployment(ctx context.Context, deploymentID int64) (*store.Deployment, error)
	ListDeployments(ctx context.Context, serviceID int64) ([]*store.Deployment, error)
	GetLatestDeployment(ctx context.Context, serviceID int64) (*store.Deployment, error)
	UpdateDeploymentStatus(ctx context.Context, deploymentID int64, status string, reason *string) error
}

// NewCICDHandlers creates new CI/CD handlers
func NewCICDHandlers(buildStore BuildStore, deploymentStore DeploymentStore, serviceStore ServiceStore, projectStore ProjectStore, jobQueue *jobs.Queue, webhookSecret string) *CICDHandlers {
	return &CICDHandlers{
		buildStore:      buildStore,
		deploymentStore: deploymentStore,
		serviceStore:    serviceStore,
		projectStore:    projectStore,
		jobQueue:        jobQueue,
		webhookSecret:   webhookSecret,
	}
}

// GitHubWebhook handles GitHub webhook events for automatic builds
func (h *CICDHandlers) GitHubWebhook(c *gin.Context) {
	// Verify webhook signature if secret is configured
	if h.webhookSecret != "" {
		signature := c.GetHeader("X-Hub-Signature-256")
		if signature == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing webhook signature"})
			return
		}

		body, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read request body"})
			return
		}

		if !verifyWebhookSignature(body, signature, h.webhookSecret) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid webhook signature"})
			return
		}

		// Reset body for further processing
		c.Request.Body = io.NopCloser(strings.NewReader(string(body)))
	}

	event := c.GetHeader("X-GitHub-Event")
	if event != "push" {
		c.JSON(http.StatusOK, gin.H{"message": "event ignored"})
		return
	}

	var payload GitHubPushPayload
	if err := c.ShouldBindJSON(&payload); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON payload"})
		return
	}

	// Find services that match this repository
	services, err := h.findServicesForRepo(c.Request.Context(), payload.Repository.CloneURL)
	if err != nil {
		log.Error().Err(err).Str("repo", payload.Repository.CloneURL).Msg("failed to find services for repository")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process webhook"})
		return
	}

	if len(services) == 0 {
		c.JSON(http.StatusOK, gin.H{"message": "no services configured for this repository"})
		return
	}

	// Trigger builds for matching services
	var triggeredBuilds []int64
	for _, service := range services {
		buildID, err := h.triggerBuildForService(c.Request.Context(), service, payload.Repository.CloneURL, payload.After)
		if err != nil {
			log.Error().Err(err).Int64("service_id", service.ID).Msg("failed to trigger build")
			continue
		}
		triggeredBuilds = append(triggeredBuilds, buildID)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "builds triggered",
		"builds":   triggeredBuilds,
		"services": len(services),
	})
}

// TriggerBuild manually triggers a build for a service
func (h *CICDHandlers) TriggerBuild(c *gin.Context) {
	serviceID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	var spec store.BuildSpec
	if err := c.ShouldBindJSON(&spec); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid build specification"})
		return
	}

	// Get service details
	service, err := h.serviceStore.GetService(c.Request.Context(), serviceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "service not found"})
		return
	}

	// Create build record
	build := &store.Build{
		ProjectID:   service.ProjectID,
		ServiceID:   serviceID,
		GitURL:      spec.GitURL,
		GitRef:      spec.GitRef,
		ContextPath: spec.ContextPath,
		Dockerfile:  spec.Dockerfile,
		ImageTag:    fmt.Sprintf("%s:%s-%d", service.Name, spec.GitRef, time.Now().Unix()),
		Status:      "queued",
	}

	if err := h.buildStore.CreateBuild(c.Request.Context(), build); err != nil {
		log.Error().Err(err).Msg("failed to create build record")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create build"})
		return
	}

	// Queue build job
	jobData := map[string]interface{}{
		"build": build,
	}
	job := h.jobQueue.Enqueue(jobs.JobTypeBuild, jobData)

	c.JSON(http.StatusCreated, gin.H{
		"build_id": build.ID,
		"job_id":   job.ID,
		"status":   "queued",
	})
}

// GetBuild returns build information
func (h *CICDHandlers) GetBuild(c *gin.Context) {
	buildID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid build ID"})
		return
	}

	build, err := h.buildStore.GetBuild(c.Request.Context(), buildID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "build not found"})
		return
	}

	c.JSON(http.StatusOK, build)
}

// ListBuilds returns builds for a service
func (h *CICDHandlers) ListBuilds(c *gin.Context) {
	serviceID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	builds, err := h.buildStore.ListBuilds(c.Request.Context(), serviceID)
	if err != nil {
		log.Error().Err(err).Int64("service_id", serviceID).Msg("failed to list builds")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list builds"})
		return
	}

	c.JSON(http.StatusOK, builds)
}

// TriggerDeployment triggers a deployment for a service
func (h *CICDHandlers) TriggerDeployment(c *gin.Context) {
	serviceID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	var spec store.DeploymentSpec
	if err := c.ShouldBindJSON(&spec); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid deployment specification"})
		return
	}

	// Get service details
	service, err := h.serviceStore.GetService(c.Request.Context(), serviceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "service not found"})
		return
	}

	// Create deployment record
	deployment := &store.Deployment{
		ProjectID: service.ProjectID,
		ServiceID: serviceID,
		ImageTag:  spec.ImageTag,
		Status:    "queued",
		Reason:    &spec.Reason,
	}

	if err := h.deploymentStore.CreateDeployment(c.Request.Context(), deployment); err != nil {
		log.Error().Err(err).Msg("failed to create deployment record")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create deployment"})
		return
	}

	// Queue deployment job
	jobData := map[string]interface{}{
		"deployment": deployment,
	}
	job := h.jobQueue.Enqueue(jobs.JobTypeDeploy, jobData)

	c.JSON(http.StatusCreated, gin.H{
		"deployment_id": deployment.ID,
		"job_id":        job.ID,
		"status":        "queued",
	})
}

// GetDeployment returns deployment information
func (h *CICDHandlers) GetDeployment(c *gin.Context) {
	deploymentID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid deployment ID"})
		return
	}

	deployment, err := h.deploymentStore.GetDeployment(c.Request.Context(), deploymentID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "deployment not found"})
		return
	}

	c.JSON(http.StatusOK, deployment)
}

// ListDeployments returns deployments for a service
func (h *CICDHandlers) ListDeployments(c *gin.Context) {
	serviceID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	deployments, err := h.deploymentStore.ListDeployments(c.Request.Context(), serviceID)
	if err != nil {
		log.Error().Err(err).Int64("service_id", serviceID).Msg("failed to list deployments")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list deployments"})
		return
	}

	c.JSON(http.StatusOK, deployments)
}

// RollbackDeployment rolls back a service to the previous deployment
func (h *CICDHandlers) RollbackDeployment(c *gin.Context) {
	serviceID, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid service ID"})
		return
	}

	// Get the last two deployments to find the previous one
	deployments, err := h.deploymentStore.ListDeployments(c.Request.Context(), serviceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get deployment history"})
		return
	}

	if len(deployments) < 2 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no previous deployment to rollback to"})
		return
	}

	// Find the previous successful deployment
	var prevDeployment *store.Deployment
	for i := 1; i < len(deployments); i++ {
		if deployments[i].Status == "success" {
			prevDeployment = deployments[i]
			break
		}
	}

	if prevDeployment == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no previous successful deployment found"})
		return
	}

	// Get service details
	service, err := h.serviceStore.GetService(c.Request.Context(), serviceID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "service not found"})
		return
	}

	// Create rollback deployment record
	rollbackReason := fmt.Sprintf("Rollback to deployment %d", prevDeployment.ID)
	deployment := &store.Deployment{
		ProjectID: service.ProjectID,
		ServiceID: serviceID,
		ImageTag:  prevDeployment.ImageTag,
		Status:    "queued",
		Reason:    &rollbackReason,
	}

	if err := h.deploymentStore.CreateDeployment(c.Request.Context(), deployment); err != nil {
		log.Error().Err(err).Msg("failed to create rollback deployment record")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create rollback deployment"})
		return
	}

	// Queue deployment job
	jobData := map[string]interface{}{
		"deployment": deployment,
	}
	job := h.jobQueue.Enqueue(jobs.JobTypeDeploy, jobData)

	c.JSON(http.StatusCreated, gin.H{
		"deployment_id":      deployment.ID,
		"job_id":             job.ID,
		"rollback_to":        prevDeployment.ID,
		"rollback_image_tag": prevDeployment.ImageTag,
		"status":             "queued",
	})
}

// GetJob returns job status
func (h *CICDHandlers) GetJob(c *gin.Context) {
	jobID := c.Param("id")

	job, exists := h.jobQueue.GetJob(jobID)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "job not found"})
		return
	}

	c.JSON(http.StatusOK, job)
}

// Helper methods

func (h *CICDHandlers) findServicesForRepo(ctx context.Context, repoURL string) ([]*store.Service, error) {
	// This is a simplified implementation - in practice, you'd want to store git repository
	// configuration for each service in the database
	// For now, return empty slice as services don't have git configuration yet
	return []*store.Service{}, nil
}

func (h *CICDHandlers) triggerBuildForService(ctx context.Context, service *store.Service, gitURL, gitRef string) (int64, error) {
	// Create build record
	build := &store.Build{
		ProjectID:   service.ProjectID,
		ServiceID:   service.ID,
		GitURL:      gitURL,
		GitRef:      gitRef,
		ContextPath: ".",          // Default context path
		Dockerfile:  "Dockerfile", // Default dockerfile
		ImageTag:    fmt.Sprintf("%s:%s-%d", service.Name, gitRef[:7], time.Now().Unix()),
		Status:      "queued",
	}

	if err := h.buildStore.CreateBuild(ctx, build); err != nil {
		return 0, fmt.Errorf("failed to create build record: %w", err)
	}

	// Queue build job
	jobData := map[string]interface{}{
		"build": build,
	}
	h.jobQueue.Enqueue(jobs.JobTypeBuild, jobData)

	return build.ID, nil
}

func verifyWebhookSignature(payload []byte, signature, secret string) bool {
	if !strings.HasPrefix(signature, "sha256=") {
		return false
	}

	hash := hmac.New(sha256.New, []byte(secret))
	hash.Write(payload)
	expectedSignature := "sha256=" + hex.EncodeToString(hash.Sum(nil))

	return hmac.Equal([]byte(signature), []byte(expectedSignature))
}

// GitHubPushPayload represents a GitHub push webhook payload
type GitHubPushPayload struct {
	Ref        string `json:"ref"`
	Before     string `json:"before"`
	After      string `json:"after"`
	Repository struct {
		ID       int    `json:"id"`
		Name     string `json:"name"`
		FullName string `json:"full_name"`
		CloneURL string `json:"clone_url"`
		GitURL   string `json:"git_url"`
		SSHURL   string `json:"ssh_url"`
	} `json:"repository"`
	Pusher struct {
		Name  string `json:"name"`
		Email string `json:"email"`
	} `json:"pusher"`
}
