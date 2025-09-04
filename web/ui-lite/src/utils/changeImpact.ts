/**
 * Change Impact Classification System
 * Categorizes configuration changes by their impact on the running service
 */

export type ImpactType = 'hot_reload' | 'app_restart' | 'container_restart' | 'image_rebuild';
export type ImpactSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ChangeImpact {
  type: ImpactType;
  severity: ImpactSeverity;
  description: string;
  downtime: string;
  requiresRestart: boolean;
  requiresRebuild: boolean;
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

export interface PendingChange {
  field: string;
  oldValue: any;
  newValue: any;
  impact: ChangeImpact;
  timestamp: Date;
}

export const IMPACT_TYPES: Record<ImpactType, ChangeImpact> = {
  hot_reload: {
    type: 'hot_reload',
    severity: 'low',
    description: 'Applied instantly without interruption',
    downtime: 'No downtime',
    requiresRestart: false,
    requiresRebuild: false,
    icon: 'zap',
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-800'
  },
  app_restart: {
    type: 'app_restart',
    severity: 'medium',
    description: 'Application process restart required',
    downtime: '5-15 seconds',
    requiresRestart: true,
    requiresRebuild: false,
    icon: 'rotate-ccw',
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    borderColor: 'border-blue-200 dark:border-blue-800'
  },
  container_restart: {
    type: 'container_restart',
    severity: 'high',
    description: 'Full container restart required',
    downtime: '30-60 seconds',
    requiresRestart: true,
    requiresRebuild: false,
    icon: 'box',
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-800'
  },
  image_rebuild: {
    type: 'image_rebuild',
    severity: 'critical',
    description: 'Container image rebuild and deployment',
    downtime: '5+ minutes',
    requiresRestart: true,
    requiresRebuild: true,
    icon: 'wrench',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-800'
  }
};

/**
 * Determines the impact type for a configuration field change
 */
export function getFieldImpact(fieldName: string, oldValue: any, newValue: any): ChangeImpact {
  // Environment variables - most can be hot-reloaded
  if (fieldName === 'environment') {
    // Check if any secrets or critical configs changed
    const criticalEnvVars = ['DATABASE_URL', 'DB_HOST', 'DB_PORT', 'REDIS_URL'];
    const hasSecretChange = Object.keys(newValue || {}).some(key => 
      criticalEnvVars.includes(key) && oldValue?.[key] !== newValue?.[key]
    );
    
    return hasSecretChange ? IMPACT_TYPES.app_restart : IMPACT_TYPES.hot_reload;
  }

  // Port mappings always require container restart
  if (fieldName === 'ports') {
    return IMPACT_TYPES.container_restart;
  }

  // Volume mounts require container restart
  if (fieldName === 'volumes') {
    return IMPACT_TYPES.container_restart;
  }

  // Network settings require container restart
  if (fieldName === 'network_mode' || fieldName === 'network') {
    return IMPACT_TYPES.container_restart;
  }

  // Service name and description are metadata (hot reload)
  if (fieldName === 'name' || fieldName === 'description') {
    return IMPACT_TYPES.hot_reload;
  }

  // Image changes require rebuild
  if (fieldName === 'image' || fieldName === 'dockerfile') {
    return IMPACT_TYPES.image_rebuild;
  }

  // Command and entrypoint changes require container restart
  if (fieldName === 'command' || fieldName === 'entrypoint') {
    return IMPACT_TYPES.container_restart;
  }

  // Resource limits can often be applied without restart (depends on container runtime)
  if (fieldName === 'cpu_limit' || fieldName === 'memory_limit') {
    return IMPACT_TYPES.app_restart;
  }

  // Default to container restart for unknown fields (safe default)
  return IMPACT_TYPES.container_restart;
}

/**
 * Calculates the combined impact of multiple changes
 */
export function getCombinedImpact(changes: PendingChange[]): ChangeImpact {
  if (changes.length === 0) return IMPACT_TYPES.hot_reload;

  // Find the highest severity impact
  const impacts = changes.map(change => change.impact);
  
  if (impacts.some(impact => impact.type === 'image_rebuild')) {
    return IMPACT_TYPES.image_rebuild;
  }
  
  if (impacts.some(impact => impact.type === 'container_restart')) {
    return IMPACT_TYPES.container_restart;
  }
  
  if (impacts.some(impact => impact.type === 'app_restart')) {
    return IMPACT_TYPES.app_restart;
  }
  
  return IMPACT_TYPES.hot_reload;
}

/**
 * Formats field name for display
 */
export function formatFieldName(fieldName: string): string {
  const fieldMap: Record<string, string> = {
    'environment': 'Environment Variables',
    'ports': 'Port Mappings',
    'volumes': 'Volume Mounts',
    'name': 'Service Name',
    'description': 'Description',
    'image': 'Container Image',
    'dockerfile': 'Dockerfile',
    'command': 'Command',
    'entrypoint': 'Entrypoint',
    'cpu_limit': 'CPU Limit',
    'memory_limit': 'Memory Limit',
    'network_mode': 'Network Mode',
    'network': 'Network Settings'
  };
  
  return fieldMap[fieldName] || fieldName.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

/**
 * Generates a human-readable change summary
 */
export function formatChangeValue(fieldName: string, oldValue: any, newValue: any): string {
  if (fieldName === 'environment') {
    const oldKeys = Object.keys(oldValue || {});
    const newKeys = Object.keys(newValue || {});
    const added = newKeys.filter(key => !oldKeys.includes(key));
    const removed = oldKeys.filter(key => !newKeys.includes(key));
    const modified = newKeys.filter(key => oldKeys.includes(key) && oldValue[key] !== newValue[key]);
    
    const changes = [];
    if (added.length > 0) changes.push(`+${added.length} added`);
    if (modified.length > 0) changes.push(`${modified.length} modified`);
    if (removed.length > 0) changes.push(`-${removed.length} removed`);
    
    return changes.join(', ') || 'No changes';
  }
  
  if (Array.isArray(newValue)) {
    return `${newValue.length} items`;
  }
  
  if (typeof newValue === 'string' && newValue.length > 50) {
    return newValue.substring(0, 50) + '...';
  }
  
  return String(newValue);
}

/**
 * Hook for managing pending changes in components
 */
export function usePendingChanges() {
  const pendingChanges: PendingChange[] = [];
  
  const addChange = (field: string, oldValue: any, newValue: any) => {
    const impact = getFieldImpact(field, oldValue, newValue);
    const change: PendingChange = {
      field,
      oldValue,
      newValue,
      impact,
      timestamp: new Date()
    };
    
    // Remove existing change for this field and add new one
    const existingIndex = pendingChanges.findIndex(c => c.field === field);
    if (existingIndex >= 0) {
      pendingChanges.splice(existingIndex, 1);
    }
    pendingChanges.push(change);
  };
  
  const removeChange = (field: string) => {
    const index = pendingChanges.findIndex(c => c.field === field);
    if (index >= 0) {
      pendingChanges.splice(index, 1);
    }
  };
  
  const clearChanges = () => {
    pendingChanges.length = 0;
  };
  
  const getCombinedImpactForChanges = () => getCombinedImpact(pendingChanges);
  
  return {
    pendingChanges,
    addChange,
    removeChange,
    clearChanges,
    getCombinedImpact: getCombinedImpactForChanges,
    hasChanges: pendingChanges.length > 0
  };
}