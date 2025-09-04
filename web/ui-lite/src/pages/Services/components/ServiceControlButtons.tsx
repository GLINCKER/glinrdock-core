import { apiClient } from "../../../api";
import { Play, Square, RotateCcw, Lock } from "lucide-preact";

interface ServiceControlButtonsProps {
  serviceId: string;
  serviceStatus: string;
  canDeploy: boolean;
  actionLoading: string | null;
  onActionStart: (action: string) => void;
  onActionComplete: (action: string, success: boolean) => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;
}

export function ServiceControlButtons({
  serviceId,
  serviceStatus,
  canDeploy,
  actionLoading,
  onActionStart,
  onActionComplete,
  showToast,
}: ServiceControlButtonsProps) {
  const handleServiceAction = async (action: string) => {
    onActionStart(action);
    try {
      let response;
      switch (action) {
        case "start":
          response = await apiClient.startService(serviceId);
          break;
        case "stop":
          response = await apiClient.stopService(serviceId);
          break;
        case "restart":
          response = await apiClient.restartService(serviceId);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      showToast(`Service ${action} successful!`, "success");
      onActionComplete(action, true);
    } catch (error) {
      console.error(`Failed to ${action} service:`, error);
      showToast(
        `Failed to ${action} service: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "error"
      );
      onActionComplete(action, false);
    }
  };

  if (canDeploy) {
    return (
      <div class="flex items-center justify-end space-x-2">
        {/* Start button - only show when service is stopped, created, paused, or has error */}
        {serviceStatus && ['stopped', 'created', 'paused', 'error', 'exited'].includes(serviceStatus) && (
          <button
            onClick={() => handleServiceAction("start")}
            disabled={actionLoading !== null}
            class="inline-flex items-center px-3 py-2 text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 bg-green-50/80 dark:bg-green-900/20 hover:bg-green-100/80 dark:hover:bg-green-900/30 rounded-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:scale-100"
          >
            {actionLoading === "start" ? (
              <RotateCcw class="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Play class="w-4 h-4 mr-1.5" />
            )}
            Start
          </button>
        )}

        {/* Stop button - only show when service is running, starting, or restarting */}
        {serviceStatus && ['running', 'starting', 'restarting'].includes(serviceStatus) && (
          <button
            onClick={() => handleServiceAction("stop")}
            disabled={actionLoading !== null}
            class="inline-flex items-center px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50/80 dark:bg-red-900/20 hover:bg-red-100/80 dark:hover:bg-red-900/30 rounded-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:scale-100"
          >
            {actionLoading === "stop" ? (
              <RotateCcw class="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <Square class="w-4 h-4 mr-1.5" />
            )}
            Stop
          </button>
        )}

        {/* Restart button - only show when service is running */}
        {serviceStatus && ['running'].includes(serviceStatus) && (
          <button
            onClick={() => handleServiceAction("restart")}
            disabled={actionLoading !== null}
            class="inline-flex items-center px-3 py-2 text-sm font-medium text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 bg-yellow-50/80 dark:bg-yellow-900/20 hover:bg-yellow-100/80 dark:hover:bg-yellow-900/30 rounded-lg transition-all duration-200 hover:scale-105 disabled:opacity-50 disabled:scale-100"
          >
            {actionLoading === "restart" ? (
              <RotateCcw class="w-4 h-4 mr-1.5 animate-spin" />
            ) : (
              <RotateCcw class="w-4 h-4 mr-1.5" />
            )}
            Restart
          </button>
        )}
      </div>
    );
  }

  // Read-only view for non-deployers
  return (
    <div class="flex items-center space-x-3">
      <div class="relative">
        <div class="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-400 dark:text-gray-600 bg-gray-50/80 dark:bg-gray-800/50 rounded-lg cursor-not-allowed opacity-60">
          <Lock class="w-4 h-4 mr-2" />
          Actions Restricted
        </div>
        <div class="absolute -top-2 -right-2 bg-gray-600 text-white text-xs px-2 py-1 rounded-full shadow-lg opacity-90">
          Viewer Mode
        </div>
      </div>
    </div>
  );
}