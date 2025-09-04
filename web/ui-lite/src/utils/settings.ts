// Application settings with localStorage persistence

interface AppSettings {
  preferBrandIcons: boolean
  theme: 'light' | 'dark' | 'system'
}

const DEFAULT_SETTINGS: AppSettings = {
  preferBrandIcons: true, // Default to brand icons when internet available
  theme: 'system'
}

class SettingsManager {
  private settings: AppSettings

  constructor() {
    this.settings = this.loadSettings()
  }

  private loadSettings(): AppSettings {
    try {
      const stored = localStorage.getItem('glinr-settings')
      if (stored) {
        const parsed = JSON.parse(stored)
        return { ...DEFAULT_SETTINGS, ...parsed }
      }
    } catch (error) {
      console.warn('Failed to load settings from localStorage:', error)
    }
    return DEFAULT_SETTINGS
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('glinr-settings', JSON.stringify(this.settings))
    } catch (error) {
      console.warn('Failed to save settings to localStorage:', error)
    }
  }

  get preferBrandIcons(): boolean {
    return this.settings.preferBrandIcons
  }

  set preferBrandIcons(value: boolean) {
    this.settings.preferBrandIcons = value
    this.saveSettings()
  }

  get theme(): string {
    return this.settings.theme
  }

  set theme(value: 'light' | 'dark' | 'system') {
    this.settings.theme = value
    this.saveSettings()
  }

  getAll(): AppSettings {
    return { ...this.settings }
  }

  reset(): void {
    this.settings = { ...DEFAULT_SETTINGS }
    this.saveSettings()
  }
}

export const settings = new SettingsManager()
export type { AppSettings }