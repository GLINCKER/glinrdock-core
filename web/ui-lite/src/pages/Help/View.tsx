import { useState, useEffect } from 'preact/hooks'
import { apiClient, HelpDocument, HelpManifest } from '../../api'
import { usePageTitle } from '../../hooks/usePageTitle'
import { LightweightMarkdown } from '../../components/ui/LightweightMarkdown'
import { Breadcrumbs } from '../../components/ui/Breadcrumbs'
import { HelpLayout } from './HelpLayout'
import { ArticleHeader } from './ArticleHeader'
import { ArticleToc } from './ArticleToc'
import { registerHelpArticle, registerHelpArticleHeadings } from '../../utils/searchRegistry'
import { ArrowLeft, Clock, Hash, BookOpen, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-preact'
import { MANUAL_HELP_PAGES, MANUAL_HELP_MANIFEST } from '../../data/manualHelpPages'

interface HeadingInfo {
  id: string
  title: string
  level: number
}

interface HelpViewProps {
  slug: string
  onBack: () => void
  onNavigateToHelp?: (slug: string) => void
}

export function HelpView({ slug, onBack, onNavigateToHelp }: HelpViewProps) {
  const [document, setDocument] = useState<HelpDocument | null>(null)
  const [manifest, setManifest] = useState<HelpManifest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [headings, setHeadings] = useState<HeadingInfo[]>([])

  // Find document info from manifest for title
  const docInfo = manifest?.files.find(entry => entry.slug === slug)
  usePageTitle(docInfo?.title || 'Help')

  useEffect(() => {
    const loadDocument = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Check if this is a manual page first
        if (MANUAL_HELP_PAGES[slug]) {
          const docData = MANUAL_HELP_PAGES[slug]
          const docInfo = MANUAL_HELP_MANIFEST.find(entry => entry.slug === slug)
          
          // Create a combined manifest with manual pages included
          const apiManifest = await apiClient.getHelpManifest().catch(() => ({ 
            files: [], 
            generated: new Date().toISOString(), 
            version: '1.0.0',
            description: 'GLINRDOCK Help Documentation',
            stats: {
              total_files: 0,
              total_words: 0,
              section_count: {},
              audience_count: {},
              version_count: {}
            }
          }))
          // Combine with API manifest, inserting manual pages in the right position
          const apiFiles = apiManifest?.files || []
          const configSectionIndex = apiFiles.findIndex(f => f.section === 'Configuration')
          
          let combinedFiles = [...apiFiles]
          if (configSectionIndex >= 0) {
            // Insert manual pages at the beginning of Configuration section
            const beforeConfig = combinedFiles.slice(0, configSectionIndex)
            const afterConfig = combinedFiles.slice(configSectionIndex)
            combinedFiles = [...beforeConfig, ...MANUAL_HELP_MANIFEST, ...afterConfig]
          } else {
            // No Configuration section exists, add manual pages at the end
            combinedFiles = [...combinedFiles, ...MANUAL_HELP_MANIFEST]
          }
          
          const combinedManifest = {
            ...apiManifest,
            files: combinedFiles
          }
          
          setDocument(docData)
          setManifest(combinedManifest)
          
          // Register manual article with search system
          if (docInfo) {
            registerHelpArticle(
              slug,
              docInfo.title,
              docInfo.section || 'Documentation',
              docData.markdown,
              docData.updated_at
            )
            
            // Also register all headings within the article for searchable anchor links
            registerHelpArticleHeadings(
              slug,
              docInfo.title,
              docInfo.section || 'Documentation',
              docData.markdown
            )
          }
        } else {
          // Load API-driven document and manifest
          const [docData, manifestData] = await Promise.all([
            apiClient.getHelpDocument(slug),
            apiClient.getHelpManifest()
          ])
          
          
          // Combine with manual pages, inserting them in the right position
          const apiFiles = manifestData?.files || []
          const configSectionIndex = apiFiles.findIndex(f => f.section === 'Configuration')
          
          let combinedFiles = [...apiFiles]
          if (configSectionIndex >= 0) {
            // Insert manual pages at the beginning of Configuration section
            const beforeConfig = combinedFiles.slice(0, configSectionIndex)
            const afterConfig = combinedFiles.slice(configSectionIndex)
            combinedFiles = [...beforeConfig, ...MANUAL_HELP_MANIFEST, ...afterConfig]
          } else {
            // No Configuration section exists, add manual pages at the end
            combinedFiles = [...combinedFiles, ...MANUAL_HELP_MANIFEST]
          }
          
          const combinedManifest = {
            ...manifestData,
            files: combinedFiles
          }
          
          setDocument(docData)
          setManifest(combinedManifest)
          
          // Register API article with search system
          const docInfo = manifestData.files.find(entry => entry.slug === slug)
          if (docData && docInfo) {
            registerHelpArticle(
              slug,
              docInfo.title,
              docInfo.section || 'Documentation',
              docData.markdown,
              docData.updated_at
            )
            
            // Also register all headings within the article for searchable anchor links
            registerHelpArticleHeadings(
              slug,
              docInfo.title,
              docInfo.section || 'Documentation',
              docData.markdown
            )
          }
        }
      } catch (err) {
        console.error('Failed to load help document:', err)
        setError(err instanceof Error ? err.message : 'Failed to load help document')
      } finally {
        setLoading(false)
      }
    }

    if (slug) {
      loadDocument()
    }
  }, [slug])

  // Extract headings from rendered content
  useEffect(() => {
    if (!document?.markdown) {
      return
    }

    const headingMatches = document.markdown.match(/^(#{1,6})\s+(.+)$/gm)
    
    if (headingMatches) {
      const extractedHeadings = headingMatches.map(match => {
        const level = match.match(/^#+/)?.[0].length || 1
        const title = match.replace(/^#+\s+/, '').replace(/\{#[^}]+\}/, '').trim()
        const id = title.toLowerCase()
          .replace(/[^\w\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/--+/g, '-')
        
        return { id, title, level }
      })
      
      setHeadings(extractedHeadings)
    }
  }, [document])

  // Handle anchor navigation when URL contains hash fragment
  useEffect(() => {
    if (!document?.markdown) return
    
    // Check if URL has hash fragment
    const hash = window.location.hash.replace('#', '')
    if (hash) {
      // Wait a bit for content to render
      const scrollToAnchor = () => {
        const element = window.document.getElementById(hash)
        if (element) {
          element.scrollIntoView({ 
            behavior: 'smooth',
            block: 'start'
          })
        }
      }
      
      // Try multiple times as content may still be rendering
      setTimeout(scrollToAnchor, 100)
      setTimeout(scrollToAnchor, 300)
      setTimeout(scrollToAnchor, 600)
    }
  }, [document])


  if (loading) {
    return (
      <div class="p-6">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
        <p class="text-center text-gray-400 mt-4">Loading help document...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div class="p-6">
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 class="text-red-800 dark:text-red-400 font-medium">Failed to load help document</h3>
          <p class="text-red-600 dark:text-red-500 text-sm mt-1">{error}</p>
          <button
            onClick={() => window.location.reload()}
            class="mt-3 bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-400 px-4 py-2 rounded text-sm hover:bg-red-200 dark:hover:bg-red-900/60"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!document || !manifest) {
    return <div class="p-6">Document not found</div>
  }

  // Find the current document index for next/previous navigation
  const currentIndex = manifest.files.findIndex(entry => entry.slug === slug)
  const prevDoc = currentIndex > 0 ? manifest.files[currentIndex - 1] : null
  const nextDoc = currentIndex < manifest.files.length - 1 ? manifest.files[currentIndex + 1] : null

  const sameSection = manifest.files
    .filter(entry => entry.section === docInfo?.section && entry.slug !== slug)
    .slice(0, 5)

  // Count words in markdown
  const wordCount = document.markdown
    .replace(/[#*`_~\[\]()]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 0).length

  // Create breadcrumb items
  const breadcrumbItems = [
    { label: 'Help', href: '/app/help' },
    { label: docInfo?.section || 'Documentation' },
    { label: docInfo?.title || 'Document' }
  ]

  // Sidebar content
  const sidebarContent = (
    <ArticleToc 
      toc={headings} 
      updatedAt={document.updated_at}
      tags={docInfo?.section ? [docInfo.section] : []}
    />
  )

  // Header content
  const headerContent = (
    <>
      <Breadcrumbs items={breadcrumbItems} />
      
      <ArticleHeader
        icon={<BookOpen class="w-6 h-6 text-[#9c40ff]" />}
        title={docInfo?.title || 'Help Document'}
        updatedAt={document.updated_at}
        wordCount={wordCount}
        tags={docInfo?.section ? [docInfo.section] : []}
      />
    </>
  )

  return (
    <HelpLayout header={headerContent} aside={sidebarContent}>
      {/* Main content */}
      <LightweightMarkdown>{document.markdown}</LightweightMarkdown>
      
      {/* Navigation */}
      {(prevDoc || nextDoc) && (
        <div class="flex justify-between items-center pt-8 mt-8 border-t border-gray-200 dark:border-gray-700">
          {prevDoc ? (
            <button
              onClick={() => onNavigateToHelp?.(prevDoc.slug.endsWith('.md') ? prevDoc.slug.slice(0, -3) : prevDoc.slug)}
              class="group flex items-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-purple-600/20 hover:from-purple-500/20 hover:via-blue-500/20 hover:to-purple-600/30 border border-purple-200/50 hover:border-purple-300/70 dark:border-purple-400/30 dark:hover:border-purple-300/50 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-purple-500/20 transform hover:scale-[1.02]"
            >
              <ChevronLeft class="w-5 h-5 text-purple-600 dark:text-purple-400 transition-colors duration-300" />
              <div class="text-left">
                <div class="text-xs text-gray-500 dark:text-gray-400 font-medium">Previous</div>
                <div class="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors duration-300">
                  {prevDoc.title}
                </div>
              </div>
            </button>
          ) : (
            <div></div>
          )}

          {nextDoc && (
            <button
              onClick={() => onNavigateToHelp?.(nextDoc.slug.endsWith('.md') ? nextDoc.slug.slice(0, -3) : nextDoc.slug)}
              class="group flex items-center gap-3 px-6 py-4 rounded-xl bg-gradient-to-bl from-pink-500/10 via-purple-500/10 to-blue-600/20 hover:from-pink-500/20 hover:via-purple-500/20 hover:to-blue-600/30 border border-pink-200/50 hover:border-pink-300/70 dark:border-pink-400/30 dark:hover:border-pink-300/50 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-pink-500/20 transform hover:scale-[1.02]"
            >
              <div class="text-right">
                <div class="text-xs text-gray-500 dark:text-gray-400 font-medium">Next</div>
                <div class="text-sm font-semibold text-gray-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-300 transition-colors duration-300">
                  {nextDoc.title}
                </div>
              </div>
              <ChevronRight class="w-5 h-5 text-pink-600 dark:text-pink-400 transition-colors duration-300" />
            </button>
          )}
        </div>
      )}
    </HelpLayout>
  )
}