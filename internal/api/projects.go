package api

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/GLINCKER/glinrdock/internal/auth"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// ProjectStore interface for project operations
type ProjectStore interface {
	CreateProject(ctx context.Context, name string) (store.Project, error)
	CreateProjectWithWebhook(ctx context.Context, name string, repoURL, branch, imageTarget *string) (store.Project, error)
	UpdateProject(ctx context.Context, id int64, name string, repoURL, branch, imageTarget *string) (store.Project, error)
	ListProjects(ctx context.Context) ([]store.Project, error)
	GetProject(ctx context.Context, id int64) (store.Project, error)
	DeleteProject(ctx context.Context, id int64) error
}

// CreateProjectRequest represents project creation request
type CreateProjectRequest struct {
	Name        string  `json:"name" binding:"required"`
	RepoURL     *string `json:"repo_url"`
	Branch      string  `json:"branch"`
	ImageTarget *string `json:"image_target"`
}

// UpdateProjectRequest represents project update request
type UpdateProjectRequest struct {
	Name        string  `json:"name" binding:"required"`
	RepoURL     *string `json:"repo_url"`
	Branch      string  `json:"branch"`
	ImageTarget *string `json:"image_target"`
}

// CreateProject creates a new project
func (h *Handlers) CreateProject(c *gin.Context) {
	var req CreateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Use webhook-enabled method if any webhook fields are provided
	var project store.Project
	var err error
	
	if req.RepoURL != nil || req.Branch != "" || req.ImageTarget != nil {
		var branch *string
		if req.Branch != "" {
			branch = &req.Branch
		}
		project, err = h.projectStore.CreateProjectWithWebhook(ctx, req.Name, req.RepoURL, branch, req.ImageTarget)
	} else {
		project, err = h.projectStore.CreateProject(ctx, req.Name)
	}
	
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Ensure Docker network exists for the project
	if h.networkManager != nil && project.NetworkName != nil {
		_, existed, err := h.networkManager.EnsureProjectNetwork(ctx, *project.NetworkName, project.ID)
		if err != nil {
			// Log the error but don't fail the project creation
			// The network can be created later when services are deployed
			// TODO: Consider logging this error for monitoring
		}
		_ = existed // Silence unused variable warning
	}

	// Record audit entry for project creation
	if h.auditLogger != nil {
		actor := auth.CurrentTokenName(c)
		if actor == "" {
			actor = "system"
		}
		meta := map[string]interface{}{
			"project_name": req.Name,
			"project_id":   project.ID,
			"created_by":   auth.CurrentRole(c),
		}
		if req.RepoURL != nil {
			meta["repo_url"] = *req.RepoURL
		}
		if req.Branch != "" {
			meta["branch"] = req.Branch
		}
		if req.ImageTarget != nil {
			meta["image_target"] = *req.ImageTarget
		}
		h.auditLogger.RecordProjectAction(ctx, actor, audit.ActionProjectCreate, strconv.FormatInt(project.ID, 10), meta)
	}

	// Index project for search asynchronously
	go func() {
		indexCtx, indexCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer indexCancel()
		if err := h.store.IndexProject(indexCtx, project.ID); err != nil {
			// Log error with sampling to avoid spam (1 in 10 errors logged)
			if project.ID%10 == 0 {
				log.Error().Err(err).Int64("project_id", project.ID).Msg("failed to index project for search")
			}
		}
	}()

	c.JSON(http.StatusCreated, project)
}

// ListProjects returns all projects
func (h *Handlers) ListProjects(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	projects, err := h.projectStore.ListProjects(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list projects"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"projects": projects})
}

// GetProject returns a single project by ID
func (h *Handlers) GetProject(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	project, err := h.projectStore.GetProject(ctx, id)
	if err != nil {
		if err.Error() == "project not found: "+idStr {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get project"})
		}
		return
	}

	c.JSON(http.StatusOK, project)
}

// DeleteProject removes a project by ID
func (h *Handlers) DeleteProject(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()

	// Get project details before deletion for audit logging
	project, getErr := h.projectStore.GetProject(ctx, id)

	err = h.projectStore.DeleteProject(ctx, id)
	if err != nil {
		if err.Error() == "project not found: "+idStr {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete project"})
		}
		return
	}

	// Remove project from search index asynchronously
	go func() {
		indexCtx, indexCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer indexCancel()
		if err := h.store.SearchDeleteByEntity(indexCtx, "project", id); err != nil {
			// Log error with sampling to avoid spam (1 in 10 errors logged)
			if id%10 == 0 {
				log.Error().Err(err).Int64("project_id", id).Msg("failed to delete project from search index")
			}
		}
	}()

	// Record audit entry for project deletion
	if h.auditLogger != nil && getErr == nil {
		actor := auth.CurrentTokenName(c)
		if actor == "" {
			actor = "system"
		}
		h.auditLogger.RecordProjectAction(ctx, actor, audit.ActionProjectDelete, strconv.FormatInt(id, 10), map[string]interface{}{
			"project_name": project.Name,
			"project_id":   id,
			"deleted_by":   auth.CurrentRole(c),
		})
	}

	c.JSON(http.StatusOK, gin.H{"message": "project deleted successfully"})
}

// UpdateProject updates an existing project
func (h *Handlers) UpdateProject(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid project ID"})
		return
	}

	var req UpdateProjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	// Get original project for audit logging
	originalProject, getErr := h.projectStore.GetProject(ctx, id)

	var branch *string
	if req.Branch != "" {
		branch = &req.Branch
	}
	
	project, err := h.projectStore.UpdateProject(ctx, id, req.Name, req.RepoURL, branch, req.ImageTarget)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Record audit entry for project update
	if h.auditLogger != nil && getErr == nil {
		actor := auth.CurrentTokenName(c)
		if actor == "" {
			actor = "system"
		}
		meta := map[string]interface{}{
			"project_name": req.Name,
			"project_id":   project.ID,
			"updated_by":   auth.CurrentRole(c),
			"changes":      map[string]interface{}{},
		}
		
		changes := make(map[string]interface{})
		if originalProject.Name != req.Name {
			changes["name"] = map[string]interface{}{
				"from": originalProject.Name,
				"to":   req.Name,
			}
		}
		
		origRepoURL := ""
		if originalProject.RepoURL != nil {
			origRepoURL = *originalProject.RepoURL
		}
		newRepoURL := ""
		if req.RepoURL != nil {
			newRepoURL = *req.RepoURL
		}
		if origRepoURL != newRepoURL {
			changes["repo_url"] = map[string]interface{}{
				"from": origRepoURL,
				"to":   newRepoURL,
			}
		}
		
		if originalProject.Branch != req.Branch {
			changes["branch"] = map[string]interface{}{
				"from": originalProject.Branch,
				"to":   req.Branch,
			}
		}
		
		origImageTarget := ""
		if originalProject.ImageTarget != nil {
			origImageTarget = *originalProject.ImageTarget
		}
		newImageTarget := ""
		if req.ImageTarget != nil {
			newImageTarget = *req.ImageTarget
		}
		if origImageTarget != newImageTarget {
			changes["image_target"] = map[string]interface{}{
				"from": origImageTarget,
				"to":   newImageTarget,
			}
		}
		
		meta["changes"] = changes
		h.auditLogger.RecordProjectAction(ctx, actor, audit.ActionProjectUpdate, strconv.FormatInt(project.ID, 10), meta)
	}

	// Re-index project for search asynchronously
	go func() {
		indexCtx, indexCancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer indexCancel()
		if err := h.store.IndexProject(indexCtx, project.ID); err != nil {
			// Log error with sampling to avoid spam (1 in 10 errors logged)
			if project.ID%10 == 0 {
				log.Error().Err(err).Int64("project_id", project.ID).Msg("failed to re-index project for search")
			}
		}
	}()

	c.JSON(http.StatusOK, project)
}