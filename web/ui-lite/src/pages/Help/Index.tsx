import { useState, useEffect } from 'preact/hooks'
import { apiClient, HelpManifest, HelpManifestEntry } from '../../api'
import { usePageTitle } from '../../hooks/usePageTitle'
import { BookOpen, Search, Clock, Hash, Tag, ChevronRight } from 'lucide-preact'
import { HelpHeader } from '../../components/help/HelpHeader'
import { HelpSearchBar } from '../../components/help/HelpSearchBar'
import { registerHelpArticleFromManifest } from '../../utils/searchRegistry'
import { MANUAL_HELP_MANIFEST } from '../../data/manualHelpPages'

interface HelpIndexProps {
  onNavigateToHelp: (slug: string) => void
}

export function HelpIndex({ onNavigateToHelp }: HelpIndexProps) {
  usePageTitle('Help')
  
  const [manifest, setManifest] = useState<HelpManifest | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    const loadManifest = async () => {
      try {
        setLoading(true)
        setError(null)
        const data = await apiClient.getHelpManifest()
        setManifest(data)
        
        // Register all help articles for global search
        if (data?.files) {
          data.files.forEach(article => {
            registerHelpArticleFromManifest(
              article.slug,
              article.title,
              article.section || 'Documentation',
              article.description
            )
          })
          console.log(`✅ Registered ${data.files.length} help articles for search`)
        }
      } catch (err) {
        console.error('Failed to load help manifest:', err)
        setError(err instanceof Error ? err.message : 'Failed to load help')
      } finally {
        setLoading(false)
      }
    }

    loadManifest()
  }, [])

  if (loading) {
    return (
      <div class="p-3 sm:p-4 max-w-7xl mx-auto space-y-4 fade-in">
        <div class="animate-pulse">
          <div class="flex items-center justify-between mb-4">
            <div>
              <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
              <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-56"></div>
            </div>
          </div>
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-4"></div>
                <div class="space-y-3">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} class="p-3 bg-gray-50 dark:bg-gray-700/50 rounded">
                      <div class="h-5 bg-gray-200 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
                      <div class="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div class="p-3 sm:p-4 max-w-7xl mx-auto space-y-4 fade-in">
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-lg p-4">
          <h3 class="text-red-800 dark:text-red-400 font-medium">Failed to load help</h3>
          <p class="text-red-700 dark:text-gray-300 text-sm mt-1">{error}</p>
        </div>
      </div>
    )
  }

  if (!manifest || !manifest.files) {
    return (
      <div class="p-3 sm:p-4 max-w-7xl mx-auto space-y-4 fade-in">
        <div class="text-center py-12">
          <BookOpen class="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Documentation Available</h3>
          <p class="text-gray-600 dark:text-gray-400">Help documentation is being generated or is not yet available.</p>
        </div>
      </div>
    )
  }

  // Filter files based on search query
  const filteredFiles = manifest.files.filter(entry => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      entry.title.toLowerCase().includes(query) ||
      entry.section.toLowerCase().includes(query) ||
      entry.tags.some(tag => tag.toLowerCase().includes(query))
    )
  })

  // Add manual help pages that don't come from the manifest
  const manualPages = MANUAL_HELP_MANIFEST

  // Combine manifest files with manual pages
  const allFiles = [...filteredFiles, ...manualPages.filter(page => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      page.title.toLowerCase().includes(query) ||
      page.section.toLowerCase().includes(query) ||
      page.tags.some(tag => tag.toLowerCase().includes(query))
    )
  })]

  // Group all files by section
  const entriesBySection = allFiles.reduce((acc, entry) => {
    if (!acc[entry.section]) {
      acc[entry.section] = []
    }
    acc[entry.section].push(entry)
    return acc
  }, {} as Record<string, HelpManifestEntry[]>)

  const sections = Object.keys(entriesBySection).sort()
  const totalDocs = manifest.files.length + manualPages.length

  return (
    <div class="help-container fade-in">
      <HelpHeader
        title="Help Documentation"
        subtitle={`Find guides, tutorials, and reference documentation • ${totalDocs} documents available`}
        icon={<BookOpen class="w-5 h-5 text-[#9c40ff]" />}
      />

      <HelpSearchBar
        value={searchQuery}
        onInput={setSearchQuery}
        resultsCount={filteredFiles.length}
        className="mb-6"
      />

      {/* Documentation Grid */}
      {sections.length > 0 ? (
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {sections.map(section => (
            <div key={section} class="bg-white dark:bg-black rounded-xl border border-gray-200 dark:border-gray-800 shadow-lg overflow-hidden">
              <div class="relative p-4 bg-white dark:bg-black">
                <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500"></div>
                <h2 class="text-lg font-semibold text-gray-900 dark:text-white capitalize flex items-center gap-3">
                  <div class="w-3 h-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full shadow-lg"></div>
                  {section}
                  <span class="text-xs text-gray-500 dark:text-gray-400 font-normal ml-auto bg-gray-100/80 dark:bg-gray-700/80 px-2.5 py-1 rounded-full">
                    {entriesBySection[section].length} doc{entriesBySection[section].length !== 1 ? 's' : ''}
                  </span>
                </h2>
              </div>
              <div class="p-4 space-y-3">
                {entriesBySection[section].map(entry => (
                  <button 
                    key={entry.slug}
                    class="group block w-full text-left p-4 bg-gradient-to-r from-white to-gray-50 dark:from-gray-900 dark:to-black/90 hover:from-purple-50 hover:to-pink-50 dark:hover:from-gray-800 dark:hover:to-gray-900 rounded-xl border border-gray-200/50 hover:border-purple-200/70 dark:border-gray-700/50 dark:hover:border-purple-400/50 shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer transform hover:scale-[1.02]"
                    onClick={() => onNavigateToHelp(entry.slug.endsWith('.md') ? entry.slug.slice(0, -3) : entry.slug)}
                  >
                    <div class="flex items-start justify-between">
                      <div class="flex-1 min-w-0">
                        <h3 class="text-gray-900 dark:text-white font-semibold text-base group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors duration-300 mb-2">
                          {entry.title}
                        </h3>
                        <div class="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mb-2">
                          <div class="flex items-center gap-1">
                            <Hash class="w-3 h-3" />
                            {entry.word_count} words
                          </div>
                          <div class="flex items-center gap-1">
                            <Clock class="w-3 h-3" />
                            {new Date(entry.updated_at).toLocaleDateString()}
                          </div>
                        </div>
                        {entry.tags.length > 0 && (
                          <div class="flex flex-wrap gap-1">
                            {entry.tags.slice(0, 3).map(tag => (
                              <span 
                                key={tag}
                                class="inline-flex items-center gap-1 px-2.5 py-1 text-xs bg-gradient-to-r from-purple-100/80 to-blue-100/80 dark:from-gray-600/80 dark:to-gray-500/80 text-purple-700 dark:text-gray-300 rounded-full border border-purple-200/50 dark:border-gray-500/50"
                              >
                                <Tag class="w-2.5 h-2.5" />
                                {tag}
                              </span>
                            ))}
                            {entry.tags.length > 3 && (
                              <span class="text-xs text-gray-500 dark:text-gray-400 px-2 py-1">
                                +{entry.tags.length - 3} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <ChevronRight class="w-5 h-5 text-gray-400 group-hover:text-purple-500 dark:group-hover:text-purple-400 transition-all duration-300 flex-shrink-0 ml-2 transform group-hover:translate-x-1 group-hover:scale-110" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div class="text-center py-12">
          <Search class="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No Results Found</h3>
          <p class="text-gray-600 dark:text-gray-400 mb-4">
            No documentation matches your search for "{searchQuery}"
          </p>
          <button
            onClick={() => setSearchQuery('')}
            class="text-[#8b008b] dark:text-[#9c40ff] hover:underline"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Footer */}
      {manifest.generated && (
        <div class="text-center pt-6 border-t border-gray-200 dark:border-gray-700">
          <p class="text-sm text-gray-500 dark:text-gray-400">
            Documentation generated: {new Date(manifest.generated).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  )
}