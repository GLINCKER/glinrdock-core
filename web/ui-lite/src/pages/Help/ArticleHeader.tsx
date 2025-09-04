import { ComponentChildren } from 'preact'

interface ArticleHeaderProps {
  icon?: ComponentChildren
  title: string
  updatedAt?: string
  wordCount?: number
  tags?: string[]
  actionSlot?: ComponentChildren
}

export function ArticleHeader({ 
  icon, 
  title, 
  updatedAt, 
  wordCount, 
  tags = [], 
  actionSlot 
}: ArticleHeaderProps) {
  return (
    <div class="relative rounded-2xl border border-gray-200/50 dark:border-gray-700/50 bg-gradient-to-br from-white/90 via-gray-50/80 to-white/70 dark:from-gray-900/90 dark:via-gray-800/80 dark:to-gray-900/70 backdrop-blur p-6 mb-8 shadow-lg overflow-hidden">
      <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500"></div>
      <div class="flex items-start justify-between">
        <div class="flex items-start gap-4 flex-1">
          {icon && (
            <div class="flex-shrink-0 mt-1">
              {icon}
            </div>
          )}
          
          <div class="flex-1 min-w-0">
            <h1 class="text-2xl md:text-3xl font-semibold tracking-tight text-gray-900 dark:text-white mb-3">
              {title}
            </h1>
            
            <div class="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              {updatedAt && (
                <span>Updated · {new Date(updatedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}</span>
              )}
              
              {wordCount && (
                <span>{wordCount} words</span>
              )}
              
              {tags.length > 0 && (
                <div class="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      class="text-xs px-2 py-0.5 rounded-md border bg-purple-50/80 dark:bg-purple-900/30 border-purple-200/50 dark:border-purple-600/40 text-purple-800 dark:text-purple-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {actionSlot && (
          <div class="flex-shrink-0 ml-4">
            {actionSlot}
          </div>
        )}
      </div>
    </div>
  )
}