/**
 * API Tests for Projects endpoints
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiClient } from '../api'

// Mock fetch globally
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(() => 'test-token'),
  setItem: vi.fn(),
  removeItem: vi.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
})

describe('Projects API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiClient.setToken('test-token')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getProjects', () => {
    it('fetches projects successfully', async () => {
      const mockProjects = [
        { id: 1, name: 'project1', created_at: '2024-01-01T00:00:00Z' },
        { id: 2, name: 'project2', created_at: '2024-01-02T00:00:00Z' }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ projects: mockProjects }),
        text: () => Promise.resolve(JSON.stringify({ projects: mockProjects }))
      })

      const result = await apiClient.getProjects()

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/projects',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          })
        })
      )
      expect(result).toEqual(mockProjects)
    })

    it('returns empty array when projects is null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ projects: null }),
        text: () => Promise.resolve(JSON.stringify({ projects: null }))
      })

      const result = await apiClient.getProjects()
      expect(result).toEqual([])
    })

    it('handles network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(apiClient.getProjects()).rejects.toThrow('Network request failed')
    })

    it('handles 404 responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ error: 'Not found' }),
        text: () => Promise.resolve(JSON.stringify({ error: 'Not found' }))
      })

      await expect(apiClient.getProjects()).rejects.toThrow('Not found')
    })
  })

  describe('createProject', () => {
    it('creates project successfully', async () => {
      const newProject = { name: 'test-project', description: 'test desc' }
      const createdProject = { id: 3, name: 'test-project', created_at: '2024-01-03T00:00:00Z' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: () => Promise.resolve(createdProject),
        text: () => Promise.resolve(JSON.stringify(createdProject))
      })

      const result = await apiClient.createProject(newProject)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/projects',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          }),
          body: JSON.stringify(newProject)
        })
      )
      expect(result).toEqual(createdProject)
    })

    it('handles validation errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: 'Project name is required' }),
        text: () => Promise.resolve(JSON.stringify({ error: 'Project name is required' }))
      })

      await expect(apiClient.createProject({ name: '', description: '' }))
        .rejects.toThrow('Project name is required')
    })

    it('handles quota exceeded errors', async () => {
      const quotaError = {
        error: 'quota_exceeded',
        limit: 3,
        plan: 'FREE',
        upgrade_hint: 'Upgrade to PRO for more projects'
      }

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: () => Promise.resolve(quotaError),
        text: () => Promise.resolve(JSON.stringify(quotaError))
      })

      try {
        await apiClient.createProject({ name: 'test' })
      } catch (error: any) {
        expect(error.error).toBe('quota_exceeded')
        expect(error.limit).toBe(3)
        expect(error.plan).toBe('FREE')
      }
    })
  })

  describe('getProject', () => {
    it('fetches single project successfully', async () => {
      const mockProject = { id: 1, name: 'project1', created_at: '2024-01-01T00:00:00Z' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockProject),
        text: () => Promise.resolve(JSON.stringify(mockProject))
      })

      const result = await apiClient.getProject('1')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/projects/1',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      )
      expect(result).toEqual(mockProject)
    })

    it('handles project not found', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'project not found: 999' }),
        text: () => Promise.resolve(JSON.stringify({ error: 'project not found: 999' }))
      })

      await expect(apiClient.getProject('999'))
        .rejects.toThrow('project not found: 999')
    })
  })

  describe('deleteProject', () => {
    it('deletes project successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ message: 'project deleted successfully' }),
        text: () => Promise.resolve(JSON.stringify({ message: 'project deleted successfully' }))
      })

      await apiClient.deleteProject('1')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/projects/1',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      )
    })

    it('handles delete errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: 'project not found: 999' }),
        text: () => Promise.resolve(JSON.stringify({ error: 'project not found: 999' }))
      })

      await expect(apiClient.deleteProject('999'))
        .rejects.toThrow('project not found: 999')
    })
  })

  describe('authentication', () => {
    it('handles 401 responses by clearing token', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized'
      })

      await expect(apiClient.getProjects()).rejects.toThrow('Authentication failed')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('glinrdock_token')
    })

    it('includes Authorization header when token is set', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ projects: [] }),
        text: () => Promise.resolve(JSON.stringify({ projects: [] }))
      })

      await apiClient.getProjects()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      )
    })

    it('works without token for unauthenticated requests', async () => {
      apiClient.clearToken()
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ projects: [] }),
        text: () => Promise.resolve(JSON.stringify({ projects: [] }))
      })

      await apiClient.getProjects()

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String)
          })
        })
      )
    })
  })
})