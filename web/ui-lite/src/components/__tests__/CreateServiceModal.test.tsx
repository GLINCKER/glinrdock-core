/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import { CreateServiceModal } from '../CreateServiceModal'

// Mock components
vi.mock('../Modal', () => ({
  Modal: ({ isOpen, children, title }: any) =>
    isOpen ? (
      <div data-testid="modal">
        <h2>{title}</h2>
        {children}
      </div>
    ) : null
}))

vi.mock('../KVPairs', () => ({
  KVPairs: ({ onChange, value }: any) => (
    <div data-testid="kv-pairs">
      <button onClick={() => onChange({ NODE_ENV: 'test' })}>
        Add Env Var
      </button>
    </div>
  )
}))

vi.mock('../PortsEditor', () => ({
  PortsEditor: ({ onChange, value }: any) => (
    <div data-testid="ports-editor">
      <button onClick={() => onChange([{ container: 8080, host: 8081 }])}>
        Add Port
      </button>
    </div>
  )
}))

describe('CreateServiceModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSubmit: vi.fn().mockResolvedValue(undefined),
    projectName: 'test-project'
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders modal when open', () => {
    render(<CreateServiceModal {...defaultProps} />)
    
    expect(screen.getByTestId('modal')).toBeInTheDocument()
    expect(screen.getByText('Deploy Service to test-project')).toBeInTheDocument()
  })

  it('does not render when closed', () => {
    render(<CreateServiceModal {...defaultProps} isOpen={false} />)
    
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
  })

  it('renders all form fields', () => {
    render(<CreateServiceModal {...defaultProps} />)
    
    expect(screen.getByLabelText(/Service Name/)).toBeInTheDocument()
    expect(screen.getByLabelText(/Docker Image/)).toBeInTheDocument()
    expect(screen.getByTestId('kv-pairs')).toBeInTheDocument()
    expect(screen.getByTestId('ports-editor')).toBeInTheDocument()
  })

  it('renders popular image suggestions', () => {
    render(<CreateServiceModal {...defaultProps} />)
    
    expect(screen.getByText('nginx:alpine')).toBeInTheDocument()
    expect(screen.getByText('node:18-alpine')).toBeInTheDocument()
    expect(screen.getByText('postgres:15')).toBeInTheDocument()
  })

  it('allows selecting popular images', () => {
    render(<CreateServiceModal {...defaultProps} />)
    
    const nginxButton = screen.getByText('nginx:alpine')
    fireEvent.click(nginxButton)
    
    const imageInput = screen.getByLabelText(/Docker Image/) as HTMLInputElement
    expect(imageInput.value).toBe('nginx:alpine')
  })

  it('validates required fields', async () => {
    render(<CreateServiceModal {...defaultProps} />)
    
    const submitButton = screen.getByText('Deploy Service')
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Service name is required')).toBeInTheDocument()
    })
    
    expect(defaultProps.onSubmit).not.toHaveBeenCalled()
  })

  it('validates service name format', async () => {
    render(<CreateServiceModal {...defaultProps} />)
    
    const nameInput = screen.getByLabelText(/Service Name/)
    const imageInput = screen.getByLabelText(/Docker Image/)
    
    fireEvent.input(nameInput, { target: { value: 'Invalid Name!' } })
    fireEvent.input(imageInput, { target: { value: 'nginx:alpine' } })
    
    const submitButton = screen.getByText('Deploy Service')
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText(/must be lowercase alphanumeric/)).toBeInTheDocument()
    })
  })

  it('submits valid service data', async () => {
    render(<CreateServiceModal {...defaultProps} />)
    
    const nameInput = screen.getByLabelText(/Service Name/)
    const imageInput = screen.getByLabelText(/Docker Image/)
    
    fireEvent.input(nameInput, { target: { value: 'my-api' } })
    fireEvent.input(imageInput, { target: { value: 'nginx:alpine' } })
    
    // Add environment variables
    const addEnvButton = screen.getByText('Add Env Var')
    fireEvent.click(addEnvButton)
    
    // Add ports
    const addPortButton = screen.getByText('Add Port')
    fireEvent.click(addPortButton)
    
    const submitButton = screen.getByText('Deploy Service')
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(defaultProps.onSubmit).toHaveBeenCalledWith({
        name: 'my-api',
        image: 'nginx:alpine',
        env: { NODE_ENV: 'test' },
        ports: [{ container: 8080, host: 8081 }]
      })
    })
  })

  it('shows loading state during submission', async () => {
    const slowOnSubmit = vi.fn(() => new Promise(resolve => setTimeout(resolve, 100)))
    render(<CreateServiceModal {...defaultProps} onSubmit={slowOnSubmit} />)
    
    const nameInput = screen.getByLabelText(/Service Name/)
    const imageInput = screen.getByLabelText(/Docker Image/)
    
    fireEvent.input(nameInput, { target: { value: 'my-api' } })
    fireEvent.input(imageInput, { target: { value: 'nginx:alpine' } })
    
    const submitButton = screen.getByText('Deploy Service')
    fireEvent.click(submitButton)
    
    expect(screen.getByText('Deploying...')).toBeInTheDocument()
    expect(submitButton).toBeDisabled()
  })

  it('handles submission errors', async () => {
    const mockOnSubmit = vi.fn().mockRejectedValue(new Error('Service creation failed'))
    render(<CreateServiceModal {...defaultProps} onSubmit={mockOnSubmit} />)
    
    const nameInput = screen.getByLabelText(/Service Name/)
    const imageInput = screen.getByLabelText(/Docker Image/)
    
    fireEvent.input(nameInput, { target: { value: 'my-api' } })
    fireEvent.input(imageInput, { target: { value: 'nginx:alpine' } })
    
    const submitButton = screen.getByText('Deploy Service')
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Service creation failed')).toBeInTheDocument()
    })
  })

  it('resets form on close', () => {
    render(<CreateServiceModal {...defaultProps} />)
    
    const nameInput = screen.getByLabelText(/Service Name/) as HTMLInputElement
    fireEvent.input(nameInput, { target: { value: 'test-name' } })
    
    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)
    
    expect(defaultProps.onClose).toHaveBeenCalled()
    
    // Rerender to simulate reopening
    render(<CreateServiceModal {...defaultProps} />)
    const newNameInput = screen.getByLabelText(/Service Name/) as HTMLInputElement
    expect(newNameInput.value).toBe('')
  })

  it('disables submit button when form is invalid', () => {
    render(<CreateServiceModal {...defaultProps} />)
    
    const submitButton = screen.getByText('Deploy Service')
    expect(submitButton).toBeDisabled()
    
    const nameInput = screen.getByLabelText(/Service Name/)
    fireEvent.input(nameInput, { target: { value: 'test' } })
    
    // Still disabled without image
    expect(submitButton).toBeDisabled()
    
    const imageInput = screen.getByLabelText(/Docker Image/)
    fireEvent.input(imageInput, { target: { value: 'nginx' } })
    
    // Now enabled
    expect(submitButton).not.toBeDisabled()
  })

  it('validates port conflicts', async () => {
    const mockPortsEditor = vi.fn(({ onChange }: any) => (
      <div data-testid="ports-editor">
        <button onClick={() => onChange([
          { container: 8080, host: 8080 },
          { container: 3000, host: 8080 } // Duplicate host port
        ])}>
          Add Conflicting Ports
        </button>
      </div>
    ))
    
    vi.mocked(require('../PortsEditor')).PortsEditor = mockPortsEditor
    
    render(<CreateServiceModal {...defaultProps} />)
    
    const nameInput = screen.getByLabelText(/Service Name/)
    const imageInput = screen.getByLabelText(/Docker Image/)
    
    fireEvent.input(nameInput, { target: { value: 'test' } })
    fireEvent.input(imageInput, { target: { value: 'nginx' } })
    
    const conflictButton = screen.getByText('Add Conflicting Ports')
    fireEvent.click(conflictButton)
    
    const submitButton = screen.getByText('Deploy Service')
    fireEvent.click(submitButton)
    
    await waitFor(() => {
      expect(screen.getByText('Host ports must be unique')).toBeInTheDocument()
    })
  })
})