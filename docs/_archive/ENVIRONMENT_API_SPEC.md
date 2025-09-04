# Environment Management API Specification

## Overview
API endpoints for managing multi-environment configuration with inheritance, variable isolation, and secure secret handling.

## Base URL
```
/v1/environments
```

## Data Models

### Environment
```go
type Environment struct {
    ID          string                 `json:"id" db:"id"`
    Name        string                 `json:"name" db:"name"`
    Type        string                 `json:"type" db:"type"` // development, staging, production, testing
    Description *string                `json:"description,omitempty" db:"description"`
    IsDefault   bool                   `json:"is_default" db:"is_default"`
    IsActive    bool                   `json:"is_active" db:"is_active"`
    InheritFrom *string                `json:"inherit_from,omitempty" db:"inherit_from"`
    Variables   map[string]string      `json:"variables" db:"-"`
    Secrets     map[string]bool        `json:"secrets" db:"-"` // Keys only, values stored securely
    CreatedAt   time.Time              `json:"created_at" db:"created_at"`
    UpdatedAt   time.Time              `json:"updated_at" db:"updated_at"`
}

type EnvironmentVariable struct {
    ID            string    `json:"id" db:"id"`
    EnvironmentID string    `json:"environment_id" db:"environment_id"`
    Key           string    `json:"key" db:"key"`
    Value         string    `json:"value" db:"value"`
    IsSecret      bool      `json:"is_secret" db:"is_secret"`
    Description   *string   `json:"description,omitempty" db:"description"`
    CreatedAt     time.Time `json:"created_at" db:"created_at"`
    UpdatedAt     time.Time `json:"updated_at" db:"updated_at"`
}

type MergedEnvironmentVariable struct {
    Key           string `json:"key"`
    Value         string `json:"value"`
    IsSecret      bool   `json:"is_secret"`
    Source        string `json:"source"` // "direct", "inherited", "override"
    SourceEnvID   string `json:"source_env_id"`
    SourceEnvName string `json:"source_env_name"`
}
```

## API Endpoints

### 1. List Environments
```http
GET /v1/environments
```

**Response:**
```json
{
  "environments": [
    {
      "id": "env-dev-001",
      "name": "Development",
      "type": "development",
      "description": "Development environment for active coding",
      "is_default": true,
      "is_active": true,
      "inherit_from": null,
      "variables": {"NODE_ENV": "development", "DEBUG": "true"},
      "secrets": {"DATABASE_PASSWORD": true, "API_KEY": true},
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

### 2. Get Environment Details with Merged Variables
```http
GET /v1/environments/{id}
```

**Response:**
```json
{
  "environment": {
    "id": "env-staging-001",
    "name": "Staging",
    "type": "staging",
    "inherit_from": "env-dev-001"
  },
  "merged_variables": [
    {
      "key": "NODE_ENV",
      "value": "staging",
      "is_secret": false,
      "source": "override",
      "source_env_id": "env-staging-001",
      "source_env_name": "Staging"
    },
    {
      "key": "DEBUG",
      "value": "true",
      "is_secret": false,
      "source": "inherited",
      "source_env_id": "env-dev-001",
      "source_env_name": "Development"
    }
  ]
}
```

### 3. Create Environment
```http
POST /v1/environments
```

**Request:**
```json
{
  "name": "Production",
  "type": "production",
  "description": "Production environment for live services",
  "is_default": false,
  "inherit_from": "env-staging-001"
}
```

### 4. Update Environment
```http
PUT /v1/environments/{id}
```

**Request:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "is_default": true
}
```

### 5. Delete Environment
```http
DELETE /v1/environments/{id}
```

**Constraints:**
- Cannot delete active environment
- Cannot delete environment with child environments (inheritance)
- Must reassign services using this environment

### 6. Duplicate Environment
```http
POST /v1/environments/{id}/duplicate
```

**Request:**
```json
{
  "name": "Production Copy",
  "copy_variables": true,
  "copy_secrets": false
}
```

### 7. Set Active Environment
```http
POST /v1/environments/{id}/activate
```

### 8. Environment Variables Management

#### Get Variables
```http
GET /v1/environments/{id}/variables
```

#### Set Variable
```http
PUT /v1/environments/{id}/variables/{key}
```

**Request:**
```json
{
  "value": "variable-value",
  "is_secret": false,
  "description": "Variable description"
}
```

#### Delete Variable
```http
DELETE /v1/environments/{id}/variables/{key}
```

#### Bulk Update Variables
```http
POST /v1/environments/{id}/variables/bulk
```

**Request:**
```json
{
  "variables": {
    "KEY1": "value1",
    "KEY2": "value2"
  },
  "operation": "merge" // or "replace"
}
```

### 9. Environment Templates

#### List Templates
```http
GET /v1/environment-templates
```

#### Create from Environment
```http
POST /v1/environments/{id}/create-template
```

**Request:**
```json
{
  "name": "Database Service Template",
  "description": "Standard configuration for database services",
  "include_secrets": false
}
```

## Database Schema

### environments table
```sql
CREATE TABLE environments (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL CHECK (type IN ('development', 'staging', 'production', 'testing')),
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT FALSE,
    inherit_from VARCHAR(255) REFERENCES environments(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT only_one_default CHECK (
        NOT is_default OR (SELECT COUNT(*) FROM environments WHERE is_default = TRUE) <= 1
    ),
    CONSTRAINT only_one_active CHECK (
        NOT is_active OR (SELECT COUNT(*) FROM environments WHERE is_active = TRUE) <= 1
    )
);
```

### environment_variables table
```sql
CREATE TABLE environment_variables (
    id VARCHAR(255) PRIMARY KEY,
    environment_id VARCHAR(255) NOT NULL REFERENCES environments(id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    is_secret BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(environment_id, key)
);
```

### environment_templates table
```sql
CREATE TABLE environment_templates (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    environment_type VARCHAR(50) NOT NULL,
    template_data JSONB NOT NULL, -- Variables and structure
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### services table (enhanced)
```sql
-- Add environment reference to services
ALTER TABLE services ADD COLUMN environment_id VARCHAR(255) REFERENCES environments(id);
```

## Security Considerations

### Secret Management
1. **Encryption at Rest**: All secret values encrypted in database
2. **Secret Masking**: API responses show only keys, not values for secrets
3. **Audit Trail**: Track all secret access and modifications
4. **Role-Based Access**: Environment-specific permissions

### Environment Isolation
1. **Namespace Isolation**: Each environment has isolated variable namespace
2. **Inheritance Validation**: Prevent circular inheritance chains
3. **Default Environment**: Ensure at least one default environment exists
4. **Active Environment**: Only one environment can be active at a time

## Implementation Priority

### Phase 3.2: Backend API (Immediate)
1. **Database Migrations**: Create environment tables
2. **Go API Handlers**: Implement all CRUD endpoints
3. **Variable Resolution**: Implement inheritance chain resolution
4. **Environment Validation**: Constraint validation and error handling

### Phase 3.3: Frontend Integration (Next)
1. **API Client Integration**: Connect React components to real API
2. **Environment Context**: Replace mock with real API calls
3. **Error Handling**: Proper error states and user feedback
4. **Performance**: Optimize API calls and caching

### Phase 3.4: Advanced Features (Future)
1. **Environment Templates**: Reusable configuration patterns
2. **Variable Validation**: Required variables per environment type
3. **Configuration Diff**: Visual comparison between environments
4. **Bulk Operations**: Import/export multiple environments

## Testing Strategy

### Unit Tests
- Environment CRUD operations
- Variable inheritance resolution
- Secret handling and masking
- Validation logic

### Integration Tests
- Environment switching workflows
- Variable inheritance chains
- Template creation and application
- Service environment assignment

### Security Tests
- Secret encryption/decryption
- Access control validation
- Audit trail functionality
- Environment isolation verification