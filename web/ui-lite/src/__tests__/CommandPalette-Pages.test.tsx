import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { CommandPalette } from '../components/ui/CommandPalette'
import { apiClient } from '../api'

// Mock the API client
vi.mock('../api', () => ({
  apiClient: {
    search: vi.fn(),
    suggest: vi.fn(),
    getSearchStatus: vi.fn().mockResolvedValue({ fts5: true }),
  }
}))

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
}
global.localStorage = mockLocalStorage as any

describe('CommandPalette - Pages Integration', () => {
  const mockOnClose = vi.fn()
  
  beforeEach(() => {
    vi.clearAllMocks()
    mockLocalStorage.getItem.mockReturnValue(null)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('Backend Page Loading', () => {
    it('should load pages from backend when palette opens', async () => {
      const mockBackendPages = [
        {
          id: 1,
          type: 'page' as const,
          entity_id: 'dashboard',
          title: 'Dashboard',
          subtitle: 'System overview',
          url_path: '/app/',
          score: 1.0,
          content: 'dashboard overview'
        },
        {
          id: 2,
          type: 'page' as const,
          entity_id: 'projects',
          title: 'Projects',
          subtitle: 'Manage projects',
          url_path: '/app/projects',
          score: 1.0,
          content: 'projects management'
        }
      ]

      // Mock responses for multiple search terms
      vi.mocked(apiClient.search)
        .mockResolvedValueOnce({ hits: [mockBackendPages[0]], took_ms: 10, total: 1 }) // management
        .mockResolvedValueOnce({ hits: [mockBackendPages[1]], took_ms: 10, total: 1 }) // system  
        .mockResolvedValueOnce({ hits: [mockBackendPages[0]], took_ms: 10, total: 1 }) // dashboard (duplicate)
        .mockResolvedValueOnce({ hits: [mockBackendPages[1]], took_ms: 10, total: 1 }) // projects (duplicate)
        .mockResolvedValueOnce({ hits: [], took_ms: 10, total: 0 }) // logs

      render(<CommandPalette isOpen={true} onClose={mockOnClose} />)

      await waitFor(() => {
        expect(apiClient.search).toHaveBeenCalledWith('management', { type: 'page', limit: 10 })
        expect(apiClient.search).toHaveBeenCalledWith('system', { type: 'page', limit: 10 })
        expect(apiClient.search).toHaveBeenCalledWith('dashboard', { type: 'page', limit: 10 })
        expect(apiClient.search).toHaveBeenCalledWith('projects', { type: 'page', limit: 10 })
        expect(apiClient.search).toHaveBeenCalledWith('logs', { type: 'page', limit: 10 })
      })

      // Verify pages are cached for offline use
      await waitFor(() => {
        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'glinrdock_cached_pages',
          expect.stringContaining('pages')
        )
      })
    })

    it('should use cached pages when backend fails', async () => {
      const cachedPages = [
        {
          id: 1,
          type: 'page' as const,
          entity_id: 'cached-dashboard',
          title: 'Cached Dashboard',
          subtitle: 'From cache',
          url_path: '/app/',
          score: 1.0,
          content: 'cached dashboard'
        }
      ]

      // Mock backend failure
      vi.mocked(apiClient.search).mockRejectedValue(new Error('Network error'))
      
      // Mock cached data
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'glinrdock_cached_pages') {
          return JSON.stringify({
            pages: cachedPages,
            timestamp: Date.now() - 10 * 60 * 1000 // 10 minutes ago (fresh)
          })
        }
        return null
      })

      render(<CommandPalette isOpen={true} onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByText('Cached Dashboard')).toBeInTheDocument()
      })
    })

    it('should fall back to static pages when all else fails', async () => {
      // Mock backend failure
      vi.mocked(apiClient.search).mockRejectedValue(new Error('Network error'))
      
      // Mock no cached data
      mockLocalStorage.getItem.mockReturnValue(null)

      render(<CommandPalette isOpen={true} onClose={mockOnClose} />)

      await waitFor(() => {
        // Should show fallback pages (check for some expected ones)
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Projects')).toBeInTheDocument()
      })
    })

    it('should use expired cached pages as last resort', async () => {
      const expiredCachedPages = [
        {
          id: 1,
          type: 'page' as const,
          entity_id: 'old-dashboard',
          title: 'Old Dashboard',
          subtitle: 'Expired cache',
          url_path: '/app/',
          score: 1.0,
          content: 'old dashboard'
        }
      ]

      // Mock backend failure
      vi.mocked(apiClient.search).mockRejectedValue(new Error('Network error'))
      
      // Mock expired cached data (2 hours old)
      mockLocalStorage.getItem.mockImplementation((key) => {
        if (key === 'glinrdock_cached_pages') {
          return JSON.stringify({
            pages: expiredCachedPages,
            timestamp: Date.now() - 2 * 60 * 60 * 1000 // 2 hours ago (expired)
          })
        }
        return null
      })

      render(<CommandPalette isOpen={true} onClose={mockOnClose} />)

      await waitFor(() => {
        // Should fall back to static pages, not use expired cache
        expect(screen.queryByText('Old Dashboard')).not.toBeInTheDocument()
        expect(screen.getByText('Dashboard')).toBeInTheDocument() // fallback
      })
    })
  })

  describe('Pages Category Filtering', () => {
    it('should show only backend pages in Pages category when loaded', async () => {
      const mockBackendPage = {
        id: 1,
        type: 'page' as const,
        entity_id: 'backend-dashboard',
        title: 'Backend Dashboard',
        subtitle: 'From backend',
        url_path: '/app/',
        score: 1.0,
        content: 'backend dashboard'
      }

      // Mock responses for multiple search terms - return the same page for first search
      vi.mocked(apiClient.search)
        .mockResolvedValueOnce({ hits: [mockBackendPage], took_ms: 10, total: 1 }) // management
        .mockResolvedValueOnce({ hits: [], took_ms: 10, total: 0 }) // system  
        .mockResolvedValueOnce({ hits: [], took_ms: 10, total: 0 }) // dashboard
        .mockResolvedValueOnce({ hits: [], took_ms: 10, total: 0 }) // projects
        .mockResolvedValueOnce({ hits: [], took_ms: 10, total: 0 }) // logs

      render(<CommandPalette isOpen={true} onClose={mockOnClose} />)

      // Wait for backend pages to load
      await waitFor(() => {
        expect(apiClient.search).toHaveBeenCalledWith('management', { type: 'page', limit: 10 })
      })

      // Click on Pages category
      const pagesCategory = screen.getByText('Pages')
      fireEvent.click(pagesCategory)

      await waitFor(() => {
        expect(screen.getByText('Backend Dashboard')).toBeInTheDocument()
      })
    })

    it('should search within pages when query is provided', async () => {
      const mockSearchResults = [
        {
          id: 1,
          type: 'page' as const,
          entity_id: 'search-result',
          title: 'Search Result Page',
          subtitle: 'Found via search',
          url_path: '/app/search',
          score: 0.8,
          content: 'search result page'
        }
      ]

      vi.mocked(apiClient.search)
        .mockResolvedValueOnce({ hits: [], took_ms: 10, total: 0 }) // Initial page load
        .mockResolvedValueOnce({ hits: mockSearchResults, took_ms: 10, total: 1 }) // Search query

      render(<CommandPalette isOpen={true} onClose={mockOnClose} />)

      // Type search query
      const searchInput = screen.getByPlaceholderText(/search/i)
      fireEvent.input(searchInput, { target: { value: 'search' } })

      await waitFor(() => {
        expect(screen.getByText('Search Result Page')).toBeInTheDocument()
      })
    })
  })

  describe('Navigation', () => {
    it('should navigate to page URL when page is selected', async () => {
      const mockPage = {
        id: 1,
        type: 'page' as const,
        entity_id: 'test-page',
        title: 'Test Page',
        subtitle: 'Test',
        url_path: '/app/test',
        score: 1.0,
        content: 'test page'
      }

      vi.mocked(apiClient.search).mockResolvedValue({
        hits: [mockPage],
        took_ms: 10,
        total: 1
      })

      // Mock window.location
      const mockLocation = { href: '' }
      Object.defineProperty(window, 'location', {
        value: mockLocation,
        writable: true
      })

      render(<CommandPalette isOpen={true} onClose={mockOnClose} />)

      await waitFor(() => {
        const pageButton = screen.getByText('Test Page')
        fireEvent.click(pageButton)
      })

      expect(mockLocation.href).toBe('/app/test')
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('Offline/Online Behavior', () => {
    it('should gracefully handle network errors and show fallback', async () => {
      // Simulate network failure
      vi.mocked(apiClient.search).mockRejectedValue(new Error('Failed to fetch'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      render(<CommandPalette isOpen={true} onClose={mockOnClose} />)

      await waitFor(() => {
        // Should show fallback pages despite network error
        expect(screen.getByText('Dashboard')).toBeInTheDocument()
        expect(screen.getByText('Projects')).toBeInTheDocument()
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to load pages from backend'),
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it('should not make duplicate requests when already loaded', async () => {
      const mockPage = { id: 1, type: 'page' as const, entity_id: 'test', title: 'Test', subtitle: 'Test', url_path: '/app/test', score: 1.0, content: 'test' }
      
      // Mock responses for the initial 5 search terms
      vi.mocked(apiClient.search)
        .mockResolvedValueOnce({ hits: [mockPage], took_ms: 10, total: 1 }) // management
        .mockResolvedValueOnce({ hits: [], took_ms: 10, total: 0 }) // system  
        .mockResolvedValueOnce({ hits: [], took_ms: 10, total: 0 }) // dashboard
        .mockResolvedValueOnce({ hits: [], took_ms: 10, total: 0 }) // projects
        .mockResolvedValueOnce({ hits: [], took_ms: 10, total: 0 }) // logs

      const { rerender } = render(<CommandPalette isOpen={true} onClose={mockOnClose} />)

      await waitFor(() => {
        expect(apiClient.search).toHaveBeenCalledTimes(5)
      })

      // Close and reopen palette
      rerender(<CommandPalette isOpen={false} onClose={mockOnClose} />)
      rerender(<CommandPalette isOpen={true} onClose={mockOnClose} />)

      // Should not make additional requests since pages are already loaded
      expect(apiClient.search).toHaveBeenCalledTimes(5)
    })
  })
})