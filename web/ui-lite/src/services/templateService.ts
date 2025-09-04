import { CORE_TEMPLATES, searchCoreTemplates } from '../data/coreTemplates'
import { EnhancedServiceTemplate, getDockerImageInfo, searchDockerImages, getBestTag, getImageTags } from '../utils/dockerRegistry'

export type VerificationLevel = 'official' | 'verified' | 'community' | 'external'

// Enhanced template with verification info
export interface TemplateWithVerification extends EnhancedServiceTemplate {
  verificationLevel: VerificationLevel
  isExternal: boolean
  lastVerified?: string
  pullCount?: number
  starCount?: number
  securityScan?: {
    lastScan: string
    vulnerabilities: number
    status: 'pass' | 'warning' | 'fail'
  }
}

class TemplateService {
  private templates: Map<string, TemplateWithVerification> = new Map()
  private externalTemplates: Map<string, TemplateWithVerification> = new Map()
  
  constructor() {
    this.initializeCoreTemplates()
  }

  // Initialize core templates with verification
  private initializeCoreTemplates() {
    CORE_TEMPLATES.forEach(template => {
      const enhancedTemplate: TemplateWithVerification = {
        ...template,
        verificationLevel: this.getVerificationLevel(template),
        isExternal: false,
        lastVerified: new Date().toISOString()
      }
      this.templates.set(template.id, enhancedTemplate)
    })
  }

  // Determine verification level based on image
  private getVerificationLevel(template: EnhancedServiceTemplate): VerificationLevel {
    const officialImages = [
      'postgres', 'mysql', 'mongo', 'redis', 'nginx', 'node', 'python', 
      'openjdk', 'rabbitmq', 'alpine', 'ubuntu', 'debian'
    ]
    
    const verifiedImages = [
      'docker.elastic.co/elasticsearch/elasticsearch', 'grafana/grafana',
      'confluentinc/cp-kafka', 'minio/minio'
    ]

    if (officialImages.some(img => template.baseImage.includes(img))) {
      return 'official'
    }
    
    if (verifiedImages.some(img => template.baseImage.includes(img))) {
      return 'verified'
    }
    
    return 'community'
  }

  // Get all templates (core + external)
  async getAllTemplates(includeExternal = true): Promise<TemplateWithVerification[]> {
    const coreTemplates = Array.from(this.templates.values())
    
    if (!includeExternal) {
      return coreTemplates
    }
    
    const externalTemplates = Array.from(this.externalTemplates.values())
    return [...coreTemplates, ...externalTemplates]
  }

  // Get templates by category
  async getTemplatesByCategory(category: string, includeExternal = true): Promise<TemplateWithVerification[]> {
    const allTemplates = await this.getAllTemplates(includeExternal)
    
    if (category === 'all') {
      return allTemplates
    }
    
    return allTemplates.filter(template => template.category === category)
  }

  // Search templates (core first, then external)
  async searchTemplates(query: string, limit = 50): Promise<TemplateWithVerification[]> {
    // First search core templates
    const coreResults = searchCoreTemplates(query).map(template => ({
      ...template,
      verificationLevel: this.getVerificationLevel(template) as VerificationLevel,
      isExternal: false,
      lastVerified: new Date().toISOString()
    }))

    // Always search Docker Hub for more variety, but prioritize core results
    try {
      const externalLimit = Math.max(10, limit - Math.min(coreResults.length, 15)) // Get at least 10 external, up to 35
      
      const externalResults = await searchDockerImages(query, externalLimit)
      const externalTemplates = await Promise.all(
        externalResults.map(async (result) => {
          const template = await this.convertDockerSearchToTemplate(result)
          return template
        })
      )

      const validExternalTemplates = externalTemplates.filter(t => t !== null) as TemplateWithVerification[]
      
      // Deduplicate by checking for similar names/IDs to avoid React key conflicts
      const coreSlice = coreResults.slice(0, Math.min(15, limit))
      const coreNames = new Set(coreSlice.map(t => t.name.toLowerCase()))
      const coreBaseImages = new Set(coreSlice.map(t => t.baseImage.toLowerCase()))
      
      const deduplicatedExternal = validExternalTemplates.filter(ext => {
        const extName = ext.name.toLowerCase()
        const extBaseImage = ext.baseImage.toLowerCase()
        
        // Skip if we already have a core template with similar name or base image
        return !coreNames.has(extName) && 
               !coreBaseImages.has(extBaseImage) &&
               !coreNames.has(extBaseImage.split('/').pop() || '')
      })
      
      // Combine results: prioritize core, then add deduplicated external
      const combined = [
        ...coreSlice,
        ...deduplicatedExternal
      ]

      return combined.slice(0, limit)
    } catch (error) {
      console.error('❌ External Docker Hub search failed:', error)
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      return coreResults.slice(0, limit)
    }
  }

  // Convert Docker Hub search result to template
  private async convertDockerSearchToTemplate(searchResult: any): Promise<TemplateWithVerification | null> {
    try {
      const imageInfo = await getDockerImageInfo(searchResult.repo_name)
      if (!imageInfo) return null

      const tags = await getImageTags(searchResult.repo_name, 5)
      const bestTag = getBestTag(tags)

      const template: TemplateWithVerification = {
        id: `external-${searchResult.repo_name.replace('/', '-')}`,
        name: searchResult.repo_name,
        displayName: this.formatDisplayName(searchResult.repo_name),
        description: imageInfo.description || searchResult.short_description || 'External Docker image',
        baseImage: searchResult.repo_name,
        dynamicVersion: bestTag,
        category: this.guessCategory(searchResult.repo_name, imageInfo.description),
        iconKey: this.guessIconKey(searchResult.repo_name),
        defaultPort: this.guessDefaultPort(searchResult.repo_name),
        documentation: `https://hub.docker.com/r/${searchResult.repo_name}`,
        tags: this.extractTags(searchResult.repo_name, imageInfo.description),
        popular: imageInfo.star_count > 100,
        complexity: 'intermediate' as const,
        verificationLevel: searchResult.is_official ? 'official' : 'external',
        isExternal: true,
        pullCount: imageInfo.pull_count,
        starCount: imageInfo.star_count,
        dockerInfo: imageInfo
      }

      // Cache external template
      this.externalTemplates.set(template.id, template)
      return template
    } catch (error) {
      console.warn('Failed to convert search result:', error)
      return null
    }
  }

  // Helper methods for external template creation
  private formatDisplayName(repoName: string): string {
    const name = repoName.split('/').pop() || repoName
    return name.charAt(0).toUpperCase() + name.slice(1).replace(/[-_]/g, ' ')
  }

  private guessCategory(repoName: string, description = ''): string {
    const categoryMap = {
      database: ['postgres', 'mysql', 'mongo', 'redis', 'elastic', 'influx', 'cassandra'],
      web: ['nginx', 'apache', 'httpd', 'caddy', 'traefik'],
      development: ['node', 'python', 'java', 'golang', 'php', 'ruby'],
      monitoring: ['grafana', 'prometheus', 'jaeger', 'kibana'],
      message: ['rabbitmq', 'kafka', 'nats', 'activemq'],
      cache: ['redis', 'memcached', 'hazelcast'],
      storage: ['minio', 'nextcloud', 'seafile']
    }

    const text = `${repoName} ${description}`.toLowerCase()
    
    for (const [category, keywords] of Object.entries(categoryMap)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        return category
      }
    }
    
    return 'development'
  }

  private guessIconKey(repoName: string): string {
    const iconMap = {
      postgres: 'postgresql',
      mysql: 'mysql',
      mongo: 'mongodb',
      redis: 'redis',
      nginx: 'nginx',
      node: 'nodedotjs',
      python: 'python',
      java: 'java',
      rabbitmq: 'rabbitmq',
      elastic: 'elasticsearch'
    }

    const name = repoName.toLowerCase()
    for (const [key, icon] of Object.entries(iconMap)) {
      if (name.includes(key)) {
        return icon
      }
    }
    
    return 'docker'
  }

  private guessDefaultPort(repoName: string): number {
    const portMap: Record<string, number> = {
      postgres: 5432,
      mysql: 3306,
      mongo: 27017,
      redis: 6379,
      nginx: 80,
      apache: 80,
      node: 3000,
      elastic: 9200,
      rabbitmq: 5672,
      kafka: 9092
    }

    const name = repoName.toLowerCase()
    for (const [key, port] of Object.entries(portMap)) {
      if (name.includes(key)) {
        return port
      }
    }
    
    return 8080
  }

  private extractTags(repoName: string, description = ''): string[] {
    const text = `${repoName} ${description}`.toLowerCase()
    const commonTags = [
      'database', 'web', 'api', 'server', 'cache', 'queue', 'monitoring',
      'analytics', 'storage', 'security', 'development', 'runtime'
    ]
    
    return commonTags.filter(tag => text.includes(tag))
  }

  // Get template with dynamic version resolution
  async getTemplateWithVersion(templateId: string): Promise<TemplateWithVerification | null> {
    const template = this.templates.get(templateId) || this.externalTemplates.get(templateId)
    if (!template) return null

    // For external templates or if not cached, fetch latest version
    if (template.isExternal || !template.dynamicVersion) {
      try {
        const tags = await getImageTags(template.baseImage, 10)
        const bestTag = getBestTag(tags)
        template.dynamicVersion = bestTag
        template.lastUpdated = new Date().toISOString()
      } catch (error) {
        console.warn(`Failed to fetch version for ${template.baseImage}:`, error)
        template.dynamicVersion = 'latest'
      }
    }

    return template
  }

  // Get template statistics
  getTemplateStats() {
    const coreCount = this.templates.size
    const externalCount = this.externalTemplates.size
    const verificationLevels = {
      official: 0,
      verified: 0,
      community: 0,
      external: externalCount
    }

    this.templates.forEach(template => {
      verificationLevels[template.verificationLevel]++
    })

    return {
      total: coreCount + externalCount,
      core: coreCount,
      external: externalCount,
      verificationLevels
    }
  }
}

// Singleton instance
export const templateService = new TemplateService()
export default templateService