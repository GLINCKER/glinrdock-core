/**
 * Formats a timestamp into a human-readable "time ago" string
 * @param timestamp - ISO timestamp string
 * @returns Formatted time string (e.g., "2m ago", "3h ago", "2d ago")
 */
export function formatTimeAgo(timestamp: string): string {
  const now = new Date()
  const then = new Date(timestamp)
  const diffMs = now.getTime() - then.getTime()
  
  // Convert to different time units
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  const diffWeeks = Math.floor(diffDays / 7)
  const diffMonths = Math.floor(diffDays / 30)
  
  // Return appropriate format
  if (diffSecs < 60) {
    return diffSecs <= 1 ? 'just now' : `${diffSecs}s ago`
  } else if (diffMins < 60) {
    return `${diffMins}m ago`
  } else if (diffHours < 24) {
    return `${diffHours}h ago`
  } else if (diffDays < 7) {
    return `${diffDays}d ago`
  } else if (diffDays < 30) {
    return `${diffWeeks}w ago`
  } else {
    return `${diffMonths}mo ago`
  }
}

/**
 * Formats duration in hours to a readable format
 * @param hours - Duration in hours
 * @returns Formatted duration string
 */
export function formatDuration(hours: number): string {
  if (hours < 1) {
    const minutes = Math.round(hours * 60)
    return `${minutes}min`
  } else if (hours < 24) {
    return `${hours.toFixed(1)}h`
  } else {
    const days = Math.floor(hours / 24)
    const remainingHours = Math.round(hours % 24)
    if (remainingHours === 0) {
      return `${days}d`
    }
    return `${days}d ${remainingHours}h`
  }
}