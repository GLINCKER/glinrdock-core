import { useState, useEffect, useRef } from 'preact/hooks'
import { Copy, Check, Clock, Hash } from 'lucide-preact'

interface HeadingInfo {
  id: string
  title: string
  level: number
}

interface ArticleTocProps {
  toc: HeadingInfo[]
  updatedAt?: string
  tags?: string[]
}

export function ArticleToc({ toc, updatedAt, tags }: ArticleTocProps) {
  const [activeId, setActiveId] = useState<string>('')
  const [copied, setCopied] = useState(false)
  const observerRef = useRef<IntersectionObserver>()
  
  console.log('🔗 ArticleToc received TOC:', toc)

  // Copy current page URL
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy link:', err)
    }
  }

  // Set up IntersectionObserver for scrollspy
  useEffect(() => {
    const headingElements = toc
      .map(heading => document.getElementById(heading.id))
      .filter(Boolean)

    if (headingElements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        // Find the heading that's most visible
        const visibleEntries = entries.filter(entry => entry.isIntersecting)
        
        if (visibleEntries.length > 0) {
          // Sort by intersection ratio and distance from top
          const mostVisible = visibleEntries.reduce((prev, curr) => {
            const prevTop = Math.abs(prev.boundingClientRect.top)
            const currTop = Math.abs(curr.boundingClientRect.top)
            return currTop < prevTop ? curr : prev
          })
          
          setActiveId(mostVisible.target.id)
        }
      },
      {
        // Trigger when heading crosses the top 20% of the viewport
        rootMargin: '-20% 0px -60% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1]
      }
    )

    headingElements.forEach(el => {
      if (el) observer.observe(el)
    })

    observerRef.current = observer

    return () => {
      observer.disconnect()
    }
  }, [toc])

  if (toc.length === 0 && !updatedAt && (!tags || tags.length === 0)) {
    return null
  }

  return (
    <div class="space-y-4">
      {/* Document Details - moved above TOC */}
      {(updatedAt || tags?.length || true) && (
        <div class="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur supports-[backdrop-filter]:bg-white/60 p-6">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Details
          </h3>
          
          <div class="space-y-3">
            {updatedAt && (
              <div class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Clock class="w-4 h-4" />
                <span>Updated {new Date(updatedAt).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                })}</span>
              </div>
            )}

            {tags && tags.length > 0 && (
              <div class="space-y-2">
                <div class="text-sm text-gray-600 dark:text-gray-400">Tags</div>
                <div class="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      class="text-xs px-2 py-1 rounded-md border bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={copyLink}
              class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-[#9c40ff] dark:hover:text-[#9c40ff] transition-colors duration-200"
            >
              {copied ? (
                <>
                  <Check class="w-4 h-4 text-green-500" />
                  <span class="text-green-500">Link copied!</span>
                </>
              ) : (
                <>
                  <Copy class="w-4 h-4" />
                  <span>Copy link</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Table of Contents - moved below Details */}
      {toc.length > 0 && (
        <div class="rounded-2xl border border-gray-200/70 dark:border-gray-800 bg-white/70 dark:bg-gray-900/60 backdrop-blur supports-[backdrop-filter]:bg-white/60 p-6">
          <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
            On this page
          </h3>
          
          <nav>
            <ul class="space-y-1">
              {toc.map((heading) => (
                <li key={heading.id}>
                  <a
                    href={`#${heading.id}`}
                    class={`block text-sm transition-all duration-200 ${
                      heading.level === 3 ? 'ml-3' : ''
                    } ${
                      activeId === heading.id
                        ? 'text-[#9c40ff] dark:text-[#9c40ff] font-medium border-l-2 border-[#9c40ff] pl-2'
                        : 'text-gray-700 dark:text-gray-300 hover:text-[#9c40ff] dark:hover:text-[#9c40ff] py-1'
                    }`}
                  >
                    {heading.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      )}
    </div>
  )
}