import { ReactNode } from 'preact/compat'

interface HelpHeaderProps {
  title: string
  subtitle?: string
  icon?: ReactNode
  actions?: ReactNode
}

export function HelpHeader({ title, subtitle, icon, actions }: HelpHeaderProps) {
  return (
    <div class="help-header">
      <div>
        <h1 class="help-title">{title}</h1>
        {subtitle && <p class="help-subtitle">{subtitle}</p>}
      </div>
      <div class="flex items-center gap-3">
        {actions}
        {icon && (
          <div class="help-icon-container">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}