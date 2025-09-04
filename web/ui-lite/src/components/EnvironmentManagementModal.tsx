import { useState } from "preact/hooks";
import { EnvironmentConfig, EnvironmentType, EnvironmentTemplate } from "../types/environment";
import { X, Plus, Copy, Trash2, AlertTriangle, Save, Settings, Eye, EyeOff, Globe, Lock } from "lucide-preact";

interface EnvironmentManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  environments: EnvironmentConfig[];
  templates?: EnvironmentTemplate[];
  onCreateEnvironment: (config: Partial<EnvironmentConfig>) => Promise<EnvironmentConfig>;
  onUpdateEnvironment: (id: string, updates: Partial<EnvironmentConfig>) => Promise<EnvironmentConfig>;
  onDeleteEnvironment: (id: string) => Promise<void>;
  onDuplicateEnvironment: (id: string, name: string) => Promise<EnvironmentConfig>;
}

interface NewEnvironment {
  name: string;
  type: EnvironmentType;
  description: string;
  is_default: boolean;
  inherit_from?: string;
  template_id?: string;
}

export function EnvironmentManagementModal({
  isOpen,
  onClose,
  environments,
  templates = [],
  onCreateEnvironment,
  onUpdateEnvironment,
  onDeleteEnvironment,
  onDuplicateEnvironment
}: EnvironmentManagementModalProps) {
  const [activeTab, setActiveTab] = useState<'manage' | 'create' | 'templates'>('manage');
  const [loading, setLoading] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  const [newEnv, setNewEnv] = useState<NewEnvironment>({
    name: '',
    type: 'development',
    description: '',
    is_default: false
  });

  const environmentTypes: { value: EnvironmentType; label: string; description: string }[] = [
    { value: 'development', label: 'Development', description: 'For active development and testing' },
    { value: 'staging', label: 'Staging', description: 'Pre-production environment for final testing' },
    { value: 'production', label: 'Production', description: 'Live environment serving real users' },
    { value: 'testing', label: 'Testing', description: 'Dedicated testing and QA environment' }
  ];

  const getEnvironmentTypeColor = (type: EnvironmentType) => {
    switch (type) {
      case 'development': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'staging': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'production': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'testing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };

  const handleCreateEnvironment = async () => {
    if (!newEnv.name.trim()) return;
    
    setLoading('create');
    try {
      await onCreateEnvironment({
        name: newEnv.name.trim(),
        type: newEnv.type,
        description: newEnv.description.trim() || undefined,
        is_default: newEnv.is_default,
        inherit_from: newEnv.inherit_from
      });
      
      // Reset form
      setNewEnv({
        name: '',
        type: 'development',
        description: '',
        is_default: false
      });
      setActiveTab('manage');
    } catch (error) {
      console.error('Failed to create environment:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleDuplicateEnvironment = async (envId: string) => {
    const original = environments.find(env => env.id === envId);
    if (!original) return;

    const newName = `${original.name} Copy`;
    setLoading(envId);
    try {
      await onDuplicateEnvironment(envId, newName);
    } catch (error) {
      console.error('Failed to duplicate environment:', error);
    } finally {
      setLoading(null);
    }
  };

  const handleDeleteEnvironment = async (envId: string) => {
    setLoading(envId);
    try {
      await onDeleteEnvironment(envId);
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('Failed to delete environment:', error);
    } finally {
      setLoading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        {/* Modal */}
        <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col">
          {/* Header */}
          <div class="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <div>
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white">
                Environment Management
              </h2>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Manage development, staging, and production environments
              </p>
            </div>
            <button
              onClick={onClose}
              class="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div class="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('manage')}
              class={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'manage'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Manage Environments ({environments.length})
            </button>
            <button
              onClick={() => setActiveTab('create')}
              class={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'create'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Create New
            </button>
            <button
              onClick={() => setActiveTab('templates')}
              class={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'templates'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Templates ({templates.length})
            </button>
          </div>

          {/* Content */}
          <div class="flex-1 overflow-hidden">
            {activeTab === 'manage' && (
              <div class="h-full overflow-y-auto p-6">
                <div class="space-y-4">
                  {environments.map((env) => (
                    <div
                      key={env.id}
                      class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-4">
                          <div>
                            <div class="flex items-center space-x-3">
                              <h3 class="font-medium text-gray-900 dark:text-white">
                                {env.name}
                              </h3>
                              <span class={`text-xs px-2 py-1 rounded font-medium ${getEnvironmentTypeColor(env.type)}`}>
                                {env.type}
                              </span>
                              {env.is_default && (
                                <span class="text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-1 rounded">
                                  default
                                </span>
                              )}
                              {env.is_active && (
                                <span class="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 px-2 py-1 rounded">
                                  active
                                </span>
                              )}
                            </div>
                            {env.description && (
                              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                {env.description}
                              </p>
                            )}
                            <div class="flex items-center space-x-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
                              <span>
                                <Globe class="w-3 h-3 inline mr-1" />
                                {Object.keys(env.variables || {}).length} variables
                              </span>
                              <span>
                                <Lock class="w-3 h-3 inline mr-1" />
                                {Object.keys(env.secrets || {}).length} secrets
                              </span>
                              {env.inherit_from && (
                                <span>
                                  <Settings class="w-3 h-3 inline mr-1" />
                                  Inherits from parent
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div class="flex items-center space-x-2">
                          <button
                            onClick={() => handleDuplicateEnvironment(env.id)}
                            disabled={loading === env.id}
                            class="p-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600"
                            title="Duplicate environment"
                          >
                            <Copy class="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(env.id)}
                            disabled={loading === env.id || env.is_active}
                            class="p-2 text-gray-500 hover:text-red-600 dark:hover:text-red-400 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={env.is_active ? "Cannot delete active environment" : "Delete environment"}
                          >
                            <Trash2 class="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      {/* Delete Confirmation */}
                      {showDeleteConfirm === env.id && (
                        <div class="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded border border-red-200 dark:border-red-700">
                          <div class="flex items-start space-x-2">
                            <AlertTriangle class="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                            <div class="flex-1">
                              <p class="text-sm text-red-800 dark:text-red-200 font-medium">
                                Delete "{env.name}" environment?
                              </p>
                              <p class="text-xs text-red-700 dark:text-red-300 mt-1">
                                This action cannot be undone. All environment variables and settings will be permanently lost.
                              </p>
                              <div class="flex space-x-2 mt-3">
                                <button
                                  onClick={() => handleDeleteEnvironment(env.id)}
                                  disabled={loading === env.id}
                                  class="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                                >
                                  {loading === env.id ? 'Deleting...' : 'Delete'}
                                </button>
                                <button
                                  onClick={() => setShowDeleteConfirm(null)}
                                  class="px-3 py-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-xs rounded hover:bg-gray-400 dark:hover:bg-gray-500"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  {environments.length === 0 && (
                    <div class="text-center py-12">
                      <Settings class="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        No environments yet
                      </h3>
                      <p class="text-gray-600 dark:text-gray-400 mb-4">
                        Create your first environment to get started with multi-environment configuration.
                      </p>
                      <button
                        onClick={() => setActiveTab('create')}
                        class="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                      >
                        <Plus class="w-4 h-4" />
                        <span>Create Environment</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'create' && (
              <div class="h-full overflow-y-auto p-6">
                <div class="max-w-2xl">
                  <div class="space-y-6">
                    {/* Basic Information */}
                    <div class="space-y-4">
                      <h3 class="text-lg font-medium text-gray-900 dark:text-white">
                        Basic Information
                      </h3>
                      
                      <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Environment Name *
                        </label>
                        <input
                          type="text"
                          value={newEnv.name}
                          onInput={(e) => setNewEnv({ ...newEnv, name: (e.target as HTMLInputElement).value })}
                          placeholder="e.g., Production, Staging, Development"
                          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        />
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Environment Type *
                        </label>
                        <select
                          value={newEnv.type}
                          onChange={(e) => setNewEnv({ ...newEnv, type: (e.target as HTMLSelectElement).value as EnvironmentType })}
                          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                        >
                          {environmentTypes.map((type) => (
                            <option key={type.value} value={type.value}>
                              {type.label} - {type.description}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Description
                        </label>
                        <textarea
                          value={newEnv.description}
                          onInput={(e) => setNewEnv({ ...newEnv, description: (e.target as HTMLTextAreaElement).value })}
                          placeholder="Optional description for this environment"
                          rows={3}
                          class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-y"
                        />
                      </div>
                    </div>

                    {/* Advanced Options */}
                    <div class="space-y-4">
                      <h3 class="text-lg font-medium text-gray-900 dark:text-white">
                        Advanced Options
                      </h3>

                      {/* Inherit from parent */}
                      {environments.length > 0 && (
                        <div>
                          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Inherit from Environment
                          </label>
                          <select
                            value={newEnv.inherit_from || ''}
                            onChange={(e) => setNewEnv({ 
                              ...newEnv, 
                              inherit_from: (e.target as HTMLSelectElement).value || undefined 
                            })}
                            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                          >
                            <option value="">No inheritance</option>
                            {environments.map((env) => (
                              <option key={env.id} value={env.id}>
                                {env.name} ({env.type})
                              </option>
                            ))}
                          </select>
                          <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            This environment will inherit all variables from the selected parent environment
                          </p>
                        </div>
                      )}

                      {/* Default environment checkbox */}
                      <div class="flex items-start space-x-2">
                        <input
                          type="checkbox"
                          id="is_default"
                          checked={newEnv.is_default}
                          onChange={(e) => setNewEnv({ 
                            ...newEnv, 
                            is_default: (e.target as HTMLInputElement).checked 
                          })}
                          class="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div>
                          <label htmlFor="is_default" class="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Set as default environment
                          </label>
                          <p class="text-xs text-gray-500 dark:text-gray-400">
                            New services will use this environment by default
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div class="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => setActiveTab('manage')}
                        class="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleCreateEnvironment}
                        disabled={!newEnv.name.trim() || loading === 'create'}
                        class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                      >
                        {loading === 'create' ? (
                          <>
                            <div class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>Creating...</span>
                          </>
                        ) : (
                          <>
                            <Save class="w-4 h-4" />
                            <span>Create Environment</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'templates' && (
              <div class="h-full overflow-y-auto p-6">
                <div class="text-center py-12">
                  <Settings class="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Environment Templates
                  </h3>
                  <p class="text-gray-600 dark:text-gray-400">
                    Templates feature coming soon. Create reusable environment configurations.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}