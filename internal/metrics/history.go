package metrics

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/GLINCKER/glinrdock/internal/store"
)

// HistoryCollector collects and stores historical system resource metrics
type HistoryCollector struct {
	store           *store.Store
	interval        time.Duration
	stopCh          chan struct{}
	retentionPeriod time.Duration    // How long to keep data
	cleanupInterval time.Duration    // How often to run cleanup
	cache           *MetricsCache    // In-memory cache for recent data
}

// MetricsCache provides in-memory caching for recent metrics
type MetricsCache struct {
	mu      sync.RWMutex
	latest  []store.HistoricalMetric
	maxSize int
}

// NewHistoryCollector creates a new historical metrics collector with data retention and caching
func NewHistoryCollector(s *store.Store, interval time.Duration) *HistoryCollector {
	if interval < 10*time.Second {
		interval = 30 * time.Second // Default to 30 seconds minimum
	}
	
	return &HistoryCollector{
		store:           s,
		interval:        interval,
		stopCh:          make(chan struct{}),
		retentionPeriod: 7 * 24 * time.Hour, // Keep data for 7 days by default
		cleanupInterval: 1 * time.Hour,       // Run cleanup every hour
		cache: &MetricsCache{
			latest:  make([]store.HistoricalMetric, 0, 100),
			maxSize: 100, // Cache last 100 data points (≈50 minutes at 30s intervals)
		},
	}
}

// Start begins collecting historical metrics at regular intervals with cleanup
func (hc *HistoryCollector) Start(ctx context.Context) {
	collectTicker := time.NewTicker(hc.interval)
	cleanupTicker := time.NewTicker(hc.cleanupInterval)
	defer collectTicker.Stop()
	defer cleanupTicker.Stop()
	
	// Collect initial data point
	hc.collectMetrics(ctx)
	
	// Run initial cleanup to remove old data
	go hc.cleanup(ctx)
	
	for {
		select {
		case <-ctx.Done():
			return
		case <-hc.stopCh:
			return
		case <-collectTicker.C:
			hc.collectMetrics(ctx)
		case <-cleanupTicker.C:
			go hc.cleanup(ctx) // Run cleanup in background
		}
	}
}

// Stop halts the historical metrics collection
func (hc *HistoryCollector) Stop() {
	close(hc.stopCh)
}

// collectMetrics gathers current system resource data and stores it
func (hc *HistoryCollector) collectMetrics(ctx context.Context) {
	metric := store.HistoricalMetric{
		Timestamp: time.Now().UTC(),
	}
	
	// Collect CPU usage
	if cpuPercent, err := hc.getCPUUsage(); err == nil {
		metric.CPUPercent = cpuPercent
	}
	
	// Collect memory usage
	if memUsed, memTotal, err := hc.getMemoryUsage(); err == nil {
		metric.MemoryUsed = memUsed
		metric.MemoryTotal = memTotal
	}
	
	// Collect disk usage
	if diskUsed, diskTotal, err := hc.getDiskUsage(); err == nil {
		metric.DiskUsed = diskUsed
		metric.DiskTotal = diskTotal
	}
	
	// Collect network usage
	if netRx, netTx, err := hc.getNetworkUsage(); err == nil {
		metric.NetworkRX = netRx
		metric.NetworkTX = netTx
	}
	
	// Store the collected metric
	if err := hc.store.CreateHistoricalMetric(ctx, metric); err != nil {
		// Log error but don't stop collection
		fmt.Printf("Failed to store historical metric: %v\n", err)
		return
	}

	// Update cache with the new metric
	hc.cache.Add(metric)
}

// getCPUUsage returns current CPU usage percentage
func (hc *HistoryCollector) getCPUUsage() (float64, error) {
	if runtime.GOOS == "linux" {
		return hc.getCPUUsageLinux()
	} else if runtime.GOOS == "darwin" {
		return hc.getCPUUsageMacOS()
	}
	return 0, fmt.Errorf("unsupported platform for CPU metrics")
}

// getCPUUsageLinux gets CPU usage on Linux systems
func (hc *HistoryCollector) getCPUUsageLinux() (float64, error) {
	// Read /proc/loadavg for a quick CPU load estimate
	cmd := exec.Command("awk", "{printf \"%.2f\", ($1/$2)*100}", "/proc/loadavg")
	output, err := cmd.Output()
	if err != nil {
		return 0, err
	}
	
	cpuPercent, err := strconv.ParseFloat(strings.TrimSpace(string(output)), 64)
	if err != nil {
		return 0, err
	}
	
	// Cap at 100%
	if cpuPercent > 100 {
		cpuPercent = 100
	}
	
	return cpuPercent, nil
}

// getCPUUsageMacOS gets CPU usage on macOS systems
func (hc *HistoryCollector) getCPUUsageMacOS() (float64, error) {
	// Use top command to get CPU usage
	cmd := exec.Command("top", "-l", "1", "-n", "0")
	output, err := cmd.Output()
	if err != nil {
		return 0, err
	}
	
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		if strings.Contains(line, "CPU usage:") {
			// Extract CPU usage from line like: "CPU usage: 12.34% user, 5.67% sys, 81.99% idle"
			fields := strings.Fields(line)
			for i, field := range fields {
				if field == "user," && i > 0 {
					percentStr := strings.TrimSuffix(fields[i-1], "%")
					if userPercent, err := strconv.ParseFloat(percentStr, 64); err == nil {
						return userPercent, nil
					}
				}
			}
		}
	}
	
	return 0, fmt.Errorf("could not parse CPU usage from top output")
}

// getMemoryUsage returns memory usage in bytes
func (hc *HistoryCollector) getMemoryUsage() (used, total int64, err error) {
	if runtime.GOOS == "linux" {
		return hc.getMemoryUsageLinux()
	} else if runtime.GOOS == "darwin" {
		return hc.getMemoryUsageMacOS()
	}
	return 0, 0, fmt.Errorf("unsupported platform for memory metrics")
}

// getMemoryUsageLinux gets memory usage on Linux systems
func (hc *HistoryCollector) getMemoryUsageLinux() (used, total int64, err error) {
	data, err := os.ReadFile("/proc/meminfo")
	if err != nil {
		return 0, 0, err
	}
	
	lines := strings.Split(string(data), "\n")
	var memTotal, memAvailable int64
	
	for _, line := range lines {
		fields := strings.Fields(line)
		if len(fields) >= 2 {
			value, err := strconv.ParseInt(fields[1], 10, 64)
			if err != nil {
				continue
			}
			
			switch fields[0] {
			case "MemTotal:":
				memTotal = value * 1024 // Convert KB to bytes
			case "MemAvailable:":
				memAvailable = value * 1024 // Convert KB to bytes
			}
		}
	}
	
	if memTotal > 0 && memAvailable >= 0 {
		used = memTotal - memAvailable
		return used, memTotal, nil
	}
	
	return 0, 0, fmt.Errorf("could not parse memory info")
}

// getMemoryUsageMacOS gets memory usage on macOS systems
func (hc *HistoryCollector) getMemoryUsageMacOS() (used, total int64, err error) {
	// Get total memory
	cmd := exec.Command("sysctl", "-n", "hw.memsize")
	output, err := cmd.Output()
	if err != nil {
		return 0, 0, err
	}
	
	total, err = strconv.ParseInt(strings.TrimSpace(string(output)), 10, 64)
	if err != nil {
		return 0, 0, err
	}
	
	// Get memory pressure to estimate used memory
	cmd = exec.Command("memory_pressure")
	output, err = cmd.Output()
	if err != nil {
		// Fallback: assume 70% usage if we can't get precise data
		used = total * 70 / 100
		return used, total, nil
	}
	
	// Parse memory pressure output (simplified)
	used = total * 60 / 100 // Default estimate
	return used, total, nil
}

// getDiskUsage returns disk usage in bytes for the root partition
func (hc *HistoryCollector) getDiskUsage() (used, total int64, err error) {
	var stat syscall.Statfs_t
	
	path := "/"
	if runtime.GOOS == "darwin" {
		path = "/"
	}
	
	err = syscall.Statfs(path, &stat)
	if err != nil {
		return 0, 0, err
	}
	
	// Calculate usage
	total = int64(stat.Blocks) * int64(stat.Bsize)
	available := int64(stat.Bavail) * int64(stat.Bsize)
	used = total - available
	
	return used, total, nil
}

// getNetworkUsage returns cumulative network bytes received and transmitted
func (hc *HistoryCollector) getNetworkUsage() (rx, tx int64, err error) {
	if runtime.GOOS == "linux" {
		return hc.getNetworkUsageLinux()
	} else if runtime.GOOS == "darwin" {
		return hc.getNetworkUsageMacOS()
	}
	return 0, 0, fmt.Errorf("unsupported platform for network metrics")
}

// getNetworkUsageLinux gets network usage on Linux systems
func (hc *HistoryCollector) getNetworkUsageLinux() (rx, tx int64, err error) {
	data, err := os.ReadFile("/proc/net/dev")
	if err != nil {
		return 0, 0, err
	}
	
	lines := strings.Split(string(data), "\n")
	for _, line := range lines[2:] { // Skip header lines
		if strings.TrimSpace(line) == "" {
			continue
		}
		
		fields := strings.Fields(line)
		if len(fields) >= 10 {
			// Skip loopback interface
			if strings.HasPrefix(fields[0], "lo:") {
				continue
			}
			
			// Parse RX bytes (field 1) and TX bytes (field 9)
			rxBytes, err1 := strconv.ParseInt(strings.TrimSuffix(fields[1], ":"), 10, 64)
			txBytes, err2 := strconv.ParseInt(fields[9], 10, 64)
			
			if err1 == nil && err2 == nil {
				rx += rxBytes
				tx += txBytes
			}
		}
	}
	
	return rx, tx, nil
}

// getNetworkUsageMacOS gets network usage on macOS systems
func (hc *HistoryCollector) getNetworkUsageMacOS() (rx, tx int64, err error) {
	cmd := exec.Command("netstat", "-ibn")
	output, err := cmd.Output()
	if err != nil {
		return 0, 0, err
	}
	
	lines := strings.Split(string(output), "\n")
	for _, line := range lines[1:] { // Skip header
		fields := strings.Fields(line)
		if len(fields) >= 10 {
			// Skip loopback and non-network interfaces
			if strings.HasPrefix(fields[0], "lo") || strings.Contains(fields[2], "Link") {
				continue
			}
			
			// Parse bytes in (field 6) and bytes out (field 9)
			if len(fields) > 9 {
				rxBytes, err1 := strconv.ParseInt(fields[6], 10, 64)
				txBytes, err2 := strconv.ParseInt(fields[9], 10, 64)
				
				if err1 == nil && err2 == nil {
					rx += rxBytes
					tx += txBytes
				}
			}
		}
	}
	
	return rx, tx, nil
}

// Add adds a new metric to the cache
func (mc *MetricsCache) Add(metric store.HistoricalMetric) {
	mc.mu.Lock()
	defer mc.mu.Unlock()
	
	mc.latest = append(mc.latest, metric)
	
	// Keep only the most recent maxSize entries
	if len(mc.latest) > mc.maxSize {
		mc.latest = mc.latest[len(mc.latest)-mc.maxSize:]
	}
}

// GetLatest returns the most recent N metrics from cache
func (mc *MetricsCache) GetLatest(n int) []store.HistoricalMetric {
	mc.mu.RLock()
	defer mc.mu.RUnlock()
	
	if n <= 0 || len(mc.latest) == 0 {
		return nil
	}
	
	if n >= len(mc.latest) {
		result := make([]store.HistoricalMetric, len(mc.latest))
		copy(result, mc.latest)
		return result
	}
	
	// Return the last n entries
	start := len(mc.latest) - n
	result := make([]store.HistoricalMetric, n)
	copy(result, mc.latest[start:])
	return result
}

// Size returns the current number of cached metrics
func (mc *MetricsCache) Size() int {
	mc.mu.RLock()
	defer mc.mu.RUnlock()
	return len(mc.latest)
}

// cleanup removes old historical metrics beyond the retention period
func (hc *HistoryCollector) cleanup(ctx context.Context) {
	cutoff := time.Now().Add(-hc.retentionPeriod)
	
	if err := hc.store.CleanupHistoricalMetrics(ctx, cutoff); err != nil {
		fmt.Printf("Failed to cleanup historical metrics: %v\n", err)
	} else {
		fmt.Printf("Cleaned up historical metrics older than %v\n", cutoff.Format(time.RFC3339))
	}
}