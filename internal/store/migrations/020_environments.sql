-- Migration: Create environment management tables
-- Description: Add support for multi-environment configuration management

-- Create environments table
CREATE TABLE environments (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT FALSE,
    inherit_from VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create environment_variables table
CREATE TABLE environment_variables (
    id VARCHAR(255) PRIMARY KEY,
    environment_id VARCHAR(255) NOT NULL,
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    is_secret BOOLEAN DEFAULT FALSE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(environment_id, key)
);

-- Create environment_templates table
CREATE TABLE environment_templates (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    environment_type VARCHAR(50) NOT NULL,
    template_data TEXT NOT NULL, -- JSON data for variables and structure
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add environment reference to services table
ALTER TABLE services ADD COLUMN environment_id VARCHAR(255);

-- Create indexes for performance
CREATE INDEX idx_environments_type ON environments(type);
CREATE INDEX idx_environments_is_default ON environments(is_default);
CREATE INDEX idx_environments_is_active ON environments(is_active);
CREATE INDEX idx_environment_variables_env_id ON environment_variables(environment_id);
CREATE INDEX idx_environment_variables_key ON environment_variables(key);
CREATE INDEX idx_environment_variables_is_secret ON environment_variables(is_secret);
CREATE INDEX idx_environment_templates_type ON environment_templates(environment_type);
CREATE INDEX idx_services_environment_id ON services(environment_id);

-- Insert default development environment
INSERT INTO environments (
    id, 
    name, 
    type, 
    description, 
    is_default, 
    is_active,
    created_at, 
    updated_at
) VALUES (
    'env-default-dev',
    'Development',
    'development',
    'Default development environment for new services',
    TRUE,
    TRUE,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

-- Insert some default environment variables for the development environment
INSERT INTO environment_variables (id, environment_id, key, value, is_secret, description, created_at, updated_at) VALUES
('var-dev-node-env', 'env-default-dev', 'NODE_ENV', 'development', FALSE, 'Node.js environment mode', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var-dev-log-level', 'env-default-dev', 'LOG_LEVEL', 'debug', FALSE, 'Application logging level', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var-dev-debug', 'env-default-dev', 'DEBUG', 'true', FALSE, 'Enable debug mode', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('var-dev-hot-reload', 'env-default-dev', 'HOT_RELOAD', 'true', FALSE, 'Enable hot reloading for development', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

-- Insert system environment templates
INSERT INTO environment_templates (id, name, description, environment_type, template_data, is_system, created_at, updated_at) VALUES
('tpl-web-app', 'Web Application', 'Standard configuration for web applications', 'development', 
 '{"variables":{"NODE_ENV":"development","PORT":"3000","LOG_LEVEL":"debug"},"secrets":["DATABASE_URL","API_KEY","SESSION_SECRET"]}', 
 TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tpl-database', 'Database Service', 'Standard configuration for database services', 'development',
 '{"variables":{"DB_NAME":"myapp","DB_PORT":"5432","LOG_LEVEL":"info"},"secrets":["DB_PASSWORD","DB_ROOT_PASSWORD","DB_USER"]}',
 TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('tpl-api-service', 'API Service', 'Standard configuration for API services', 'development',
 '{"variables":{"API_PORT":"8080","CORS_ORIGINS":"*","RATE_LIMIT":"100"},"secrets":["JWT_SECRET","API_KEY","OAUTH_CLIENT_SECRET"]}',
 TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);