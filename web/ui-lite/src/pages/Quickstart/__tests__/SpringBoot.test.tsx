import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import { vi } from 'vitest'
import { SpringBoot } from '../SpringBoot'

// Mock fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(() => 'mock-token')
}
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
})

describe('SpringBoot Quickstart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockClear()
  })

  it('renders initial step correctly', async () => {
    // Mock projects API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, name: 'Test Project' }
      ]
    })

    render(<SpringBoot />)

    expect(screen.getByText('Spring Boot Quickstart')).toBeInTheDocument()
    expect(screen.getByText('Repository Configuration')).toBeInTheDocument()
    expect(screen.getByLabelText(/Git Repository URL/)).toBeInTheDocument()
    expect(screen.getByText('Next')).toBeInTheDocument()
  })

  it('validates repository URL correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true, 
      json: async () => []
    })

    render(<SpringBoot />)

    const nextButton = screen.getByText('Next')
    fireEvent.click(nextButton)

    await waitFor(() => {
      expect(screen.getByText('Repository URL is required')).toBeInTheDocument()
    })
  })

  it('validates repository URL format', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => []
    })

    render(<SpringBoot />)

    const urlInput = screen.getByLabelText(/Git Repository URL/)
    fireEvent.input(urlInput, { target: { value: 'invalid-url' } })

    const nextButton = screen.getByText('Next')
    fireEvent.click(nextButton)

    await waitFor(() => {
      expect(screen.getByText('Please enter a valid Git repository URL')).toBeInTheDocument()
    })
  })

  it('progresses through steps correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, name: 'Test Project' }
      ]
    })

    render(<SpringBoot />)

    // Step 1: Repository Configuration
    const urlInput = screen.getByLabelText(/Git Repository URL/)
    fireEvent.input(urlInput, { target: { value: 'https://github.com/user/spring-app.git' } })

    const nextButton = screen.getByText('Next')
    fireEvent.click(nextButton)

    await waitFor(() => {
      expect(screen.getByText('Service Configuration')).toBeInTheDocument()
    })

    // Step 2: Service Configuration
    await waitFor(() => {
      expect(screen.getByText('Next')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Next'))

    await waitFor(() => {
      expect(screen.getByText('Route Configuration')).toBeInTheDocument()
    })

    // Step 3: Route Configuration
    fireEvent.click(screen.getByText('Next'))

    await waitFor(() => {
      expect(screen.getByText('Review & Launch')).toBeInTheDocument()
    })
  })

  it('auto-generates service name from repository URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, name: 'Test Project' }
      ]
    })

    render(<SpringBoot />)

    const urlInput = screen.getByLabelText(/Git Repository URL/)
    fireEvent.input(urlInput, { target: { value: 'https://github.com/user/my-spring-app.git' } })

    fireEvent.click(screen.getByText('Next'))

    await waitFor(() => {
      const serviceNameInput = screen.getByLabelText(/Service Name/)
      expect(serviceNameInput.value).toBe('my-spring-app')
    })
  })

  it('displays deployment progress correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        { id: 1, name: 'Test Project' }
      ]
    })

    // Mock build API call
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 1 })
    })

    // Mock build status polling
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'success', image_tag: 'test-image:latest' })
    })

    // Mock service creation
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 1 })
    })

    // Mock deployment
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({})
    })

    // Mock health check setup
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({})
    })

    render(<SpringBoot />)

    // Navigate through steps
    const urlInput = screen.getByLabelText(/Git Repository URL/)
    fireEvent.input(urlInput, { target: { value: 'https://github.com/user/spring-app.git' } })

    fireEvent.click(screen.getByText('Next'))
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('Next'))
    })
    
    await waitFor(() => {
      fireEvent.click(screen.getByText('Next'))
    })

    await waitFor(() => {
      fireEvent.click(screen.getByText('Deploy Spring Boot Application'))
    })

    await waitFor(() => {
      expect(screen.getByText('Deploying Spring Boot Application')).toBeInTheDocument()
      expect(screen.getByText('Build - Repository cloning and Docker build')).toBeInTheDocument()
    })
  })

  it('handles API errors gracefully', async () => {
    // Mock failed projects API call
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    render(<SpringBoot />)

    // Component should still render even if projects fail to load
    expect(screen.getByText('Spring Boot Quickstart')).toBeInTheDocument()
  })
})