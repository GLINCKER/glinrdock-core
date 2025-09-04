package api

import (
	"net/http"
	"strconv"
	"time"
	
	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/GLINCKER/glinrdock/internal/metrics"
	"github.com/GLINCKER/glinrdock/internal/store"
)

type MetricsHandlers struct {
	collector *metrics.Collector
	store     *store.Store
}

func NewMetricsHandlers(collector *metrics.Collector, store *store.Store) *MetricsHandlers {
	return &MetricsHandlers{
		collector: collector,
		store:     store,
	}
}

func (h *MetricsHandlers) GetMetrics(c *gin.Context) {
	// Create a promhttp handler using our custom registry
	handler := promhttp.HandlerFor(
		h.collector.Registry(),
		promhttp.HandlerOpts{
			EnableOpenMetrics: true,
		},
	)
	
	// Use the promhttp handler to generate the response
	handler.ServeHTTP(c.Writer, c.Request)
}

// GetHistoricalMetrics returns historical resource metrics
func (h *MetricsHandlers) GetHistoricalMetrics(c *gin.Context) {
	// Parse query parameters
	limitStr := c.DefaultQuery("limit", "50")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 || limit > 1000 {
		limit = 50
	}
	
	// Parse duration (defaults to last 24 hours)
	durationStr := c.DefaultQuery("duration", "24h")
	duration, err := time.ParseDuration(durationStr)
	if err != nil {
		duration = 24 * time.Hour
	}
	
	since := time.Now().UTC().Add(-duration)
	
	// Get historical metrics
	metrics, err := h.store.GetHistoricalMetrics(c.Request.Context(), since, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"metrics":  metrics,
		"count":    len(metrics),
		"duration": durationStr,
		"limit":    limit,
	})
}

// GetLatestHistoricalMetrics returns the most recent historical metrics
func (h *MetricsHandlers) GetLatestHistoricalMetrics(c *gin.Context) {
	// Parse query parameters
	limitStr := c.DefaultQuery("limit", "50")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit < 1 || limit > 1000 {
		limit = 50
	}
	
	// Check if duration is specified for time-based filtering
	durationStr := c.Query("duration")
	if durationStr != "" {
		// Use time-based filtering instead of limit-based
		duration, err := time.ParseDuration(durationStr)
		if err != nil {
			duration = 1 * time.Hour // Default to 1 hour
		}
		
		since := time.Now().UTC().Add(-duration)
		// Use a high limit for time-based queries to get all data in the range
		timeBasedLimit := 10000 // Allow up to 10k records for time-based queries
		metrics, err := h.store.GetHistoricalMetrics(c.Request.Context(), since, timeBasedLimit)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		
		c.JSON(http.StatusOK, gin.H{
			"metrics":  metrics,
			"count":    len(metrics),
			"duration": durationStr,
			"limit":    timeBasedLimit,
		})
		return
	}
	
	// Get latest metrics by count
	metrics, err := h.store.GetLatestHistoricalMetrics(c.Request.Context(), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"metrics": metrics,
		"count":   len(metrics),
		"limit":   limit,
	})
}

func (h *MetricsHandlers) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/metrics", h.GetMetrics)
	rg.GET("/metrics/historical", h.GetHistoricalMetrics)
	rg.GET("/metrics/latest", h.GetLatestHistoricalMetrics)
}