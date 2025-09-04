import { useState } from "preact/hooks";
import { ServiceConfig } from "../../../api";
import { EnvironmentConfig, EnvironmentVariable, EnvironmentType } from "../../../types/environment";
import { EnvironmentSwitcher } from "../../../components/EnvironmentSwitcher";
import { EnvironmentManagementModal } from "../../../components/EnvironmentManagementModal";
import { KVPairs } from "../../../components/KVPairs";
import { ImpactBadge, FieldImpactIndicator } from "../../../components/ImpactBadge";
import { IMPACT_TYPES, getFieldImpact } from "../../../utils/changeImpact";
import { 
  Settings, 
  Eye, 
  EyeOff, 
  Plus, 
  AlertTriangle, 
  Copy, 
  Upload, 
  Download,
  Globe,
  Lock,
  ArrowRight
} from "lucide-preact";

interface MultiEnvironmentTabProps {
  config: ServiceConfig;
  canDeploy: boolean;
  currentEnvironment: EnvironmentConfig;
  availableEnvironments: EnvironmentConfig[];
  onEnvironmentSwitch: (environmentId: string) => Promise<void>;
  onCreateEnvironment: (config: Partial<EnvironmentConfig>) => Promise<EnvironmentConfig>;
  onUpdateEnvironment: (id: string, updates: Partial<EnvironmentConfig>) => Promise<EnvironmentConfig>;
  onDeleteEnvironment: (id: string) => Promise<void>;
  onDuplicateEnvironment: (id: string, name: string) => Promise<EnvironmentConfig>;
  updateConfig: (field: keyof ServiceConfig, value: any) => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;
}

export function MultiEnvironmentTab({
  config,
  canDeploy,
  currentEnvironment,
  availableEnvironments,
  onEnvironmentSwitch,
  onCreateEnvironment,
  onUpdateEnvironment,
  onDeleteEnvironment,
  onDuplicateEnvironment,
  updateConfig,
  showToast,
}: MultiEnvironmentTabProps) {
  const [showManagementModal, setShowManagementModal] = useState(false);
  const [envViewMode, setEnvViewMode] = useState('editor');
  const [showSecrets, setShowSecrets] = useState(false);
  const [showEnvFileUpload, setShowEnvFileUpload] = useState(false);
  const [envPasteValue, setEnvPasteValue] = useState('');

  // Get merged variables (inherited + direct)
  const getMergedVariables = () => {
    const merged: Record<string, EnvironmentVariable> = {};
    
    // Add inherited variables first
    if (currentEnvironment.inherit_from) {
      const parentEnv = availableEnvironments.find(env => env.id === currentEnvironment.inherit_from);
      if (parentEnv && parentEnv.variables) {
        Object.entries(parentEnv.variables).forEach(([key, value]) => {
          merged[key] = {
            key,
            value,
            is_secret: false,
            source: 'inherited',
            environment_id: parentEnv.id
          };
        });
      }
    }
    
    // Override with direct variables
    if (currentEnvironment.variables) {
      Object.entries(currentEnvironment.variables).forEach(([key, value]) => {
        merged[key] = {
          key,
          value,
          is_secret: false,
          source: merged[key] ? 'override' : 'direct',
          environment_id: currentEnvironment.id
        };
      });
    }
    
    // Add secrets (keys only, values handled securely)
    if (currentEnvironment.secrets) {
      Object.keys(currentEnvironment.secrets).forEach((key) => {
        merged[key] = {
          key,
          value: '••••••••',
          is_secret: true,
          source: 'direct',
          environment_id: currentEnvironment.id
        };
      });
    }
    
    return merged;
  };

  const mergedVariables = getMergedVariables();
  const variableCount = Object.keys(mergedVariables).length;
  const secretCount = Object.values(mergedVariables).filter(v => v.is_secret).length;
  const inheritedCount = Object.values(mergedVariables).filter(v => v.source === 'inherited').length;

  const handleVariableChange = (key: string, value: string) => {
    const newEnv = { ...config.env, [key]: value };
    updateConfig('env', newEnv);
  };

  const handleVariableDelete = (key: string) => {
    const { [key]: deleted, ...remaining } = config.env || {};
    updateConfig('env', remaining);
  };

  const exportEnvironmentFile = () => {
    const variables = Object.entries(mergedVariables)
      .filter(([, variable]) => !variable.is_secret)
      .map(([key, variable]) => `${key}=${variable.value}`)
      .join('\\n');
    
    const blob = new Blob([variables], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentEnvironment.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.env`;
    a.click();
    URL.revokeObjectURL(url);
    
    showToast('Environment file exported', 'success');
  };

  const parseEnvFile = (content: string) => {
    const lines = content.split('\\n').filter(line => line.trim() && !line.trim().startsWith('#'));
    const parsed: Record<string, string> = {};
    
    for (const line of lines) {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        parsed[key.trim()] = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
    
    return parsed;
  };

  const handleEnvFileImport = () => {
    try {
      const parsed = parseEnvFile(envPasteValue);
      updateConfig('env', { ...config.env, ...parsed });
      setEnvPasteValue('');
      setShowEnvFileUpload(false);
      showToast(`Imported ${Object.keys(parsed).length} variables`, 'success');
    } catch (error) {
      showToast('Failed to parse environment file', 'error');
    }
  };

  return (
    <div class="space-y-8">
      {/* Environment Header with Switcher */}
      <div class="bg-gradient-to-r from-emerald-50/90 via-green-50/80 to-teal-50/90 dark:from-emerald-900/20 dark:via-green-900/20 dark:to-teal-900/20 rounded-xl p-5 border border-emerald-200/50 dark:border-emerald-700/50">
        <div class="flex items-start justify-between">
          <div class="flex items-start space-x-3">
            <div class="flex-shrink-0">
              <AlertTriangle class="w-5 h-5 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Environment Variables
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-300 mb-3">
                Environment-specific configuration with inheritance support. 
                Variable changes may require application restart.
              </p>
              <div class="flex items-center space-x-4">
                <ImpactBadge impact={IMPACT_TYPES.app_restart} />
                <EnvironmentSwitcher
                  currentEnvironment={currentEnvironment}
                  availableEnvironments={availableEnvironments}
                  onEnvironmentSwitch={onEnvironmentSwitch}
                  onCreateEnvironment={() => setShowManagementModal(true)}
                  onManageEnvironments={() => setShowManagementModal(true)}
                  disabled={!canDeploy}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Environment Info Panel */}
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 p-6">
        <div class="flex items-center justify-between mb-4">
          <h4 class="text-base font-semibold text-gray-900 dark:text-white flex items-center">
            <Globe class="w-4 h-4 mr-2 text-gray-500" />
            Current Environment: {currentEnvironment.name}
          </h4>
          <div class="flex items-center space-x-3">
            <button
              onClick={() => setEnvViewMode(envViewMode === 'editor' ? 'preview' : 'editor')}
              class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
            >
              {envViewMode === 'editor' ? (
                <><Eye class="w-4 h-4 inline mr-1" />Preview</>
              ) : (
                <><Settings class="w-4 h-4 inline mr-1" />Edit</>
              )}
            </button>
            <button
              onClick={exportEnvironmentFile}
              class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              title="Export .env file"
            >
              <Download class="w-4 h-4 inline mr-1" />Export
            </button>
            <button
              onClick={() => setShowEnvFileUpload(true)}
              class="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
              title="Import .env file"
            >
              <Upload class="w-4 h-4 inline mr-1" />Import
            </button>
          </div>
        </div>

        {/* Environment Stats */}
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <div class="text-sm text-blue-600 dark:text-blue-400">Total Variables</div>
            <div class="text-xl font-semibold text-blue-800 dark:text-blue-300">{variableCount}</div>
          </div>
          <div class="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
            <div class="text-sm text-purple-600 dark:text-purple-400">Secrets</div>
            <div class="text-xl font-semibold text-purple-800 dark:text-purple-300">{secretCount}</div>
          </div>
          <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
            <div class="text-sm text-green-600 dark:text-green-400">Inherited</div>
            <div class="text-xl font-semibold text-green-800 dark:text-green-300">{inheritedCount}</div>
          </div>
          <div class="bg-gray-50 dark:bg-gray-700/50 p-3 rounded-lg">
            <div class="text-sm text-gray-600 dark:text-gray-400">Type</div>
            <div class="text-sm font-semibold text-gray-800 dark:text-gray-300 capitalize">{currentEnvironment.type}</div>
          </div>
        </div>

        {/* Inheritance Chain */}
        {currentEnvironment.inherit_from && (
          <div class="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
            <div class="flex items-center space-x-2 mb-2">
              <ArrowRight class="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <h5 class="text-sm font-medium text-amber-800 dark:text-amber-200">Inheritance Chain</h5>
            </div>
            <div class="text-xs text-amber-700 dark:text-amber-300">
              This environment inherits variables from{' '}
              <span class="font-medium">
                {availableEnvironments.find(env => env.id === currentEnvironment.inherit_from)?.name}
              </span>. 
              Local variables will override inherited ones with the same name.
            </div>
          </div>
        )}

        {/* Environment Variables */}
        {envViewMode === 'editor' ? (
          <div class="space-y-4">
            <div class="flex items-center justify-between">
              <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">Variables & Secrets</h5>
              <button
                onClick={() => setShowSecrets(!showSecrets)}
                class="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center space-x-1"
              >
                {showSecrets ? <EyeOff class="w-3 h-3" /> : <Eye class="w-3 h-3" />}
                <span>{showSecrets ? 'Hide' : 'Show'} secrets</span>
              </button>
            </div>
            
            <KVPairs
              value={config.env || {}}
              onChange={(env) => updateConfig('env', env)}
              disabled={!canDeploy}
              placeholder="Variable name (e.g., DATABASE_URL)"
              valuePlaceholder="Variable value"
              className="space-y-3"
            />
            
            {/* Variable List with Source Info */}
            {Object.keys(mergedVariables).length > 0 && (
              <div class="mt-6">
                <h6 class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                  All Variables ({Object.keys(mergedVariables).length})
                </h6>
                <div class="space-y-2 max-h-64 overflow-y-auto">
                  {Object.entries(mergedVariables).map(([key, variable]) => (
                    <div key={key} class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-xs">
                      <div class="flex items-center space-x-3">
                        <code class="bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded font-mono">
                          {key}
                        </code>
                        <span class="text-gray-600 dark:text-gray-400">
                          {variable.is_secret && !showSecrets ? '••••••••' : variable.value}
                        </span>
                      </div>
                      <div class="flex items-center space-x-2">
                        {variable.is_secret && (
                          <Lock class="w-3 h-3 text-purple-500" />
                        )}
                        <span class={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          variable.source === 'inherited' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                          variable.source === 'override' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                          'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        }`}>
                          {variable.source}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div class="space-y-2">
            <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">Environment File Preview</h5>
            <div class="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg font-mono text-xs">
              {Object.entries(mergedVariables)
                .filter(([, variable]) => !variable.is_secret || showSecrets)
                .map(([key, variable]) => (
                  <div key={key} class="flex">
                    <span class="text-gray-500 dark:text-gray-400"># {variable.source}</span>
                    <br />
                    <span>{key}={variable.is_secret && !showSecrets ? '••••••••' : variable.value}</span>
                    <br />
                  </div>
                ))
              }
            </div>
          </div>
        )}
      </div>

      {/* .env File Upload Modal */}
      {showEnvFileUpload && (
        <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full">
            <div class="p-6">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Import Environment Variables
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Paste your .env file content below. Variables will be merged with existing ones.
              </p>
              <textarea
                value={envPasteValue}
                onInput={(e) => setEnvPasteValue((e.target as HTMLTextAreaElement).value)}
                placeholder="DATABASE_URL=postgresql://...&#10;API_KEY=your-api-key&#10;PORT=3000"
                rows={8}
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white font-mono text-sm"
              />
              <div class="flex items-center justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowEnvFileUpload(false);
                    setEnvPasteValue('');
                  }}
                  class="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEnvFileImport}
                  disabled={!envPasteValue.trim()}
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import Variables
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Environment Management Modal */}
      <EnvironmentManagementModal
        isOpen={showManagementModal}
        onClose={() => setShowManagementModal(false)}
        environments={availableEnvironments}
        onCreateEnvironment={onCreateEnvironment}
        onUpdateEnvironment={onUpdateEnvironment}
        onDeleteEnvironment={onDeleteEnvironment}
        onDuplicateEnvironment={onDuplicateEnvironment}
      />
    </div>
  );
}