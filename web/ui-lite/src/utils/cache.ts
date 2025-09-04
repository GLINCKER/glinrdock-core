// Centralized caching utility with localStorage persistence and rate limiting protection

export interface CacheEntry<T> {
  data: T
  timestamp: number
  expires: number
}

export interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  persistent?: boolean // Store in localStorage
  keyPrefix?: string
}

class CacheManager {
  private memoryCache = new Map<string, CacheEntry<any>>()
  
  // Default cache configurations for different types of data
  private readonly configs = {
    docker: { ttl: 10 * 60 * 1000, persistent: true, keyPrefix: 'docker_' }, // 10 minutes
    simpleicons: { ttl: 24 * 60 * 60 * 1000, persistent: true, keyPrefix: 'icons_' }, // 24 hours
    templates: { ttl: 5 * 60 * 1000, persistent: false, keyPrefix: 'tpl_' }, // 5 minutes
    default: { ttl: 5 * 60 * 1000, persistent: false, keyPrefix: 'cache_' }
  }

  constructor() {
    // Clean up expired entries on startup
    this.cleanup()
    
    // Periodic cleanup every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000)
  }

  get<T>(key: string, type: keyof typeof this.configs = 'default'): T | null {
    const config = this.configs[type]
    const fullKey = `${config.keyPrefix}${key}`
    
    // Try memory cache first
    let entry = this.memoryCache.get(fullKey)
    
    // If not in memory and persistent, try localStorage
    if (!entry && config.persistent) {
      try {
        const stored = localStorage.getItem(fullKey)
        if (stored) {
          entry = JSON.parse(stored)
          // Also store in memory for faster access
          if (entry) this.memoryCache.set(fullKey, entry)
        }
      } catch (error) {
        console.warn('Cache: Failed to read from localStorage', error)
      }
    }
    
    // Check if entry exists and is not expired
    if (entry && Date.now() < entry.expires) {
      return entry.data
    }
    
    // Entry is expired or doesn't exist, remove it
    if (entry) {
      this.delete(key, type)
    }
    
    return null
  }

  set<T>(key: string, data: T, type: keyof typeof this.configs = 'default'): void {
    const config = this.configs[type]
    const fullKey = `${config.keyPrefix}${key}`
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expires: Date.now() + config.ttl
    }
    
    // Store in memory
    this.memoryCache.set(fullKey, entry)
    
    // Store in localStorage if persistent
    if (config.persistent) {
      try {
        localStorage.setItem(fullKey, JSON.stringify(entry))
      } catch (error) {
        console.warn('Cache: Failed to write to localStorage', error)
      }
    }
  }

  delete(key: string, type: keyof typeof this.configs = 'default'): void {
    const config = this.configs[type]
    const fullKey = `${config.keyPrefix}${key}`
    
    this.memoryCache.delete(fullKey)
    
    if (config.persistent) {
      try {
        localStorage.removeItem(fullKey)
      } catch (error) {
        console.warn('Cache: Failed to remove from localStorage', error)
      }
    }
  }

  clear(type?: keyof typeof this.configs): void {
    if (type) {
      const config = this.configs[type]
      const prefix = config.keyPrefix
      
      // Clear memory cache
      for (const key of this.memoryCache.keys()) {
        if (key.startsWith(prefix)) {
          this.memoryCache.delete(key)
        }
      }
      
      // Clear localStorage
      if (config.persistent) {
        try {
          const keysToRemove = []
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i)
            if (key && key.startsWith(prefix)) {
              keysToRemove.push(key)
            }
          }
          keysToRemove.forEach(key => localStorage.removeItem(key))
        } catch (error) {
          console.warn('Cache: Failed to clear localStorage', error)
        }
      }
    } else {
      // Clear all
      this.memoryCache.clear()
      try {
        Object.values(this.configs).forEach(config => {
          if (config.persistent) {
            const keysToRemove = []
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i)
              if (key && key.startsWith(config.keyPrefix)) {
                keysToRemove.push(key)
              }
            }
            keysToRemove.forEach(key => localStorage.removeItem(key))
          }
        })
      } catch (error) {
        console.warn('Cache: Failed to clear localStorage', error)
      }
    }
  }

  private cleanup(): void {
    const now = Date.now()
    
    // Cleanup memory cache
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now >= entry.expires) {
        this.memoryCache.delete(key)
      }
    }
    
    // Cleanup localStorage
    try {
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && Object.values(this.configs).some(config => key.startsWith(config.keyPrefix))) {
          const stored = localStorage.getItem(key)
          if (stored) {
            const entry = JSON.parse(stored)
            if (now >= entry.expires) {
              keysToRemove.push(key)
            }
          }
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key))
    } catch (error) {
      console.warn('Cache: Failed to cleanup localStorage', error)
    }
  }

  // Get cache stats for debugging
  getStats(): {
    memorySize: number
    localStorageSize: number
    dockerEntries: number
    iconEntries: number
  } {
    const stats = {
      memorySize: this.memoryCache.size,
      localStorageSize: 0,
      dockerEntries: 0,
      iconEntries: 0
    }

    // Count localStorage entries
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) {
          if (key.startsWith(this.configs.docker.keyPrefix)) stats.dockerEntries++
          if (key.startsWith(this.configs.simpleicons.keyPrefix)) stats.iconEntries++
          if (Object.values(this.configs).some(config => key.startsWith(config.keyPrefix))) {
            stats.localStorageSize++
          }
        }
      }
    } catch (error) {
      console.warn('Cache: Failed to get stats', error)
    }

    return stats
  }
}

// Export singleton instance
export const cache = new CacheManager()

// Rate limiting utility for external API calls
export class RateLimiter {
  private requests = new Map<string, number[]>()
  
  constructor(
    private maxRequests: number = 60, // requests per window
    private windowMs: number = 60 * 1000 // 1 minute window
  ) {}
  
  canMakeRequest(key: string): boolean {
    const now = Date.now()
    const requests = this.requests.get(key) || []
    
    // Remove old requests outside the window
    const validRequests = requests.filter(time => now - time < this.windowMs)
    
    if (validRequests.length >= this.maxRequests) {
      return false
    }
    
    validRequests.push(now)
    this.requests.set(key, validRequests)
    return true
  }
  
  getRemainingRequests(key: string): number {
    const now = Date.now()
    const requests = this.requests.get(key) || []
    const validRequests = requests.filter(time => now - time < this.windowMs)
    return Math.max(0, this.maxRequests - validRequests.length)
  }
}

// Rate limiters for different services
export const dockerRateLimiter = new RateLimiter(100, 60 * 1000) // 100 requests per minute
export const simpleIconsRateLimiter = new RateLimiter(200, 60 * 1000) // 200 requests per minute