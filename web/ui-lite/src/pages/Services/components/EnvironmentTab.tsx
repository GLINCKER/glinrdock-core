import { useState, useEffect } from "preact/hooks";
import { ServiceConfig, ServiceEnvironment, apiClient } from "../../../api";
import { KVPairs } from "../../../components/KVPairs";
import { Settings, Eye, EyeOff, Trash2, Plus, Server, User, FileText, Edit3, Upload, ChevronDown, Lock, Tag, Shield, AlertTriangle } from "lucide-preact";
import { FieldImpactIndicator } from "../../../components/ImpactBadge";
import { getFieldImpact } from "../../../utils/changeImpact";

interface EnvironmentTabProps {
  config: ServiceConfig;
  canDeploy: boolean;
  envViewMode: string;
  showEnvFileUpload: boolean;
  envPasteValue: string;
  setEnvViewMode: (mode: string) => void;
  setShowEnvFileUpload: (show: boolean) => void;
  setEnvPasteValue: (value: string) => void;
  updateConfig: (field: keyof ServiceConfig, value: any) => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;
  serviceId: string;
}

export function EnvironmentTab({
  config,
  canDeploy,
  envViewMode,
  showEnvFileUpload,
  envPasteValue,
  setEnvViewMode,
  setShowEnvFileUpload,
  setEnvPasteValue,
  updateConfig,
  showToast,
  serviceId,
}: EnvironmentTabProps) {
  const [dockerEnv, setDockerEnv] = useState<ServiceEnvironment | null>(null);
  const [dockerEnvLoading, setDockerEnvLoading] = useState(true);
  const [dockerEnvError, setDockerEnvError] = useState<string | null>(null);

  // Fetch Docker environment variables
  useEffect(() => {
    const fetchDockerEnvironment = async () => {
      try {
        setDockerEnvLoading(true);
        setDockerEnvError(null);
        const env = await apiClient.getServiceEnvironment(serviceId);
        setDockerEnv(env);
      } catch (error) {
        console.error('Failed to fetch Docker environment:', error);
        setDockerEnvError(error instanceof Error ? error.message : 'Failed to fetch environment');
      } finally {
        setDockerEnvLoading(false);
      }
    };

    if (serviceId) {
      fetchDockerEnvironment();
    }
  }, [serviceId]);

  // Environment templates for common use cases
  const environmentTemplates = {
    nodejs: {
      name: "Node.js Application",
      variables: [
        { key: "NODE_ENV", value: "production", is_secret: false },
        { key: "PORT", value: "3000", is_secret: false },
        { key: "DATABASE_URL", value: "", is_secret: true },
        { key: "JWT_SECRET", value: "", is_secret: true },
        { key: "API_KEY", value: "", is_secret: true }
      ]
    },
    database: {
      name: "Database Service",
      variables: [
        { key: "MYSQL_ROOT_PASSWORD", value: "", is_secret: true },
        { key: "MYSQL_DATABASE", value: "app_db", is_secret: false },
        { key: "MYSQL_USER", value: "app_user", is_secret: false },
        { key: "MYSQL_PASSWORD", value: "", is_secret: true }
      ]
    },
    redis: {
      name: "Redis Cache",
      variables: [
        { key: "REDIS_URL", value: "redis://localhost:6379", is_secret: false },
        { key: "REDIS_PASSWORD", value: "", is_secret: true },
        { key: "REDIS_DB", value: "0", is_secret: false }
      ]
    },
    nginx: {
      name: "Web Server",
      variables: [
        { key: "NGINX_HOST", value: "localhost", is_secret: false },
        { key: "NGINX_PORT", value: "80", is_secret: false },
        { key: "SSL_CERT_PATH", value: "/etc/ssl/certs", is_secret: false },
        { key: "SSL_KEY_PATH", value: "/etc/ssl/private", is_secret: false }
      ]
    },
    api: {
      name: "API Service",
      variables: [
        { key: "API_URL", value: "", is_secret: false },
        { key: "API_KEY", value: "", is_secret: true },
        { key: "RATE_LIMIT", value: "100", is_secret: false },
        { key: "CORS_ORIGIN", value: "*", is_secret: false }
      ]
    }
  };

  // Apply environment template
  const applyEnvironmentTemplate = (templateKey: string, mode: 'add' | 'replace' = 'add') => {
    console.log('Applying template:', templateKey, 'mode:', mode);
    const template = environmentTemplates[templateKey as keyof typeof environmentTemplates];
    if (template) {
      let newVars: any[];
      
      if (mode === 'replace') {
        // Replace all existing variables with template variables
        newVars = [...template.variables];
      } else {
        // Add template variables to existing ones (default behavior)
        newVars = [...(config.env || [])];
        template.variables.forEach(templateVar => {
          // Only add if key doesn't already exist
          const exists = newVars.some(existing => existing.key === templateVar.key);
          if (!exists) {
            newVars.push(templateVar);
          }
        });
      }
      
      console.log('New variables after template:', newVars);
      updateConfig("env", newVars);
      
      const actionText = mode === 'replace' ? 'Replaced with' : 'Applied';
      showToast(`${actionText} ${template.name} template`, "success");
    } else {
      console.warn('Template not found:', templateKey);
    }
  };

  // Convert env array to dotenv format for bulk editing
  const envToDotenvFormat = (envVars: any[]) => {
    if (!envVars || envVars.length === 0) {
      return '# No environment variables configured\n# Add variables in KEY=VALUE format';
    }
    return envVars
      .map(env => {
        if (!env || !env.key) return '';
        if (env.is_secret && env.value === "******") {
          return `${env.key}=# [HIDDEN SECRET - edit individually to change]`;
        }
        // Escape values with spaces or special characters
        const needsQuotes = env.value && (env.value.includes(' ') || env.value.includes('#') || env.value.includes('='));
        const value = needsQuotes ? `"${env.value.replace(/"/g, '\\"')}"` : (env.value || '');
        return `${env.key}=${value}`;
      })
      .filter(line => line.length > 0)
      .join('\n');
  };

  // Parse dotenv format back to env array
  const dotenvFormatToEnv = (dotenvText: string) => {
    const lines = dotenvText.split('\n');
    const newVars: any[] = [];
    
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const equalIndex = trimmed.indexOf('=');
        if (equalIndex > 0) {
          const key = trimmed.substring(0, equalIndex).trim();
          let value = trimmed.substring(equalIndex + 1).trim();
          
          // Remove surrounding quotes if present
          if ((value.startsWith('"') && value.endsWith('"')) || 
              (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          
          // Skip hidden secrets
          if (value.startsWith('# [HIDDEN SECRET')) {
            return;
          }
          
          const isSecret = /password|secret|key|token|api_key|private/i.test(key.toLowerCase());
          newVars.push({
            key: key,
            value: value,
            is_secret: isSecret,
          });
        }
      }
    });
    
    return newVars;
  };

  // Bulk edit state
  const [bulkEditText, setBulkEditText] = useState("");
  const [showBulkEditor, setShowBulkEditor] = useState(false);
  
  // Template selector state
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  
  // Initialize bulk edit text when switching to bulk mode
  const handleViewModeChange = (mode: string) => {
    console.log('Switching view mode to:', mode, 'from:', envViewMode);
    console.log('Current config.env:', config.env);
    
    if (mode === "bulk" && envViewMode !== "bulk") {
      const dotenvText = envToDotenvFormat(config.env || []);
      console.log('Generated dotenv text:', dotenvText);
      setBulkEditText(dotenvText);
      setShowBulkEditor(true);
    } else if (mode === "form") {
      setShowBulkEditor(false);
    }
    setEnvViewMode(mode);
  };

  // Apply bulk edit changes
  const applyBulkEdit = () => {
    try {
      const newEnvVars = dotenvFormatToEnv(bulkEditText);
      
      // Preserve existing secret values that weren't edited
      const preservedVars = config.env.filter(existing => 
        existing.is_secret && existing.value === "******"
      );
      
      preservedVars.forEach(preserved => {
        const newVar = newEnvVars.find(nv => nv.key === preserved.key);
        if (!newVar) {
          newEnvVars.push(preserved);
        }
      });
      
      updateConfig("env", newEnvVars);
      showToast("Environment variables updated successfully", "success");
    } catch (error) {
      showToast("Error parsing environment variables", "error");
    }
  };
  return (
    <div class="space-y-8">
      {/* Environment Header & Controls */}
      <div class="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-6 rounded-xl border border-green-200/50 dark:border-green-700/50">
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div class="flex items-center justify-between">
              <div>
                <h3 class="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
                  <Shield class="w-6 h-6 mr-2 text-green-500" />
                  Environment Variables
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Secure configuration management for your service
                </p>
              </div>
              
              {/* Impact Indicator */}
              <div class="flex items-center">
                <FieldImpactIndicator 
                  impact={getFieldImpact('environment', config.environment, config.environment)}
                  className="mr-2"
                />
                <span class="text-xs text-gray-500 dark:text-gray-400">
                  Change Impact
                </span>
              </div>
            </div>
          </div>
          <div class="flex items-center gap-3 flex-wrap">
            {/* View Mode Selector - Improved */}
            <div class="flex bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-1">
              {[
                {
                  id: "form",
                  name: "Form View",
                  icon: FileText,
                  description: "Individual field editing with security controls"
                },
                {
                  id: "bulk",
                  name: "Bulk Edit",
                  icon: Edit3,
                  description: "Textarea editor for multiple variables (.env format)"
                }
              ].map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => handleViewModeChange(mode.id)}
                  class={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 flex items-center ${
                    envViewMode === mode.id
                      ? "bg-green-500 text-white shadow-sm"
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                  title={mode.description}
                >
                  <mode.icon class="w-3 h-3 mr-1" />
                  {mode.name}
                </button>
              ))}
            </div>

            {/* Environment Templates - Improved */}
            <div class="relative">
              <button
                onClick={() => {
                  console.log('Template button clicked, current state:', showTemplateSelector);
                  setShowTemplateSelector(!showTemplateSelector);
                }}
                class="appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center"
              >
                Load Template...
                <ChevronDown class="ml-2 w-3 h-3" />
              </button>
            </div>

            {/* Actions */}
            <button
              onClick={() =>
                setShowEnvFileUpload(!showEnvFileUpload)
              }
              class="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
            >
              <Upload class="w-4 h-4 mr-1.5" />
              Import .env
            </button>
          </div>
        </div>
      </div>

      {/* .env File Import */}
      {showEnvFileUpload && (
        <div class="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200/50 dark:border-blue-700/50 p-6">
          <h4 class="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <FileText class="w-4 h-4 mr-2 text-blue-500" />
            Import Environment File
          </h4>
          <div class="space-y-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Paste .env content or upload file
              </label>
              <textarea
                value={envPasteValue}
                onChange={(e) =>
                  setEnvPasteValue(
                    (e.target as HTMLTextAreaElement).value
                  )
                }
                class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={6}
                placeholder={`DATABASE_URL=postgresql://user:pass@localhost/db
API_KEY=your-secret-key
DEBUG=true
PORT=3000
# Comments are supported
NODE_ENV=production`}
              />
            </div>
            <div class="flex items-center justify-between">
              <div class="text-xs text-gray-500 dark:text-gray-400">
                Supports standard .env format with KEY=VALUE pairs
              </div>
              <div class="flex gap-2">
                <button
                  onClick={() => {
                    setShowEnvFileUpload(false);
                    setEnvPasteValue("");
                  }}
                  class="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    // Parse .env format
                    const lines = envPasteValue.split("\n");
                    const newVars: any[] = [];

                    lines.forEach((line) => {
                      const trimmed = line.trim();
                      if (trimmed && !trimmed.startsWith("#")) {
                        const [key, ...valueParts] =
                          trimmed.split("=");
                        if (key && valueParts.length > 0) {
                          const value = valueParts
                            .join("=")
                            .replace(/^["']|["']$/g, "");
                          const isSecret =
                            /password|secret|key|token|api_key|private/i.test(
                              key
                            );
                          newVars.push({
                            key: key.trim(),
                            value,
                            is_secret: isSecret,
                          });
                        }
                      }
                    });

                    // Update config with parsed variables
                    if (newVars.length > 0) {
                      updateConfig("env", [
                        ...config.env,
                        ...newVars,
                      ]);
                      showToast(
                        `Imported ${newVars.length} environment variables`,
                        "success"
                      );
                    }

                    setShowEnvFileUpload(false);
                    setEnvPasteValue("");
                  }}
                  disabled={!envPasteValue.trim()}
                  class="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Import Variables
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Environment Variables Editor */}
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <h4 class="text-base font-semibold text-gray-900 dark:text-white flex items-center">
              <Settings class="w-4 h-4 mr-2 text-gray-500" />
              Variables ({(config.env || []).length})
            </h4>
          </div>
        </div>

        <div class="p-6">
          {envViewMode === "form" && (
            <div class="space-y-3">
              {(config.env || []).length > 0 ? (
                (config.env || []).map((envVar, index) => (
                  <div
                    key={index}
                    class={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 ${
                      envVar.is_secret
                        ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/50"
                        : "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600"
                    }`}
                  >
                    {/* Variable Type Icon */}
                    <div
                      class={`p-2 rounded-lg ${
                        envVar.is_secret
                          ? "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                          : "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
                      }`}
                    >
                      {envVar.is_secret ? (
                        <Lock class="w-4 h-4" />
                      ) : (
                        <Tag class="w-4 h-4" />
                      )}
                    </div>

                    {/* Key Input */}
                    <div class="flex-1">
                      <input
                        type="text"
                        value={envVar.key}
                        onChange={(e) => {
                          const newEnv = [...config.env];
                          newEnv[index] = {
                            ...envVar,
                            key: (e.target as HTMLInputElement)
                              .value,
                          };
                          updateConfig("env", newEnv);
                        }}
                        disabled={!canDeploy}
                        class="w-full px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                        placeholder="VARIABLE_NAME"
                      />
                    </div>

                    {/* Value Input */}
                    <div class="flex-1">
                      <input
                        type={
                          envVar.is_secret ? "password" : "text"
                        }
                        value={envVar.value}
                        onChange={(e) => {
                          const newEnv = [...config.env];
                          newEnv[index] = {
                            ...envVar,
                            value: (e.target as HTMLInputElement)
                              .value,
                          };
                          updateConfig("env", newEnv);
                        }}
                        disabled={!canDeploy}
                        class="w-full px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50"
                        placeholder="value"
                      />
                    </div>

                    {/* Security Controls */}
                    <div class="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const newEnv = [...config.env];
                          newEnv[index] = {
                            ...envVar,
                            is_secret: !envVar.is_secret,
                          };
                          updateConfig("env", newEnv);
                        }}
                        class={`p-1.5 rounded transition-colors ${
                          envVar.is_secret
                            ? "text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
                            : "text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30"
                        }`}
                        title="Toggle secret"
                      >
                        {envVar.is_secret ? (
                          <EyeOff class="w-4 h-4" />
                        ) : (
                          <Eye class="w-4 h-4" />
                        )}
                      </button>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={() => {
                        const newEnv = config.env.filter(
                          (_, i) => i !== index
                        );
                        updateConfig("env", newEnv);
                      }}
                      disabled={!canDeploy}
                      class="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors disabled:opacity-50"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                ))
              ) : (
                <div class="text-center py-8">
                  <div class="text-gray-500 dark:text-gray-400 mb-4">
                    No environment variables configured
                  </div>
                  <p class="text-sm text-gray-400 dark:text-gray-500">
                    Add your first environment variable or load a template to get started
                  </p>
                </div>
              )}

              {/* Add New Variable */}
              <button
                onClick={() => {
                  const newEnv = [
                    ...(config.env || []),
                    { key: "", value: "", is_secret: false },
                  ];
                  updateConfig("env", newEnv);
                }}
                disabled={!canDeploy}
                class="w-full p-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 hover:border-green-400 dark:hover:border-green-500 hover:text-green-600 dark:hover:text-green-400 transition-colors disabled:opacity-50 flex items-center justify-center"
              >
                <Plus class="w-4 h-4 mr-2" />
                Add Environment Variable
              </button>
            </div>
          )}

          {envViewMode === "bulk" && (
            <div class="space-y-4">
              <div class="bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700/50 p-4">
                <div class="flex items-start gap-3">
                  <div class="p-1 rounded-full bg-amber-100 dark:bg-amber-900/30">
                    <AlertTriangle class="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h5 class="text-sm font-medium text-amber-800 dark:text-amber-200">
                      Bulk Edit Mode
                    </h5>
                    <p class="text-sm text-amber-700 dark:text-amber-300 mt-1">
                      Edit environment variables in .env format. Hidden secrets will be preserved unless explicitly changed.
                    </p>
                  </div>
                </div>
              </div>

              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Environment Variables (.env format)
                  </label>
                  <div class="flex gap-2">
                    <button
                      onClick={() => setBulkEditText(envToDotenvFormat(config.env))}
                      class="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Reset to Current
                    </button>
                  </div>
                </div>
                
                <textarea
                  value={bulkEditText}
                  onChange={(e) => setBulkEditText((e.target as HTMLTextAreaElement).value)}
                  class="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none"
                  rows={Math.max(8, Math.min(20, bulkEditText.split('\n').length + 2))}
                  placeholder="DATABASE_URL=postgresql://user:pass@localhost/db
API_KEY=your-secret-key-here
NODE_ENV=production
PORT=3000

# Comments are supported
# Use KEY=VALUE format, one per line"
                  disabled={!canDeploy}
                />
                
                <div class="flex items-center justify-between">
                  <div class="text-xs text-gray-500 dark:text-gray-400 space-y-1">
                    <div>• Lines starting with # are comments</div>
                    <div>• Use KEY=VALUE format</div>
                    <div>• Hidden secrets shown as "[HIDDEN SECRET - edit individually to change]"</div>
                  </div>
                  <div class="flex gap-2">
                    <button
                      onClick={() => {
                        setBulkEditText(envToDotenvFormat(config.env));
                        showToast("Reset to current values", "info");
                      }}
                      class="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      Reset
                    </button>
                    <button
                      onClick={applyBulkEdit}
                      disabled={!canDeploy || !bulkEditText.trim()}
                      class="px-4 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    >
                      <Edit3 class="w-3 h-3 mr-1" />
                      Apply Changes
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Template Selector Modal */}
      {showTemplateSelector && (
        <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 mb-8">
          <div class="p-6 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between">
              <h4 class="text-base font-semibold text-gray-900 dark:text-white flex items-center">
                <FileText class="w-4 h-4 mr-2 text-purple-500" />
                Environment Templates
              </h4>
              <button
                onClick={() => setShowTemplateSelector(false)}
                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Choose a template to quickly set up common environment configurations
            </p>
          </div>

          <div class="p-6">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(environmentTemplates).map(([key, template]) => (
                <div
                  key={key}
                  class="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:border-purple-300 dark:hover:border-purple-500 transition-colors"
                >
                  <div class="flex items-center justify-between mb-3">
                    <h5 class="font-medium text-gray-900 dark:text-white">
                      {template.name}
                    </h5>
                    <div class="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full">
                      {template.variables.length} vars
                    </div>
                  </div>
                  
                  <div class="space-y-2 mb-4">
                    {template.variables.slice(0, 3).map((variable, index) => (
                      <div key={index} class="flex items-center text-xs">
                        {variable.is_secret ? (
                          <Lock class="w-3 h-3 mr-1.5 text-red-400" />
                        ) : (
                          <Tag class="w-3 h-3 mr-1.5 text-blue-400" />
                        )}
                        <code class="text-gray-600 dark:text-gray-300">
                          {variable.key}
                        </code>
                      </div>
                    ))}
                    {template.variables.length > 3 && (
                      <div class="text-xs text-gray-400">
                        +{template.variables.length - 3} more variables
                      </div>
                    )}
                  </div>

                  <div class="flex gap-2">
                    <button
                      onClick={() => {
                        applyEnvironmentTemplate(key, 'add');
                        setShowTemplateSelector(false);
                      }}
                      class="flex-1 px-3 py-1.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-md hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                    >
                      Add Variables
                    </button>
                    <button
                      onClick={() => {
                        applyEnvironmentTemplate(key, 'replace');
                        setShowTemplateSelector(false);
                      }}
                      class="flex-1 px-3 py-1.5 text-xs bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-md hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
                    >
                      Replace All
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Docker Environment Variables */}
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
          <h4 class="text-base font-semibold text-gray-900 dark:text-white flex items-center">
            <Server class="w-4 h-4 mr-2 text-gray-500" />
            Docker Environment Variables
          </h4>
          <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Environment variables from the running Docker container
          </p>
        </div>

        <div class="p-6">
          {dockerEnvLoading ? (
            <div class="flex items-center justify-center py-8">
              <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
              <span class="ml-2 text-gray-600 dark:text-gray-400">Loading environment...</span>
            </div>
          ) : dockerEnvError ? (
            <div class="text-center py-8">
              <div class="text-red-500 dark:text-red-400 mb-2">
                Failed to load Docker environment
              </div>
              <div class="text-sm text-gray-500 dark:text-gray-400">
                {dockerEnvError}
              </div>
            </div>
          ) : dockerEnv ? (
            <div class="space-y-6">
              {/* System Environment Variables */}
              {Object.keys(dockerEnv.system_env).length > 0 && (
                <div>
                  <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                    <Server class="w-3 h-3 mr-1.5 text-orange-500" />
                    System Variables ({Object.keys(dockerEnv.system_env).length})
                  </h5>
                  <div class="space-y-2 max-h-64 overflow-y-auto">
                    {Object.entries(dockerEnv.system_env).map(([key, value]) => (
                      <div
                        key={key}
                        class="flex items-center gap-3 p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700/50"
                      >
                        <div class="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
                          <Settings class="w-3 h-3" />
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="font-mono text-sm font-medium text-gray-900 dark:text-white">
                            {key}
                          </div>
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="font-mono text-sm text-gray-600 dark:text-gray-300 truncate">
                            {value}
                          </div>
                        </div>
                        <div class="text-xs text-orange-600 dark:text-orange-400 px-2 py-1 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                          Read-only
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* User Environment Variables from Docker */}
              {Object.keys(dockerEnv.user_env).length > 0 && (
                <div>
                  <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                    <User class="w-3 h-3 mr-1.5 text-blue-500" />
                    User Variables from Container ({Object.keys(dockerEnv.user_env).length})
                  </h5>
                  <div class="space-y-2 max-h-64 overflow-y-auto">
                    {Object.entries(dockerEnv.user_env).map(([key, value]) => (
                      <div
                        key={key}
                        class="flex items-center gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50"
                      >
                        <div class="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                          <User class="w-3 h-3" />
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="font-mono text-sm font-medium text-gray-900 dark:text-white">
                            {key}
                          </div>
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="font-mono text-sm text-gray-600 dark:text-gray-300 truncate">
                            {value}
                          </div>
                        </div>
                        <div class="text-xs text-blue-600 dark:text-blue-400 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                          Live
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {Object.keys(dockerEnv.system_env).length === 0 && Object.keys(dockerEnv.user_env).length === 0 && (
                <div class="text-center py-8 text-gray-500 dark:text-gray-400">
                  No environment variables found in container
                </div>
              )}
            </div>
          ) : (
            <div class="text-center py-8 text-gray-500 dark:text-gray-400">
              Container not available for environment inspection
            </div>
          )}
        </div>
      </div>
    </div>
  );
}