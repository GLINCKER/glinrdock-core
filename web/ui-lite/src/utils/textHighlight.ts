// Text highlighting utilities for search results

export function highlightMatchingText(text: string, query: string): string {
  if (!query.trim() || !text) return text
  
  const queryTerms = query.toLowerCase().split(/\s+/).filter(term => term.length > 0)
  let highlightedText = text
  
  // Sort terms by length (longest first) to avoid partial highlighting issues
  const sortedTerms = queryTerms.sort((a, b) => b.length - a.length)
  
  sortedTerms.forEach(term => {
    // Create case-insensitive regex for the term
    const regex = new RegExp(`(${escapeRegExp(term)})`, 'gi')
    highlightedText = highlightedText.replace(regex, '<mark class="bg-purple-200 dark:bg-purple-900/50 text-purple-900 dark:text-purple-200 px-1 rounded">$1</mark>')
  })
  
  return highlightedText
}

export function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function createHighlightComponent(text: string, query: string) {
  const highlightedHtml = highlightMatchingText(text, query)
  
  return {
    __html: highlightedHtml
  }
}