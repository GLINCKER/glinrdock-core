package health

import (
	"context"
	"fmt"
	"time"

	"github.com/GLINCKER/glinrdock/internal/audit"
	"github.com/GLINCKER/glinrdock/internal/store"
)

// CrashLoopServiceStore interface for crash loop operations
type CrashLoopServiceStore interface {
	GetService(ctx context.Context, id int64) (store.Service, error)
	UpdateServiceRestart(ctx context.Context, serviceID int64, exitCode int, restartCount int, windowStart *time.Time) error
	UpdateServiceState(ctx context.Context, serviceID int64, desiredState string, crashLooping bool) error
	UnlockService(ctx context.Context, serviceID int64) error
}

// CrashLoopDetector detects and handles crash loop scenarios
type CrashLoopDetector struct {
	store       CrashLoopServiceStore
	auditLogger *audit.Logger
}

// NewCrashLoopDetector creates a new crash loop detector
func NewCrashLoopDetector(store CrashLoopServiceStore, auditLogger *audit.Logger) *CrashLoopDetector {
	return &CrashLoopDetector{
		store:       store,
		auditLogger: auditLogger,
	}
}

// HandleServiceRestart processes a service restart and checks for crash loop conditions
func (c *CrashLoopDetector) HandleServiceRestart(ctx context.Context, serviceID int64, exitCode int) error {
	service, err := c.store.GetService(ctx, serviceID)
	if err != nil {
		return fmt.Errorf("failed to get service: %w", err)
	}

	// Update restart count and check for crash loop
	service.UpdateRestartCount()

	// Update restart tracking in database
	err = c.store.UpdateServiceRestart(ctx, serviceID, exitCode, service.RestartCount, service.RestartWindowAt)
	if err != nil {
		return fmt.Errorf("failed to update restart tracking: %w", err)
	}

	// Check if service should enter crash loop
	service.LastExitCode = &exitCode
	if service.ShouldEnterCrashLoop() {
		return c.enterCrashLoop(ctx, &service)
	}

	return nil
}

// enterCrashLoop puts a service into crash loop protection mode
func (c *CrashLoopDetector) enterCrashLoop(ctx context.Context, service *store.Service) error {
	// Set crash looping state and stop the service
	err := c.store.UpdateServiceState(ctx, service.ID, store.ServiceStateStopped, true)
	if err != nil {
		return fmt.Errorf("failed to set crash loop state: %w", err)
	}

	// Log audit event
	if c.auditLogger != nil {
		c.auditLogger.RecordServiceAction(ctx, "system", "service_crashloop_stop", fmt.Sprintf("%d", service.ID), map[string]interface{}{
			"service_id":     service.ID,
			"service_name":   service.Name,
			"restart_count":  service.RestartCount,
			"last_exit_code": *service.LastExitCode,
			"window_minutes": store.CrashLoopWindow,
		})
	}

	return nil
}

// UnlockService unlocks a service from crash loop protection
func (c *CrashLoopDetector) UnlockService(ctx context.Context, serviceID int64, userID string) error {
	service, err := c.store.GetService(ctx, serviceID)
	if err != nil {
		return fmt.Errorf("failed to get service: %w", err)
	}

	if !service.CrashLooping {
		return fmt.Errorf("service is not in crash loop state")
	}

	// Unlock the service
	err = c.store.UnlockService(ctx, serviceID)
	if err != nil {
		return fmt.Errorf("failed to unlock service: %w", err)
	}

	// Log audit event
	if c.auditLogger != nil {
		c.auditLogger.RecordServiceAction(ctx, userID, "service_crashloop_unlock", fmt.Sprintf("%d", serviceID), map[string]interface{}{
			"service_id":   serviceID,
			"service_name": service.Name,
			"unlocked_by":  userID,
		})
	}

	return nil
}

// CheckAndResetExpiredWindows resets restart windows for services where the 10-minute window has expired
func (c *CrashLoopDetector) CheckAndResetExpiredWindows(ctx context.Context) error {
	// This would typically be called by a periodic job
	// For now, we handle it in the restart detection logic
	return nil
}
