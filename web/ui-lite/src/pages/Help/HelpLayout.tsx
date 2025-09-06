import { ComponentChildren } from 'preact'

interface HelpLayoutProps {
  header?: ComponentChildren
  aside?: ComponentChildren
  children: ComponentChildren
}

export function HelpLayout({ header, aside, children }: HelpLayoutProps) {
  return (
    <div class="w-full">
      {/* Header content (breadcrumbs, article header) */}
      {header && (
        <div class="mx-auto max-w-7xl px-6 lg:px-8 py-6 lg:py-8">
          <div class="mb-8 transform-gpu">
            {header}
          </div>
        </div>
      )}
      
      {/* Main content wrapper - using grid instead of flexbox for sticky positioning */}
      <div class="mx-auto max-w-7xl px-6 lg:px-8">
        <div class="grid grid-cols-1 md:grid-cols-[1fr_16rem] lg:grid-cols-[1fr_18rem] gap-6 lg:gap-8 items-start">
          {/* Left column - Main content */}
          <div class="max-w-3xl mx-auto w-full">
            <div class="prose prose-neutral dark:prose-invert max-w-none prose-headings:scroll-mt-24 prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-pre:bg-gray-950/90 prose-pre:rounded-xl prose-code:before:content-[''] prose-code:after:content-[''] scroll-smooth">
              {children}
            </div>
          </div>
          
          {/* Right column - Sticky sidebar */}
          {aside && (
            <div class="hidden md:block">
              <div class="sticky top-6 backdrop-blur-sm bg-white/10 dark:bg-gray-900/10 rounded-3xl shadow-lg shadow-purple-500/5 border border-white/20 dark:border-gray-700/20 p-4">
                {aside}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Bottom padding */}
      <div class="pb-6 lg:pb-8"></div>
    </div>
  )
}