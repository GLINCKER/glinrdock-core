import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import { apiClient } from '../api'
import { Projects } from '../pages/Projects'

// Mock the API client
vi.mock('../api', () => ({
  apiClient: {
    startService: vi.fn(),
    stopService: vi.fn(),
    restartService: vi.fn(),
    getServiceLogs: vi.fn(),
    getProjects: vi.fn().mockResolvedValue([]),
    getAuthInfo: vi.fn().mockResolvedValue({ role: 'deployer' })
  },
  useApiData: vi.fn()
}))

// Mock RBAC
vi.mock('../rbac', () => ({
  isDeployerSync: vi.fn().mockReturnValue(true)
}))

// Mock plan refresh
vi.mock('../plan', () => ({
  refreshPlanInfo: vi.fn()
}))

// Mock components
vi.mock('../components', () => ({
  CreateProjectModal: ({ isOpen }: { isOpen: boolean }) => 
    isOpen ? <div data-testid="create-project-modal">Create Project Modal</div> : null,
  ConfirmModal: ({ isOpen }: { isOpen: boolean }) => 
    isOpen ? <div data-testid="confirm-modal">Confirm Modal</div> : null,
  Modal: ({ isOpen, children }: { isOpen: boolean; children: any }) => 
    isOpen ? <div data-testid="modal">{children}</div> : null
}))

vi.mock('../components/CreateServiceModal', () => ({
  CreateServiceModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="create-service-modal">Create Service Modal</div> : null
}))

vi.mock('../components/LogsDrawer', () => ({
  LogsDrawer: ({ isOpen, serviceId, serviceName }: { isOpen: boolean; serviceId: string; serviceName: string }) =>
    isOpen ? <div data-testid="logs-drawer">Logs for {serviceName} ({serviceId})</div> : null
}))

vi.mock('../components/ui', () => ({
  Toast: ({ message, isVisible }: { message: string; isVisible: boolean }) =>
    isVisible ? <div data-testid="toast">{message}</div> : null
}))

describe('Service Lifecycle Controls', () => {
  const mockUseApiData = vi.mocked(vi.fn())
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup useApiData mock to return projects and services data
    mockUseApiData
      .mockReturnValueOnce({ data: [], loading: false, refetch: vi.fn() }) // projects
      .mockReturnValueOnce({ data: { role: 'deployer' }, loading: false }) // authInfo
      .mockReturnValueOnce({ data: null, loading: false }) // selectedProject (when null)
      .mockReturnValueOnce({ data: null, loading: false }) // projectServices (when null)
    
    const apiModule = await import('../api')
    const { useApiData } = apiModule
    vi.mocked(useApiData).mockImplementation(mockUseApiData)
  })

  it('should render service lifecycle buttons for deployer role', async () => {
    const mockProject = {
      id: 1,
      name: 'Test Project',
      created_at: '2023-01-01'
    }
    
    const mockServices = [
      {
        id: '1',
        name: 'test-service',
        image: 'nginx:latest',
        status: 'running',
        ports: [{ host: 8080, container: 80 }]
      }
    ]

    // Update mock to return project and services data
    mockUseApiData
      .mockReset()
      .mockReturnValueOnce({ data: [mockProject], loading: false, refetch: vi.fn() }) // projects
      .mockReturnValueOnce({ data: { role: 'deployer' }, loading: false }) // authInfo
      .mockReturnValueOnce({ data: mockProject, loading: false }) // selectedProject
      .mockReturnValueOnce({ data: mockServices, loading: false }) // projectServices

    render(<Projects />)
    
    // Click to open project detail
    const viewButton = screen.getByText('View')
    fireEvent.click(viewButton)

    await waitFor(() => {
      expect(screen.getByTestId('modal')).toBeInTheDocument()
    })

    // Should show logs button for all users
    expect(screen.getByTitle('View service logs')).toBeInTheDocument()
    
    // Should show stop and restart buttons for running service
    expect(screen.getByTitle('Stop service')).toBeInTheDocument()
    expect(screen.getByTitle('Restart service')).toBeInTheDocument()
  })

  it('should show start button for stopped services', async () => {
    const mockProject = {
      id: 1,
      name: 'Test Project',
      created_at: '2023-01-01'
    }
    
    const mockServices = [
      {
        id: '1',
        name: 'test-service',
        image: 'nginx:latest',
        status: 'stopped',
        ports: []
      }
    ]

    mockUseApiData
      .mockReset()
      .mockReturnValueOnce({ data: [mockProject], loading: false, refetch: vi.fn() }) // projects
      .mockReturnValueOnce({ data: { role: 'deployer' }, loading: false }) // authInfo
      .mockReturnValueOnce({ data: mockProject, loading: false }) // selectedProject
      .mockReturnValueOnce({ data: mockServices, loading: false }) // projectServices

    render(<Projects />)
    
    // Click to open project detail
    const viewButton = screen.getByText('View')
    fireEvent.click(viewButton)

    await waitFor(() => {
      expect(screen.getByTitle('Start service')).toBeInTheDocument()
    })

    // Should not show stop/restart buttons for stopped service
    expect(screen.queryByTitle('Stop service')).not.toBeInTheDocument()
    expect(screen.queryByTitle('Restart service')).not.toBeInTheDocument()
  })

  it('should call startService API when start button is clicked', async () => {
    const mockStartService = vi.mocked(apiClient.startService)
    mockStartService.mockResolvedValue()

    const mockProject = {
      id: 1,
      name: 'Test Project',
      created_at: '2023-01-01'
    }
    
    const mockServices = [
      {
        id: '1',
        name: 'test-service',
        image: 'nginx:latest',
        status: 'stopped',
        ports: []
      }
    ]

    mockUseApiData
      .mockReset()
      .mockReturnValueOnce({ data: [mockProject], loading: false, refetch: vi.fn() })
      .mockReturnValueOnce({ data: { role: 'deployer' }, loading: false })
      .mockReturnValueOnce({ data: mockProject, loading: false })
      .mockReturnValueOnce({ data: mockServices, loading: false })

    render(<Projects />)
    
    // Open project detail
    const viewButton = screen.getByText('View')
    fireEvent.click(viewButton)

    // Click start button
    const startButton = await screen.findByTitle('Start service')
    fireEvent.click(startButton)

    await waitFor(() => {
      expect(mockStartService).toHaveBeenCalledWith('1')
    })
  })

  it('should call stopService API when stop button is clicked', async () => {
    const mockStopService = vi.mocked(apiClient.stopService)
    mockStopService.mockResolvedValue()

    const mockProject = {
      id: 1,
      name: 'Test Project',
      created_at: '2023-01-01'
    }
    
    const mockServices = [
      {
        id: '1',
        name: 'test-service',
        image: 'nginx:latest',
        status: 'running',
        ports: []
      }
    ]

    mockUseApiData
      .mockReset()
      .mockReturnValueOnce({ data: [mockProject], loading: false, refetch: vi.fn() })
      .mockReturnValueOnce({ data: { role: 'deployer' }, loading: false })
      .mockReturnValueOnce({ data: mockProject, loading: false })
      .mockReturnValueOnce({ data: mockServices, loading: false })

    render(<Projects />)
    
    // Open project detail
    const viewButton = screen.getByText('View')
    fireEvent.click(viewButton)

    // Click stop button
    const stopButton = await screen.findByTitle('Stop service')
    fireEvent.click(stopButton)

    await waitFor(() => {
      expect(mockStopService).toHaveBeenCalledWith('1')
    })
  })

  it('should call restartService API when restart button is clicked', async () => {
    const mockRestartService = vi.mocked(apiClient.restartService)
    mockRestartService.mockResolvedValue()

    const mockProject = {
      id: 1,
      name: 'Test Project',
      created_at: '2023-01-01'
    }
    
    const mockServices = [
      {
        id: '1',
        name: 'test-service',
        image: 'nginx:latest',
        status: 'running',
        ports: []
      }
    ]

    mockUseApiData
      .mockReset()
      .mockReturnValueOnce({ data: [mockProject], loading: false, refetch: vi.fn() })
      .mockReturnValueOnce({ data: { role: 'deployer' }, loading: false })
      .mockReturnValueOnce({ data: mockProject, loading: false })
      .mockReturnValueOnce({ data: mockServices, loading: false })

    render(<Projects />)
    
    // Open project detail
    const viewButton = screen.getByText('View')
    fireEvent.click(viewButton)

    // Click restart button
    const restartButton = await screen.findByTitle('Restart service')
    fireEvent.click(restartButton)

    await waitFor(() => {
      expect(mockRestartService).toHaveBeenCalledWith('1')
    })
  })

  it('should show success toast on successful lifecycle action', async () => {
    const mockStartService = vi.mocked(apiClient.startService)
    mockStartService.mockResolvedValue()

    const mockProject = {
      id: 1,
      name: 'Test Project',
      created_at: '2023-01-01'
    }
    
    const mockServices = [
      {
        id: '1',
        name: 'test-service',
        image: 'nginx:latest',
        status: 'stopped',
        ports: []
      }
    ]

    mockUseApiData
      .mockReset()
      .mockReturnValueOnce({ data: [mockProject], loading: false, refetch: vi.fn() })
      .mockReturnValueOnce({ data: { role: 'deployer' }, loading: false })
      .mockReturnValueOnce({ data: mockProject, loading: false })
      .mockReturnValueOnce({ data: mockServices, loading: false })

    render(<Projects />)
    
    // Open project detail
    const viewButton = screen.getByText('View')
    fireEvent.click(viewButton)

    // Click start button
    const startButton = await screen.findByTitle('Start service')
    fireEvent.click(startButton)

    await waitFor(() => {
      expect(screen.getByTestId('toast')).toHaveTextContent('Service "test-service" started successfully')
    })
  })

  it('should show error toast on failed lifecycle action', async () => {
    const mockStartService = vi.mocked(apiClient.startService)
    mockStartService.mockRejectedValue(new Error('Container not found'))

    const mockProject = {
      id: 1,
      name: 'Test Project',
      created_at: '2023-01-01'
    }
    
    const mockServices = [
      {
        id: '1',
        name: 'test-service',
        image: 'nginx:latest',
        status: 'stopped',
        ports: []
      }
    ]

    mockUseApiData
      .mockReset()
      .mockReturnValueOnce({ data: [mockProject], loading: false, refetch: vi.fn() })
      .mockReturnValueOnce({ data: { role: 'deployer' }, loading: false })
      .mockReturnValueOnce({ data: mockProject, loading: false })
      .mockReturnValueOnce({ data: mockServices, loading: false })

    render(<Projects />)
    
    // Open project detail
    const viewButton = screen.getByText('View')
    fireEvent.click(viewButton)

    // Click start button
    const startButton = await screen.findByTitle('Start service')
    fireEvent.click(startButton)

    await waitFor(() => {
      expect(screen.getByTestId('toast')).toHaveTextContent('Container not found')
    })
  })

  it('should show loading spinner during lifecycle action', async () => {
    const mockStartService = vi.mocked(apiClient.startService)
    // Simulate a delayed response
    mockStartService.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)))

    const mockProject = {
      id: 1,
      name: 'Test Project',
      created_at: '2023-01-01'
    }
    
    const mockServices = [
      {
        id: '1',
        name: 'test-service',
        image: 'nginx:latest',
        status: 'stopped',
        ports: []
      }
    ]

    mockUseApiData
      .mockReset()
      .mockReturnValueOnce({ data: [mockProject], loading: false, refetch: vi.fn() })
      .mockReturnValueOnce({ data: { role: 'deployer' }, loading: false })
      .mockReturnValueOnce({ data: mockProject, loading: false })
      .mockReturnValueOnce({ data: mockServices, loading: false })

    render(<Projects />)
    
    // Open project detail
    const viewButton = screen.getByText('View')
    fireEvent.click(viewButton)

    // Click start button
    const startButton = await screen.findByTitle('Start service')
    fireEvent.click(startButton)

    // Should show loading spinner
    await waitFor(() => {
      const button = screen.getByTitle('Start service')
      expect(button).toHaveAttribute('disabled')
      expect(button.querySelector('.animate-spin')).toBeInTheDocument()
    })
  })

  it('should open logs drawer when logs button is clicked', async () => {
    const mockProject = {
      id: 1,
      name: 'Test Project',
      created_at: '2023-01-01'
    }
    
    const mockServices = [
      {
        id: '1',
        name: 'test-service',
        image: 'nginx:latest',
        status: 'running',
        ports: []
      }
    ]

    mockUseApiData
      .mockReset()
      .mockReturnValueOnce({ data: [mockProject], loading: false, refetch: vi.fn() })
      .mockReturnValueOnce({ data: { role: 'deployer' }, loading: false })
      .mockReturnValueOnce({ data: mockProject, loading: false })
      .mockReturnValueOnce({ data: mockServices, loading: false })

    render(<Projects />)
    
    // Open project detail
    const viewButton = screen.getByText('View')
    fireEvent.click(viewButton)

    // Click logs button
    const logsButton = await screen.findByTitle('View service logs')
    fireEvent.click(logsButton)

    await waitFor(() => {
      expect(screen.getByTestId('logs-drawer')).toHaveTextContent('Logs for test-service (1)')
    })
  })

  it('should not show lifecycle controls for viewer role', async () => {
    const mockProject = {
      id: 1,
      name: 'Test Project',
      created_at: '2023-01-01'
    }
    
    const mockServices = [
      {
        id: '1',
        name: 'test-service',
        image: 'nginx:latest',
        status: 'running',
        ports: []
      }
    ]

    // Mock viewer role
    const { isDeployerSync } = await import('../rbac')
    vi.mocked(isDeployerSync).mockReturnValue(false)

    mockUseApiData
      .mockReset()
      .mockReturnValueOnce({ data: [mockProject], loading: false, refetch: vi.fn() })
      .mockReturnValueOnce({ data: { role: 'viewer' }, loading: false })
      .mockReturnValueOnce({ data: mockProject, loading: false })
      .mockReturnValueOnce({ data: mockServices, loading: false })

    render(<Projects />)
    
    // Open project detail
    const viewButton = screen.getByText('View')
    fireEvent.click(viewButton)

    await waitFor(() => {
      // Should show logs button for all users
      expect(screen.getByTitle('View service logs')).toBeInTheDocument()
      
      // Should not show lifecycle controls for viewer
      expect(screen.queryByTitle('Stop service')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Start service')).not.toBeInTheDocument()
      expect(screen.queryByTitle('Restart service')).not.toBeInTheDocument()
    })
  })
})