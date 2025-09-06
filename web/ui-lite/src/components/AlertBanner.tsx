import { useState, useEffect } from 'preact/hooks'
import { apiClient, NetworkError, TimeoutError } from '../api'

interface AlertBannerProps {
  type: 'offline' | 'api-unhealthy' | 'auth-expired' | 'custom'
  message?: string
  action?: {
    label: string
    onClick: () => void
  }
  isVisible: boolean
  onClose?: () => void
  dismissible?: boolean
}

export function AlertBanner({
  type,
  message,
  action,
  isVisible,
  onClose,
  dismissible = true
}: AlertBannerProps) {
  if (!isVisible) return null

  const config = {
    offline: {
      icon: (
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
        </svg>
      ),
      bgColor: 'bg-orange-500/10',
      borderColor: 'border-orange-500/20',
      textColor: 'text-orange-300',
      iconColor: 'text-orange-400',
      defaultMessage: 'You are currently offline. Some features may not work.'
    },
    'api-unhealthy': {
      icon: (
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      ),
      bgColor: 'bg-red-500/10',
      borderColor: 'border-red-500/20', 
      textColor: 'text-red-300',
      iconColor: 'text-red-400',
      defaultMessage: 'Server connection issues detected. Retrying automatically...'
    },
    'auth-expired': {
      icon: (
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/20',
      textColor: 'text-yellow-300',
      iconColor: 'text-yellow-400',
      defaultMessage: 'Your session has expired. Please log in again.'
    },
    custom: {
      icon: (
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
      textColor: 'text-blue-300', 
      iconColor: 'text-blue-400',
      defaultMessage: 'System notification'
    }
  }

  const { icon, bgColor, borderColor, textColor, iconColor, defaultMessage } = config[type]

  return (
    <div class={`${bgColor} border-b ${borderColor} px-4 py-2`}>
      <div class="flex items-center justify-between max-w-7xl mx-auto">
        <div class="flex items-center space-x-3">
          <div class={`${iconColor}`}>{icon}</div>
          <span class={`text-sm font-medium ${textColor}`}>
            {message || defaultMessage}
          </span>
        </div>
        
        <div class="flex items-center space-x-2">
          {action && (
            <button
              onClick={action.onClick}
              class={`text-xs px-2 py-1 rounded border ${borderColor} ${textColor} hover:bg-white/5 transition-colors`}
            >
              {action.label}
            </button>
          )}
          
          {dismissible && onClose && (
            <button
              onClick={onClose}
              class={`${textColor} hover:text-white transition-colors`}
              aria-label="Dismiss"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Offline Banner Hook
export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(true) // Default to online
  const [lastCheck, setLastCheck] = useState<Date | null>(null)

  const checkConnectivity = async () => {
    try {
      // Try to ping the backend health endpoint to verify connectivity
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000)
      
      const response = await fetch('/v1/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      const actuallyOnline = response.ok
      
      
      setIsOnline(actuallyOnline)
      setLastCheck(new Date())
      
      return actuallyOnline
    } catch (error) {
      setIsOnline(false)
      setLastCheck(new Date())
      return false
    }
  }

  useEffect(() => {
    // Initial check
    checkConnectivity()

    const handleOnline = () => {
      checkConnectivity()
    }
    
    const handleOffline = () => {
 
      setIsOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Periodic connectivity check every 30 seconds
    const interval = setInterval(checkConnectivity, 30000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [])

  return isOnline
}

// API Health Banner Hook
export function useApiHealth() {
  const [isHealthy, setIsHealthy] = useState(true)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)

  const checkHealth = async () => {
    try {
      // Use direct fetch for health check to avoid auth headers
      // Set up manual timeout using AbortController
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch('/v1/health', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok) {
        setIsHealthy(true)
      } else {
        setIsHealthy(false)
      }
    } catch (error) {
      console.warn('API health check: ERROR -', error)
      setIsHealthy(false)
    } finally {
      setLastCheck(new Date())
    }
  }

  useEffect(() => {
    // Initial check
    checkHealth()

    // Periodic health checks every 30 seconds
    const interval = setInterval(checkHealth, 30000)

    return () => clearInterval(interval)
  }, [])

  return { isHealthy, lastCheck, checkHealth }
}

// Global Banner Manager Component
export function GlobalBanners() {
  const isOnline = useOfflineStatus()
  const { isHealthy, checkHealth } = useApiHealth()
  const [showBanner, setShowBanner] = useState(false)
  const [bannerType, setBannerType] = useState<'offline' | 'api-unhealthy'>('offline')

  // Unified banner logic to prevent duplicates
  useEffect(() => {
    if (!isOnline) {
      setBannerType('offline')
      setShowBanner(true)
    } else if (!isHealthy && isOnline) {
      setBannerType('api-unhealthy')
      setShowBanner(true)
    } else {
      // Hide banner when everything is working, with a short delay for online state
      const timer = setTimeout(() => setShowBanner(false), 1000)
      return () => clearTimeout(timer)
    }
  }, [isOnline, isHealthy])

  if (!showBanner) return null
  
  return (
    <div class="fixed top-[60px] lg:top-[49px] left-0 lg:left-64 right-0 z-[60]">
      <AlertBanner
        type={bannerType}
        isVisible={true}
        action={bannerType === 'api-unhealthy' ? {
          label: 'Retry',
          onClick: checkHealth
        } : undefined}
        onClose={() => setShowBanner(false)}
      />
    </div>
  )
}