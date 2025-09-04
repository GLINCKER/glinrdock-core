import { ServiceConfig } from "../../../api";
import { ImpactBadge, FieldImpactIndicator } from "../../../components/ImpactBadge";
import { IMPACT_TYPES, getFieldImpact } from "../../../utils/changeImpact";
import { AlertTriangle } from "lucide-preact";
import { useState } from "preact/hooks";

interface ConfigTabProps {
  config: ServiceConfig;
  originalConfig?: ServiceConfig;
  hasChanges: boolean;
  saveLoading: boolean;
  canDeploy: boolean;
  saveConfig: () => Promise<void>;
  updateConfig: (field: keyof ServiceConfig, value: any) => void;
  handleTabChange: (tab: string) => void;
}

export function ConfigTab({
  config,
  originalConfig,
  hasChanges,
  saveLoading,
  canDeploy,
  saveConfig,
  updateConfig,
  handleTabChange,
}: ConfigTabProps) {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [destructiveChanges, setDestructiveChanges] = useState<string[]>([]);

  const analyzeChanges = () => {
    if (!originalConfig) return [];
    
    const changes: string[] = [];
    
    // Check for destructive changes
    if (originalConfig.name !== config.name) {
      changes.push("Service name change will recreate the container");
    }
    
    if (originalConfig.image !== config.image) {
      changes.push("Image change will recreate the container and pull new image");
    }
    
    // Compare ports (simplified comparison for now)
    if (JSON.stringify(originalConfig.ports) !== JSON.stringify(config.ports)) {
      changes.push("Port changes will recreate the container");
    }
    
    // Compare volumes (simplified comparison for now)
    if (JSON.stringify(originalConfig.volumes) !== JSON.stringify(config.volumes)) {
      changes.push("Volume changes will recreate the container");
    }
    
    // Compare environment variables
    if (JSON.stringify(originalConfig.env) !== JSON.stringify(config.env)) {
      changes.push("Environment variable changes will recreate the container");
    }
    
    return changes;
  };

  const handleSaveClick = async () => {
    const changes = analyzeChanges();
    
    if (changes.length > 0) {
      setDestructiveChanges(changes);
      setShowConfirmDialog(true);
    } else {
      // No destructive changes, save directly
      await saveConfig();
    }
  };

  const handleConfirmSave = async () => {
    setShowConfirmDialog(false);
    await saveConfig();
  };
  return (
    <div class="space-y-8">
      {/* Header with Impact Warning */}
      <div class="bg-gradient-to-r from-orange-50/90 via-red-50/80 to-pink-50/90 dark:from-orange-900/20 dark:via-red-900/20 dark:to-pink-900/20 rounded-xl p-5 border border-orange-200/50 dark:border-orange-700/50">
        <div class="flex items-start justify-between">
          <div class="flex items-start space-x-3">
            <div class="flex-shrink-0">
              <AlertTriangle class="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Service Configuration
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-300 mb-3">
                Configuration changes have varying impacts. Image changes require full rebuild, 
                while basic settings typically need container restart.
              </p>
              <div class="flex items-center space-x-4">
                <ImpactBadge impact={IMPACT_TYPES.app_restart} showTooltip />
                <span class="text-xs text-gray-500 dark:text-gray-400">Typical Impact</span>
              </div>
            </div>
          </div>
          {hasChanges && (
            <button
              onClick={handleSaveClick}
              disabled={saveLoading}
              class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white text-sm font-medium rounded-lg transition-all duration-200 hover:scale-105 shadow-lg hover:shadow-green-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saveLoading ? (
                <>
                  <div class="w-4 h-4 mr-2 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <svg
                    class="w-4 h-4 mr-2"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          )}
        </div>
      </div>


      {/* Basic Configuration */}
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 p-6">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <svg
            class="w-4 h-4 mr-2 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
            />
          </svg>
          Basic Settings
        </h4>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center justify-between">
              <span>
                Service Name *
                <span class="text-xs text-gray-500 ml-1">
                  (must be unique)
                </span>
              </span>
              <FieldImpactIndicator impact={getFieldImpact('name', '', '')} />
            </label>
            <input
              type="text"
              value={config.name}
              onChange={(e) =>
                updateConfig(
                  "name",
                  (e.target as HTMLInputElement).value
                )
              }
              disabled={!canDeploy}
              class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              placeholder="e.g., my-postgres-db"
            />
            {!config.name.trim() && (
              <p class="text-xs text-red-500 flex items-center mt-1">
                <svg
                  class="w-3 h-3 mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Service name is required
              </p>
            )}
            <p class="text-xs text-orange-600 dark:text-orange-400 flex items-center">
              <AlertTriangle class="w-3 h-3 mr-1" />
              Changing service name requires container restart
            </p>
          </div>
          <div class="space-y-2">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center justify-between">
              <span>
                Container Image *
                <span class="text-xs text-gray-500 ml-1">
                  (repository:tag)
                </span>
              </span>
              <FieldImpactIndicator impact={getFieldImpact('image', '', '')} />
            </label>
            <input
              type="text"
              value={config.image}
              onChange={(e) =>
                updateConfig(
                  "image",
                  (e.target as HTMLInputElement).value
                )
              }
              disabled={!canDeploy}
              class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
              placeholder="e.g., postgres:15-alpine"
            />
            {!config.image.trim() && (
              <p class="text-xs text-red-500 flex items-center mt-1">
                <svg
                  class="w-3 h-3 mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                Container image is required
              </p>
            )}
            <p class="text-xs text-red-600 dark:text-red-400 flex items-center">
              <AlertTriangle class="w-3 h-3 mr-1" />
              Changing container image requires full rebuild (longest downtime)
            </p>
          </div>
        </div>
      </div>

      {/* Description */}
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50 p-6">
        <h4 class="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <svg
            class="w-4 h-4 mr-2 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h7"
            />
          </svg>
          Documentation
        </h4>
        <div class="space-y-2">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center justify-between">
            <span>
              Service Description
              <span class="text-xs text-gray-500 ml-1">
                (optional)
              </span>
            </span>
            <FieldImpactIndicator impact={getFieldImpact('description', '', '')} />
          </label>
          <textarea
            value={config.description || ""}
            onChange={(e) =>
              updateConfig(
                "description",
                (e.target as HTMLTextAreaElement).value
              )
            }
            disabled={!canDeploy}
            rows={4}
            class="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 resize-y"
            placeholder="Describe what this service does, its purpose, and any important notes..."
          />
          <div class="space-y-1">
            <p class="text-xs text-gray-500">
              Good documentation helps your team understand this
              service's role in your infrastructure.
            </p>
            <p class="text-xs text-green-600 dark:text-green-400 flex items-center">
              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Description changes have no impact on running services
            </p>
          </div>
        </div>
      </div>

      {/* Advanced Configuration Preview */}
      <div class="bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 rounded-xl border border-orange-200/50 dark:border-orange-700/50 p-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center">
            <svg
              class="w-5 h-5 mr-2 text-orange-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h4 class="text-sm font-medium text-gray-900 dark:text-white">
                Advanced Configuration
              </h4>
              <p class="text-xs text-gray-600 dark:text-gray-400">
                Environment variables, ports, and volumes are
                managed in separate tabs
              </p>
            </div>
          </div>
          <div class="flex space-x-2">
            <button
              onClick={() => handleTabChange("env")}
              class="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/30 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
            >
              Environment
            </button>
            <button
              onClick={() => handleTabChange("ports")}
              class="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/30 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
            >
              Ports
            </button>
            <button
              onClick={() => handleTabChange("volumes")}
              class="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-100 dark:text-purple-300 dark:bg-purple-900/30 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors"
            >
              Volumes
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 max-w-md w-full p-6 shadow-2xl">
            <div class="flex items-start mb-4">
              <div class="flex-shrink-0">
                <AlertTriangle class="w-6 h-6 text-red-500" />
              </div>
              <div class="ml-3">
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                  Confirm Destructive Changes
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  These changes will recreate the container and any data not stored in volumes will be lost:
                </p>
              </div>
            </div>

            <div class="mb-4">
              <ul class="space-y-2">
                {destructiveChanges.map((change, index) => (
                  <li key={index} class="flex items-start text-sm text-gray-700 dark:text-gray-300">
                    <span class="inline-block w-1.5 h-1.5 bg-red-500 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                    {change}
                  </li>
                ))}
              </ul>
            </div>

            <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mb-4">
              <p class="text-sm text-yellow-800 dark:text-yellow-200">
                💡 <strong>Tip:</strong> Use volume mounts to persist data across container recreations.
              </p>
            </div>

            <div class="flex justify-end space-x-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                class="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSave}
                class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Continue & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}