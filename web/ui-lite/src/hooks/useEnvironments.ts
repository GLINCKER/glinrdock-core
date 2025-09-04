import { useState, useEffect } from 'preact/hooks';
import { EnvironmentConfig, EnvironmentContext, EnvironmentType } from '../types/environment';

// Mock environments for development
const createMockEnvironment = (
  id: string, 
  name: string, 
  type: EnvironmentType, 
  isDefault = false, 
  isActive = false,
  inheritFrom?: string
): EnvironmentConfig => ({
  id,
  name,
  type,
  description: `${name} environment for container configuration`,
  is_default: isDefault,
  is_active: isActive,
  variables: {
    NODE_ENV: type,
    LOG_LEVEL: type === 'production' ? 'warn' : 'debug',
    ...(type === 'production' && { SECURE_MODE: 'true' }),
    ...(type === 'development' && { HOT_RELOAD: 'true', DEBUG: 'true' }),
    ...(type === 'staging' && { ANALYTICS_ENABLED: 'true' })
  },
  secrets: {
    DATABASE_PASSWORD: 'set',
    API_KEY: 'set',
    ...(type === 'production' && { JWT_SECRET: 'set' })
  },
  inherit_from: inheritFrom,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
});

// Hook for environment management
export function useEnvironments(): EnvironmentContext {
  const [environments, setEnvironments] = useState<EnvironmentConfig[]>([
    createMockEnvironment('dev', 'Development', 'development', true, true),
    createMockEnvironment('staging', 'Staging', 'staging', false, false, 'dev'),
    createMockEnvironment('prod', 'Production', 'production', false, false, 'staging'),
    createMockEnvironment('test', 'Testing', 'testing', false, false, 'dev')
  ]);
  
  const [currentEnvironment, setCurrentEnvironment] = useState<EnvironmentConfig>(
    environments.find(env => env.is_active) || environments[0]
  );

  const switchEnvironment = async (environmentId: string): Promise<void> => {
    const newEnv = environments.find(env => env.id === environmentId);
    if (!newEnv) {
      throw new Error(`Environment ${environmentId} not found`);
    }

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Update active status
    setEnvironments(prev => prev.map(env => ({
      ...env,
      is_active: env.id === environmentId
    })));
    
    setCurrentEnvironment(newEnv);
  };

  const createEnvironment = async (config: Partial<EnvironmentConfig>): Promise<EnvironmentConfig> => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const newEnv: EnvironmentConfig = {
      id: `env-${Date.now()}`,
      name: config.name || 'New Environment',
      type: config.type || 'development',
      description: config.description,
      is_default: config.is_default || false,
      is_active: false,
      variables: {},
      secrets: {},
      inherit_from: config.inherit_from,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setEnvironments(prev => [...prev, newEnv]);
    return newEnv;
  };

  const updateEnvironment = async (id: string, updates: Partial<EnvironmentConfig>): Promise<EnvironmentConfig> => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const updatedEnv = { ...environments.find(env => env.id === id)!, ...updates, updated_at: new Date().toISOString() };
    
    setEnvironments(prev => prev.map(env => 
      env.id === id ? updatedEnv : env
    ));
    
    if (currentEnvironment.id === id) {
      setCurrentEnvironment(updatedEnv);
    }
    
    return updatedEnv;
  };

  const deleteEnvironment = async (id: string): Promise<void> => {
    const envToDelete = environments.find(env => env.id === id);
    if (!envToDelete) {
      throw new Error('Environment not found');
    }

    if (envToDelete.is_active) {
      throw new Error('Cannot delete active environment');
    }

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    setEnvironments(prev => prev.filter(env => env.id !== id));
  };

  const duplicateEnvironment = async (id: string, name: string): Promise<EnvironmentConfig> => {
    const original = environments.find(env => env.id === id);
    if (!original) {
      throw new Error('Environment not found');
    }

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const duplicate: EnvironmentConfig = {
      ...original,
      id: `env-${Date.now()}`,
      name,
      is_default: false,
      is_active: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setEnvironments(prev => [...prev, duplicate]);
    return duplicate;
  };

  return {
    current_environment: currentEnvironment,
    available_environments: environments,
    switch_environment: switchEnvironment,
    create_environment: createEnvironment,
    update_environment: updateEnvironment,
    delete_environment: deleteEnvironment,
    duplicate_environment: duplicateEnvironment
  };
}