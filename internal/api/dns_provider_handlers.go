package api

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/GLINCKER/glinrdock/internal/store"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// DNSProviderHandlers contains DNS provider management API handlers
type DNSProviderHandlers struct {
	store       *store.Store
	auditLogger *audit.Logger
}

// CreateDNSProviderRequest represents a request to create a DNS provider
type CreateDNSProviderRequest struct {
	Name     string         `json:"name" binding:"required"`
	Type     string         `json:"type" binding:"required"`
	Label    string         `json:"label" binding:"required"`
	Email    *string        `json:"email,omitempty"`
	APIToken *string        `json:"api_token,omitempty"`
	Config   map[string]any `json:"config" binding:"required"`
	Settings map[string]any `json:"settings,omitempty"`
}

// ProviderResponse represents a DNS provider in API responses
type ProviderResponse struct {
	ID        int64          `json:"id"`
	Name      string         `json:"name"`
	Type      string         `json:"type"`
	Label     *string        `json:"label"`
	Email     *string        `json:"email"`
	Settings  map[string]any `json:"settings,omitempty"`
	Active    *bool          `json:"active"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	// Include provider-specific hints
	ProviderHints *ProviderHints `json:"provider_hints,omitempty"`
}

// ProviderHints contains provider-specific configuration hints and metadata
type ProviderHints struct {
	Type           string   `json:"type"`
	RequiredScopes []string `json:"required_scopes,omitempty"`
	DashboardURL   string   `json:"dashboard_url,omitempty"`
	Description    string   `json:"description,omitempty"`
}

// DNSProviderListResponse represents a list of DNS providers
type DNSProviderListResponse struct {
	Providers []ProviderResponse `json:"providers"`
	Count     int                `json:"count"`
}

// NewDNSProviderHandlers creates new DNS provider handlers
func NewDNSProviderHandlers(store *store.Store, auditLogger *audit.Logger) *DNSProviderHandlers {
	return &DNSProviderHandlers{
		store:       store,
		auditLogger: auditLogger,
	}
}

// CreateDNSProvider creates a new DNS provider
// @Summary Create DNS provider
// @Description Create a new DNS provider with encrypted API token storage
// @Tags dns-providers
// @Accept json
// @Produce json
// @Param provider body CreateDNSProviderRequest true "DNS Provider configuration"
// @Success 201 {object} DNSProviderResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/dns/providers [post]
func (h *DNSProviderHandlers) CreateDNSProvider(c *gin.Context) {
	var req CreateDNSProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		log.Warn().Err(err).Msg("invalid DNS provider request")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: " + err.Error()})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	// Create provider spec for store layer
	spec := store.DNSProviderSpec{
		Name:     req.Name,
		Type:     req.Type,
		Label:    req.Label,
		Email:    req.Email,
		APIToken: req.APIToken,
		Config:   req.Config,
		Settings: req.Settings,
	}

	// Create provider in store (encryption handled in store layer)
	provider, err := h.store.CreateDNSProvider(ctx, spec)
	if err != nil {
		log.Error().Err(err).Msg("failed to create DNS provider")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create DNS provider"})
		return
	}

	// Audit log the creation
	h.auditLogger.RecordDNSAction(ctx, "system", audit.ActionDNSProviderCreate, map[string]interface{}{
		"provider_id":   provider.ID,
		"provider_name": provider.Name,
		"provider_type": provider.Type,
		"label":         provider.Label,
	})

	// Build response with provider hints
	response := h.buildDNSProviderResponse(&provider)
	c.JSON(http.StatusCreated, response)
}

// ListDNSProviders lists all DNS providers
// @Summary List DNS providers
// @Description List all active DNS providers
// @Tags dns-providers
// @Produce json
// @Success 200 {object} DNSProviderListResponse
// @Failure 401 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/dns/providers [get]
func (h *DNSProviderHandlers) ListDNSProviders(c *gin.Context) {
	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	providers, err := h.store.ListDNSProviders(ctx)
	if err != nil {
		log.Error().Err(err).Msg("failed to list DNS providers")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to list DNS providers"})
		return
	}

	// Build response
	responses := make([]ProviderResponse, 0, len(providers))
	for _, provider := range providers {
		responses = append(responses, h.buildDNSProviderResponse(&provider))
	}

	result := DNSProviderListResponse{
		Providers: responses,
		Count:     len(responses),
	}

	c.JSON(http.StatusOK, result)
}

// GetDNSProvider gets a specific DNS provider by ID
// @Summary Get DNS provider
// @Description Get a specific DNS provider by ID
// @Tags dns-providers
// @Produce json
// @Param id path int true "Provider ID"
// @Success 200 {object} DNSProviderResponse
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/dns/providers/{id} [get]
func (h *DNSProviderHandlers) GetDNSProvider(c *gin.Context) {
	providerID, provider, err := h.getDNSProviderFromPath(c)
	if err != nil {
		return
	}

	// Audit log the access
	h.auditLogger.RecordDNSAction(c.Request.Context(), "system", audit.ActionRead, map[string]interface{}{
		"provider_id": providerID,
	})

	response := h.buildDNSProviderResponse(provider)
	c.JSON(http.StatusOK, response)
}

// DeleteDNSProvider deletes a DNS provider by ID (soft delete)
// @Summary Delete DNS provider
// @Description Soft delete a DNS provider by ID
// @Tags dns-providers
// @Param id path int true "Provider ID"
// @Success 204
// @Failure 400 {object} map[string]string
// @Failure 401 {object} map[string]string
// @Failure 403 {object} map[string]string
// @Failure 404 {object} map[string]string
// @Failure 500 {object} map[string]string
// @Router /v1/dns/providers/{id} [delete]
func (h *DNSProviderHandlers) DeleteDNSProvider(c *gin.Context) {
	providerIDStr := c.Param("id")
	providerID, err := strconv.ParseInt(providerIDStr, 10, 64)
	if err != nil {
		log.Warn().Str("provider_id", providerIDStr).Msg("invalid provider ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid provider ID"})
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	err = h.store.DeleteDNSProvider(ctx, providerID)
	if err != nil {
		if err == store.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "DNS provider not found"})
			return
		}
		log.Error().Err(err).Int64("provider_id", providerID).Msg("failed to delete DNS provider")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to delete DNS provider"})
		return
	}

	// Audit log the deletion
	h.auditLogger.RecordDNSAction(ctx, "system", audit.ActionTokenDelete, map[string]interface{}{
		"provider_id": providerID,
	})

	c.JSON(http.StatusNoContent, nil)
}

// Helper methods

func (h *DNSProviderHandlers) getDNSProviderFromPath(c *gin.Context) (int64, *store.DNSProvider, error) {
	providerIDStr := c.Param("id")
	providerID, err := strconv.ParseInt(providerIDStr, 10, 64)
	if err != nil {
		log.Warn().Str("provider_id", providerIDStr).Msg("invalid provider ID")
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid provider ID"})
		return 0, nil, err
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 30*time.Second)
	defer cancel()

	provider, err := h.store.GetDNSProvider(ctx, providerID)
	if err != nil {
		if err == store.ErrNotFound {
			c.JSON(http.StatusNotFound, gin.H{"error": "DNS provider not found"})
			return 0, nil, err
		}
		log.Error().Err(err).Int64("provider_id", providerID).Msg("failed to get DNS provider")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get DNS provider"})
		return 0, nil, err
	}

	return providerID, &provider, nil
}

func (h *DNSProviderHandlers) buildDNSProviderResponse(provider *store.DNSProvider) ProviderResponse {
	response := ProviderResponse{
		ID:        provider.ID,
		Name:      provider.Name,
		Type:      provider.Type,
		Label:     provider.Label,
		Email:     provider.Email,
		Active:    provider.Active,
		CreatedAt: provider.CreatedAt,
		UpdatedAt: provider.UpdatedAt,
	}

	// Parse settings JSON if available
	if provider.Settings != nil {
		// TODO: Parse settings JSON safely
		response.Settings = map[string]any{}
	}

	// Add provider-specific hints
	response.ProviderHints = h.getProviderHints(provider.Type)

	return response
}

func (h *DNSProviderHandlers) getProviderHints(providerType string) *ProviderHints {
	switch providerType {
	case "cloudflare":
		return &ProviderHints{
			Type:           "cloudflare",
			RequiredScopes: []string{"Zone:DNS:Edit"},
			DashboardURL:   "https://dash.cloudflare.com/profile/api-tokens",
			Description:    "Cloudflare API token with Zone:DNS:Edit permissions for target zones",
		}
	case "route53":
		return &ProviderHints{
			Type:           "route53",
			RequiredScopes: []string{"route53:ChangeResourceRecordSets", "route53:GetHostedZone", "route53:ListResourceRecordSets"},
			DashboardURL:   "https://console.aws.amazon.com/iam/home#/users",
			Description:    "AWS IAM user with Route53 permissions for target hosted zones",
		}
	default:
		return &ProviderHints{
			Type:        providerType,
			Description: "Manual DNS provider - requires manual DNS record configuration",
		}
	}
}
