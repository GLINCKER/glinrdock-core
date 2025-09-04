import { useState, useEffect } from 'preact/hooks'
import { initializeTheme, toggleTheme as toggleThemeUtil, setupSystemThemeListener, type Theme } from '../../theme'

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')

  // Initialize theme on mount
  useEffect(() => {
    const initialTheme = initializeTheme()
    setTheme(initialTheme)
    setupSystemThemeListener()
  }, [])

  const handleToggleTheme = () => {
    const newTheme = toggleThemeUtil(theme)
    setTheme(newTheme)
  }

  const getThemeIcon = () => {
    if (theme === 'system') {
      return (
        <svg class="w-3 h-3 text-[#ffaa40] group-hover:text-[#ffaa40]/80 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )
    } else if (theme === 'dark') {
      return (
        <svg class="w-3 h-3 text-[#ffaa40] group-hover:text-[#ffaa40]/80 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )
    } else {
      return (
        <svg class="w-3 h-3 text-[#ffaa40] group-hover:text-[#ffaa40]/80 transition-colors duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )
    }
  }

  const getThemeLabel = () => {
    if (theme === 'system') return 'Auto'
    return theme === 'dark' ? 'Dark' : 'Light'
  }

  return (
    <button
      onClick={handleToggleTheme}
      class="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-gradient-to-r from-orange-50/80 to-amber-50/80 dark:from-gray-800/80 dark:to-gray-700/80 border border-orange-200/50 dark:border-gray-600/50 shadow-sm hover:shadow-md hover:from-orange-100/80 hover:to-amber-100/80 dark:hover:from-gray-700/80 dark:hover:to-gray-600/80 transition-all duration-200 group flex-shrink-0"
      title={`Theme: ${getThemeLabel()} (click to cycle)`}
    >
      <div class="relative w-3 h-3">
        {getThemeIcon()}
      </div>
      <span class="text-gray-600 dark:text-gray-300 text-xs font-medium hidden lg:inline group-hover:text-gray-800 dark:group-hover:text-gray-200 transition-colors duration-200">
        {getThemeLabel()}
      </span>
    </button>
  )
}