import { Database, Server, Globe, Zap, Coffee, Code, FileText, Box } from 'lucide-preact'

interface RecentActivityProps {
  projects?: any[]
  recentServices: any[]
  onPageChange?: (page: string) => void
}

export function RecentActivity({ projects, recentServices, onPageChange }: RecentActivityProps) {
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'running': case 'connected': case 'online': return 'text-emerald-500'
      case 'stopped': case 'disconnected': case 'offline': return 'text-red-500'
      case 'starting': case 'pending': return 'text-yellow-500'
      default: return 'text-gray-500'
    }
  }

  const getServiceIcon = (image: string) => {
    const service = image?.split('/').pop()?.split(':')[0]?.toLowerCase() || 'default'
    const iconProps = { size: 20, className: 'text-gray-600 dark:text-gray-300 group-hover:text-[#9c40ff] transition-colors' }
    
    const commonServices: Record<string, JSX.Element> = {
      'nginx': <Globe {...iconProps} />,
      'redis': <Database {...iconProps} />, 
      'postgres': <Database {...iconProps} />, 
      'mysql': <Database {...iconProps} />, 
      'mongodb': <Database {...iconProps} />, 
      'node': <Server {...iconProps} />, 
      'python': <Code {...iconProps} />, 
      'java': <Coffee {...iconProps} />,
      'wordpress': <FileText {...iconProps} />, 
      'nextjs': <Zap {...iconProps} />, 
      'react': <Code {...iconProps} />, 
      'vue': <Code {...iconProps} />
    }
    return commonServices[service] || <Box {...iconProps} />
  }

  return (
    <div class="grid lg:grid-cols-3 gap-6">
      {/* Your Projects */}
      <div class="card gradient-card shadow-lg shadow-[#8b008b]/20">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-semibold">
            <span class="bg-gradient-to-r from-[#8b008b] to-[#e94057] bg-clip-text text-transparent">
              Your Projects
            </span>
          </h3>
          <button 
            onClick={() => onPageChange?.('projects')}
            class="text-xs font-medium text-[#8b008b] hover:text-[#e94057] transition-colors"
          >
            View All
          </button>
        </div>
        {projects && projects.length > 0 ? (
          <div class="space-y-3">
            {projects.slice(0, 4).map(project => (
              <div 
                key={project.id} 
                class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-all duration-200 cursor-pointer group" 
                onClick={() => onPageChange?.('projects')}
              >
                <div class="flex items-center space-x-4">
                  <div class="w-10 h-10 bg-gradient-to-br from-[#8b008b] to-[#9c40ff] rounded-xl flex items-center justify-center text-white group-hover:scale-105 transition-transform">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div>
                    <div class="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-[#8b008b] dark:group-hover:text-[#9c40ff] transition-colors">
                      {project.name}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                      Created {new Date(project.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <svg class="w-4 h-4 text-gray-400 group-hover:text-[#8b008b] dark:group-hover:text-[#9c40ff] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            ))}
          </div>
        ) : (
          <div class="text-center py-12">
            <div class="flex justify-center mb-4">
              <Box size={48} className="text-gray-400 dark:text-gray-600" />
            </div>
            <p class="text-gray-600 dark:text-gray-400 text-sm mb-2">No projects yet</p>
            <p class="text-gray-500 dark:text-gray-500 text-xs">Create your first project to get started</p>
          </div>
        )}
      </div>

      {/* Recent Services */}
      <div class="lg:col-span-2 card gradient-card shadow-lg shadow-[#9c40ff]/20">
        <div class="flex items-center justify-between mb-6">
          <h3 class="text-lg font-semibold">
            <span class="bg-gradient-to-r from-[#9c40ff] to-[#8b008b] bg-clip-text text-transparent">
              Recent Services
            </span>
          </h3>
          <div class="w-8 h-8 bg-[#9c40ff]/20 rounded-lg flex items-center justify-center">
            <svg class="w-4 h-4 text-[#9c40ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          </div>
        </div>
        {recentServices.length > 0 ? (
          <div class="grid md:grid-cols-2 gap-3">
            {recentServices.map((service, idx) => (
              <div 
                key={service.id || idx} 
                class="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors cursor-pointer group" 
                onClick={() => onPageChange?.('services')}
              >
                <div class="flex items-center space-x-3">
                  <div class="group-hover:scale-110 transition-transform">
                    {getServiceIcon(service.image)}
                  </div>
                  <div>
                    <div class="text-sm font-medium text-gray-900 dark:text-white truncate max-w-32">
                      {service.name || service.image?.split('/').pop()?.split(':')[0] || 'Service'}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                      {service.status ? (
                        <span class={`inline-flex items-center space-x-1 ${getStatusColor(service.status)}`}>
                          <div class={`w-1.5 h-1.5 rounded-full ${service.status === 'running' ? 'bg-emerald-500' : service.status === 'stopped' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
                          <span>{service.status}</span>
                        </span>
                      ) : 'Unknown'}
                    </div>
                  </div>
                </div>
                <div class="text-xs text-gray-400 text-right">
                  {service.created_at && new Date(service.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div class="text-center py-12">
            <div class="text-6xl mb-4">🚀</div>
            <p class="text-gray-600 dark:text-gray-400 text-sm mb-2">No services deployed</p>
            <p class="text-gray-500 dark:text-gray-500 text-xs">Deploy your first service to see activity</p>
          </div>
        )}
      </div>
    </div>
  )
}