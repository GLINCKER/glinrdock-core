// Environment Management Types
export type EnvironmentType = 'development' | 'staging' | 'production' | 'testing';

export interface EnvironmentConfig {
  id: string;
  name: string;
  type: EnvironmentType;
  description?: string;
  is_default: boolean;
  is_active: boolean;
  variables: Record<string, string>;
  secrets: Record<string, string>; // Secret keys only, values handled securely
  inherit_from?: string; // ID of parent environment to inherit from
  created_at: string;
  updated_at: string;
}

export interface EnvironmentVariable {
  key: string;
  value: string;
  is_secret: boolean;
  source: 'direct' | 'inherited' | 'override';
  environment_id: string;
  description?: string;
}

export interface EnvironmentTemplate {
  id: string;
  name: string;
  description?: string;
  environment_type: EnvironmentType;
  variables: Record<string, string>;
  secrets: string[]; // Secret keys template
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

export interface EnvironmentDiff {
  key: string;
  old_value?: string;
  new_value?: string;
  change_type: 'added' | 'modified' | 'removed';
  is_secret: boolean;
}

// Environment switching context
export interface EnvironmentContext {
  current_environment: EnvironmentConfig;
  available_environments: EnvironmentConfig[];
  switch_environment: (environmentId: string) => Promise<void>;
  create_environment: (config: Partial<EnvironmentConfig>) => Promise<EnvironmentConfig>;
  update_environment: (id: string, updates: Partial<EnvironmentConfig>) => Promise<EnvironmentConfig>;
  delete_environment: (id: string) => Promise<void>;
  duplicate_environment: (id: string, name: string) => Promise<EnvironmentConfig>;
}