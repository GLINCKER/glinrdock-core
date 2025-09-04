import { useState, useEffect } from 'preact/hooks'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { apiClient } from '../api'

interface LogEntry {
  timestamp?: string
  level?: string
  message: string
  raw: string
}

interface LogPath {
  path: string
  name: string
  description: string
}

interface LogsResponse {
  logs: string[]
}

interface LogPathsResponse {
  paths: LogPath[]
}

export function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logPaths, setLogPaths] = useState<LogPath[]>([])
  const [selectedPath, setSelectedPath] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lines, setLines] = useState(100)

  // Parse log line into structured format
  const parseLogLine = (line: string): LogEntry => {
    // Try to parse structured logs (JSON or timestamp prefix)
    const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?)/)
    const levelMatch = line.match(/\b(TRACE|DEBUG|INFO|WARN|ERROR|FATAL|PANIC)\b/i)
    
    return {
      timestamp: timestampMatch?.[1],
      level: levelMatch?.[1]?.toUpperCase(),
      message: line.replace(/^[^\]]*\]\s*/, '').replace(/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?\s*/, ''),
      raw: line
    }
  }

  // Fetch available log paths
  const fetchLogPaths = async () => {
    try {
      const data = await apiClient.getLogPaths()
      const paths = data.log_paths || data.paths || []
      setLogPaths(paths.map((path: any) => ({
        path: path.path,
        name: path.name, 
        description: path.description
      })))
      
      // Select first path by default
      if (paths && paths.length > 0 && !selectedPath) {
        setSelectedPath(paths[0].path)
      }
    } catch (err) {
      console.error('Failed to fetch log paths:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch log paths')
    }
  }

  // Fetch logs for selected path
  const fetchLogs = async (path?: string) => {
    if (!path && !selectedPath) return

    setLoading(true)
    setError('')

    try {
      const logPath = path || selectedPath
      const data = await apiClient.getSystemLogs(logPath, lines)
      const parsedLogs = (data.logs || []).map(parseLogLine)
      setLogs(parsedLogs)
    } catch (err) {
      console.error('Failed to fetch logs:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch logs')
    } finally {
      setLoading(false)
    }
  }

  // Handle path selection
  const handlePathChange = (path: string) => {
    setSelectedPath(path)
    fetchLogs(path)
  }

  // Handle line count change
  const handleLinesChange = (newLines: number) => {
    setLines(newLines)
    if (selectedPath) {
      fetchLogs()
    }
  }

  // Auto-refresh logic
  useEffect(() => {
    let interval: number
    
    if (autoRefresh && selectedPath) {
      interval = window.setInterval(() => {
        fetchLogs()
      }, 5000) // Refresh every 5 seconds
    }

    return () => {
      if (interval) {
        clearInterval(interval)
      }
    }
  }, [autoRefresh, selectedPath, lines])

  // Initial load
  useEffect(() => {
    fetchLogPaths()
  }, [])

  // Fetch logs when path is selected
  useEffect(() => {
    if (selectedPath) {
      fetchLogs()
    }
  }, [selectedPath])

  // Get color for log level
  const getLevelColor = (level?: string) => {
    switch (level) {
      case 'ERROR':
      case 'FATAL':
      case 'PANIC':
        return 'text-red-400'
      case 'WARN':
        return 'text-yellow-400'
      case 'INFO':
        return 'text-blue-400'
      case 'DEBUG':
        return 'text-gray-400'
      case 'TRACE':
        return 'text-gray-500'
      default:
        return 'text-gray-300'
    }
  }

  // Format timestamp
  const formatTimestamp = (timestamp?: string) => {
    if (!timestamp) return ''
    
    try {
      const date = new Date(timestamp)
      return date.toLocaleTimeString()
    } catch {
      return timestamp
    }
  }

  return (
    <div class="space-y-6 fade-in">
      {/* Header */}
      <div>
        <h1 class="text-3xl font-bold mb-2">
          <span class="bg-gradient-to-r from-[#8b008b] via-[#9c40ff] to-[#e94057] bg-clip-text text-transparent">
            System Logs
          </span>
        </h1>
        <p class="text-gray-600 dark:text-gray-400">View and monitor system logs in real-time</p>
      </div>

      {/* Controls */}
      <div class="bg-gradient-to-r from-white/95 via-gray-50/90 to-white/95 dark:from-gray-800/95 dark:via-gray-900/90 dark:to-gray-800/95 rounded-2xl p-6 shadow-lg">
        <div class="flex flex-wrap items-center gap-4">
          {/* Log Source Selector */}
          <div class="flex items-center space-x-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Source:</label>
            <select 
              value={selectedPath}
              onChange={(e) => handlePathChange((e.target as HTMLSelectElement).value)}
              class="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select log source...</option>
              {logPaths.map((path) => (
                <option key={path.path} value={path.path}>
                  {path.name}
                </option>
              ))}
            </select>
          </div>

          {/* Line Count Selector */}
          <div class="flex items-center space-x-2">
            <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Lines:</label>
            <select 
              value={lines}
              onChange={(e) => handleLinesChange(parseInt((e.target as HTMLSelectElement).value))}
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
            onClick={() => fetchLogs()}
            disabled={!selectedPath || loading}
            class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading && <LoadingSpinner size="sm" />}
            <svg class={`w-4 h-4 ${loading ? 'ml-2' : 'mr-2'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>

        {/* Selected Path Description */}
        {selectedPath && logPaths.length > 0 && (
          <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800/30">
            <div class="flex items-start space-x-2">
              <svg class="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div class="text-sm">
                <div class="font-medium text-blue-800 dark:text-blue-200">
                  {logPaths.find(p => p.path === selectedPath)?.name}
                </div>
                <div class="text-blue-600 dark:text-blue-300 mt-1">
                  {logPaths.find(p => p.path === selectedPath)?.description}
                </div>
                <div class="text-blue-500 dark:text-blue-400 text-xs font-mono mt-1">
                  {selectedPath}
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
      <div class="bg-gradient-to-r from-white/95 via-gray-50/90 to-white/95 dark:from-gray-800/95 dark:via-gray-900/90 dark:to-gray-800/95 rounded-2xl shadow-lg overflow-hidden">
        <div class="p-4 border-b border-gray-200 dark:border-gray-700">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Log Output</h2>
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
                <LoadingSpinner size="lg" />
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
                  {selectedPath ? 
                    'The selected log source has no entries or the log file doesn\'t exist yet' : 
                    'Please select a log source to view'
                  }
                </p>
                {selectedPath && error && (
                  <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-lg p-4 mt-4">
                    <div class="flex items-start space-x-2">
                      <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div class="text-sm">
                        <div class="font-medium text-blue-800 dark:text-blue-200 mb-2">
                          Development Environment
                        </div>
                        <div class="text-blue-600 dark:text-blue-300">
                          {error === 'failed to read logs' ? (
                            <div>
                              <p class="mb-2">Log files haven't been created yet in this development environment.</p>
                              <p class="text-xs mb-3">
                                <strong>Expected behavior:</strong> In production, system logs are automatically generated. 
                                In development, logs will appear once the system generates events.
                              </p>
                              <button 
                                onClick={() => {
                                  // Generate sample logs for demo purposes
                                  const sampleLogs = [
                                    "2025-01-27T15:30:00Z INFO Starting GLINR Dock system",
                                    "2025-01-27T15:30:01Z INFO Docker connection established", 
                                    "2025-01-27T15:30:02Z WARN No existing projects found",
                                    "2025-01-27T15:30:03Z INFO System ready for connections",
                                    "2025-01-27T15:30:04Z DEBUG Health check passed"
                                  ].map(parseLogLine)
                                  setLogs(sampleLogs)
                                  setError('')
                                }}
                                class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg transition-colors"
                              >
                                Show Sample Logs
                              </button>
                            </div>
                          ) : (
                            <p>Error: {error}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div class="bg-gray-900 dark:bg-black text-sm font-mono overflow-auto max-h-96">
              <div class="p-4 space-y-1">
                {logs.map((entry, index) => (
                  <div key={index} class="flex items-start space-x-3 hover:bg-gray-800 dark:hover:bg-gray-900 px-2 py-1 rounded">
                    {entry.timestamp && (
                      <span class="text-gray-400 text-xs whitespace-nowrap flex-shrink-0 mt-0.5">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    )}
                    {entry.level && (
                      <span class={`text-xs font-bold whitespace-nowrap flex-shrink-0 mt-0.5 ${getLevelColor(entry.level)}`}>
                        {entry.level}
                      </span>
                    )}
                    <span class="text-gray-100 whitespace-pre-wrap break-all flex-1">
                      {entry.message || entry.raw}
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