package api

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/GLINCKER/glinrdock/internal/plan"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
)

// ClientStore interface for client operations
type ClientStore interface {
	ListClients(ctx context.Context) ([]store.Client, error)
	TouchClient(ctx context.Context, name, ip string) error
	CreateClient(ctx context.Context, spec store.ClientSpec) (store.Client, error)
	DeleteClient(ctx context.Context, id int64) error
	CountActiveClients(ctx context.Context) (int, error)
	TokenCount(ctx context.Context) (int, error)
	UserCount(ctx context.Context) (int, error)
}

// TouchClientRequest represents a client touch request
type TouchClientRequest struct {
	Name string `json:"name" binding:"required"`
	IP   string `json:"ip"`
}

// ListClients returns all clients
func (h *Handlers) ListClients(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()
	
	// Cast tokenStore to ClientStore interface - we know it implements both
	clientStore, ok := h.tokenStore.(ClientStore)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "client operations not supported"})
		return
	}

	clients, err := clientStore.ListClients(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list clients"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"clients": clients})
}

// TouchClient creates or updates a client's last seen timestamp
func (h *Handlers) TouchClient(c *gin.Context) {
	var req TouchClientRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()
	
	// Cast tokenStore to ClientStore interface
	clientStore, ok := h.tokenStore.(ClientStore)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "client operations not supported"})
		return
	}

	// Extract client IP if not provided
	if req.IP == "" {
		req.IP = getClientIP(c)
	}

	// Check quota before creating/updating client
	if h.planEnforcer != nil {
		if err := h.planEnforcer.CheckClientQuota(ctx, clientStore); err != nil {
			if errors.Is(err, plan.ErrClientQuota) {
				usage, _ := h.planEnforcer.GetUsage(ctx, clientStore)
				limits := h.planEnforcer.GetLimits()
				HandleClientQuotaError(c, usage.Clients, limits.MaxClients, h.planEnforcer.GetPlan())
				return
			}
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to check quota"})
			return
		}
	}

	err := clientStore.TouchClient(ctx, req.Name, req.IP)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "client updated successfully",
		"name":      req.Name,
		"last_seen": time.Now().Format(time.RFC3339),
	})
}

// DeleteClient removes a client by ID
func (h *Handlers) DeleteClient(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "client id is required"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 5*time.Second)
	defer cancel()
	
	// Cast tokenStore to ClientStore interface
	clientStore, ok := h.tokenStore.(ClientStore)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "client operations not supported"})
		return
	}

	// Parse ID
	clientID, err := strconv.ParseInt(id, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid client id"})
		return
	}

	err = clientStore.DeleteClient(ctx, clientID)
	if err != nil {
		if err == store.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "client not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete client"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "client deleted successfully"})
}

// getClientIP extracts client IP from request
func getClientIP(c *gin.Context) string {
	// Check X-Forwarded-For header first
	xff := c.GetHeader("X-Forwarded-For")
	if xff != "" {
		// Take the first IP if multiple
		ips := strings.Split(xff, ",")
		return strings.TrimSpace(ips[0])
	}
	
	// Check X-Real-IP header
	realIP := c.GetHeader("X-Real-IP")
	if realIP != "" {
		return realIP
	}
	
	// Fall back to remote address
	return c.ClientIP()
}