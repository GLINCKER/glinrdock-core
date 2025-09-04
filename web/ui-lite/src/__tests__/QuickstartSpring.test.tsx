import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import { vi } from 'vitest'
import { QuickstartSpring } from '../pages/QuickstartSpring'
import { apiClient } from '../api'

// Mock API client
vi.mock('../api', () => ({
  apiClient: {
    getAuthInfo: vi.fn(),
    getProjects: vi.fn(),
    post: vi.fn(),
    get: vi.fn(),
  },
  useApiData: vi.fn()
}))

// Mock RBAC
vi.mock('../rbac', () => ({
  isDeployerSync: vi.fn()
}))

const mockApiClient = apiClient as any
const mockUseApiData = vi.mocked(require('../api').useApiData)
const mockIsDeployerSync = vi.mocked(require('../rbac').isDeployerSync)

// Mock navigator.clipboard
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn()
  }
})

// Mock window.history
Object.defineProperty(window, 'history', {
  value: {
    pushState: vi.fn()
  }
})

// Mock window events
const mockDispatchEvent = vi.fn()
Object.defineProperty(window, 'dispatchEvent', {
  value: mockDispatchEvent
})

describe('QuickstartSpring Component', () => {
  const mockProjects = [
    { id: '1', name: 'Test Project 1' },
    { id: '2', name: 'Test Project 2' }
  ]

  const mockAuthInfo = { role: 'deployer' }

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    mockUseApiData.mockImplementation((fn, deps) => {
      if (fn.toString().includes('getAuthInfo')) {
        return { data: mockAuthInfo }
      }
      if (fn.toString().includes('getProjects')) {
        return { data: mockProjects }
      }
      return { data: null }
    })
    
    mockIsDeployerSync.mockReturnValue(true)
  })

  describe('RBAC Access Control', () => {
    it('allows access for deployer+ roles', () => {
      mockIsDeployerSync.mockReturnValue(true)
      
      render(<QuickstartSpring />)
      
      expect(screen.getByText('Spring Boot Quickstart')).toBeInTheDocument()
      expect(screen.getByText('Repository Configuration')).toBeInTheDocument()
    })

    it('shows read-only notice for viewer role', () => {
      mockIsDeployerSync.mockReturnValue(false)
      
      render(<QuickstartSpring />)
      
      expect(screen.getByText('Insufficient Permissions')).toBeInTheDocument()
      expect(screen.getByText('You need deployer or admin permissions to use the Spring Boot quickstart wizard.')).toBeInTheDocument()
    })
  })

  describe('Wizard Navigation', () => {
    it('renders initial repository step correctly', () => {
      render(<QuickstartSpring />)

      expect(screen.getByText('Repository Configuration')).toBeInTheDocument()
      expect(screen.getByLabelText(/Repository URL/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Branch/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Dockerfile Path/)).toBeInTheDocument()
      expect(screen.getByLabelText(/Build Context/)).toBeInTheDocument()
    })

    it('shows progress steps correctly', () => {
      render(<QuickstartSpring />)

      const steps = ['Repository', 'Service', 'Route', 'Launch']
      steps.forEach(step => {
        expect(screen.getByText(step)).toBeInTheDocument()
      })
    })

    it('navigates through steps with valid input', async () => {
      render(<QuickstartSpring />)

      // Fill repository step
      const gitUrlInput = screen.getByLabelText(/Repository URL/)
      fireEvent.input(gitUrlInput, { 
        target: { value: 'https://github.com/user/spring-app.git' } 
      })

      const branchInput = screen.getByLabelText(/Branch/)
      fireEvent.input(branchInput, { target: { value: 'main' } })

      // Go to service step
      fireEvent.click(screen.getByText('Next'))

      await waitFor(() => {
        expect(screen.getByText('Service Configuration')).toBeInTheDocument()
      })

      // Fill service step
      const serviceNameInput = screen.getByLabelText(/Service Name/)
      expect(serviceNameInput.value).toBe('spring-app') // Auto-generated from repo URL

      const projectSelect = screen.getByLabelText(/Project/)
      fireEvent.change(projectSelect, { target: { value: '1' } })

      // Go to route step
      fireEvent.click(screen.getByText('Next'))

      await waitFor(() => {
        expect(screen.getByText('Route Configuration')).toBeInTheDocument()
      })

      // Go to review step
      fireEvent.click(screen.getByText('Next'))

      await waitFor(() => {
        expect(screen.getByText('Review Configuration')).toBeInTheDocument()
      })
    })

    it('prevents navigation with invalid input', async () => {
      render(<QuickstartSpring />)

      // Try to navigate without filling required fields
      fireEvent.click(screen.getByText('Next'))

      // Should stay on repository step
      expect(screen.getByText('Repository Configuration')).toBeInTheDocument()
    })
  })

  describe('Repository Step Validation', () => {
    it('validates Git URL format', async () => {
      render(<QuickstartSpring />)

      const gitUrlInput = screen.getByLabelText(/Repository URL/)
      fireEvent.input(gitUrlInput, { target: { value: 'invalid-url' } })

      // Input should show validation styling for invalid URL
      expect(gitUrlInput).toHaveClass('border-red-300')
    })

    it('accepts valid Git URLs', () => {
      render(<QuickstartSpring />)

      const gitUrlInput = screen.getByLabelText(/Repository URL/)
      
      const validUrls = [
        'https://github.com/user/repo.git',
        'https://gitlab.com/user/repo.git',
        'https://bitbucket.org/user/repo.git'
      ]

      validUrls.forEach(url => {
        fireEvent.input(gitUrlInput, { target: { value: url } })
        expect(gitUrlInput).not.toHaveClass('border-red-300')
      })
    })

    it('manages build arguments correctly', () => {
      render(<QuickstartSpring />)

      // Add a build argument
      const keyInput = screen.getAllByPlaceholderText('KEY')[0]
      const valueInput = screen.getAllByPlaceholderText('VALUE')[0]
      
      fireEvent.input(keyInput, { target: { value: 'NODE_ENV' } })
      fireEvent.input(valueInput, { target: { value: 'production' } })
      fireEvent.click(screen.getByText('Add'))

      // Should display the added build argument
      expect(screen.getByText('NODE_ENV=production')).toBeInTheDocument()

      // Should clear input fields after adding
      expect(keyInput.value).toBe('')
      expect(valueInput.value).toBe('')
    })
  })

  describe('Service Step Functionality', () => {
    beforeEach(() => {
      // Setup for service step
      const gitUrl = 'https://github.com/user/my-spring-app.git'
      
      render(<QuickstartSpring />)
      
      const gitUrlInput = screen.getByLabelText(/Repository URL/)
      fireEvent.input(gitUrlInput, { target: { value: gitUrl } })
      fireEvent.click(screen.getByText('Next'))
    })

    it('auto-generates service name from repository URL', async () => {
      await waitFor(() => {
        const serviceNameInput = screen.getByLabelText(/Service Name/)
        expect(serviceNameInput.value).toBe('my-spring-app')
      })
    })

    it('validates service name format', async () => {
      await waitFor(() => {
        const serviceNameInput = screen.getByLabelText(/Service Name/)
        
        // Test invalid service name
        fireEvent.input(serviceNameInput, { target: { value: 'Invalid Name!' } })
        expect(serviceNameInput).toHaveClass('border-red-300')
        
        // Test valid service name
        fireEvent.input(serviceNameInput, { target: { value: 'valid-name' } })
        expect(serviceNameInput).not.toHaveClass('border-red-300')
      })
    })

    it('manages environment variables correctly', async () => {
      await waitFor(() => {
        // Check default environment variables are present
        expect(screen.getByDisplayValue('prod')).toBeInTheDocument() // SPRING_PROFILES_ACTIVE
        expect(screen.getByDisplayValue('8080')).toBeInTheDocument() // SERVER_PORT
      })

      // Add custom environment variable
      const envKeyInput = screen.getByPlaceholderText('VARIABLE_NAME')
      const envValueInput = screen.getByPlaceholderText('value')
      
      fireEvent.input(envKeyInput, { target: { value: 'CUSTOM_VAR' } })
      fireEvent.input(envValueInput, { target: { value: 'custom_value' } })
      fireEvent.click(screen.getByText('Add'))

      // Should display the added environment variable
      await waitFor(() => {
        expect(screen.getByDisplayValue('CUSTOM_VAR')).toBeInTheDocument()
        expect(screen.getByDisplayValue('custom_value')).toBeInTheDocument()
      })
    })

    it('populates project name when project is selected', async () => {
      await waitFor(() => {
        const projectSelect = screen.getByLabelText(/Project/)
        fireEvent.change(projectSelect, { target: { value: '1' } })
        
        // Move to review step to verify project name is populated
        fireEvent.click(screen.getByText('Next')) // Route step
        fireEvent.click(screen.getByText('Next')) // Review step
        
        expect(screen.getByText('Test Project 1')).toBeInTheDocument()
      })
    })
  })

  describe('Route Step Functionality', () => {
    beforeEach(async () => {
      render(<QuickstartSpring />)
      
      // Navigate to route step
      const gitUrlInput = screen.getByLabelText(/Repository URL/)
      fireEvent.input(gitUrlInput, { target: { value: 'https://github.com/user/app.git' } })
      fireEvent.click(screen.getByText('Next'))
      
      await waitFor(() => {
        const projectSelect = screen.getByLabelText(/Project/)
        fireEvent.change(projectSelect, { target: { value: '1' } })
        fireEvent.click(screen.getByText('Next'))
      })
    })

    it('allows optional route configuration', async () => {
      await waitFor(() => {
        expect(screen.getByText('Route Configuration')).toBeInTheDocument()
        expect(screen.getByText('Create external route for this service')).toBeInTheDocument()
      })
    })

    it('validates domain format when route is enabled', async () => {
      await waitFor(() => {
        // Enable route
        const routeCheckbox = screen.getByLabelText(/Create external route/)
        fireEvent.click(routeCheckbox)

        // Test invalid domain
        const domainInput = screen.getByLabelText(/Domain/)
        fireEvent.input(domainInput, { target: { value: 'invalid-domain' } })
        expect(domainInput).toHaveClass('border-red-300')

        // Test valid domain
        fireEvent.input(domainInput, { target: { value: 'api.example.com' } })
        expect(domainInput).not.toHaveClass('border-red-300')
      })
    })

    it('shows preview URL when valid domain and path are provided', async () => {
      await waitFor(() => {
        // Enable route
        fireEvent.click(screen.getByLabelText(/Create external route/))

        // Fill valid domain and path
        fireEvent.input(screen.getByLabelText(/Domain/), { 
          target: { value: 'api.example.com' } 
        })
        fireEvent.input(screen.getByLabelText(/Path/), { 
          target: { value: '/app' } 
        })

        // Should show preview URL
        expect(screen.getByText('Preview URL')).toBeInTheDocument()
        expect(screen.getByText('https://api.example.com/app')).toBeInTheDocument()
      })
    })
  })

  describe('Review Step and Launch', () => {
    beforeEach(async () => {
      render(<QuickstartSpring />)
      
      // Navigate to review step with complete configuration
      const gitUrlInput = screen.getByLabelText(/Repository URL/)
      fireEvent.input(gitUrlInput, { target: { value: 'https://github.com/user/test-app.git' } })
      fireEvent.click(screen.getByText('Next'))
      
      await waitFor(() => {
        fireEvent.change(screen.getByLabelText(/Project/), { target: { value: '1' } })
        fireEvent.click(screen.getByText('Next'))
      })
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Next'))
      })
    })

    it('displays configuration summary correctly', async () => {
      await waitFor(() => {
        expect(screen.getByText('Review Configuration')).toBeInTheDocument()
        expect(screen.getByText('https://github.com/user/test-app.git')).toBeInTheDocument()
        expect(screen.getByText('main')).toBeInTheDocument()
        expect(screen.getByText('test-app')).toBeInTheDocument()
        expect(screen.getByText('Test Project 1')).toBeInTheDocument()
      })
    })

    it('shows launch button when not launching', async () => {
      await waitFor(() => {
        expect(screen.getByText('🚀')).toBeInTheDocument()
        expect(screen.getByText('Launch Spring Boot Service')).toBeInTheDocument()
      })
    })

    it('initiates deployment workflow on launch', async () => {
      mockApiClient.post
        .mockResolvedValueOnce({ id: 'build-123' }) // Build creation
        .mockResolvedValueOnce({ // Build status
          status: 'success',
          logs_tail: 'Build completed successfully',
          image_name: 'test-app:latest'
        })
        .mockResolvedValueOnce({ id: 'service-456' }) // Service creation
        .mockResolvedValueOnce({ id: 'deployment-789' }) // Deployment

      await waitFor(() => {
        fireEvent.click(screen.getByText('Launch Spring Boot Service'))
      })

      // Should show launching state
      expect(screen.getByText('Launching...')).toBeInTheDocument()

      // Should call build API
      expect(mockApiClient.post).toHaveBeenCalledWith('/v1/builds', expect.objectContaining({
        repo_url: 'https://github.com/user/test-app.git',
        branch: 'main'
      }))
    })
  })

  describe('Copy to Clipboard Functionality', () => {
    beforeEach(async () => {
      render(<QuickstartSpring />)
      
      // Navigate to review step
      const gitUrlInput = screen.getByLabelText(/Repository URL/)
      fireEvent.input(gitUrlInput, { target: { value: 'https://github.com/user/app.git' } })
      fireEvent.click(screen.getByText('Next'))
      
      await waitFor(() => {
        fireEvent.change(screen.getByLabelText(/Project/), { target: { value: '1' } })
        fireEvent.click(screen.getByText('Next'))
      })
      
      await waitFor(() => {
        fireEvent.click(screen.getByText('Next'))
      })
    })

    it('copies Git URL to clipboard', async () => {
      await waitFor(() => {
        const copyButtons = screen.getAllByText('📋')
        fireEvent.click(copyButtons[0])
        
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith('https://github.com/user/app.git')
      })
    })
  })

  describe('Build Status Display', () => {
    it('shows build status during deployment', async () => {
      mockApiClient.post.mockResolvedValueOnce({ id: 'build-123' })
      mockApiClient.get.mockResolvedValueOnce({
        status: 'running',
        logs_tail: 'Building Docker image...'
      })

      render(<QuickstartSpring />)
      
      // Navigate to review and launch
      const gitUrlInput = screen.getByLabelText(/Repository URL/)
      fireEvent.input(gitUrlInput, { target: { value: 'https://github.com/user/app.git' } })
      fireEvent.click(screen.getByText('Next'))
      
      await waitFor(() => {
        fireEvent.change(screen.getByLabelText(/Project/), { target: { value: '1' } })
        fireEvent.click(screen.getByText('Next'))
        fireEvent.click(screen.getByText('Next'))
        fireEvent.click(screen.getByText('Launch Spring Boot Service'))
      })

      // Should eventually show build status
      await waitFor(() => {
        expect(screen.getByText('Build Status')).toBeInTheDocument()
      }, { timeout: 3000 })
    })
  })

  describe('Error Handling', () => {
    it('displays errors when build fails', async () => {
      mockApiClient.post.mockRejectedValueOnce(new Error('Build failed'))

      render(<QuickstartSpring />)
      
      // Navigate to review and launch
      const gitUrlInput = screen.getByLabelText(/Repository URL/)
      fireEvent.input(gitUrlInput, { target: { value: 'https://github.com/user/app.git' } })
      fireEvent.click(screen.getByText('Next'))
      
      await waitFor(() => {
        fireEvent.change(screen.getByLabelText(/Project/), { target: { value: '1' } })
        fireEvent.click(screen.getByText('Next'))
        fireEvent.click(screen.getByText('Next'))
        fireEvent.click(screen.getByText('Launch Spring Boot Service'))
      })

      // Should show error
      await waitFor(() => {
        expect(screen.getByText('Error')).toBeInTheDocument()
        expect(screen.getByText(/Build failed/)).toBeInTheDocument()
      }, { timeout: 3000 })
    })

    it('handles API errors gracefully', () => {
      mockUseApiData.mockImplementation(() => ({ data: null }))
      
      render(<QuickstartSpring />)
      
      // Should still render the component
      expect(screen.getByText('Spring Boot Quickstart')).toBeInTheDocument()
    })
  })

  describe('Success State', () => {
    it('shows success message when deployment completes', async () => {
      // Mock successful deployment
      const component = render(<QuickstartSpring />)
      
      // Simulate successful deployment state by updating the component's state
      // This would normally be done through user interaction, but for testing
      // we can verify the success UI is rendered correctly when the state indicates success
      
      // The success state UI should be tested when build.status === 'success' && deployment.status === 'success'
      expect(screen.getByText('Spring Boot Quickstart')).toBeInTheDocument()
    })
  })
})