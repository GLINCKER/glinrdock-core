import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import { RouteWizard } from '../pages/Routes/Wizard'
import { apiClient } from '../api'

// Mock the API client
vi.mock('../api', () => ({
  apiClient: {
    getAuthInfo: vi.fn(),
    getProjects: vi.fn(),
    getProjectServices: vi.fn(),
    createRoute: vi.fn(),
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
  Toast: ({ message, isVisible, onClose }: { message: string; isVisible: boolean; onClose: () => void }) =>
    isVisible ? (
      <div data-testid="toast" onClick={onClose}>
        {message}
      </div>
    ) : null
}))

vi.mock('../components', () => ({
  ConfirmModal: ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title,
    message,
    confirmText,
    disabled
  }: {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
    confirmText?: string
    disabled?: boolean
  }) => {
    if (!isOpen) return null
    return (
      <div data-testid="confirm-modal">
        <h3>{title}</h3>
        <p>{message}</p>
        <button onClick={onConfirm} disabled={disabled}>
          {confirmText || 'Confirm'}
        </button>
        <button onClick={onClose}>Cancel</button>
      </div>
    )
  }
}))

// Mock window.location.href
const mockLocationAssign = vi.fn()
Object.defineProperty(window, 'location', {
  value: {
    href: '',
    assign: mockLocationAssign
  },
  writable: true
})

describe('Route Creation Wizard', () => {
  const mockUseApiData = vi.fn()
  const mockIsAdminSync = vi.fn()
  
  const mockProjects = [
    { id: 1, name: 'Web Project' },
    { id: 2, name: 'API Project' }
  ]
  
  const mockServices = [
    { id: 'web-service', name: 'Frontend App', port: 3000 },
    { id: 'api-service', name: 'Backend API', port: 8080 }
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Reset window.location.href
    window.location.href = ''
    
    // Setup default mocks
    mockUseApiData
      .mockReturnValueOnce({ data: { role: 'admin' }, loading: false }) // authInfo
      .mockReturnValueOnce({ data: mockProjects, loading: false }) // projects

    const { useApiData } = require('../api')
    vi.mocked(useApiData).mockImplementation(mockUseApiData)

    const { isAdminSync } = require('../rbac')
    vi.mocked(isAdminSync).mockImplementation(mockIsAdminSync)
    
    vi.mocked(apiClient.getProjectServices).mockResolvedValue(mockServices)
  })

  it('should render wizard steps correctly', async () => {
    render(<RouteWizard />)

    // Check wizard title and progress
    expect(screen.getByText('Create Route')).toBeInTheDocument()
    expect(screen.getByText('Add a new domain route to expose your service')).toBeInTheDocument()
    
    // Check progress indicators
    const progressSteps = screen.getAllByText(/^[1-3]$/)
    expect(progressSteps).toHaveLength(3)
    
    // Should start on step 1 (project selection)
    expect(screen.getByText('Select Project')).toBeInTheDocument()
  })

  it('should complete the happy path flow', async () => {
    mockIsAdminSync.mockReturnValue(true)
    vi.mocked(apiClient.createRoute).mockResolvedValue({
      id: 1,
      service_id: 1,
      domain: 'app.example.com',
      path: '/',
      port: 3000,
      tls: true,
      created_at: '2023-01-01T00:00:00Z'
    })
    vi.mocked(apiClient.nginxReload).mockResolvedValue({ message: 'Success' })

    render(<RouteWizard />)

    // Step 1: Select project
    await waitFor(() => {
      expect(screen.getByText('Web Project')).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByText('Web Project'))

    // Step 2: Select service
    await waitFor(() => {
      expect(screen.getByText('Select Service')).toBeInTheDocument()
      expect(screen.getByText('Frontend App')).toBeInTheDocument()
    })
    
    fireEvent.click(screen.getByText('Frontend App'))

    // Step 3: Enter route details
    await waitFor(() => {
      expect(screen.getByText('Route Details')).toBeInTheDocument()
    })

    // Fill form
    const domainInput = screen.getByPlaceholderText('app.example.com')
    fireEvent.change(domainInput, { target: { value: 'test.example.com' } })

    const pathInput = screen.getByDisplayValue('/')
    fireEvent.change(pathInput, { target: { value: '/api' } })

    const portInput = screen.getByDisplayValue('3000') // Should auto-fill from service
    expect(portInput).toHaveValue(3000)

    const tlsCheckbox = screen.getByRole('checkbox')
    fireEvent.click(tlsCheckbox)

    // Submit route creation
    const createButton = screen.getByText('Create Route')
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(apiClient.createRoute).toHaveBeenCalledWith('web-service', {
        domain: 'test.example.com',
        path: '/api',
        port: 3000,
        tls: true
      })
    })

    // Should show reload confirmation for admin
    await waitFor(() => {
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument()
      expect(screen.getByText('Apply Configuration?')).toBeInTheDocument()
    })

    // Confirm nginx reload
    const applyButton = screen.getByText('Apply Now')
    fireEvent.click(applyButton)

    await waitFor(() => {
      expect(apiClient.nginxReload).toHaveBeenCalled()
    })
  })

  it('should reject invalid domain format', async () => {
    render(<RouteWizard />)

    // Navigate to step 3
    await waitFor(() => fireEvent.click(screen.getByText('Web Project')))
    await waitFor(() => fireEvent.click(screen.getByText('Frontend App')))

    // Enter invalid domain
    const domainInput = screen.getByPlaceholderText('app.example.com')
    fireEvent.change(domainInput, { target: { value: 'invalid..domain' } })

    const createButton = screen.getByText('Create Route')
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(screen.getByText('Invalid domain format. Use format like example.com or app.example.com')).toBeInTheDocument()
    })

    // Should not call API with invalid data
    expect(apiClient.createRoute).not.toHaveBeenCalled()
  })

  it('should validate path format', async () => {
    render(<RouteWizard />)

    // Navigate to step 3
    await waitFor(() => fireEvent.click(screen.getByText('Web Project')))
    await waitFor(() => fireEvent.click(screen.getByText('Frontend App')))

    // Enter valid domain first
    const domainInput = screen.getByPlaceholderText('app.example.com')
    fireEvent.change(domainInput, { target: { value: 'test.example.com' } })

    // Enter invalid path
    const pathInput = screen.getByDisplayValue('/')
    fireEvent.change(pathInput, { target: { value: 'no-slash' } })

    const createButton = screen.getByText('Create Route')
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(screen.getByText('Path must start with /')).toBeInTheDocument()
    })
  })

  it('should validate port range', async () => {
    render(<RouteWizard />)

    // Navigate to step 3
    await waitFor(() => fireEvent.click(screen.getByText('Web Project')))
    await waitFor(() => fireEvent.click(screen.getByText('Frontend App')))

    // Enter valid domain
    const domainInput = screen.getByPlaceholderText('app.example.com')
    fireEvent.change(domainInput, { target: { value: 'test.example.com' } })

    // Enter invalid port
    const portInput = screen.getByDisplayValue('3000')
    fireEvent.change(portInput, { target: { value: '70000' } })

    const createButton = screen.getByText('Create Route')
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(screen.getByText('Port must be between 1 and 65535')).toBeInTheDocument()
    })
  })

  it('should handle server-side validation errors', async () => {
    vi.mocked(apiClient.createRoute).mockRejectedValue(new Error('Domain already exists'))

    render(<RouteWizard />)

    // Navigate to step 3 and fill valid form
    await waitFor(() => fireEvent.click(screen.getByText('Web Project')))
    await waitFor(() => fireEvent.click(screen.getByText('Frontend App')))

    const domainInput = screen.getByPlaceholderText('app.example.com')
    fireEvent.change(domainInput, { target: { value: 'existing.example.com' } })

    const createButton = screen.getByText('Create Route')
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(screen.getByTestId('toast')).toHaveTextContent('Domain already exists')
      expect(screen.getByText('Domain already exists')).toBeInTheDocument() // Should show as field error too
    })
  })

  it('should show disabled reload button for non-admin users', async () => {
    mockIsAdminSync.mockReturnValue(false)
    mockUseApiData
      .mockReset()
      .mockReturnValueOnce({ data: { role: 'deployer' }, loading: false })
      .mockReturnValueOnce({ data: mockProjects, loading: false })
      
    vi.mocked(apiClient.createRoute).mockResolvedValue({
      id: 1,
      service_id: 1,
      domain: 'app.example.com',
      path: '/',
      port: 3000,
      tls: false,
      created_at: '2023-01-01T00:00:00Z'
    })

    render(<RouteWizard />)

    // Complete the flow
    await waitFor(() => fireEvent.click(screen.getByText('Web Project')))
    await waitFor(() => fireEvent.click(screen.getByText('Frontend App')))

    const domainInput = screen.getByPlaceholderText('app.example.com')
    fireEvent.change(domainInput, { target: { value: 'test.example.com' } })

    const createButton = screen.getByText('Create Route')
    fireEvent.click(createButton)

    // Should show modal with disabled reload for non-admin
    await waitFor(() => {
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument()
      expect(screen.getByText(/An administrator needs to reload/)).toBeInTheDocument()
    })

    // Confirm button should be disabled
    const confirmButton = screen.getByText('OK')
    expect(confirmButton).toBeDisabled()
  })

  it('should handle nginx reload failures', async () => {
    mockIsAdminSync.mockReturnValue(true)
    vi.mocked(apiClient.createRoute).mockResolvedValue({
      id: 1,
      service_id: 1,
      domain: 'app.example.com',
      path: '/',
      port: 3000,
      tls: false,
      created_at: '2023-01-01T00:00:00Z'
    })
    vi.mocked(apiClient.nginxReload).mockRejectedValue(new Error('Nginx reload failed'))

    render(<RouteWizard />)

    // Complete the flow
    await waitFor(() => fireEvent.click(screen.getByText('Web Project')))
    await waitFor(() => fireEvent.click(screen.getByText('Frontend App')))

    const domainInput = screen.getByPlaceholderText('app.example.com')
    fireEvent.change(domainInput, { target: { value: 'test.example.com' } })

    fireEvent.click(screen.getByText('Create Route'))

    // Confirm nginx reload
    await waitFor(() => {
      const applyButton = screen.getByText('Apply Now')
      fireEvent.click(applyButton)
    })

    await waitFor(() => {
      expect(screen.getByTestId('toast')).toHaveTextContent('Nginx reload failed')
    })
  })

  it('should navigate back through wizard steps', async () => {
    render(<RouteWizard />)

    // Go to step 2
    await waitFor(() => fireEvent.click(screen.getByText('Web Project')))
    expect(screen.getByText('Select Service')).toBeInTheDocument()

    // Go back to step 1
    const backButton = screen.getByText('← Back to Projects')
    fireEvent.click(backButton)
    
    expect(screen.getByText('Select Project')).toBeInTheDocument()

    // Go to step 2 again, then step 3
    await waitFor(() => fireEvent.click(screen.getByText('Web Project')))
    await waitFor(() => fireEvent.click(screen.getByText('Frontend App')))
    expect(screen.getByText('Route Details')).toBeInTheDocument()

    // Go back to step 2
    const backToServices = screen.getByText('← Back to Services')
    fireEvent.click(backToServices)
    
    expect(screen.getByText('Select Service')).toBeInTheDocument()
  })

  it('should auto-fill port from selected service', async () => {
    render(<RouteWizard />)

    // Navigate to step 3
    await waitFor(() => fireEvent.click(screen.getByText('Web Project')))
    await waitFor(() => fireEvent.click(screen.getByText('Backend API'))) // This service has port 8080

    // Port should be auto-filled
    await waitFor(() => {
      const portInput = screen.getByDisplayValue('8080')
      expect(portInput).toBeInTheDocument()
    })
  })

  it('should show loading states appropriately', async () => {
    // Mock slow service loading
    vi.mocked(apiClient.getProjectServices).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockServices), 100))
    )

    render(<RouteWizard />)

    // Go to step 2
    await waitFor(() => fireEvent.click(screen.getByText('Web Project')))

    // Should show loading spinner while services load
    expect(screen.getByTestId('loading-spinner-md')).toBeInTheDocument()

    // Wait for services to load
    await waitFor(() => {
      expect(screen.getByText('Frontend App')).toBeInTheDocument()
    })
  })

  it('should show empty states when no projects or services', async () => {
    mockUseApiData
      .mockReset()
      .mockReturnValueOnce({ data: { role: 'admin' }, loading: false })
      .mockReturnValueOnce({ data: [], loading: false }) // No projects

    render(<RouteWizard />)

    await waitFor(() => {
      expect(screen.getByText('No projects available. Create a project first.')).toBeInTheDocument()
    })
  })

  it('should handle form submission with loading state', async () => {
    // Mock slow route creation
    vi.mocked(apiClient.createRoute).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({
        id: 1,
        service_id: 1,
        domain: 'test.example.com',
        path: '/',
        port: 3000,
        tls: false,
        created_at: '2023-01-01T00:00:00Z'
      }), 100))
    )

    render(<RouteWizard />)

    // Navigate to step 3 and fill form
    await waitFor(() => fireEvent.click(screen.getByText('Web Project')))
    await waitFor(() => fireEvent.click(screen.getByText('Frontend App')))

    const domainInput = screen.getByPlaceholderText('app.example.com')
    fireEvent.change(domainInput, { target: { value: 'test.example.com' } })

    const createButton = screen.getByText('Create Route')
    fireEvent.click(createButton)

    // Should show loading state
    await waitFor(() => {
      expect(screen.getByText('Creating Route...')).toBeInTheDocument()
    })

    // Form should be disabled during submission
    expect(domainInput).toBeDisabled()
  })

  it('should clear form errors when user starts typing', async () => {
    render(<RouteWizard />)

    // Navigate to step 3
    await waitFor(() => fireEvent.click(screen.getByText('Web Project')))
    await waitFor(() => fireEvent.click(screen.getByText('Frontend App')))

    // Enter invalid domain to trigger error
    const domainInput = screen.getByPlaceholderText('app.example.com')
    fireEvent.change(domainInput, { target: { value: 'invalid..domain' } })
    fireEvent.click(screen.getByText('Create Route'))

    await waitFor(() => {
      expect(screen.getByText(/Invalid domain format/)).toBeInTheDocument()
    })

    // Start typing valid domain - error should clear
    fireEvent.change(domainInput, { target: { value: 'valid.example.com' } })

    await waitFor(() => {
      expect(screen.queryByText(/Invalid domain format/)).not.toBeInTheDocument()
    })
  })

  it('should redirect to routes page after successful completion', async () => {
    mockIsAdminSync.mockReturnValue(false) // Non-admin user
    vi.mocked(apiClient.createRoute).mockResolvedValue({
      id: 1,
      service_id: 1,
      domain: 'test.example.com',
      path: '/',
      port: 3000,
      tls: false,
      created_at: '2023-01-01T00:00:00Z'
    })

    render(<RouteWizard />)

    // Complete the flow
    await waitFor(() => fireEvent.click(screen.getByText('Web Project')))
    await waitFor(() => fireEvent.click(screen.getByText('Frontend App')))

    const domainInput = screen.getByPlaceholderText('app.example.com')
    fireEvent.change(domainInput, { target: { value: 'test.example.com' } })

    fireEvent.click(screen.getByText('Create Route'))

    // Should redirect after delay for non-admin users
    await waitFor(() => {
      expect(screen.getByTestId('toast')).toHaveTextContent('Route created successfully for test.example.com')
    }, { timeout: 3000 })
  })
})