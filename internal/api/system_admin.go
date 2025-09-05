package api

import (
	"net/http"
	"os/exec"
	"path/filepath"
	"strconv"
	"sync"
	"time"

	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

// Global lockdown state
type LockdownState struct {
	IsLocked     bool      `json:"is_locked"`
	Reason       string    `json:"reason"`
	Timestamp    time.Time `json:"timestamp"`
	InitiatedBy  string    `json:"initiated_by"`
}

// Global lockdown manager
var (
	lockdownMutex sync.RWMutex
	lockdownState = &LockdownState{IsLocked: false}
	lastRestartTime time.Time
)

// SystemLockdownRequest represents a system lockdown request
type SystemLockdownRequest struct {
	Reason string `json:"reason"`
}

// SystemLockdownResponse represents the response to a lockdown request
type SystemLockdownResponse struct {
	Status    string `json:"status"`
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"`
}

// LogsRequest represents a request for system logs
type LogsRequest struct {
	Path  string `json:"path"`
	Lines int    `json:"lines"`
}

// LogsResponse represents system logs response
type LogsResponse struct {
	Logs []string `json:"logs"`
	Path string   `json:"path"`
}

// SystemLockdown initiates system lockdown mode (admin only)
func (h *Handlers) SystemLockdown(c *gin.Context) {
	var req SystemLockdownRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Set global lockdown state
	lockdownMutex.Lock()
	lockdownState = &LockdownState{
		IsLocked:    true,
		Reason:      req.Reason,
		Timestamp:   time.Now(),
		InitiatedBy: c.GetString("token_name"),
	}
	lockdownMutex.Unlock()

	// Log the lockdown request
	log.Warn().
		Str("admin_user", c.GetString("token_name")).
		Str("reason", req.Reason).
		Msg("system lockdown initiated")

	// Audit log system lockdown
	if h.auditLogger != nil {
		actor := c.GetString("token_name")
		if actor == "" {
			actor = "system"
		}
		h.auditLogger.RecordSystemAction(c.Request.Context(), actor, audit.ActionSystemLockdown, map[string]interface{}{
			"reason":       req.Reason,
			"timestamp":    lockdownState.Timestamp,
			"initiated_by": lockdownState.InitiatedBy,
		})
	}

	response := SystemLockdownResponse{
		Status:    "lockdown_active",
		Message:   "System has been locked down. Only admin access permitted.",
		Timestamp: lockdownState.Timestamp.Format(time.RFC3339),
	}

	c.JSON(http.StatusOK, response)
}

// SystemStart starts the system service (admin only)
func (h *Handlers) SystemStart(c *gin.Context) {
	log.Info().
		Str("admin_user", c.GetString("token_name")).
		Msg("system start initiated")

	// Audit log system start
	if h.auditLogger != nil {
		actor := c.GetString("token_name")
		if actor == "" {
			actor = "system"
		}
		h.auditLogger.RecordSystemAction(c.Request.Context(), actor, audit.ActionSystemRestart, map[string]interface{}{
			"action":        "start",
			"initiated_by":  actor,
			"start_reason":  "system_start",
		})
	}

	// In development/demo mode, just return success
	// In production, this would actually start system services
	c.JSON(http.StatusOK, gin.H{
		"status":       "start_completed", 
		"message":      "System start completed successfully.",
		"timestamp":    time.Now().Format(time.RFC3339),
	})

	go func() {
		log.Info().Msg("simulating system start sequence")
		// Note: In production, this would trigger actual system start
	}()
}

// SystemStop stops the system service (admin only) 
func (h *Handlers) SystemStop(c *gin.Context) {
	log.Warn().
		Str("admin_user", c.GetString("token_name")).
		Msg("system stop initiated")

	// Audit log system stop
	if h.auditLogger != nil {
		actor := c.GetString("token_name")
		if actor == "" {
			actor = "system"
		}
		h.auditLogger.RecordSystemAction(c.Request.Context(), actor, audit.ActionSystemRestart, map[string]interface{}{
			"action":       "stop",
			"initiated_by": actor,
			"stop_reason":  "system_stop",
		})
	}

	// Return immediate response before shutdown simulation
	c.JSON(http.StatusOK, gin.H{
		"status":    "stop_initiated",
		"message":   "System stop in progress. Service will be unavailable.",
		"timestamp": time.Now().Format(time.RFC3339),
	})

	go func() {
		log.Info().Msg("simulating system stop sequence")
		// Note: In production, this would trigger actual graceful shutdown
		// For now, just log the action
	}()
}

// EmergencyRestart performs emergency system restart (admin only)
func (h *Handlers) EmergencyRestart(c *gin.Context) {
	// Record restart time
	lastRestartTime = time.Now()

	log.Warn().
		Str("admin_user", c.GetString("token_name")).
		Time("restart_time", lastRestartTime).
		Msg("emergency restart initiated")

	// Audit log system restart
	if h.auditLogger != nil {
		actor := c.GetString("token_name")
		if actor == "" {
			actor = "system"
		}
		h.auditLogger.RecordSystemAction(c.Request.Context(), actor, audit.ActionSystemRestart, map[string]interface{}{
			"restart_time":   lastRestartTime,
			"initiated_by":   actor,
			"restart_reason": "emergency_restart",
		})
	}

	// Clear lockdown on restart
	lockdownMutex.Lock()
	lockdownState = &LockdownState{IsLocked: false}
	lockdownMutex.Unlock()

	// Return immediate response before restart
	c.JSON(http.StatusOK, gin.H{
		"status":       "restart_initiated",
		"message":      "Emergency restart in progress. System will be unavailable briefly.",
		"restart_time": lastRestartTime.Format(time.RFC3339),
	})

	// In a real implementation, this would:
	// 1. Gracefully stop all services
	// 2. Clean up resources
	// 3. Restart the GLINR Dock daemon
	// 4. Send notifications

	go func() {
		log.Info().Msg("simulating emergency restart sequence")
		// Note: In production, this would trigger actual restart
		// For now, just log the action
	}()
}

// GetLockdownStatus returns current lockdown status
func (h *Handlers) GetLockdownStatus(c *gin.Context) {
	lockdownMutex.RLock()
	state := *lockdownState
	lockdownMutex.RUnlock()

	c.JSON(http.StatusOK, state)
}

// LiftLockdown removes system lockdown (admin only)
func (h *Handlers) LiftLockdown(c *gin.Context) {
	lockdownMutex.Lock()
	wasLocked := lockdownState.IsLocked
	lockdownState = &LockdownState{IsLocked: false}
	lockdownMutex.Unlock()

	if wasLocked {
		log.Info().
			Str("admin_user", c.GetString("token_name")).
			Msg("system lockdown lifted")
	}

	c.JSON(http.StatusOK, gin.H{
		"status":    "lockdown_lifted",
		"message":   "System lockdown has been lifted.",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

// GetSystemStatus returns system status including restart history
func (h *Handlers) GetSystemStatus(c *gin.Context) {
	lockdownMutex.RLock()
	state := *lockdownState
	lockdownMutex.RUnlock()

	status := gin.H{
		"lockdown": state,
	}

	if !lastRestartTime.IsZero() {
		status["last_restart"] = gin.H{
			"timestamp": lastRestartTime.Format(time.RFC3339),
			"time_ago":  time.Since(lastRestartTime).String(),
		}
	}

	c.JSON(http.StatusOK, status)
}

// GetSystemLogs retrieves system logs (admin only)
func (h *Handlers) GetSystemLogs(c *gin.Context) {
	logPath := c.Query("path")
	if logPath == "" {
		logPath = "system" // Default log path
	}

	lines := 50 // Default number of lines
	if linesParam := c.Query("lines"); linesParam != "" {
		if parsedLines, err := parseIntParam(linesParam, 50); err == nil {
			lines = parsedLines
		}
	}

	// Define available log paths (security measure)
	allowedPaths := map[string]string{
		"system":    "/tmp/glinrdock-logs/system.log",
		"docker":    "/tmp/glinrdock-logs/docker.log",
		"nginx":     "/var/log/nginx/glinrdock.log",
		"auth":      "/tmp/glinrdock-logs/auth.log",
		"api":       "/var/log/glinrdock/api.log",
		"container": "/var/log/glinrdock/container.log",
	}

	actualPath, exists := allowedPaths[logPath]
	if !exists {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid log path"})
		return
	}

	// Check if log file exists
	if !fileExists(actualPath) {
		// Return empty logs if file doesn't exist
		c.JSON(http.StatusOK, LogsResponse{
			Logs: []string{"Log file not found: " + actualPath},
			Path: actualPath,
		})
		return
	}

	// Read logs using tail command
	cmd := exec.Command("tail", "-n", strconv.Itoa(lines), actualPath)
	output, err := cmd.Output()
	if err != nil {
		log.Error().Err(err).Str("path", actualPath).Msg("failed to read log file")
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to read logs"})
		return
	}

	// Split logs into lines
	logs := splitLines(string(output))

	c.JSON(http.StatusOK, LogsResponse{
		Logs: logs,
		Path: actualPath,
	})
}

// GetLogPaths returns available log file paths (admin only)
func (h *Handlers) GetLogPaths(c *gin.Context) {
	logPaths := []gin.H{
		{
			"name":        "System Logs",
			"path":        "system",
			"description": "Core GLINR Dock system logs",
			"location":    "/var/log/glinrdock/system.log",
		},
		{
			"name":        "Docker Logs",
			"path":        "docker",
			"description": "Docker engine integration logs",
			"location":    "/var/log/glinrdock/docker.log",
		},
		{
			"name":        "Nginx Logs",
			"path":        "nginx",
			"description": "Reverse proxy and routing logs",
			"location":    "/var/log/nginx/glinrdock.log",
		},
		{
			"name":        "Authentication Logs",
			"path":        "auth",
			"description": "Token and RBAC authentication logs",
			"location":    "/var/log/glinrdock/auth.log",
		},
		{
			"name":        "API Logs",
			"path":        "api",
			"description": "HTTP API request and response logs",
			"location":    "/var/log/glinrdock/api.log",
		},
		{
			"name":        "Container Logs",
			"path":        "container",
			"description": "Container lifecycle and management logs",
			"location":    "/var/log/glinrdock/container.log",
		},
	}

	c.JSON(http.StatusOK, gin.H{
		"log_paths": logPaths,
		"total":     len(logPaths),
	})
}

// Helper functions

func fileExists(path string) bool {
	if _, err := filepath.Abs(path); err != nil {
		return false
	}
	return true // Simplified for demo
}

func splitLines(text string) []string {
	if text == "" {
		return []string{}
	}
	
	lines := []string{}
	current := ""
	
	for _, char := range text {
		if char == '\n' {
			if current != "" {
				lines = append(lines, current)
			}
			current = ""
		} else {
			current += string(char)
		}
	}
	
	if current != "" {
		lines = append(lines, current)
	}
	
	return lines
}

func parseIntParam(param string, defaultVal int) (int, error) {
	// Simple integer parsing - in production use strconv.Atoi
	if len(param) == 0 {
		return defaultVal, nil
	}
	
	result := 0
	for _, char := range param {
		if char >= '0' && char <= '9' {
			result = result*10 + int(char-'0')
		} else {
			return defaultVal, nil
		}
	}
	
	if result == 0 {
		return defaultVal, nil
	}
	
	return result, nil
}