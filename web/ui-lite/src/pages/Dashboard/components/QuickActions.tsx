interface QuickActionsProps {
  onPageChange?: (page: string) => void
}

export function QuickActions({ onPageChange }: QuickActionsProps) {
  return (
    <div class="card gradient-card shadow-lg shadow-[#10b981]/20">
      <div class="flex items-center justify-between mb-6">
        <h3 class="text-lg font-semibold">
          <span class="bg-gradient-to-r from-[#10b981] to-[#059669] bg-clip-text text-transparent">
            Quick Deploy
          </span>
        </h3>
        <div class="w-8 h-8 bg-[#10b981]/20 rounded-lg flex items-center justify-center">
          <svg class="w-4 h-4 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
      </div>
      <div class="space-y-4">
        {/* Create Project Action */}
        <button 
          class="w-full flex items-center justify-between p-4 bg-gradient-to-r from-[#9c40ff]/10 to-[#8b008b]/10 border border-[#9c40ff]/20 rounded-xl hover:from-[#9c40ff]/20 hover:to-[#8b008b]/20 hover:border-[#9c40ff]/30 transition-all duration-300 text-left group"
          onClick={() => onPageChange?.('projects')}
        >
          <div class="flex items-center space-x-4">
            <div class="w-10 h-10 bg-[#9c40ff]/20 rounded-lg flex items-center justify-center group-hover:bg-[#9c40ff]/30 transition-colors">
              <svg class="w-5 h-5 text-[#9c40ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <div class="text-sm font-semibold text-gray-900 dark:text-white">New Project</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">Create and configure a new project</div>
            </div>
          </div>
          <svg class="w-4 h-4 text-[#9c40ff] group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        
        {/* Deploy Service Action */}
        <button 
          class="w-full flex items-center justify-between p-4 bg-gradient-to-r from-[#10b981]/10 to-[#059669]/10 border border-[#10b981]/20 rounded-xl hover:from-[#10b981]/20 hover:to-[#059669]/20 hover:border-[#10b981]/30 transition-all duration-300 text-left group"
          onClick={() => onPageChange?.('services')}
        >
          <div class="flex items-center space-x-4">
            <div class="w-10 h-10 bg-[#10b981]/20 rounded-lg flex items-center justify-center group-hover:bg-[#10b981]/30 transition-colors">
              <svg class="w-5 h-5 text-[#10b981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </div>
            <div>
              <div class="text-sm font-semibold text-gray-900 dark:text-white">Deploy Service</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">Launch a containerized application</div>
            </div>
          </div>
          <svg class="w-4 h-4 text-[#10b981] group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
        
        {/* Create Route Action */}
        <button 
          class="w-full flex items-center justify-between p-4 bg-gradient-to-r from-[#f59e0b]/10 to-[#d97706]/10 border border-[#f59e0b]/20 rounded-xl hover:from-[#f59e0b]/20 hover:to-[#d97706]/20 hover:border-[#f59e0b]/30 transition-all duration-300 text-left group"
          onClick={() => onPageChange?.('routes')}
        >
          <div class="flex items-center space-x-4">
            <div class="w-10 h-10 bg-[#f59e0b]/20 rounded-lg flex items-center justify-center group-hover:bg-[#f59e0b]/30 transition-colors">
              <svg class="w-5 h-5 text-[#f59e0b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            </div>
            <div>
              <div class="text-sm font-semibold text-gray-900 dark:text-white">Create Route</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">Expose services to external traffic</div>
            </div>
          </div>
          <svg class="w-4 h-4 text-[#f59e0b] group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* View Templates Action */}
        <button 
          class="w-full flex items-center justify-between p-4 bg-gradient-to-r from-[#8b008b]/10 to-[#e94057]/10 border border-[#8b008b]/20 rounded-xl hover:from-[#8b008b]/20 hover:to-[#e94057]/20 hover:border-[#8b008b]/30 transition-all duration-300 text-left group"
          onClick={() => onPageChange?.('templates')}
        >
          <div class="flex items-center space-x-4">
            <div class="w-10 h-10 bg-[#8b008b]/20 rounded-lg flex items-center justify-center group-hover:bg-[#8b008b]/30 transition-colors">
              <svg class="w-5 h-5 text-[#8b008b]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <div>
              <div class="text-sm font-semibold text-gray-900 dark:text-white">Browse Templates</div>
              <div class="text-xs text-gray-500 dark:text-gray-400">Deploy pre-configured service templates</div>
            </div>
          </div>
          <svg class="w-4 h-4 text-[#8b008b] group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  )
}