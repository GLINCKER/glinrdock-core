import { useState, useEffect } from 'preact/hooks'
import { List } from 'lucide-preact'

interface HeadingInfo {
  id: string
  title: string
  level: number
}

interface TableOfContentsProps {
  headings: HeadingInfo[]
  className?: string
}

export function TableOfContents({ headings, className = '' }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('')

  useEffect(() => {
    if (typeof window === 'undefined' || !document) return

    const handleScroll = () => {
      const headingElements = headings.map(h => document.getElementById(h.id)).filter(Boolean)
      
      // Find the heading that's currently in view
      let currentActiveId = ''
      for (const element of headingElements) {
        if (element && element.getBoundingClientRect().top <= 150) {
          currentActiveId = element.id
        }
      }
      
      setActiveId(currentActiveId)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    handleScroll() // Initial check

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [headings])

  const handleClick = (headingId: string) => {
    if (typeof window === 'undefined' || !document) return
    
    const element = document.getElementById(headingId)
    if (element) {
      // Calculate offset to account for sticky header
      const headerHeight = 120
      const elementPosition = element.offsetTop - headerHeight
      
      window.scrollTo({
        top: elementPosition,
        behavior: 'smooth'
      })
      
      // Update URL hash after scrolling
      setTimeout(() => {
        window.history.replaceState(null, '', `#${headingId}`)
      }, 100)
    }
  }

  if (headings.length === 0) {
    return null
  }

  return (
    <div class={`help-toc-container ${className}`}>
      <div class="help-toc-title">
        <List class="w-5 h-5 text-[#9c40ff]" />
        Table of Contents
      </div>
      <nav class="space-y-1">
        {headings.map((heading) => (
          <button
            key={heading.id}
            onClick={() => handleClick(heading.id)}
            class={`help-toc-link ${
              activeId === heading.id ? 'help-toc-link-active' : ''
            } ${
              heading.level === 2 ? 'ml-0' : 
              heading.level === 3 ? 'ml-4' : 'ml-6'
            }`}
          >
            {heading.title}
          </button>
        ))}
      </nav>
    </div>
  )
}