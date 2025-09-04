import { ComponentChildren } from 'preact'

export type CardVariant = 'default' | 'glass' | 'gradient'

interface CardProps {
  children: ComponentChildren
  variant?: CardVariant
  class?: string
  onClick?: () => void
}

export function Card({
  children,
  variant = 'default',
  class: className = '',
  onClick
}: CardProps) {
  const baseClasses = 'rounded-lg transition-all duration-200'
  
  const variantClasses = {
    default: 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700',
    glass: 'bg-white/90 dark:bg-black backdrop-blur-2xl border border-white/20 dark:border-gray-800 ring-1 ring-white/10 dark:ring-gray-700/20',
    gradient: 'bg-gradient-to-br from-white/90 via-gray-50/80 to-white/70 dark:from-gray-800/90 dark:via-gray-900/80 dark:to-gray-800/70 border-gray-200/50 dark:border-gray-700/50'
  }
  
  const interactiveClasses = onClick ? 'cursor-pointer hover:scale-[1.02]' : ''
  
  const classes = `${baseClasses} ${variantClasses[variant]} ${interactiveClasses} ${className}`
  
  return (
    <div class={classes} onClick={onClick}>
      {children}
    </div>
  )
}

// Specialized card variants
export function GlassCard(props: Omit<CardProps, 'variant'>) {
  return <Card {...props} variant="glass" />
}

export function GradientCard(props: Omit<CardProps, 'variant'>) {
  return <Card {...props} variant="gradient" />
}