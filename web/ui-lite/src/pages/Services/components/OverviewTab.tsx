import { ServiceDetail, ServiceNetwork } from "../../../api";
import { StatusBadge, Badge } from "../../../components/ui/ServiceBadge";
import { formatTime } from "../../../utils/docker";
import { RotateCcw, Clock, Activity } from "lucide-preact";
import { ResourceMonitor } from "../../../components/ResourceMonitor";
import { ExternalHostnamesPanel } from "../../../components/ExternalHostnamesPanel";

interface OverviewTabProps {
  service: ServiceDetail;
  network: ServiceNetwork | null;
  networkLoading: boolean;
  handleTabChange: (tab: string) => void;
  copyToClipboard: (text: string, label: string) => void;
  generateDockerRunCommand: () => string;
  formatTime: (dateString: string) => string;
  lastUpdated: Date;
  liveUpdate: boolean;
}

export function OverviewTab({
  service,
  network,
  networkLoading,
  handleTabChange,
  copyToClipboard,
  generateDockerRunCommand,
  formatTime,
  lastUpdated,
  liveUpdate,
}: OverviewTabProps) {
  return (
    <div class="flex flex-col xl:grid xl:grid-cols-4 gap-4 md:gap-6">
      {/* Left Column - Overview Cards */}
      <div class="xl:col-span-3 space-y-4 md:space-y-6">
        {/* Container Status Card */}
        <div class="bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-cyan-50/90 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-cyan-900/20 rounded-2xl shadow-lg border border-blue-200/50 dark:border-blue-700/50 p-4 sm:p-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-0 mb-4">
            <h3 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <svg
                class="w-4 h-4 sm:w-5 sm:h-5 mr-2 text-blue-600 dark:text-blue-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                />
              </svg>
              Container Status
            </h3>
            <div class="flex items-center space-x-2 text-xs">
              {service.status === "running" && (
                <span class="flex items-center text-green-600 dark:text-green-400">
                  <div class="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse"></div>
                  Live
                </span>
              )}
              <span class="text-gray-500 dark:text-gray-400 hidden sm:inline">
                Updated {formatTime(lastUpdated.toISOString())}
              </span>
            </div>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-4">
            {/* Uptime */}
            <div class="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3 sm:p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Uptime</span>
                <Clock class="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
              </div>
              <div class="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white">
                {service.status === "running" ? (
                  service.started_at ? 
                    (() => {
                      const startTime = new Date(service.started_at);
                      const now = new Date();
                      const diffMs = now.getTime() - startTime.getTime();
                      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                      
                      if (days > 0) return `${days}d ${hours}h ${minutes}m`;
                      if (hours > 0) return `${hours}h ${minutes}m`;
                      return `${minutes}m`;
                    })()
                  : "Unknown"
                ) : "Not running"}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                {service.status === "running" && service.started_at && 
                  `Started ${formatTime(service.started_at)}`
                }
              </div>
            </div>

            {/* Health Status */}
            <div class="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3 sm:p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Health</span>
                <Activity class="w-3 h-3 sm:w-4 sm:h-4 text-blue-500" />
              </div>
              <div class={`text-sm sm:text-lg font-semibold ${
                service.status === "running" 
                  ? "text-green-600 dark:text-green-400" 
                  : service.status === "exited"
                  ? "text-gray-600 dark:text-gray-400"
                  : "text-red-600 dark:text-red-400"
              }`}>
                {service.status === "running" ? "Healthy" : 
                 service.status === "exited" ? "Stopped" : "Unhealthy"}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                Last check: 30s ago
              </div>
            </div>

            {/* Restart Count */}
            <div class="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3 sm:p-4">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-300">Restarts</span>
                <RotateCcw class="w-3 h-3 sm:w-4 sm:h-4 text-orange-500" />
              </div>
              <div class="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white">
                {service.restart_count || 0}
              </div>
              <div class="text-xs text-gray-500 dark:text-gray-400">
                {service.restart_count && service.restart_count > 0 && service.last_restart_at
                  ? `Last: ${formatTime(service.last_restart_at)}`
                  : "Never restarted"
                }
              </div>
            </div>
          </div>

          {/* Resource Usage - Real-time monitoring */}
          <ResourceMonitor 
            serviceId={service.id} 
            serviceStatus={service.status} 
            containerId={service.container_id}
          />
        </div>

        {/* Runtime Card */}
        <div class="bg-gradient-to-r from-white/95 via-gray-50/90 to-white/95 dark:from-gray-800/95 dark:via-gray-900/90 dark:to-gray-800/95 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-4 sm:p-6">
          <h3 class="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Runtime Information
          </h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-2">
              <div class="text-sm text-gray-600 dark:text-gray-400">
                Container ID
              </div>
              <div class="font-mono text-xs sm:text-sm bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg break-all">
                {service.container_id || "N/A"}
              </div>
            </div>
            <div class="space-y-2">
              <div class="text-sm text-gray-600 dark:text-gray-400">
                Status
              </div>
              <div class="flex items-center space-x-2">
                <StatusBadge status={service.status} />
                {service.state_reason && (
                  <span
                    class="text-xs text-gray-500 dark:text-gray-400"
                    title={service.state_reason}
                  >
                    ({service.state_reason})
                  </span>
                )}
              </div>
            </div>
            <div class="space-y-2">
              <div class="text-sm text-gray-600 dark:text-gray-400">
                Created
              </div>
              <div class="text-sm text-gray-900 dark:text-white">
                {formatTime(service.created_at)}
              </div>
            </div>
            <div class="space-y-2">
              <div class="text-sm text-gray-600 dark:text-gray-400">
                Last Deploy
              </div>
              <div class="text-sm text-gray-900 dark:text-white">
                {service.last_deploy_at
                  ? formatTime(service.last_deploy_at)
                  : "Never"}
              </div>
            </div>
          </div>
        </div>

        {/* Networking Card - Enhanced */}
        <div class="bg-gradient-to-r from-white/95 via-gray-50/90 to-white/95 dark:from-gray-800/95 dark:via-gray-900/90 dark:to-gray-800/95 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-6">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
              Networking
            </h3>
            <button
              onClick={() => handleTabChange("networking")}
              class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 flex items-center"
            >
              View Details
              <svg
                class="w-3 h-3 ml-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </div>

          {/* Network Summary */}
          {network && (
            <div class="mb-4 p-3 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg border border-blue-200/50 dark:border-blue-700/50">
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-medium text-blue-700 dark:text-blue-300">
                  Service Alias
                </span>
                <button
                  onClick={() =>
                    copyToClipboard(network.alias, "Service alias")
                  }
                  class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  title="Copy alias"
                >
                  Copy
                </button>
              </div>
              <code class="text-sm font-mono text-gray-900 dark:text-white bg-white/80 dark:bg-gray-800/80 px-2 py-1 rounded">
                {network.alias}
              </code>
              <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                on{" "}
                <code class="text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">
                  {network.network}
                </code>
              </div>
            </div>
          )}

          {/* Port Mappings */}
          {service.ports && service.ports.length > 0 ? (
            <div class="space-y-3">
              <div class="text-sm font-medium text-gray-700 dark:text-gray-300">
                Port Mappings
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-gray-600 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700 pb-2">
                <div>External</div>
                <div>Internal</div>
                <div>Status</div>
              </div>
              {service.ports.map((port, idx) => (
                <div
                  key={idx}
                  class="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm items-center"
                >
                  <div class="font-mono text-blue-600 dark:text-blue-400">
                    {port.host}
                  </div>
                  <div class="font-mono text-green-600 dark:text-green-400">
                    {port.container}/tcp
                  </div>
                  <div class="flex items-center">
                    <span class="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                      Active
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div class="text-center py-4">
              <svg
                class="w-8 h-8 mx-auto mb-2 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.111 16.404a5.5 5.5 0 717.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0"
                />
              </svg>
              <p class="text-gray-500 dark:text-gray-400 text-sm">
                No external port mappings
              </p>
              {network && (
                <p class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Service accessible internally via{" "}
                  <code class="bg-gray-100 dark:bg-gray-700 px-1 rounded">
                    {network.alias}
                  </code>
                </p>
              )}
            </div>
          )}
        </div>

        {/* Volumes Card */}
        <div class="bg-gradient-to-r from-white/95 via-gray-50/90 to-white/95 dark:from-gray-800/95 dark:via-gray-900/90 dark:to-gray-800/95 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Volumes
          </h3>
          {service.volumes && service.volumes.length > 0 ? (
            <div class="space-y-3">
              <div class="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600 dark:text-gray-400 font-medium border-b border-gray-200 dark:border-gray-700 pb-2">
                <div>Host Path</div>
                <div>Container Path</div>
                <div>Mode</div>
              </div>
              {service.volumes.map((volume, idx) => (
                <div
                  key={idx}
                  class="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm"
                >
                  <div class="font-mono text-blue-600 dark:text-blue-400 break-all">
                    {volume.host}
                  </div>
                  <div class="font-mono text-green-600 dark:text-green-400 break-all">
                    {volume.container}
                  </div>
                  <div
                    class={
                      volume.ro
                        ? "text-yellow-600 dark:text-yellow-400"
                        : "text-gray-500 dark:text-gray-400"
                    }
                  >
                    {volume.ro ? "Read-only" : "Read-write"}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p class="text-gray-500 dark:text-gray-400 text-sm">
              No volume mounts configured
            </p>
          )}
        </div>
      </div>

      {/* Right Column - Quick Actions */}
      <div class="space-y-6">
        {/* External Hostnames Panel */}
        <ExternalHostnamesPanel 
          serviceId={service.id}
          serviceName={service.name}
          servicePort={service.config?.ports?.[0]?.internal || 80}
        />
        
        <div class="bg-gradient-to-r from-white/95 via-gray-50/90 to-white/95 dark:from-gray-800/95 dark:via-gray-900/90 dark:to-gray-800/95 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h3>
          <div class="space-y-3">
            <button
              onClick={() =>
                copyToClipboard(
                  generateDockerRunCommand(),
                  "Docker run command"
                )
              }
              class="w-full flex items-center px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
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
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy Docker Run Command
            </button>

            <button
              onClick={() =>
                copyToClipboard(service.id.toString(), "Service ID")
              }
              class="w-full flex items-center px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
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
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
              Copy Service ID
            </button>
          </div>
        </div>

        {/* Environment Variables Summary */}
        <div class="bg-gradient-to-r from-white/95 via-gray-50/90 to-white/95 dark:from-gray-800/95 dark:via-gray-900/90 dark:to-gray-800/95 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Environment
          </h3>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600 dark:text-gray-400">
              Variables count
            </span>
            <Badge variant="info" size="sm">
              {service.env_summary_count} vars
            </Badge>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Environment variables are hidden for security
          </p>
        </div>

        {/* Status Info */}
        <div class="bg-gradient-to-r from-white/95 via-gray-50/90 to-white/95 dark:from-gray-800/95 dark:via-gray-900/90 dark:to-gray-800/95 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Live Status
          </h3>
          <div class="space-y-2">
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-600 dark:text-gray-400">
                Last updated
              </span>
              <span class="text-gray-900 dark:text-white">
                {formatTime(lastUpdated.toISOString())}
              </span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-600 dark:text-gray-400">
                Auto refresh
              </span>
              <span
                class={
                  liveUpdate
                    ? "text-green-600 dark:text-green-400"
                    : "text-gray-600 dark:text-gray-400"
                }
              >
                {liveUpdate ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}