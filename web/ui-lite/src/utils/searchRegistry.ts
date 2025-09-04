import type { SearchHit } from '../api'

// In-memory search registry for dynamic content
class SearchRegistry {
  private items: Map<string, SearchHit> = new Map()
  private listeners: Set<(items: SearchHit[]) => void> = new Set()

  // Add or update a search item
  registerItem(item: SearchHit): void {
    const key = `${item.type}:${item.entity_id}`
    this.items.set(key, item)
    this.notifyListeners()
  }

  // Remove a search item
  unregisterItem(type: string, entity_id: string): void {
    const key = `${type}:${entity_id}`
    this.items.delete(key)
    this.notifyListeners()
  }

  // Get all registered items
  getItems(): SearchHit[] {
    return Array.from(this.items.values())
  }

  // Search items with relevance scoring
  searchItems(query: string): SearchHit[] {
    if (!query.trim()) return this.getItems()
    
    const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0)
    const items = this.getItems()
    
    // Score and filter items
    const scoredItems = items.map(item => {
      const score = this.calculateRelevanceScore(item, queryTerms)
      return { ...item, score }
    }).filter(item => item.score > 0)
    
    // Sort by relevance score (highest first)
    return scoredItems.sort((a, b) => b.score - a.score)
  }

  // Calculate relevance score for search item
  private calculateRelevanceScore(item: SearchHit, queryTerms: string[]): number {
    let score = 0
    const title = item.title.toLowerCase()
    const content = (item.content || '').toLowerCase()
    const subtitle = (item.subtitle || '').toLowerCase()
    
    queryTerms.forEach(term => {
      // Title matches (highest weight)
      if (title.includes(term)) {
        score += title.indexOf(term) === 0 ? 10 : 5 // Higher score for starting match
      }
      
      // Subtitle matches (medium weight)  
      if (subtitle.includes(term)) {
        score += 3
      }
      
      // Content matches (lower weight)
      if (content.includes(term)) {
        score += 1
      }
    })
    
    return score
  }

  // Get items by type
  getItemsByType(type: string): SearchHit[] {
    return Array.from(this.items.values()).filter(item => item.type === type)
  }

  // Subscribe to changes
  subscribe(listener: (items: SearchHit[]) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  // Notify all listeners of changes
  private notifyListeners(): void {
    const items = this.getItems()
    this.listeners.forEach(listener => listener(items))
  }

  // Clear all items
  clear(): void {
    this.items.clear()
    this.notifyListeners()
  }
}

// Create a global instance
export const searchRegistry = new SearchRegistry()

// Function to preload help articles for global search
export async function preloadHelpArticlesForSearch() {
  try {
    const { apiClient } = await import('../api')
    const manifest = await apiClient.getHelpManifest()
    
    if (manifest?.files) {
      manifest.files.forEach(article => {
        registerHelpArticleFromManifest(
          article.slug,
          article.title,
          article.section || 'Documentation',
          article.tags.join(', ') || article.section
        )
      })
      console.log(`✅ Preloaded ${manifest.files.length} help articles for global search`)
      return manifest.files.length
    }
  } catch (error) {
    console.warn('Failed to preload help articles for search:', error)
  }
  return 0
}

// Helper function to create plaintext excerpt from markdown
export function createPlaintextExcerpt(markdown: string, maxLength = 200): string {
  return markdown
    .replace(/#{1,6}\s+/g, '') // Remove headings
    .replace(/\*\*([^*]+)\*\*/g, '$1') // Bold
    .replace(/\*([^*]+)\*/g, '$1') // Italic
    .replace(/`([^`]+)`/g, '$1') // Code
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Links
    .replace(/^\s*[-*+]\s+/gm, '') // List items
    .replace(/^\s*\d+\.\s+/gm, '') // Numbered lists
    .replace(/\n+/g, ' ') // Newlines to spaces
    .replace(/\s+/g, ' ') // Multiple spaces to single
    .trim()
    .slice(0, maxLength)
    .replace(/\s+\S*$/, '') // Remove partial word at end
    .concat(maxLength < markdown.length ? '...' : '')
}

// Helper function to register a help article
export function registerHelpArticle(
  slug: string,
  title: string,
  section: string,
  markdown: string,
  updatedAt?: string
): void {
  const excerpt = createPlaintextExcerpt(markdown)
  
  // Ensure slug doesn't have .md extension for clean URLs
  const cleanSlug = slug.endsWith('.md') ? slug.slice(0, -3) : slug
  
  const searchItem: SearchHit = {
    id: Date.now() + Math.random(), // Generate a unique ID
    type: 'help',
    entity_id: cleanSlug,
    title,
    subtitle: section,
    url_path: `/app/help/${cleanSlug}`,
    content: excerpt,
    score: 1.0
  }

  searchRegistry.registerItem(searchItem)
}

// Helper function to register help article from manifest (without full content)
export function registerHelpArticleFromManifest(
  slug: string,
  title: string,
  section: string,
  description?: string
): void {
  // Ensure slug doesn't have .md extension for clean URLs
  const cleanSlug = slug.endsWith('.md') ? slug.slice(0, -3) : slug
  
  const searchItem: SearchHit = {
    id: Date.now() + Math.random(), // Generate a unique ID
    type: 'help',
    entity_id: cleanSlug,
    title,
    subtitle: section,
    url_path: `/app/help/${cleanSlug}`,
    content: description || `${title} - ${section} documentation`,
    score: 1.0
  }

  searchRegistry.registerItem(searchItem)
}

// Helper function to extract and register headings from markdown
export function registerHelpArticleHeadings(
  slug: string,
  articleTitle: string,
  section: string,
  markdown: string
): void {
  // Ensure slug doesn't have .md extension for clean URLs
  const cleanSlug = slug.endsWith('.md') ? slug.slice(0, -3) : slug
  
  // Extract headings from markdown
  const headingMatches = markdown.match(/^(#{1,6})\s+(.+)$/gm)
  if (!headingMatches) return
  
  headingMatches.forEach(match => {
    const level = match.match(/^#+/)?.[0].length || 1
    const headingTitle = match.replace(/^#+\s+/, '').replace(/\{#[^}]+\}/, '').trim()
    
    // Skip main title (h1) as it's already registered as the main article
    if (level === 1) return
    
    // Generate anchor ID (same logic as in ArticleToc)
    const anchorId = headingTitle.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/--+/g, '-')
    
    // Create search item for heading
    const headingSearchItem: SearchHit = {
      id: Date.now() + Math.random(),
      type: 'help',
      entity_id: `${cleanSlug}#${anchorId}`,
      title: headingTitle,
      subtitle: `${articleTitle} › ${section}`,
      url_path: `/app/help/${cleanSlug}#${anchorId}`,
      content: `Section: ${headingTitle} in ${articleTitle}`,
      score: 0.8 // Slightly lower score than main articles
    }
    
    searchRegistry.registerItem(headingSearchItem)
  })
}