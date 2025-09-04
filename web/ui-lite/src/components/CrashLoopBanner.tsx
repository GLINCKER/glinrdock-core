import { useState } from 'preact/hooks'
import { apiClient } from '../api'

interface CrashLoopBannerProps {
  serviceId: string
  serviceName: string
  restartCount: number
  lastExitCode?: number
  canUnlock: boolean
  onUnlock?: () => void
}

export function CrashLoopBanner({ 
  serviceId, 
  serviceName, 
  restartCount, 
  lastExitCode,
  canUnlock,
  onUnlock 
}: CrashLoopBannerProps) {
  const [isUnlocking, setIsUnlocking] = useState(false)

  const handleUnlock = async () => {
    if (isUnlocking) return
    
    setIsUnlocking(true)
    try {
      await apiClient.unlockService(serviceId)
      if (onUnlock) {
        onUnlock()
      }
    } catch (error) {
      console.error('Failed to unlock service:', error)
    } finally {
      setIsUnlocking(false)
    }
  }

  return (
    <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
      <div class="flex items-start justify-between">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">
              Service in Crash Loop
            </h3>
            <div class="mt-2 text-sm text-red-700">
              <p>
                <strong>{serviceName}</strong> has been automatically stopped due to excessive failures.
              </p>
              <ul class="list-disc list-inside mt-2 space-y-1">
                <li>Restart attempts: <strong>{restartCount}</strong> in the last 10 minutes</li>
                {lastExitCode !== undefined && (
                  <li>Last exit code: <strong>{lastExitCode}</strong></li>
                )}
                <li>The service will remain stopped to prevent resource drain</li>
              </ul>
            </div>
          </div>
        </div>
        
        {canUnlock && (
          <div class="ml-3 flex-shrink-0">
            <button
              onClick={handleUnlock}
              disabled={isUnlocking}
              class="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
            >
              {isUnlocking ? (
                <>
                  <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-red-700" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Unlocking...
                </>
              ) : (
                'Unlock and Start'
              )}
            </button>
          </div>
        )}
      </div>
      
      <div class="mt-4 text-xs text-red-600">
        <p>
          <strong>Next steps:</strong> Check the service logs for errors, fix the issue, then unlock the service to restart.
        </p>
      </div>
    </div>
  )
}