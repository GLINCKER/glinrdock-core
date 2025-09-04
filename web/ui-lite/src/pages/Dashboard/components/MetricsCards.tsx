interface MetricsCardsProps {
  projects?: any[]
  totalServices: number
  totalRoutes: number
  systemInfo?: any
  onPageChange?: (page: string) => void
}

export function MetricsCards({ 
  projects, 
  totalServices, 
  totalRoutes, 
  systemInfo, 
  onPageChange 
}: MetricsCardsProps) {
  const formatUptime = (uptime: string) => {
    if (!uptime) return 'Unknown'
    const match = uptime.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?/)
    if (!match) return uptime
    const [, hours, minutes, seconds] = match
    const parts = []
    if (hours && parseInt(hours) > 0) parts.push(`${hours}h`)
    if (minutes && parseInt(minutes) > 0) parts.push(`${minutes}m`)
    if (seconds && !hours && !minutes) parts.push(`${Math.floor(parseFloat(seconds))}s`)
    return parts.join(' ') || '0s'
  }

  return (
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Projects Card */}
      <div 
        class="card gradient-card card-interactive cursor-pointer shadow-lg shadow-[#9c40ff]/20 hover:shadow-xl hover:shadow-[#9c40ff]/30"
        onClick={() => onPageChange?.('projects')}
        title="View all projects"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Projects</p>
            <p class="text-2xl font-bold text-[#9c40ff]">{projects?.length || 0}</p>
          </div>
          <div class="w-12 h-12 bg-[#9c40ff]/20 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-[#9c40ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 1v6" />
            </svg>
          </div>
        </div>
      </div>

      {/* Services Card */}
      <div 
        class="card gradient-card card-interactive cursor-pointer shadow-lg shadow-[#10b981]/20 hover:shadow-xl hover:shadow-[#10b981]/30"
        onClick={() => onPageChange?.('services')}
        title="View all services"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Services</p>
            <p class="text-2xl font-bold text-[#10b981]">{totalServices}</p>
          </div>
          <div class="w-12 h-12 bg-[#10b981]/20 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Routes Card */}
      <div 
        class="card gradient-card card-interactive cursor-pointer shadow-lg shadow-[#8b008b]/20 hover:shadow-xl hover:shadow-[#8b008b]/30"
        onClick={() => onPageChange?.('routes')}
        title="View all routes"
      >
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Routes</p>
            <p class="text-2xl font-bold text-[#8b008b]">{totalRoutes}</p>
          </div>
          <div class="w-12 h-12 bg-[#8b008b]/20 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-[#8b008b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
        </div>
      </div>

      {/* Uptime Card */}
      <div class="card gradient-card shadow-lg shadow-[#f59e0b]/20">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Uptime</p>
            {systemInfo ? (
              <p class="text-2xl font-bold text-[#f59e0b]">
                {formatUptime(systemInfo.uptime)}
              </p>
            ) : (
              <div class="skeleton h-8 w-16" />
            )}
          </div>
          <div class="w-12 h-12 bg-[#f59e0b]/20 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-[#f59e0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}