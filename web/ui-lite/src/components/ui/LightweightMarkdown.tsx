import Markdown from 'markdown-to-jsx'
import { CodeBlock } from './CodeBlock'
import { useMemo } from 'preact/hooks'

interface LightweightMarkdownProps {
  children: string
  onHeadingsExtracted?: (headings: HeadingInfo[]) => void
}

interface HeadingInfo {
  id: string
  title: string
  level: number
}

// Helper function to create URL-friendly slug from heading text
function createSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with dashes
    .replace(/-+/g, '-') // Replace multiple dashes with single
    .trim()
}

// Custom code component with syntax highlighting
function CustomCode({ className, children, ...props }: any) {
  const language = className?.replace('lang-', '') || ''
  
  // If it's a code block (has language class), use our CodeBlock component
  if (className && className.startsWith('lang-')) {
    return (
      <CodeBlock 
        code={children as string} 
        language={language}
        className="my-6"
      />
    )
  }
  
  // Otherwise it's inline code
  return (
    <code 
      className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-[#8b008b] dark:text-[#9c40ff] rounded text-sm font-mono"
      {...props}
    >
      {children}
    </code>
  )
}

// Custom heading components with anchor links
function createHeadingComponent(level: number) {
  return ({ children, ...props }: any) => {
    const title = typeof children === 'string' ? children : String(children)
    const slug = createSlug(title)
    const Tag = `h${level}` as keyof JSX.IntrinsicElements
    
    const headingClasses = {
      1: 'text-3xl font-bold text-gray-900 dark:text-white mt-8 mb-4 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-3',
      2: 'text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4 flex items-center gap-2 border-b border-gray-200 dark:border-gray-700 pb-2',
      3: 'text-xl font-bold text-gray-900 dark:text-white mt-6 mb-3 flex items-center gap-2'
    }
    
    return (
      <Tag 
        id={slug}
        className={`group ${headingClasses[level as keyof typeof headingClasses] || 'font-bold text-gray-900 dark:text-white mt-4 mb-2'}`}
        {...props}
      >
        {children}
        <a 
          href={`#${slug}`} 
          className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-[#9c40ff]"
          onClick={(e) => {
            e.preventDefault()
            if (typeof window !== 'undefined' && document) {
              const element = document.getElementById(slug)
              if (element) {
                const headerHeight = 120
                const elementPosition = element.offsetTop - headerHeight
                
                window.scrollTo({
                  top: elementPosition,
                  behavior: 'smooth'
                })
                
                setTimeout(() => {
                  window.history.replaceState(null, '', `#${slug}`)
                }, 100)
              }
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.71"></path>
          </svg>
        </a>
      </Tag>
    )
  }
}

export function LightweightMarkdown({ children, onHeadingsExtracted }: LightweightMarkdownProps) {
  // Clean the markdown content
  const cleanedMarkdown = useMemo(() => {
    let cleaned = children || ''
    
    // Handle case where markdown comes wrapped in JSON with etag/markdown structure
    if (cleaned && (cleaned.startsWith('{"etag"') || cleaned.includes('"markdown":"'))) {
      try {
        const jsonData = JSON.parse(cleaned)
        if (jsonData.markdown) {
          cleaned = jsonData.markdown
        }
      } catch (e) {
        // If JSON parsing fails, try to extract markdown content manually
        const markdownMatch = cleaned.match(/"markdown":"(.*?)"(?:,"[^"]*":|\}$)/)
        if (markdownMatch && markdownMatch[1]) {
          cleaned = markdownMatch[1]
        }
      }
    }
    
    // Ensure cleaned is a string
    if (!cleaned || typeof cleaned !== 'string') {
      return ''
    }
    
    // Remove front matter (YAML between ---)
    cleaned = cleaned.replace(/^---[\s\S]*?---\n*/, '')
    
    // Clean up escaped content
    cleaned = cleaned
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
    
    return cleaned.trim()
  }, [children])
  
  // Extract headings for TOC
  useMemo(() => {
    if (onHeadingsExtracted) {
      const headings: HeadingInfo[] = []
      const lines = cleanedMarkdown.split('\n')
      
      lines.forEach(line => {
        const match = line.match(/^(#{1,6})\s+(.+)$/)
        if (match) {
          const level = match[1].length
          const title = match[2]
          const id = createSlug(title)
          headings.push({ id, title, level })
        }
      })
      
      onHeadingsExtracted(headings)
    }
  }, [cleanedMarkdown, onHeadingsExtracted])
  
  const options = {
    overrides: {
      code: CustomCode,
      h1: createHeadingComponent(1),
      h2: createHeadingComponent(2),
      h3: createHeadingComponent(3),
      h4: createHeadingComponent(4),
      h5: createHeadingComponent(5),
      h6: createHeadingComponent(6),
      p: {
        props: {
          className: 'mb-4 text-gray-700 dark:text-gray-300 leading-relaxed'
        }
      },
      ul: {
        props: {
          className: 'mb-6 space-y-1'
        }
      },
      ol: {
        props: {
          className: 'mb-6 space-y-1'
        }
      },
      li: {
        props: {
          className: 'ml-6 list-disc text-gray-700 dark:text-gray-300 my-1'
        }
      },
      a: {
        props: {
          className: 'text-[#8b008b] dark:text-[#9c40ff] hover:text-[#9c40ff] dark:hover:text-[#8b008b] underline',
          target: '_blank',
          rel: 'noopener noreferrer'
        }
      },
      blockquote: {
        props: {
          className: 'border-l-4 border-[#9c40ff] pl-4 py-2 my-4 bg-purple-50 dark:bg-purple-900/10 text-gray-700 dark:text-gray-300 italic'
        }
      },
      hr: {
        props: {
          className: 'border-gray-200 dark:border-gray-700 my-6'
        }
      }
    }
  }
  
  return (
    <div className="help-content">
      <Markdown options={options}>
        {cleanedMarkdown}
      </Markdown>
    </div>
  )
}