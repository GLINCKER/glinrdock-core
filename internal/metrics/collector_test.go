package metrics

import (
	"strings"
	"testing"
	"time"

	"github.com/prometheus/client_golang/prometheus/testutil"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewCollector(t *testing.T) {
	collector := NewCollector()
	
	assert.NotNil(t, collector)
	assert.NotNil(t, collector.Registry())
	assert.NotNil(t, collector.uptimeSeconds)
	assert.NotNil(t, collector.servicesRunning)
	assert.NotNil(t, collector.jobsActive)
	assert.NotNil(t, collector.buildsTotal)
	assert.NotNil(t, collector.deploymentsTotal)
	assert.NotNil(t, collector.buildDuration)
	assert.NotNil(t, collector.deployDuration)
}

func TestCollector_SetServicesRunning(t *testing.T) {
	collector := NewCollector()
	
	// Initially should be 0
	value := testutil.ToFloat64(collector.servicesRunning)
	assert.Equal(t, float64(0), value)
	
	// Set to 5
	collector.SetServicesRunning(5)
	value = testutil.ToFloat64(collector.servicesRunning)
	assert.Equal(t, float64(5), value)
	
	// Set to 0 again
	collector.SetServicesRunning(0)
	value = testutil.ToFloat64(collector.servicesRunning)
	assert.Equal(t, float64(0), value)
}

func TestCollector_JobsActiveCounter(t *testing.T) {
	collector := NewCollector()
	
	// Initially should be 0
	value := testutil.ToFloat64(collector.jobsActive)
	assert.Equal(t, float64(0), value)
	
	// Increment
	collector.IncActiveJobs()
	value = testutil.ToFloat64(collector.jobsActive)
	assert.Equal(t, float64(1), value)
	
	// Increment again
	collector.IncActiveJobs()
	value = testutil.ToFloat64(collector.jobsActive)
	assert.Equal(t, float64(2), value)
	
	// Decrement
	collector.DecActiveJobs()
	value = testutil.ToFloat64(collector.jobsActive)
	assert.Equal(t, float64(1), value)
	
	// Decrement to 0
	collector.DecActiveJobs()
	value = testutil.ToFloat64(collector.jobsActive)
	assert.Equal(t, float64(0), value)
}

func TestCollector_RecordBuild(t *testing.T) {
	collector := NewCollector()
	
	// Record successful build
	collector.RecordBuild(true, 30*time.Second)
	
	successCount := testutil.ToFloat64(collector.buildsTotal.WithLabelValues("success"))
	failedCount := testutil.ToFloat64(collector.buildsTotal.WithLabelValues("failed"))
	
	assert.Equal(t, float64(1), successCount)
	assert.Equal(t, float64(0), failedCount)
	
	// Record failed build
	collector.RecordBuild(false, 10*time.Second)
	
	successCount = testutil.ToFloat64(collector.buildsTotal.WithLabelValues("success"))
	failedCount = testutil.ToFloat64(collector.buildsTotal.WithLabelValues("failed"))
	
	assert.Equal(t, float64(1), successCount)
	assert.Equal(t, float64(1), failedCount)
}

func TestCollector_RecordDeployment(t *testing.T) {
	collector := NewCollector()
	
	// Record successful deployment
	collector.RecordDeployment(true, 5*time.Second)
	
	successCount := testutil.ToFloat64(collector.deploymentsTotal.WithLabelValues("success"))
	failedCount := testutil.ToFloat64(collector.deploymentsTotal.WithLabelValues("failed"))
	
	assert.Equal(t, float64(1), successCount)
	assert.Equal(t, float64(0), failedCount)
	
	// Record failed deployment
	collector.RecordDeployment(false, 2*time.Second)
	
	successCount = testutil.ToFloat64(collector.deploymentsTotal.WithLabelValues("success"))
	failedCount = testutil.ToFloat64(collector.deploymentsTotal.WithLabelValues("failed"))
	
	assert.Equal(t, float64(1), successCount)
	assert.Equal(t, float64(1), failedCount)
}

func TestCollector_UptimeTracking(t *testing.T) {
	collector := NewCollector()
	
	// Give the updater a moment to start
	time.Sleep(100 * time.Millisecond)
	
	// Manually trigger uptime calculation (simulate what the goroutine does)
	uptime := time.Since(collector.startTime).Seconds()
	collector.uptimeSeconds.Set(uptime)
	
	retrievedUptime := testutil.ToFloat64(collector.uptimeSeconds)
	
	// Should be small but positive
	assert.Greater(t, retrievedUptime, float64(0))
	assert.Less(t, retrievedUptime, float64(1)) // Less than 1 second for this test
}

func TestCollector_MetricsOutput(t *testing.T) {
	collector := NewCollector()
	
	// Add some test data
	collector.SetServicesRunning(3)
	collector.IncActiveJobs()
	collector.IncActiveJobs()
	collector.RecordBuild(true, 30*time.Second)
	collector.RecordBuild(false, 45*time.Second)
	collector.RecordDeployment(true, 10*time.Second)
	
	// Get metrics output
	gathered, err := collector.Registry().Gather()
	require.NoError(t, err)
	require.NotEmpty(t, gathered)
	
	// Check that all expected metrics are present
	metricNames := make(map[string]bool)
	for _, mf := range gathered {
		metricNames[mf.GetName()] = true
	}
	
	expectedMetrics := []string{
		"glinrdock_uptime_seconds",
		"glinrdock_services_running_total",
		"glinrdock_jobs_active",
		"glinrdock_builds_total",
		"glinrdock_deployments_total",
		"glinrdock_build_duration_seconds",
		"glinrdock_deploy_duration_seconds",
	}
	
	for _, expected := range expectedMetrics {
		assert.True(t, metricNames[expected], "Expected metric %s not found", expected)
	}
}

func TestGlobalCollectorFunctions(t *testing.T) {
	// Test that global functions work without panicking
	// when no global collector is initialized
	SetServicesRunning(5)
	IncActiveJobs()
	DecActiveJobs()
	RecordBuild(true, time.Second)
	RecordDeployment(false, time.Millisecond)
	
	// Initialize global collector
	InitGlobal()
	assert.NotNil(t, DefaultCollector)
	
	// Test global functions with initialized collector
	SetServicesRunning(10)
	value := testutil.ToFloat64(DefaultCollector.servicesRunning)
	assert.Equal(t, float64(10), value)
	
	IncActiveJobs()
	IncActiveJobs()
	value = testutil.ToFloat64(DefaultCollector.jobsActive)
	assert.Equal(t, float64(2), value)
	
	DecActiveJobs()
	value = testutil.ToFloat64(DefaultCollector.jobsActive)
	assert.Equal(t, float64(1), value)
	
	RecordBuild(true, 25*time.Second)
	successCount := testutil.ToFloat64(DefaultCollector.buildsTotal.WithLabelValues("success"))
	assert.Equal(t, float64(1), successCount)
	
	RecordDeployment(false, 3*time.Second)
	failedCount := testutil.ToFloat64(DefaultCollector.deploymentsTotal.WithLabelValues("failed"))
	assert.Equal(t, float64(1), failedCount)
}

func TestCollector_RegistryIsolation(t *testing.T) {
	// Create two separate collectors
	collector1 := NewCollector()
	collector2 := NewCollector()
	
	// They should have different registries
	assert.NotSame(t, collector1.Registry(), collector2.Registry())
	
	// Updates to one should not affect the other
	collector1.SetServicesRunning(5)
	collector2.SetServicesRunning(10)
	
	value1 := testutil.ToFloat64(collector1.servicesRunning)
	value2 := testutil.ToFloat64(collector2.servicesRunning)
	
	assert.Equal(t, float64(5), value1)
	assert.Equal(t, float64(10), value2)
}

func TestCollector_PrometheusFormat(t *testing.T) {
	collector := NewCollector()
	
	// Add some metrics data
	collector.SetServicesRunning(2)
	collector.RecordBuild(true, 30*time.Second)
	
	// Check that we can export in Prometheus format
	expected := `
		# HELP glinrdock_services_running_total Total number of currently running containers
		# TYPE glinrdock_services_running_total gauge
		glinrdock_services_running_total 2
	`
	
	err := testutil.CollectAndCompare(collector.servicesRunning, strings.NewReader(expected))
	assert.NoError(t, err)
}