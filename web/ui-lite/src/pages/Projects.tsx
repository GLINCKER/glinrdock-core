import { useState } from 'preact/hooks'
import { apiClient, useApiData } from '../api'
import { Toast } from '../components/ui'
import { CreateProjectModal, ConfirmModal } from '../components'
import { CreateServiceModal } from '../components/CreateServiceModal'
import { LogsDrawer } from '../components/LogsDrawer'
import { isDeployerSync } from '../rbac'
import { refreshPlanInfo } from '../plan'
import { 
  Plus, 
  FolderOpen, 
  Calendar, 
  Hash, 
  GitBranch, 
  Network, 
  Code2, 
  Container, 
  Info, 
  Settings, 
  ExternalLink, 
  Eye, 
  Trash2, 
  ChevronDown, 
  Play, 
  Square, 
  RotateCcw, 
  FileText,
  Globe
} from 'lucide-preact'

export function Projects() {
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deleteProjectId, setDeleteProjectId] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
  const [showCreateServiceModal, setShowCreateServiceModal] = useState(false)
  const [showLogsDrawer, setShowLogsDrawer] = useState(false)
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null)
  const [selectedServiceName, setSelectedServiceName] = useState<string | null>(null)
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})
  const [toastConfig, setToastConfig] = useState({ show: false, message: '', type: 'info' as 'info' | 'success' | 'error' })

  const { data: projects, loading, refetch } = useApiData(() => apiClient.getProjects())
  const { data: authInfo } = useApiData(() => apiClient.getAuthInfo())
  
  // Check if user can create/delete projects (deployer or higher)
  const canManageProjects = isDeployerSync(authInfo?.role)

  // Load routes for services first
  const { data: allRoutes } = useApiData(
    () => apiClient.get<{ routes: any[] }>('/routes').then(res => res.routes || []),
    [] // Load once on mount
  )

  // Helper function to get routes for a service
  const getServiceRoutes = (serviceId: string) => {
    if (!allRoutes) return []
    return allRoutes.filter((route: any) => route.service_id === parseInt(serviceId))
  }

  // Helper function to build route URL
  const buildRouteURL = (route: any) => {
    const protocol = route.tls ? 'https' : 'http'
    return `${protocol}://${route.domain}`
  }
  
  // Load selected project details - only for inline expansion
  const { data: selectedProject } = useApiData(
    selectedProjectId ? () => apiClient.getProject(selectedProjectId) : () => Promise.resolve(null as any),
    [selectedProjectId] // Add dependency array to ensure refetch when project changes
  )
  
  // Load services for selected project
  const { data: projectServices, refetch: refetchServices } = useApiData(
    selectedProjectId ? () => apiClient.getProjectServices(Number(selectedProjectId)) : () => Promise.resolve(null as any),
    [selectedProjectId] // Add dependency array to ensure refetch when project changes
  )

  const handleCreateProject = async (projectData: { name: string; description: string }) => {
    // Plan quota checking would go here if project limits were implemented
    
    try {
      await apiClient.createProject(projectData)
      setToastConfig({ show: true, message: 'Project created successfully', type: 'success' })
      
      // Refresh plan info to update quota usage
      await refreshPlanInfo()
      
      refetch()
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create project'
      
      // Check if it's a quota error
      if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
        // Refresh plan info to get latest usage
        await refreshPlanInfo()
      }
      
      setToastConfig({ show: true, message: errorMessage, type: 'error' })
    }
  }

  const handleDeleteProject = async () => {
    if (!deleteProjectId) return
    
    try {
      await apiClient.deleteProject(deleteProjectId)
      setToastConfig({ show: true, message: 'Project deleted successfully', type: 'success' })
      setDeleteProjectId(null)
      refetch()
    } catch (error) {
      setToastConfig({ show: true, message: error instanceof Error ? error.message : 'Failed to delete project', type: 'error' })
    }
  }

  const handleCreateService = async (serviceData: {
    name: string
    image: string
    env?: Record<string, string>
    ports?: any[]
  }) => {
    if (!selectedProjectId) return
    
    // Plan quota checking would go here if service limits were implemented
    
    try {
      await apiClient.createService(selectedProjectId, serviceData)
      setToastConfig({ show: true, message: 'Service created successfully', type: 'success' })
      setShowCreateServiceModal(false)
      
      // Refresh plan info to update quota usage
      await refreshPlanInfo()
      
      // Refresh the project services data
      if (selectedProjectId) {
        // The useApiData hook should automatically refresh
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create service'
      
      // Check if it's a quota error
      if (errorMessage.includes('quota') || errorMessage.includes('limit')) {
        // Refresh plan info to get latest usage
        await refreshPlanInfo()
      }
      
      setToastConfig({ show: true, message: errorMessage, type: 'error' })
    }
  }

  // Service lifecycle handlers
  const handleStartService = async (serviceId: string, serviceName: string) => {
    setLoadingStates(prev => ({ ...prev, [`start_${serviceId}`]: true }))
    try {
      await apiClient.startService(serviceId)
      setToastConfig({ show: true, message: `Service "${serviceName}" started successfully`, type: 'success' })
    } catch (error) {
      setToastConfig({ show: true, message: error instanceof Error ? error.message : 'Failed to start service', type: 'error' })
    } finally {
      setLoadingStates(prev => ({ ...prev, [`start_${serviceId}`]: false }))
    }
  }

  const handleStopService = async (serviceId: string, serviceName: string) => {
    setLoadingStates(prev => ({ ...prev, [`stop_${serviceId}`]: true }))
    try {
      await apiClient.stopService(serviceId)
      setToastConfig({ show: true, message: `Service "${serviceName}" stopped successfully`, type: 'success' })
    } catch (error) {
      setToastConfig({ show: true, message: error instanceof Error ? error.message : 'Failed to stop service', type: 'error' })
    } finally {
      setLoadingStates(prev => ({ ...prev, [`stop_${serviceId}`]: false }))
    }
  }

  const handleRestartService = async (serviceId: string, serviceName: string) => {
    setLoadingStates(prev => ({ ...prev, [`restart_${serviceId}`]: true }))
    try {
      await apiClient.restartService(serviceId)
      setToastConfig({ show: true, message: `Service "${serviceName}" restarted successfully`, type: 'success' })
    } catch (error) {
      setToastConfig({ show: true, message: error instanceof Error ? error.message : 'Failed to restart service', type: 'error' })
    } finally {
      setLoadingStates(prev => ({ ...prev, [`restart_${serviceId}`]: false }))
    }
  }

  const handleViewLogs = (serviceId: string, serviceName: string) => {
    setSelectedServiceId(serviceId)
    setSelectedServiceName(serviceName)
    setShowLogsDrawer(true)
  }

  if (loading) {
    return (
      <div class="p-3 sm:p-4 max-w-7xl mx-auto space-y-4 fade-in">
        <div class="animate-pulse">
          {/* Header Skeleton */}
          <div class="flex items-center justify-between mb-4">
            <div>
              <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
              <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-56"></div>
            </div>
            <div class="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-32"></div>
          </div>

          {/* Projects List Skeleton */}
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div class="p-4 space-y-3">
              {[...Array(3)].map((_, index) => (
                <div key={index} class="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                      <div class="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                      <div>
                        <div class="h-5 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-1"></div>
                        <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                      </div>
                    </div>
                    <div class="flex items-center space-x-2">
                      <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                      <div class="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div class="p-3 sm:p-4 max-w-7xl mx-auto space-y-4 fade-in">
      {/* Compact Header */}
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-2xl font-bold mb-1">
            <span class="bg-gradient-to-r from-[#8b008b] via-[#9c40ff] to-[#e94057] bg-clip-text text-transparent">
              Projects
            </span>
          </h1>
          <p class="text-gray-600 dark:text-gray-400 text-sm">
            Organize and manage container applications
          </p>
        </div>
        
        {canManageProjects && (
          <button 
            class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-[#9c40ff] to-[#8b008b] hover:from-[#8b008b] hover:to-[#9c40ff] text-white font-medium rounded-lg shadow-md transition-all duration-200 hover:scale-[1.02] text-sm"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus class="w-4 h-4 mr-2" />
            New Project
          </button>
        )}
      </div>

      {/* Projects List */}
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="p-4">
          {projects && projects.length > 0 ? (
            <div class="space-y-3">
              {projects.map(project => (
                <div 
                  key={project.id} 
                  class={`group bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 transition-all duration-200 cursor-pointer hover:shadow-md ${
                    selectedProjectId === project.id.toString() 
                      ? 'border-[#9c40ff] bg-purple-50 dark:bg-purple-900/20' 
                      : 'border-transparent hover:border-gray-200 dark:hover:border-gray-600'
                  }`}
                  onClick={() => setSelectedProjectId(selectedProjectId === project.id.toString() ? null : project.id.toString())}
                >
                  <div class="p-4">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-gradient-to-br from-[#9c40ff]/20 to-[#8b008b]/20 rounded-lg flex items-center justify-center">
                          <FolderOpen class="w-5 h-5 text-[#9c40ff]" />
                        </div>
                        <div class="flex-1">
                          <div class="flex items-center gap-3 mb-1">
                            <h3 class="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-[#8b008b] dark:group-hover:text-[#9c40ff] transition-colors">
                              {project.name}
                            </h3>
                            {project.description && (
                              <span class="text-sm text-gray-600 dark:text-gray-400">• {project.description}</span>
                            )}
                          </div>
                          <div class="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                            <span>ID: {project.id}</span>
                            <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                            {project.branch && (
                              <span class="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded">
                                <GitBranch class="w-3 h-3 inline mr-1" />
                                {project.branch}
                              </span>
                            )}
                            {project.network_name && (
                              <span class="bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-mono">
                                <Network class="w-3 h-3 inline mr-1" />
                                {project.network_name}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div class="flex items-center space-x-2">
                        <button 
                          class="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/20 rounded transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            const url = `/app/services?project=${project.id}`
                            window.history.pushState({}, '', url)
                            window.dispatchEvent(new PopStateEvent('popstate'))
                          }}
                          title="View services"
                        >
                          <Eye class="w-4 h-4" />
                        </button>
                        {canManageProjects && (
                          <button 
                            class="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteProjectId(project.id.toString())
                            }}
                            title="Delete project"
                          >
                            <Trash2 class="w-4 h-4" />
                          </button>
                        )}
                        <ChevronDown 
                          class={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                            selectedProjectId === project.id.toString() ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </div>

                    {/* Expandable Project Details */}
                    {selectedProjectId === project.id.toString() && selectedProject && projectServices !== undefined && (
                      <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 space-y-4 bg-white dark:bg-gray-800 rounded-b-lg -mx-4 -mb-4 px-4 pb-4">
                        {/* Project Info Section */}
                        {(selectedProject.repo_url || selectedProject.image_target || selectedProject.network_name) && (
                          <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-2">
                            <h5 class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center">
                              <Settings class="w-3 h-3 mr-1.5" />
                              Configuration
                            </h5>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                              {selectedProject.repo_url && (
                                <div class="flex items-center space-x-2">
                                  <Code2 class="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                                  <div class="min-w-0">
                                    <span class="text-gray-600 dark:text-gray-400">Repository:</span>
                                    <a href={selectedProject.repo_url} target="_blank" rel="noopener noreferrer" class="ml-1 text-purple-600 dark:text-purple-400 hover:underline font-mono text-xs truncate block">
                                      {selectedProject.repo_url}
                                    </a>
                                  </div>
                                </div>
                              )}
                              {selectedProject.image_target && (
                                <div class="flex items-center space-x-2">
                                  <Container class="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                                  <div class="min-w-0">
                                    <span class="text-gray-600 dark:text-gray-400">Image Target:</span>
                                    <span class="ml-1 font-mono text-xs text-gray-900 dark:text-white truncate block">
                                      {selectedProject.image_target}
                                    </span>
                                  </div>
                                </div>
                              )}
                              {selectedProject.network_name && (
                                <div class="flex items-center space-x-2">
                                  <Network class="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                                  <div class="min-w-0">
                                    <span class="text-gray-600 dark:text-gray-400">Network:</span>
                                    <span class="ml-1 font-mono text-xs text-gray-900 dark:text-white">
                                      {selectedProject.network_name}
                                    </span>
                                  </div>
                                </div>
                              )}
                              {selectedProject.branch && (
                                <div class="flex items-center space-x-2">
                                  <GitBranch class="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                                  <div class="min-w-0">
                                    <span class="text-gray-600 dark:text-gray-400">Branch:</span>
                                    <span class="ml-1 font-mono text-xs text-gray-900 dark:text-white">
                                      {selectedProject.branch}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Services Section */}
                        <div>
                          <div class="flex items-center justify-between mb-3">
                            <h4 class="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
                              <Container class="w-4 h-4 mr-1.5 text-gray-500" />
                              Services ({projectServices ? projectServices.length : 0})
                            </h4>
                            <div class="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  const url = `/app/services?project=${project.id}`
                                  window.history.pushState({}, '', url)
                                  window.dispatchEvent(new PopStateEvent('popstate'))
                                }}
                                class="px-2 py-1 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/20 rounded transition-colors"
                              >
                                View All
                              </button>
                              {canManageProjects && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setShowCreateServiceModal(true)
                                  }}
                                  class="px-2 py-1 text-xs text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/20 rounded transition-colors"
                                >
                                  Deploy Service
                                </button>
                              )}
                            </div>
                          </div>

                          {projectServices && projectServices.length > 0 ? (
                            <div class="grid gap-2">
                              {projectServices.slice(0, 3).map((service: any) => (
                                <div key={service.id} class="bg-white dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-600">
                                  <div class="flex items-center justify-between">
                                    <div class="flex items-center space-x-2 min-w-0 flex-1">
                                      <div class="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center">
                                        <Container class="w-3 h-3 text-blue-600 dark:text-blue-400" />
                                      </div>
                                      <div class="min-w-0 flex-1">
                                        <div class="flex items-center gap-2">
                                          <span class="font-medium text-sm text-gray-900 dark:text-white truncate">{service.name}</span>
                                          <span class={`px-1.5 py-0.5 text-xs font-medium rounded-full ${
                                            service.status === 'running' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                                            service.status === 'stopped' ? 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300' :
                                            'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                          }`}>
                                            {service.status || 'unknown'}
                                          </span>
                                        </div>
                                        <p class="text-xs text-gray-600 dark:text-gray-400 truncate">{service.image}</p>
                                      </div>
                                    </div>
                                    
                                    <div class="flex items-center gap-1">
                                      {/* Route Link Button */}
                                      {(() => {
                                        const serviceRoutes = getServiceRoutes(service.id)
                                        return serviceRoutes.length > 0 ? (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation()
                                              window.open(buildRouteURL(serviceRoutes[0]), '_blank')
                                            }}
                                            class="p-1 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/20 rounded transition-colors"
                                            title={`Open ${serviceRoutes[0].domain}`}
                                          >
                                            <ExternalLink class="w-3 h-3" />
                                          </button>
                                        ) : null
                                      })()}

                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          handleViewLogs(service.id, service.name)
                                        }}
                                        class="p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded transition-colors"
                                        title="View logs"
                                      >
                                        <FileText class="w-3 h-3" />
                                      </button>

                                      {canManageProjects && (
                                        <>
                                          {service.status === 'running' ? (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                handleStopService(service.id, service.name)
                                              }}
                                              disabled={loadingStates[`stop_${service.id}`]}
                                              class="p-1 text-orange-600 dark:text-orange-400 hover:bg-orange-100 dark:hover:bg-orange-900/20 rounded transition-colors disabled:opacity-50"
                                              title="Stop service"
                                            >
                                              {loadingStates[`stop_${service.id}`] ? (
                                                <div class="w-3 h-3 border border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                                              ) : (
                                                <Square class="w-3 h-3" />
                                              )}
                                            </button>
                                          ) : (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                handleStartService(service.id, service.name)
                                              }}
                                              disabled={loadingStates[`start_${service.id}`]}
                                              class="p-1 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/20 rounded transition-colors disabled:opacity-50"
                                              title="Start service"
                                            >
                                              {loadingStates[`start_${service.id}`] ? (
                                                <div class="w-3 h-3 border border-green-600 border-t-transparent rounded-full animate-spin"></div>
                                              ) : (
                                                <Play class="w-3 h-3" />
                                              )}
                                            </button>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                              {projectServices.length > 3 && (
                                <div class="text-center py-2">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const url = `/app/services?project=${project.id}`
                                      window.history.pushState({}, '', url)
                                      window.dispatchEvent(new PopStateEvent('popstate'))
                                    }}
                                    class="text-xs text-purple-600 dark:text-purple-400 hover:underline"
                                  >
                                    View all {projectServices.length} services
                                  </button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div class="text-center py-6 text-gray-500 dark:text-gray-400">
                              <Container class="w-8 h-8 mx-auto mb-2 text-gray-400" />
                              <p class="text-xs">No services deployed yet</p>
                              {canManageProjects && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setShowCreateServiceModal(true)
                                  }}
                                  class="mt-2 px-3 py-1 text-xs bg-[#9c40ff] text-white rounded hover:bg-[#8b008b] transition-colors"
                                >
                                  Deploy First Service
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div class="text-center py-12">
              <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <FolderOpen class="w-8 h-8 text-gray-400" />
              </div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No projects found</h3>
              <p class="text-gray-600 dark:text-gray-400 text-sm mb-6">
                {canManageProjects 
                  ? 'Create your first project to organize and manage services.' 
                  : 'No projects have been created yet.'}
              </p>
              {canManageProjects && (
                <button 
                  class="inline-flex items-center px-4 py-2 bg-[#9c40ff] hover:bg-[#8b008b] text-white font-medium rounded-lg transition-colors"
                  onClick={() => setShowCreateModal(true)}
                >
                  <Plus class="w-4 h-4 mr-2" />
                  Create Project
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateProject}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteProjectId}
        onClose={() => setDeleteProjectId(null)}
        onConfirm={handleDeleteProject}
        title="Delete Project"
        message="Are you sure you want to delete this project? This action cannot be undone."
        confirmText="Delete"
        confirmStyle="danger"
      />


      {/* Create Service Modal */}
      <CreateServiceModal
        isOpen={showCreateServiceModal}
        onClose={() => setShowCreateServiceModal(false)}
        onSubmit={handleCreateService}
        projectName={selectedProject?.name}
      />

      {/* Logs Drawer */}
      <LogsDrawer
        isOpen={showLogsDrawer}
        onClose={() => {
          setShowLogsDrawer(false)
          setSelectedServiceId(null)
          setSelectedServiceName(null)
        }}
        serviceId={selectedServiceId || ''}
        serviceName={selectedServiceName || ''}
      />

      {/* Toast Notifications */}
      <Toast
        message={toastConfig.message}
        type={toastConfig.type}
        isVisible={toastConfig.show}
        onClose={() => setToastConfig({ ...toastConfig, show: false })}
      />
    </div>
  )
}