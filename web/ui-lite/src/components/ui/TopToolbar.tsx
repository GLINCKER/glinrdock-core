import { useEffect, useState } from 'preact/hooks'
import { apiClient, useApiData } from '../../api'
import { ThemeToggle } from './ThemeToggle'
import { CommandPalette } from './CommandPalette'

export function TopToolbar() {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  
  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])
  
  // Listen for Cmd/Ctrl+K to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])
  
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.()
    } else {
      document.exitFullscreen?.()
    }
  }
  const { data: systemInfo, loading } = useApiData(() => apiClient.getSystemInfo())
  const { data: healthData, loading: healthLoading, error: healthError } = useApiData(() => apiClient.getHealth())
  
  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      // Trigger refresh by calling the API directly
      apiClient.getSystemInfo().catch(() => {})
      apiClient.getHealth().catch(() => {})
      apiClient.getSystemStatus().catch(() => {})
    }, 30000)
    
    return () => clearInterval(interval)
  }, [])



  const getConnectionStatus = () => {
    // Show loading state during initial load or when refreshing
    if (loading || healthLoading) return { 
      status: 'connecting', 
      label: 'SYSTEM API',
      color: 'text-[#ffaa40]', 
      icon: (
        <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      )
    }
    
    // Show error state if health check failed
    if (healthError || !healthData) return { 
      status: 'offline', 
      label: 'SYSTEM API',
      color: 'text-[#e94057]', 
      icon: (
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )
    }
    
    // Show online state when health data is available
    return { 
      status: 'online', 
      label: 'SYSTEM API',
      color: 'text-[#10b981]', 
      icon: (
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )
    }
  }

  const getDockerStatus = () => {
    if (!systemInfo?.docker_status || systemInfo.docker_status !== 'connected') {
      return { 
        status: 'disconnected', 
        color: 'text-[#e94057]', 
        icon: (
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        )
      }
    }
    return { 
      status: 'connected', 
      color: 'text-[#10b981]', 
      icon: (
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
        </svg>
      )
    }
  }

  const connection = getConnectionStatus()
  const docker = getDockerStatus()

  return (
    <div class="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 shadow-sm px-4 py-2">
      <div class="flex items-center justify-between w-full">
        {/* Left side - System Status */}
        <div class="flex items-center gap-3 overflow-x-auto">
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gradient-to-r from-green-50/80 to-emerald-50/80 dark:from-gray-800/80 dark:to-gray-700/80 border border-green-200/50 dark:border-gray-600/50 shadow-sm flex-shrink-0">
            <div class={connection.color}>{connection.icon}</div>
            <span class={`text-xs font-mono ${connection.color}`}>
              {connection.status === 'connecting' ? 'Connecting...' : connection.status.toUpperCase()}
            </span>
          </div>
          
          <div class="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gradient-to-r from-blue-50/80 to-cyan-50/80 dark:from-gray-800/80 dark:to-gray-700/80 border border-blue-200/50 dark:border-gray-600/50 shadow-sm flex-shrink-0">
            <div class={docker.color}>{docker.icon}</div>
            <span class="text-gray-600 dark:text-gray-300 text-xs font-medium hidden sm:inline">
              Docker
            </span>
          </div>

        </div>

        {/* Center - Search */}
        <div class="flex-1 max-w-md mx-4">
          <button 
            id="global-search-trigger"
            onClick={() => setIsSearchOpen(true)}
            class="w-full flex items-center gap-3 px-4 py-2 rounded-lg bg-gray-100/50 dark:bg-gray-800/50 border border-gray-300/50 dark:border-gray-600/50 text-gray-500 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-all duration-200"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span class="text-sm">Search projects, services, routes...</span>
            <div class="flex items-center gap-1 ml-auto">
              <kbd class="px-2 py-0.5 text-xs font-mono bg-gray-200 dark:bg-gray-700 rounded border">⌘</kbd>
              <kbd class="px-2 py-0.5 text-xs font-mono bg-gray-200 dark:bg-gray-700 rounded border">K</kbd>
            </div>
          </button>
        </div>

        {/* Right side - Controls */}
        <div class="flex items-center gap-2">
          {/* Status Indicator */}
          <div class="flex items-center gap-2 px-2 py-1">
            <div class={`w-2 h-2 rounded-full ${loading ? 'bg-[#ffaa40] animate-pulse' : 'bg-[#10b981]'}`} />
          </div>
          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            class="flex items-center gap-2 px-3 py-1.5 rounded-md bg-gradient-to-r from-purple-50/80 to-violet-50/80 dark:from-gray-800/80 dark:to-gray-700/80 border border-purple-200/50 dark:border-gray-600/50 shadow-sm hover:bg-gradient-to-r hover:from-purple-100/80 hover:to-violet-100/80 dark:hover:from-gray-700/80 dark:hover:to-gray-600/80 transition-all duration-200"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? (
              <svg class="w-3 h-3 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9v-4.5M15 9h4.5M15 9l5.5-5.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 15v4.5M15 15h4.5M15 15l5.5 5.5" />
              </svg>
            ) : (
              <svg class="w-3 h-3 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
            <span class="text-gray-600 dark:text-gray-300 text-xs font-medium hidden lg:inline">
              {isFullscreen ? "Exit" : "Full"}
            </span>
          </button>

          {/* Theme Toggle */}
          <ThemeToggle />
        </div>
      </div>
      
      {/* Command Palette */}
      <CommandPalette 
        isOpen={isSearchOpen} 
        onClose={() => setIsSearchOpen(false)} 
      />
    </div>
  )
}