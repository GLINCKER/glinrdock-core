import { ComponentChildren } from 'preact'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'warning' | 'ghost' | 'reload'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps {
  children: ComponentChildren
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  title?: string
  type?: 'button' | 'submit' | 'reset'
  class?: string
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  title,
  type = 'button',
  class: className = ''
}: ButtonProps) {
  const baseClasses = 'group flex items-center gap-2 rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-[1.02] font-medium tracking-wide backdrop-blur-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none'
  
  const variantClasses = {
    primary: 'bg-gradient-to-bl from-pink-500/10 via-purple-500/10 to-blue-600/20 hover:from-pink-500/20 hover:via-purple-500/20 hover:to-blue-600/30 border border-pink-200/50 hover:border-pink-300/70 dark:border-pink-400/30 dark:hover:border-pink-300/50 hover:shadow-pink-500/20 text-gray-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-300',
    secondary: 'text-gray-700 dark:text-gray-300 bg-white/50 dark:bg-gray-800/50 hover:bg-white dark:hover:bg-gray-700/50 hover:text-gray-900 dark:hover:text-gray-300 border border-gray-200/50 dark:border-gray-700/50 hover:border-gray-300/70 dark:hover:border-gray-600/50',
    danger: 'bg-gradient-to-bl from-red-500/10 via-pink-500/10 to-red-600/20 hover:from-red-500/20 hover:via-pink-500/20 hover:to-red-600/30 border border-red-200/50 hover:border-red-300/70 dark:border-red-400/30 dark:hover:border-red-300/50 hover:shadow-red-500/20 text-gray-900 dark:text-white group-hover:text-red-600 dark:group-hover:text-red-300',
    warning: 'bg-gradient-to-bl from-yellow-500/10 via-orange-500/10 to-yellow-600/20 hover:from-yellow-500/20 hover:via-orange-500/20 hover:to-yellow-600/30 border border-yellow-200/50 hover:border-yellow-300/70 dark:border-yellow-400/30 dark:hover:border-yellow-300/50 hover:shadow-yellow-500/20 text-gray-900 dark:text-white group-hover:text-yellow-600 dark:group-hover:text-yellow-300',
    reload: '!bg-gradient-to-br !from-purple-500/10 !via-blue-500/10 !to-purple-600/20 hover:!from-purple-500/20 hover:!via-blue-500/20 hover:!to-purple-600/30 !border !border-purple-200/50 hover:!border-purple-300/70 dark:!border-purple-400/30 dark:hover:!border-purple-300/50 hover:!shadow-purple-500/20 !text-gray-900 dark:!text-white group-hover:!text-purple-600 dark:group-hover:!text-purple-300',
    ghost: 'bg-gradient-to-br from-gray-500/10 via-slate-500/10 to-gray-600/20 hover:from-gray-500/20 hover:via-slate-500/20 hover:to-gray-600/30 border border-gray-200/50 hover:border-gray-300/70 dark:border-gray-400/30 dark:hover:border-gray-300/50 hover:shadow-gray-500/20 text-gray-900 dark:text-white group-hover:text-gray-600 dark:group-hover:text-gray-300'
  }
  
  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-2.5 text-sm'
  }
  
  const classes = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`
  
  return (
    <button
      type={type}
      class={classes}
      onClick={onClick}
      disabled={disabled || loading}
      title={title}
    >
      {children}
    </button>
  )
}

// Specialized button variants for common use cases
export function PrimaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button {...props} variant="primary" />
}

export function SecondaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button {...props} variant="secondary" />
}

export function DangerButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button {...props} variant="danger" />
}

export function GhostButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button {...props} variant="ghost" />
}

export function ReloadButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button {...props} variant="reload" />
}

export function WarningButton(props: Omit<ButtonProps, 'variant'>) {
  return <Button {...props} variant="warning" />
}