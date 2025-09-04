import { getRoleBadgeClass } from '../rbac'

interface RoleBadgeProps {
  role: string
  className?: string
}

export function RoleBadge({ role, className = '' }: RoleBadgeProps) {
  if (!role) return null
  
  const badgeClass = getRoleBadgeClass(role)
  
  return (
    <span class={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${badgeClass} ${className}`}>
      {role}
    </span>
  )
}