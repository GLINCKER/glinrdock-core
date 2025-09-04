import { describe, it, expect, vi, beforeEach } from 'vitest'
import { apiClient, NotFoundError } from '../api'

// Mock fetch globally
global.fetch = vi.fn()

const mockFetch = vi.mocked(fetch)

describe('API Client - getService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Success Cases', () => {
    it('parses service detail response correctly', async () => {
      const mockServiceData = {
        id: 123,
        project_id: 1,
        name: 'test-service',
        description: 'A test service',
        image: 'nginx:latest',
        status: 'running',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T01:00:00Z',
        ports: [{ host: 8080, container: 80 }],
        volumes: [{ host: '/host/path', container: '/container/path', ro: false }],
        env_summary_count: 5,
        last_deploy_at: '2024-01-01T01:00:00Z',
        container_id: 'abc123def456',
        state_reason: null
      }

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockServiceData)
      } as Response)

      const result = await apiClient.getService('123')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/services/123',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      )

      expect(result).toEqual(mockServiceData)
    })

    it('handles service with minimal data', async () => {
      const minimalServiceData = {
        id: 456,
        project_id: 2,
        name: 'minimal-service',
        image: 'alpine:latest',
        status: 'stopped',
        created_at: '2024-01-01T00:00:00Z',
        ports: [],
        volumes: [],
        env_summary_count: 0
      }

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(minimalServiceData)
      } as Response)

      const result = await apiClient.getService('456')

      expect(result).toEqual(minimalServiceData)
      expect(result.description).toBeUndefined()
      expect(result.last_deploy_at).toBeUndefined()
      expect(result.container_id).toBeUndefined()
    })

    it('handles different service statuses', async () => {
      const statusTests = [
        'running', 'stopped', 'error', 'starting', 'stopping', 'created', 'paused', 'unknown'
      ]

      for (const status of statusTests) {
        const serviceData = {
          id: 789,
          project_id: 3,
          name: `${status}-service`,
          image: 'nginx:latest',
          status,
          created_at: '2024-01-01T00:00:00Z',
          ports: [],
          volumes: [],
          env_summary_count: 0
        }

        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          json: () => Promise.resolve(serviceData)
        } as Response)

        const result = await apiClient.getService('789')
        expect(result.status).toBe(status)
      }
    })
  })

  describe('Error Cases', () => {
    it('throws NotFoundError for 404 response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('{"error":"service not found"}')
      } as Response)

      await expect(apiClient.getService('999')).rejects.toThrow(NotFoundError)
      await expect(apiClient.getService('999')).rejects.toThrow('service not found')
    })

    it('throws NotFoundError with default message for 404 without body', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('')
      } as Response)

      await expect(apiClient.getService('999')).rejects.toThrow(NotFoundError)
      await expect(apiClient.getService('999')).rejects.toThrow('Resource not found')
    })

    it('handles malformed JSON in error response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('invalid json')
      } as Response)

      await expect(apiClient.getService('999')).rejects.toThrow(NotFoundError)
    })

    it('handles network errors', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'))

      await expect(apiClient.getService('123')).rejects.toThrow('Network error')
    })

    it('handles timeout errors', async () => {
      mockFetch.mockImplementation(() => new Promise((_, reject) => {
        setTimeout(() => {
          const error = new Error('AbortError')
          error.name = 'AbortError'
          reject(error)
        }, 100)
      }))

      await expect(apiClient.getService('123')).rejects.toThrow('Request timeout')
    })

    it('handles server errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('{"error":"internal server error"}')
      } as Response)

      await expect(apiClient.getService('123')).rejects.toThrow('internal server error')
    })

    it('handles invalid JSON response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('Unexpected token'))
      } as Response)

      await expect(apiClient.getService('123')).rejects.toThrow('Invalid JSON response')
    })
  })

  describe('Request Configuration', () => {
    it('includes authorization header when token is set', async () => {
      // Set a token
      apiClient.setToken('test-token')

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          id: 123,
          project_id: 1,
          name: 'test-service',
          image: 'nginx:latest',
          status: 'running',
          created_at: '2024-01-01T00:00:00Z',
          ports: [],
          volumes: [],
          env_summary_count: 0
        })
      } as Response)

      await apiClient.getService('123')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/services/123',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      )

      // Clean up
      apiClient.clearToken()
    })

    it('makes request without authorization header when no token', async () => {
      apiClient.clearToken()

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          id: 123,
          project_id: 1,
          name: 'test-service',
          image: 'nginx:latest',
          status: 'running',
          created_at: '2024-01-01T00:00:00Z',
          ports: [],
          volumes: [],
          env_summary_count: 0
        })
      } as Response)

      await apiClient.getService('123')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/services/123',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.any(String)
          })
        })
      )
    })

    it('uses correct HTTP method and URL', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          id: 123,
          project_id: 1,
          name: 'test-service',
          image: 'nginx:latest',
          status: 'running',
          created_at: '2024-01-01T00:00:00Z',
          ports: [],
          volumes: [],
          env_summary_count: 0
        })
      } as Response)

      await apiClient.getService('test-id-123')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/services/test-id-123',
        expect.objectContaining({
          method: 'GET'
        })
      )
    })

    it('handles special characters in service ID', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          id: 123,
          project_id: 1,
          name: 'test-service',
          image: 'nginx:latest',
          status: 'running',
          created_at: '2024-01-01T00:00:00Z',
          ports: [],
          volumes: [],
          env_summary_count: 0
        })
      } as Response)

      await apiClient.getService('service-with-dashes_and_underscores.123')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/services/service-with-dashes_and_underscores.123',
        expect.any(Object)
      )
    })
  })

  describe('Response Validation', () => {
    it('accepts service response with all required fields', async () => {
      const completeServiceData = {
        id: 123,
        project_id: 1,
        name: 'test-service',
        description: 'A comprehensive test service',
        image: 'nginx:1.21-alpine',
        status: 'running',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T01:00:00Z',
        ports: [
          { host: 8080, container: 80 },
          { host: 8443, container: 443 }
        ],
        volumes: [
          { host: '/host/data', container: '/var/www/html', ro: false },
          { host: '/host/config', container: '/etc/nginx/conf.d', ro: true }
        ],
        env_summary_count: 10,
        last_deploy_at: '2024-01-01T01:30:00Z',
        container_id: 'abcdef123456789',
        state_reason: 'Container is healthy'
      }

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(completeServiceData)
      } as Response)

      const result = await apiClient.getService('123')

      expect(result).toEqual(completeServiceData)
      expect(result.id).toBe(123)
      expect(result.ports).toHaveLength(2)
      expect(result.volumes).toHaveLength(2)
      expect(result.env_summary_count).toBe(10)
    })
  })
})