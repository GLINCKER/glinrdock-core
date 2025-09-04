import { useState, useEffect } from 'preact/hooks'
import { apiClient, useApiData } from '../api'
import { ServiceIcon } from '../components/ServiceIcons'
import { templateService, TemplateWithVerification } from '../services/templateService'
import { TemplateVerificationBadge } from '../components/TemplateVerificationBadge'
import { ViewModeSelector } from '../components/ViewModeSelector'

interface Project {
  id: string | number
  name: string
  description?: string
}

export function ServiceTemplates() {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedProject, setSelectedProject] = useState<string | number>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [selectedComplexity, setSelectedComplexity] = useState<string>('all')
  const [showPopularOnly, setShowPopularOnly] = useState<boolean>(false)
  const [deploying, setDeploying] = useState<string | null>(null)
  const [deployStatus, setDeployStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'cards'>('cards')
  const [templates, setTemplates] = useState<TemplateWithVerification[]>([]) 
  const [loading, setLoading] = useState<boolean>(true)

  // Get system info for Docker status
  const { data: systemInfo } = useApiData(() => apiClient.getSystemInfo())

  useEffect(() => {
    loadProjects()
    loadTemplates()
  }, [])

  const loadTemplates = async () => {
    setLoading(true)
    try {
      const allTemplates = await templateService.getAllTemplates(true)
      setTemplates(allTemplates)
    } catch (error) {
      console.error('Failed to load templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const searchTemplatesAsync = async (query: string) => {
    if (!query.trim()) {
      loadTemplates()
      return
    }
    
    setLoading(true)
    try {
      const searchResults = await templateService.searchTemplates(query, 25)
      setTemplates(searchResults)
    } catch (error) {
      console.error('Failed to search templates:', error)
    } finally {
      setLoading(false)
    }
  }

  // Debounce search to avoid too many API calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      searchTemplatesAsync(searchQuery)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  const loadProjects = async () => {
    try {
      const data = await apiClient.getProjects()
      setProjects(data || [])
      if (data && data.length > 0) {
        setSelectedProject(data[0].id)
      }
    } catch (error) {
      console.error('Failed to load projects:', error)
    }
  }

  const deployTemplate = async (template: TemplateWithVerification) => {
    if (!selectedProject) {
      setDeployStatus({ type: 'error', message: 'Please select a project first' })
      return
    }

    if (systemInfo?.docker_status !== 'connected') {
      setDeployStatus({ type: 'error', message: 'Docker is not connected. Please start Docker and try again.' })
      return
    }

    setDeploying(template.id)
    setDeployStatus(null)

    try {
      // Generate DNS-friendly name
      const timestamp = Date.now().toString().slice(-4)
      const serviceName = `${template.name}-${timestamp}`.toLowerCase().replace(/[^a-z0-9-]/g, '-')

      // Prepare port mappings
      const ports = [
        { host: template.defaultPort, container: getContainerPort(template) }
      ]
      
      // Add additional ports if specified
      if (template.additionalPorts) {
        template.additionalPorts.forEach((port, index) => {
          const containerPort = getAdditionalContainerPort(template, index)
          ports.push({ host: port, container: containerPort })
        })
      }

      // Get template with dynamic version
      const templateWithVersion = await templateService.getTemplateWithVersion(template.id)
      const imageWithTag = templateWithVersion?.dynamicVersion 
        ? `${template.baseImage}:${templateWithVersion.dynamicVersion}`
        : template.baseImage

      const payload = {
        name: serviceName,
        image: imageWithTag,
        ports: ports,
        env: template.defaultEnv || {}
      }


      await apiClient.createService(selectedProject, payload)
      
      setDeployStatus({ 
        type: 'success', 
        message: `${template.displayName} deployed successfully as "${serviceName}" on port ${template.defaultPort}` 
      })
    } catch (error: any) {
      console.error('Failed to deploy service:', error)
      setDeployStatus({ 
        type: 'error', 
        message: error.message || 'Failed to deploy service' 
      })
    } finally {
      setDeploying(null)
    }
  }

  const getContainerPort = (template: TemplateWithVerification): number => {
    // Map known services to their default container ports
    const containerPorts: Record<string, number> = {
      'redis': 6379,
      'postgres': 5432,
      'mongodb': 27017,
      'nginx': 80,
      'rabbitmq': 5672,
      'elasticsearch': 9200,
      'mysql': 3306,
      'grafana': 3000
    }
    return containerPorts[template.id] || 8080
  }

  const getAdditionalContainerPort = (template: TemplateWithVerification, index: number): number => {
    // For services with management UIs
    if (template.id === 'rabbitmq' && index === 0) return 15672 // Management UI
    return 8080 + index
  }

  // Helper function to generate correct Docker Hub URL
  const getDockerHubUrl = (baseImage: string): string => {
    const image = baseImage.toLowerCase();
    
    // Handle different Docker Hub URL patterns
    if (image.includes('/')) {
      // For images like "username/image" or "registry.com/namespace/image"
      if (image.startsWith('mcr.microsoft.com/') || image.includes('.')) {
        // For Microsoft Container Registry or other registries, just search Docker Hub
        const imageName = image.split('/').pop() || image;
        return `https://hub.docker.com/search?q=${encodeURIComponent(imageName)}`;
      } else {
        // Standard user/org repositories
        return `https://hub.docker.com/r/${baseImage}`;
      }
    } else {
      // Official images (like postgres, nginx, redis)
      return `https://hub.docker.com/_/${baseImage}`;
    }
  }

  const categories = [
    { 
      id: 'all', 
      name: 'All Services', 
      icon: (
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
      )
    },
    { 
      id: 'database', 
      name: 'Databases', 
      icon: (
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
        </svg>
      )
    },
    { 
      id: 'cache', 
      name: 'Cache', 
      icon: (
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    },
    { 
      id: 'web', 
      name: 'Web Servers', 
      icon: (
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      )
    },
    { 
      id: 'message', 
      name: 'Messaging', 
      icon: (
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      )
    },
    { 
      id: 'streaming', 
      name: 'Streaming', 
      icon: (
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M9.879 16.121A3 3 0 1012.015 11L11 14l1.879 2.121z" />
        </svg>
      )
    },
    { 
      id: 'monitoring', 
      name: 'Monitoring', 
      icon: (
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    { 
      id: 'development', 
      name: 'Development', 
      icon: (
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
      )
    },
    { 
      id: 'storage', 
      name: 'Storage', 
      icon: (
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z" />
        </svg>
      )
    },
    { 
      id: 'media', 
      name: 'Media', 
      icon: (
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      )
    },
    { 
      id: 'security', 
      name: 'Security', 
      icon: (
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      )
    },
    { 
      id: 'networking', 
      name: 'Networking', 
      icon: (
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
        </svg>
      )
    }
  ]

  // Apply additional filters (search is handled separately via API)
  let filteredTemplates = templates

  // Filter by category
  if (selectedCategory !== 'all') {
    filteredTemplates = filteredTemplates.filter(t => t.category === selectedCategory)
  }

  // Filter by complexity
  if (selectedComplexity !== 'all') {
    filteredTemplates = filteredTemplates.filter(t => t.complexity === selectedComplexity)
  }

  // Filter by popularity
  if (showPopularOnly) {
    filteredTemplates = filteredTemplates.filter(t => t.popular)
  }

  const selectedProjectName = projects.find(p => p.id === selectedProject)?.name || 'Unknown Project'

  // Render functions for different view modes
  const renderGridView = () => (
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {filteredTemplates.map(template => (
        <div
          key={template.id}
          class={`${template.isExternal ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} rounded-xl border shadow-sm hover:shadow-lg transition-all duration-200 overflow-hidden relative`}
        >
          {/* Docker icon for external templates - clickable */}
          {template.isExternal && (
            <div class="absolute top-2 right-2 z-10">
              <a 
                href={getDockerHubUrl(template.baseImage)}
                target="_blank"
                rel="noopener noreferrer"
                class="w-6 h-6 bg-blue-500 rounded-lg flex items-center justify-center shadow-sm hover:bg-blue-600 transition-colors"
                title={`View ${template.baseImage} on Docker Hub`}
              >
                <svg class="w-4 h-4 text-white" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                  <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z"/>
                </svg>
              </a>
            </div>
          )}
          <div class="p-4">
            {/* Icon and title */}
            <div class="flex items-center gap-3 mb-3">
              <div class="w-12 h-12 flex items-center justify-center">
                <ServiceIcon imageName={template.baseImage} className="w-10 h-10" />
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="font-semibold text-gray-900 dark:text-white text-sm truncate">{template.displayName}</h3>
                <span class="text-xs text-gray-500 dark:text-gray-400">
                  {template.isExternal ? template.baseImage : `Port ${template.defaultPort}`}
                </span>
              </div>
            </div>

            {/* Badges */}
            <div class="flex items-center gap-2 mb-3 flex-wrap">
              {template.category !== 'development' && (
                <span class="inline-block text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                  {template.category}
                </span>
              )}
              <TemplateVerificationBadge 
                verificationLevel={template.verificationLevel} 
                size="sm" 
                showText={true}
              />
              {template.popular && (
                <div class="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                  <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  <span class="text-xs font-medium">Popular</span>
                </div>
              )}
            </div>

            {/* Stats for external templates */}
            {template.isExternal && (template.starCount || template.pullCount) && (
              <div class="flex items-center gap-3 mb-3 text-xs text-gray-600 dark:text-gray-400">
                {template.starCount && (
                  <div class="flex items-center gap-1">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span>{template.starCount.toLocaleString()}</span>
                  </div>
                )}
                {template.pullCount && (
                  <div class="flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    <span>{template.pullCount.toLocaleString()}</span>
                  </div>
                )}
              </div>
            )}

            {/* Action buttons */}
            <div class="flex gap-2">
              <button
                onClick={() => deployTemplate(template)}
                disabled={!selectedProject || systemInfo?.docker_status !== 'connected' || deploying === template.id}
                class={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                  !selectedProject || systemInfo?.docker_status !== 'connected'
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : deploying === template.id
                    ? 'bg-yellow-500 text-white cursor-wait'
                    : 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 hover:border-slate-500 shadow-sm hover:shadow-md transition-all duration-200'
                }`}
              >
                {deploying === template.id ? (
                  <>
                    <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span class="hidden sm:inline">Starting...</span>
                  </>
                ) : (
                  <>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    <span class="hidden sm:inline">Launch</span>
                  </>
                )}
              </button>
              <button
                class="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
                title="View details"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  const renderListView = () => (
    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div class="divide-y divide-gray-200 dark:divide-gray-700">
        {filteredTemplates.map(template => (
          <div key={template.id} class={`p-4 transition-colors duration-200 ${template.isExternal ? 'bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-900/10 hover:from-blue-100/70 dark:hover:from-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-4 flex-1">
                <div class="w-12 h-12 flex items-center justify-center">
                  <ServiceIcon imageName={template.baseImage} className="w-10 h-10" />
                </div>
                <div class="flex-1">
                  <div class="flex items-center gap-3 mb-1 flex-wrap">
                    <h3 class="font-semibold text-gray-900 dark:text-white">{template.displayName}</h3>
                    {template.isExternal && (
                      <span class="text-xs text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                        {template.baseImage}
                      </span>
                    )}
                    {template.category !== 'development' && (
                      <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                        {template.category}
                      </span>
                    )}
                    <TemplateVerificationBadge 
                      verificationLevel={template.verificationLevel} 
                      size="sm" 
                      showText={true}
                    />
                    {template.isExternal && (
                      <a 
                        href={getDockerHubUrl(template.baseImage)}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="inline-flex items-center justify-center w-6 h-6 bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors"
                        title={`View ${template.baseImage} on Docker Hub`}
                      >
                        <svg class="w-3.5 h-3.5" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                          <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z"/>
                        </svg>
                      </a>
                    )}
                  </div>
                  <div class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                    {!template.isExternal && <span>Port {template.defaultPort}</span>}
                    {template.isExternal && (template.starCount || template.pullCount) && (
                      <div class="flex items-center gap-3">
                        {template.starCount && (
                          <div class="flex items-center gap-1">
                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <span>{template.starCount.toLocaleString()}</span>
                          </div>
                        )}
                        {template.pullCount && (
                          <div class="flex items-center gap-1">
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                            </svg>
                            <span>{template.pullCount.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div class="flex gap-1">
                      {template.tags.filter(tag => tag !== template.category).slice(0, 2).map(tag => (
                        <span key={tag} class="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button
                  onClick={() => deployTemplate(template)}
                  disabled={!selectedProject || systemInfo?.docker_status !== 'connected' || deploying === template.id}
                  class={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
                    !selectedProject || systemInfo?.docker_status !== 'connected'
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      : deploying === template.id
                      ? 'bg-yellow-500 text-white cursor-wait'
                      : 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 hover:border-slate-500 shadow-sm hover:shadow-md transition-all duration-200'
                  }`}
                >
                  {deploying === template.id ? (
                    <>
                      <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Launching...
                    </>
                  ) : (
                    <>
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                      </svg>
                      Launch
                    </>
                  )}
                </button>
                <button
                  class="p-2 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
                  title="View details"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  const renderCardView = () => (
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {filteredTemplates.map(template => (
        <div
          key={template.id}
          class={`${template.isExternal ? 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'} rounded-xl border shadow-lg hover:shadow-xl transition-all duration-200 overflow-hidden flex flex-col h-full relative`}
        >
          {/* Docker icon for external templates - clickable */}
          {template.isExternal && (
            <div class="absolute top-3 right-3 z-10">
              <a 
                href={getDockerHubUrl(template.baseImage)}
                target="_blank"
                rel="noopener noreferrer"
                class="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow-sm hover:bg-blue-600 transition-colors"
                title={`View ${template.baseImage} on Docker Hub`}
              >
                <svg class="w-4 h-4 text-white" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                  <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z"/>
                </svg>
              </a>
            </div>
          )}
          <div class="p-4 flex flex-col flex-grow">
            {/* Header */}
            <div class="flex items-center gap-3 mb-3">
              <div class="w-10 h-10 flex items-center justify-center">
                <ServiceIcon imageName={template.baseImage} className="w-8 h-8" />
              </div>
              <div class="flex-1">
                <h3 class="font-bold text-gray-900 dark:text-white">{template.displayName}</h3>
                {template.isExternal && (
                  <p class="text-xs text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                    {template.baseImage}
                  </p>
                )}
                <div class="flex items-center gap-2 mt-1 flex-wrap">
                  {template.category !== 'development' && (
                    <span class="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                      {template.category}
                    </span>
                  )}
                  <TemplateVerificationBadge 
                    verificationLevel={template.verificationLevel} 
                    size="sm" 
                    showText={true}
                  />
                  {!template.isExternal && (
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                      Port {template.defaultPort}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Description */}
            <div class="flex-grow mb-4">
              <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-3">
                {template.description}
              </p>
            </div>

            {/* Stats for external templates */}
            {template.isExternal && (template.starCount || template.pullCount) && (
              <div class="flex items-center gap-3 mb-3 text-xs text-gray-600 dark:text-gray-400 justify-center">
                {template.starCount && (
                  <div class="flex items-center gap-1">
                    <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    <span>{template.starCount.toLocaleString()} stars</span>
                  </div>
                )}
                {template.pullCount && (
                  <div class="flex items-center gap-1">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    <span>{template.pullCount.toLocaleString()} pulls</span>
                  </div>
                )}
              </div>
            )}

            {/* Tags and Version */}
            <div class="flex items-center justify-between mb-4">
              <div class="flex flex-wrap gap-1">
                {template.tags.filter(tag => tag !== template.category).slice(0, 2).map(tag => (
                  <span
                    key={tag}
                    class="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <div class="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span>{template.dynamicVersion || 'latest'}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div class="flex gap-2">
              <button
                onClick={() => deployTemplate(template)}
                disabled={!selectedProject || systemInfo?.docker_status !== 'connected' || deploying === template.id}
                class={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                  !selectedProject || systemInfo?.docker_status !== 'connected'
                    ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                    : deploying === template.id
                    ? 'bg-yellow-500 text-white cursor-wait'
                    : 'bg-slate-700 hover:bg-slate-600 text-white border border-slate-600 hover:border-slate-500 shadow-sm hover:shadow-md transition-all duration-200'
                }`}
              >
                {deploying === template.id ? (
                  <>
                    <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span class="hidden sm:inline">Starting...</span>
                  </>
                ) : !selectedProject ? (
                  <>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span class="text-xs">Select Project</span>
                  </>
                ) : systemInfo?.docker_status !== 'connected' ? (
                  <>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span class="text-xs">Docker Offline</span>
                  </>
                ) : (
                  <>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                    </svg>
                    <span class="hidden sm:inline">Launch</span>
                    <span class="sm:hidden">Go</span>
                  </>
                )}
              </button>
              <div class="flex gap-1">
                <button
                  class="p-1.5 rounded-md border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200"
                  title="View documentation"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
                <a
                  href={getDockerHubUrl(template.baseImage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  class="p-1.5 rounded-md border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 inline-flex items-center justify-center"
                  title="View on Docker Hub"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  return (
    <div class="p-4 lg:p-6 max-w-7xl mx-auto">
      {/* Header with Search */}
      <div class="mb-8">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div class="flex-1">
            <div class="flex items-center gap-3 mb-2">
              <h1 class="text-2xl lg:text-3xl font-bold">
                <span class="bg-gradient-to-r from-[#10b981] via-[#059669] to-[#047857] bg-clip-text text-transparent">
                  Service Templates
                </span>
              </h1>
              <div class="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full border border-blue-200 dark:border-blue-800 text-sm font-medium">
                <svg class="w-4 h-4" role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                  <path d="M13.983 11.078h2.119a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.119a.185.185 0 00-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 00.186-.186V3.574a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 00.186-.186V6.29a.186.186 0 00-.186-.185h-2.118a.185.185 0 00-.185.185v1.887c0 .102.082.185.185.186m-2.93 0h2.12a.186.186 0 00.184-.186V6.29a.185.185 0 00-.185-.185H8.1a.185.185 0 00-.185.185v1.887c0 .102.083.185.185.186m-2.964 0h2.119a.186.186 0 00.185-.186V6.29a.185.185 0 00-.185-.185H5.136a.186.186 0 00-.186.185v1.887c0 .102.084.185.186.186m5.893 2.715h2.118a.186.186 0 00.186-.185V9.006a.186.186 0 00-.186-.186h-2.118a.185.185 0 00-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 00.185-.185V9.006a.185.185 0 00-.184-.186h-2.12a.186.186 0 00-.186.186v1.887c0 .102.084.185.186.185m-2.92 0h2.12a.185.185 0 00.184-.185V9.006a.185.185 0 00-.184-.186h-2.12a.185.185 0 00-.184.185v1.888c0 .102.082.185.185.185M23.763 9.89c-.065-.051-.672-.51-1.954-.51-.338.001-.676.03-1.01.087-.248-1.7-1.653-2.53-1.716-2.566l-.344-.199-.226.327c-.284.438-.49.922-.612 1.43-.23.97-.09 1.882.403 2.661-.595.332-1.55.413-1.744.42H.751a.751.751 0 00-.75.748 11.376 11.376 0 00.692 4.062c.545 1.428 1.355 2.48 2.41 3.124 1.18.723 3.1 1.137 5.275 1.137.983.003 1.963-.086 2.93-.266a12.248 12.248 0 003.823-1.389c.98-.567 1.86-1.288 2.61-2.136 1.252-1.418 1.998-2.997 2.553-4.4h.221c1.372 0 2.215-.549 2.68-1.009.309-.293.55-.65.707-1.046l.098-.288Z"/>
                </svg>
                Docker Hub Integrated
              </div>
            </div>
            <p class="text-gray-600 dark:text-gray-400 text-sm lg:text-base">
              Deploy popular services with one click - pre-configured and ready to use
            </p>
          </div>

          {/* Docker Status - Icon Only */}
          <div class={`flex items-center justify-center w-10 h-10 rounded-lg border ${
            systemInfo?.docker_status === 'connected' 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
          }`} title={`Docker ${systemInfo?.docker_status === 'connected' ? 'Connected' : 'Disconnected'}`}>
            <svg class={`w-5 h-5 ${
              systemInfo?.docker_status === 'connected' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {systemInfo?.docker_status === 'connected' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              )}
            </svg>
          </div>
        </div>

        {/* Search and Filters */}
        <div class="mb-6">
          <div class="flex flex-col lg:flex-row gap-4 mb-4">
            {/* Search Input */}
            <div class="flex-1 relative">
              <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search services, technologies, or tags..."
                value={searchQuery}
                onInput={(e) => setSearchQuery((e.target as HTMLInputElement).value)}
                class="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-[#10b981] focus:border-transparent transition-all duration-200"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* View Mode Toggle */}
            <ViewModeSelector
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              className="mr-3"
            />

            {/* Filter Toggles */}
            <div class="flex gap-2">
              <button
                onClick={() => setShowPopularOnly(!showPopularOnly)}
                class={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                  showPopularOnly
                    ? 'bg-[#10b981] text-white shadow-lg shadow-[#10b981]/25'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <svg class="w-4 h-4 mr-2 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
                Popular Only
              </button>

              <select
                value={selectedComplexity}
                onChange={(e) => setSelectedComplexity((e.target as HTMLSelectElement).value)}
                class="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#10b981] focus:border-transparent"
              >
                <option value="all">All Levels</option>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
          </div>

          {/* Results Count */}
          <div class="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>
              {filteredTemplates.length} service{filteredTemplates.length !== 1 ? 's' : ''} available
              {searchQuery && ` for "${searchQuery}"`}
            </span>
            {(searchQuery || selectedCategory !== 'all' || selectedComplexity !== 'all' || showPopularOnly) && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setSelectedCategory('all')
                  setSelectedComplexity('all')
                  setShowPopularOnly(false)
                }}
                class="text-[#10b981] hover:text-[#059669] font-medium"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Project Selection */}
        <div class="mb-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-3">Deploy to Project</h3>
          <div class="flex flex-wrap gap-2">
            {projects.map(project => (
              <button
                key={project.id}
                onClick={() => setSelectedProject(project.id)}
                class={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${
                  selectedProject === project.id
                    ? 'bg-[#10b981] text-white border-[#10b981] shadow-lg shadow-[#10b981]/25'
                    : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                {project.name}
              </button>
            ))}
          </div>
          {selectedProject && (
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Services will be deployed to: <strong>{selectedProjectName}</strong>
            </p>
          )}
        </div>

        {/* Status Messages */}
        {deployStatus && (
          <div class={`mb-6 p-4 rounded-lg border ${
            deployStatus.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-300'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          }`}>
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {deployStatus.type === 'success' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                )}
              </svg>
              {deployStatus.message}
            </div>
          </div>
        )}

        {/* Category Filters */}
        <div class="flex flex-wrap gap-2 mb-6">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => setSelectedCategory(category.id)}
              class={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border ${
                selectedCategory === category.id
                  ? 'bg-[#9c40ff] text-white border-[#9c40ff] shadow-lg shadow-[#9c40ff]/25'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              <span class="flex items-center gap-2">
                <span>{category.icon}</span>
                {category.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Service Templates - Dynamic View */}
      <div>
        {loading ? (
          <div class="flex items-center justify-center py-12">
            <div class="flex items-center gap-3">
              <svg class="w-6 h-6 animate-spin text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span class="text-lg text-gray-600 dark:text-gray-400">
                {searchQuery ? 'Searching templates...' : 'Loading templates...'}
              </span>
            </div>
          </div>
        ) : (
          <>
            {viewMode === 'grid' && renderGridView()}
            {viewMode === 'list' && renderListView()}
            {viewMode === 'cards' && renderCardView()}
          </>
        )}
      </div>

      {filteredTemplates.length === 0 && (
        <div class="text-center py-12">
          <div class="w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <svg class="w-16 h-16 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No templates found
          </h3>
          <p class="text-gray-600 dark:text-gray-400">
            Try selecting a different category or check back later for more templates.
          </p>
        </div>
      )}
    </div>
  )
}