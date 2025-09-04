import { useState, useEffect, useRef } from 'preact/hooks'
import { apiClient } from '../api'

interface LogsDrawerProps {
  isOpen: boolean
  onClose: () => void
  serviceId: string
  serviceName: string
}

// Using the LogsResponse type from the API call directly

export function LogsDrawer({ isOpen, onClose, serviceId, serviceName }: LogsDrawerProps) {
  const [logs, setLogs] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [tailLines, setTailLines] = useState(50)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const fetchLogs = async () => {
    if (!isOpen) return
    
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
    }
  }

  // Initial fetch and setup polling
  useEffect(() => {
    if (isOpen) {
      fetchLogs()
      
      if (autoRefresh) {
        intervalRef.current = setInterval(fetchLogs, 3000)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [isOpen, autoRefresh, tailLines, serviceId])

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logs.length > 0) {
      setTimeout(scrollToBottom, 100)
    }
  }, [logs])

  const toggleAutoRefresh = () => {
    setAutoRefresh(!autoRefresh)
  }

  const handleTailLinesChange = (e: Event) => {
    const target = e.target as HTMLSelectElement
    setTailLines(parseInt(target.value))
  }

  if (!isOpen) return null

  return (
    <div class="fixed inset-0 z-[9999] flex">
      {/* Backdrop */}
      <div 
        class="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Drawer */}
      <div class="ml-auto relative w-full max-w-4xl bg-white dark:bg-gray-800 shadow-2xl border-l border-gray-200 dark:border-gray-700 animate-slide-in">
        {/* Header */}
        <div class="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Service Logs</h2>
            <p class="text-sm text-gray-600 dark:text-gray-300">{serviceName}</p>
          </div>
          
          <div class="flex items-center gap-3">
            {/* Tail Lines Selector */}
            <div class="flex items-center gap-2">
              <label class="text-sm text-gray-600 dark:text-gray-300">Lines:</label>
              <select 
                value={tailLines} 
                onChange={handleTailLinesChange}
                class="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value={200}>200</option>
                <option value={500}>500</option>
              </select>
            </div>

            {/* Auto Refresh Toggle */}
            <button
              onClick={toggleAutoRefresh}
              class={`px-3 py-1.5 text-sm rounded transition-colors ${
                autoRefresh 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {autoRefresh ? '🟢 Auto' : '⏸️ Manual'}
            </button>

            {/* Refresh Button */}
            <button
              onClick={fetchLogs}
              disabled={loading}
              class="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors disabled:opacity-50"
            >
              {loading ? '⏳' : '🔄'} Refresh
            </button>
            
            {/* Close Button */}
            <button
              onClick={onClose}
              class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div class="flex flex-col h-full">
          {/* Status Bar */}
          <div class="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between text-sm">
              <span class="text-gray-600 dark:text-gray-400">
                {error ? (
                  <span class="text-red-600 dark:text-red-400">❌ {error}</span>
                ) : (
                  <span>📄 {logs.length} lines {autoRefresh ? '• Auto-refreshing every 3s' : ''}</span>
                )}
              </span>
              {loading && (
                <span class="text-blue-600 dark:text-blue-400">⏳ Loading...</span>
              )}
            </div>
          </div>

          {/* Logs Container */}
          <div 
            ref={logContainerRef}
            class="flex-1 overflow-y-auto p-4 bg-gray-900 text-green-400 font-mono text-sm"
            style={{ minHeight: 'calc(100vh - 160px)' }}
          >
            {error ? (
              <div class="text-center py-8">
                <div class="text-red-400 text-lg mb-2">⚠️ Error Loading Logs</div>
                <div class="text-gray-400">{error}</div>
                <button 
                  onClick={fetchLogs}
                  class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            ) : logs.length === 0 ? (
              <div class="text-center py-8">
                {loading ? (
                  <div class="text-gray-400">⏳ Loading logs...</div>
                ) : (
                  <div class="text-gray-500">📭 No logs available</div>
                )}
              </div>
            ) : (
              <pre class="whitespace-pre-wrap break-all">
                {logs.map((line, index) => (
                  <div key={index} class="hover:bg-gray-800 px-2 py-0.5 -mx-2 rounded">
                    <span class="text-gray-500 mr-3 select-none">{String(index + 1).padStart(3, ' ')}│</span>
                    <span>{line}</span>
                  </div>
                ))}
              </pre>
            )}
          </div>

          {/* Footer */}
          <div class="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
            <div class="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
              <span>Service ID: {serviceId}</span>
              <div class="flex items-center gap-4">
                <button 
                  onClick={scrollToBottom}
                  class="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  ⬇️ Scroll to Bottom
                </button>
                <span>Press ESC to close</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}