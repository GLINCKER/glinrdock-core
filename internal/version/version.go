package version

import (
	"runtime"
	"time"
)

var (
	// Version is set via ldflags during build
	Version = "dev"
	// Commit is set via ldflags during build
	Commit = "unknown"
	// BuildTime is set via ldflags during build
	BuildTime = "unknown"
)

// Info contains version information
type Info struct {
	Version   string    `json:"version"`
	Commit    string    `json:"commit"`
	BuildTime string    `json:"build_time"`
	GoVersion string    `json:"go_version"`
	OS        string    `json:"os"`
	Arch      string    `json:"arch"`
	StartTime time.Time `json:"start_time"`
}

var startTime = time.Now()

// Get returns version info
func Get() Info {
	return Info{
		Version:   Version,
		Commit:    Commit,
		BuildTime: BuildTime,
		GoVersion: runtime.Version(),
		OS:        runtime.GOOS,
		Arch:      runtime.GOARCH,
		StartTime: startTime,
	}
}

// GetUptime returns uptime since server start
func GetUptime() time.Duration {
	return time.Since(startTime)
}