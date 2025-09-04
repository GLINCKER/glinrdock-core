# Enhanced Configuration Management Design

## 1. Change Impact Classification System

### Change Types & Impacts:
- **🔥 Hot Reload** - No restart needed (some env vars, feature flags)
- **🔄 App Restart** - Process restart only (config files, database connections) 
- **🐳 Container Restart** - Full container restart (ports, volumes, network)
- **🏗️ Image Rebuild** - New deployment needed (Dockerfile, base image)

### UI Indicators:
```
🔥 Hot Reload     ✅ Apply immediately
🔄 App Restart    ⚠️  Requires process restart (5-10s downtime)
🐳 Container      ❌ Requires container restart (30s+ downtime)  
🏗️ Image Rebuild  🚨 Requires new deployment (5+ min downtime)
```

## 2. Container Status & Uptime Display

### Status Card:
```
┌─────────────────────────────────────────┐
│ 🐳 Container Status                     │ 
├─────────────────────────────────────────┤
│ Status: ✅ Running                      │
│ Uptime: 2 days, 14 hours, 32 minutes   │
│ Last Restart: 2024-08-29 10:15 AM      │
│ Health: ✅ Healthy (last check: 30s)    │
│                                         │
│ ⚠️  2 changes pending restart           │ 
│ 📊 Memory: 245MB / 512MB (48%)          │
│ 💾 CPU: 12% avg                        │
└─────────────────────────────────────────┘
```

## 3. Environment-Specific Management

### Environment Tabs:
```
[Development] [Staging] [🟢 Production*] [+ Add Environment]
                                      (* = currently active)
```

### Per-Environment Config:
- Separate variable sets
- Environment-specific .env files  
- Secret isolation (prod secrets != dev secrets)
- Default environment selection

## 4. Change Management Workflow

### Pending Changes Panel:
```
┌─────────────────────────────────────────┐
│ ⚠️  Pending Changes (3)                 │
├─────────────────────────────────────────┤
│ 🔥 DB_URL changed                   [✓] │
│ 🐳 Port mapping 8080 → 3000        [✓] │  
│ 🐳 Volume mount added               [✓] │
├─────────────────────────────────────────┤
│ Impact: Container restart required      │
│ Downtime: ~30 seconds                   │
│ [Cancel Changes] [Apply & Restart] →    │
└─────────────────────────────────────────┘
```

## 5. Implementation Order

### Phase 1: Change Impact System
1. Add change classification to config updates
2. Show impact warnings before applying changes
3. Batch changes by impact type
4. Add container uptime display

### Phase 2: Environment Management  
1. Add environment selector UI
2. Separate variable storage per environment
3. Environment-specific .env file upload
4. Active environment indicator

### Phase 3: Advanced Features
1. Secret management with encryption
2. Change approval workflow
3. Rollback capabilities
4. Configuration templates

## 6. API Requirements

### New Endpoints:
- `GET /v1/services/{id}/uptime` - Container uptime & status
- `GET /v1/services/{id}/environments` - List environments  
- `POST /v1/services/{id}/environments` - Create environment
- `GET /v1/services/{id}/environments/{env}/config` - Get env config
- `PUT /v1/services/{id}/environments/{env}/config` - Update env config
- `POST /v1/services/{id}/apply-changes` - Apply pending changes
- `GET /v1/services/{id}/pending-changes` - Get pending changes

### Enhanced Service Model:
```go
type Service struct {
    // ... existing fields
    Uptime          time.Duration    `json:"uptime"`
    LastRestart     time.Time        `json:"last_restart"`
    ActiveEnv       string           `json:"active_env"`
    Environments    []Environment    `json:"environments"`
    PendingChanges  []PendingChange  `json:"pending_changes"`
}

type PendingChange struct {
    Field       string      `json:"field"`
    OldValue    interface{} `json:"old_value"`
    NewValue    interface{} `json:"new_value"`
    Impact      ChangeImpact `json:"impact"`
    RequiresRestart bool    `json:"requires_restart"`
}
```