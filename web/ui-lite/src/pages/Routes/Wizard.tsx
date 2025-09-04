import { useState, useEffect } from 'preact/hooks'
import { apiClient, useApiData } from '../../api'
import { Toast, LoadingSpinner } from '../../components/ui'
import { ConfirmModal } from '../../components'
import { isAdminSync } from '../../rbac'
import { 
  ArrowLeft, 
  ArrowRight, 
  Check, 
  Globe, 
  FolderOpen, 
  Container, 
  Shield, 
  Settings,
  ChevronLeft
} from 'lucide-preact'

interface Project {
  id: number
  name: string
}

interface Service {
  id: string
  name: string
  port?: number
  project_name?: string
}

interface RouteData {
  domain: string
  path: string
  port: number
  tls: boolean
}

export function RouteWizard() {
  const [currentStep, setCurrentStep] = useState(1)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [routeData, setRouteData] = useState<RouteData>({
    domain: '',
    path: '/',
    port: 80,
    tls: false
  })
  
  const [services, setServices] = useState<Service[]>([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [showReloadConfirm, setShowReloadConfirm] = useState(false)
  const [routeCreated, setRouteCreated] = useState(false)
  const [reloading, setReloading] = useState(false)
  
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const [toastConfig, setToastConfig] = useState({ 
    show: false, 
    message: '', 
    type: 'info' as 'info' | 'success' | 'error' 
  })

  // Fetch auth info and projects
  const { data: authInfo } = useApiData(() => apiClient.getAuthInfo())
  const { data: projects, loading: projectsLoading } = useApiData(() => apiClient.getProjects())
  
  const canReloadNginx = isAdminSync(authInfo?.role)

  // Load services when project is selected
  useEffect(() => {
    if (selectedProject) {
      setServicesLoading(true)
      apiClient.getProjectServices(selectedProject.id)
        .then(projectServices => {
          setServices(projectServices || [])
        })
        .catch(() => {
          setServices([])
          setToastConfig({ 
            show: true, 
            message: 'Failed to load services', 
            type: 'error' 
          })
        })
        .finally(() => {
          setServicesLoading(false)
        })
    } else {
      setServices([])
    }
  }, [selectedProject])

  // Auto-fill port when service is selected
  useEffect(() => {
    if (selectedService && selectedService.port) {
      setRouteData(prev => ({ ...prev, port: selectedService.port! }))
    }
  }, [selectedService])

  const validateDomain = (domain: string): string | null => {
    if (!domain.trim()) {
      return 'Domain is required'
    }
    
    // RFC 1123 domain validation
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/
    if (!domainRegex.test(domain)) {
      return 'Invalid domain format. Use format like example.com or app.example.com'
    }
    
    return null
  }

  const validatePath = (path: string): string | null => {
    if (!path.startsWith('/')) {
      return 'Path must start with /'
    }
    return null
  }

  const validatePort = (port: number): string | null => {
    if (port < 1 || port > 65535) {
      return 'Port must be between 1 and 65535'
    }
    return null
  }

  const validateCurrentStep = (): boolean => {
    const errors: Record<string, string> = {}

    if (currentStep === 3) {
      const domainError = validateDomain(routeData.domain)
      if (domainError) errors.domain = domainError

      const pathError = validatePath(routeData.path)
      if (pathError) errors.path = pathError

      const portError = validatePort(routeData.port)
      if (portError) errors.port = portError
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleNext = () => {
    if (!validateCurrentStep()) return
    
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
      setFormErrors({})
    }
  }

  const handleProjectSelect = (project: Project) => {
    setSelectedProject(project)
    setSelectedService(null) // Reset service selection
    setCurrentStep(2)
  }

  const handleServiceSelect = (service: Service) => {
    setSelectedService(service)
    setCurrentStep(3)
  }

  const handleCreateRoute = async () => {
    if (!validateCurrentStep() || !selectedService) return

    setSubmitting(true)
    try {
      await apiClient.createRoute(selectedService.id, {
        domain: routeData.domain.trim(),
        path: routeData.path.trim(),
        port: routeData.port,
        tls: routeData.tls
      })

      setRouteCreated(true)
      setToastConfig({ 
        show: true, 
        message: `Route created successfully for ${routeData.domain}`, 
        type: 'success' 
      })

      // If admin, show reload confirmation
      if (canReloadNginx) {
        setShowReloadConfirm(true)
      } else {
        // Non-admin: redirect after delay
        setTimeout(() => {
          window.location.href = '/routes'
        }, 2000)
      }

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create route'
      setToastConfig({ show: true, message, type: 'error' })
      
      // Handle validation errors from server
      if (message.includes('domain')) {
        setFormErrors({ domain: message })
      } else if (message.includes('port')) {
        setFormErrors({ port: message })
      } else if (message.includes('path')) {
        setFormErrors({ path: message })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleNginxReload = async () => {
    setReloading(true)
    try {
      await apiClient.nginxReload()
      setToastConfig({ 
        show: true, 
        message: 'Configuration applied successfully!', 
        type: 'success' 
      })
      setShowReloadConfirm(false)
      
      // Redirect after successful reload
      setTimeout(() => {
        window.location.href = '/routes'
      }, 1500)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to apply configuration'
      setToastConfig({ show: true, message, type: 'error' })
    } finally {
      setReloading(false)
    }
  }

  const skipReload = () => {
    setShowReloadConfirm(false)
    window.location.href = '/routes'
  }

  if (projectsLoading) {
    return (
      <div class="p-3 sm:p-4 max-w-7xl mx-auto space-y-4 fade-in">
        <div class="animate-pulse">
          <div class="flex items-center justify-between mb-4">
            <div>
              <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
              <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-56"></div>
            </div>
          </div>
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
            <div class="flex justify-center">
              <LoadingSpinner size="lg" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center space-x-4">
        <button
          onClick={() => window.location.href = '/app/routes'}
          class="flex items-center justify-center w-10 h-10 rounded-lg backdrop-blur-sm bg-white/10 dark:bg-gray-900/10 hover:bg-white/20 dark:hover:bg-gray-900/20 border border-white/20 dark:border-gray-700/20 transition-all duration-200"
        >
          <ChevronLeft class="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <h1 class="text-2xl font-bold mb-1">
            <span class="bg-gradient-to-r from-[#8b008b] via-[#9c40ff] to-[#e94057] bg-clip-text text-transparent">
              Create New Route
            </span>
          </h1>
          <p class="text-gray-600 dark:text-gray-400 text-sm">
            Expose your service through a domain route
          </p>
        </div>
      </div>

      {/* Progress Steps - Horizontal Layout */}
      <div class="backdrop-blur-sm bg-white/10 dark:bg-gray-900/10 rounded-lg border border-white/20 dark:border-gray-700/20 p-6 shadow-lg">
        <div class="flex items-center justify-between">
          {[
            { step: 1, label: 'Project', icon: FolderOpen },
            { step: 2, label: 'Service', icon: Container },
            { step: 3, label: 'Configuration', icon: Settings }
          ].map(({ step, label, icon: Icon }, index, array) => (
            <div key={step} class="flex items-center">
              <div class="flex flex-col items-center space-y-2">
                <div class={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
                  step < currentStep 
                    ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/25'
                    : step === currentStep
                    ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400'
                }`}>
                  {step < currentStep ? (
                    <Check class="w-5 h-5" />
                  ) : step === currentStep ? (
                    <Icon class="w-5 h-5" />
                  ) : (
                    <Icon class="w-5 h-5" />
                  )}
                </div>
                <div class="text-center">
                  <div class={`text-sm font-medium ${
                    step <= currentStep ? 'text-gray-900 dark:text-white' : 'text-gray-400'
                  }`}>
                    {label}
                  </div>
                  <div class={`text-xs ${
                    step < currentStep 
                      ? 'text-green-600 dark:text-green-400'
                      : step === currentStep
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-400'
                  }`}>
                    {step < currentStep ? 'Complete' : step === currentStep ? 'Current' : 'Pending'}
                  </div>
                </div>
              </div>
              
              {/* Connector Line */}
              {index < array.length - 1 && (
                <div class={`flex-1 mx-4 h-0.5 transition-colors duration-300 ${
                  step < currentStep
                    ? 'bg-gradient-to-r from-green-500 to-blue-500'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Card */}
      <div class="backdrop-blur-sm bg-white/10 dark:bg-gray-900/10 rounded-lg border border-white/20 dark:border-gray-700/20 p-6 shadow-lg">
          
          {/* Step 1: Project Selection */}
          {currentStep === 1 && (
            <div class="space-y-4">
              <div>
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Select Project
                </h2>
                <p class="text-gray-600 dark:text-gray-400 text-sm">
                  Choose the project containing the service you want to expose
                </p>
              </div>
              
              {projects && projects.length > 0 ? (
                <div class="space-y-3">
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => handleProjectSelect(project)}
                      class="w-full text-left p-4 backdrop-blur-sm bg-white/5 dark:bg-gray-900/5 hover:bg-white/10 dark:hover:bg-gray-900/10 border border-white/10 dark:border-gray-700/10 hover:border-white/30 dark:hover:border-gray-600/30 rounded-lg transition-all duration-200 group"
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                          <div class="w-10 h-10 backdrop-blur-sm bg-white/10 dark:bg-gray-900/10 border border-white/20 dark:border-gray-700/20 rounded-lg flex items-center justify-center">
                            <FolderOpen class="w-5 h-5 text-[#9c40ff]" />
                          </div>
                          <div class="font-medium text-gray-900 dark:text-white">
                            {project.name}
                          </div>
                        </div>
                        <ArrowRight class="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div class="text-center py-8">
                  <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <FolderOpen class="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 class="font-medium text-gray-900 dark:text-white mb-2">No projects found</h3>
                  <p class="text-gray-500 dark:text-gray-400 text-sm mb-4">
                    Create a project first to organize your services
                  </p>
                  <button
                    onClick={() => window.location.href = '/app/projects'}
                    class="btn btn-primary"
                  >
                    <FolderOpen class="w-4 h-4 mr-2" />
                    Create Project
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Service Selection */}
          {currentStep === 2 && (
            <div class="space-y-4">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                    Select Service
                  </h2>
                  <p class="text-gray-600 dark:text-gray-400 text-sm">
                    Choose the service to expose: <span class="font-medium">{selectedProject?.name}</span>
                  </p>
                </div>
                <button
                  onClick={handleBack}
                  class="btn btn-secondary text-sm"
                >
                  ← Back
                </button>
              </div>

              {servicesLoading ? (
                <div class="flex justify-center py-8">
                  <LoadingSpinner size="md" />
                </div>
              ) : services.length > 0 ? (
                <div class="space-y-3">
                  {services.map((service) => (
                    <button
                      key={service.id}
                      onClick={() => handleServiceSelect(service)}
                      class="w-full text-left p-4 backdrop-blur-sm bg-white/5 dark:bg-gray-900/5 hover:bg-white/10 dark:hover:bg-gray-900/10 border border-white/10 dark:border-gray-700/10 hover:border-white/30 dark:hover:border-gray-600/30 rounded-lg transition-all duration-200 group"
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-3">
                          <div class="w-10 h-10 backdrop-blur-sm bg-white/10 dark:bg-gray-900/10 border border-white/20 dark:border-gray-700/20 rounded-lg flex items-center justify-center">
                            <Container class="w-5 h-5 text-[#8b008b]" />
                          </div>
                          <div>
                            <div class="font-medium text-gray-900 dark:text-white">
                              {service.name}
                            </div>
                            {service.port && (
                              <div class="text-sm text-gray-500 dark:text-gray-400">
                                Port {service.port}
                              </div>
                            )}
                          </div>
                        </div>
                        <ArrowRight class="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors" />
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div class="text-center py-8">
                  <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Container class="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 class="font-medium text-gray-900 dark:text-white mb-2">No services found</h3>
                  <p class="text-gray-500 dark:text-gray-400 text-sm">
                    Deploy a service to this project first
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Route Configuration */}
          {currentStep === 3 && (
            <div class="space-y-6">
              <div class="flex items-center justify-between">
                <div>
                  <h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                    Route Configuration
                  </h2>
                  <p class="text-gray-600 dark:text-gray-400 text-sm">
                    Configure how your service will be exposed
                  </p>
                </div>
                <button
                  onClick={handleBack}
                  class="btn btn-secondary text-sm"
                >
                  ← Back
                </button>
              </div>
              
              {/* Selected Context Card */}
              <div class="backdrop-blur-sm bg-gradient-to-r from-[#8b008b]/10 to-[#9c40ff]/10 rounded-lg p-4 border border-[#9c40ff]/20">
                <div class="flex items-center space-x-3">
                  <div class="w-10 h-10 backdrop-blur-sm bg-white/10 dark:bg-gray-900/10 border border-white/20 dark:border-gray-700/20 rounded-lg flex items-center justify-center">
                    <FolderOpen class="w-5 h-5 text-[#9c40ff]" />
                  </div>
                  <div class="flex-1">
                    <div class="text-sm text-gray-600 dark:text-gray-400">Creating route for:</div>
                    <div class="text-lg font-medium text-gray-900 dark:text-white">
                      <span class="text-[#9c40ff]">{selectedProject?.name}</span> / <span class="text-[#8b008b]">{selectedService?.name}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Configuration Form */}
              <div class="space-y-6">
                {/* Domain Configuration */}
                <div class="backdrop-blur-sm bg-white/5 dark:bg-gray-900/5 rounded-lg p-4 border border-white/10 dark:border-gray-700/10">
                  <div class="flex items-center space-x-2 mb-4">
                    <Globe class="w-5 h-5 text-blue-500" />
                    <h3 class="text-lg font-medium text-gray-900 dark:text-white">Domain Settings</h3>
                  </div>
                  
                  <div class="space-y-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                        Domain <span class="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={routeData.domain}
                        onChange={(e) => {
                          const value = (e.target as HTMLInputElement).value
                          setRouteData(prev => ({ ...prev, domain: value }))
                          if (formErrors.domain) {
                            setFormErrors(prev => ({ ...prev, domain: '' }))
                          }
                        }}
                        placeholder="app.example.com"
                        class={`input ${formErrors.domain ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                        disabled={submitting}
                      />
                      {formErrors.domain && (
                        <p class="text-red-500 text-sm mt-1 flex items-center">
                          <svg class="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                          </svg>
                          {formErrors.domain}
                        </p>
                      )}
                      <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">
                        The domain where your service will be accessible
                      </p>
                    </div>

                    <div>
                      <label class="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                        Path
                      </label>
                      <input
                        type="text"
                        value={routeData.path}
                        onChange={(e) => {
                          const value = (e.target as HTMLInputElement).value
                          setRouteData(prev => ({ ...prev, path: value }))
                          if (formErrors.path) {
                            setFormErrors(prev => ({ ...prev, path: '' }))
                          }
                        }}
                        placeholder="/"
                        class={`input ${formErrors.path ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                        disabled={submitting}
                      />
                      {formErrors.path && (
                        <p class="text-red-500 text-sm mt-1 flex items-center">
                          <svg class="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                          </svg>
                          {formErrors.path}
                        </p>
                      )}
                      <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">
                        URL path prefix (e.g., / for root, /api for API routes)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Network Configuration */}
                <div class="backdrop-blur-sm bg-white/5 dark:bg-gray-900/5 rounded-lg p-4 border border-white/10 dark:border-gray-700/10">
                  <div class="flex items-center space-x-2 mb-4">
                    <Settings class="w-5 h-5 text-green-500" />
                    <h3 class="text-lg font-medium text-gray-900 dark:text-white">Network Settings</h3>
                  </div>
                  
                  <div class="space-y-4">
                    <div>
                      <label class="block text-sm font-medium text-gray-900 dark:text-white mb-2">
                        Target Port <span class="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="65535"
                        value={routeData.port}
                        onChange={(e) => {
                          const value = parseInt((e.target as HTMLInputElement).value) || 80
                          setRouteData(prev => ({ ...prev, port: value }))
                          if (formErrors.port) {
                            setFormErrors(prev => ({ ...prev, port: '' }))
                          }
                        }}
                        class={`input ${formErrors.port ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}`}
                        disabled={submitting}
                      />
                      {formErrors.port && (
                        <p class="text-red-500 text-sm mt-1 flex items-center">
                          <svg class="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                          </svg>
                          {formErrors.port}
                        </p>
                      )}
                      <p class="text-gray-500 dark:text-gray-400 text-sm mt-1">
                        Port number where your service is listening (1-65535)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Security Configuration */}
                <div class="backdrop-blur-sm bg-white/5 dark:bg-gray-900/5 rounded-lg p-4 border border-white/10 dark:border-gray-700/10">
                  <div class="flex items-center space-x-2 mb-4">
                    <Shield class="w-5 h-5 text-yellow-500" />
                    <h3 class="text-lg font-medium text-gray-900 dark:text-white">Security Settings</h3>
                  </div>
                  
                  <div class="flex items-start space-x-3 p-3 backdrop-blur-sm bg-white/5 dark:bg-gray-900/5 rounded-lg border border-white/10 dark:border-gray-700/10">
                    <input
                      type="checkbox"
                      id="tls-enabled"
                      checked={routeData.tls}
                      onChange={(e) => {
                        const checked = (e.target as HTMLInputElement).checked
                        setRouteData(prev => ({ ...prev, tls: checked }))
                      }}
                      class="mt-1 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700 w-4 h-4"
                      disabled={submitting}
                    />
                    <div class="flex-1">
                      <label htmlFor="tls-enabled" class="cursor-pointer">
                        <div class="font-medium text-gray-900 dark:text-white mb-1">
                          Enable HTTPS/TLS
                        </div>
                        <div class="text-gray-500 dark:text-gray-400 text-sm">
                          Automatically provision and manage SSL certificate for secure connections
                        </div>
                      </label>
                    </div>
                    <div class={`w-6 h-6 rounded-full flex items-center justify-center ${routeData.tls ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                      {routeData.tls ? (
                        <Shield class="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <Shield class="w-4 h-4 text-gray-400" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Route Preview */}
                {routeData.domain && (
                  <div class="backdrop-blur-sm bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-lg p-4 border border-blue-500/20">
                    <div class="flex items-center space-x-2 mb-2">
                      <Globe class="w-5 h-5 text-blue-500" />
                      <h3 class="text-lg font-medium text-gray-900 dark:text-white">Route Preview</h3>
                    </div>
                    <div class="font-mono text-lg backdrop-blur-sm bg-white/10 dark:bg-gray-900/10 rounded px-3 py-2 border border-white/20 dark:border-gray-700/20">
                      <span class="text-blue-600 dark:text-blue-400">{routeData.tls ? 'https' : 'http'}://</span>
                      <span class="text-gray-900 dark:text-white font-semibold">{routeData.domain}</span>
                      <span class="text-gray-600 dark:text-gray-400">{routeData.path}</span>
                      <span class="text-green-600 dark:text-green-400 ml-2">→ :{routeData.port}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div class="flex justify-between items-center pt-6 border-t border-gray-200 dark:border-gray-700">
                <div class="text-sm text-gray-500 dark:text-gray-400">
                  Step 3 of 3 • Route Configuration
                </div>
                <button
                  onClick={handleCreateRoute}
                  disabled={submitting || !selectedService || !routeData.domain}
                  class="btn btn-primary px-8"
                >
                  {submitting ? (
                    <>
                      <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      Creating Route...
                    </>
                  ) : (
                    <>
                      <Globe class="w-4 h-4 mr-2" />
                      Create Route
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Reload Confirmation Modal */}
        <ConfirmModal
          isOpen={showReloadConfirm}
          onClose={skipReload}
          onConfirm={handleNginxReload}
          title="Apply Configuration?"
          message={
            canReloadNginx 
              ? "Your route has been created! Would you like to apply the nginx configuration now to make it active?"
              : "Route created successfully! An administrator needs to reload the nginx configuration to make it active."
          }
          confirmText={canReloadNginx ? (reloading ? "Applying..." : "Apply Now") : "OK"}
          cancelText={canReloadNginx ? "Skip for Now" : "Close"}
          confirmStyle="primary"
          disabled={reloading || !canReloadNginx}
        />

        {/* Success guidance for non-admin users */}
        {routeCreated && !canReloadNginx && !showReloadConfirm && (
          <div class="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div class="flex items-start">
              <div class="flex-shrink-0">
                <svg class="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                </svg>
              </div>
              <div class="ml-3">
                <h3 class="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Configuration Pending
                </h3>
                <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Your route has been created but requires an administrator to reload the nginx configuration before it becomes active.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notifications */}
        <Toast
          message={toastConfig.message}
          isVisible={toastConfig.show}
          type={toastConfig.type}
          onClose={() => setToastConfig(prev => ({ ...prev, show: false }))}
        />
      </div>
  )
}