import { useState, useEffect } from 'preact/hooks'
import { apiClient } from '../api'

interface LockdownStatus {
  isLocked: boolean
  timestamp?: string
  reason?: string
}

export function LockdownBanner() {
  const [lockdownStatus, setLockdownStatus] = useState<LockdownStatus>({ isLocked: false })
  const [showDetails, setShowDetails] = useState(false)

  // Check lockdown status on mount and periodically
  useEffect(() => {
    const checkLockdownStatus = async () => {
      try {
        // Call backend API to check real lockdown status
        const status = await apiClient.getLockdownStatus()
        setLockdownStatus({
          isLocked: status.is_locked,
          reason: status.reason,
          timestamp: status.timestamp
        })
      } catch (error) {
        console.error('Failed to check lockdown status:', error)
        // If backend is unreachable, assume not locked
        setLockdownStatus({ isLocked: false })
      }
    }

    checkLockdownStatus()
    
    // Check every 30 seconds
    const interval = setInterval(checkLockdownStatus, 30000)
    
    return () => clearInterval(interval)
  }, [])

  // Listen for lockdown events from other components (for immediate UI updates)
  useEffect(() => {
    const handleLockdownEvent = (event: CustomEvent) => {
      setLockdownStatus(event.detail)
      // No longer store in localStorage - backend is source of truth
    }

    window.addEventListener('lockdown-status-changed', handleLockdownEvent as EventListener)
    
    return () => {
      window.removeEventListener('lockdown-status-changed', handleLockdownEvent as EventListener)
    }
  }, [])

  const handleLiftLockdown = async () => {
    try {
      // Call backend API to lift lockdown
      await apiClient.liftLockdown()
      setLockdownStatus({ isLocked: false })
      
      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('lockdown-status-changed', {
        detail: { isLocked: false }
      }))
    } catch (error) {
      console.error('Failed to lift lockdown:', error)
    }
  }

  if (!lockdownStatus.isLocked) {
    return null
  }

  return (
    <>
      {/* Global lockdown banner - positioned above everything */}
      <div class="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-red-600 via-red-500 to-red-600 text-white shadow-2xl border-b-4 border-red-400 backdrop-blur-sm transform-gpu">
        {/* Animated danger stripe */}
        <div class="h-1 bg-gradient-to-r from-yellow-400 via-red-500 to-yellow-400 animate-pulse" />
        
        <div class="px-6 py-4">
          <div class="flex items-center justify-between max-w-7xl mx-auto">
            <div class="flex items-center space-x-4">
              {/* Emergency Icon */}
              <div class="relative">
                <div class="w-12 h-12 bg-red-800/50 rounded-full flex items-center justify-center border-2 border-red-400/50">
                  <svg class="w-6 h-6 text-red-100 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                {/* Pulsing ring */}
                <div class="absolute inset-0 rounded-full border-2 border-red-300 animate-ping opacity-75" />
              </div>
              
              <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-3">
                  <h2 class="text-lg font-bold text-white tracking-wider flex items-center space-x-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>SYSTEM LOCKDOWN ACTIVE</span>
                  </h2>
                  <span class="px-3 py-1 bg-red-800 text-red-100 text-xs font-mono rounded-full border border-red-400/50">
                    SECURITY MODE
                  </span>
                </div>
                <p class="text-sm text-red-100 mt-1">
                  Only administrator access permitted • All non-admin operations suspended
                  {lockdownStatus.timestamp && (
                    <span class="ml-3 font-mono text-xs bg-red-800/50 px-2 py-0.5 rounded border border-red-400/30">
                      Since {new Date(lockdownStatus.timestamp).toLocaleString()}
                    </span>
                  )}
                </p>
              </div>
            </div>
            
            <div class="flex items-center space-x-3">
              {/* Details Toggle */}
              {lockdownStatus.reason && (
                <button
                  onClick={() => setShowDetails(!showDetails)}
                  class="px-4 py-2 bg-red-700/80 hover:bg-red-600 text-white text-sm font-medium rounded-lg border border-red-400/50 hover:border-red-300 transition-all duration-200 flex items-center space-x-2"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>{showDetails ? 'Hide Details' : 'View Details'}</span>
                </button>
              )}
              
              {/* Lift Lockdown Button */}
              <button
                onClick={handleLiftLockdown}
                class="px-6 py-2 bg-green-700 hover:bg-green-600 text-white text-sm font-bold rounded-lg shadow-lg border-2 border-green-500 hover:border-green-400 transition-all duration-200 flex items-center space-x-2 transform hover:scale-105"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
                <span>LIFT LOCKDOWN</span>
              </button>
              
              {/* Dismiss Button */}
              <button
                onClick={() => setLockdownStatus({ isLocked: false })}
                class="p-2 rounded-lg text-red-200 hover:text-white hover:bg-red-700/50 transition-all duration-200"
                title="Dismiss banner (lockdown remains active)"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          
          {/* Details section */}
          {showDetails && lockdownStatus.reason && (
            <div class="mt-4 pt-4 border-t border-red-400/30 max-w-7xl mx-auto">
              <div class="bg-red-800/30 backdrop-blur-sm rounded-lg p-4 border border-red-400/30">
                <div class="flex items-start space-x-3">
                  <svg class="w-5 h-5 text-red-200 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <div>
                    <h3 class="text-sm font-bold text-red-100 mb-2">Lockdown Reason</h3>
                    <p class="text-sm text-red-200 bg-red-900/50 px-3 py-2 rounded border border-red-400/20 font-mono">
                      {lockdownStatus.reason}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global red border overlay with pulsing animation */}
      <div class="fixed inset-0 pointer-events-none z-[9998] border-8 border-red-500/40 animate-pulse shadow-2xl" />
      <div class="fixed inset-4 pointer-events-none z-[9997] border-4 border-red-400/60 animate-pulse" />
    </>
  )
}