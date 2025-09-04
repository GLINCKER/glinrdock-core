import { useState } from 'preact/hooks'
import { apiClient } from '../api'

interface HealthCheckButtonProps {
  serviceId: string
  onHealthUpdate?: (status: 'ok' | 'fail' | 'unknown', lastProbeAt: string) => void
  size?: 'sm' | 'md'
  className?: string
}

export function HealthCheckButton({ 
  serviceId, 
  onHealthUpdate, 
  size = 'sm',
  className = '' 
}: HealthCheckButtonProps) {
  const [isRunning, setIsRunning] = useState(false)

  const runHealthCheck = async () => {
    if (isRunning) return

    setIsRunning(true)
    try {
      const result = await apiClient.runHealthCheck(serviceId)
      if (onHealthUpdate) {
        onHealthUpdate(result.health_status, result.last_probe_at)
      }
    } catch (error) {
      console.error('Health check failed:', error)
    } finally {
      setIsRunning(false)
    }
  }

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm'
  }

  return (
    <button
      onClick={runHealthCheck}
      disabled={isRunning}
      class={`inline-flex items-center ${sizeClasses[size]} border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      title="Run health check now"
    >
      {isRunning ? (
        <>
          <svg class="animate-spin -ml-1 mr-1 h-3 w-3 text-gray-700" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Checking...
        </>
      ) : (
        <>
          <svg class="-ml-1 mr-1 h-3 w-3 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          Run health check
        </>
      )}
    </button>
  )
}