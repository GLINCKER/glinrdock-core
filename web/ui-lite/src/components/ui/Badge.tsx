interface BadgeProps {
  variant?: 'success' | 'danger' | 'warning' | 'info' | 'secondary'
  size?: 'sm' | 'md' | 'lg'
  children: React.ComponentChildren
  className?: string
}

export function Badge({ 
  variant = 'secondary', 
  size = 'md', 
  children, 
  className = '' 
}: BadgeProps) {
  const variantClasses = {
    success: 'bg-green-500/20 text-green-400',
    danger: 'bg-red-500/20 text-red-400',
    warning: 'bg-yellow-500/20 text-yellow-400',
    info: 'bg-blue-500/20 text-blue-400',
    secondary: 'bg-gray-500/20 text-gray-400'
  }

  const sizeClasses = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base'
  }

  return (
    <span 
      class={`inline-flex items-center rounded font-medium ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </span>
  )
}