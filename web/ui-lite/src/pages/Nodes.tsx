import { useState } from 'preact/hooks'
import { apiClient, useApiData } from '../api'

export function Nodes() {
  const { data: systemInfo, loading: systemLoading } = useApiData(() => apiClient.getSystemInfo())
  const { data: systemMetrics, loading: metricsLoading } = useApiData(() => apiClient.getSystemMetrics())
  const [showAddNodeModal, setShowAddNodeModal] = useState(false)

  // Helper functions for formatting data
  const formatUptime = (uptimeNs?: number) => {
    if (!uptimeNs) return "Unknown"
    const seconds = Math.floor(uptimeNs / 1e9)
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    
    const parts = []
    if (days > 0) parts.push(`${days}d`)
    if (hours > 0) parts.push(`${hours}h`)
    if (minutes > 0 && days === 0) parts.push(`${minutes}m`)
    return parts.join(' ') || '0s'
  }

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
  }

  const formatNetworkRate = (bytesPerSecond: number) => {
    // Simple approximation - would need time diff for real rate
    return formatBytes(bytesPerSecond / 60) + '/s' // rough estimate
  }

  const currentNode = systemMetrics && systemInfo ? {
    id: systemMetrics.node_id,
    name: 'Primary Node',
    hostname: systemMetrics.hostname,
    status: 'online',
    role: 'master',
    version: systemMetrics.platform.go_version?.replace(/^go/, 'v') || 'Unknown',
    os: systemMetrics.platform.os || 'Unknown',
    arch: systemMetrics.platform.arch || 'Unknown',
    uptime: formatUptime(systemMetrics.uptime),
    dockerStatus: systemInfo.docker_status === 'connected' ? 'connected' : 'disconnected',
    numCpu: systemMetrics.platform.num_cpu,
    resources: {
      cpu: { 
        used: Math.round(systemMetrics.resources.cpu.used_percent * 100) / 100, 
        total: 100, 
        unit: '%' 
      },
      memory: { 
        used: systemMetrics.resources.memory.used / (1024 ** 3), // Convert to GB
        total: systemMetrics.resources.memory.total / (1024 ** 3), // Convert to GB
        unit: 'GB',
        usedPercent: systemMetrics.resources.memory.used_percent
      },
      disk: { 
        used: systemMetrics.resources.disk.used / (1024 ** 3), // Convert to GB
        total: systemMetrics.resources.disk.total / (1024 ** 3), // Convert to GB
        unit: 'GB',
        usedPercent: systemMetrics.resources.disk.used_percent
      },
      network: { 
        rx: systemMetrics.network.bytes_recv / (1024 ** 2), // Convert to MB
        tx: systemMetrics.network.bytes_sent / (1024 ** 2), // Convert to MB
        unit: 'MB total'
      }
    }
  } : null

  const loading = systemLoading || metricsLoading

  return (
    <div class="space-y-6 fade-in">
      {/* Header */}
      <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold mb-2">
            <span class="bg-gradient-to-r from-[#8b008b] via-[#9c40ff] to-[#e94057] bg-clip-text text-transparent">
              Cluster Nodes
            </span>
          </h1>
          <p class="text-gray-400">Monitor and manage your container orchestration nodes</p>
        </div>
        <div class="flex items-center space-x-3">
          <button 
            onClick={() => setShowAddNodeModal(true)}
            class="btn btn-secondary flex items-center space-x-2"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add Node</span>
          </button>
        </div>
      </div>

      {/* Cluster Overview */}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div class="bg-gradient-to-r from-white/95 via-gray-50/90 to-white/95 dark:from-gray-800/95 dark:via-gray-900/90 dark:to-gray-800/95 rounded-2xl p-6 shadow-lg shadow-[#10b981]/10">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Total Nodes</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">1</p>
            </div>
            <div class="w-12 h-12 bg-[#10b981]/20 rounded-xl flex items-center justify-center">
              <svg class="w-6 h-6 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-gradient-to-r from-white/95 via-gray-50/90 to-white/95 dark:from-gray-800/95 dark:via-gray-900/90 dark:to-gray-800/95 rounded-2xl p-6 shadow-lg shadow-[#9c40ff]/10">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Online</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">1</p>
            </div>
            <div class="w-12 h-12 bg-[#9c40ff]/20 rounded-xl flex items-center justify-center">
              <svg class="w-6 h-6 text-[#9c40ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-gradient-to-r from-white/95 via-gray-50/90 to-white/95 dark:from-gray-800/95 dark:via-gray-900/90 dark:to-gray-800/95 rounded-2xl p-6 shadow-lg shadow-[#ffaa40]/10">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">CPU Usage</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">
                {loading ? '...' : currentNode ? `${currentNode.resources.cpu.used}%` : 'N/A'}
              </p>
            </div>
            <div class="w-12 h-12 bg-[#ffaa40]/20 rounded-xl flex items-center justify-center">
              <svg class="w-6 h-6 text-[#ffaa40]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-gradient-to-r from-white/95 via-gray-50/90 to-white/95 dark:from-gray-800/95 dark:via-gray-900/90 dark:to-gray-800/95 rounded-2xl p-6 shadow-lg shadow-[#e94057]/10">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-gray-600 dark:text-gray-400">Memory Usage</p>
              <p class="text-2xl font-bold text-gray-900 dark:text-white">
                {loading ? '...' : currentNode ? `${currentNode.resources.memory.used.toFixed(1)}GB` : 'N/A'}
              </p>
            </div>
            <div class="w-12 h-12 bg-[#e94057]/20 rounded-xl flex items-center justify-center">
              <svg class="w-6 h-6 text-[#e94057]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Node Details */}
      {currentNode ? (
        <div class="bg-gradient-to-r from-white/95 via-gray-50/90 to-white/95 dark:from-gray-800/95 dark:via-gray-900/90 dark:to-gray-800/95 rounded-2xl p-6 shadow-lg shadow-[#8b008b]/10">
          <div class="flex items-center justify-between mb-6">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">Node Details</h2>
            <div class="flex items-center space-x-2">
              <div class="w-2 h-2 bg-[#10b981] rounded-full animate-pulse"></div>
              <span class="text-sm font-medium text-[#10b981]">Online</span>
            </div>
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Node Information */}
            <div class="space-y-6">
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <svg class="w-5 h-5 text-[#9c40ff] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  System Information
                </h3>
                <div class="grid grid-cols-2 gap-4">
                  <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Node ID</p>
                    <p class="text-sm font-mono text-gray-900 dark:text-white mt-1">{currentNode.id}</p>
                  </div>
                  <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Role</p>
                    <p class="text-sm font-semibold text-[#9c40ff] mt-1 capitalize">{currentNode.role}</p>
                  </div>
                  <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Version</p>
                    <p class="text-sm font-mono text-gray-900 dark:text-white mt-1">{currentNode.version}</p>
                  </div>
                  <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Uptime</p>
                    <p class="text-sm font-mono text-gray-900 dark:text-white mt-1">{currentNode.uptime}</p>
                  </div>
                  <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Platform</p>
                    <p class="text-sm font-mono text-gray-900 dark:text-white mt-1">{currentNode.os}/{currentNode.arch} ({currentNode.numCpu} cores)</p>
                  </div>
                  <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Docker</p>
                    <div class="flex items-center mt-1">
                      <div class={`w-2 h-2 rounded-full mr-2 ${currentNode.dockerStatus === 'connected' ? 'bg-[#10b981]' : 'bg-[#e94057]'}`}></div>
                      <p class="text-sm font-medium text-gray-900 dark:text-white capitalize">{currentNode.dockerStatus}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Resource Usage */}
            <div class="space-y-6">
              <div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                  <svg class="w-5 h-5 text-[#e94057] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Resource Usage
                </h3>
                <div class="space-y-4">
                  {/* CPU Usage */}
                  <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">CPU</span>
                      <span class="text-sm font-mono text-gray-900 dark:text-white">{currentNode.resources.cpu.used}%</span>
                    </div>
                    <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div 
                        class="bg-gradient-to-r from-[#ffaa40] to-[#e94057] h-2 rounded-full transition-all duration-300"
                        style={`width: ${Math.min(currentNode.resources.cpu.used, 100)}%`}
                      ></div>
                    </div>
                  </div>

                  {/* Memory Usage */}
                  <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Memory</span>
                      <span class="text-sm font-mono text-gray-900 dark:text-white">
                        {currentNode.resources.memory.used.toFixed(1)} / {currentNode.resources.memory.total.toFixed(1)} {currentNode.resources.memory.unit}
                      </span>
                    </div>
                    <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div 
                        class="bg-gradient-to-r from-[#9c40ff] to-[#8b008b] h-2 rounded-full transition-all duration-300"
                        style={`width: ${Math.min(currentNode.resources.memory.usedPercent, 100)}%`}
                      ></div>
                    </div>
                  </div>

                  {/* Disk Usage */}
                  <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Disk</span>
                      <span class="text-sm font-mono text-gray-900 dark:text-white">
                        {currentNode.resources.disk.used.toFixed(0)} / {currentNode.resources.disk.total.toFixed(0)} {currentNode.resources.disk.unit}
                      </span>
                    </div>
                    <div class="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div 
                        class="bg-gradient-to-r from-[#10b981] to-[#8b008b] h-2 rounded-full transition-all duration-300"
                        style={`width: ${Math.min(currentNode.resources.disk.usedPercent, 100)}%`}
                      ></div>
                    </div>
                  </div>

                  {/* Network Usage */}
                  <div class="grid grid-cols-2 gap-4">
                    <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Network RX</p>
                      <p class="text-sm font-mono text-gray-900 dark:text-white mt-1">
                        {currentNode.resources.network.rx.toFixed(1)} {currentNode.resources.network.unit}
                      </p>
                    </div>
                    <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                      <p class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Network TX</p>
                      <p class="text-sm font-mono text-gray-900 dark:text-white mt-1">
                        {currentNode.resources.network.tx.toFixed(1)} {currentNode.resources.network.unit}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div class="bg-gradient-to-r from-white/95 via-gray-50/90 to-white/95 dark:from-gray-800/95 dark:via-gray-900/90 dark:to-gray-800/95 rounded-2xl p-8 text-center">
          <div class="w-12 h-12 bg-gray-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
            <svg class="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <p class="text-gray-600 dark:text-gray-400">Loading node information...</p>
        </div>
      )}

      {/* Pro Plan Multi-Node Features Section */}
      <div class="mt-8 bg-gradient-to-br from-[#9c40ff]/3 via-[#8b008b]/3 to-[#e94057]/3 rounded-2xl p-6 border border-[#9c40ff]/10">
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-gradient-to-br from-[#9c40ff] to-[#8b008b] rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
            </div>
            <div>
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">GLINR Dock Pro</h2>
              <p class="text-sm text-gray-600 dark:text-gray-400">Scale beyond single-node limitations</p>
            </div>
          </div>
          <div class="flex items-center space-x-2 bg-gradient-to-r from-[#9c40ff] to-[#8b008b] px-2.5 py-1 rounded-lg">
            <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            <span class="text-xs font-medium text-white">PRO</span>
          </div>
        </div>

        <div class="grid md:grid-cols-2 gap-6 mb-6">
          {/* Feature List */}
          <div class="space-y-4">
            <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-3">Advanced Capabilities</h3>
            <div class="space-y-3">
              {[
                { title: "Multi-Node Cluster", description: "Scale across unlimited nodes with automatic discovery" },
                { title: "Load Balancing", description: "Intelligent traffic distribution across cluster nodes" },
                { title: "High Availability", description: "Automatic failover and redundancy management" },
                { title: "Centralized Monitoring", description: "Real-time metrics across all cluster nodes" },
                { title: "Auto-Scaling", description: "Dynamic resource allocation based on demand" },
                { title: "Priority Support", description: "Dedicated support channel and faster response times" }
              ].map((feature, index) => (
                <div key={index} class="flex items-start space-x-3">
                  <div class="w-5 h-5 bg-[#10b981] rounded-full flex items-center justify-center mt-0.5 flex-shrink-0">
                    <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h4 class="text-sm font-semibold text-gray-900 dark:text-white">{feature.title}</h4>
                    <p class="text-xs text-gray-600 dark:text-gray-400">{feature.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Mock Multi-Node Dashboard */}
          <div class="bg-white/50 dark:bg-gray-800/50 rounded-xl p-4 border border-gray-200/50 dark:border-gray-600/50">
            <h3 class="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
              <svg class="w-4 h-4 text-[#9c40ff] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Cluster Overview Preview
            </h3>
            <div class="space-y-2">
              {[
                { name: "node-primary", status: "online", cpu: 23, memory: 67, role: "master" },
                { name: "node-worker-1", status: "online", cpu: 45, memory: 78, role: "worker" },
                { name: "node-worker-2", status: "online", cpu: 12, memory: 34, role: "worker" },
                { name: "node-worker-3", status: "degraded", cpu: 89, memory: 92, role: "worker" }
              ].map((node, index) => (
                <div key={index} class="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700/30 rounded-lg">
                  <div class="flex items-center space-x-2">
                    <div class={`w-2 h-2 rounded-full ${
                      node.status === 'online' ? 'bg-[#10b981]' : 'bg-[#ffaa40]'
                    }`}></div>
                    <div>
                      <p class="text-xs font-mono text-gray-900 dark:text-white">{node.name}</p>
                      <p class="text-xs text-gray-500 dark:text-gray-400">{node.role}</p>
                    </div>
                  </div>
                  <div class="flex items-center space-x-2 text-xs">
                    <div class="flex items-center space-x-1">
                      <span class="text-gray-600 dark:text-gray-400">CPU:</span>
                      <span class="font-mono text-gray-900 dark:text-white">{node.cpu}%</span>
                    </div>
                    <div class="flex items-center space-x-1">
                      <span class="text-gray-600 dark:text-gray-400">MEM:</span>
                      <span class="font-mono text-gray-900 dark:text-white">{node.memory}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div class="mt-3 p-2 bg-gradient-to-r from-[#9c40ff]/10 to-[#8b008b]/10 rounded-lg border border-[#9c40ff]/20">
              <p class="text-xs text-center text-gray-600 dark:text-gray-400">
                Manage dozens of nodes from a single dashboard
              </p>
            </div>
          </div>
        </div>

        {/* Upgrade CTA */}
        <div class="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-gradient-to-r from-white/80 to-gray-50/80 dark:from-gray-800/80 dark:to-gray-700/80 rounded-xl border border-gray-200/50 dark:border-gray-600/50">
          <div class="flex items-center space-x-3">
            <div class="w-10 h-10 bg-gradient-to-br from-[#ffaa40] to-[#e94057] rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <div>
              <h4 class="text-sm font-semibold text-gray-900 dark:text-white">Ready to Scale?</h4>
              <p class="text-xs text-gray-600 dark:text-gray-400">Upgrade to Pro Plan for multi-node orchestration</p>
            </div>
          </div>
          <div class="flex items-center space-x-3">
            <button class="btn btn-secondary text-sm">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Learn More
            </button>
            <button class="btn btn-primary bg-gradient-to-r from-[#9c40ff] to-[#8b008b] border-none text-sm">
              <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              Upgrade Now
            </button>
          </div>
        </div>
      </div>

      {/* Add Node Modal */}
      {showAddNodeModal && (
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-lg">
            <div class="flex items-center justify-between mb-6">
              <div class="flex items-center space-x-3">
                <div class="w-10 h-10 bg-gradient-to-br from-[#9c40ff] to-[#8b008b] rounded-xl flex items-center justify-center">
                  <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white">Pro Plan Feature</h3>
              </div>
              <button 
                onClick={() => setShowAddNodeModal(false)}
                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div class="text-center py-6">
              <div class="w-20 h-20 bg-gradient-to-br from-[#9c40ff]/20 to-[#8b008b]/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg class="w-10 h-10 text-[#9c40ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
              </div>
              <h4 class="text-xl font-bold text-gray-900 dark:text-white mb-2">Multi-Node Orchestration</h4>
              <p class="text-gray-600 dark:text-gray-400 mb-6 max-w-sm mx-auto">
                Add unlimited nodes, load balancing, and high availability with GLINR Dock Pro.
              </p>
              
              <div class="flex flex-col sm:flex-row gap-3 justify-center">
                <button 
                  onClick={() => setShowAddNodeModal(false)}
                  class="btn btn-secondary"
                >
                  Maybe Later
                </button>
                <button class="btn btn-primary bg-gradient-to-r from-[#9c40ff] to-[#8b008b] border-none">
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                  </svg>
                  Upgrade to Pro Plan
                </button>
              </div>

              <div class="mt-4 p-3 bg-gradient-to-r from-[#10b981]/10 to-[#9c40ff]/10 rounded-lg border border-[#10b981]/20">
                <p class="text-xs text-gray-600 dark:text-gray-400">
                  <strong>Coming Soon:</strong> Pro Plan with advanced multi-node features
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}