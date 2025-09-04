import { useState } from 'preact/hooks'
import { apiClient, useApiData, type Route } from '../../api'
import { Toast, HealthBadge } from '../../components/ui'

interface RoutesTabProps {
  serviceId: string
  serviceName: string
}

interface RouteFormData {
  domain: string
  path: string
  port: number
  tls: boolean
}

export function RoutesTab({ serviceId, serviceName }: RoutesTabProps) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [formData, setFormData] = useState<RouteFormData>({
    domain: '',
    path: '/',
    port: 80,
    tls: false
  })
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [checkingRoutes, setCheckingRoutes] = useState<Set<number>>(new Set())
  const [toastConfig, setToastConfig] = useState({ 
    show: false, 
    message: '', 
    type: 'info' as 'info' | 'success' | 'error' 
  })

  // Fetch service routes
  const { data: routes, loading, refetch } = useApiData(() => 
    apiClient.listServiceRoutes(serviceId)
  )

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    // Domain validation
    if (!formData.domain.trim()) {
      errors.domain = 'Domain is required'
    } else if (!/^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/.test(formData.domain)) {
      errors.domain = 'Invalid domain format'
    }

    // Path validation
    if (!formData.path.startsWith('/')) {
      errors.path = 'Path must start with /'
    }

    // Port validation
    if (formData.port < 1 || formData.port > 65535) {
      errors.port = 'Port must be between 1 and 65535'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    
    if (!validateForm()) return

    setSubmitting(true)
    try {
      await apiClient.createRoute(serviceId, {
        domain: formData.domain.trim(),
        path: formData.path === '/' ? undefined : formData.path,
        port: formData.port,
        tls: formData.tls
      })

      setToastConfig({
        show: true,
        message: `Route created for ${formData.domain}`,
        type: 'success'
      })

      // Reset form
      setFormData({
        domain: '',
        path: '/',
        port: 80,
        tls: false
      })
      setShowAddForm(false)
      refetch()
    } catch (error) {
      setToastConfig({
        show: true,
        message: error instanceof Error ? error.message : 'Failed to create route',
        type: 'error'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteRoute = async (routeId: number) => {
    try {
      await apiClient.deleteRoute(routeId.toString())
      setToastConfig({
        show: true,
        message: 'Route deleted successfully',
        type: 'success'
      })
      refetch()
    } catch (error) {
      setToastConfig({
        show: true,
        message: error instanceof Error ? error.message : 'Failed to delete route',
        type: 'error'
      })
    }
  }

  const handleHealthCheck = async (routeId: number) => {
    setCheckingRoutes(prev => new Set([...prev, routeId]))
    
    try {
      const healthResult = await apiClient.checkRouteHealth(routeId.toString())
      
      // Update the route in our local state by refetching
      refetch()
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to check route health'
      setToastConfig({ show: true, message, type: 'error' })
    } finally {
      setCheckingRoutes(prev => {
        const newSet = new Set(prev)
        newSet.delete(routeId)
        return newSet
      })
    }
  }

  const handleInputChange = (field: keyof RouteFormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-lg font-semibold text-white">Routes for {serviceName}</h3>
          <p class="text-sm text-gray-400">Expose this service through custom domains</p>
        </div>
        <div class="flex items-center space-x-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            class="btn btn-primary"
            disabled={submitting}
          >
            <span class="mr-2">{showAddForm ? '✕' : '+'}</span>
            {showAddForm ? 'Cancel' : 'Add Route'}
          </button>
          {!showAddForm && (
            <a
              href="/app/routes/wizard"
              class="btn btn-secondary text-sm"
              title="Create route using guided wizard"
            >
              <span class="mr-1">🧙</span>
              Create in Wizard
            </a>
          )}
        </div>
      </div>

      {/* Add Route Form */}
      {showAddForm && (
        <div class="card bg-gradient-to-br from-blue-900/20 to-purple-900/20 border-blue-700/30">
          <form onSubmit={handleSubmit} class="space-y-4">
            <div class="grid md:grid-cols-2 gap-4">
              {/* Domain Field */}
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">
                  Domain <span class="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.domain}
                  onChange={(e) => handleInputChange('domain', (e.target as HTMLInputElement).value)}
                  placeholder="example.com"
                  class={`input ${formErrors.domain ? 'border-red-500' : ''}`}
                  disabled={submitting}
                />
                {formErrors.domain && (
                  <p class="text-red-400 text-xs mt-1">{formErrors.domain}</p>
                )}
              </div>

              {/* Path Field */}
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">
                  Path
                </label>
                <input
                  type="text"
                  value={formData.path}
                  onChange={(e) => handleInputChange('path', (e.target as HTMLInputElement).value)}
                  placeholder="/"
                  class={`input ${formErrors.path ? 'border-red-500' : ''}`}
                  disabled={submitting}
                />
                {formErrors.path && (
                  <p class="text-red-400 text-xs mt-1">{formErrors.path}</p>
                )}
              </div>

              {/* Port Field */}
              <div>
                <label class="block text-sm font-medium text-gray-300 mb-1">
                  Port <span class="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  value={formData.port}
                  onChange={(e) => handleInputChange('port', parseInt((e.target as HTMLInputElement).value) || 80)}
                  min="1"
                  max="65535"
                  class={`input ${formErrors.port ? 'border-red-500' : ''}`}
                  disabled={submitting}
                />
                {formErrors.port && (
                  <p class="text-red-400 text-xs mt-1">{formErrors.port}</p>
                )}
              </div>

              {/* TLS Toggle */}
              <div class="flex items-end">
                <label class="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.tls}
                    onChange={(e) => handleInputChange('tls', (e.target as HTMLInputElement).checked)}
                    class="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    disabled={submitting}
                  />
                  <span class="text-sm font-medium text-gray-300">Enable HTTPS</span>
                </label>
              </div>
            </div>

            {/* Form Actions */}
            <div class="flex items-center justify-end space-x-3 pt-4 border-t border-gray-700">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                class="btn btn-ghost"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                disabled={submitting || !formData.domain.trim()}
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
        </div>
      )}

      {/* Routes List */}
      <div class="space-y-3">
        {loading ? (
          <div class="space-y-3">
            {[...Array(2)].map((_, i) => (
              <div key={i} class="skeleton h-16" />
            ))}
          </div>
        ) : routes && routes.length > 0 ? (
          routes.map((route: Route) => (
            <div key={route.id} class="card bg-gradient-to-r from-gray-800/50 to-gray-700/50 border-gray-600/50 hover:border-purple-500/30 transition-colors">
              <div class="flex items-center justify-between">
                <div class="flex items-center space-x-4">
                  <div class="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                    <span class="text-purple-400">🔗</span>
                  </div>
                  <div>
                    <div class="flex items-center space-x-2">
                      <span class="text-white font-medium">
                        {route.domain}
                        {route.path && route.path !== '/' && (
                          <span class="text-gray-400">{route.path}</span>
                        )}
                      </span>
                      {route.tls && (
                        <span class="badge bg-green-500/20 text-green-400">HTTPS</span>
                      )}
                      <HealthBadge 
                        status={route.last_status} 
                        lastChecked={route.last_check_at}
                        size="xs"
                      />
                    </div>
                    <div class="text-sm text-gray-400 mt-1">
                      Port {route.port} • Created {new Date(route.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                <div class="flex items-center space-x-2">
                  <button
                    onClick={() => handleHealthCheck(route.id)}
                    disabled={checkingRoutes.has(route.id)}
                    class="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-md transition-colors"
                    title="Check route health"
                  >
                    {checkingRoutes.has(route.id) ? (
                      <span class="animate-spin text-sm">⟳</span>
                    ) : (
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteRoute(route.id)}
                    class="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
                    title="Delete route"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div class="card bg-gradient-to-br from-gray-800/30 to-gray-700/30 border-gray-600/30">
            <div class="text-center py-8">
              <div class="w-16 h-16 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span class="text-purple-400 text-2xl">🔗</span>
              </div>
              <h4 class="text-lg font-medium text-white mb-2">No routes configured</h4>
              <p class="text-gray-400 text-sm mb-4">
                Create routes to expose this service through custom domains
              </p>
              <div class="flex items-center justify-center space-x-2">
                <button
                  onClick={() => setShowAddForm(true)}
                  class="btn btn-primary btn-sm"
                >
                  <span class="mr-1">+</span>
                  Add First Route
                </button>
                <span class="text-gray-500">or</span>
                <a
                  href="/app/routes/wizard"
                  class="btn btn-secondary btn-sm"
                >
                  <span class="mr-1">🧙</span>
                  Use Wizard
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Toast */}
      <Toast
        message={toastConfig.message}
        type={toastConfig.type}
        isVisible={toastConfig.show}
        onClose={() => setToastConfig({ ...toastConfig, show: false })}
      />
    </div>
  )
}