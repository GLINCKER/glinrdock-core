import { ChevronRight } from 'lucide-preact'

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" class="mb-6">
      <ol class="flex items-center space-x-1 text-sm text-gray-600 dark:text-gray-400">
        {items.map((item, index) => (
          <li key={index} class="flex items-center">
            {index > 0 && (
              <ChevronRight class="w-3.5 h-3.5 mx-2 text-gray-400 dark:text-gray-500 flex-shrink-0" />
            )}
            {item.href ? (
              <a
                href={item.href}
                class="hover:text-gray-900 dark:hover:text-gray-200 transition-colors duration-150"
              >
                {item.label}
              </a>
            ) : (
              <span 
                class={`${
                  index === items.length - 1 
                    ? 'text-gray-900 dark:text-gray-200 font-medium truncate' 
                    : ''
                }`}
                title={index === items.length - 1 ? item.label : undefined}
              >
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}