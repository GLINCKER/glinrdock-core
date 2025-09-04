interface ViewModeSelectorProps {
  viewMode: 'grid' | 'list' | 'cards'
  onViewModeChange: (mode: 'grid' | 'list' | 'cards') => void
  className?: string
}

export function ViewModeSelector({ viewMode, onViewModeChange, className = '' }: ViewModeSelectorProps) {
  return (
    <div class={`flex items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-1 ${className}`}>
      <button 
        class={`p-2 rounded-lg transition-all duration-200 ${viewMode === 'grid' 
          ? 'bg-[#10b981] text-white shadow-md' 
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
        onClick={() => onViewModeChange('grid')}
        title="Grid View - Compact cards, perfect for overview"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
      </button>
      <button 
        class={`p-2 rounded-lg transition-all duration-200 ${viewMode === 'list' 
          ? 'bg-[#10b981] text-white shadow-md' 
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
        onClick={() => onViewModeChange('list')}
        title="List View - Minimal rows, great for quick scanning"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
      </button>
      <button 
        class={`p-2 rounded-lg transition-all duration-200 ${viewMode === 'cards' 
          ? 'bg-[#10b981] text-white shadow-md' 
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
        }`}
        onClick={() => onViewModeChange('cards')}
        title="Card View - Detailed info, best for management"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </button>
    </div>
  )
}