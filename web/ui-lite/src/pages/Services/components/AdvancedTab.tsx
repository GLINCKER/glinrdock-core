import { useState } from "preact/hooks";
import { ServiceDetail, ServiceConfig, apiClient } from "../../../api";
import { Modal } from "../../../components/ui/Modal";
import { Shield, Trash2, AlertCircle, Settings, Database, Clock, User, Zap, Cpu, MemoryStick } from "lucide-preact";

interface AdvancedTabProps {
  service: ServiceDetail;
  config: ServiceConfig | null;
  canDeploy: boolean;
  showToast: (message: string, type: "success" | "error" | "info") => void;
  onServiceDeleted: () => void;
}

export function AdvancedTab({
  service,
  config,
  canDeploy,
  showToast,
  onServiceDeleted,
}: AdvancedTabProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const handleDeleteService = async () => {
    if (deleteConfirmText !== service.name) {
      showToast("Please type the service name exactly as shown", "error");
      return;
    }

    setDeleteLoading(true);
    try {
      await apiClient.deleteService(service.id.toString());
      showToast("Service deleted successfully", "success");
      setShowDeleteModal(false);
      onServiceDeleted();
    } catch (error) {
      console.error("Failed to delete service:", error);
      showToast(
        `Failed to delete service: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        "error"
      );
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div class="space-y-8">
      {/* Container Information */}
      <div class="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-lg border border-blue-200/50 dark:border-blue-700/50 p-6">
        <div class="flex items-center mb-4">
          <Database class="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            Container Details
          </h3>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div class="space-y-3">
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Container ID:</span>
              <span class="font-mono text-gray-900 dark:text-white text-xs">
                {service.container_id || "Not assigned"}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Image:</span>
              <span class="font-mono text-gray-900 dark:text-white text-xs">
                {service.image}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Status:</span>
              <span class="font-semibold capitalize text-gray-900 dark:text-white">
                {service.status}
              </span>
            </div>
          </div>

          <div class="space-y-3">
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Project ID:</span>
              <span class="font-mono text-gray-900 dark:text-white">
                #{service.project_id}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Service ID:</span>
              <span class="font-mono text-gray-900 dark:text-white">
                #{service.id}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Created:</span>
              <span class="text-gray-900 dark:text-white">
                {new Date(service.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Runtime Configuration */}
      {config && (
        <div class="bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-900/10 dark:to-emerald-900/10 rounded-lg border border-green-200/50 dark:border-green-700/50 p-6">
          <div class="flex items-center mb-4">
            <Settings class="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              Runtime Configuration
            </h3>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
            <div class="space-y-2">
              <div class="flex items-center text-gray-600 dark:text-gray-400">
                <Cpu class="w-4 h-4 mr-1" />
                <span>Resource Limits</span>
              </div>
              <div class="pl-5 space-y-1">
                <div class="text-gray-900 dark:text-white">
                  CPU: {config.cpu_limit || "Unlimited"}
                </div>
                <div class="text-gray-900 dark:text-white">
                  Memory: {config.memory_limit || "Unlimited"}
                </div>
              </div>
            </div>

            <div class="space-y-2">
              <div class="flex items-center text-gray-600 dark:text-gray-400">
                <Clock class="w-4 h-4 mr-1" />
                <span>Health Check</span>
              </div>
              <div class="pl-5 space-y-1">
                <div class="text-gray-900 dark:text-white">
                  Interval: {config.health_check_interval || "30s"}
                </div>
                <div class="text-gray-900 dark:text-white">
                  Timeout: {config.health_check_timeout || "30s"}
                </div>
                <div class="text-gray-900 dark:text-white">
                  Retries: {config.health_check_retries || "3"}
                </div>
              </div>
            </div>

            <div class="space-y-2">
              <div class="flex items-center text-gray-600 dark:text-gray-400">
                <Zap class="w-4 h-4 mr-1" />
                <span>Restart Policy</span>
              </div>
              <div class="pl-5">
                <div class="text-gray-900 dark:text-white capitalize">
                  {config.restart_policy || "unless-stopped"}
                </div>
              </div>
            </div>
          </div>

          <div class="mt-4 pt-4 border-t border-green-200 dark:border-green-700">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <div class="text-gray-600 dark:text-gray-400 mb-2">Environment Variables</div>
                <div class="text-gray-900 dark:text-white">
                  {config.env ? `${config.env.length} variables configured` : "No environment variables"}
                </div>
              </div>
              <div>
                <div class="text-gray-600 dark:text-gray-400 mb-2">Volume Mounts</div>
                <div class="text-gray-900 dark:text-white">
                  {config.volumes ? `${config.volumes.length} volumes mounted` : "No volumes mounted"}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* System Information */}
      <div class="bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-900/10 dark:to-pink-900/10 rounded-lg border border-purple-200/50 dark:border-purple-700/50 p-6">
        <div class="flex items-center mb-4">
          <MemoryStick class="w-5 h-5 text-purple-600 dark:text-purple-400 mr-2" />
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            System Integration
          </h3>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div class="space-y-3">
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Docker Network:</span>
              <span class="font-mono text-gray-900 dark:text-white text-xs">
                {service.network_name || "default"}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Platform:</span>
              <span class="text-gray-900 dark:text-white">
                {service.platform || "linux/amd64"}
              </span>
            </div>
          </div>

          <div class="space-y-3">
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">Labels:</span>
              <span class="text-gray-900 dark:text-white">
                {service.labels ? `${Object.keys(service.labels).length} labels` : "No labels"}
              </span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-600 dark:text-gray-400">DNS Name:</span>
              <span class="font-mono text-gray-900 dark:text-white text-xs">
                {service.name}.{service.network_name || "default"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      {canDeploy && (
        <div class="bg-gradient-to-r from-red-50/50 to-rose-50/50 dark:from-red-900/10 dark:to-rose-900/10 rounded-lg border-2 border-red-200 dark:border-red-700 p-6">
          <div class="flex items-center mb-4">
            <AlertCircle class="w-5 h-5 text-red-600 dark:text-red-400 mr-2" />
            <h3 class="text-lg font-semibold text-red-900 dark:text-red-100">
              Danger Zone
            </h3>
          </div>

          <div class="space-y-4">
            <p class="text-sm text-red-700 dark:text-red-300">
              These actions are irreversible and will permanently affect your service.
              Please proceed with extreme caution.
            </p>

            <div class="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-700">
              <div>
                <h4 class="font-medium text-red-900 dark:text-red-100">
                  Delete Service
                </h4>
                <p class="text-sm text-red-700 dark:text-red-300 mt-1">
                  Permanently delete this service and all its data. This cannot be undone.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                class="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              >
                <Trash2 class="w-4 h-4 mr-2" />
                Delete Service
              </button>
            </div>

            {/* Additional dangerous actions could go here */}
            <div class="flex items-center justify-between p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-700">
              <div>
                <h4 class="font-medium text-yellow-900 dark:text-yellow-100">
                  Reset to Defaults
                </h4>
                <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Reset all service configuration to default values.
                </p>
              </div>
              <button
                onClick={() => showToast("Reset functionality coming soon!", "info")}
                class="inline-flex items-center px-4 py-2 text-sm font-medium text-yellow-800 dark:text-yellow-200 bg-yellow-100 dark:bg-yellow-800/50 hover:bg-yellow-200 dark:hover:bg-yellow-700/50 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              >
                <Settings class="w-4 h-4 mr-2" />
                Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteConfirmText("");
        }}
        title="Delete Service"
        size="md"
      >
        <div class="space-y-4">
          <div class="flex items-start space-x-3">
            <AlertCircle class="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <h4 class="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
                This action cannot be undone
              </h4>
              <p class="text-sm text-red-700 dark:text-red-300 mb-4">
                Deleting the service <strong>{service.name}</strong> will:
              </p>
              <ul class="text-sm text-red-700 dark:text-red-300 space-y-1 list-disc list-inside mb-4">
                <li>Permanently stop and remove the container</li>
                <li>Delete all service configuration and metadata</li>
                <li>Remove any associated routes and network configurations</li>
                <li>Cannot be recovered once deleted</li>
              </ul>
            </div>
          </div>

          <div class="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-700">
            <p class="text-sm text-red-700 dark:text-red-300 mb-3">
              To confirm deletion, type <strong>{service.name}</strong> in the box below:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onInput={(e) => setDeleteConfirmText((e.target as HTMLInputElement).value)}
              placeholder={`Type "${service.name}" to confirm`}
              class="w-full px-3 py-2 border border-red-300 dark:border-red-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
              autoComplete="off"
            />
          </div>

          <div class="flex space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                setShowDeleteModal(false);
                setDeleteConfirmText("");
              }}
              class="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleDeleteService}
              disabled={deleteConfirmText !== service.name || deleteLoading}
              class="flex-1 inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
            >
              {deleteLoading ? (
                <>
                  <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 class="w-4 h-4 mr-2" />
                  Delete Service
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}