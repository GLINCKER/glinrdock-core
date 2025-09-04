import { useState, useEffect } from 'preact/hooks'
import { 
  Clock, 
  Search, 
  Zap, 
  ChevronRight, 
  Terminal,
  Globe,
  Code,
  Shield,
  Sparkles,
  TrendingUp
} from 'lucide-preact'
import { searchRegistry } from '../../utils/searchRegistry'
import type { SearchHit } from '../../api'

interface QuickAccessProps {
  searchQuery?: string
  recentSearches?: string[]
  onSearchSelect?: (query: string) => void
  onItemSelect?: (item: SearchHit) => void
  isSearching?: boolean
}

export function QuickAccess({ 
  searchQuery, 
  recentSearches = [], 
  onSearchSelect, 
  onItemSelect,
  isSearching = false 
}: QuickAccessProps) {
  const [dynamicItems, setDynamicItems] = useState<SearchHit[]>([])
  const [showProTips, setShowProTips] = useState(false)

  // Subscribe to dynamic search items
  useEffect(() => {
    const unsubscribe = searchRegistry.subscribe((items) => {
      setDynamicItems(items)
    })
    
    setDynamicItems(searchRegistry.getItems())
    return unsubscribe
  }, [])

  // Get contextual suggestions based on search query
  const getContextualSuggestions = () => {
    if (!searchQuery || searchQuery.length < 2) return []
    
    return dynamicItems
      .filter(item => 
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.content?.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .slice(0, 3)
  }

  // Get recent help articles
  const getRecentHelpArticles = () => {
    return dynamicItems
      .filter(item => item.type === 'help')
      .slice(0, 4)
  }

  // Get quick actions based on context
  const getQuickActions = () => {
    const actions = [
      { 
        id: 'services',
        label: 'View Services', 
        icon: Globe, 
        query: 'type:service',
        description: 'Browse all services'
      },
      { 
        id: 'projects',
        label: 'View Projects', 
        icon: Terminal, 
        query: 'type:project',
        description: 'Browse all projects' 
      },
      { 
        id: 'help',
        label: 'View Help', 
        icon: Shield, 
        query: 'type:help',
        description: 'Browse documentation'
      }
    ]
    
    return actions.slice(0, 3)
  }

  const contextualSuggestions = getContextualSuggestions()
  const recentHelpArticles = getRecentHelpArticles()
  const quickActions = getQuickActions()
  const hasRecentSearches = recentSearches.length > 0

  return (
    <div className="p-4 border-t border-white/20 dark:border-gray-700/20">
      {/* Search Context */}
      {searchQuery && contextualSuggestions.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            <h3 className="text-sm font-semibold text-purple-600 dark:text-purple-300">
              Related Results
            </h3>
          </div>
          <div className="space-y-2">
            {contextualSuggestions.map((item) => (
              <button
                key={item.entity_id}
                onClick={() => onItemSelect?.(item)}
                className="w-full group flex items-center gap-3 p-2 rounded-lg bg-gradient-to-r from-purple-50/80 via-pink-50/60 to-purple-50/80 dark:from-purple-900/20 dark:via-pink-900/15 dark:to-purple-900/20 border border-purple-200/50 dark:border-purple-700/30 hover:border-purple-300/70 dark:hover:border-purple-600/50 transition-all duration-200 text-left"
              >
                <div className="p-1 bg-purple-100 dark:bg-purple-800/50 rounded text-purple-600 dark:text-purple-400">
                  <Search className="w-3 h-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-purple-800 dark:text-purple-200 truncate">
                    {item.title}
                  </div>
                  <div className="text-xs text-purple-600 dark:text-purple-400 truncate">
                    {item.subtitle}
                  </div>
                </div>
                <ChevronRight className="w-3 h-3 text-purple-500 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent Searches */}
      {!searchQuery && hasRecentSearches && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-300">
              Recent Searches
            </h3>
          </div>
          <div className="space-y-2">
            {recentSearches.slice(0, 3).map((query, index) => (
              <button
                key={index}
                onClick={() => onSearchSelect?.(query)}
                className="w-full group flex items-center gap-3 p-2 rounded-lg bg-gradient-to-r from-blue-50/80 via-cyan-50/60 to-blue-50/80 dark:from-blue-900/20 dark:via-cyan-900/15 dark:to-blue-900/20 border border-blue-200/50 dark:border-blue-700/30 hover:border-blue-300/70 dark:hover:border-blue-600/50 transition-all duration-200 text-left"
              >
                <div className="p-1 bg-blue-100 dark:bg-blue-800/50 rounded text-blue-600 dark:text-blue-400">
                  <Search className="w-3 h-3" />
                </div>
                <span className="text-xs font-medium text-blue-800 dark:text-blue-200 truncate flex-1">
                  {query}
                </span>
                <ChevronRight className="w-3 h-3 text-blue-500 dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {!searchQuery && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">
              Quick Actions
            </h3>
          </div>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <button
                key={action.id}
                onClick={() => onSearchSelect?.(action.query)}
                className="w-full group flex items-center gap-3 p-2 rounded-lg bg-gradient-to-r from-emerald-50/80 via-green-50/60 to-emerald-50/80 dark:from-emerald-900/20 dark:via-green-900/15 dark:to-emerald-900/20 border border-emerald-200/50 dark:border-emerald-700/30 hover:border-emerald-300/70 dark:hover:border-emerald-600/50 transition-all duration-200 text-left"
              >
                <div className="p-1 bg-emerald-100 dark:bg-emerald-800/50 rounded text-emerald-600 dark:text-emerald-400">
                  <action.icon className="w-3 h-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-200">
                    {action.label}
                  </div>
                  <div className="text-xs text-emerald-600 dark:text-emerald-400">
                    {action.description}
                  </div>
                </div>
                <ChevronRight className="w-3 h-3 text-emerald-500 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Recent Help Articles */}
      {!searchQuery && recentHelpArticles.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            <h3 className="text-sm font-semibold text-orange-600 dark:text-orange-300">
              Help Articles
            </h3>
          </div>
          <div className="space-y-2">
            {recentHelpArticles.slice(0, 2).map((article) => (
              <button
                key={article.entity_id}
                onClick={() => onItemSelect?.(article)}
                className="w-full group flex items-center gap-3 p-2 rounded-lg bg-gradient-to-r from-orange-50/80 via-yellow-50/60 to-orange-50/80 dark:from-orange-900/20 dark:via-yellow-900/15 dark:to-orange-900/20 border border-orange-200/50 dark:border-orange-700/30 hover:border-orange-300/70 dark:hover:border-orange-600/50 transition-all duration-200 text-left"
              >
                <div className="p-1 bg-orange-100 dark:bg-orange-800/50 rounded text-orange-600 dark:text-orange-400">
                  <Shield className="w-3 h-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-orange-800 dark:text-orange-200 truncate">
                    {article.title}
                  </div>
                  <div className="text-xs text-orange-600 dark:text-orange-400 truncate">
                    {article.subtitle}
                  </div>
                </div>
                <ChevronRight className="w-3 h-3 text-orange-500 dark:text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Collapsible Pro Tips */}
      <div>
        <button
          onClick={() => setShowProTips(!showProTips)}
          className="flex items-center justify-between w-full mb-3 group"
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-300">
              Pro Tips
            </h3>
          </div>
          <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${showProTips ? 'rotate-90' : ''}`} />
        </button>
        
        {showProTips && (
          <div className="space-y-2">
            <div className="bg-gray-50/80 dark:bg-gray-900/20 p-2 rounded-lg border border-gray-200/50 dark:border-gray-700/30">
              <div className="flex items-start gap-2">
                <Terminal className="w-3 h-3 text-gray-600 dark:text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                    Use <span className="px-1 py-0.5 bg-gray-200/50 dark:bg-gray-700/50 rounded font-mono">type:service</span> to filter by type
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50/80 dark:bg-gray-900/20 p-2 rounded-lg border border-gray-200/50 dark:border-gray-700/30">
              <div className="flex items-start gap-2">
                <Code className="w-3 h-3 text-gray-600 dark:text-gray-400 mt-0.5" />
                <div className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  <span className="px-1 py-0.5 bg-gray-200/50 dark:bg-gray-700/50 rounded font-mono">⌘K</span> Open palette • <span className="px-1 py-0.5 bg-gray-200/50 dark:bg-gray-700/50 rounded font-mono">Esc</span> Close
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats (when searching) */}
      {isSearching && (
        <div className="mt-4 pt-3 border-t border-gray-200/50 dark:border-gray-700/50">
          <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
            <Search className="w-3 h-3" />
            <span>Searching {dynamicItems.length} indexed items...</span>
          </div>
        </div>
      )}
    </div>
  )
}