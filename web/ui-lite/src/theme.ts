// Theme management for GLINR Dock UI-Lite with persistence
export type Theme = 'light' | 'dark' | 'system'

const THEME_STORAGE_KEY = 'glinrdock_theme'

export function getSystemTheme(): 'light' | 'dark' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function initializeTheme(): Theme {
  // Check localStorage first
  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme
  
  if (storedTheme && ['light', 'dark', 'system'].includes(storedTheme)) {
    applyTheme(storedTheme)
    return storedTheme
  }
  
  // Default to system preference
  applyTheme('system')
  return 'system'
}

export function applyTheme(theme: Theme) {
  // Save to localStorage
  localStorage.setItem(THEME_STORAGE_KEY, theme)
  
  let actualTheme: 'light' | 'dark'
  
  if (theme === 'system') {
    actualTheme = getSystemTheme()
  } else {
    actualTheme = theme
  }
  
  // Apply the theme to the document
  document.documentElement.classList.remove('light', 'dark')
  document.documentElement.classList.add(actualTheme)
}

export function toggleTheme(currentTheme: Theme): Theme {
  let newTheme: Theme
  
  // Cycle through: system -> light -> dark -> system
  if (currentTheme === 'system') {
    newTheme = 'light'
  } else if (currentTheme === 'light') {
    newTheme = 'dark'
  } else {
    newTheme = 'system'
  }
  
  applyTheme(newTheme)
  return newTheme
}

// Listen for system theme changes when in system mode
export function setupSystemThemeListener() {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  mediaQuery.addEventListener('change', () => {
    const currentTheme = localStorage.getItem(THEME_STORAGE_KEY) as Theme
    if (currentTheme === 'system' || !currentTheme) {
      applyTheme('system')
    }
  })
}