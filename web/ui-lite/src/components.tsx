// Reusable UI Components for GLINR Dock UI-Lite
import { useState } from 'preact/hooks'
import { X } from 'lucide-preact'

// Generic Modal Component
interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: any
  size?: 'sm' | 'md' | 'lg'
}

export function Modal({ isOpen, onClose, title, children, size = 'md' }: ModalProps) {
  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md', 
    lg: 'max-w-2xl'
  }

  return (
    <div class="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        class="absolute inset-0 bg-black/60 backdrop-blur-md"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div class={`relative w-full ${sizeClasses[size]} max-h-[90vh] overflow-y-auto bg-white/90 dark:bg-black backdrop-blur-2xl border border-white/20 dark:border-gray-800 ring-1 ring-white/10 dark:ring-gray-700/20 rounded-xl shadow-2xl animate-fade-in`}>
        {/* Header */}
        <div class="flex items-center justify-between px-6 py-4 border-b bg-gradient-to-r from-white/60 to-white/40 dark:from-gray-800/60 dark:to-gray-800/40 border-white/20 dark:border-gray-800 rounded-t-xl">
          <h2 class="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            class="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-all duration-200 p-1.5 rounded-lg hover:bg-white/40 dark:hover:bg-gray-700/40 group"
          >
            <X size={18} class="group-hover:scale-110 transition-transform duration-200" />
          </button>
        </div>
        
        {/* Content */}
        <div class="p-6">
          {children}
        </div>
      </div>
    </div>
  )
}

// Toast Notification Component
interface ToastProps {
  message: string
  type: 'success' | 'error' | 'info'
  isVisible: boolean
  onClose: () => void
}

export function Toast({ message, type, isVisible, onClose }: ToastProps) {
  if (!isVisible) return null

  const typeStyles = {
    success: 'toast-success',
    error: 'toast-error', 
    info: 'toast-info'
  }

  // Auto-dismiss after 4 seconds
  useState(() => {
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  })

  return (
    <div class="fixed top-4 right-4 z-50 animate-slide-in">
      <div class={`toast ${typeStyles[type]} flex items-center justify-between min-w-80`}>
        <span class="text-sm">{message}</span>
        <button
          onClick={onClose}
          class="ml-4 text-current opacity-70 hover:opacity-100"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// Loading Spinner Component
export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  }

  return (
    <div class={`spinner ${sizeClasses[size]}`} />
  )
}

// Confirmation Modal Component
interface ConfirmModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmText?: string
  confirmStyle?: 'danger' | 'primary' | 'reload' | 'warning'
  isLoading?: boolean
  disabled?: boolean
}

export function ConfirmModal({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  confirmText = 'Confirm',
  confirmStyle = 'primary',
  isLoading = false,
  disabled = false
}: ConfirmModalProps) {
  const getConfirmButtonClasses = () => {
    const baseClasses = 'group flex items-center gap-2 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] font-medium tracking-wide backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none px-6 py-2.5 text-sm'
    
    switch (confirmStyle) {
      case 'danger':
        return `${baseClasses} !bg-gradient-to-bl !from-red-500/10 !via-pink-500/10 !to-red-600/20 hover:!from-red-500/20 hover:!via-pink-500/20 hover:!to-red-600/30 !border !border-red-200/50 hover:!border-red-300/70 dark:!border-red-400/30 dark:hover:!border-red-300/50 hover:!shadow-red-500/20 !text-gray-900 dark:!text-white group-hover:!text-red-600 dark:group-hover:!text-red-300`
      case 'reload':
        return `${baseClasses} !bg-gradient-to-br !from-purple-500/10 !via-blue-500/10 !to-purple-600/20 hover:!from-purple-500/20 hover:!via-blue-500/20 hover:!to-purple-600/30 !border !border-purple-200/50 hover:!border-purple-300/70 dark:!border-purple-400/30 dark:hover:!border-purple-300/50 hover:!shadow-purple-500/20 !text-gray-900 dark:!text-white group-hover:!text-purple-600 dark:group-hover:!text-purple-300`
      case 'warning':
        return `${baseClasses} !bg-gradient-to-bl !from-yellow-500/10 !via-orange-500/10 !to-yellow-600/20 hover:!from-yellow-500/20 hover:!via-orange-500/20 hover:!to-yellow-600/30 !border !border-yellow-200/50 hover:!border-yellow-300/70 dark:!border-yellow-400/30 dark:hover:!border-yellow-300/50 hover:!shadow-yellow-500/20 !text-gray-900 dark:!text-white group-hover:!text-yellow-600 dark:group-hover:!text-yellow-300`
      default:
        return `${baseClasses} !bg-gradient-to-bl !from-pink-500/10 !via-purple-500/10 !to-blue-600/20 hover:!from-pink-500/20 hover:!via-purple-500/20 hover:!to-blue-600/30 !border !border-pink-200/50 hover:!border-pink-300/70 dark:!border-pink-400/30 dark:hover:!border-pink-300/50 hover:!shadow-pink-500/20 !text-gray-900 dark:!text-white group-hover:!text-pink-600 dark:group-hover:!text-pink-300`
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <div class="space-y-4">
        <p class="text-gray-600 dark:text-gray-300">{message}</p>
        
        <div class="flex items-center justify-end space-x-3 pt-4 border-t border-white/20 dark:border-gray-800">
          <button
            onClick={onClose}
            disabled={isLoading || disabled}
            class="group flex items-center gap-2 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] font-medium tracking-wide backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none px-6 py-2.5 text-sm text-gray-700 dark:text-gray-300 bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-300 border border-gray-200/50 dark:border-gray-700/50 hover:border-gray-300/70 dark:hover:border-gray-600/50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading || disabled}
            class={getConfirmButtonClasses()}
          >
            {(isLoading || disabled) && <LoadingSpinner size="sm" />}
            <span class={(isLoading || disabled) ? 'ml-2' : ''}>{confirmText}</span>
          </button>
        </div>
      </div>
    </Modal>
  )
}

// Create Project Modal
interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { name: string; description: string }) => Promise<void>
}

export function CreateProjectModal({ isOpen, onClose, onSubmit }: CreateProjectModalProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    
    if (!name.trim()) {
      setError('Project name is required')
      return
    }

    try {
      setIsLoading(true)
      setError('')
      await onSubmit({ name: name.trim(), description: description.trim() })
      
      // Reset form and close
      setName('')
      setDescription('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Project">
      <form onSubmit={handleSubmit} class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Project Name *
          </label>
          <input
            type="text"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder="my-awesome-project"
            class="input"
            disabled={isLoading}
            required
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Description
          </label>
          <textarea
            value={description}
            onInput={(e) => setDescription((e.target as HTMLTextAreaElement).value)}
            placeholder="Brief description of your project"
            rows={3}
            class="input resize-none"
            disabled={isLoading}
          />
        </div>

        {error && (
          <p class="text-sm text-red-400">{error}</p>
        )}

        <div class="flex space-x-3 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            class="btn btn-ghost"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || !name.trim()}
            class="btn btn-primary flex items-center"
          >
            {isLoading && <LoadingSpinner size="sm" />}
            <span class={isLoading ? 'ml-2' : ''}>Create Project</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}

// Create Service Modal
interface CreateServiceModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { 
    name: string
    image: string
    ports?: {container: number, host: number}[]
    env?: Record<string, string>
  }) => Promise<void>
  projectId?: string
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
  const [ports, setPorts] = useState('')
  const [envVars, setEnvVars] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Predefined popular Docker images with descriptions
  const popularImages = [
    { image: 'nginx:alpine', desc: 'Web server' },
    { image: 'node:18-alpine', desc: 'Node.js app' },
    { image: 'python:3.11-slim', desc: 'Python app' },
    { image: 'postgres:15', desc: 'Database' },
    { image: 'redis:alpine', desc: 'Cache' },
    { image: 'traefik:latest', desc: 'Proxy' }
  ]
  
  // Common ports with descriptions
  const commonPorts = [
    { port: '80', desc: 'HTTP' },
    { port: '443', desc: 'HTTPS' },
    { port: '3000', desc: 'Dev server' },
    { port: '8080', desc: 'Alt HTTP' },
    { port: '5432', desc: 'PostgreSQL' },
    { port: '6379', desc: 'Redis' }
  ]

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    
    if (!name.trim() || !image.trim()) {
      setError('Service name and image are required')
      return
    }

    try {
      setIsLoading(true)
      setError('')

      // Parse ports (comma-separated, each port maps to itself)
      const parsedPorts = ports.trim() 
        ? ports.split(',')
            .map(p => p.trim())
            .filter(p => p && !isNaN(parseInt(p)))
            .map(p => ({
              container: parseInt(p),
              host: parseInt(p)
            }))
        : undefined

      // Parse environment variables (key=value pairs, one per line)
      const parsedEnv = envVars.trim() 
        ? Object.fromEntries(
            envVars.split('\n')
              .map(line => line.trim())
              .filter(line => line && line.includes('='))
              .map(line => {
                const [key, ...valueParts] = line.split('=')
                return [key.trim(), valueParts.join('=').trim()]
              })
          )
        : undefined

      await onSubmit({ 
        name: name.trim(), 
        image: image.trim(),
        ports: parsedPorts,
        env: parsedEnv
      })
      
      // Reset form and close
      setName('')
      setImage('')
      setPorts('')
      setEnvVars('')
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create service')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Deploy Service${projectName ? ` to ${projectName}` : ''}`} size="lg">
      <form onSubmit={handleSubmit} class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Service Name *
          </label>
          <input
            type="text"
            value={name}
            onInput={(e) => setName((e.target as HTMLInputElement).value)}
            placeholder="my-web-app"
            class="input"
            disabled={isLoading}
            required
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Docker Image * 
            <span class="text-xs text-gray-400 font-normal ml-2">Choose from popular images or enter custom</span>
          </label>
          
          {/* Quick Suggestions */}
          <div class="mb-3">
            <p class="text-xs text-gray-400 mb-2">Popular images:</p>
            <div class="flex flex-wrap gap-2">
              {popularImages.map(({ image: img, desc }) => (
                <button
                  key={img}
                  type="button"
                  onClick={() => setImage(img)}
                  class="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300 hover:text-white transition-colors"
                  disabled={isLoading}
                  title={desc}
                >
                  {img}
                </button>
              ))}
            </div>
          </div>
          
          <input
            type="text"
            value={image}
            onInput={(e) => setImage((e.target as HTMLInputElement).value)}
            placeholder="nginx:latest, node:18-alpine, or myregistry/myapp:v1.0"
            class="input"
            disabled={isLoading}
            required
          />
          <p class="text-xs text-gray-400 mt-1">
            Use Docker Hub images or private registry URLs. Click suggestions above for quick selection.
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Ports (optional)
            <span class="text-xs text-gray-400 font-normal ml-2">Common ports: 80 (web), 3000 (dev), 5432 (postgres)</span>
          </label>
          
          {/* Port suggestions */}
          <div class="mb-2">
            <div class="flex flex-wrap gap-2">
              {commonPorts.map(({ port, desc }) => (
                <button
                  key={port}
                  type="button"
                  onClick={() => {
                    const currentPorts = ports.trim()
                    const newPorts = currentPorts ? `${currentPorts}, ${port}` : port
                    setPorts(newPorts)
                  }}
                  class="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded-md text-gray-300 hover:text-white transition-colors"
                  disabled={isLoading}
                  title={`Add ${desc} port`}
                >
                  {port}
                </button>
              ))}
            </div>
          </div>
          
          <input
            type="text"
            value={ports}
            onInput={(e) => setPorts((e.target as HTMLInputElement).value)}
            placeholder="80, 443, 3000"
            class="input"
            disabled={isLoading}
          />
          <p class="text-xs text-gray-400 mt-1">
            Comma-separated list of ports to expose. Click buttons above to add common ports.
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Environment Variables (optional)
          </label>
          <textarea
            value={envVars}
            onInput={(e) => setEnvVars((e.target as HTMLTextAreaElement).value)}
            placeholder="NODE_ENV=production&#10;DATABASE_URL=postgres://...&#10;API_KEY=your-secret"
            rows={4}
            class="input resize-none"
            disabled={isLoading}
          />
          <p class="text-xs text-gray-400 mt-1">
            One per line in KEY=value format
          </p>
        </div>

        {error && (
          <p class="text-sm text-red-400">{error}</p>
        )}

        <div class="flex space-x-3 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            class="btn btn-ghost"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || !name.trim() || !image.trim()}
            class="btn btn-primary flex items-center"
          >
            <svg class={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isLoading ? "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" : "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"} />
            </svg>
            {isLoading ? 'Deploying...' : 'Deploy Service'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

// Create Route Modal
interface CreateRouteModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: { 
    domain: string
    service_id: string
    port: number
    tls?: boolean
  }) => Promise<void>
  projectId?: string
  projectName?: string
  services?: Array<{id: string, name: string, ports?: Array<{container: number, host: number}>}>
}

export function CreateRouteModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  projectName,
  services = []
}: CreateRouteModalProps) {
  const [domain, setDomain] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [targetPort, setTargetPort] = useState('')
  const [tlsEnabled, setTlsEnabled] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    
    if (!domain.trim() || !serviceId || !targetPort.trim()) {
      setError('Domain, service, and port are required')
      return
    }

    const port = parseInt(targetPort)
    if (isNaN(port) || port < 1 || port > 65535) {
      setError('Port must be a number between 1 and 65535')
      return
    }

    try {
      setIsLoading(true)
      setError('')

      const routeData = { 
        domain: domain.trim(),
        service_id: serviceId,
        port: port,
        tls: tlsEnabled
      }

      await onSubmit(routeData)
      
      // Reset form and close
      setDomain('')
      setServiceId('')
      setTargetPort('')
      setTlsEnabled(false)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create route')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Create Route${projectName ? ` for ${projectName}` : ''}`} size="lg">
      <form onSubmit={handleSubmit} class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Domain *
          </label>
          <input
            type="text"
            value={domain}
            onInput={(e) => setDomain((e.target as HTMLInputElement).value)}
            placeholder="app.example.com"
            class="input"
            disabled={isLoading}
            required
          />
          <p class="text-xs text-gray-400 mt-1">
            Domain name where your service will be accessible
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Service *
          </label>
          <select
            value={serviceId}
            onChange={(e) => setServiceId((e.target as HTMLSelectElement).value)}
            class="input"
            disabled={isLoading}
            required
          >
            <option value="">Select service</option>
            {services.map(service => (
              <option key={service.id} value={service.id}>
                {service.name} ({service.ports?.map(p => p.container).join(', ') || 'no ports'})
              </option>
            ))}
          </select>
          {services.length === 0 && (
            <p class="text-xs text-yellow-400 mt-1">
              No services available. Deploy a service first.
            </p>
          )}
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-300 mb-2">
            Port *
          </label>
          <input
            type="number"
            value={targetPort}
            onInput={(e) => setTargetPort((e.target as HTMLInputElement).value)}
            placeholder="80"
            class="input"
            disabled={isLoading}
            min="1"
            max="65535"
            required
          />
          <p class="text-xs text-gray-400 mt-1">
            Port to route traffic to
          </p>
        </div>

        <div class="flex items-center">
          <input
            type="checkbox"
            id="tls-enabled"
            checked={tlsEnabled}
            onChange={(e) => setTlsEnabled((e.target as HTMLInputElement).checked)}
            class="mr-2 rounded"
            disabled={isLoading}
          />
          <label htmlFor="tls-enabled" class="text-sm text-gray-300">
            Enable TLS (HTTPS)
          </label>
        </div>

        {error && (
          <p class="text-sm text-red-400">{error}</p>
        )}

        <div class="flex space-x-3 justify-end pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            class="btn btn-ghost"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isLoading || !domain.trim() || !serviceId || !targetPort.trim()}
            class="btn btn-primary flex items-center"
          >
            {isLoading && <LoadingSpinner size="sm" />}
            <span class={isLoading ? 'ml-2' : ''}>Create Route</span>
          </button>
        </div>
      </form>
    </Modal>
  )
}