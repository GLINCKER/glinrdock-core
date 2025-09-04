package api

import (
	"archive/zip"
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"os/exec"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/GLINCKER/glinrdock/internal/plan"
	"github.com/GLINCKER/glinrdock/internal/version"
)

// LicenseStatus represents the response for license status
type LicenseStatus struct {
	Valid      bool                   `json:"valid"`
	Plan       string                 `json:"plan"`
	Name       string                 `json:"name,omitempty"`
	Org        string                 `json:"org,omitempty"`
	Expiry     *time.Time             `json:"expiry,omitempty"`
	ExpiresIn  *string                `json:"expires_in,omitempty"`
	ExpiringSoon bool                 `json:"expiring_soon,omitempty"`
	Features   []string               `json:"features"`
	Limits     map[string]int         `json:"limits"`
	Usage      map[string]int         `json:"usage"`
}

// LicenseActivateRequest represents the license activation payload
type LicenseActivateRequest struct {
	LicenseBase64 string `json:"license_base64" binding:"required"`
}

// GetLicenseStatus handles GET /v1/system/license
func (h *Handlers) GetLicenseStatus(c *gin.Context) {
	// Get current plan info
	planInfo := h.planEnforcer.GetPlan()
	limits := h.planEnforcer.GetLimits()
	currentLicense := h.planEnforcer.GetLicense()
	features := h.planEnforcer.GetFeatures()

	// Get current usage
	usage, err := h.planEnforcer.GetUsage(c.Request.Context(), h.tokenStore)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error: "Failed to get usage statistics",
		})
		return
	}

	status := LicenseStatus{
		Valid:    currentLicense != nil && !currentLicense.IsExpired(),
		Plan:     planInfo.String(),
		Features: features,
		Limits: map[string]int{
			"MaxTokens":  limits.MaxTokens,
			"MaxClients": limits.MaxClients,
			"MaxUsers":   limits.MaxUsers,
		},
		Usage: map[string]int{
			"tokens":  usage.Tokens,
			"clients": usage.Clients,
			"users":   usage.Users,
		},
	}

	// Add license-specific info if available
	if currentLicense != nil {
		status.Name = currentLicense.Name
		status.Org = currentLicense.Org
		status.Expiry = &currentLicense.Expiry
		status.ExpiringSoon = currentLicense.IsExpiringSoon()
		
		if !currentLicense.IsExpired() {
			expiresIn := currentLicense.ExpiresIn().String()
			status.ExpiresIn = &expiresIn
		}
	}

	c.JSON(http.StatusOK, status)
}

// ActivateLicense handles POST /v1/system/license/activate
func (h *Handlers) ActivateLicense(c *gin.Context) {
	var req LicenseActivateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error: "Invalid request format",
		})
		return
	}

	// Check payload size (64KB limit)
	if len(req.LicenseBase64) > 64*1024 {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error: "License data too large (max 64KB)",
		})
		return
	}

	// Decode base64 license data
	licenseData, err := base64.StdEncoding.DecodeString(req.LicenseBase64)
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error: "Invalid base64 license data",
		})
		return
	}

	// Save the license through the license manager
	if err := h.licenseManager.SaveCurrent(licenseData); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error: fmt.Sprintf("License activation failed: %s", err.Error()),
		})
		return
	}

	// Update plan enforcer with new license
	newLicense := h.licenseManager.Current()
	if newLicense != nil {
		h.planEnforcer = plan.NewWithLicenseFallback(newLicense, h.config)
	}

	// Record audit event
	actor := audit.GetActorFromContext(c.Request.Context())
	h.auditLogger.RecordLicenseAction(c.Request.Context(), actor, audit.ActionLicenseActivate, map[string]interface{}{
		"plan": newLicense.Plan,
		"name": newLicense.Name,
		"org":  newLicense.Org,
	})

	// Return updated status
	h.GetLicenseStatus(c)
}

// DeactivateLicense handles POST /v1/system/license/deactivate
func (h *Handlers) DeactivateLicense(c *gin.Context) {
	// Get current license info for audit
	currentLicense := h.planEnforcer.GetLicense()
	
	// Deactivate the license
	if err := h.licenseManager.DeactivateCurrent(); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error: fmt.Sprintf("License deactivation failed: %s", err.Error()),
		})
		return
	}

	// Revert to plan config
	h.planEnforcer = plan.NewWithLicenseFallback(nil, h.config)

	// Record audit event
	actor := audit.GetActorFromContext(c.Request.Context())
	meta := map[string]interface{}{}
	if currentLicense != nil {
		meta["previous_plan"] = currentLicense.Plan
		meta["previous_name"] = currentLicense.Name
	}
	h.auditLogger.RecordLicenseAction(c.Request.Context(), actor, audit.ActionLicenseDeactivate, meta)

	// Return updated status
	h.GetLicenseStatus(c)
}

// GetAuditEntries handles GET /v1/audit
func (h *Handlers) GetAuditEntries(c *gin.Context) {
	// Parse limit parameter
	limit := 50
	if limitStr := c.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	entries, err := h.auditLogger.GetRecent(c.Request.Context(), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error: "Failed to retrieve audit entries",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"entries": entries,
		"limit":   limit,
		"count":   len(entries),
	})
}

// GenerateSupportBundle handles POST /v1/support/bundle
func (h *Handlers) GenerateSupportBundle(c *gin.Context) {
	// Create a buffer to write the zip file to
	var buf bytes.Buffer
	writer := zip.NewWriter(&buf)

	// Helper function to add files to zip
	addToZip := func(filename string, content []byte) error {
		f, err := writer.Create(filename)
		if err != nil {
			return err
		}
		_, err = f.Write(content)
		return err
	}

	// Helper function to add command output to zip
	addCommandToZip := func(filename, command string, args ...string) {
		cmd := exec.Command(command, args...)
		output, err := cmd.Output()
		if err != nil {
			output = []byte(fmt.Sprintf("Error running %s: %s", command, err.Error()))
		}
		addToZip(filename, output)
	}

	// 1. Version information
	versionInfo := version.Get()
	versionData, _ := json.MarshalIndent(versionInfo, "", "  ")
	addToZip("version.json", versionData)

	// 2. System information
	systemInfo := map[string]interface{}{
		"timestamp": time.Now().Format(time.RFC3339),
		"generated_by": "glinrdock-support-bundle",
	}
	
	// Get system info from handler if available
	if h.dockerEngine != nil {
		// This would call the system info endpoint logic
		systemInfo["docker_available"] = true
	}
	
	systemData, _ := json.MarshalIndent(systemInfo, "", "  ")
	addToZip("system.json", systemData)

	// 3. License information (redacted)
	licenseStatus := LicenseStatus{
		Valid:        h.planEnforcer.HasLicense(),
		Plan:         h.planEnforcer.GetPlan().String(),
		Features:     h.planEnforcer.GetFeatures(),
		ExpiringSoon: false, // Don't expose exact timing
	}
	if lic := h.planEnforcer.GetLicense(); lic != nil {
		licenseStatus.Name = "[REDACTED]"
		licenseStatus.Org = "[REDACTED]" 
		licenseStatus.ExpiringSoon = lic.IsExpiringSoon()
	}
	licenseData, _ := json.MarshalIndent(licenseStatus, "", "  ")
	addToZip("license.json", licenseData)

	// 4. Plan and usage information
	limits := h.planEnforcer.GetLimits()
	usage, _ := h.planEnforcer.GetUsage(c.Request.Context(), h.tokenStore)
	planData := map[string]interface{}{
		"plan":   h.planEnforcer.GetPlan().String(),
		"limits": limits,
		"usage":  usage,
	}
	planDataJSON, _ := json.MarshalIndent(planData, "", "  ")
	addToZip("plan.json", planDataJSON)

	// 5. Recent audit entries (last 20)
	if auditEntries, err := h.auditLogger.GetRecent(c.Request.Context(), 20); err == nil {
		auditData, _ := json.MarshalIndent(auditEntries, "", "  ")
		addToZip("audit.json", auditData)
	}

	// 6. System logs (if available)
	logCommands := []struct {
		filename string
		command  string
		args     []string
	}{
		{"docker.log", "docker", []string{"version"}},
		{"docker-info.log", "docker", []string{"info"}},
		{"system-ps.log", "ps", []string{"aux"}},
		{"system-df.log", "df", []string{"-h"}},
		{"system-free.log", "free", []string{"-h"}},
	}

	for _, logCmd := range logCommands {
		addCommandToZip(logCmd.filename, logCmd.command, logCmd.args...)
	}

	// 7. Configuration summary (no secrets)
	configSummary := map[string]interface{}{
		"has_license":     h.planEnforcer.HasLicense(),
		"plan":           h.planEnforcer.GetPlan().String(),
		"features_count": len(h.planEnforcer.GetFeatures()),
		"timestamp":      time.Now().Format(time.RFC3339),
	}
	configData, _ := json.MarshalIndent(configSummary, "", "  ")
	addToZip("config.json", configData)

	// Close the zip writer
	if err := writer.Close(); err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error: "Failed to generate support bundle",
		})
		return
	}

	// Stream the zip file
	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=glinrdock-support-%d.zip", time.Now().Unix()))
	c.Header("Content-Length", fmt.Sprintf("%d", buf.Len()))
	
	c.Data(http.StatusOK, "application/zip", buf.Bytes())
}