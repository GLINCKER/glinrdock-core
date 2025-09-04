import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import { Routes } from '../pages/Routes'
import { apiClient } from '../api'

// Mock the API client
vi.mock('../api', () => ({
  apiClient: {
    listRoutes: vi.fn(),
    listServiceRoutes: vi.fn(),
    createRoute: vi.fn(),
    deleteRoute: vi.fn(),
    nginxReload: vi.fn(),
    getProjects: vi.fn(),
    getProjectServices: vi.fn(),
    getAuthInfo: vi.fn()
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
    isVisible ? <div data-testid="toast">{message}</div> : null
}))

vi.mock('../components', () => ({
  CreateRouteModal: ({ 
    isOpen, 
    onClose, 
    onSubmit,
    services
  }: {
    isOpen: boolean
    onClose: () => void
    onSubmit: (data: any) => void
    services: any[]
  }) => {
    if (!isOpen) return null
    return (
      <div data-testid="create-route-modal">
        <h3>Create Route Modal</h3>
        <div>Services available: {services.length}</div>
        <button onClick={() => onSubmit({
          service_id: 'test-service',
          domain: 'test.com',
          port: 80,
          tls: false
        })}>
          Create Route
        </button>
        <button onClick={onClose}>Close</button>
      </div>
    )
  },
  ConfirmModal: ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title,
    disabled
  }: {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    disabled?: boolean
  }) => {
    if (!isOpen) return null
    return (
      <div data-testid="confirm-modal">
        <h3>{title}</h3>
        <button onClick={onConfirm} disabled={disabled}>Confirm</button>
        <button onClick={onClose}>Cancel</button>
      </div>
    )
  }
}))

describe('Routes List Page', () => {
  const mockUseApiData = vi.fn()
  const mockIsAdminSync = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    mockUseApiData
      .mockReturnValueOnce({ data: { role: 'admin' }, loading: false }) // authInfo
      .mockReturnValueOnce({ data: [], loading: false, refetch: vi.fn() }) // routes
      .mockReturnValueOnce({ data: [], loading: false }) // projects

    const { useApiData } = require('../api')
    vi.mocked(useApiData).mockImplementation(mockUseApiData)

    const { isAdminSync } = require('../rbac')
    vi.mocked(isAdminSync).mockImplementation(mockIsAdminSync)
  })

  it('should render global routes list', async () => {
    const mockRoutes = [
      {
        id: 1,
        service_id: 1,
        domain: 'test.com',
        path: '/',
        port: 80,
        tls: false,
        created_at: '2023-01-01T00:00:00Z'
      },
      {
        id: 2,
        service_id: 2,
        domain: 'api.test.com',
        path: '/api',
        port: 8080,
        tls: true,
        created_at: '2023-01-02T00:00:00Z'
      }
    ]

    const mockServices = [
      { id: '1', name: 'web-service', project_name: 'Web Project' },
      { id: '2', name: 'api-service', project_name: 'API Project' }
    ]

    mockUseApiData
      .mockReset()
      .mockReturnValueOnce({ data: { role: 'admin' }, loading: false })
      .mockReturnValueOnce({ data: mockRoutes, loading: false, refetch: vi.fn() })
      .mockReturnValueOnce({ data: [{ id: 1, name: 'Test Project' }], loading: false })

    // Mock services fetch
    vi.mocked(apiClient.getProjectServices).mockResolvedValue(mockServices)

    render(<Routes />)

    await waitFor(() => {
      expect(screen.getByText('test.com')).toBeInTheDocument()
      expect(screen.getByText('api.test.com')).toBeInTheDocument()
    })

    // Check if HTTPS badge is shown
    expect(screen.getByText('HTTPS')).toBeInTheDocument()
    
    // Check service information
    expect(screen.getByText('web-service')).toBeInTheDocument()
    expect(screen.getByText('api-service')).toBeInTheDocument()
  })

  it('should show nginx reload button for admin users', async () => {
    mockIsAdminSync.mockReturnValue(true)

    mockUseApiData
      .mockReset()
      .mockReturnValueOnce({ data: { role: 'admin' }, loading: false })
      .mockReturnValueOnce({ data: [], loading: false, refetch: vi.fn() })
      .mockReturnValueOnce({ data: [], loading: false })

    render(<Routes />)

    expect(screen.getByText('Reload Nginx')).toBeInTheDocument()
  })

  it('should not show nginx reload button for non-admin users', async () => {
    mockIsAdminSync.mockReturnValue(false)

    mockUseApiData
      .mockReset()
      .mockReturnValueOnce({ data: { role: 'viewer' }, loading: false })
      .mockReturnValueOnce({ data: [], loading: false, refetch: vi.fn() })
      .mockReturnValueOnce({ data: [], loading: false })

    render(<Routes />)

    expect(screen.queryByText('Reload Nginx')).not.toBeInTheDocument()
  })

  it('should handle nginx reload confirmation', async () => {
    mockIsAdminSync.mockReturnValue(true)
    vi.mocked(apiClient.nginxReload).mockResolvedValue({ message: 'Success' })

    mockUseApiData
      .mockReset()
      .mockReturnValueOnce({ data: { role: 'admin' }, loading: false })
      .mockReturnValueOnce({ data: [], loading: false, refetch: vi.fn() })
      .mockReturnValueOnce({ data: [], loading: false })

    render(<Routes />)

    // Click nginx reload button
    const reloadButton = screen.getByText('Reload Nginx')
    fireEvent.click(reloadButton)

    // Confirm modal should appear
    await waitFor(() => {
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument()
      expect(screen.getByText('Reload Nginx Configuration')).toBeInTheDocument()
    })

    // Click confirm
    const confirmButton = screen.getByText('Confirm')
    fireEvent.click(confirmButton)

    await waitFor(() => {
      expect(apiClient.nginxReload).toHaveBeenCalled()
    })
  })

  it('should handle nginx reload errors', async () => {
    mockIsAdminSync.mockReturnValue(true)
    vi.mocked(apiClient.nginxReload).mockRejectedValue(new Error('Nginx reload failed'))

    mockUseApiData
      .mockReset()
      .mockReturnValueOnce({ data: { role: 'admin' }, loading: false })
      .mockReturnValueOnce({ data: [], loading: false, refetch: vi.fn() })
      .mockReturnValueOnce({ data: [], loading: false })

    render(<Routes />)

    // Click nginx reload and confirm
    fireEvent.click(screen.getByText('Reload Nginx'))
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('Confirm'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('toast')).toHaveTextContent('Nginx reload failed')
    })
  })

  it('should delete route and remove from list', async () => {
    const mockRefetch = vi.fn()
    const mockRoutes = [
      {
        id: 1,
        service_id: 1,
        domain: 'test.com',
        path: '/',
        port: 80,
        tls: false,
        created_at: '2023-01-01T00:00:00Z'
      }
    ]

    mockUseApiData
      .mockReset()
      .mockReturnValueOnce({ data: { role: 'admin' }, loading: false })
      .mockReturnValueOnce({ data: mockRoutes, loading: false, refetch: mockRefetch })
      .mockReturnValueOnce({ data: [{ id: 1, name: 'Test Project' }], loading: false })

    vi.mocked(apiClient.deleteRoute).mockResolvedValue()
    vi.mocked(apiClient.getProjectServices).mockResolvedValue([
      { id: '1', name: 'test-service', project_name: 'Test Project' }
    ])

    render(<Routes />)

    await waitFor(() => {
      expect(screen.getByText('test.com')).toBeInTheDocument()
    })

    // Find and click delete button
    const deleteButton = screen.getByTitle('Delete route')
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(apiClient.deleteRoute).toHaveBeenCalledWith('1')
      expect(mockRefetch).toHaveBeenCalled()
    })
  })

  it('should handle delete route errors', async () => {
    const mockRoutes = [
      {
        id: 1,
        service_id: 1,
        domain: 'test.com',
        path: '/',
        port: 80,
        tls: false,
        created_at: '2023-01-01T00:00:00Z'
      }
    ]

    mockUseApiData
      .mockReset()
      .mockReturnValueOnce({ data: { role: 'admin' }, loading: false })
      .mockReturnValueOnce({ data: mockRoutes, loading: false, refetch: vi.fn() })
      .mockReturnValueOnce({ data: [{ id: 1, name: 'Test Project' }], loading: false })

    vi.mocked(apiClient.deleteRoute).mockRejectedValue(new Error('Delete failed'))
    vi.mocked(apiClient.getProjectServices).mockResolvedValue([
      { id: '1', name: 'test-service', project_name: 'Test Project' }
    ])

    render(<Routes />)

    await waitFor(() => {
      expect(screen.getByText('test.com')).toBeInTheDocument()
    })

    const deleteButton = screen.getByTitle('Delete route')
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(screen.getByTestId('toast')).toHaveTextContent('Delete failed')
    })
  })

  it('should open create route modal when button is clicked', async () => {
    mockUseApiData
      .mockReset()
      .mockReturnValueOnce({ data: { role: 'admin' }, loading: false })
      .mockReturnValueOnce({ data: [], loading: false, refetch: vi.fn() })
      .mockReturnValueOnce({ data: [{ id: 1, name: 'Test Project' }], loading: false })

    vi.mocked(apiClient.getProjectServices).mockResolvedValue([
      { id: '1', name: 'test-service', project_name: 'Test Project' }
    ])

    render(<Routes />)

    await waitFor(() => {
      const createButton = screen.getByText('New Route')
      fireEvent.click(createButton)
    })

    expect(screen.getByTestId('create-route-modal')).toBeInTheDocument()
  })

  it('should handle route creation successfully', async () => {
    const mockRefetch = vi.fn()
    vi.mocked(apiClient.createRoute).mockResolvedValue({
      id: 1,
      service_id: 1,
      domain: 'new-test.com',
      port: 80,
      tls: false,
      created_at: '2023-01-01T00:00:00Z'
    })

    mockUseApiData
      .mockReset()
      .mockReturnValueOnce({ data: { role: 'admin' }, loading: false })
      .mockReturnValueOnce({ data: [], loading: false, refetch: mockRefetch })
      .mockReturnValueOnce({ data: [{ id: 1, name: 'Test Project' }], loading: false })

    vi.mocked(apiClient.getProjectServices).mockResolvedValue([
      { id: '1', name: 'test-service', project_name: 'Test Project' }
    ])

    render(<Routes />)

    await waitFor(() => {
      fireEvent.click(screen.getByText('New Route'))
    })

    // Create route via modal
    const createRouteButton = screen.getByText('Create Route')
    fireEvent.click(createRouteButton)

    await waitFor(() => {
      expect(apiClient.createRoute).toHaveBeenCalledWith('test-service', {
        service_id: 'test-service',
        domain: 'test.com',
        port: 80,
        tls: false
      })
      expect(mockRefetch).toHaveBeenCalled()
    })
  })

  it('should show empty state when no services available', async () => {
    mockUseApiData
      .mockReset()
      .mockReturnValueOnce({ data: { role: 'admin' }, loading: false })
      .mockReturnValueOnce({ data: [], loading: false, refetch: vi.fn() })
      .mockReturnValueOnce({ data: [], loading: false })

    render(<Routes />)

    await waitFor(() => {
      expect(screen.getByText('Ready to Get Started?')).toBeInTheDocument()
      expect(screen.getByText('Deploy your first service to start creating routes')).toBeInTheDocument()
    })
  })

  it('should show loading state', async () => {
    mockUseApiData
      .mockReset()
      .mockReturnValueOnce({ data: { role: 'admin' }, loading: false })
      .mockReturnValueOnce({ data: null, loading: true, refetch: vi.fn() })
      .mockReturnValueOnce({ data: null, loading: true })

    render(<Routes />)

    expect(screen.getByTestId('loading-spinner-lg')).toBeInTheDocument()
  })
})