import { Search, X } from 'lucide-preact'

interface HelpSearchBarProps {
  value: string
  onInput: (value: string) => void
  onClear?: () => void
  placeholder?: string
  resultsCount?: number
  className?: string
}

export function HelpSearchBar({ 
  value, 
  onInput, 
  onClear,
  placeholder = "Search documentation...", 
  resultsCount,
  className = '' 
}: HelpSearchBarProps) {
  const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement
    onInput(target.value)
  }

  const handleClear = () => {
    onInput('')
    if (onClear) onClear()
  }

  return (
    <div class={`help-search-container ${className}`}>
      <div class="relative">
        <Search class="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder={placeholder}
          value={value}
          onInput={handleInput}
          class="help-search-input"
        />
        {value.trim() && (
          <button
            onClick={handleClear}
            class="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            title="Clear search"
          >
            <X class="w-4 h-4" />
          </button>
        )}
      </div>
      {value.trim() && typeof resultsCount === 'number' && (
        <div class="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Found {resultsCount} document{resultsCount !== 1 ? 's' : ''} matching "{value}"
        </div>
      )}
    </div>
  )
}