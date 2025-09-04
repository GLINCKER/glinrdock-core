interface SystemResourcesProps {
  systemInfo?: any
  systemMetrics?: any
}

export function SystemResources({ systemInfo, systemMetrics }: SystemResourcesProps) {
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'running': case 'connected': case 'online': return 'text-emerald-500'
      case 'stopped': case 'disconnected': case 'offline': return 'text-red-500'
      case 'starting': case 'pending': return 'text-yellow-500'
      default: return 'text-gray-500'
    }
  }

  return (
    <div class="grid lg:grid-cols-2 gap-6">
      {/* System Resources */}
      <div class="card gradient-card shadow-lg shadow-[#10b981]/20">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-semibold">
            <span class="bg-gradient-to-r from-[#10b981] to-[#059669] bg-clip-text text-transparent">
              System Resources
            </span>
          </h3>
          <div class="w-8 h-8 bg-[#10b981]/20 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
        </div>
        {systemMetrics ? (
          <div class="space-y-4">
            {/* CPU Usage */}
            <div>
              <div class="flex justify-between items-center mb-2">
                <span class="text-sm text-gray-600 dark:text-gray-400">CPU Usage</span>
                <span class="text-sm font-medium text-gray-900 dark:text-white">
                  {systemMetrics.resources.cpu.used_percent.toFixed(1)}%
                </span>
              </div>
              <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  class="bg-gradient-to-r from-[#10b981] to-[#059669] h-2 rounded-full transition-all duration-300" 
                  style={`width: ${Math.min(systemMetrics.resources.cpu.used_percent, 100)}%`}
                ></div>
              </div>
            </div>
            
            {/* Memory Usage */}
            <div>
              <div class="flex justify-between items-center mb-2">
                <span class="text-sm text-gray-600 dark:text-gray-400">Memory</span>
                <span class="text-sm font-medium text-gray-900 dark:text-white">
                  {formatBytes(systemMetrics.resources.memory.used)} / {formatBytes(systemMetrics.resources.memory.total)}
                </span>
              </div>
              <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  class="bg-gradient-to-r from-[#3b82f6] to-[#1d4ed8] h-2 rounded-full transition-all duration-300" 
                  style={`width: ${Math.min(systemMetrics.resources.memory.used_percent, 100)}%`}
                ></div>
              </div>
            </div>
            
            {/* Disk Usage */}
            <div>
              <div class="flex justify-between items-center mb-2">
                <span class="text-sm text-gray-600 dark:text-gray-400">Disk Space</span>
                <span class="text-sm font-medium text-gray-900 dark:text-white">
                  {formatBytes(systemMetrics.resources.disk.used)} / {formatBytes(systemMetrics.resources.disk.total)}
                </span>
              </div>
              <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  class="bg-gradient-to-r from-[#f59e0b] to-[#d97706] h-2 rounded-full transition-all duration-300" 
                  style={`width: ${Math.min(systemMetrics.resources.disk.used_percent, 100)}%`}
                ></div>
              </div>
            </div>
          </div>
        ) : (
          <div class="space-y-4">
            <div class="skeleton h-16" />
            <div class="skeleton h-16" />
            <div class="skeleton h-16" />
          </div>
        )}
      </div>

      {/* System Information */}
      <div class="card gradient-card shadow-lg shadow-[#ffaa40]/20">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-semibold">
            <span class="bg-gradient-to-r from-[#ffaa40] to-[#f59e0b] bg-clip-text text-transparent">
              System Information
            </span>
          </h3>
          <div class="w-8 h-8 bg-[#ffaa40]/20 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-[#ffaa40]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
          </div>
        </div>
        {systemInfo && systemMetrics ? (
          <div class="space-y-4">
            <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <span class="text-sm text-gray-600 dark:text-gray-400">Version</span>
              <span class="text-sm font-mono font-medium text-gray-900 dark:text-white">
                v{systemInfo.go_version.replace(/^go/, '')}
              </span>
            </div>
            <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <span class="text-sm text-gray-600 dark:text-gray-400">Platform</span>
              <span class="text-sm font-mono font-medium text-gray-900 dark:text-white">
                {systemInfo.os}/{systemInfo.arch}
              </span>
            </div>
            <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <span class="text-sm text-gray-600 dark:text-gray-400">CPU Cores</span>
              <span class="text-sm font-medium text-gray-900 dark:text-white">
                {systemMetrics.platform.num_cpu}
              </span>
            </div>
            <div class="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <span class="text-sm text-gray-600 dark:text-gray-400">Docker</span>
              <div class="flex items-center space-x-2">
                <div class={`w-2 h-2 rounded-full ${systemInfo.docker_status === 'connected' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                <span class={`text-sm font-medium ${getStatusColor(systemInfo.docker_status)}`}>
                  {systemInfo.docker_status === 'connected' ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div class="space-y-4">
            <div class="skeleton h-12" />
            <div class="skeleton h-12" />
            <div class="skeleton h-12" />
            <div class="skeleton h-12" />
          </div>
        )}
      </div>
    </div>
  )
}