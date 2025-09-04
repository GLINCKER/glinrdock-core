import { ComponentChildren } from 'preact'

interface BadgeProps {
  children: ComponentChildren
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'secondary'
  size?: 'sm' | 'xs'
  className?: string
}

export function Badge({ children, variant = 'default', size = 'xs', className = '' }: BadgeProps) {
  const sizeClasses = {
    xs: 'px-2 py-1 text-xs',
    sm: 'px-2.5 py-1.5 text-sm'
  }

  const variantClasses = {
    default: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
    success: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
    warning: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
    error: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
    info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
    secondary: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
  }

  return (
    <span class={`inline-flex items-center rounded-full font-medium border-0 ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  )
}

interface StatusBadgeProps {
  status: 'running' | 'stopped' | 'error' | 'starting' | 'stopping' | 'created' | 'paused' | 'unknown'
  size?: 'sm' | 'xs'
  showDot?: boolean
}

export function StatusBadge({ status, size = 'xs', showDot = true }: StatusBadgeProps) {
  const statusConfig = {
    running: { variant: 'success' as const, color: 'bg-green-500', label: 'Running' },
    stopped: { variant: 'default' as const, color: 'bg-gray-500', label: 'Stopped' },
    error: { variant: 'error' as const, color: 'bg-red-500', label: 'Error' },
    starting: { variant: 'info' as const, color: 'bg-blue-500', label: 'Starting' },
    stopping: { variant: 'warning' as const, color: 'bg-orange-500', label: 'Stopping' },
    created: { variant: 'info' as const, color: 'bg-blue-500', label: 'Created' },
    paused: { variant: 'warning' as const, color: 'bg-yellow-500', label: 'Paused' },
    unknown: { variant: 'default' as const, color: 'bg-gray-400', label: 'Unknown' }
  }

  const config = statusConfig[status] || statusConfig.error

  return (
    <Badge variant={config.variant} size={size}>
      {showDot && (
        <div class={`w-1.5 h-1.5 rounded-full mr-1.5 ${config.color}`}></div>
      )}
      {config.label}
    </Badge>
  )
}

interface PortBadgeProps {
  port: { host: number; container: number }
  size?: 'sm' | 'xs'
}

export function PortBadge({ port, size = 'xs' }: PortBadgeProps) {
  return (
    <Badge variant="info" size={size}>
      <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 717.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
      </svg>
      {port.host}:{port.container}
    </Badge>
  )
}

interface TagBadgeProps {
  tag: string
  size?: 'sm' | 'xs'
}

export function TagBadge({ tag, size = 'xs' }: TagBadgeProps) {
  return (
    <Badge variant="secondary" size={size}>
      <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
      </svg>
      {tag}
    </Badge>
  )
}