// Docker image utilities

export interface ParsedImage {
  registry?: string
  namespace?: string
  repository: string
  tag: string
  digest?: string
}

// Parse Docker image string into components
export function parseDockerImage(imageString: string): ParsedImage {
  // Handle digest format: image@sha256:...
  const [imageWithoutDigest, digest] = imageString.split('@')
  
  // Handle tag format: image:tag
  const [imagePath, tag = 'latest'] = imageWithoutDigest.split(':')
  
  // Handle registry/namespace/repo format
  const parts = imagePath.split('/')
  
  let registry: string | undefined
  let namespace: string | undefined
  let repository: string
  
  if (parts.length === 1) {
    // Simple case: just "redis"
    repository = parts[0]
  } else if (parts.length === 2) {
    // Could be "library/redis" or "myregistry.com/redis"
    if (parts[0].includes('.') || parts[0].includes(':')) {
      // Registry format
      registry = parts[0]
      repository = parts[1]
    } else {
      // Namespace format
      namespace = parts[0]
      repository = parts[1]
    }
  } else if (parts.length >= 3) {
    // Registry/namespace/repo format
    registry = parts[0]
    namespace = parts[1]
    repository = parts.slice(2).join('/')
  } else {
    repository = imagePath
  }
  
  return {
    registry,
    namespace,
    repository,
    tag,
    digest
  }
}

// Get display name for service (without registry/namespace)
export function getServiceDisplayName(imageString: string): string {
  const parsed = parseDockerImage(imageString)
  return parsed.repository
}

// Get image tag (version)
export function getImageTag(imageString: string): string {
  const parsed = parseDockerImage(imageString)
  return parsed.tag
}

// Get short image name for display
export function getShortImageName(imageString: string): string {
  const parsed = parseDockerImage(imageString)
  const parts = [parsed.repository]
  
  if (parsed.tag !== 'latest') {
    parts.push(parsed.tag)
  }
  
  return parts.join(':')
}

// Check if tag is a version number
export function isVersionTag(tag: string): boolean {
  return /^\d+(\.\d+)*/.test(tag)
}

// Get tag category for styling
export function getTagCategory(tag: string): 'version' | 'latest' | 'branch' | 'other' {
  if (tag === 'latest') return 'latest'
  if (isVersionTag(tag)) return 'version'
  if (['main', 'master', 'dev', 'develop', 'staging', 'prod', 'production'].includes(tag.toLowerCase())) {
    return 'branch'
  }
  return 'other'
}

// Format port for display
export function formatPort(port: { host: number; container: number }): string {
  if (port.host === port.container) {
    return port.host.toString()
  }
  return `${port.host}→${port.container}`
}

// Get common port descriptions
export function getPortDescription(port: number): string | null {
  const commonPorts: Record<number, string> = {
    80: 'HTTP',
    443: 'HTTPS', 
    3000: 'Dev Server',
    3306: 'MySQL',
    5432: 'PostgreSQL',
    6379: 'Redis',
    27017: 'MongoDB',
    8080: 'HTTP Alt',
    8443: 'HTTPS Alt',
    9200: 'Elasticsearch',
    5672: 'RabbitMQ',
    15672: 'RabbitMQ Mgmt'
  }
  
  return commonPorts[port] || null
}

// Format time for display (human readable)
export function formatTime(timeString: string): string {
  const date = new Date(timeString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  // If within the last hour, show relative time
  if (diffMinutes < 60) {
    if (diffMinutes < 1) {
      return 'Just now'
    }
    return `${diffMinutes}m ago`
  }

  // If within the last day, show hours
  if (diffHours < 24) {
    return `${diffHours}h ago`
  }

  // If within the last week, show days
  if (diffDays < 7) {
    return `${diffDays}d ago`
  }

  // Otherwise, show the date
  return date.toLocaleDateString()
}