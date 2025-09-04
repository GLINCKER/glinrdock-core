import { useState } from "preact/hooks";
import { ServiceConfig, VolumeMap } from "../../../api";
import { HardDrive, FolderOpen, Plus, Trash2, Settings, Database, AlertTriangle, ShieldCheck, Info } from "lucide-preact";
import { ImpactBadge } from "../../../components/ImpactBadge";
import { IMPACT_TYPES } from "../../../utils/changeImpact";

interface VolumesTabProps {
  config: ServiceConfig;
  hasChanges: boolean;
  canDeploy: boolean;
  updateConfig: (field: keyof ServiceConfig, value: any) => void;
  showToast: (message: string, type: "success" | "error" | "info") => void;
}

export function VolumesTab({
  config,
  hasChanges,
  canDeploy,
  updateConfig,
  showToast,
}: VolumesTabProps) {
  const [editingVolumes, setEditingVolumes] = useState(false);
  const [newVolume, setNewVolume] = useState<Partial<VolumeMap>>({
    host: "",
    container: "",
    ro: false
  });

  const addVolume = () => {
    if (!newVolume.host || !newVolume.container) {
      showToast("Please enter both host and container paths", "error");
      return;
    }

    const volumeToAdd: VolumeMap = {
      host: newVolume.host,
      container: newVolume.container,
      ro: newVolume.ro || false
    };

    const updatedVolumes = [...(config.volumes || []), volumeToAdd];
    updateConfig("volumes", updatedVolumes);
    
    setNewVolume({ host: "", container: "", ro: false });
    setEditingVolumes(false);
    showToast("Volume mapping added", "success");
  };

  const removeVolume = (index: number) => {
    const updatedVolumes = config.volumes?.filter((_, i) => i !== index) || [];
    updateConfig("volumes", updatedVolumes);
    showToast("Volume mapping removed", "success");
  };

  const copyToClipboard = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        showToast("Copied to clipboard", "success");
      } else {
        // Fallback for older browsers
        const textArea = document.createElement("textarea");
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand("copy");
          showToast("Copied to clipboard", "success");
        } catch (err) {
          showToast("Failed to copy", "error");
        }
        document.body.removeChild(textArea);
      }
    } catch (err) {
      showToast("Failed to copy", "error");
    }
  };

  const getVolumeType = (volume: any) => {
    if (volume.host?.startsWith('/var/lib/docker/volumes/')) {
      return { type: 'named', icon: Database, color: 'text-purple-500' };
    } else if (volume.host?.startsWith('/')) {
      return { type: 'bind', icon: FolderOpen, color: 'text-blue-500' };
    } else {
      return { type: 'volume', icon: HardDrive, color: 'text-green-500' };
    }
  };

  // Common volume paths and their purposes
  const commonVolumePaths = [
    {
      container: "/var/lib/postgresql/data",
      purpose: "PostgreSQL Database",
      description: "Database files and configuration"
    },
    {
      container: "/var/lib/mysql",
      purpose: "MySQL Database", 
      description: "Database files and logs"
    },
    {
      container: "/data",
      purpose: "Application Data",
      description: "General application data storage"
    },
    {
      container: "/app/uploads",
      purpose: "User Uploads",
      description: "User-generated content and files"
    },
    {
      container: "/var/log",
      purpose: "Application Logs",
      description: "Log files and debugging information"
    }
  ];

  return (
    <div class="p-6 space-y-8">
      {/* Header with Impact Warning */}
      <div class="bg-gradient-to-r from-purple-50/90 via-blue-50/80 to-indigo-50/90 dark:from-purple-900/20 dark:via-blue-900/20 dark:to-indigo-900/20 rounded-xl p-5 border border-purple-200/50 dark:border-purple-700/50">
        <div class="flex items-start justify-between">
          <div class="flex items-start space-x-3">
            <div class="flex-shrink-0">
              <AlertTriangle class="w-5 h-5 text-purple-600 dark:text-purple-400 mt-0.5" />
            </div>
            <div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Volume Configuration
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-300 mb-3">
                Volume changes require container restart and will cause brief downtime. 
                Plan volume mappings carefully for data persistence and security.
              </p>
              <ImpactBadge impact={IMPACT_TYPES.container_restart} showTooltip />
            </div>
          </div>
        </div>
      </div>

      {/* Volume Mappings */}
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <h4 class="text-base font-semibold text-gray-900 dark:text-white flex items-center">
              <HardDrive class="w-4 h-4 mr-2 text-gray-500" />
              Volume Mappings ({config.volumes?.length || 0})
            </h4>
            {canDeploy && (
              <button
                onClick={() => setEditingVolumes(!editingVolumes)}
                class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
              >
                {editingVolumes ? "Cancel" : "Add Volume"}
              </button>
            )}
          </div>
        </div>
        <div class="p-6">
          {!config.volumes || config.volumes.length === 0 ? (
            <div class="text-center py-8">
              <HardDrive class="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No volume mappings
              </h3>
              <p class="text-gray-600 dark:text-gray-400 mb-4">
                Add volume mappings to persist data or share files
              </p>
            </div>
          ) : (
            <div class="space-y-3">
              {config.volumes.map((volume, index) => {
                const volumeType = getVolumeType(volume);
                const IconComponent = volumeType.icon;
                
                return (
                  <div
                    key={index}
                    class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div class="flex items-center space-x-4">
                      <IconComponent class={`w-5 h-5 ${volumeType.color}`} />
                      
                      <div class="flex items-center space-x-3">
                        <div class="flex flex-col">
                          <div class="flex items-center space-x-2">
                            <span class="text-xs text-gray-500 dark:text-gray-400 uppercase">Host:</span>
                            <code class="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded font-mono text-sm">
                              {volume.host}
                            </code>
                          </div>
                          <div class="flex items-center space-x-2 mt-1">
                            <span class="text-xs text-gray-500 dark:text-gray-400 uppercase">Container:</span>
                            <code class="px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded font-mono text-sm">
                              {volume.container}
                            </code>
                          </div>
                        </div>
                      </div>
                      
                      <div class="flex items-center space-x-2">
                        <span class={`px-2 py-1 rounded text-xs font-medium ${
                          volumeType.type === 'bind' 
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
                            : volumeType.type === 'named'
                            ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
                            : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                        }`}>
                          {volumeType.type}
                        </span>
                        
                        {volume.ro && (
                          <span class="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 rounded text-xs">
                            read-only
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div class="flex items-center space-x-2">
                      {/* Copy path button */}
                      <button
                        onClick={() => copyToClipboard(`${volume.host}:${volume.container}${volume.ro ? ':ro' : ''}`)}
                        class="p-2 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded transition-colors"
                        title="Copy volume mapping"
                      >
                        <Settings class="w-4 h-4" />
                      </button>
                      
                      {/* Delete button */}
                      {canDeploy && (
                        <button
                          onClick={() => removeVolume(index)}
                          class="p-2 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                          title="Delete volume mapping"
                        >
                          <Trash2 class="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add New Volume Form */}
          {editingVolumes && (
            <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              {/* Security Warning */}
              <div class="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-700">
                <div class="flex items-start space-x-2">
                  <AlertTriangle class="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <p class="text-xs text-amber-800 dark:text-amber-200 font-medium">Security Notice:</p>
                    <p class="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      Volume mappings can expose host filesystem to containers. Ensure paths are secure and follow principle of least privilege.
                    </p>
                  </div>
                </div>
              </div>
              <div class="space-y-4">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Host Path
                    </label>
                    <input
                      type="text"
                      value={newVolume.host}
                      onInput={(e) =>
                        setNewVolume({
                          ...newVolume,
                          host: (e.target as HTMLInputElement).value,
                        })
                      }
                      placeholder="/host/path or volume_name"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Container Path
                    </label>
                    <input
                      type="text"
                      value={newVolume.container}
                      onInput={(e) =>
                        setNewVolume({
                          ...newVolume,
                          container: (e.target as HTMLInputElement).value,
                        })
                      }
                      placeholder="/container/path"
                      class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    />
                  </div>
                </div>
                <div class="flex items-center">
                  <input
                    type="checkbox"
                    id="readonly"
                    checked={newVolume.ro}
                    onChange={(e) =>
                      setNewVolume({
                        ...newVolume,
                        ro: (e.target as HTMLInputElement).checked,
                      })
                    }
                    class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="readonly" class="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    Mount as read-only
                  </label>
                </div>
                <div class="flex justify-end space-x-3">
                  <button
                    onClick={() => setEditingVolumes(false)}
                    class="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={addVolume}
                    class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center"
                  >
                    <Plus class="w-4 h-4 mr-2" />
                    Add Volume
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Volume Types Information */}
      <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200/50 dark:border-gray-700/50">
        <div class="p-6 border-b border-gray-200 dark:border-gray-700">
          <h4 class="text-base font-semibold text-gray-900 dark:text-white flex items-center">
            <Settings class="w-4 h-4 mr-2 text-gray-500" />
            Volume Types
          </h4>
        </div>
        <div class="p-6">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div class="space-y-3">
              <div class="flex items-center space-x-2">
                <FolderOpen class="w-5 h-5 text-blue-500" />
                <h5 class="font-medium text-gray-900 dark:text-white">Bind Mounts</h5>
              </div>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Mount a host directory directly into the container. Changes are immediately visible on both sides.
              </p>
              <code class="block text-xs bg-blue-50 dark:bg-blue-900/20 p-2 rounded text-blue-800 dark:text-blue-300">
                /host/path:/container/path
              </code>
            </div>
            
            <div class="space-y-3">
              <div class="flex items-center space-x-2">
                <HardDrive class="w-5 h-5 text-green-500" />
                <h5 class="font-medium text-gray-900 dark:text-white">Named Volumes</h5>
              </div>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Docker-managed volumes that persist data independently of the container lifecycle.
              </p>
              <code class="block text-xs bg-green-50 dark:bg-green-900/20 p-2 rounded text-green-800 dark:text-green-300">
                volume_name:/container/path
              </code>
            </div>
            
            <div class="space-y-3">
              <div class="flex items-center space-x-2">
                <Database class="w-5 h-5 text-purple-500" />
                <h5 class="font-medium text-gray-900 dark:text-white">Anonymous Volumes</h5>
              </div>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Temporary volumes created by Docker that are removed when the container is deleted.
              </p>
              <code class="block text-xs bg-purple-50 dark:bg-purple-900/20 p-2 rounded text-purple-800 dark:text-purple-300">
                /container/path
              </code>
            </div>
          </div>
        </div>
      </div>

      {/* Volume Best Practices & Security */}
      <div class="bg-gray-50/90 dark:bg-gray-800/90 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div class="flex items-center space-x-2 mb-4">
          <Settings class="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h4 class="text-md font-semibold text-gray-900 dark:text-white">
            Volume Best Practices
          </h4>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Security Guidelines */}
          <div class="space-y-3">
            <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Security Guidelines
            </h5>
            <ul class="space-y-2 text-xs text-gray-600 dark:text-gray-400">
              <li class="flex items-start">
                <AlertTriangle class="w-3 h-3 text-amber-500 mr-1.5 mt-0.5 flex-shrink-0" />
                Avoid mounting sensitive system directories (/etc, /proc, /sys)
              </li>
              <li class="flex items-start">
                <AlertTriangle class="w-3 h-3 text-blue-500 mr-1.5 mt-0.5 flex-shrink-0" />
                Use read-only mounts when container doesn't need write access
              </li>
              <li class="flex items-start">
                <AlertTriangle class="w-3 h-3 text-green-500 mr-1.5 mt-0.5 flex-shrink-0" />
                Prefer named volumes for persistent data over bind mounts
              </li>
            </ul>
          </div>

          {/* Performance Tips */}
          <div class="space-y-3">
            <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300">
              Performance & Reliability
            </h5>
            <ul class="space-y-2 text-xs text-gray-600 dark:text-gray-400">
              <li class="flex items-start">
                <Database class="w-3 h-3 text-purple-500 mr-1.5 mt-0.5 flex-shrink-0" />
                Use named volumes for databases and persistent application data
              </li>
              <li class="flex items-start">
                <HardDrive class="w-3 h-3 text-green-500 mr-1.5 mt-0.5 flex-shrink-0" />
                Bind mounts are ideal for development with live code reloading
              </li>
              <li class="flex items-start">
                <FolderOpen class="w-3 h-3 text-blue-500 mr-1.5 mt-0.5 flex-shrink-0" />
                Consider volume drivers for network storage or special requirements
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}