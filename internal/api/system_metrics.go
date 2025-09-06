package api

import (
	"bufio"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/shirou/gopsutil/v4/cpu"
	"github.com/shirou/gopsutil/v4/disk"
	"github.com/shirou/gopsutil/v4/host"
	"github.com/shirou/gopsutil/v4/load"
	"github.com/shirou/gopsutil/v4/mem"
	"github.com/shirou/gopsutil/v4/net"
	"github.com/shirou/gopsutil/v4/process"
)

type SystemMetricsResponse struct {
	NodeID      string             `json:"node_id"`
	Hostname    string             `json:"hostname"`
	Platform    PlatformInfo       `json:"platform"`
	Uptime      time.Duration      `json:"uptime"`
	Resources   ResourceUsage      `json:"resources"`
	Network     NetworkStats       `json:"network"`
	Performance PerformanceMetrics `json:"performance"`
	LastUpdated time.Time          `json:"last_updated"`
}

type PlatformInfo struct {
	OS           string `json:"os"`
	Architecture string `json:"arch"`
	Hostname     string `json:"hostname"`
	GoVersion    string `json:"go_version"`
	NumCPU       int    `json:"num_cpu"`
}

type ResourceUsage struct {
	CPU     CPUUsage     `json:"cpu"`
	Memory  MemoryUsage  `json:"memory"`
	Disk    DiskUsage    `json:"disk"`
	Network NetworkStats `json:"network"`
}

type CPUUsage struct {
	UsedPercent float64 `json:"used_percent"`
	NumCores    int     `json:"num_cores"`
}

type MemoryUsage struct {
	Total       uint64  `json:"total"`
	Available   uint64  `json:"available"`
	Used        uint64  `json:"used"`
	UsedPercent float64 `json:"used_percent"`
}

type DiskUsage struct {
	Total       uint64  `json:"total"`
	Free        uint64  `json:"free"`
	Used        uint64  `json:"used"`
	UsedPercent float64 `json:"used_percent"`
}

type NetworkStats struct {
	BytesRecv   uint64  `json:"bytes_recv"`
	BytesSent   uint64  `json:"bytes_sent"`
	PacketsRecv uint64  `json:"packets_recv"`
	PacketsSent uint64  `json:"packets_sent"`
	RxRate      float64 `json:"rx_rate"` // Bytes per second receive rate
	TxRate      float64 `json:"tx_rate"` // Bytes per second transmit rate
}

type PerformanceMetrics struct {
	LoadAverage     [3]float64         `json:"load_average"` // 1min, 5min, 15min
	ActiveProcesses int                `json:"active_processes"`
	FileDescriptors FileDescriptorInfo `json:"file_descriptors"`
}

type FileDescriptorInfo struct {
	Used int `json:"used"`
	Max  int `json:"max"`
}

// SystemMetrics handler provides lightweight system metrics
func (h *Handlers) SystemMetrics(c *gin.Context) {
	// Get CPU usage (non-blocking, faster sampling)
	cpuPercents, err := cpu.Percent(100*time.Millisecond, false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get CPU usage"})
		return
	}

	var cpuUsed float64
	if len(cpuPercents) > 0 {
		cpuUsed = cpuPercents[0]
	}

	// Get CPU info
	numCPU := runtime.NumCPU()

	// Get memory usage
	memStats, err := mem.VirtualMemory()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get memory usage"})
		return
	}

	// Get disk usage for root filesystem
	diskStats, err := disk.Usage("/")
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get disk usage"})
		return
	}

	// Get network statistics
	netStats, err := net.IOCounters(false)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get network stats"})
		return
	}

	var networkUsage NetworkStats
	if len(netStats) > 0 {
		// For now, we'll set rates to 0 since we need historical data to calculate actual rates
		// This will be improved with the metrics collector
		networkUsage = NetworkStats{
			BytesRecv:   netStats[0].BytesRecv,
			BytesSent:   netStats[0].BytesSent,
			PacketsRecv: netStats[0].PacketsRecv,
			PacketsSent: netStats[0].PacketsSent,
			RxRate:      0.0, // Will be calculated by metrics collector
			TxRate:      0.0, // Will be calculated by metrics collector
		}
	}

	// Get host information
	hostInfo, err := host.Info()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to get host info"})
		return
	}

	// Get performance metrics
	performance := getPerformanceMetrics()

	response := SystemMetricsResponse{
		NodeID:   "node-1", // For single-node setup
		Hostname: hostInfo.Hostname,
		Platform: PlatformInfo{
			OS:           hostInfo.OS,
			Architecture: hostInfo.KernelArch,
			Hostname:     hostInfo.Hostname,
			GoVersion:    runtime.Version(),
			NumCPU:       numCPU,
		},
		Uptime: time.Duration(hostInfo.Uptime) * time.Second,
		Resources: ResourceUsage{
			CPU: CPUUsage{
				UsedPercent: cpuUsed,
				NumCores:    numCPU,
			},
			Memory: MemoryUsage{
				Total:       memStats.Total,
				Available:   memStats.Available,
				Used:        memStats.Used,
				UsedPercent: memStats.UsedPercent,
			},
			Disk: DiskUsage{
				Total:       diskStats.Total,
				Free:        diskStats.Free,
				Used:        diskStats.Used,
				UsedPercent: diskStats.UsedPercent,
			},
			Network: networkUsage,
		},
		Network:     networkUsage,
		Performance: performance,
		LastUpdated: time.Now(),
	}

	c.JSON(http.StatusOK, response)
}

// getPerformanceMetrics collects additional performance metrics
func getPerformanceMetrics() PerformanceMetrics {
	perf := PerformanceMetrics{
		LoadAverage:     [3]float64{0, 0, 0},
		ActiveProcesses: 0,
		FileDescriptors: FileDescriptorInfo{Used: 0, Max: 0},
	}

	// Get load average
	loadAvg, err := load.Avg()
	if err == nil {
		perf.LoadAverage = [3]float64{loadAvg.Load1, loadAvg.Load5, loadAvg.Load15}
	}

	// Count active processes
	processes, err := process.Processes()
	if err == nil {
		perf.ActiveProcesses = len(processes)
	}

	// Get file descriptor information (Linux/Unix specific)
	if runtime.GOOS == "linux" || runtime.GOOS == "darwin" {
		perf.FileDescriptors = getFileDescriptorInfo()
	}

	return perf
}

// getFileDescriptorInfo gets file descriptor usage information
func getFileDescriptorInfo() FileDescriptorInfo {
	fdInfo := FileDescriptorInfo{Used: 0, Max: 0}

	if runtime.GOOS == "linux" {
		// Read from /proc/sys/fs/file-nr for system-wide FD info
		if file, err := os.Open("/proc/sys/fs/file-nr"); err == nil {
			defer file.Close()
			scanner := bufio.NewScanner(file)
			if scanner.Scan() {
				fields := strings.Fields(scanner.Text())
				if len(fields) >= 3 {
					if used, err := strconv.Atoi(fields[0]); err == nil {
						fdInfo.Used = used
					}
					if max, err := strconv.Atoi(fields[2]); err == nil {
						fdInfo.Max = max
					}
				}
			}
		}
	} else if runtime.GOOS == "darwin" {
		// For macOS, use a simpler approximation
		// Count open files in /dev/fd or use system limits
		fdInfo.Used = 0    // Placeholder - more complex implementation needed
		fdInfo.Max = 10240 // Common default limit
	}

	return fdInfo
}
