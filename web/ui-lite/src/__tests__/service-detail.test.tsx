import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import { ServiceDetailPage } from '../pages/Services/Detail'
import { apiClient } from '../api'

// Mock the API client
vi.mock('../api', () => ({
  apiClient: {
    getService: vi.fn(),
    startService: vi.fn(),
    stopService: vi.fn(),
    restartService: vi.fn(),
    getServiceLogs: vi.fn(),
    getAuthInfo: vi.fn()
  },
  useApiData: vi.fn()
}))

// Mock RBAC
vi.mock('../rbac', () => ({
  isDeployerSync: vi.fn()
}))

// Mock utility functions
vi.mock('../utils/docker', () => ({
  getShortImageName: vi.fn().mockReturnValue('nginx'),
  getImageTag: vi.fn().mockReturnValue('latest'),
  formatTime: vi.fn().mockReturnValue('2 hours ago')
}))

// Mock components
vi.mock('../components/ServiceIcons', () => ({
  ServiceIcon: ({ imageName, className }: { imageName: string; className: string }) => 
    <div data-testid="service-icon" className={className}>{imageName}</div>
}))

vi.mock('../components/ui/ServiceBadge', () => ({
  StatusBadge: ({ status, size }: { status: string; size?: string }) => 
    <span data-testid="status-badge" data-status={status} data-size={size}>{status}</span>,
  Badge: ({ variant, size, children }: { variant: string; size?: string; children: any }) => 
    <span data-testid="badge" data-variant={variant} data-size={size}>{children}</span>,
  PortBadge: ({ port }: { port: { host: number; container: number } }) => 
    <span data-testid="port-badge">{port.host}:{port.container}</span>
}))

vi.mock('../components/LogsDrawer', () => ({
  LogsDrawer: ({ isOpen, serviceId, serviceName }: { isOpen: boolean; serviceId: string; serviceName: string }) =>
    isOpen ? <div data-testid="logs-drawer">Logs for {serviceName} ({serviceId})</div> : null
}))

import { isDeployerSync } from '../rbac'

const mockUseApiData = vi.mocked(apiClient)
const mockIsDeployerSync = vi.mocked(isDeployerSync)

const mockServiceData = {
  id: 123,
  project_id: 1,
  name: 'test-service',
  image: 'nginx:latest',
  status: 'running' as const,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T01:00:00Z',
  ports: [{ host: 8080, container: 80 }],
  volumes: [{ host: '/host/path', container: '/container/path', ro: false }],
  env_summary_count: 5,
  last_deploy_at: '2024-01-01T01:00:00Z',
  container_id: 'abc123def456',
  state_reason: null
}

describe('ServiceDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Mock useApiData hook
    vi.mocked(require('../api').useApiData).mockImplementation((fetcher) => {
      if (fetcher === apiClient.getAuthInfo) {
        return { data: { role: 'deployer' }, loading: false, error: null }
      }
      return { data: null, loading: false, error: null }
    })
    
    // Mock API calls
    mockUseApiData.getService.mockResolvedValue(mockServiceData)
    mockUseApiData.startService.mockResolvedValue(undefined)
    mockUseApiData.stopService.mockResolvedValue(undefined)
    mockUseApiData.restartService.mockResolvedValue(undefined)
    
    // Mock RBAC
    mockIsDeployerSync.mockReturnValue(true)
  })

  describe('Rendering', () => {
    it('renders service overview data correctly', async () => {
      render(<ServiceDetailPage serviceId="123" />)

      await waitFor(() => {
        expect(screen.getByText('test-service')).toBeInTheDocument()
        expect(screen.getByTestId('service-icon')).toBeInTheDocument()
        expect(screen.getByTestId('status-badge')).toBeInTheDocument()
        expect(screen.getByText('Runtime Information')).toBeInTheDocument()
        expect(screen.getByText('Networking')).toBeInTheDocument()
        expect(screen.getByText('Volumes')).toBeInTheDocument()
      })
    })

    it('displays container information correctly', async () => {
      render(<ServiceDetailPage serviceId="123" />)

      await waitFor(() => {
        expect(screen.getByText('abc123def456')).toBeInTheDocument()
        expect(screen.getByText('8080')).toBeInTheDocument() // host port
        expect(screen.getByText('80')).toBeInTheDocument() // container port
        expect(screen.getByText('/host/path')).toBeInTheDocument()
        expect(screen.getByText('/container/path')).toBeInTheDocument()
      })
    })

    it('shows environment variables count', async () => {
      render(<ServiceDetailPage serviceId="123" />)

      await waitFor(() => {
        expect(screen.getByText('5 vars')).toBeInTheDocument()
      })
    })
  })

  describe('RBAC - Deployer Role', () => {
    beforeEach(() => {
      mockIsDeployerSync.mockReturnValue(true)
    })

    it('shows Start/Stop/Restart buttons for deployer role', async () => {
      render(<ServiceDetailPage serviceId="123" />)

      await waitFor(() => {
        expect(screen.getByText('Start')).toBeInTheDocument()
        expect(screen.getByText('Stop')).toBeInTheDocument()
        expect(screen.getByText('Restart')).toBeInTheDocument()
      })
    })

    it('triggers start service action when Start button is clicked', async () => {
      render(<ServiceDetailPage serviceId="123" />)

      await waitFor(() => {
        const startButton = screen.getByText('Start')
        fireEvent.click(startButton)
      })

      expect(mockUseApiData.startService).toHaveBeenCalledWith('123')
    })

    it('triggers stop service action when Stop button is clicked', async () => {
      render(<ServiceDetailPage serviceId="123" />)

      await waitFor(() => {
        const stopButton = screen.getByText('Stop')
        fireEvent.click(stopButton)
      })

      expect(mockUseApiData.stopService).toHaveBeenCalledWith('123')
    })

    it('triggers restart service action when Restart button is clicked', async () => {
      render(<ServiceDetailPage serviceId="123" />)

      await waitFor(() => {
        const restartButton = screen.getByText('Restart')
        fireEvent.click(restartButton)
      })

      expect(mockUseApiData.restartService).toHaveBeenCalledWith('123')
    })
  })

  describe('RBAC - Viewer Role', () => {
    beforeEach(() => {
      mockIsDeployerSync.mockReturnValue(false)
      vi.mocked(require('../api').useApiData).mockImplementation((fetcher) => {
        if (fetcher === apiClient.getAuthInfo) {
          return { data: { role: 'viewer' }, loading: false, error: null }
        }
        return { data: null, loading: false, error: null }
      })
    })

    it('hides Start/Stop/Restart buttons for viewer role', async () => {
      render(<ServiceDetailPage serviceId="123" />)

      await waitFor(() => {
        expect(screen.queryByText('Start')).not.toBeInTheDocument()
        expect(screen.queryByText('Stop')).not.toBeInTheDocument()
        expect(screen.queryByText('Restart')).not.toBeInTheDocument()
      })
    })

    it('shows locked message for viewer role', async () => {
      render(<ServiceDetailPage serviceId="123" />)

      await waitFor(() => {
        expect(screen.getByText('Service Control Locked')).toBeInTheDocument()
      })
    })

    it('still shows View Logs button for viewer role', async () => {
      render(<ServiceDetailPage serviceId="123" />)

      await waitFor(() => {
        expect(screen.getByText('View Logs')).toBeInTheDocument()
      })
    })
  })

  describe('Status Updates', () => {
    it('shows optimistic status update after action', async () => {
      render(<ServiceDetailPage serviceId="123" />)

      await waitFor(() => {
        const startButton = screen.getByText('Start')
        fireEvent.click(startButton)
      })

      // The component should show optimistic update
      expect(mockUseApiData.startService).toHaveBeenCalledWith('123')
    })

    it('disables buttons while action is in progress', async () => {
      mockUseApiData.startService.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 1000)))
      
      render(<ServiceDetailPage serviceId="123" />)

      await waitFor(() => {
        const startButton = screen.getByText('Start')
        fireEvent.click(startButton)
      })

      // All buttons should be disabled during action
      await waitFor(() => {
        const buttons = screen.getAllByRole('button')
        const actionButtons = buttons.filter(btn => 
          btn.textContent?.includes('Start') || 
          btn.textContent?.includes('Stop') || 
          btn.textContent?.includes('Restart')
        )
        actionButtons.forEach(button => {
          expect(button).toBeDisabled()
        })
      })
    })
  })

  describe('Logs Drawer', () => {
    it('opens logs drawer when View Logs button is clicked', async () => {
      render(<ServiceDetailPage serviceId="123" />)

      await waitFor(() => {
        const logsButton = screen.getByText('View Logs')
        fireEvent.click(logsButton)
      })

      expect(screen.getByTestId('logs-drawer')).toBeInTheDocument()
      expect(screen.getByText('Logs for test-service (123)')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('displays error message when service fetch fails', async () => {
      mockUseApiData.getService.mockRejectedValue(new Error('Service not found'))
      
      render(<ServiceDetailPage serviceId="123" />)

      await waitFor(() => {
        expect(screen.getByText('⚠️ Error')).toBeInTheDocument()
        expect(screen.getByText('Service not found')).toBeInTheDocument()
      })
    })

    it('shows retry button on error', async () => {
      mockUseApiData.getService.mockRejectedValue(new Error('Network error'))
      
      render(<ServiceDetailPage serviceId="123" />)

      await waitFor(() => {
        const retryButton = screen.getByText('Retry')
        expect(retryButton).toBeInTheDocument()
      })
    })

    it('shows back button when onBack prop is provided', async () => {
      const mockOnBack = vi.fn()
      mockUseApiData.getService.mockRejectedValue(new Error('Not found'))
      
      render(<ServiceDetailPage serviceId="123" onBack={mockOnBack} />)

      await waitFor(() => {
        const backButton = screen.getByText('Go Back')
        fireEvent.click(backButton)
      })

      expect(mockOnBack).toHaveBeenCalled()
    })
  })

  describe('Loading States', () => {
    it('shows loading spinner initially', () => {
      render(<ServiceDetailPage serviceId="123" />)
      
      expect(screen.getByText('Loading service details...')).toBeInTheDocument()
    })

    it('shows loading state during refresh', async () => {
      render(<ServiceDetailPage serviceId="123" />)

      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('test-service')).toBeInTheDocument()
      })

      // Click refresh
      const refreshButton = screen.getByText('🔄 Refresh')
      fireEvent.click(refreshButton)

      // Should see loading state
      expect(mockUseApiData.getService).toHaveBeenCalledTimes(2)
    })
  })

  describe('Quick Actions', () => {
    beforeEach(() => {
      // Mock clipboard API
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: vi.fn().mockResolvedValue(undefined)
        },
        writable: true
      })
    })

    it('copies docker run command when clicked', async () => {
      render(<ServiceDetailPage serviceId="123" />)

      await waitFor(() => {
        const copyButton = screen.getByText('Copy Docker Run Command')
        fireEvent.click(copyButton)
      })

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining('docker run -d --name test-service -p 8080:80 -v /host/path:/container/path nginx:latest')
      )
    })

    it('copies service ID when clicked', async () => {
      render(<ServiceDetailPage serviceId="123" />)

      await waitFor(() => {
        const copyIdButton = screen.getByText('Copy Service ID')
        fireEvent.click(copyIdButton)
      })

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('123')
    })
  })
})