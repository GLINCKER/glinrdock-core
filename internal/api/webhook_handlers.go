package api

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/GLINCKER/glinrdock/internal/github"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
)

// WebhookHandlers provides webhook management functionality
type WebhookHandlers struct {
	store         *store.Store
	auditLogger   *audit.Logger
	webhookSecret string
	githubHandler *github.WebhookHandler
}


// NewWebhookHandlers creates a new WebhookHandlers instance
func NewWebhookHandlers(store *store.Store, auditLogger *audit.Logger, webhookSecret, githubAppWebhookSecret string) *WebhookHandlers {
	var githubHandler *github.WebhookHandler
	if githubAppWebhookSecret != "" {
		githubHandler = github.NewWebhookHandler(githubAppWebhookSecret, store)
	}
	
	return &WebhookHandlers{
		store:         store,
		auditLogger:   auditLogger,
		webhookSecret: webhookSecret,
		githubHandler: githubHandler,
	}
}

// GitHubAppWebhook handles GitHub App webhook events
func (h *WebhookHandlers) GitHubAppWebhook(c *gin.Context) {
	if h.githubHandler == nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "GitHub App webhook not configured"})
		return
	}
	
	// Delegate to the GitHub webhook handler
	h.githubHandler.HandleWebhook(c.Writer, c.Request)
}

// Alias for backwards compatibility  
func (h *WebhookHandlers) GitHubWebhook(c *gin.Context) {
	h.GitHubWebhookEnhanced(c)
}

// GitHubWebhookEnhanced handles GitHub webhook events with delivery tracking
func (h *WebhookHandlers) GitHubWebhookEnhanced(c *gin.Context) {
	deliveryID := c.GetHeader("X-GitHub-Delivery")
	if deliveryID == "" {
		deliveryID = uuid.New().String()
	}

	event := c.GetHeader("X-GitHub-Event")
	
	// Read the payload
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "failed to read request body"})
		return
	}

	// Verify webhook signature if secret is configured
	if h.webhookSecret != "" {
		signature := c.GetHeader("X-Hub-Signature-256")
		if signature == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "missing webhook signature"})
			h.recordWebhookDelivery(c.Request.Context(), deliveryID, event, "unknown", "failed", string(body), "Missing webhook signature")
			return
		}

		if !verifyWebhookSignature(body, signature, h.webhookSecret) {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid webhook signature"})
			h.recordWebhookDelivery(c.Request.Context(), deliveryID, event, "unknown", "failed", string(body), "Invalid webhook signature")
			return
		}
	}

	// Create initial delivery record
	delivery := &store.WebhookDelivery{
		ID:         deliveryID,
		Event:      event,
		Repository: "unknown", // Will be updated after parsing payload
		Status:     "processing",
		Payload:    string(body),
		CreatedAt:  time.Now(),
	}

	// Parse the payload to get repository info
	var payload GitHubPushPayload
	if err := json.Unmarshal(body, &payload); err != nil {
		delivery.Repository = "parse_error"
		delivery.Status = "failed"
		response := "Failed to parse JSON payload"
		delivery.Response = &response
		h.store.CreateWebhookDelivery(c.Request.Context(), delivery)
		
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON payload"})
		return
	}

	delivery.Repository = payload.Repository.FullName
	h.store.CreateWebhookDelivery(c.Request.Context(), delivery)

	// Only process push events
	if event != "push" {
		response := "Event ignored - only push events are processed"
		h.store.UpdateWebhookDeliveryStatus(c.Request.Context(), deliveryID, "success", &response)
		c.JSON(http.StatusOK, gin.H{"message": "event ignored", "delivery_id": deliveryID})
		return
	}

	// Find project that matches this repository
	project, err := h.store.GetProjectByRepoURL(c.Request.Context(), payload.Repository.CloneURL)
	if err != nil {
		if err == store.ErrNotFound {
			response := "No project configured for this repository"
			h.store.UpdateWebhookDeliveryStatus(c.Request.Context(), deliveryID, "success", &response)
			c.JSON(http.StatusOK, gin.H{"message": "no project configured for this repository", "delivery_id": deliveryID})
			return
		}
		
		response := "Failed to find project for repository"
		h.store.UpdateWebhookDeliveryStatus(c.Request.Context(), deliveryID, "failed", &response)
		log.Error().Err(err).Str("repo", payload.Repository.CloneURL).Msg("failed to find project for repository")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process webhook"})
		return
	}

	// Check if the push is to the configured branch
	ref := strings.TrimPrefix(payload.Ref, "refs/heads/")
	if project.Branch != "" && ref != project.Branch {
		response := "Push to branch '" + ref + "' ignored, project configured for '" + project.Branch + "'"
		h.store.UpdateWebhookDeliveryStatus(c.Request.Context(), deliveryID, "success", &response)
		c.JSON(http.StatusOK, gin.H{"message": "branch ignored", "delivery_id": deliveryID})
		return
	}

	// Find services in this project
	services, err := h.store.ListServices(c.Request.Context(), project.ID)
	if err != nil {
		response := "Failed to get project services"
		h.store.UpdateWebhookDeliveryStatus(c.Request.Context(), deliveryID, "failed", &response)
		log.Error().Err(err).Int64("project_id", project.ID).Msg("failed to get project services")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process webhook"})
		return
	}

	if len(services) == 0 {
		response := "No services found in project"
		h.store.UpdateWebhookDeliveryStatus(c.Request.Context(), deliveryID, "success", &response)
		c.JSON(http.StatusOK, gin.H{"message": "no services in project", "delivery_id": deliveryID})
		return
	}

	// If project has an image target, deploy to all services using that image
	if project.ImageTarget != nil && *project.ImageTarget != "" {
		deployCount := 0
		for _, service := range services {
			// Update service to use the latest image tag
			imageTag := *project.ImageTarget + ":" + payload.After[:7] // Use short commit hash
			
			// Update service image
			updates := service
			updates.Image = imageTag
			err = h.store.UpdateService(c.Request.Context(), service.ID, updates)
			if err != nil {
				log.Error().Err(err).Int64("service_id", service.ID).Msg("failed to update service image")
				continue
			}
			deployCount++
		}

		response := "Deployed to " + strconv.Itoa(deployCount) + " services"
		h.store.UpdateWebhookDeliveryStatus(c.Request.Context(), deliveryID, "success", &response)

		// Log audit event
		h.auditLogger.Record(c.Request.Context(), "webhook", audit.ActionWebhookDelivery, "delivery", deliveryID, map[string]interface{}{
			"delivery_id": deliveryID,
			"event":       event,
			"repository":  payload.Repository.FullName,
			"commit":      payload.After,
			"project":     project.Name,
			"services":    deployCount,
		})

		c.JSON(http.StatusOK, gin.H{
			"message":     "webhook processed successfully",
			"delivery_id": deliveryID,
			"deployed":    deployCount,
			"services":    len(services),
		})
		return
	}

	// If no image target configured, just record success
	response := "Webhook received but no image target configured for deployment"
	h.store.UpdateWebhookDeliveryStatus(c.Request.Context(), deliveryID, "success", &response)

	// Log audit event
	h.auditLogger.Record(c.Request.Context(), "webhook", audit.ActionWebhookDelivery, "delivery", deliveryID, map[string]interface{}{
		"delivery_id": deliveryID,
		"event":       event,
		"repository":  payload.Repository.FullName,
		"commit":      payload.After,
		"project":     project.Name,
		"status":      "no_deployment",
	})

	c.JSON(http.StatusOK, gin.H{
		"message":     "webhook received",
		"delivery_id": deliveryID,
		"note":        "no deployment target configured",
	})
}

// ListWebhookDeliveries returns recent webhook deliveries
func (h *WebhookHandlers) ListWebhookDeliveries(c *gin.Context) {
	limitStr := c.DefaultQuery("limit", "50")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 || limit > 100 {
		limit = 50
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}

	deliveries, err := h.store.GetWebhookDeliveries(c.Request.Context(), limit, offset)
	if err != nil {
		log.Error().Err(err).Msg("failed to get webhook deliveries")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get webhook deliveries"})
		return
	}

	total, err := h.store.GetWebhookDeliveriesCount(c.Request.Context())
	if err != nil {
		log.Error().Err(err).Msg("failed to get webhook deliveries count")
		total = 0
	}

	c.JSON(http.StatusOK, gin.H{
		"deliveries": deliveries,
		"total":      total,
		"limit":      limit,
		"offset":     offset,
	})
}

// GetWebhookDelivery returns a specific webhook delivery
func (h *WebhookHandlers) GetWebhookDelivery(c *gin.Context) {
	deliveryID := c.Param("id")
	
	delivery, err := h.store.GetWebhookDelivery(c.Request.Context(), deliveryID)
	if err != nil {
		if err == store.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "webhook delivery not found"})
			return
		}
		log.Error().Err(err).Str("delivery_id", deliveryID).Msg("failed to get webhook delivery")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get webhook delivery"})
		return
	}

	c.JSON(http.StatusOK, delivery)
}

// recordWebhookDelivery is a helper function to record webhook delivery attempts
func (h *WebhookHandlers) recordWebhookDelivery(ctx context.Context, deliveryID, event, repository, status, payload, response string) {
	delivery := &store.WebhookDelivery{
		ID:         deliveryID,
		Event:      event,
		Repository: repository,
		Status:     status,
		Payload:    payload,
		Response:   &response,
		CreatedAt:  time.Now(),
	}
	
	err := h.store.CreateWebhookDelivery(ctx, delivery)
	if err != nil {
		log.Error().Err(err).Msg("failed to record webhook delivery")
	}
}