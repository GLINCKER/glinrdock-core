import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import { Routes } from '../pages/Routes'
import { RoutesTab } from '../pages/Services/RoutesTab'
import { apiClient } from '../api'
import { HealthBadge } from '../components/ui/HealthBadge'

// Mock the API client
vi.mock('../api', () => ({
  apiClient: {
    getAuthInfo: vi.fn(),
    listRoutes: vi.fn(),
    getProjects: vi.fn(),
    getProjectServices: vi.fn(),
    listServiceRoutes: vi.fn(),
    checkRouteHealth: vi.fn(),
    deleteRoute: vi.fn(),
    nginxReload: vi.fn()
  },
  useApiData: vi.fn()
}))

// Mock RBAC
vi.mock('../rbac', () => ({
  isAdminSync: vi.fn()
}))

// Mock components
vi.mock('../components/ui', () => ({
  LoadingSpinner: ({ size }: { size: string }) => <div data-testid={`loading-spinner-${size}`}>Loading...</div>,
  Toast: ({ message, isVisible }: { message: string; isVisible: boolean }) =>
    isVisible ? <div data-testid="toast">{message}</div> : null,
  HealthBadge: ({ status, lastChecked, size }: { status?: 'OK' | 'FAIL'; lastChecked?: string; size?: string }) => (
    <span data-testid="health-badge" data-status={status} data-last-checked={lastChecked} data-size={size}>
      {status || '—'}
    </span>
  )
}))

vi.mock('../components', () => ({
  CreateRouteModal: () => <div data-testid="create-route-modal">Create Route Modal</div>,
  ConfirmModal: () => <div data-testid="confirm-modal">Confirm Modal</div>
}))

describe('Route Health Indicators', () => {
  const mockUseApiData = vi.fn()
  const mockIsAdminSync = vi.fn()
  
  const mockRoutes = [
    {
      id: 1,
      service_id: 1,
      domain: 'healthy.test.com',
      path: '/',
      port: 80,
      tls: true,
      created_at: '2023-01-01T00:00:00Z',
      last_status: 'OK' as const,
      last_check_at: '2023-01-01T12:00:00Z'
    },
    {
      id: 2,
      service_id: 1,
      domain: 'failing.test.com',
      path: '/api',
      port: 8080,
      tls: false,
      created_at: '2023-01-02T00:00:00Z',
      last_status: 'FAIL' as const,
      last_check_at: '2023-01-02T12:00:00Z'
    },
    {
      id: 3,
      service_id: 2,
      domain: 'unchecked.test.com',
      path: '/',
      port: 3000,
      tls: false,
      created_at: '2023-01-03T00:00:00Z'
      // No health status - should show "—"
    }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    mockUseApiData
      .mockReturnValueOnce({ data: { role: 'admin' }, loading: false }) // authInfo
      .mockReturnValueOnce({ data: mockRoutes, loading: false, refetch: vi.fn() }) // routes
      .mockReturnValueOnce({ data: [], loading: false }) // projects

    const { useApiData } = require('../api')
    vi.mocked(useApiData).mockImplementation(mockUseApiData)

    const { isAdminSync } = require('../rbac')
    vi.mocked(isAdminSync).mockImplementation(mockIsAdminSync)
    
    vi.mocked(apiClient.getProjectServices).mockResolvedValue([
      { id: '1', name: 'test-service', port: 80, project_name: 'Test Project' }
    ])
  })

  describe('HealthBadge Component', () => {
    it('should render OK status with green styling', () => {
      render(<HealthBadge status="OK" lastChecked="2023-01-01T12:00:00Z" />)
      
      const badge = screen.getByTestId('health-badge')
      expect(badge).toHaveAttribute('data-status', 'OK')
      expect(badge).toHaveTextContent('OK')
    })

    it('should render FAIL status with red styling', () => {
      render(<HealthBadge status="FAIL" lastChecked="2023-01-01T12:00:00Z" />)
      
      const badge = screen.getByTestId('health-badge')
      expect(badge).toHaveAttribute('data-status', 'FAIL')
      expect(badge).toHaveTextContent('FAIL')
    })

    it('should render unknown status with gray styling', () => {
      render(<HealthBadge />)
      
      const badge = screen.getByTestId('health-badge')
      expect(badge).toHaveAttribute('data-status', '')
      expect(badge).toHaveTextContent('—')
    })

    it('should include timestamp in data attributes', () => {
      const timestamp = '2023-01-01T12:00:00Z'
      render(<HealthBadge status="OK" lastChecked={timestamp} />)
      
      const badge = screen.getByTestId('health-badge')
      expect(badge).toHaveAttribute('data-last-checked', timestamp)
    })
  })

  describe('Routes Index Health Checks', () => {
    it('should display health badges for all routes', async () => {
      render(<Routes />)

      await waitFor(() => {
        const badges = screen.getAllByTestId('health-badge')
        expect(badges).toHaveLength(3)
        
        // Check specific statuses
        expect(badges[0]).toHaveAttribute('data-status', 'OK')
        expect(badges[1]).toHaveAttribute('data-status', 'FAIL') 
        expect(badges[2]).toHaveAttribute('data-status', '')
      })
    })

    it('should show health check buttons for each route', async () => {
      render(<Routes />)

      await waitFor(() => {
        const checkButtons = screen.getAllByTitle('Check route health')
        expect(checkButtons).toHaveLength(3)
      })
    })

    it('should trigger health check when button is clicked', async () => {
      vi.mocked(apiClient.checkRouteHealth).mockResolvedValue({
        status: 'OK',
        checked_at: '2023-01-01T13:00:00Z'
      })

      render(<Routes />)

      await waitFor(() => {
        const checkButtons = screen.getAllByTitle('Check route health')
        fireEvent.click(checkButtons[0])
      })

      expect(apiClient.checkRouteHealth).toHaveBeenCalledWith('1')
    })

    it('should show loading state during health check', async () => {
      // Mock slow health check
      vi.mocked(apiClient.checkRouteHealth).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          status: 'OK',
          checked_at: '2023-01-01T13:00:00Z'
        }), 100))
      )

      render(<Routes />)

      await waitFor(() => {
        const checkButton = screen.getAllByTitle('Check route health')[0]
        fireEvent.click(checkButton)
        
        // Button should show loading indicator
        expect(checkButton).toHaveTextContent('⟳')
        expect(checkButton).toBeDisabled()
      })
    })

    it('should handle health check errors gracefully', async () => {
      vi.mocked(apiClient.checkRouteHealth).mockRejectedValue(new Error('Network timeout'))

      render(<Routes />)

      await waitFor(() => {
        const checkButton = screen.getAllByTitle('Check route health')[0]
        fireEvent.click(checkButton)
      })

      await waitFor(() => {
        expect(screen.getByTestId('toast')).toHaveTextContent('Network timeout')
      })
    })

    it('should prevent multiple simultaneous checks on same route', async () => {
      vi.mocked(apiClient.checkRouteHealth).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          status: 'OK',
          checked_at: '2023-01-01T13:00:00Z'
        }), 100))
      )

      render(<Routes />)

      await waitFor(() => {
        const checkButton = screen.getAllByTitle('Check route health')[0]
        
        // Click multiple times quickly
        fireEvent.click(checkButton)
        fireEvent.click(checkButton)
        fireEvent.click(checkButton)
        
        // Should only call API once
        expect(apiClient.checkRouteHealth).toHaveBeenCalledTimes(1)
      })
    })
  })

  describe('Service Routes Tab Health Checks', () => {
    it('should display health badges in service routes', async () => {
      mockUseApiData
        .mockReset()
        .mockReturnValue({ data: mockRoutes.slice(0, 2), loading: false, refetch: vi.fn() })

      render(<RoutesTab serviceId="1" serviceName="test-service" />)

      await waitFor(() => {
        const badges = screen.getAllByTestId('health-badge')
        expect(badges).toHaveLength(2)
        
        expect(badges[0]).toHaveAttribute('data-status', 'OK')
        expect(badges[1]).toHaveAttribute('data-status', 'FAIL')
      })
    })

    it('should show health check buttons with search icons', async () => {
      mockUseApiData
        .mockReset()
        .mockReturnValue({ data: mockRoutes.slice(0, 1), loading: false, refetch: vi.fn() })

      render(<RoutesTab serviceId="1" serviceName="test-service" />)

      await waitFor(() => {
        const checkButton = screen.getByTitle('Check route health')
        expect(checkButton).toBeInTheDocument()
      })
    })

    it('should trigger health check for service routes', async () => {
      const mockRefetch = vi.fn()
      mockUseApiData
        .mockReset()
        .mockReturnValue({ data: mockRoutes.slice(0, 1), loading: false, refetch: mockRefetch })

      vi.mocked(apiClient.checkRouteHealth).mockResolvedValue({
        status: 'OK',
        checked_at: '2023-01-01T14:00:00Z'
      })

      render(<RoutesTab serviceId="1" serviceName="test-service" />)

      await waitFor(() => {
        const checkButton = screen.getByTitle('Check route health')
        fireEvent.click(checkButton)
      })

      await waitFor(() => {
        expect(apiClient.checkRouteHealth).toHaveBeenCalledWith('1')
        expect(mockRefetch).toHaveBeenCalled()
      })
    })

    it('should show spinning icon during service route check', async () => {
      mockUseApiData
        .mockReset()
        .mockReturnValue({ data: mockRoutes.slice(0, 1), loading: false, refetch: vi.fn() })

      vi.mocked(apiClient.checkRouteHealth).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({
          status: 'OK',
          checked_at: '2023-01-01T14:00:00Z'
        }), 100))
      )

      render(<RoutesTab serviceId="1" serviceName="test-service" />)

      await waitFor(() => {
        const checkButton = screen.getByTitle('Check route health')
        fireEvent.click(checkButton)
        
        // Should show spinning indicator
        const spinner = screen.getByText('⟳')
        expect(spinner).toHaveClass('animate-spin')
      })
    })
  })

  describe('Health Check API Integration', () => {
    it('should use HEAD method with 1 second timeout', async () => {
      // Test the actual API method
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200
      })
      global.fetch = mockFetch

      const result = await apiClient.checkRouteHealth('123')

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/v1/routes/123/check',
        expect.objectContaining({
          method: 'HEAD',
          signal: expect.any(AbortSignal)
        })
      )
      
      expect(result.status).toBe('OK')
      expect(result.checked_at).toBeDefined()
    })

    it('should return FAIL for non-200 responses', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      })
      global.fetch = mockFetch

      const result = await apiClient.checkRouteHealth('123')
      
      expect(result.status).toBe('FAIL')
    })

    it('should return FAIL for network errors', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'))
      global.fetch = mockFetch

      const result = await apiClient.checkRouteHealth('123')
      
      expect(result.status).toBe('FAIL')
    })

    it('should return FAIL for timeout errors', async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error('The operation was aborted'))
      global.fetch = mockFetch

      const result = await apiClient.checkRouteHealth('123')
      
      expect(result.status).toBe('FAIL')
    })
  })

  describe('Health Status Updates', () => {
    it('should update route status after successful check', async () => {
      vi.mocked(apiClient.checkRouteHealth).mockResolvedValue({
        status: 'OK',
        checked_at: '2023-01-01T15:00:00Z'
      })

      const mockRefetch = vi.fn()
      mockUseApiData
        .mockReset()
        .mockReturnValueOnce({ data: { role: 'admin' }, loading: false })
        .mockReturnValueOnce({ data: mockRoutes, loading: false, refetch: mockRefetch })
        .mockReturnValueOnce({ data: [], loading: false })

      render(<Routes />)

      await waitFor(() => {
        const checkButton = screen.getAllByTitle('Check route health')[2] // unchecked route
        fireEvent.click(checkButton)
      })

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled()
      })
    })

    it('should not update status if check fails', async () => {
      vi.mocked(apiClient.checkRouteHealth).mockRejectedValue(new Error('Check failed'))

      const mockRefetch = vi.fn()
      mockUseApiData
        .mockReset()
        .mockReturnValueOnce({ data: { role: 'admin' }, loading: false })
        .mockReturnValueOnce({ data: mockRoutes, loading: false, refetch: mockRefetch })
        .mockReturnValueOnce({ data: [], loading: false })

      render(<Routes />)

      await waitFor(() => {
        const checkButton = screen.getAllByTitle('Check route health')[0]
        fireEvent.click(checkButton)
      })

      await waitFor(() => {
        // Should show error message
        expect(screen.getByTestId('toast')).toHaveTextContent('Check failed')
        // Should still refetch to be safe
        expect(mockRefetch).not.toHaveBeenCalled()
      })
    })
  })

  describe('Accessibility and UX', () => {
    it('should have proper ARIA labels and titles', async () => {
      render(<Routes />)

      await waitFor(() => {
        const checkButtons = screen.getAllByTitle('Check route health')
        checkButtons.forEach(button => {
          expect(button).toHaveAttribute('title', 'Check route health')
        })
      })
    })

    it('should disable check buttons during loading', async () => {
      vi.mocked(apiClient.checkRouteHealth).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      render(<Routes />)

      await waitFor(() => {
        const checkButton = screen.getAllByTitle('Check route health')[0]
        fireEvent.click(checkButton)
        
        expect(checkButton).toBeDisabled()
      })
    })

    it('should provide visual feedback for different health states', async () => {
      render(<Routes />)

      await waitFor(() => {
        const badges = screen.getAllByTestId('health-badge')
        
        // OK status should have green indicator
        expect(badges[0]).toHaveAttribute('data-status', 'OK')
        
        // FAIL status should have red indicator
        expect(badges[1]).toHaveAttribute('data-status', 'FAIL')
        
        // Unknown status should have neutral indicator
        expect(badges[2]).toHaveAttribute('data-status', '')
      })
    })
  })
})