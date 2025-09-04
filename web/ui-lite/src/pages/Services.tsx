import { useState, useEffect } from 'preact/hooks'
import { apiClient, useApiData } from '../api'
import { ServiceIcon } from '../components/ServiceIcons'
import { StatusBadge, PortBadge, TagBadge } from '../components/ui/ServiceBadge'
import { getImageTag, getShortImageName, formatPort, getPortDescription } from '../utils/docker'
import { ViewModeSelector } from '../components/ViewModeSelector'
import { ServiceDiscovery } from '../components/ServiceDiscovery'
import { DeleteConfirmationModal } from '../components/DeleteConfirmationModal'
import { 
  Play, 
  Square, 
  RotateCcw, 
  Trash2, 
  Plus, 
  Search,
  Filter,
  Download,
  Upload,
  Server,
  Activity,
  Settings,
  RefreshCw,
  Eye,
  AlertCircle,
  CheckCircle,
  XCircle,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Folder,
  Info,
  Database,
  Network,
  Globe,
  ExternalLink
} from 'lucide-preact'

interface Service {
  id: string
  name: string
  project_id: string
  image: string
  status: 'running' | 'stopped' | 'error'
  ports?: Array<{
    host: number
    container: number
  }>
}

interface Project {
  id: number
  name: string
  description?: string
}

interface ServicesProps {
  onNavigateToService?: (serviceId: string) => void
}

export function Services({ onNavigateToService }: ServicesProps = {}) {
  const [services, setServices] = useState<Service[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [servicesLoading, setServicesLoading] = useState(true)
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [selectedProject, setSelectedProject] = useState<number | '' | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({
    name: '',
    image: '',
    ports: [{ host: 8080, container: 8080 }],
    env: {}
  })
  const [envInput, setEnvInput] = useState('')
  const [creating, setCreating] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'cards'>('cards')
  const [sortBy, setSortBy] = useState<'name' | 'status' | 'image' | 'created'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [statusFilter, setStatusFilter] = useState<'all' | 'running' | 'stopped' | 'error'>('all')
  const [searchFilter, setSearchFilter] = useState('')
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [serviceToDelete, setServiceToDelete] = useState<{id: string, name: string} | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  
  // Helper to update URL when project changes
  const updateProjectURL = (projectId: number | '') => {
    const url = new URL(window.location.href)
    if (projectId === '') {
      url.searchParams.delete('project')
    } else {
      url.searchParams.set('project', projectId.toString())
    }
    window.history.replaceState({}, '', url.toString())
  }
  
  // Get system info for Docker status
  const { data: systemInfo } = useApiData(() => apiClient.getSystemInfo())

  useEffect(() => {
    loadProjects()
  }, [])

  useEffect(() => {
    if (selectedProject !== null && projects.length > 0) {
      loadServices()
    }
  }, [selectedProject, projects])

  // Handle URL project parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const projectParam = urlParams.get('project')
    if (projectParam && projects.length > 0) {
      const projectId = parseInt(projectParam, 10)
      if (!isNaN(projectId) && projects.some(p => p.id === projectId)) {
        setSelectedProject(projectId)
      }
    }
  }, [projects])

  const loadProjects = async () => {
    try {
      const data = await apiClient.getProjects()
      setProjects(data)
      // Default to "All Projects" view when no project is selected
      if (data.length > 0 && selectedProject === null) {
        setSelectedProject('')
      }
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      setProjectsLoading(false)
    }
  }

  const loadServices = async () => {
    try {
      let data = []
      if (selectedProject === '') {
        // Load services from all projects
        const allServices = []
        for (const project of projects) {
          try {
            const projectServices = await apiClient.getProjectServices(project.id)
            allServices.push(...projectServices)
          } catch (error) {
            console.error(`Failed to load services for project ${project.id}:`, error)
          }
        }
        data = allServices
      } else {
        // Load services from specific project
        data = await apiClient.getProjectServices(selectedProject)
      }
      setServices(data)
    } catch (error) {
      console.error('Failed to load services:', error)
    } finally {
      setServicesLoading(false)
    }
  }

  const handleServiceAction = async (action: string, serviceId: string) => {
    try {
      if (action === 'start') {
        await apiClient.startService(serviceId)
      } else if (action === 'stop') {
        await apiClient.stopService(serviceId)
      } else if (action === 'restart') {
        await apiClient.restartService(serviceId)
      } else if (action === 'delete') {
        // Find the service to get its name for the modal
        const service = services.find(s => s.id === serviceId)
        setServiceToDelete({ id: serviceId, name: service?.name || 'Unknown Service' })
        setDeleteModalOpen(true)
        return // Don't reload services yet, wait for modal confirmation
      }
      loadServices()
    } catch (error) {
      console.error(`Failed to ${action} service:`, error)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!serviceToDelete || isDeleting) return
    
    setIsDeleting(true)
    try {
      await apiClient.deleteService(serviceToDelete.id)
      loadServices()
      // Show success message or toast here if desired
    } catch (error) {
      console.error('Failed to delete service:', error)
      // Show error message or toast here if desired
    } finally {
      setIsDeleting(false)
      setDeleteModalOpen(false)
      setServiceToDelete(null)
    }
  }

  const handleDeleteCancel = () => {
    if (isDeleting) return // Prevent closing while deleting
    setDeleteModalOpen(false)
    setServiceToDelete(null)
  }

  const handleCreateService = async () => {
    if (!createForm.name || !createForm.image) {
      return
    }
    
    // If "All Projects" is selected, use the first available project
    const targetProject = selectedProject === '' ? (projects.length > 0 ? projects[0].id : null) : selectedProject
    if (!targetProject) {
      return
    }

    setCreating(true)
    try {
      // Parse environment variables from input
      const env = {}
      if (envInput.trim()) {
        envInput.split('\n').forEach(line => {
          const [key, ...valueParts] = line.split('=')
          if (key && valueParts.length > 0) {
            env[key.trim()] = valueParts.join('=').trim()
          }
        })
      }

      await apiClient.createService(targetProject, {
        name: createForm.name,
        image: createForm.image,
        ports: createForm.ports.length > 0 ? createForm.ports : undefined,
        env: Object.keys(env).length > 0 ? env : undefined
      })

      // Reset form and close modal
      setCreateForm({
        name: '',
        image: '',
        ports: [{ host: 8080, container: 8080 }],
        env: {}
      })
      setEnvInput('')
      setShowCreateModal(false)
      loadServices()
    } catch (error) {
      console.error('Failed to create service:', error)
    } finally {
      setCreating(false)
    }
  }

  const addPortMapping = () => {
    setCreateForm({
      ...createForm,
      ports: [...createForm.ports, { host: 3000, container: 3000 }]
    })
  }

  const removePortMapping = (index: number) => {
    setCreateForm({
      ...createForm,
      ports: createForm.ports.filter((_, i) => i !== index)
    })
  }

  const updatePortMapping = (index: number, field: 'host' | 'container', value: number) => {
    const newPorts = [...createForm.ports]
    newPorts[index][field] = value
    setCreateForm({ ...createForm, ports: newPorts })
  }

  // Apply filtering and sorting to services
  const filteredServices = services
    .filter(service => {
      // Status filter
      if (statusFilter !== 'all' && service.status !== statusFilter) {
        return false
      }
      
      // Search filter
      if (searchFilter.trim()) {
        const searchTerm = searchFilter.toLowerCase()
        return (
          service.name.toLowerCase().includes(searchTerm) ||
          service.image.toLowerCase().includes(searchTerm) ||
          getShortImageName(service.image).toLowerCase().includes(searchTerm)
        )
      }
      
      return true
    })
    .sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
        case 'image':
          comparison = a.image.localeCompare(b.image)
          break
        case 'created':
          // Assuming services have a created timestamp - fallback to name
          comparison = a.name.localeCompare(b.name)
          break
        default:
          comparison = 0
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })

  // Render service in grid layout (compact cards)
  const renderGridView = () => (
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {filteredServices.map(service => (
        <div 
          key={service.id} 
          class="group bg-gradient-to-r from-white/50 via-gray-50/40 to-white/50 dark:from-gray-800/50 dark:via-gray-700/40 dark:to-gray-800/50 rounded-xl p-4 border border-gray-200/50 dark:border-gray-600/50 hover:shadow-lg hover:shadow-[#10b981]/10 hover:border-[#10b981]/30 transition-all duration-200 hover:scale-[1.02] cursor-pointer"
          onClick={() => onNavigateToService?.(service.id)}
        >
          <div class="flex flex-col items-center text-center">
            <ServiceIcon 
              imageName={service.image}
              className="w-12 h-12 mb-3"
              size={48}
            />
            <h3 class="font-bold text-gray-900 dark:text-white mb-1 truncate w-full">
              {service.name}
            </h3>
            <p class="text-xs text-gray-600 dark:text-gray-400 mb-2 truncate w-full">
              {getShortImageName(service.image)}
            </p>
            <div class="flex flex-wrap gap-1 mb-2 justify-center">
              <StatusBadge status={service.status as any} size="xs" />
              {getImageTag(service.image) !== 'latest' && (
                <TagBadge tag={getImageTag(service.image)} size="xs" />
              )}
            </div>
            {service.ports && service.ports.length > 0 && (
              <div class="flex flex-wrap gap-1 mb-3 justify-center">
                {service.ports.slice(0, 2).map((port: any, idx: number) => (
                  <PortBadge key={idx} port={port} size="xs" />
                ))}
                {service.ports.length > 2 && (
                  <span class="text-xs text-gray-500">+{service.ports.length - 2}</span>
                )}
              </div>
            )}
            <div class="flex items-center gap-1 w-full">
              {service.status === 'running' ? (
                <>
                  <button 
                    class="flex-1 px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleServiceAction('stop', service.id);
                    }}
                    title="Stop"
                  >
                    <Square className="w-3 h-3 mx-auto" />
                  </button>
                  <button 
                    class="flex-1 px-2 py-1 text-xs text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded transition-all"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleServiceAction('restart', service.id);
                    }}
                    title="Restart"
                  >
                    <RotateCcw className="w-3 h-3 mx-auto" />
                  </button>
                </>
              ) : (
                <button 
                  class="flex-1 px-2 py-1 text-xs text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleServiceAction('start', service.id);
                  }}
                  title="Start"
                >
                  <Play className="w-3 h-3 mx-auto" />
                </button>
              )}
              <button 
                class="flex-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900/30 rounded transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  handleServiceAction('delete', service.id);
                }}
                title="Delete"
              >
                <Trash2 className="w-3 h-3 mx-auto" />
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  // Render service in list layout (minimal rows)
  const renderListView = () => (
    <div class="space-y-2">
      {filteredServices.map(service => (
        <div 
          key={service.id} 
          class="group flex items-center justify-between py-3 px-4 bg-gradient-to-r from-white/50 via-gray-50/40 to-white/50 dark:from-gray-800/50 dark:via-gray-700/40 dark:to-gray-800/50 rounded-lg border border-gray-200/50 dark:border-gray-600/50 hover:shadow-md hover:shadow-[#10b981]/10 hover:border-[#10b981]/30 transition-all duration-200 cursor-pointer"
          onClick={() => onNavigateToService?.(service.id)}
        >
          <div class="flex items-center gap-4 flex-1">
            <ServiceIcon 
              imageName={service.image}
              className="w-8 h-8"
              size={32}
            />
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-gray-900 dark:text-white truncate">
                {service.name}
              </h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 truncate">
                {service.image}
              </p>
            </div>
            <span class={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
              service.status === 'running' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' : 
              service.status === 'stopped' ? 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300' : 
              'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
            }`}>
              <div class={`w-1.5 h-1.5 rounded-full mr-1 ${
                service.status === 'running' ? 'bg-green-500' : 
                service.status === 'stopped' ? 'bg-gray-500' : 'bg-red-500'
              }`}></div>
              {service.status}
            </span>
          </div>
          <div class="flex items-center gap-1 ml-4">
            {service.status === 'running' ? (
              <>
                <button 
                  class="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleServiceAction('stop', service.id);
                  }}
                  title="Stop"
                >
                  <Square className="w-4 h-4" />
                </button>
                <button 
                  class="p-1.5 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded transition-all"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleServiceAction('restart', service.id);
                  }}
                  title="Restart"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              </>
            ) : (
              <button 
                class="p-1.5 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-all"
                onClick={(e) => {
                  e.stopPropagation();
                  handleServiceAction('start', service.id);
                }}
                title="Start"
              >
                <Play className="w-4 h-4" />
              </button>
            )}
            <button 
              class="p-1.5 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-900/30 rounded transition-all"
              onClick={(e) => {
                e.stopPropagation();
                handleServiceAction('delete', service.id);
              }}
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )

  // Render service in card layout (detailed cards) - original layout
  const renderCardView = () => (
    <div class="grid gap-4">
      {filteredServices.map(service => (
        <div 
          key={service.id} 
          class="group bg-gradient-to-r from-white/50 via-gray-50/40 to-white/50 dark:from-gray-800/50 dark:via-gray-700/40 dark:to-gray-800/50 rounded-xl p-5 border border-gray-200/50 dark:border-gray-600/50 hover:shadow-lg hover:shadow-[#10b981]/10 hover:border-[#10b981]/30 transition-all duration-200 hover:scale-[1.01] cursor-pointer"
          onClick={() => onNavigateToService?.(service.id)}
        >
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-4">
              <ServiceIcon 
                imageName={service.image}
                className="w-14 h-14 shadow-md group-hover:shadow-lg transition-all duration-200"
                size={56}
              />
              <div>
                <h3 class="text-xl font-bold text-gray-900 dark:text-white mb-1 group-hover:text-[#047857] dark:group-hover:text-[#10b981] transition-colors duration-200">
                  {service.name}
                </h3>
                <div class="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                  <span class="flex items-center space-x-1">
                    <Database className="w-4 h-4" />
                    <span>{service.image}</span>
                  </span>
                  {service.ports && service.ports.length > 0 && (
                    <span class="flex items-center space-x-1">
                      <Network className="w-4 h-4" />
                      <span>{service.ports.map((p: any) => `${p.host}:${p.container}`).join(', ')}</span>
                    </span>
                  )}
                </div>
                <div class="flex items-center space-x-2 mt-2">
                  <span class={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                    service.status === 'running' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-700' : 
                    service.status === 'stopped' ? 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700' : 
                    'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-700'
                  }`}>
                    <div class={`w-2 h-2 rounded-full mr-1.5 ${
                      service.status === 'running' ? 'bg-green-500' : 
                      service.status === 'stopped' ? 'bg-gray-500' : 'bg-red-500'
                    }`}></div>
                    {service.status}
                  </span>
                </div>
              </div>
            </div>
      
            <div class="flex items-center space-x-2">
              {service.status === 'running' ? (
                <>
                  <button 
                    class="inline-flex items-center px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 bg-red-50/80 dark:bg-red-900/20 hover:bg-red-100/80 dark:hover:bg-red-900/30 rounded-lg transition-all duration-200 hover:scale-105"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleServiceAction('stop', service.id);
                    }}
                    title="Stop service"
                  >
                    <Square className="w-4 h-4 mr-1" />
                    Stop
                  </button>
                  <button 
                    class="inline-flex items-center px-3 py-2 text-sm font-medium text-yellow-600 dark:text-yellow-400 hover:text-yellow-700 dark:hover:text-yellow-300 bg-yellow-50/80 dark:bg-yellow-900/20 hover:bg-yellow-100/80 dark:hover:bg-yellow-900/30 rounded-lg transition-all duration-200 hover:scale-105"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleServiceAction('restart', service.id);
                    }}
                    title="Restart service"
                  >
                    <RotateCcw className="w-4 h-4 mr-1" />
                    Restart
                  </button>
                </>
              ) : (
                <button 
                  class="inline-flex items-center px-3 py-2 text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 bg-green-50/80 dark:bg-green-900/20 hover:bg-green-100/80 dark:hover:bg-green-900/30 rounded-lg transition-all duration-200 hover:scale-105"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleServiceAction('start', service.id);
                  }}
                  title="Start service"
                >
                  <Play className="w-4 h-4 mr-1" />
                  Start
                </button>
              )}
              <button 
                class="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 bg-gray-50/80 dark:bg-gray-900/20 hover:bg-gray-100/80 dark:hover:bg-gray-900/30 rounded-lg transition-all duration-200 hover:scale-105"
                onClick={(e) => {
                  e.stopPropagation();
                  handleServiceAction('delete', service.id);
                }}
                title="Delete service"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div class="space-y-6 fade-in">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-3xl font-bold mb-2">
            <span class="bg-gradient-to-r from-[#10b981] via-[#059669] to-[#047857] bg-clip-text text-transparent">
              Services
            </span>
          </h1>
          <p class="text-gray-600 dark:text-gray-400">
            Deploy and manage containerized services
          </p>
        </div>
        
        {/* Docker Status - Compact */}
        <div class={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium ${
          systemInfo?.docker_status === 'connected' 
            ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
            : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
        }`}>
          <div class={`w-2 h-2 rounded-full ${
            systemInfo?.docker_status === 'connected' ? 'bg-green-500' : 'bg-red-500'
          }`}></div>
          <span class="hidden sm:inline">Docker </span>
          {systemInfo?.docker_status === 'connected' ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* Main Content */}
      {projects.length > 0 ? (
        <>
          {/* Compact Project & Actions Bar */}
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-4">
            <div class="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* Project Selector */}
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-3">
                  <Folder className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                  <span class="text-sm font-medium text-gray-900 dark:text-white">Project:</span>
                </div>
{projects.length <= 6 ? (
                  // Show as tabs when few projects (6 or less)
                  <div class="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setSelectedProject('')
                        updateProjectURL('')
                      }}
                      class={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        selectedProject === ''
                          ? 'bg-[#10b981] text-white shadow-md'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      All Projects
                      {selectedProject === '' && <CheckCircle className="w-3 h-3 ml-1 inline" />}
                    </button>
                    {projects.map(project => (
                      <button
                        key={project.id}
                        onClick={() => {
                          setSelectedProject(project.id)
                          updateProjectURL(project.id)
                        }}
                        class={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 truncate max-w-[200px] ${
                          selectedProject === project.id
                            ? 'bg-[#10b981] text-white shadow-md'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                        }`}
                        title={project.name}
                      >
                        {project.name}
                        {selectedProject === project.id && <CheckCircle className="w-3 h-3 ml-1 inline" />}
                      </button>
                    ))}
                  </div>
                ) : (
                  // Show as dropdown when many projects (7+)
                  <div class="relative">
                    <select
                      value={selectedProject === '' ? '' : selectedProject || ''}
                      onChange={(e) => {
                        const value = e.target.value
                        const projectId = value === '' ? '' : parseInt(value, 10)
                        setSelectedProject(projectId)
                        updateProjectURL(projectId)
                      }}
                      class="w-full sm:w-64 px-3 py-2 pr-8 rounded-lg text-sm font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#10b981] focus:border-transparent cursor-pointer"
                    >
                      <option value="">All Projects ({projects.length})</option>
                      {projects.map(project => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                        </option>
                      ))}
                    </select>
                    <div class="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                      <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                )}
                {projectsLoading && (
                  <div class="flex items-center gap-2 text-gray-500 dark:text-gray-400 mt-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span class="text-sm">Loading projects...</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div class="flex flex-col sm:flex-row gap-3 lg:flex-shrink-0">
                {/* View Toggle */}
                <div class="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                  <button 
                    class={`p-1.5 rounded transition-all ${viewMode === 'grid' 
                      ? 'bg-white dark:bg-gray-600 shadow-sm' 
                      : 'text-gray-600 dark:text-gray-400'
                    }`}
                    onClick={() => setViewMode('grid')}
                    title="Grid View"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </button>
                  <button 
                    class={`p-1.5 rounded transition-all ${viewMode === 'list' 
                      ? 'bg-white dark:bg-gray-600 shadow-sm' 
                      : 'text-gray-600 dark:text-gray-400'
                    }`}
                    onClick={() => setViewMode('list')}
                    title="List View"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                  </button>
                  <button 
                    class={`p-1.5 rounded transition-all ${viewMode === 'cards' 
                      ? 'bg-white dark:bg-gray-600 shadow-sm' 
                      : 'text-gray-600 dark:text-gray-400'
                    }`}
                    onClick={() => setViewMode('cards')}
                    title="Card View"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </button>
                </div>

                {/* Deploy Buttons */}
                <div class="flex gap-2">
                  <button 
                    class="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center"
                    onClick={() => {
                      window.history.pushState({}, '', '/app/templates')
                      window.dispatchEvent(new PopStateEvent('popstate'))
                    }}
                  >
                    <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                    Templates
                  </button>
                  <button 
                    class="px-3 py-2 bg-[#10b981] hover:bg-[#059669] text-white text-sm font-medium rounded-lg transition-colors flex items-center"
                    onClick={() => setShowCreateModal(true)}
                  >
                    <Download className="w-4 h-4 mr-1.5" />
                    Deploy
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Compact Search & Filters */}
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 mb-4">
            <div class="flex flex-col sm:flex-row gap-3">
              {/* Search */}
              <div class="flex-1">
                <div class="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search services..."
                    value={searchFilter}
                    onInput={(e) => setSearchFilter((e.target as HTMLInputElement).value)}
                    class="w-full pl-9 pr-9 py-2 bg-gray-50 dark:bg-gray-700 border-0 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-[#10b981] focus:bg-white dark:focus:bg-gray-600 transition-all text-sm"
                  />
                  {searchFilter && (
                    <button
                      onClick={() => setSearchFilter('')}
                      class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Compact Filters */}
              <div class="flex items-center gap-2 text-sm">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  class="px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border-0 rounded text-gray-900 dark:text-white"
                >
                  <option value="all">All</option>
                  <option value="running">Running</option>
                  <option value="stopped">Stopped</option>
                  <option value="error">Error</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  class="px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border-0 rounded text-gray-900 dark:text-white"
                >
                  <option value="name">Name</option>
                  <option value="status">Status</option>
                  <option value="image">Image</option>
                </select>

                <button
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  class="p-1.5 bg-gray-50 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                >
                  {sortOrder === 'asc' ? (
                    <ArrowUp className="w-4 h-4" />
                  ) : (
                    <ArrowDown className="w-4 h-4" />
                  )}
                </button>

                <span class="text-gray-500 dark:text-gray-400 ml-2">
                  {filteredServices.length} service{filteredServices.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          </div>

          {/* Services List */}
          <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div class="p-4">
              {servicesLoading ? (
                <div class="space-y-4">
                  <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-xl h-20"></div>
                  <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-xl h-20"></div>
                  <div class="animate-pulse bg-gray-200 dark:bg-gray-700 rounded-xl h-20"></div>
                </div>
              ) : filteredServices.length > 0 ? (
                <>
                  {viewMode === 'grid' && renderGridView()}
                  {viewMode === 'list' && renderListView()}  
                  {viewMode === 'cards' && renderCardView()}
                </>
              ) : (
                <div class="text-center py-12">
                  <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Server className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No services found</h3>
                  <p class="text-gray-600 dark:text-gray-400 text-sm mb-6">
                    {selectedProject === '' ? 'No services deployed in any project yet.' : 'No services deployed in this project yet.'}
                  </p>
                  <button 
                    class="inline-flex items-center px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-medium rounded-lg transition-colors"
                    onClick={() => setShowCreateModal(true)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Deploy Service
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8">
          <div class="text-center">
            <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Folder className="w-8 h-8 text-gray-400" />
            </div>
            <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No projects found</h3>
            <p class="text-gray-600 dark:text-gray-400 text-sm mb-6 max-w-md mx-auto">
              Create a project first to organize and deploy your services.
            </p>
            <div class="inline-flex items-center px-3 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 font-medium rounded-lg border border-blue-200 dark:border-blue-800 text-sm">
              <Info className="w-4 h-4 mr-2" />
              Go to Projects page to create one
            </div>
          </div>
        </div>
      )}

      {/* Service Discovery Section */}
      {projects.length > 0 && (
        <div className="mt-6">
          <ServiceDiscovery 
            projects={projects} 
            onServiceAdopted={() => {
              // Refresh services when a container is adopted
              loadServices();
            }}
          />
        </div>
      )}

      {/* Create Service Modal */}
      {showCreateModal && (
        <div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div class="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Deploy New Service</h2>
              <p class="text-gray-600 dark:text-gray-400 text-sm mt-1">
                Deploy a containerized service to your project
              </p>
            </div>
            
            <div class="p-6 space-y-6">
              {/* Service Name */}
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Service Name
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="my-spring-app"
                  class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-[#10b981] focus:border-transparent"
                />
              </div>

              {/* Container Image */}
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Docker Image
                </label>
                <input
                  type="text"
                  value={createForm.image}
                  onChange={(e) => setCreateForm({ ...createForm, image: e.target.value })}
                  placeholder="openjdk:17-jdk-alpine"
                  class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-[#10b981] focus:border-transparent"
                />
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Popular images: openjdk:17-jdk-alpine, node:18-alpine, nginx:alpine, postgres:15-alpine
                </p>
              </div>

              {/* Port Mappings */}
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Port Mappings
                  </label>
                  <button
                    type="button"
                    onClick={addPortMapping}
                    class="text-xs text-[#10b981] hover:text-[#059669] font-medium"
                  >
                    + Add Port
                  </button>
                </div>
                {createForm.ports.map((port, index) => (
                  <div key={index} class="flex items-center space-x-2 mb-2">
                    <input
                      type="number"
                      value={port.host}
                      onChange={(e) => updatePortMapping(index, 'host', parseInt(e.target.value) || 0)}
                      placeholder="Host port"
                      class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#10b981] focus:border-transparent"
                    />
                    <span class="text-gray-500 dark:text-gray-400">:</span>
                    <input
                      type="number"
                      value={port.container}
                      onChange={(e) => updatePortMapping(index, 'container', parseInt(e.target.value) || 0)}
                      placeholder="Container port"
                      class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#10b981] focus:border-transparent"
                    />
                    {createForm.ports.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePortMapping(index)}
                        class="text-red-500 hover:text-red-600 p-1"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Environment Variables */}
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Environment Variables
                </label>
                <textarea
                  value={envInput}
                  onChange={(e) => setEnvInput(e.target.value)}
                  placeholder="SPRING_PROFILES_ACTIVE=prod&#10;DATABASE_URL=postgresql://localhost:5432/mydb&#10;PORT=8080"
                  rows={4}
                  class="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-[#10b981] focus:border-transparent text-sm font-mono"
                />
                <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  One variable per line in KEY=VALUE format
                </p>
              </div>
            </div>

            <div class="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={creating}
                class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateService}
                disabled={creating || !createForm.name || !createForm.image}
                class="px-4 py-2 bg-gradient-to-r from-[#10b981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Deploying...' : 'Deploy Service'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModalOpen}
        onClose={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        serviceName={serviceToDelete?.name}
        isLoading={isDeleting}
        requireTextConfirmation={true}
        title="Delete Service"
        message="This action cannot be undone. This will permanently delete the service, remove its container, and delete all associated data including volumes, networks, and configurations."
        customContent={
          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <div class="text-sm text-red-800 dark:text-red-200">
              <p class="font-medium mb-1">This will:</p>
              <ul class="list-disc list-inside space-y-1 text-xs">
                <li>Stop and remove the Docker container</li>
                <li>Delete the service configuration</li>
                <li>Remove all associated volumes and data</li>
                <li>Clear network configurations</li>
              </ul>
            </div>
          </div>
        }
      />
    </div>
  )
}