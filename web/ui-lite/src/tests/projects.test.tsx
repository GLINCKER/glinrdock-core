/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import { Projects } from '../pages/Projects'
import { apiClient } from '../api'

// Mock the API client
vi.mock('../api', () => ({
  apiClient: {
    getProjects: vi.fn(),
    createProject: vi.fn(),
    deleteProject: vi.fn(),
    getProject: vi.fn(),
    getProjectServices: vi.fn(),
    getAuthInfo: vi.fn()
  },
  useApiData: vi.fn()
}))

// Mock RBAC
vi.mock('../rbac', () => ({
  isDeployerSync: vi.fn(() => true)
}))

// Mock components
vi.mock('../components/ui', () => ({
  Toast: ({ isVisible, message }: any) => 
    isVisible ? <div data-testid="toast">{message}</div> : null
}))

vi.mock('../components', () => ({
  CreateProjectModal: ({ isOpen, onSubmit }: any) => 
    isOpen ? (
      <div data-testid="create-modal">
        <button onClick={() => onSubmit({ name: 'test-project', description: 'test' })}>
          Create
        </button>
      </div>
    ) : null,
  ConfirmModal: ({ isOpen, onConfirm }: any) =>
    isOpen ? (
      <div data-testid="confirm-modal">
        <button onClick={onConfirm}>Confirm</button>
      </div>
    ) : null,
  Modal: ({ isOpen, children }: any) =>
    isOpen ? <div data-testid="detail-modal">{children}</div> : null
}))

describe('Projects Page', () => {
  const mockUseApiData = vi.mocked((global as any).useApiData || (() => ({ data: null, loading: false })))
  
  beforeEach(() => {
    vi.clearAllMocks()
    
    // Setup default mocks
    mockUseApiData.mockImplementation((fn: any) => {
      if (!fn) return { data: null, loading: false, refetch: vi.fn() }
      
      const fnStr = fn.toString()
      if (fnStr.includes('getProjects')) {
        return {
          data: [
            { id: 1, name: 'test-project-1', created_at: '2024-01-01T00:00:00Z' },
            { id: 2, name: 'test-project-2', created_at: '2024-01-02T00:00:00Z' }
          ],
          loading: false,
          refetch: vi.fn()
        }
      }
      
      if (fnStr.includes('getAuthInfo')) {
        return {
          data: { method: 'token', role: 'deployer' },
          loading: false,
          refetch: vi.fn()
        }
      }
      
      return { data: null, loading: false, refetch: vi.fn() }
    })
  })

  it('renders project list correctly', async () => {
    render(<Projects />)
    
    await waitFor(() => {
      expect(screen.getByText('Projects')).toBeInTheDocument()
      expect(screen.getByText('test-project-1')).toBeInTheDocument()
      expect(screen.getByText('test-project-2')).toBeInTheDocument()
    })
  })

  it('shows New Project button for users with deployer role', async () => {
    render(<Projects />)
    
    await waitFor(() => {
      expect(screen.getByText('New Project')).toBeInTheDocument()
    })
  })

  it('hides New Project button for viewers', async () => {
    const mockUseApiDataViewer = vi.fn((fn: any) => {
      if (!fn) return { data: null, loading: false, refetch: vi.fn() }
      
      const fnStr = fn.toString()
      if (fnStr.includes('getAuthInfo')) {
        return {
          data: { method: 'token', role: 'viewer' },
          loading: false,
          refetch: vi.fn()
        }
      }
      
      if (fnStr.includes('getProjects')) {
        return {
          data: [],
          loading: false,
          refetch: vi.fn()
        }
      }
      
      return { data: null, loading: false, refetch: vi.fn() }
    })
    
    vi.mocked(require('../rbac').isDeployerSync).mockReturnValue(false)
    ;(global as any).useApiData = mockUseApiDataViewer
    
    render(<Projects />)
    
    await waitFor(() => {
      expect(screen.queryByText('New Project')).not.toBeInTheDocument()
    })
  })

  it('opens create modal when New Project is clicked', async () => {
    render(<Projects />)
    
    await waitFor(() => {
      const newProjectButton = screen.getByText('New Project')
      fireEvent.click(newProjectButton)
    })
    
    expect(screen.getByTestId('create-modal')).toBeInTheDocument()
  })

  it('creates project successfully', async () => {
    const mockCreateProject = vi.mocked(apiClient.createProject).mockResolvedValue({
      id: 3,
      name: 'test-project',
      created_at: new Date().toISOString()
    })
    
    render(<Projects />)
    
    await waitFor(() => {
      const newProjectButton = screen.getByText('New Project')
      fireEvent.click(newProjectButton)
    })
    
    const createButton = screen.getByText('Create')
    fireEvent.click(createButton)
    
    await waitFor(() => {
      expect(mockCreateProject).toHaveBeenCalledWith({
        name: 'test-project',
        description: 'test'
      })
    })
  })

  it('shows delete confirmation modal', async () => {
    render(<Projects />)
    
    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete')
      fireEvent.click(deleteButtons[0])
    })
    
    expect(screen.getByTestId('confirm-modal')).toBeInTheDocument()
  })

  it('deletes project successfully', async () => {
    const mockDeleteProject = vi.mocked(apiClient.deleteProject).mockResolvedValue(undefined)
    
    render(<Projects />)
    
    await waitFor(() => {
      const deleteButtons = screen.getAllByText('Delete')
      fireEvent.click(deleteButtons[0])
    })
    
    const confirmButton = screen.getByText('Confirm')
    fireEvent.click(confirmButton)
    
    await waitFor(() => {
      expect(mockDeleteProject).toHaveBeenCalledWith('1')
    })
  })

  it('opens project detail modal when View is clicked', async () => {
    mockUseApiData.mockImplementation((fn: any) => {
      if (!fn) return { data: null, loading: false, refetch: vi.fn() }
      
      const fnStr = fn.toString()
      if (fnStr.includes('getProjects')) {
        return {
          data: [{ id: 1, name: 'test-project-1', created_at: '2024-01-01T00:00:00Z' }],
          loading: false,
          refetch: vi.fn()
        }
      }
      
      if (fnStr.includes('getProject')) {
        return {
          data: { id: 1, name: 'test-project-1', created_at: '2024-01-01T00:00:00Z' },
          loading: false,
          refetch: vi.fn()
        }
      }
      
      if (fnStr.includes('getAuthInfo')) {
        return {
          data: { method: 'token', role: 'deployer' },
          loading: false,
          refetch: vi.fn()
        }
      }
      
      return { data: null, loading: false, refetch: vi.fn() }
    })
    
    render(<Projects />)
    
    await waitFor(() => {
      const viewButton = screen.getByText('View')
      fireEvent.click(viewButton)
    })
    
    expect(screen.getByTestId('detail-modal')).toBeInTheDocument()
  })

  it('shows loading state correctly', () => {
    mockUseApiData.mockImplementation(() => ({
      data: null,
      loading: true,
      refetch: vi.fn()
    }))
    
    render(<Projects />)
    
    // Check for skeleton loading state
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()
  })

  it('shows empty state when no projects', async () => {
    mockUseApiData.mockImplementation((fn: any) => {
      if (!fn) return { data: null, loading: false, refetch: vi.fn() }
      
      const fnStr = fn.toString()
      if (fnStr.includes('getProjects')) {
        return {
          data: [],
          loading: false,
          refetch: vi.fn()
        }
      }
      
      if (fnStr.includes('getAuthInfo')) {
        return {
          data: { method: 'token', role: 'deployer' },
          loading: false,
          refetch: vi.fn()
        }
      }
      
      return { data: null, loading: false, refetch: vi.fn() }
    })
    
    render(<Projects />)
    
    await waitFor(() => {
      expect(screen.getByText('No projects yet')).toBeInTheDocument()
    })
  })
})