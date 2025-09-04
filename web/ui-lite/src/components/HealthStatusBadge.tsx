import { Badge } from './ui'
import { formatTimeAgo } from '../utils/timeFormat'

interface HealthStatusBadgeProps {
  status: 'ok' | 'fail' | 'unknown'
  lastProbeAt?: string
  className?: string
}

export function HealthStatusBadge({ status, lastProbeAt, className = '' }: HealthStatusBadgeProps) {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'ok':
        return { variant: 'success' as const, label: 'Healthy', icon: '✓' }
      case 'fail':
        return { variant: 'danger' as const, label: 'Unhealthy', icon: '✗' }
      case 'unknown':
      default:
        return { variant: 'secondary' as const, label: 'Unknown', icon: '?' }
    }
  }

  const config = getStatusConfig(status)
  
  const formatProbeTime = (timestamp?: string) => {
    if (!timestamp) return null
    return formatTimeAgo(timestamp)
  }

  const probeTime = formatProbeTime(lastProbeAt)

  return (
    <div class={`flex items-center gap-1 ${className}`}>
      <Badge variant={config.variant} size="sm">
        <span class="mr-1">{config.icon}</span>
        {config.label}
      </Badge>
      {probeTime && (
        <span class="text-xs text-gray-500 ml-1">{probeTime}</span>
      )}
    </div>
  )
}