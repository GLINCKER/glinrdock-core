import { useState } from "preact/hooks";
import { PendingChange, getCombinedImpact, formatFieldName, formatChangeValue } from "../utils/changeImpact";
import { X, AlertTriangle, Zap, RotateCcw, Box, Wrench } from "lucide-preact";

interface PendingChangesPanelProps {
  changes: PendingChange[];
  onApplyChanges: () => void;
  onCancelChanges: () => void;
  onRemoveChange: (field: string) => void;
  isApplying: boolean;
  containerUptime?: string;
}

export function PendingChangesPanel({
  changes,
  onApplyChanges,
  onCancelChanges,
  onRemoveChange,
  isApplying,
  containerUptime = "Unknown"
}: PendingChangesPanelProps) {
  const [showConfirmation, setShowConfirmation] = useState(false);
  
  if (changes.length === 0) return null;

  const combinedImpact = getCombinedImpact(changes);
  
  const getImpactIcon = (type: string) => {
    switch (type) {
      case 'hot_reload': return <Zap class="w-4 h-4" />;
      case 'app_restart': return <RotateCcw class="w-4 h-4" />;
      case 'container_restart': return <Box class="w-4 h-4" />;
      case 'image_rebuild': return <Wrench class="w-4 h-4" />;
      default: return <AlertTriangle class="w-4 h-4" />;
    }
  };

  const renderIcon = (iconName: string, className: string = "w-4 h-4") => {
    switch (iconName) {
      case 'zap': return <Zap class={className} />;
      case 'rotate-ccw': return <RotateCcw class={className} />;
      case 'box': return <Box class={className} />;
      case 'wrench': return <Wrench class={className} />;
      default: return <AlertTriangle class={className} />;
    }
  };

  const getImpactDisplay = (type: string) => {
    switch (type) {
      case 'hot_reload': return 'Hot Reload';
      case 'app_restart': return 'App Restart';
      case 'container_restart': return 'Container Restart';
      case 'image_rebuild': return 'Image Rebuild';
      default: return 'Unknown Impact';
    }
  };

  const ConfirmationDialog = () => (
    <div class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div class="bg-white dark:bg-gray-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
        <div class="flex items-center mb-4">
          <div class={`p-2 rounded-lg ${combinedImpact.bgColor} mr-3`}>
            {getImpactIcon(combinedImpact.type)}
          </div>
          <div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              Confirm Changes
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              {getImpactDisplay(combinedImpact.type)} - {combinedImpact.downtime}
            </p>
          </div>
        </div>

        <div class={`p-4 rounded-lg ${combinedImpact.bgColor} border ${combinedImpact.borderColor} mb-4`}>
          <div class="flex items-center mb-2">
            <AlertTriangle class="w-4 h-4 text-orange-500 mr-2" />
            <span class="font-medium text-gray-900 dark:text-white">Impact Warning</span>
          </div>
          <p class="text-sm text-gray-700 dark:text-gray-300 mb-2">
            {combinedImpact.description}
          </p>
          <div class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
            <div>• Current uptime: <span class="font-mono">{containerUptime}</span></div>
            <div>• Expected downtime: <span class="font-mono">{combinedImpact.downtime}</span></div>
            {combinedImpact.requiresRestart && <div>• Service will be temporarily unavailable</div>}
          </div>
        </div>

        <div class="flex justify-end space-x-3">
          <button
            onClick={() => setShowConfirmation(false)}
            class="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setShowConfirmation(false);
              onApplyChanges();
            }}
            class={`px-4 py-2 text-white rounded-lg font-medium flex items-center transition-colors ${
              combinedImpact.severity === 'critical' 
                ? 'bg-red-600 hover:bg-red-700'
                : combinedImpact.severity === 'high'
                ? 'bg-orange-600 hover:bg-orange-700' 
                : combinedImpact.severity === 'medium'
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {getImpactIcon(combinedImpact.type)}
            <span class="ml-2">Apply Changes</span>
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Floating Panel */}
      <div class="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 shadow-2xl z-40 animate-slide-up">
        <div class="max-w-7xl mx-auto p-4">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center">
              <div class={`p-2 rounded-lg ${combinedImpact.bgColor} mr-3`}>
                {getImpactIcon(combinedImpact.type)}
              </div>
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                  Pending Changes ({changes.length})
                </h3>
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  {getImpactDisplay(combinedImpact.type)} - {combinedImpact.downtime}
                </p>
              </div>
            </div>
            <button
              onClick={onCancelChanges}
              class="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              title="Cancel all changes"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          {/* Changes List */}
          <div class="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 mb-4">
            {changes.map((change) => (
              <div
                key={change.field}
                class={`p-3 rounded-lg border ${change.impact.borderColor} ${change.impact.bgColor} relative group`}
              >
                <div class="flex items-center justify-between mb-2">
                  <div class="flex items-center">
                    <div class="mr-2">{renderIcon(change.impact.icon, "w-4 h-4")}</div>
                    <span class="font-medium text-sm text-gray-900 dark:text-white">
                      {formatFieldName(change.field)}
                    </span>
                  </div>
                  <button
                    onClick={() => onRemoveChange(change.field)}
                    class="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-red-500 rounded transition-all"
                    title="Remove this change"
                  >
                    <X class="w-3 h-3" />
                  </button>
                </div>
                <div class="text-xs text-gray-600 dark:text-gray-400">
                  {formatChangeValue(change.field, change.oldValue, change.newValue)}
                </div>
                <div class={`text-xs ${change.impact.color} font-medium`}>
                  {change.impact.downtime}
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div class="flex items-center justify-between">
            <div class="text-xs text-gray-500 dark:text-gray-400">
              Changes will be applied in order of impact severity
            </div>
            <div class="flex space-x-3">
              <button
                onClick={onCancelChanges}
                class="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
              >
                Cancel All
              </button>
              <button
                onClick={() => setShowConfirmation(true)}
                disabled={isApplying}
                class={`px-6 py-2 text-white rounded-lg font-medium flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                  combinedImpact.severity === 'critical' 
                    ? 'bg-red-600 hover:bg-red-700'
                    : combinedImpact.severity === 'high'
                    ? 'bg-orange-600 hover:bg-orange-700' 
                    : combinedImpact.severity === 'medium'
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isApplying ? (
                  <>
                    <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    Applying...
                  </>
                ) : (
                  <>
                    {getImpactIcon(combinedImpact.type)}
                    <span class="ml-2">Apply Changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmation && <ConfirmationDialog />}
      
      {/* CSS for slide-up animation */}
      <style>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}