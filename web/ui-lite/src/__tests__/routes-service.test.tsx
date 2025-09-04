import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import { RoutesTab } from '../pages/Services/RoutesTab'
import { apiClient } from '../api'

// Mock the API client
vi.mock('../api', () => ({
  apiClient: {
    listServiceRoutes: vi.fn(),
    createRoute: vi.fn(),
    deleteRoute: vi.fn()
  },
  useApiData: vi.fn()
}))

// Mock Toast component
vi.mock('../components/ui', () => ({
  Toast: ({ message, isVisible }: { message: string; isVisible: boolean }) =>
    isVisible ? <div data-testid="toast">{message}</div> : null
}))

describe('Service Routes Tab', () => {
  const mockUseApiData = vi.fn()
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    const { useApiData } = require('../api')
    vi.mocked(useApiData).mockImplementation(mockUseApiData)
  })

  it('should render service routes list', async () => {
    const mockRoutes = [
      {
        id: 1,
        service_id: 1,
        domain: 'service.test.com',
        path: '/',
        port: 80,
        tls: true,
        created_at: '2023-01-01T00:00:00Z'
      },
      {
        id: 2,
        service_id: 1,
        domain: 'api.service.test.com',
        path: '/api',
        port: 8080,
        tls: false,
        created_at: '2023-01-02T00:00:00Z'
      }
    ]

    mockUseApiData.mockReturnValue({
      data: mockRoutes,
      loading: false,
      refetch: vi.fn()
    })

    render(<RoutesTab serviceId="1" serviceName="test-service" />)

    await waitFor(() => {
      expect(screen.getByText('Routes for test-service')).toBeInTheDocument()
      expect(screen.getByText('service.test.com')).toBeInTheDocument()
      expect(screen.getByText('api.service.test.com')).toBeInTheDocument()
    })

    // Check HTTPS badge
    expect(screen.getByText('HTTPS')).toBeInTheDocument()
    
    // Check port information
    expect(screen.getByText('Port 80 • Created 1/1/2023')).toBeInTheDocument()
    expect(screen.getByText('Port 8080 • Created 1/2/2023')).toBeInTheDocument()
  })

  it('should show add route form when button is clicked', async () => {
    mockUseApiData.mockReturnValue({
      data: [],
      loading: false,
      refetch: vi.fn()
    })

    render(<RoutesTab serviceId="1" serviceName="test-service" />)

    const addButton = screen.getByText('Add Route')
    fireEvent.click(addButton)

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('example.com')).toBeInTheDocument()
      expect(screen.getByDisplayValue('/')).toBeInTheDocument()
      expect(screen.getByDisplayValue('80')).toBeInTheDocument()
    })
  })

  it('should validate form fields correctly', async () => {
    mockUseApiData.mockReturnValue({
      data: [],
      loading: false,
      refetch: vi.fn()
    })

    render(<RoutesTab serviceId="1" serviceName="test-service" />)

    // Open form
    fireEvent.click(screen.getByText('Add Route'))

    // Try to submit without domain
    const createButton = screen.getByText('Create Route')
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(screen.getByText('Domain is required')).toBeInTheDocument()
    })

    // Enter invalid domain
    const domainInput = screen.getByPlaceholderText('example.com')
    fireEvent.change(domainInput, { target: { value: 'invalid..domain' } })
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(screen.getByText('Invalid domain format')).toBeInTheDocument()
    })

    // Enter invalid path
    const pathInput = screen.getByDisplayValue('/')
    fireEvent.change(pathInput, { target: { value: 'no-slash' } })
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(screen.getByText('Path must start with /')).toBeInTheDocument()
    })

    // Enter invalid port
    const portInput = screen.getByDisplayValue('80')
    fireEvent.change(portInput, { target: { value: '70000' } })
    fireEvent.click(createButton)

    await waitFor(() => {
      expect(screen.getByText('Port must be between 1 and 65535')).toBeInTheDocument()
    })
  })

  it('should create route successfully', async () => {
    const mockRefetch = vi.fn()
    mockUseApiData.mockReturnValue({
      data: [],
      loading: false,
      refetch: mockRefetch
    })

    vi.mocked(apiClient.createRoute).mockResolvedValue({
      id: 1,
      service_id: 1,
      domain: 'new.test.com',
      path: '/',
      port: 80,
      tls: false,
      created_at: '2023-01-01T00:00:00Z'
    })

    render(<RoutesTab serviceId="1" serviceName="test-service" />)

    // Open form
    fireEvent.click(screen.getByText('Add Route'))

    // Fill form
    fireEvent.change(screen.getByPlaceholderText('example.com'), {
      target: { value: 'new.test.com' }
    })
    fireEvent.change(screen.getByDisplayValue('/'), {
      target: { value: '/api' }
    })
    fireEvent.change(screen.getByDisplayValue('80'), {
      target: { value: '8080' }
    })
    fireEvent.click(screen.getByRole('checkbox'))

    // Submit
    fireEvent.click(screen.getByText('Create Route'))

    await waitFor(() => {
      expect(apiClient.createRoute).toHaveBeenCalledWith('1', {
        domain: 'new.test.com',
        path: '/api',
        port: 8080,
        tls: true
      })
      expect(mockRefetch).toHaveBeenCalled()
      expect(screen.getByTestId('toast')).toHaveTextContent('Route created for new.test.com')
    })
  })

  it('should handle create route errors', async () => {
    mockUseApiData.mockReturnValue({
      data: [],
      loading: false,
      refetch: vi.fn()
    })

    vi.mocked(apiClient.createRoute).mockRejectedValue(new Error('Domain already exists'))

    render(<RoutesTab serviceId="1" serviceName="test-service" />)

    // Open form and fill
    fireEvent.click(screen.getByText('Add Route'))
    fireEvent.change(screen.getByPlaceholderText('example.com'), {
      target: { value: 'test.com' }
    })

    // Submit
    fireEvent.click(screen.getByText('Create Route'))

    await waitFor(() => {
      expect(screen.getByTestId('toast')).toHaveTextContent('Domain already exists')
    })
  })

  it('should delete route successfully', async () => {
    const mockRefetch = vi.fn()
    const mockRoutes = [
      {
        id: 1,
        service_id: 1,
        domain: 'delete-me.test.com',
        path: '/',
        port: 80,
        tls: false,
        created_at: '2023-01-01T00:00:00Z'
      }
    ]

    mockUseApiData.mockReturnValue({
      data: mockRoutes,
      loading: false,
      refetch: mockRefetch
    })

    vi.mocked(apiClient.deleteRoute).mockResolvedValue()

    render(<RoutesTab serviceId="1" serviceName="test-service" />)

    await waitFor(() => {
      expect(screen.getByText('delete-me.test.com')).toBeInTheDocument()
    })

    // Click delete button
    const deleteButton = screen.getByTitle('Delete route')
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(apiClient.deleteRoute).toHaveBeenCalledWith('1')
      expect(mockRefetch).toHaveBeenCalled()
      expect(screen.getByTestId('toast')).toHaveTextContent('Route deleted successfully')
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

    mockUseApiData.mockReturnValue({
      data: mockRoutes,
      loading: false,
      refetch: vi.fn()
    })

    vi.mocked(apiClient.deleteRoute).mockRejectedValue(new Error('Route is in use'))

    render(<RoutesTab serviceId="1" serviceName="test-service" />)

    const deleteButton = screen.getByTitle('Delete route')
    fireEvent.click(deleteButton)

    await waitFor(() => {
      expect(screen.getByTestId('toast')).toHaveTextContent('Route is in use')
    })
  })

  it('should show empty state when no routes exist', async () => {
    mockUseApiData.mockReturnValue({
      data: [],
      loading: false,
      refetch: vi.fn()
    })

    render(<RoutesTab serviceId="1" serviceName="test-service" />)

    expect(screen.getByText('No routes configured')).toBeInTheDocument()
    expect(screen.getByText('Create routes to expose this service through custom domains')).toBeInTheDocument()
    expect(screen.getByText('Add First Route')).toBeInTheDocument()
  })

  it('should show loading state', async () => {
    mockUseApiData.mockReturnValue({
      data: null,
      loading: true,
      refetch: vi.fn()
    })

    render(<RoutesTab serviceId="1" serviceName="test-service" />)

    // Check for skeleton loading elements
    const skeletonElements = screen.getAllByRole('generic')
    const skeletons = skeletonElements.filter(el => el.classList.contains('skeleton'))
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('should reset form after successful creation', async () => {
    const mockRefetch = vi.fn()
    mockUseApiData.mockReturnValue({
      data: [],
      loading: false,
      refetch: mockRefetch
    })

    vi.mocked(apiClient.createRoute).mockResolvedValue({
      id: 1,
      service_id: 1,
      domain: 'test.com',
      path: '/',
      port: 80,
      tls: false,
      created_at: '2023-01-01T00:00:00Z'
    })

    render(<RoutesTab serviceId="1" serviceName="test-service" />)

    // Open form and fill
    fireEvent.click(screen.getByText('Add Route'))
    fireEvent.change(screen.getByPlaceholderText('example.com'), {
      target: { value: 'test.com' }
    })

    // Submit
    fireEvent.click(screen.getByText('Create Route'))

    await waitFor(() => {
      // Form should be closed
      expect(screen.queryByPlaceholderText('example.com')).not.toBeInTheDocument()
      expect(screen.getByText('Add Route')).toBeInTheDocument()
    })
  })

  it('should handle form submission with disabled state', async () => {
    mockUseApiData.mockReturnValue({
      data: [],
      loading: false,
      refetch: vi.fn()
    })

    // Mock a slow API call
    vi.mocked(apiClient.createRoute).mockImplementation(
      () => new Promise(resolve => setTimeout(resolve, 100))
    )

    render(<RoutesTab serviceId="1" serviceName="test-service" />)

    // Open form and fill
    fireEvent.click(screen.getByText('Add Route'))
    fireEvent.change(screen.getByPlaceholderText('example.com'), {
      target: { value: 'test.com' }
    })

    // Submit
    const submitButton = screen.getByText('Create Route')
    fireEvent.click(submitButton)

    // Button should show loading state
    await waitFor(() => {
      expect(screen.getByText('Creating...')).toBeInTheDocument()
    })

    // Form inputs should be disabled
    expect(screen.getByPlaceholderText('example.com')).toHaveAttribute('disabled')
  })
})