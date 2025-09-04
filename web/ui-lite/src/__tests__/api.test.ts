import { describe, it, expect, beforeEach, vi } from 'vitest'
import { isQuotaError, apiClient } from '../api'

// Mock fetch globally
global.fetch = vi.fn()

describe('API utilities', () => {
  describe('isQuotaError', () => {
    it('returns true for valid quota error object', () => {
      const quotaError = {
        error: 'quota_exceeded',
        limit: 5,
        plan: 'FREE',
        resource: 'tokens',
        message: 'Token quota exceeded'
      }

      expect(isQuotaError(quotaError)).toBe(true)
    })

    it('returns false for regular error object', () => {
      const regularError = {
        error: 'invalid_request',
        message: 'Invalid request'
      }

      expect(isQuotaError(regularError)).toBe(false)
    })

    it('returns false for error without limit property', () => {
      const errorWithoutLimit = {
        error: 'quota_exceeded',
        plan: 'FREE',
        message: 'Quota exceeded'
      }

      expect(isQuotaError(errorWithoutLimit)).toBe(false)
    })

    it('returns false for error without plan property', () => {
      const errorWithoutPlan = {
        error: 'quota_exceeded',
        limit: 5,
        message: 'Quota exceeded'
      }

      expect(isQuotaError(errorWithoutPlan)).toBe(false)
    })

    it('returns false for non-quota_exceeded error', () => {
      const nonQuotaError = {
        error: 'server_error',
        limit: 5,
        plan: 'FREE',
        message: 'Server error'
      }

      expect(isQuotaError(nonQuotaError)).toBe(false)
    })

    it('returns false for null or undefined', () => {
      expect(isQuotaError(null)).toBeFalsy()
      expect(isQuotaError(undefined)).toBeFalsy()
    })

    it('returns false for non-object values', () => {
      expect(isQuotaError('error')).toBe(false)
      expect(isQuotaError(123)).toBe(false)
      expect(isQuotaError(true)).toBe(false)
    })

    it('works with Error instances that have quota properties', () => {
      const error = new Error('Quota exceeded')
      ;(error as any).error = 'quota_exceeded'
      ;(error as any).limit = 3
      ;(error as any).plan = 'FREE'

      expect(isQuotaError(error)).toBe(true)
    })

    it('returns false for Error instances without quota properties', () => {
      const error = new Error('Regular error')
      
      expect(isQuotaError(error)).toBe(false)
    })
  })

  // TODO: Add comprehensive backup API tests when module import issues are resolved
  // Tests should cover:
  // - createBackup: successful backup creation and download
  // - restoreBackup: successful restore with file upload
  // - Error handling: authentication failures, server errors
  // - File format validation: .tar.gz acceptance
  // - Response handling: blob downloads and JSON responses
})

describe('Routes API', () => {
  const mockFetch = vi.mocked(global.fetch)
  
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock localStorage
    Object.defineProperty(window, 'localStorage', {
      value: {
        getItem: vi.fn(() => 'test-token'),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
      writable: true
    })
  })

  describe('listRoutes', () => {
    it('should fetch all routes successfully', async () => {
      const mockRoutes = [
        { id: 1, domain: 'test.com', service_id: 1, port: 80, tls: false, created_at: '2023-01-01' },
        { id: 2, domain: 'api.test.com', service_id: 2, port: 8080, tls: true, created_at: '2023-01-02' }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ routes: mockRoutes })
      } as Response)

      const result = await apiClient.listRoutes()

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/routes',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      )
      expect(result).toEqual(mockRoutes)
    })

    it('should return empty array when routes is null', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ routes: null })
      } as Response)

      const result = await apiClient.listRoutes()
      expect(result).toEqual([])
    })
  })

  describe('listServiceRoutes', () => {
    it('should fetch service routes successfully', async () => {
      const mockRoutes = [
        { id: 1, domain: 'service.test.com', service_id: 123, port: 80, tls: true, created_at: '2023-01-01' }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ routes: mockRoutes })
      } as Response)

      const result = await apiClient.listServiceRoutes('123')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/services/123/routes',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      )
      expect(result).toEqual(mockRoutes)
    })
  })

  describe('createRoute', () => {
    it('should create route successfully', async () => {
      const routeData = {
        domain: 'new.test.com',
        path: '/api',
        port: 8080,
        tls: true
      }

      const mockResponse = {
        id: 1,
        service_id: 123,
        ...routeData,
        created_at: '2023-01-01T00:00:00Z'
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response)

      const result = await apiClient.createRoute('123', routeData)

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/services/123/routes',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          }),
          body: JSON.stringify(routeData)
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should handle 4xx errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Domain already exists' })
      } as Response)

      await expect(apiClient.createRoute('123', {
        domain: 'test.com',
        port: 80,
        tls: false
      })).rejects.toThrow('Domain already exists')
    })

    it('should handle 5xx errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ error: 'Internal server error' })
      } as Response)

      await expect(apiClient.createRoute('123', {
        domain: 'test.com',
        port: 80,
        tls: false
      })).rejects.toThrow('Internal server error')
    })
  })

  describe('deleteRoute', () => {
    it('should delete route successfully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => ''
      } as Response)

      await apiClient.deleteRoute('123')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/routes/123',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token'
          })
        })
      )
    })

    it('should handle delete errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ error: 'Route not found' })
      } as Response)

      await expect(apiClient.deleteRoute('999')).rejects.toThrow('Route not found')
    })
  })

  describe('nginxReload', () => {
    it('should reload nginx successfully', async () => {
      const mockResponse = { message: 'Nginx reloaded successfully' }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response)

      const result = await apiClient.nginxReload()

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/system/nginx/reload',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token'
          })
        })
      )
      expect(result).toEqual(mockResponse)
    })

    it('should handle nginx reload errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Insufficient permissions' })
      } as Response)

      await expect(apiClient.nginxReload()).rejects.toThrow('Insufficient permissions')
    })

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      await expect(apiClient.nginxReload()).rejects.toThrow('Network error')
    })
  })
})