import { formatTimeAgo } from '../../utils/timeFormat'

interface HealthBadgeProps {
  status?: 'OK' | 'FAIL'
  lastChecked?: string
  size?: 'sm' | 'xs'
}

export function HealthBadge({ status, lastChecked, size = 'xs' }: HealthBadgeProps) {
  const sizeClasses = {
    xs: 'px-1.5 py-0.5 text-xs',
    sm: 'px-2 py-1 text-sm'
  }

  if (!status) {
    return (
      <span class={`inline-flex items-center rounded font-medium bg-gray-600 text-gray-300 ${sizeClasses[size]}`}>
        —
      </span>
    )
  }

  const statusConfig = {
    OK: {
      bgColor: 'bg-green-500/20',
      textColor: 'text-green-400',
      icon: '✓'
    },
    FAIL: {
      bgColor: 'bg-red-500/20', 
      textColor: 'text-red-400',
      icon: '✕'
    }
  }

  const config = statusConfig[status]
  const timeAgo = lastChecked ? formatTimeAgo(lastChecked) : ''

  return (
    <span 
      class={`inline-flex items-center rounded font-medium ${config.bgColor} ${config.textColor} ${sizeClasses[size]}`}
      title={lastChecked ? `Last checked ${timeAgo}` : `Status: ${status}`}
    >
      <span class="mr-1">{config.icon}</span>
      {status}
    </span>
  )
}