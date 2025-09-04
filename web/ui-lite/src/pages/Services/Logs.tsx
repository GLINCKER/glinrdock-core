import { useState, useEffect, useRef } from 'preact/hooks'
import { apiClient, useApiData } from '../../api'

interface ServiceLogsPageProps {
  serviceId: string
  onBack?: () => void
}

export function ServiceLogsPage({ serviceId, onBack }: ServiceLogsPageProps) {
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [tailLines, setTailLines] = useState(100)
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true)
  const [isLogsFullscreen, setIsLogsFullscreen] = useState(false)
  const [showExportDropdown, setShowExportDropdown] = useState(false)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const exportDropdownRef = useRef<HTMLDivElement>(null)

  // Get service info for display
  const { data: service } = useApiData(() => apiClient.getService(serviceId))

  const fetchLogs = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await apiClient.getServiceLogs(serviceId, tailLines)
      setLogs(response.logs || [])
    } catch (err) {
      console.error('Failed to fetch logs:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch logs')
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
      setIsScrolledToBottom(true)
    }
  }

  const handleScroll = () => {
    if (logContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = logContainerRef.current
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10
      setIsScrolledToBottom(isAtBottom)
    }
  }

  // Initial fetch and setup polling
  useEffect(() => {
    fetchLogs()
    
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchLogs, 3000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [autoRefresh, tailLines, serviceId])

  // Auto-scroll to bottom when new logs arrive (only if user was already at bottom)
  useEffect(() => {
    if (logs.length > 0 && isScrolledToBottom) {
      setTimeout(scrollToBottom, 100)
    }
  }, [logs])

  // Handle clicking outside export dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportDropdownRef.current && !exportDropdownRef.current.contains(event.target as Node)) {
        setShowExportDropdown(false)
      }
    }

    if (showExportDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showExportDropdown])

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh)
  }

  const handleTailLinesChange = (e: Event) => {
    const target = e.target as HTMLSelectElement
    setTailLines(parseInt(target.value))
  }

  const toggleLogsFullscreen = () => {
    setIsLogsFullscreen(!isLogsFullscreen)
  }

  const exportLogs = (format: 'txt' | 'json' | 'csv') => {
    if (logs.length === 0) {
      alert('No logs to export')
      return
    }

    const serviceName = service?.name || `service-${serviceId}`
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    const filename = `${serviceName}-logs-${timestamp}.${format}`
    
    let content = ''
    let mimeType = ''

    switch (format) {
      case 'txt':
        content = logs.join('\n')
        mimeType = 'text/plain'
        break
        
      case 'json':
        const jsonData = {
          service_id: serviceId,
          service_name: service?.name || null,
          exported_at: new Date().toISOString(),
          total_lines: logs.length,
          logs: logs.map((line, index) => ({
            line_number: index + 1,
            content: line
          }))
        }
        content = JSON.stringify(jsonData, null, 2)
        mimeType = 'application/json'
        break
        
      case 'csv':
        // CSV format with line number and content
        content = 'Line,Content\n' + logs.map((line, index) => 
          `${index + 1},"${line.replace(/"/g, '""')}"`
        ).join('\n')
        mimeType = 'text/csv'
        break
    }

    // Create and trigger download
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <div class={`fade-in ${isLogsFullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col' : 'space-y-6'}`}>
      {/* Header - Hidden in fullscreen mode */}
      {!isLogsFullscreen && (
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-4">
            {onBack && (
              <button
                onClick={onBack}
                class="p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors"
                title="Back to Service Detail"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            
            <div>
              <h1 class="text-3xl font-bold mb-2">
                <span class="bg-gradient-to-r from-[#8b008b] via-[#9c40ff] to-[#e94057] bg-clip-text text-transparent">
                  Service Logs
                </span>
              </h1>
              <p class="text-gray-600 dark:text-gray-400">
                {service ? `Viewing logs for ${service.name} (ID: ${serviceId})` : `Viewing logs for service ${serviceId}`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div class="bg-gradient-to-r from-white/95 via-gray-50/90 to-white/95 dark:from-gray-800/95 dark:via-gray-900/90 dark:to-gray-800/95 rounded-2xl p-6 shadow-lg">
        <div class="flex flex-wrap items-center gap-4">
          {/* Line Count Selector */}
          <div class="flex items-center space-x-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Lines:</label>
            <select 
              value={tailLines} 
              onChange={handleTailLinesChange}
              class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
              <option value={500}>500</option>
              <option value={1000}>1000</option>
            </select>
          </div>

          {/* Auto-refresh Toggle */}
          <div class="flex items-center space-x-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Auto-refresh:</label>
            <label class="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                class="sr-only peer" 
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh((e.target as HTMLInputElement).checked)}
              />
              <div class="w-11 h-6 bg-gray-300 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchLogs}
            disabled={loading}
            class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <svg class="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            Refresh
          </button>
          
          {/* Export Dropdown */}
          <div class="relative" ref={exportDropdownRef}>
            <button
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              disabled={logs.length === 0}
              title="Export logs"
            >
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export
              <svg class="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {showExportDropdown && (
              <div class="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white dark:bg-gray-700 ring-1 ring-black ring-opacity-5 z-10">
                <div class="py-1">
                  <button
                    onClick={() => {
                      exportLogs('txt')
                      setShowExportDropdown(false)
                    }}
                    class="group flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                  >
                    <svg class="w-4 h-4 mr-3 text-gray-400 group-hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export as TXT
                  </button>
                  <button
                    onClick={() => {
                      exportLogs('json')
                      setShowExportDropdown(false)
                    }}
                    class="group flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                  >
                    <svg class="w-4 h-4 mr-3 text-gray-400 group-hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Export as JSON
                  </button>
                  <button
                    onClick={() => {
                      exportLogs('csv')
                      setShowExportDropdown(false)
                    }}
                    class="group flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600 w-full text-left"
                  >
                    <svg class="w-4 h-4 mr-3 text-gray-400 group-hover:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0V4a1 1 0 011-1h14a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1z" />
                    </svg>
                    Export as CSV
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Logs Fullscreen Toggle */}
          <button
            onClick={toggleLogsFullscreen}
            class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            title={isLogsFullscreen ? "Exit Logs Focus Mode" : "Enter Logs Focus Mode"}
          >
            {isLogsFullscreen ? (
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9v-4.5M15 9h4.5M15 9l5.5-5.5M9 15v4.5M9 15H4.5M9 15l-5.5 5.5M15 15v4.5M15 15h4.5M15 15l5.5 5.5" />
              </svg>
            ) : (
              <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
              </svg>
            )}
            Focus
          </button>

          {/* Scroll to Bottom Button */}
          <button 
            onClick={scrollToBottom}
            class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            Scroll to Bottom
          </button>
        </div>

        {/* Service Info */}
        {service && (
          <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800/30">
            <div class="flex items-start space-x-2">
              <svg class="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="text-sm">
                <div class="font-medium text-blue-800 dark:text-blue-200">
                  {service.name}
                </div>
                <div class="text-blue-600 dark:text-blue-300 mt-1">
                  {service.description || 'Service container logs'}
                </div>
                <div class="text-blue-500 dark:text-blue-400 text-xs font-mono mt-1">
                  Service ID: {serviceId}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg p-4">
          <div class="flex items-center space-x-2">
            <svg class="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div class="text-red-800 dark:text-red-200">
              <div class="font-medium">Error loading logs</div>
              <div class="text-sm mt-1">{error}</div>
            </div>
          </div>
        </div>
      )}

      {/* Logs Display */}
      <div class={`bg-gradient-to-r from-white/95 via-gray-50/90 to-white/95 dark:from-gray-800/95 dark:via-gray-900/90 dark:to-gray-800/95 rounded-2xl shadow-lg overflow-hidden ${isLogsFullscreen ? 'flex-1' : ''}`}>
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              {isLogsFullscreen ? `${service?.name || `Service ${serviceId}`} - Log Output` : 'Log Output'}
            </h2>
            <div class="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
              {autoRefresh && (
                <div class="flex items-center space-x-1">
                  <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span>Auto-refreshing</span>
                </div>
              )}
              <span>{logs.length} lines</span>
            </div>
          </div>
        </div>

        <div class="relative">
          {loading && logs.length === 0 ? (
            <div class="flex items-center justify-center p-12">
              <div class="text-center">
                <svg class="w-8 h-8 text-gray-400 mx-auto mb-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <p class="text-gray-500 dark:text-gray-400 mt-4">Loading logs...</p>
              </div>
            </div>
          ) : logs.length === 0 ? (
            <div class="flex items-center justify-center p-12">
              <div class="text-center">
                <svg class="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No logs available</h3>
                <p class="text-gray-500 dark:text-gray-400 mb-4">
                  The service container has no log output yet or the container is not running.
                </p>
              </div>
            </div>
          ) : (
            <div 
              ref={logContainerRef}
              onScroll={handleScroll}
              class={`bg-gray-900 dark:bg-black text-sm font-mono overflow-auto ${isLogsFullscreen ? 'h-full' : 'max-h-96'}`}
            >
              <div class="p-4 space-y-1">
                {logs.map((line, index) => (
                  <div key={index} class="flex items-start space-x-3 hover:bg-gray-800 dark:hover:bg-gray-900 px-2 py-1 rounded">
                    <span class="text-gray-400 text-xs whitespace-nowrap flex-shrink-0 mt-0.5 w-10 text-right">
                      {String(index + 1).padStart(3, ' ')}
                    </span>
                    <span class="text-gray-100 whitespace-pre-wrap break-all flex-1">
                      {line}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}