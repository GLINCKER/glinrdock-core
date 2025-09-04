import { useState } from "preact/hooks";
import { EnvironmentConfig, EnvironmentType } from "../types/environment";
import { ChevronDown, Plus, Settings, Copy, Trash2, AlertTriangle, CheckCircle, Clock, Zap } from "lucide-preact";

interface EnvironmentSwitcherProps {
  currentEnvironment: EnvironmentConfig;
  availableEnvironments: EnvironmentConfig[];
  onEnvironmentSwitch: (environmentId: string) => Promise<void>;
  onCreateEnvironment?: () => void;
  onManageEnvironments?: () => void;
  disabled?: boolean;
}

export function EnvironmentSwitcher({
  currentEnvironment,
  availableEnvironments,
  onEnvironmentSwitch,
  onCreateEnvironment,
  onManageEnvironments,
  disabled = false
}: EnvironmentSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);

  const getEnvironmentIcon = (type: EnvironmentType) => {
    switch (type) {
      case 'development': return <Zap class="w-4 h-4 text-green-500" />;
      case 'staging': return <Clock class="w-4 h-4 text-yellow-500" />;
      case 'production': return <CheckCircle class="w-4 h-4 text-red-500" />;
      case 'testing': return <Settings class="w-4 h-4 text-blue-500" />;
      default: return <Settings class="w-4 h-4 text-gray-500" />;
    }
  };

  const getEnvironmentColor = (type: EnvironmentType) => {
    switch (type) {
      case 'development': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-700';
      case 'staging': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700';
      case 'production': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 border-red-200 dark:border-red-700';
      case 'testing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-700';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300 border-gray-200 dark:border-gray-700';
    }
  };

  const handleEnvironmentSwitch = async (environmentId: string) => {
    if (environmentId === currentEnvironment.id) {
      setIsOpen(false);
      return;
    }

    setSwitching(environmentId);
    try {
      await onEnvironmentSwitch(environmentId);
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to switch environment:', error);
    } finally {
      setSwitching(null);
    }
  };

  return (
    <div class="relative">
      {/* Current Environment Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        class={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg border transition-all duration-200 ${
          getEnvironmentColor(currentEnvironment.type)
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}`}
      >
        {getEnvironmentIcon(currentEnvironment.type)}
        <span class="font-medium">{currentEnvironment.name}</span>
        <ChevronDown class={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Environment Dropdown */}
      {isOpen && (
        <div class="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 z-50">
          {/* Header */}
          <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-gray-900 dark:text-white">Switch Environment</h3>
              {onManageEnvironments && (
                <button
                  onClick={onManageEnvironments}
                  class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                >
                  Manage
                </button>
              )}
            </div>
          </div>

          {/* Environment List */}
          <div class="max-h-64 overflow-y-auto">
            {availableEnvironments.map((env) => (
              <button
                key={env.id}
                onClick={() => handleEnvironmentSwitch(env.id)}
                disabled={switching === env.id}
                class="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors disabled:opacity-50"
              >
                <div class="flex items-center space-x-3">
                  {switching === env.id ? (
                    <div class="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                  ) : (
                    getEnvironmentIcon(env.type)
                  )}
                  <div class="text-left">
                    <div class="flex items-center space-x-2">
                      <span class="text-sm font-medium text-gray-900 dark:text-white">
                        {env.name}
                      </span>
                      {env.is_default && (
                        <span class="text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 px-1.5 py-0.5 rounded">
                          default
                        </span>
                      )}
                    </div>
                    {env.description && (
                      <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {env.description}
                      </p>
                    )}
                  </div>
                </div>
                <div class="flex items-center space-x-2">
                  <span class={`text-xs px-2 py-1 rounded border font-medium ${getEnvironmentColor(env.type)}`}>
                    {env.type}
                  </span>
                  {env.id === currentEnvironment.id && (
                    <CheckCircle class="w-4 h-4 text-green-500" />
                  )}
                </div>
              </button>
            ))}
          </div>

          {/* Footer Actions */}
          <div class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {availableEnvironments.length} environment{availableEnvironments.length !== 1 ? 's' : ''}
            </div>
            {onCreateEnvironment && (
              <button
                onClick={onCreateEnvironment}
                class="inline-flex items-center space-x-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
              >
                <Plus class="w-3 h-3" />
                <span>New Environment</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div 
          class="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)} 
        />
      )}
    </div>
  );
}