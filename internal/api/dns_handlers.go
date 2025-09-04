package api

import (
	"context"
	"net/http"
	"time"

	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// DNSHandlers contains DNS provider management API handlers
type DNSHandlers struct {
	store       *store.Store
	auditLogger *audit.Logger
}

// DNSProviderRequest represents a request to create/update a DNS provider
type DNSProviderRequest struct {
	Name   string                 `json:"name" binding:"required"`
	Type   string                 `json:"type" binding:"required"`
	Config map[string]interface{} `json:"config" binding:"required"`
}

// DNSProviderResponse represents a DNS provider in API responses
type DNSProviderResponse struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Type      string    `json:"type"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	// Note: config_json is deliberately omitted for security
}

// NewDNSHandlers creates new DNS handlers
func NewDNSHandlers(store *store.Store, auditLogger *audit.Logger) *DNSHandlers {
	return &DNSHandlers{
		store:       store,
		auditLogger: auditLogger,
	}
}

// CreateDNSProvider creates a new DNS provider (admin only)
// @Summary Create DNS provider
// @Description Creates a new DNS provider configuration for domain management
// @Tags dns
// @Security AdminAuth
// @Accept json
// @Produce json
// @Param provider body DNSProviderRequest true "DNS provider configuration"
// @Success 201 {object} DNSProviderResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/dns/providers [post]
func (h *DNSHandlers) CreateDNSProvider(c *gin.Context) {
	var req DNSProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Warn().Err(err).Msg("invalid DNS provider request")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: " + err.Error()})
		return
	}

	// Validate provider type
	if req.Type != "cloudflare" {
		log.Warn().Str("type", req.Type).Msg("unsupported DNS provider type")
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported provider type: " + req.Type})
		return
	}

	// Validate Cloudflare configuration
	if req.Type == "cloudflare" {
		apiToken, ok := req.Config["api_token"].(string)
		if !ok || apiToken == "" {
			log.Warn().Msg("missing or invalid api_token in Cloudflare configuration")
			c.JSON(http.StatusBadRequest, gin.H{"error": "Cloudflare provider requires 'api_token' in config"})
			return
		}
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	// Create DNS provider spec
	spec := store.DNSProviderSpec{
		Name:   req.Name,
		Type:   req.Type,
		Config: req.Config,
	}

	// Create the provider
	provider, err := h.store.CreateDNSProvider(ctx, spec)
	if err != nil {
		log.Error().Err(err).Str("name", req.Name).Msg("failed to create DNS provider")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create DNS provider"})
		return
	}

	log.Info().
		Int64("provider_id", provider.ID).
		Str("name", provider.Name).
		Str("type", provider.Type).
		Msg("DNS provider created successfully")

	// Audit log DNS provider creation
	if h.auditLogger != nil {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordDNSAction(c.Request.Context(), actor, audit.ActionDNSProviderCreate, map[string]interface{}{
			"provider_id": provider.ID,
			"name":        provider.Name,
			"type":        provider.Type,
		})
	}

	// Return response without exposing configuration
	response := DNSProviderResponse{
		ID:        provider.ID,
		Name:      provider.Name,
		Type:      provider.Type,
		CreatedAt: provider.CreatedAt,
		UpdatedAt: provider.UpdatedAt,
	}

	c.JSON(http.StatusCreated, response)
}

// ListDNSProviders lists all DNS providers (admin only)
// @Summary List DNS providers
// @Description Returns a list of all configured DNS providers
// @Tags dns
// @Security AdminAuth
// @Produce json
// @Success 200 {array} DNSProviderResponse
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/dns/providers [get]
func (h *DNSHandlers) ListDNSProviders(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 10*time.Second)
	defer cancel()

	providers, err := h.store.ListDNSProviders(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to list DNS providers")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve DNS providers"})
		return
	}

	// Convert to response format (without exposing configurations)
	responses := make([]DNSProviderResponse, len(providers))
	for i, provider := range providers {
		responses[i] = DNSProviderResponse{
			ID:        provider.ID,
			Name:      provider.Name,
			Type:      provider.Type,
			CreatedAt: provider.CreatedAt,
			UpdatedAt: provider.UpdatedAt,
		}
	}

	log.Debug().Int("count", len(responses)).Msg("DNS providers listed successfully")

	// Audit log DNS provider list
	if h.auditLogger != nil {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordDNSAction(c.Request.Context(), actor, audit.ActionDNSProviderList, map[string]interface{}{
			"count": len(responses),
		})
	}

	c.JSON(http.StatusOK, responses)
}