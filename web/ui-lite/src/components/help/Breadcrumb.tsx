import { ChevronRight, Home } from 'lucide-preact'

interface BreadcrumbItem {
  label: string
  href?: string
  onClick?: () => void
  current?: boolean
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  return (
    <nav class={`flex items-center space-x-1 text-sm ${className}`}>
      {items.map((item, index) => (
        <div key={index} class="flex items-center">
          {index > 0 && (
            <ChevronRight class="w-4 h-4 text-gray-400 mx-2" />
          )}
          {item.current ? (
            <span class="text-gray-900 dark:text-white font-medium">
              {item.label}
            </span>
          ) : (
            <button
              onClick={item.onClick}
              class="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              {index === 0 && <Home class="w-4 h-4 inline mr-1" />}
              {item.label}
            </button>
          )}
        </div>
      ))}
    </nav>
  )
}