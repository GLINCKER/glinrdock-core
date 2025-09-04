package audit

import (
	"context"
	"fmt"
	"math/rand"
	"time"
)

// Action represents different types of auditable actions
type Action string

const (
	ActionRead           Action = "read"
	ActionUpdate         Action = "update"
	ActionTokenCreate    Action = "token_create"
	ActionTokenDelete    Action = "token_delete"
	ActionServiceStart   Action = "service_start"
	ActionServiceStop    Action = "service_stop"
	ActionServiceRestart Action = "service_restart"
	ActionServiceDeploy  Action = "service_deploy"
	ActionServiceScale   Action = "service_scale"
	ActionServiceView    Action = "service_view"
	ActionServiceUpdate  Action = "service_update"
	ActionServiceLinksUpdate Action = "service_links_update"
	ActionSystemLockdown Action = "system_lockdown"
	ActionSystemRestart  Action = "system_restart"
	ActionLicenseActivate Action = "license_activate"
	ActionLicenseDeactivate Action = "license_deactivate"
	ActionBackupCreate    Action = "backup_create"
	ActionBackupRestore   Action = "backup_restore"
	ActionProjectCreate  Action = "project_create"
	ActionProjectUpdate  Action = "project_update"
	ActionProjectDelete  Action = "project_delete"
	ActionRouteCreate    Action = "route_create"
	ActionRouteDelete    Action = "route_delete"
	ActionClientRegister Action = "client_register"
	ActionRegistryCreate Action = "registry_create"
	ActionRegistryDelete Action = "registry_delete"
	ActionWebhookDelivery Action = "webhook_delivery"
	ActionDeployTriggered Action = "deploy_triggered"
	ActionProjectNetworkEnsure Action = "project_network_ensure"
	ActionServiceNetworkAttach Action = "service_network_attach"
	ActionSearchQuery     Action = "search.query"
	ActionSearchSuggest   Action = "search.suggest"
	ActionHelpView        Action = "help_view"
	ActionHelpReindex     Action = "help_reindex"
	ActionCertificateCreate Action = "certificate_create"
	ActionCertificateDelete Action = "certificate_delete"
	ActionCertificateRenew  Action = "certificate_renew"
	ActionNginxReload     Action = "nginx_reload"
	ActionNginxValidate   Action = "nginx_validate"
	ActionNginxConfigApply Action = "nginx_config_apply"
	
	// DNS and Domain actions
	ActionDNSProviderCreate  Action = "dns_provider_create"
	ActionDNSProviderList    Action = "dns_provider_list"
	ActionDomainCreate       Action = "domain_create"
	ActionDomainVerify       Action = "domain_verify"
	ActionDomainStatusCheck  Action = "domain_status_check"
)

// Entry represents a single audit log entry
type Entry struct {
	ID         int64                  `json:"id" db:"id"`
	Timestamp  time.Time             `json:"timestamp" db:"timestamp"`
	Actor      string                `json:"actor" db:"actor"`
	Action     Action                `json:"action" db:"action"`
	TargetType string                `json:"target_type" db:"target_type"`
	TargetID   string                `json:"target_id" db:"target_id"`
	Meta       map[string]interface{} `json:"meta" db:"meta"`
}

// Store interface for audit operations
type Store interface {
	CreateAuditEntry(ctx context.Context, entry *Entry) error
	GetAuditEntries(ctx context.Context, limit int) ([]Entry, error)
}

// Logger handles audit logging operations
type Logger struct {
	store Store
}

// New creates a new audit logger
func New(store Store) *Logger {
	return &Logger{
		store: store,
	}
}

// Record creates an audit log entry
func (l *Logger) Record(ctx context.Context, actor string, action Action, targetType, targetID string, meta map[string]interface{}) {
	if l.store == nil {
		return // Fail silently if no store configured
	}

	entry := &Entry{
		Timestamp:  time.Now(),
		Actor:      actor,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Meta:       meta,
	}

	// Best effort logging - ignore errors
	l.store.CreateAuditEntry(ctx, entry)
}

// RecordSampled creates an audit log entry with sampling (1:n chance)
func (l *Logger) RecordSampled(ctx context.Context, actor string, action Action, targetType, targetID string, meta map[string]interface{}, sampleRate int) {
	if l.store == nil {
		return // Fail silently if no store configured
	}
	
	// Sample at 1:sampleRate (e.g., 1:20 for sampleRate=20)
	if rand.Intn(sampleRate) != 0 {
		return // Skip this sample
	}
	
	// Add sampling info to metadata
	if meta == nil {
		meta = make(map[string]interface{})
	}
	meta["sampled"] = true
	meta["sample_rate"] = fmt.Sprintf("1:%d", sampleRate)
	
	entry := &Entry{
		Timestamp:  time.Now(),
		Actor:      actor,
		Action:     action,
		TargetType: targetType,
		TargetID:   targetID,
		Meta:       meta,
	}

	// Best effort logging - ignore errors
	l.store.CreateAuditEntry(ctx, entry)
}

// GetRecent retrieves recent audit entries
func (l *Logger) GetRecent(ctx context.Context, limit int) ([]Entry, error) {
	if l.store == nil {
		return []Entry{}, nil
	}

	if limit <= 0 || limit > 100 {
		limit = 50 // Default limit
	}

	return l.store.GetAuditEntries(ctx, limit)
}

// RecordTokenAction records token-related actions
func (l *Logger) RecordTokenAction(ctx context.Context, actor string, action Action, tokenName string, meta map[string]interface{}) {
	if meta == nil {
		meta = make(map[string]interface{})
	}
	meta["token_name"] = tokenName
	l.Record(ctx, actor, action, "token", tokenName, meta)
}

// RecordServiceAction records service-related actions
func (l *Logger) RecordServiceAction(ctx context.Context, actor string, action Action, serviceID string, meta map[string]interface{}) {
	l.Record(ctx, actor, action, "service", serviceID, meta)
}

// RecordSystemAction records system-level actions
func (l *Logger) RecordSystemAction(ctx context.Context, actor string, action Action, meta map[string]interface{}) {
	l.Record(ctx, actor, action, "system", "", meta)
}

// RecordLicenseAction records license-related actions
func (l *Logger) RecordLicenseAction(ctx context.Context, actor string, action Action, meta map[string]interface{}) {
	l.Record(ctx, actor, action, "license", "", meta)
}

// RecordProjectAction records project-related actions
func (l *Logger) RecordProjectAction(ctx context.Context, actor string, action Action, projectID string, meta map[string]interface{}) {
	l.Record(ctx, actor, action, "project", projectID, meta)
}

// RecordRouteAction records route-related actions
func (l *Logger) RecordRouteAction(ctx context.Context, actor string, action Action, routeID string, meta map[string]interface{}) {
	l.Record(ctx, actor, action, "route", routeID, meta)
}

// RecordClientAction records client-related actions
func (l *Logger) RecordClientAction(ctx context.Context, actor string, action Action, clientName string, meta map[string]interface{}) {
	if meta == nil {
		meta = make(map[string]interface{})
	}
	meta["client_name"] = clientName
	l.Record(ctx, actor, action, "client", clientName, meta)
}

// RecordRegistryAction records registry-related actions
func (l *Logger) RecordRegistryAction(ctx context.Context, actor string, action Action, registryID string, meta map[string]interface{}) {
	l.Record(ctx, actor, action, "registry", registryID, meta)
}

// RecordCertificateAction records certificate-related actions
func (l *Logger) RecordCertificateAction(ctx context.Context, actor string, action Action, certificateID string, meta map[string]interface{}) {
	l.Record(ctx, actor, action, "certificate", certificateID, meta)
}

// RecordNginxAction records nginx-related actions
func (l *Logger) RecordNginxAction(ctx context.Context, actor string, action Action, meta map[string]interface{}) {
	l.Record(ctx, actor, action, "nginx", "", meta)
}

// RecordDNSAction records DNS provider-related actions
func (l *Logger) RecordDNSAction(ctx context.Context, actor string, action Action, meta map[string]interface{}) {
	l.Record(ctx, actor, action, "dns", "", meta)
}

// RecordDomainAction records domain-related actions
func (l *Logger) RecordDomainAction(ctx context.Context, actor string, action Action, meta map[string]interface{}) {
	l.Record(ctx, actor, action, "domain", "", meta)
}

// GetActorFromContext extracts actor information from context
func GetActorFromContext(ctx context.Context) string {
	if tokenName, ok := ctx.Value("token_name").(string); ok && tokenName != "" {
		return fmt.Sprintf("token:%s", tokenName)
	}
	if userID, ok := ctx.Value("user_id").(string); ok && userID != "" {
		return fmt.Sprintf("user:%s", userID)
	}
	return "system"
}