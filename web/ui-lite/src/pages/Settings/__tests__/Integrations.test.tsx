import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import { Integrations } from '../Integrations'

// Mock the API client
const mockApiClient = {
  get: jest.fn(),
  put: jest.fn(),
}

jest.mock('../../../api', () => ({
  apiClient: mockApiClient,
  useApiData: jest.fn(),
}))

// Mock the RBAC module
const mockIsAdminSync = jest.fn()
jest.mock('../../../rbac', () => ({
  isAdminSync: mockIsAdminSync,
}))

describe('Integrations', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Default to admin user
    mockIsAdminSync.mockReturnValue(true)
    
    // Mock useApiData hook
    const { useApiData } = require('../../../api')
    useApiData.mockReturnValue({
      data: null,
      refetch: jest.fn(),
    })
  })

  it('renders integrations setup page', () => {
    render(<Integrations />)
    
    expect(screen.getByText('Integrations Setup')).toBeInTheDocument()
    expect(screen.getByText('GitHub OAuth Login')).toBeInTheDocument()
    expect(screen.getByText('GitHub App (Repository Access & Webhooks)')).toBeInTheDocument()
  })

  it('shows admin-only message for non-admin users', () => {
    mockIsAdminSync.mockReturnValue(false)
    
    render(<Integrations />)
    
    expect(screen.getByText(/Admin privileges required/)).toBeInTheDocument()
  })

  it('loads existing configuration', () => {
    const mockConfig = {
      github_oauth: {
        mode: 'pkce',
        client_id: 'test-client-id',
        has_client_secret: false,
      },
      github_app: {
        installed: true,
        app_id: '123456',
        has_private_key: true,
      },
    }

    const { useApiData } = require('../../../api')
    useApiData.mockReturnValue({
      data: mockConfig,
      refetch: jest.fn(),
    })
    
    render(<Integrations />)
    
    // Check that OAuth fields are populated
    const clientIdInput = screen.getByDisplayValue('test-client-id')
    expect(clientIdInput).toBeInTheDocument()
    
    // Check that App ID field is populated
    const appIdInput = screen.getByDisplayValue('123456')
    expect(appIdInput).toBeInTheDocument()
  })

  it('validates OAuth configuration', async () => {
    render(<Integrations />)
    
    // Try to save OAuth without client ID
    const oauthModeSelect = screen.getByDisplayValue('off')
    fireEvent.change(oauthModeSelect, { target: { value: 'pkce' } })
    
    const saveOAuthButton = screen.getByText('Save OAuth Configuration')
    fireEvent.click(saveOAuthButton)
    
    await waitFor(() => {
      expect(screen.getByText(/Client ID is required/)).toBeInTheDocument()
    })
  })

  it('validates App configuration', async () => {
    render(<Integrations />)
    
    // Try to save App with invalid App ID
    const appIdInput = screen.getByPlaceholderText(/Enter your GitHub App ID/)
    fireEvent.change(appIdInput, { target: { value: 'invalid' } })
    
    const saveAppButton = screen.getByText('Save App Configuration')
    fireEvent.click(saveAppButton)
    
    await waitFor(() => {
      expect(screen.getByText(/App ID must be numeric/)).toBeInTheDocument()
    })
  })

  it('saves OAuth configuration successfully', async () => {
    mockApiClient.put.mockResolvedValue({})
    
    const refetchMock = jest.fn()
    const { useApiData } = require('../../../api')
    useApiData.mockReturnValue({
      data: null,
      refetch: refetchMock,
    })
    
    render(<Integrations />)
    
    // Configure OAuth
    const oauthModeSelect = screen.getByDisplayValue('off')
    fireEvent.change(oauthModeSelect, { target: { value: 'pkce' } })
    
    const clientIdInput = screen.getByPlaceholderText(/Enter your GitHub OAuth Client ID/)
    fireEvent.change(clientIdInput, { target: { value: 'test-client-id' } })
    
    const saveOAuthButton = screen.getByText('Save OAuth Configuration')
    fireEvent.click(saveOAuthButton)
    
    await waitFor(() => {
      expect(mockApiClient.put).toHaveBeenCalledWith('/settings/integrations', {
        github_oauth: {
          mode: 'pkce',
          client_id: 'test-client-id',
        },
      })
    })
    
    expect(refetchMock).toHaveBeenCalled()
  })

  it('saves App configuration successfully', async () => {
    mockApiClient.put.mockResolvedValue({})
    
    const refetchMock = jest.fn()
    const { useApiData } = require('../../../api')
    useApiData.mockReturnValue({
      data: null,
      refetch: refetchMock,
    })
    
    render(<Integrations />)
    
    // Configure GitHub App
    const appIdInput = screen.getByPlaceholderText(/Enter your GitHub App ID/)
    fireEvent.change(appIdInput, { target: { value: '123456' } })
    
    const privateKeyTextarea = screen.getByPlaceholderText(/Paste your GitHub App private key/)
    fireEvent.change(privateKeyTextarea, { target: { value: '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----' } })
    
    const saveAppButton = screen.getByText('Save App Configuration')
    fireEvent.click(saveAppButton)
    
    await waitFor(() => {
      expect(mockApiClient.put).toHaveBeenCalledWith('/settings/integrations', {
        github_app: {
          app_id: '123456',
          private_key_pem: '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
        },
      })
    })
    
    expect(refetchMock).toHaveBeenCalled()
  })

  it('shows masked secrets correctly', () => {
    const mockConfig = {
      github_oauth: {
        mode: 'confidential',
        client_id: 'test-client-id',
        has_client_secret: true,
      },
      github_app: {
        installed: true,
        app_id: '123456',
        has_private_key: true,
      },
    }

    const { useApiData } = require('../../../api')
    useApiData.mockReturnValue({
      data: mockConfig,
      refetch: jest.fn(),
    })
    
    render(<Integrations />)
    
    // Check that secret is masked
    expect(screen.getByPlaceholderText(/••••••••••••••••/)).toBeInTheDocument()
    expect(screen.getByText(/Secret is configured and encrypted/)).toBeInTheDocument()
    expect(screen.getByText(/Key configured and encrypted/)).toBeInTheDocument()
  })

  it('handles file upload for private key', () => {
    render(<Integrations />)
    
    const fileInput = screen.getByLabelText(/Or upload PEM file/)
    const file = new File(['-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----'], 'private-key.pem', { type: 'text/plain' })
    
    // Mock FileReader
    const mockFileReader = {
      readAsText: jest.fn(),
      onload: null,
      result: '-----BEGIN RSA PRIVATE KEY-----\ntest\n-----END RSA PRIVATE KEY-----',
    }
    
    global.FileReader = jest.fn(() => mockFileReader) as any
    
    fireEvent.change(fileInput, { target: { files: [file] } })
    
    // Simulate FileReader onload
    if (mockFileReader.onload) {
      mockFileReader.onload({ target: mockFileReader } as any)
    }
    
    expect(mockFileReader.readAsText).toHaveBeenCalledWith(file)
  })

  it('handles API errors gracefully', async () => {
    mockApiClient.put.mockRejectedValue(new Error('Network error'))
    
    render(<Integrations />)
    
    // Try to save OAuth configuration
    const oauthModeSelect = screen.getByDisplayValue('off')
    fireEvent.change(oauthModeSelect, { target: { value: 'pkce' } })
    
    const clientIdInput = screen.getByPlaceholderText(/Enter your GitHub OAuth Client ID/)
    fireEvent.change(clientIdInput, { target: { value: 'test-client-id' } })
    
    const saveOAuthButton = screen.getByText('Save OAuth Configuration')
    fireEvent.click(saveOAuthButton)
    
    await waitFor(() => {
      expect(screen.getByText(/Network error/)).toBeInTheDocument()
    })
  })
})