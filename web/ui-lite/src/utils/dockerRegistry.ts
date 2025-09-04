// Docker Registry API utilities for dynamic version fetching
import { cache, dockerRateLimiter } from './cache'

export interface DockerTag {
  name: string
  full_size: number
  last_updated: string
  v2: boolean
}

export interface DockerImageInfo {
  name: string
  description: string
  star_count: number
  pull_count: number
  is_official: boolean
  tags: DockerTag[]
}

// Legacy cache - now using centralized cache system

// Get Docker Hub image info via backend proxy with caching and rate limiting
export async function getDockerImageInfo(imageName: string): Promise<DockerImageInfo | null> {
  const cacheKey = `image-${imageName}`
  
  // Check cache first
  const cached = cache.get<DockerImageInfo>(cacheKey, 'docker')
  if (cached) {
    return cached
  }

  // Check rate limiting
  if (!dockerRateLimiter.canMakeRequest('dockerhub-info')) {
    console.warn(`Rate limit exceeded for Docker Hub image info. Remaining: ${dockerRateLimiter.getRemainingRequests('dockerhub-info')}`)
    return null
  }

  try {
    // Use backend proxy - detect dev vs prod
    const baseUrl = ''
    const response = await fetch(`${baseUrl}/v1/dockerhub/repo/${imageName}`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    
    // Cache the result
    cache.set(cacheKey, data, 'docker')
    return data
  } catch (error) {
    console.warn(`Failed to fetch Docker image info for ${imageName}:`, error)
    return null
  }
}

// Get latest tags for an image via backend proxy with caching and rate limiting
export async function getImageTags(imageName: string, limit = 10): Promise<DockerTag[]> {
  const cacheKey = `tags-${imageName}-${limit}`
  
  // Check cache first
  const cached = cache.get<DockerTag[]>(cacheKey, 'docker')
  if (cached) {
    return cached
  }

  // Check rate limiting
  if (!dockerRateLimiter.canMakeRequest('dockerhub-tags')) {
    console.warn(`Rate limit exceeded for Docker Hub tags. Remaining: ${dockerRateLimiter.getRemainingRequests('dockerhub-tags')}`)
    return []
  }

  try {
    // Use backend proxy - detect dev vs prod
    const baseUrl = ''
    const response = await fetch(`${baseUrl}/v1/dockerhub/tags/${imageName}?page_size=${limit}`)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    
    const data = await response.json()
    const tags = data.results || []
    
    // Cache the result
    cache.set(cacheKey, tags, 'docker')
    return tags
  } catch (error) {
    console.warn(`Failed to fetch tags for ${imageName}:`, error)
    return []
  }
}

// Get the "best" tag (latest stable version, not just 'latest')
export function getBestTag(tags: DockerTag[]): string {
  if (!tags.length) return 'latest'
  
  // Priority order for tag selection
  const priorities = [
    (tag: string) => /^\d+\.\d+\.\d+$/.test(tag) ? 100 : 0, // Semantic versions (x.y.z)
    (tag: string) => /^\d+\.\d+$/.test(tag) ? 90 : 0,       // Major.minor versions
    (tag: string) => /^\d+$/.test(tag) ? 80 : 0,            // Major versions only
    (tag: string) => tag === 'stable' ? 70 : 0,             // Stable tag
    (tag: string) => tag === 'lts' ? 65 : 0,                // LTS versions
    (tag: string) => tag.includes('alpine') ? 60 : 0,       // Alpine variants
    (tag: string) => tag === 'latest' ? 50 : 0,             // Latest as fallback
  ]
  
  const scoredTags = tags.map(tag => ({
    tag: tag.name,
    score: priorities.reduce((sum, fn) => sum + fn(tag.name), 0),
    lastUpdated: new Date(tag.last_updated).getTime()
  }))
  
  // Sort by score, then by recency
  scoredTags.sort((a, b) => {
    if (a.score !== b.score) return b.score - a.score
    return b.lastUpdated - a.lastUpdated
  })
  
  return scoredTags[0]?.tag || 'latest'
}

// Search Docker Hub for images via backend proxy with caching and rate limiting
export async function searchDockerImages(query: string, limit = 25): Promise<any[]> {
  const cacheKey = `search-${query}-${limit}`
  
  // Check cache first
  const cached = cache.get<any[]>(cacheKey, 'docker')
  if (cached) {
    return cached
  }

  // Check rate limiting
  if (!dockerRateLimiter.canMakeRequest('dockerhub-search')) {
    console.warn(`Rate limit exceeded for Docker Hub search. Remaining: ${dockerRateLimiter.getRemainingRequests('dockerhub-search')}`)
    return []
  }

  try {
    // Use backend proxy - detect dev vs prod
    const baseUrl = ''
    const url = `${baseUrl}/v1/dockerhub/search?query=${encodeURIComponent(query)}&page_size=${limit}`
    
    const response = await fetch(url)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Docker Hub search failed: ${response.status} - ${errorText}`)
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }
    
    const data = await response.json()
    const results = data.results || []
    
    // Cache the result
    cache.set(cacheKey, results, 'docker')
    return results
  } catch (error) {
    console.error(`❌ Failed to search Docker images for ${query}:`, error)
    return []
  }
}

// Enhanced template with dynamic version
export interface EnhancedServiceTemplate {
  id: string
  name: string
  displayName: string
  description: string
  baseImage: string // Without version
  category: string
  iconKey: string
  defaultPort: number
  additionalPorts?: number[]
  defaultEnv?: Record<string, string>
  documentation?: string
  tags: string[]
  popular: boolean
  complexity: 'beginner' | 'intermediate' | 'advanced'
  // Dynamic fields
  dynamicVersion?: string
  dockerInfo?: DockerImageInfo
  lastUpdated?: string
}