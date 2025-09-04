package metrics

import (
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

var (
	DefaultCollector   *Collector
	DefaultHistoryCollector *HistoryCollector
	once               sync.Once
	historyOnce        sync.Once
)

type Collector struct {
	registry    *prometheus.Registry
	startTime   time.Time
	
	// Gauge metrics
	uptimeSeconds       prometheus.Gauge
	servicesRunning     prometheus.Gauge
	jobsActive          prometheus.Gauge
	
	// Counter metrics
	buildsTotal         *prometheus.CounterVec
	deploymentsTotal    *prometheus.CounterVec
	searchQueriesTotal  *prometheus.CounterVec
	searchSuggestTotal  *prometheus.CounterVec
	searchSlowQueries   prometheus.Counter
	
	// Histogram metrics
	buildDuration       prometheus.Histogram
	deployDuration      prometheus.Histogram
}

func NewCollector() *Collector {
	registry := prometheus.NewRegistry()
	startTime := time.Now()
	
	// Create metrics
	uptimeSeconds := prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "glinrdock_uptime_seconds",
		Help: "Number of seconds since glinrdock server started",
	})
	
	servicesRunning := prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "glinrdock_services_running_total", 
		Help: "Total number of currently running containers",
	})
	
	jobsActive := prometheus.NewGauge(prometheus.GaugeOpts{
		Name: "glinrdock_jobs_active",
		Help: "Number of active background jobs in the queue",
	})
	
	buildsTotal := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "glinrdock_builds_total",
			Help: "Total number of builds by status",
		},
		[]string{"status"},
	)
	
	deploymentsTotal := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "glinrdock_deployments_total",
			Help: "Total number of deployments by status",
		},
		[]string{"status"},
	)
	
	buildDuration := prometheus.NewHistogram(prometheus.HistogramOpts{
		Name: "glinrdock_build_duration_seconds",
		Help: "Duration of build operations in seconds",
		Buckets: prometheus.ExponentialBuckets(1, 2, 12), // 1s to ~1hr
	})
	
	deployDuration := prometheus.NewHistogram(prometheus.HistogramOpts{
		Name: "glinrdock_deploy_duration_seconds", 
		Help: "Duration of deployment operations in seconds",
		Buckets: prometheus.DefBuckets, // 0.005 to 10s
	})
	
	searchQueriesTotal := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "glinrdock_search_queries_total",
			Help: "Total number of search queries by type and status",
		},
		[]string{"type", "status"},
	)
	
	searchSuggestTotal := prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "glinrdock_search_suggest_total",
			Help: "Total number of search suggestions by type and status",
		},
		[]string{"type", "status"},
	)
	
	searchSlowQueries := prometheus.NewCounter(prometheus.CounterOpts{
		Name: "glinrdock_search_slow_queries_total",
		Help: "Total number of slow search queries (>100ms)",
	})
	
	// Register metrics
	registry.MustRegister(
		uptimeSeconds,
		servicesRunning,
		jobsActive,
		buildsTotal,
		deploymentsTotal,
		buildDuration,
		deployDuration,
		searchQueriesTotal,
		searchSuggestTotal,
		searchSlowQueries,
	)
	
	collector := &Collector{
		registry:           registry,
		startTime:          startTime,
		uptimeSeconds:      uptimeSeconds,
		servicesRunning:    servicesRunning,
		jobsActive:         jobsActive,
		buildsTotal:        buildsTotal,
		deploymentsTotal:   deploymentsTotal,
		buildDuration:      buildDuration,
		deployDuration:     deployDuration,
		searchQueriesTotal: searchQueriesTotal,
		searchSuggestTotal: searchSuggestTotal,
		searchSlowQueries:  searchSlowQueries,
	}
	
	// Start uptime updater
	go collector.updateUptime()
	
	return collector
}

func InitGlobal() {
	once.Do(func() {
		DefaultCollector = NewCollector()
	})
}

// This will be called from main.go with proper store type
func InitHistoryCollector(store interface{}, interval time.Duration) {
	historyOnce.Do(func() {
		// The actual initialization will be done in the main function
		// where we have access to the proper store.Store type
		DefaultHistoryCollector = &HistoryCollector{}
	})
}

func (c *Collector) Registry() *prometheus.Registry {
	return c.registry
}

func (c *Collector) updateUptime() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()
	
	for range ticker.C {
		uptime := time.Since(c.startTime).Seconds()
		c.uptimeSeconds.Set(uptime)
	}
}

// Service metrics
func (c *Collector) SetServicesRunning(count int) {
	c.servicesRunning.Set(float64(count))
}

// Job queue metrics
func (c *Collector) IncActiveJobs() {
	c.jobsActive.Inc()
}

func (c *Collector) DecActiveJobs() {
	c.jobsActive.Dec()
}

// Build metrics
func (c *Collector) RecordBuild(success bool, duration time.Duration) {
	status := "success"
	if !success {
		status = "failed"
	}
	c.buildsTotal.WithLabelValues(status).Inc()
	c.buildDuration.Observe(duration.Seconds())
}

// Deployment metrics  
func (c *Collector) RecordDeployment(success bool, duration time.Duration) {
	status := "success"
	if !success {
		status = "failed"
	}
	c.deploymentsTotal.WithLabelValues(status).Inc()
	c.deployDuration.Observe(duration.Seconds())
}

// Search metrics
func (c *Collector) RecordSearchQuery(entityType string, success bool, duration time.Duration) {
	status := "success"
	if !success {
		status = "failed"
	}
	
	// Use "all" if entityType is empty
	queryType := entityType
	if queryType == "" {
		queryType = "all"
	}
	
	c.searchQueriesTotal.WithLabelValues(queryType, status).Inc()
	
	// Track slow queries (>100ms)
	if duration.Milliseconds() > 100 {
		c.searchSlowQueries.Inc()
	}
}

func (c *Collector) RecordSearchSuggest(entityType string, success bool, duration time.Duration) {
	status := "success"
	if !success {
		status = "failed"
	}
	
	// Use "all" if entityType is empty
	queryType := entityType
	if queryType == "" {
		queryType = "all"
	}
	
	c.searchSuggestTotal.WithLabelValues(queryType, status).Inc()
}

// Global convenience functions
func SetServicesRunning(count int) {
	if DefaultCollector != nil {
		DefaultCollector.SetServicesRunning(count)
	}
}

func IncActiveJobs() {
	if DefaultCollector != nil {
		DefaultCollector.IncActiveJobs()
	}
}

func DecActiveJobs() {
	if DefaultCollector != nil {
		DefaultCollector.DecActiveJobs()
	}
}

func RecordBuild(success bool, duration time.Duration) {
	if DefaultCollector != nil {
		DefaultCollector.RecordBuild(success, duration)
	}
}

func RecordDeployment(success bool, duration time.Duration) {
	if DefaultCollector != nil {
		DefaultCollector.RecordDeployment(success, duration)
	}
}

func RecordSearchQuery(entityType string, success bool, duration time.Duration) {
	if DefaultCollector != nil {
		DefaultCollector.RecordSearchQuery(entityType, success, duration)
	}
}

func RecordSearchSuggest(entityType string, success bool, duration time.Duration) {
	if DefaultCollector != nil {
		DefaultCollector.RecordSearchSuggest(entityType, success, duration)
	}
}