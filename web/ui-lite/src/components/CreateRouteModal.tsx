import { useState } from 'preact/hooks'
import { Modal } from './ui/Modal'

interface CreateRouteModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: RouteFormData) => void
  services: Array<{
    id: string
    name: string
    project_name?: string
    ports?: Array<{ host: number; container: number }>
  }>
}

interface RouteFormData {
  service_id: string
  domain: string
  path?: string
  port: number
  tls: boolean
}

export function CreateRouteModal({ isOpen, onClose, onSubmit, services }: CreateRouteModalProps) {
  const [formData, setFormData] = useState<RouteFormData>({
    service_id: '',
    domain: '',
    path: '/',
    port: 80,
    tls: false
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.service_id) {
      newErrors.service_id = 'Please select a service'
    }

    if (!formData.domain.trim()) {
      newErrors.domain = 'Domain is required'
    } else {
      // Basic domain validation
      const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/
      if (!domainRegex.test(formData.domain.trim())) {
        newErrors.domain = 'Please enter a valid domain name'
      }
    }

    if (!formData.path || !formData.path.startsWith('/')) {
      newErrors.path = 'Path must start with /'
    }

    if (formData.port < 1 || formData.port > 65535) {
      newErrors.port = 'Port must be between 1 and 65535'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setSubmitting(true)
    try {
      const submitData = {
        ...formData,
        domain: formData.domain.trim(),
        path: formData.path === '/' ? undefined : formData.path
      }
      
      await onSubmit(submitData)
      
      // Reset form on success
      setFormData({
        service_id: '',
        domain: '',
        path: '/',
        port: 80,
        tls: false
      })
      setErrors({})
      onClose()
    } catch (error) {
      // Error handling is done by the parent component
    } finally {
      setSubmitting(false)
    }
  }

  const handleInputChange = (field: keyof RouteFormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }

    // Auto-fill port based on selected service
    if (field === 'service_id' && typeof value === 'string') {
      const service = services.find(s => s.id === value)
      if (service && service.ports && service.ports.length > 0) {
        setFormData(prev => ({ 
          ...prev, 
          [field]: value,
          port: service.ports![0].container 
        }))
      }
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Route" size="md">
      <form onSubmit={handleSubmit} class="space-y-4">
        {/* Service Selection */}
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Service <span class="text-red-500">*</span>
          </label>
          <select
            value={formData.service_id}
            onChange={(e) => handleInputChange('service_id', (e.target as HTMLSelectElement).value)}
            class={`input ${errors.service_id ? 'border-red-500' : ''}`}
            disabled={submitting}
          >
            <option value="">Select a service...</option>
            {services.map(service => (
              <option key={service.id} value={service.id}>
                {service.name} {service.project_name && `(${service.project_name})`}
              </option>
            ))}
          </select>
          {errors.service_id && (
            <p class="text-red-500 text-xs mt-1">{errors.service_id}</p>
          )}
        </div>

        {/* Domain */}
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Domain <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.domain}
            onChange={(e) => handleInputChange('domain', (e.target as HTMLInputElement).value)}
            placeholder="example.com"
            class={`input ${errors.domain ? 'border-red-500' : ''}`}
            disabled={submitting}
          />
          {errors.domain && (
            <p class="text-red-500 text-xs mt-1">{errors.domain}</p>
          )}
          <p class="text-gray-500 text-xs mt-1">
            The domain name that will point to this service
          </p>
        </div>

        {/* Path */}
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Path
          </label>
          <input
            type="text"
            value={formData.path}
            onChange={(e) => handleInputChange('path', (e.target as HTMLInputElement).value)}
            placeholder="/"
            class={`input ${errors.path ? 'border-red-500' : ''}`}
            disabled={submitting}
          />
          {errors.path && (
            <p class="text-red-500 text-xs mt-1">{errors.path}</p>
          )}
          <p class="text-gray-500 text-xs mt-1">
            URL path to match (e.g., /api, /admin)
          </p>
        </div>

        {/* Port */}
        <div>
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Port <span class="text-red-500">*</span>
          </label>
          <input
            type="number"
            value={formData.port}
            onChange={(e) => handleInputChange('port', parseInt((e.target as HTMLInputElement).value) || 80)}
            min="1"
            max="65535"
            class={`input ${errors.port ? 'border-red-500' : ''}`}
            disabled={submitting}
          />
          {errors.port && (
            <p class="text-red-500 text-xs mt-1">{errors.port}</p>
          )}
          <p class="text-gray-500 text-xs mt-1">
            Container port to route traffic to
          </p>
        </div>

        {/* HTTPS Toggle */}
        <div class="flex items-center space-x-3">
          <input
            type="checkbox"
            id="tls-toggle"
            checked={formData.tls}
            onChange={(e) => handleInputChange('tls', (e.target as HTMLInputElement).checked)}
            class="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            disabled={submitting}
          />
          <label for="tls-toggle" class="text-sm font-medium text-gray-700 dark:text-gray-300">
            Enable HTTPS (TLS)
          </label>
        </div>
        <p class="text-gray-500 text-xs">
          Automatically redirect HTTP to HTTPS and manage SSL certificates
        </p>

        {/* Form Actions */}
        <div class="flex items-center justify-end space-x-3 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            class="btn btn-ghost"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="btn btn-primary"
            disabled={submitting || !formData.service_id || !formData.domain.trim()}
          >
            {submitting ? (
              <span class="flex items-center">
                <span class="animate-spin mr-2">⟳</span>
                Creating...
              </span>
            ) : (
              'Create Route'
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}