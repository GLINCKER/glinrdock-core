import { useState } from 'preact/hooks'
import { PortMap } from '../api'

interface PortsEditorProps {
  value: PortMap[]
  onChange: (value: PortMap[]) => void
  disabled?: boolean
}

export function PortsEditor({ value, onChange, disabled = false }: PortsEditorProps) {
  const [ports, setPorts] = useState<PortMap[]>(() => 
    value.length > 0 ? value : [{ container: 80, host: 80 }]
  )

  const updateValue = (newPorts: PortMap[]) => {
    setPorts(newPorts)
    onChange(newPorts.filter(port => port.container > 0 && port.host > 0))
  }

  const handlePortChange = (index: number, field: 'container' | 'host', newValue: string) => {
    const numValue = parseInt(newValue) || 0
    if (numValue < 0 || numValue > 65535) return // Basic port validation
    
    const newPorts = [...ports]
    newPorts[index] = { ...newPorts[index], [field]: numValue }
    updateValue(newPorts)
  }

  const addPort = () => {
    // Find next available port
    const usedPorts = new Set(ports.map(p => p.host))
    let nextPort = 8080
    while (usedPorts.has(nextPort) && nextPort < 65535) {
      nextPort++
    }
    
    updateValue([...ports, { container: 80, host: nextPort }])
  }

  const removePort = (index: number) => {
    if (ports.length > 1) {
      const newPorts = ports.filter((_, i) => i !== index)
      updateValue(newPorts)
    }
  }

  const validatePortConflict = (port: PortMap, currentIndex: number): boolean => {
    return ports.some((p, i) => 
      i !== currentIndex && p.host === port.host && p.host > 0
    )
  }

  const getPortInfo = (portNum: number) => {
    const portTypes = {
      // Web servers
      80: { type: 'HTTP', category: 'web', warning: false },
      443: { type: 'HTTPS', category: 'web', warning: false },
      3000: { type: 'Development Server', category: 'dev', warning: false },
      8080: { type: 'HTTP Alternate', category: 'web', warning: false },
      8443: { type: 'HTTPS Alternate', category: 'web', warning: false },
      5000: { type: 'Flask/Development', category: 'dev', warning: false },
      
      // Databases
      5432: { type: 'PostgreSQL', category: 'database', warning: false },
      3306: { type: 'MySQL', category: 'database', warning: false },
      27017: { type: 'MongoDB', category: 'database', warning: false },
      6379: { type: 'Redis', category: 'cache', warning: false },
      
      // System/Sensitive ports
      22: { type: 'SSH', category: 'system', warning: true },
      21: { type: 'FTP', category: 'system', warning: true },
      25: { type: 'SMTP', category: 'system', warning: true },
      53: { type: 'DNS', category: 'system', warning: true },
      993: { type: 'IMAPS', category: 'system', warning: true },
      995: { type: 'POP3S', category: 'system', warning: true },
    };
    
    return portTypes[portNum] || { type: 'Custom', category: 'custom', warning: portNum < 1024 };
  }

  return (
    <div class="space-y-3">
      <div class="text-sm text-gray-600 dark:text-gray-400">
        Map container ports to host ports
      </div>
      
      {ports.map((port, index) => {
        const hasConflict = validatePortConflict(port, index)
        const containerPortInfo = getPortInfo(port.container)
        const hostPortInfo = getPortInfo(port.host)
        
        return (
          <div key={index} class="flex items-center space-x-3">
            <div class="flex items-center space-x-2 flex-1">
              <div class="flex-1">
                <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Container Port
                </label>
                <input
                  type="number"
                  min="1"
                  max="65535"
                  value={port.container || ''}
                  onInput={(e) => handlePortChange(index, 'container', (e.target as HTMLInputElement).value)}
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-[#9c40ff] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={disabled}
                  placeholder="80"
                />
                {port.container > 0 && containerPortInfo.type !== 'Custom' && (
                  <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {containerPortInfo.type}
                  </p>
                )}
              </div>
              
              <div class="flex items-center justify-center mt-6">
                <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              
              <div class="flex-1">
                <label class="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Host Port
                </label>
                <input
                  type="number"
                  min="1"
                  max="65535"
                  value={port.host || ''}
                  onInput={(e) => handlePortChange(index, 'host', (e.target as HTMLInputElement).value)}
                  class={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed ${
                    hasConflict 
                      ? 'border-red-500 dark:border-red-500 focus:ring-red-500' 
                      : hostPortInfo.warning
                        ? 'border-orange-400 dark:border-orange-500 focus:ring-orange-500'
                        : 'border-gray-300 dark:border-gray-600 focus:ring-[#9c40ff]'
                  }`}
                  disabled={disabled}
                  placeholder="80"
                />
                {hasConflict && (
                  <p class="mt-1 text-xs text-red-600 dark:text-red-400 flex items-center">
                    <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                    Port {port.host} is already mapped
                  </p>
                )}
                {!hasConflict && port.host > 0 && (
                  <div class="mt-1 flex items-center justify-between">
                    <p class="text-xs text-gray-500 dark:text-gray-400">
                      {hostPortInfo.type}
                      {hostPortInfo.category === 'system' && (
                        <span class="ml-1 text-orange-600 dark:text-orange-400">• System port</span>
                      )}
                    </p>
                    {hostPortInfo.warning && (
                      <span class="inline-flex items-center text-xs text-orange-600 dark:text-orange-400">
                        <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z"/>
                        </svg>
                        Security risk
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            <div class="flex items-center space-x-1 mt-6">
              {ports.length > 1 && (
                <button
                  type="button"
                  onClick={() => removePort(index)}
                  disabled={disabled}
                  class="p-1.5 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Remove port mapping"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          </div>
        )
      })}
      
      {!disabled && (
        <button
          type="button"
          onClick={addPort}
          class="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Add Port Mapping</span>
        </button>
      )}

      {/* Enhanced Port Suggestions with Categories */}
      {!disabled && (
        <div class="border-t border-gray-200 dark:border-gray-600 pt-4 space-y-3">
          <div>
            <p class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Web Servers:</p>
            <div class="flex flex-wrap gap-1">
              {[
                { port: 80, label: 'HTTP' },
                { port: 443, label: 'HTTPS' },
                { port: 3000, label: 'Dev' },
                { port: 8080, label: 'Alt HTTP' },
                { port: 8443, label: 'Alt HTTPS' },
                { port: 5000, label: 'Flask' }
              ].map(({ port, label }) => (
                <button
                  key={port}
                  type="button"
                  onClick={() => {
                    const usedPorts = new Set(ports.map(p => p.host))
                    if (!usedPorts.has(port)) {
                      updateValue([...ports, { container: port, host: port }])
                    }
                  }}
                  disabled={ports.some(p => p.host === port)}
                  class="inline-flex items-center px-2 py-1 text-xs bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={`Add ${label} server (${port}:${port})`}
                >
                  {port}
                  <span class="ml-1 text-blue-500 dark:text-blue-400">·{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Databases:</p>
            <div class="flex flex-wrap gap-1">
              {[
                { port: 5432, label: 'PostgreSQL' },
                { port: 3306, label: 'MySQL' },
                { port: 27017, label: 'MongoDB' },
                { port: 6379, label: 'Redis' }
              ].map(({ port, label }) => (
                <button
                  key={port}
                  type="button"
                  onClick={() => {
                    const usedPorts = new Set(ports.map(p => p.host))
                    if (!usedPorts.has(port)) {
                      updateValue([...ports, { container: port, host: port }])
                    }
                  }}
                  disabled={ports.some(p => p.host === port)}
                  class="inline-flex items-center px-2 py-1 text-xs bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded border border-purple-200 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={`Add ${label} database (${port}:${port})`}
                >
                  {port}
                  <span class="ml-1 text-purple-500 dark:text-purple-400">·{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <p class="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Development:</p>
            <div class="flex flex-wrap gap-1">
              {[
                { port: 4000, label: 'Node' },
                { port: 8000, label: 'Django' },
                { port: 9000, label: 'PHP-FPM' },
                { port: 3001, label: 'React' }
              ].map(({ port, label }) => (
                <button
                  key={port}
                  type="button"
                  onClick={() => {
                    const usedPorts = new Set(ports.map(p => p.host))
                    if (!usedPorts.has(port)) {
                      updateValue([...ports, { container: port, host: port }])
                    }
                  }}
                  disabled={ports.some(p => p.host === port)}
                  class="inline-flex items-center px-2 py-1 text-xs bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300 rounded border border-green-200 dark:border-green-700 hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={`Add ${label} server (${port}:${port})`}
                >
                  {port}
                  <span class="ml-1 text-green-500 dark:text-green-400">·{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}