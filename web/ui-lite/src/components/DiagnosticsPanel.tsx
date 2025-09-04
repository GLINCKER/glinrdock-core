import { useState, useEffect } from 'preact/hooks'
import { apiClient } from '../api'

interface DiagnosticsPanelProps {
  isVisible: boolean
  onClose: () => void
}

export function DiagnosticsPanel({ isVisible, onClose }: DiagnosticsPanelProps) {
  const [diagnostics, setDiagnostics] = useState<any[]>([])
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    if (isVisible) {
      setDiagnostics(apiClient.getDiagnostics())
    }
  }, [isVisible, refreshKey])

  const refresh = () => {
    setRefreshKey(k => k + 1)
  }

  const clear = () => {
    apiClient.clearDiagnostics()
    setDiagnostics([])
  }

  const copyDiagnostics = async () => {
    const data = JSON.stringify({
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      diagnostics
    }, null, 2)
    
    try {
      await navigator.clipboard.writeText(data)
      const button = document.activeElement as HTMLButtonElement
      if (button) {
        const originalText = button.textContent
        button.textContent = 'Copied!'
        button.disabled = true
        setTimeout(() => {
          button.textContent = originalText
          button.disabled = false
        }, 1500)
      }
    } catch (err) {
      console.warn('Failed to copy diagnostics:', err)
    }
  }

  if (!isVisible) return null

  return (
    <div class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div class="bg-gray-800 border border-gray-700 rounded-lg max-w-4xl w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div class="flex items-center justify-between p-4 border-b border-gray-700">
          <div class="flex items-center space-x-2">
            <div class="w-5 h-5 text-blue-400">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 class="text-white font-medium">API Diagnostics</h2>
            <span class="text-gray-400 text-sm">({diagnostics.length}/5)</span>
          </div>
          
          <div class="flex items-center space-x-2">
            <button
              onClick={refresh}
              class="text-gray-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-gray-700 transition-colors"
            >
              Refresh
            </button>
            <button
              onClick={clear}
              class="text-gray-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-gray-700 transition-colors"
              disabled={diagnostics.length === 0}
            >
              Clear
            </button>
            <button
              onClick={copyDiagnostics}
              class="text-gray-400 hover:text-white text-sm px-2 py-1 rounded hover:bg-gray-700 transition-colors"
              disabled={diagnostics.length === 0}
            >
              Copy All
            </button>
            <button
              onClick={onClose}
              class="text-gray-400 hover:text-white ml-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div class="flex-1 overflow-auto p-4">
          {diagnostics.length === 0 ? (
            <div class="text-center py-8 text-gray-400">
              <div class="w-12 h-12 mx-auto mb-3 text-gray-500">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p class="text-sm">No API failures recorded</p>
              <p class="text-xs mt-1">Failed requests will appear here</p>
            </div>
          ) : (
            <div class="space-y-3">
              {diagnostics.map((entry, index) => (
                <div key={index} class="bg-gray-900/50 border border-gray-700 rounded p-3">
                  <div class="flex items-start justify-between mb-2">
                    <div class="flex items-center space-x-2">
                      <span class={`px-2 py-1 rounded text-xs font-mono ${
                        entry.status >= 500 ? 'bg-red-500/20 text-red-400' :
                        entry.status >= 400 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {entry.method}
                      </span>
                      {entry.status && (
                        <span class={`px-2 py-1 rounded text-xs font-mono ${
                          entry.status >= 500 ? 'bg-red-500/20 text-red-400' :
                          entry.status >= 400 ? 'bg-yellow-500/20 text-yellow-400' :
                          'bg-green-500/20 text-green-400'
                        }`}>
                          {entry.status}
                        </span>
                      )}
                    </div>
                    <div class="text-right">
                      <div class="text-xs text-gray-400 font-mono">
                        {entry.requestId}
                      </div>
                      <div class="text-xs text-gray-500 mt-1">
                        {entry.duration}ms
                      </div>
                    </div>
                  </div>
                  
                  <div class="mb-2">
                    <div class="text-xs text-gray-400 mb-1">URL:</div>
                    <div class="text-sm font-mono text-gray-300 break-all bg-gray-800 px-2 py-1 rounded">
                      {entry.url}
                    </div>
                  </div>
                  
                  <div class="mb-2">
                    <div class="text-xs text-gray-400 mb-1">Error:</div>
                    <div class="text-sm text-red-300 bg-red-900/20 px-2 py-1 rounded break-words">
                      {entry.error}
                    </div>
                  </div>
                  
                  <div class="text-xs text-gray-500 font-mono">
                    {new Date(entry.timestamp).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div class="border-t border-gray-700 p-3">
          <div class="text-xs text-gray-500 text-center">
            Shows last {diagnostics.length > 0 ? diagnostics.length : 5} API failures • 
            Press F12 → Console for detailed logs • 
            Add ?debug=1 to URL to enable debug mode
          </div>
        </div>
      </div>
    </div>
  )
}

// Hook to detect debug mode and manage diagnostics panel
export function useDiagnostics() {
  const [isVisible, setIsVisible] = useState(false)
  const [debugMode, setDebugMode] = useState(false)

  useEffect(() => {
    // Check for debug mode in URL
    const hasDebugParam = new URLSearchParams(window.location.search).has('debug')
    setDebugMode(hasDebugParam)

    if (hasDebugParam) {
      // Add keyboard shortcut for diagnostics panel
      const handleKeyPress = (e: KeyboardEvent) => {
        if (e.key === 'D' && e.shiftKey && e.ctrlKey) {
          e.preventDefault()
          setIsVisible(prev => !prev)
        }
      }

      window.addEventListener('keydown', handleKeyPress)
      return () => window.removeEventListener('keydown', handleKeyPress)
    }
  }, [])

  return {
    debugMode,
    isVisible,
    show: () => setIsVisible(true),
    hide: () => setIsVisible(false),
    toggle: () => setIsVisible(prev => !prev)
  }
}