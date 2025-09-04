import { useMemo } from 'preact/hooks'
import { Link } from 'lucide-preact'
import { CodeBlock } from '../../components/ui/CodeBlock'

interface MarkdownRendererProps {
  markdown: string
  onHeadingsExtracted?: (headings: HeadingInfo[]) => void
}

interface HeadingInfo {
  id: string
  title: string
  level: number
}

// Simple markdown renderer without external dependencies
export function MarkdownRenderer({ markdown, onHeadingsExtracted }: MarkdownRendererProps) {
  const { html, headings, codeBlocks } = useMemo(() => {
    const result = parseMarkdown(markdown)
    return result
  }, [markdown])

  // Notify parent of extracted headings
  useMemo(() => {
    if (onHeadingsExtracted) {
      onHeadingsExtracted(headings)
    }
  }, [headings, onHeadingsExtracted])

  // Process HTML to replace code block placeholders with actual components
  const processedContent = useMemo(() => {
    // Always check if HTML contains code block placeholders
    if (!html.includes('__CODEBLOCK__')) {
      return <div dangerouslySetInnerHTML={{ __html: html }} />
    }

    const parts = html.split(/(__CODEBLOCK__[^_]*?__CODEBLOCK__)/)
    const elements: any[] = []

    parts.forEach((part, index) => {
      if (part.startsWith('__CODEBLOCK__') && part.endsWith('__CODEBLOCK__')) {
        try {
          const jsonStr = part.replace(/^__CODEBLOCK__/, '').replace(/__CODEBLOCK__$/, '')
          const { code, language } = JSON.parse(jsonStr)
          elements.push(
            <CodeBlock 
              key={`codeblock-${index}`} 
              code={code} 
              language={language}
              className="my-6"
            />
          )
        } catch (e) {
          console.error('Failed to parse code block JSON:', e)
          // Fallback to original if JSON parsing fails
          elements.push(<div key={index} dangerouslySetInnerHTML={{ __html: part }} />)
        }
      } else if (part.trim()) {
        elements.push(<div key={index} dangerouslySetInnerHTML={{ __html: part }} />)
      }
    })

    return <div>{elements}</div>
  }, [html])

  return (
    <div 
      onClick={(e) => {
        // Handle heading link clicks to update URL
        if (typeof window === 'undefined' || !document) return
        
        const target = e.target as HTMLElement
        if (target.classList.contains('heading-link') || target.closest('.heading-link')) {
          e.preventDefault()
          const linkElement = target.classList.contains('heading-link') ? target : target.closest('.heading-link') as HTMLElement
          const headingId = linkElement?.getAttribute('href')?.slice(1)
          
          if (headingId) {
            const heading = document.getElementById(headingId)
            if (heading) {
              // Calculate offset to account for sticky header
              const headerHeight = 120
              const elementPosition = heading.offsetTop - headerHeight
              
              window.scrollTo({
                top: elementPosition,
                behavior: 'smooth'
              })
              
              // Update URL hash
              setTimeout(() => {
                window.history.replaceState(null, '', `#${headingId}`)
              }, 100)
            }
          }
        }
      }}
    >
      {processedContent}
    </div>
  )
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

function parseMarkdown(markdown: string): { html: string; headings: HeadingInfo[]; codeBlocks: any[] } {
  const headings: HeadingInfo[] = []
  const codeBlocks: any[] = []
  
  let html = markdown
  
  // Handle case where markdown comes wrapped in JSON with etag/markdown structure
  if (html.startsWith('{"etag"') || html.includes('"markdown":"')) {
    try {
      const jsonData = JSON.parse(html)
      if (jsonData.markdown) {
        html = jsonData.markdown
      }
    } catch (e) {
      // If JSON parsing fails, try to extract markdown content manually
      const markdownMatch = html.match(/"markdown":"(.*?)"(?:,"[^"]*":|\}$)/)
      if (markdownMatch) {
        html = markdownMatch[1]
      }
    }
  }
  
  // Remove front matter (YAML between ---)
  html = html.replace(/^---[\s\S]*?---\n*/, '')
  
  // Handle case where the input might be malformed JSON or contains trailing data
  html = html.trim()

  // Clean up escaped newlines and other formatting
  html = html
    .replace(/\\n/g, '\n')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')

  // Fenced code blocks - BEFORE HTML escaping to avoid interference
  html = html.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
    const escapedCode = code.trim()
    const codeBlockData = { code: escapedCode, language: lang || '' }
    codeBlocks.push(codeBlockData)
    
    return `__CODEBLOCK__${JSON.stringify(codeBlockData)}__CODEBLOCK__`
  })

  // Security: HTML escape after extracting code blocks
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

  // Headers (h1-h6) with anchor links
  html = html.replace(/^### (.*$)/gm, (match, title) => {
    const slug = createSlug(title)
    headings.push({ id: slug, title, level: 3 })
    return `<h3 id="${slug}" class="group text-xl font-bold text-gray-900 dark:text-white mt-6 mb-3 flex items-center gap-2">
      ${title}
      <a href="#${slug}" class="heading-link opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-[#9c40ff]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.71"></path></svg>
      </a>
    </h3>`
  })
  
  html = html.replace(/^## (.*$)/gm, (match, title) => {
    const slug = createSlug(title)
    headings.push({ id: slug, title, level: 2 })
    return `<h2 id="${slug}" class="group text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4 flex items-center gap-2">
      ${title}
      <a href="#${slug}" class="heading-link opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-[#9c40ff]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.71"></path></svg>
      </a>
    </h2>`
  })
  
  html = html.replace(/^# (.*$)/gm, (match, title) => {
    const slug = createSlug(title)
    headings.push({ id: slug, title, level: 1 })
    return `<h1 id="${slug}" class="group text-3xl font-bold text-gray-900 dark:text-white mt-8 mb-4 flex items-center gap-2">
      ${title}
      <a href="#${slug}" class="heading-link opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-[#9c40ff]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.72-1.71"></path></svg>
      </a>
    </h1>`
  })

  // Bold and italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-white">$1</strong>')
  html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code class="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-[#8b008b] dark:text-[#9c40ff] rounded text-sm font-mono">$1</code>')

  // Unordered lists
  html = html.replace(/^\s*[\*\-\+]\s+(.*$)/gm, '<li class="ml-6 list-disc text-gray-700 dark:text-gray-300 my-1">$1</li>')
  html = html.replace(/(<li class="ml-6 list-disc[^>]*">.*<\/li>\s*)+/gs, (match) => {
    return `<ul class="mb-6 space-y-1">${match}</ul>`
  })

  // Ordered lists  
  html = html.replace(/^\s*\d+\.\s+(.*$)/gm, '<li class="ml-6 list-decimal text-gray-700 dark:text-gray-300 my-1">$1</li>')
  html = html.replace(/(<li class="ml-6 list-decimal[^>]*">.*<\/li>\s*)+/gs, (match) => {
    return `<ol class="mb-6 space-y-1">${match}</ol>`
  })

  // Links - make them work with internal help navigation
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-[#8b008b] dark:text-[#9c40ff] hover:text-[#9c40ff] dark:hover:text-[#8b008b] underline">${text}</a>`
    } else if (url.startsWith('/app/help/')) {
      // Internal help links - could be enhanced to use navigation
      return `<a href="${url}" class="text-[#8b008b] dark:text-[#9c40ff] hover:text-[#9c40ff] dark:hover:text-[#8b008b] underline">${text}</a>`
    } else {
      return `<a href="${url}" class="text-[#8b008b] dark:text-[#9c40ff] hover:text-[#9c40ff] dark:hover:text-[#8b008b] underline">${text}</a>`
    }
  })

  // Auto-link URLs
  html = html.replace(/(https?:\/\/[^\s<>"]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-[#8b008b] dark:text-[#9c40ff] hover:text-[#9c40ff] dark:hover:text-[#8b008b] underline break-all">$1</a>')

  // Blockquotes
  html = html.replace(/^>\s+(.*$)/gm, '<blockquote class="border-l-4 border-[#9c40ff] pl-4 py-2 my-4 bg-purple-50 dark:bg-purple-900/10 text-gray-700 dark:text-gray-300 italic">$1</blockquote>')

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr class="border-gray-200 dark:border-gray-700 my-6">')

  // Process paragraphs properly
  const paragraphs = html.split('\n\n')
  const processed: string[] = []

  for (let paragraph of paragraphs) {
    paragraph = paragraph.trim()
    if (!paragraph) continue
    
    // Skip if it's already a processed HTML element
    if (paragraph.startsWith('<h') || paragraph.startsWith('<ul') || paragraph.startsWith('<ol') || 
        paragraph.startsWith('<pre') || paragraph.startsWith('<blockquote') || paragraph.startsWith('<hr')) {
      processed.push(paragraph)
    } else {
      // Regular paragraph
      processed.push(`<p class="mb-4 text-gray-700 dark:text-gray-300 leading-relaxed">${paragraph}</p>`)
    }
  }

  return {
    html: processed.join('\n'),
    headings,
    codeBlocks
  }
}