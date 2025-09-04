package api

import (
	"crypto/md5"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// HelpHandlers handles help documentation API endpoints
type HelpHandlers struct {
	auditLogger *audit.Logger
}

// NewHelpHandlers creates a new HelpHandlers instance
func NewHelpHandlers(auditLogger *audit.Logger) *HelpHandlers {
	return &HelpHandlers{
		auditLogger: auditLogger,
	}
}

// GetHelpManifest serves the app help manifest with caching headers
func (h *HelpHandlers) GetHelpManifest(c *gin.Context) {
	// Audit logging - sampled 1:20 for performance
	if h.auditLogger != nil {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordSampled(c.Request.Context(), actor, audit.ActionHelpView, "manifest", "_manifest", map[string]interface{}{
			"ip": c.ClientIP(),
		}, 20)
	}

	manifestPath := "appdocs/_manifest.json"
	
	// Check if manifest exists
	if _, err := os.Stat(manifestPath); os.IsNotExist(err) {
		log.Error().Str("path", manifestPath).Msg("help manifest not found")
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Help manifest not found",
			"code":  "MANIFEST_NOT_FOUND",
		})
		return
	}

	// Get file info for ETag and last modified
	fileInfo, err := os.Stat(manifestPath)
	if err != nil {
		log.Error().Err(err).Str("path", manifestPath).Msg("failed to stat manifest file")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to access manifest",
			"code":  "MANIFEST_ACCESS_ERROR",
		})
		return
	}

	// Generate ETag from file modification time and size
	etag := fmt.Sprintf("\"%x\"", md5.Sum([]byte(fmt.Sprintf("%d-%d", fileInfo.ModTime().Unix(), fileInfo.Size()))))
	
	// Check If-None-Match header for caching
	if inm := c.GetHeader("If-None-Match"); inm == etag {
		c.Status(http.StatusNotModified)
		return
	}

	// Read and serve manifest
	manifestData, err := os.ReadFile(manifestPath)
	if err != nil {
		log.Error().Err(err).Str("path", manifestPath).Msg("failed to read manifest file")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to read manifest",
			"code":  "MANIFEST_READ_ERROR",
		})
		return
	}

	// Set caching headers
	c.Header("ETag", etag)
	c.Header("Cache-Control", "public, max-age=60") // Cache for 1 minute
	c.Header("Last-Modified", fileInfo.ModTime().UTC().Format(http.TimeFormat))
	c.Header("Content-Type", "application/json")
	
	c.Data(http.StatusOK, "application/json", manifestData)
}

// GetHelpDocumentNested handles nested help documents (guides/slug, using/slug, etc.)
func (h *HelpHandlers) GetHelpDocumentNested(c *gin.Context) {
	section := c.Request.URL.Path
	slug := c.Param("slug")
	
	// Extract section from path (e.g., "/v1/help/guides/install" -> "guides")  
	parts := strings.Split(strings.Trim(section, "/"), "/")
	if len(parts) >= 3 {
		sectionName := parts[2] // v1, help, guides
		fullSlug := sectionName + "/" + slug
		
		// Set the slug parameter and call the existing handler
		c.Params = gin.Params{{Key: "slug", Value: fullSlug}}
		h.GetHelpDocument(c)
		return
	}
	
	c.JSON(http.StatusNotFound, gin.H{
		"error": "Help document not found",
		"code":  "DOCUMENT_NOT_FOUND",
	})
}

// GetHelpDocument serves a specific help document by slug
func (h *HelpHandlers) GetHelpDocument(c *gin.Context) {
	slug := c.Param("slug")
	
	// Validate slug format
	if slug == "" || strings.Contains(slug, "..") || strings.HasPrefix(slug, "_") {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "Invalid help document slug",
			"code":  "INVALID_SLUG",
		})
		return
	}

	// Audit logging - sampled 1:20 for performance
	if h.auditLogger != nil {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.RecordSampled(c.Request.Context(), actor, audit.ActionHelpView, "document", slug, map[string]interface{}{
			"ip":   c.ClientIP(),
			"slug": slug,
		}, 20)
	}

	// Convert slug to file path
	filePath := h.slugToFilePath(slug)
	
	// Check if file exists
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		log.Debug().Str("slug", slug).Str("path", filePath).Msg("help document not found")
		c.JSON(http.StatusNotFound, gin.H{
			"error": "Help document not found",
			"code":  "DOCUMENT_NOT_FOUND",
			"slug":  slug,
		})
		return
	}

	// Get file info for ETag and caching
	fileInfo, err := os.Stat(filePath)
	if err != nil {
		log.Error().Err(err).Str("path", filePath).Msg("failed to stat help document")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to access document",
			"code":  "DOCUMENT_ACCESS_ERROR",
		})
		return
	}

	// Read file content for ETag calculation
	content, err := os.ReadFile(filePath)
	if err != nil {
		log.Error().Err(err).Str("path", filePath).Msg("failed to read help document")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to read document",
			"code":  "DOCUMENT_READ_ERROR",
		})
		return
	}

	// Generate ETag from content hash
	etag := fmt.Sprintf("\"%x\"", md5.Sum(content))
	
	// Check If-None-Match header for caching
	if inm := c.GetHeader("If-None-Match"); inm == etag {
		c.Status(http.StatusNotModified)
		return
	}

	// Set caching headers
	c.Header("ETag", etag)
	c.Header("Cache-Control", "public, max-age=60") // Cache for 1 minute
	c.Header("Last-Modified", fileInfo.ModTime().UTC().Format(http.TimeFormat))
	c.Header("Content-Type", "text/markdown; charset=utf-8")
	
	// Return markdown content
	c.JSON(http.StatusOK, gin.H{
		"slug":     slug,
		"markdown": string(content),
		"etag":     strings.Trim(etag, "\""),
		"updated_at": fileInfo.ModTime().UTC().Format(time.RFC3339),
	})
}

// ReindexHelp triggers help-only search reindexing (admin only)
func (h *HelpHandlers) ReindexHelp(c *gin.Context) {
	// This will be implemented in Phase 2 when search integration is added
	// For now, return a placeholder response
	
	// Audit logging for admin action
	if h.auditLogger != nil {
		actor := audit.GetActorFromContext(c.Request.Context())
		h.auditLogger.Record(c.Request.Context(), actor, audit.ActionHelpReindex, "system", "help_index", map[string]interface{}{
			"ip": c.ClientIP(),
		})
	}

	log.Info().Str("actor", audit.GetActorFromContext(c.Request.Context())).Msg("help reindex requested")
	
	c.JSON(http.StatusOK, gin.H{
		"message": "Help reindex will be implemented in Phase 2",
		"status":  "placeholder",
	})
}

// Helper functions

func (h *HelpHandlers) slugToFilePath(slug string) string {
	// Convert slug back to file path
	// e.g., "guides/getting-started" -> "appdocs/guides/getting-started.md"
	// or "faq" -> "appdocs/faq.md"
	
	filePath := filepath.Join("appdocs", slug+".md")
	
	// Handle special case for root README
	if slug == "help" || slug == "" {
		filePath = "appdocs/README.md"
	}
	
	return filePath
}

