import { useState, useEffect } from 'preact/hooks'
import { PortMap, Registry, apiClient } from '../api'
import { Modal } from './Modal'
import { KVPairs } from './KVPairs'
import { PortsEditor } from './PortsEditor'
import { isDeployerSync } from '../rbac'

interface CreateServiceModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: {
    name: string
    image: string
    env?: Record<string, string>
    ports?: PortMap[]
    registry_id?: string
  }) => Promise<void>
  projectName?: string
}

export function CreateServiceModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  projectName 
}: CreateServiceModalProps) {
  const [name, setName] = useState('')
  const [image, setImage] = useState('')
  const [env, setEnv] = useState<Record<string, string>>({})
  const [ports, setPorts] = useState<PortMap[]>([])
  const [registryId, setRegistryId] = useState<string>('')
  const [registries, setRegistries] = useState<Registry[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const canSelectRegistry = isDeployerSync() // Deployers and admins can select registries

  // Load registries when modal opens
  useEffect(() => {
    if (isOpen && canSelectRegistry) {
      loadRegistries()
    }
  }, [isOpen, canSelectRegistry])

  const loadRegistries = async () => {
    try {
      const response = await apiClient.getRegistries()
      setRegistries(response.registries)
    } catch (err) {
      console.warn('Failed to load registries:', err)
      // Don't show error to user, registry selection is optional
    }
  }
  
  // Predefined popular Docker images with descriptions
  const popularImages = [
    { image: 'nginx:alpine', desc: 'Web server' },
    { image: 'node:18-alpine', desc: 'Node.js app' },
    { image: 'python:3.11-slim', desc: 'Python app' },
    { image: 'postgres:15', desc: 'Database' },
    { image: 'redis:alpine', desc: 'Cache' },
    { image: 'traefik:latest', desc: 'Proxy' },
    { image: 'mongo:6', desc: 'MongoDB' },
    { image: 'mysql:8', desc: 'MySQL' },
  ]

  const validateForm = () => {
    if (!name.trim()) {
      setError('Service name is required')
      return false
    }
    
    if (!image.trim()) {
      setError('Docker image is required')
      return false
    }

    // Validate service name (DNS-label friendly)
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(name)) {
      setError('Service name must be lowercase alphanumeric with hyphens (DNS-label friendly)')
      return false
    }

    // Check for port conflicts
    const hostPorts = ports.map(p => p.host).filter(p => p > 0)
    const uniqueHostPorts = new Set(hostPorts)
    if (hostPorts.length !== uniqueHostPorts.size) {
      setError('Host ports must be unique')
      return false
    }

    // Validate port ranges
    const invalidPorts = ports.filter(p => 
      p.container < 1 || p.container > 65535 || 
      p.host < 1 || p.host > 65535
    )
    if (invalidPorts.length > 0) {
      setError('Ports must be between 1 and 65535')
      return false
    }

    return true
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    try {
      setIsLoading(true)
      setError('')

      const serviceData = {
        name: name.trim(),
        image: image.trim(),
        env: Object.keys(env).length > 0 ? env : undefined,
        ports: ports.length > 0 ? ports : undefined,
        registry_id: registryId || undefined,
      }

      await onSubmit(serviceData)
      
      // Reset form and close
      setName('')
      setImage('')
      setEnv({})
      setPorts([])
      setRegistryId('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create service')
    } finally {
      setIsLoading(false)
    }
  }

  const resetForm = () => {
    setName('')
    setImage('')
    setEnv({})
    setPorts([])
    setRegistryId('')
    setError('')
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={handleClose} 
      title={`Deploy Service${projectName ? ` to ${projectName}` : ''}`} 
      size="lg"
    >
      <form onSubmit={handleSubmit} class="space-y-6">
        {/* Service Name */}
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Service Name *
          </label>
          <input
            type="text"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder="my-web-app"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-[#9c40ff] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
            required
          />
          <p class="text-xs text-gray-400 mt-1">
            Must be lowercase, alphanumeric with hyphens (DNS-friendly)
          </p>
        </div>

        {/* Docker Image */}
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Docker Image * 
            <span class="text-xs text-gray-400 font-normal ml-2">Choose from popular images or enter custom</span>
          </label>
          
          {/* Quick Suggestions */}
          <div class="mb-3">
            <p class="text-xs text-gray-400 mb-2">Popular images:</p>
            <div class="grid grid-cols-2 gap-2">
              {popularImages.map(({ image: img, desc }) => (
                <button
                  key={img}
                  type="button"
                  onClick={() => setImage(img)}
                  class="px-3 py-2 text-left text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-gray-700 dark:text-gray-300 transition-colors"
                  disabled={isLoading}
                  title={desc}
                >
                  <div class="font-medium">{img}</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">{desc}</div>
                </button>
              ))}
            </div>
          </div>
          
          <input
            type="text"
            value={image}
            onInput={(e) => setImage((e.target as HTMLInputElement).value)}
            placeholder="nginx:latest, node:18-alpine, or myregistry/myapp:v1.0"
            class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-[#9c40ff] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
            required
          />
          <p class="text-xs text-gray-400 mt-1">
            Use Docker Hub images or private registry URLs
          </p>
        </div>

        {/* Registry Selection */}
        {canSelectRegistry && registries.length > 0 && (
          <div>
            <label class="block text-sm font-medium text-gray-300 mb-2">
              Container Registry (optional)
              <span class="text-xs text-gray-400 font-normal ml-2">Select registry for private images</span>
            </label>
            <select
              value={registryId}
              onChange={(e) => setRegistryId((e.target as HTMLSelectElement).value)}
              class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#9c40ff] focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isLoading}
            >
              <option value="">No registry (use Docker Hub)</option>
              {registries.map((registry) => (
                <option key={registry.id} value={registry.id}>
                  {registry.name} ({registry.type})
                </option>
              ))}
            </select>
            <p class="text-xs text-gray-400 mt-1">
              Required for pulling private images from container registries
            </p>
          </div>
        )}

        {/* Environment Variables */}
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Environment Variables (optional)
          </label>
          <KVPairs
            value={env}
            onChange={setEnv}
            placeholder={{ key: 'NODE_ENV', value: 'production' }}
            disabled={isLoading}
          />
          <p class="text-xs text-gray-400 mt-1">
            Configuration variables for your service
          </p>
        </div>

        {/* Port Mappings */}
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Port Mappings (optional)
          </label>
          <PortsEditor
            value={ports}
            onChange={setPorts}
            disabled={isLoading}
          />
          <p class="text-xs text-gray-400 mt-1">
            Expose container ports to the host
          </p>
        </div>

        {error && (
          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p class="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div class="flex space-x-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            class="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || !name.trim() || !image.trim()}
            class="flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-[#9c40ff] to-[#8b008b] hover:from-[#8b008b] hover:to-[#9c40ff] rounded-lg shadow-lg shadow-[#9c40ff]/25 hover:shadow-xl hover:shadow-[#9c40ff]/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-[#9c40ff]/25"
          >
            {isLoading && (
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            <svg class={`w-4 h-4 mr-2 ${isLoading ? 'hidden' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            <span>{isLoading ? 'Deploying...' : 'Deploy Service'}</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}