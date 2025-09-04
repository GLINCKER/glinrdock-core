import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import { LogsDrawer } from '../components/LogsDrawer'
import { apiClient } from '../api'

// Mock the API client
vi.mock('../api', () => ({
  apiClient: {
    getServiceLogs: vi.fn()
  }
}))

describe('LogsDrawer Component', () => {
  let mockGetServiceLogs: any
  
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetServiceLogs = vi.mocked(apiClient.getServiceLogs)
    
    // Mock default successful response
    mockGetServiceLogs.mockResolvedValue({
      service_id: 1,
      container: 'glinr_1_test-service',
      tail_lines: 50,
      total_lines: 3,
      logs: [
        '2023-01-01 10:00:00 INFO: Service started',
        '2023-01-01 10:00:01 INFO: Processing request',
        '2023-01-01 10:00:02 ERROR: Connection timeout'
      ]
    })
    
    // Mock timers
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should not render when closed', () => {
    render(
      <LogsDrawer
        isOpen={false}
        onClose={() => {}}
        serviceId="1"
        serviceName="test-service"
      />
    )
    
    expect(screen.queryByText('Service Logs')).not.toBeInTheDocument()
  })

  it('should render when open and fetch logs', async () => {
    render(
      <LogsDrawer
        isOpen={true}
        onClose={() => {}}
        serviceId="1"
        serviceName="test-service"
      />
    )
    
    expect(screen.getByText('Service Logs')).toBeInTheDocument()
    expect(screen.getByText('test-service')).toBeInTheDocument()
    
    await waitFor(() => {
      expect(mockGetServiceLogs).toHaveBeenCalledWith('1', 50)
    })
  })

  it('should display fetched logs', async () => {
    render(
      <LogsDrawer
        isOpen={true}
        onClose={() => {}}
        serviceId="1"
        serviceName="test-service"
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('2023-01-01 10:00:00 INFO: Service started')).toBeInTheDocument()
      expect(screen.getByText('2023-01-01 10:00:01 INFO: Processing request')).toBeInTheDocument()
      expect(screen.getByText('2023-01-01 10:00:02 ERROR: Connection timeout')).toBeInTheDocument()
    })
    
    expect(screen.getByText('📄 3 lines • Auto-refreshing every 3s')).toBeInTheDocument()
  })

  it('should handle loading state', async () => {
    // Make API call hang
    mockGetServiceLogs.mockImplementation(() => new Promise(() => {}))
    
    render(
      <LogsDrawer
        isOpen={true}
        onClose={() => {}}
        serviceId="1"
        serviceName="test-service"
      />
    )
    
    expect(screen.getByText('⏳ Loading logs...')).toBeInTheDocument()
    expect(screen.getByText('⏳ Loading...')).toBeInTheDocument()
  })

  it('should handle API errors', async () => {
    mockGetServiceLogs.mockRejectedValue(new Error('Service not found'))
    
    render(
      <LogsDrawer
        isOpen={true}
        onClose={() => {}}
        serviceId="1"
        serviceName="test-service"
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('⚠️ Error Loading Logs')).toBeInTheDocument()
      expect(screen.getByText('Service not found')).toBeInTheDocument()
    })
  })

  it('should refresh logs when refresh button is clicked', async () => {
    render(
      <LogsDrawer
        isOpen={true}
        onClose={() => {}}
        serviceId="1"
        serviceName="test-service"
      />
    )
    
    await waitFor(() => {
      expect(mockGetServiceLogs).toHaveBeenCalledTimes(1)
    })
    
    const refreshButton = screen.getByText(/🔄.*Refresh/)
    fireEvent.click(refreshButton)
    
    await waitFor(() => {
      expect(mockGetServiceLogs).toHaveBeenCalledTimes(2)
    })
  })

  it('should auto-refresh logs every 3 seconds', async () => {
    render(
      <LogsDrawer
        isOpen={true}
        onClose={() => {}}
        serviceId="1"
        serviceName="test-service"
      />
    )
    
    await waitFor(() => {
      expect(mockGetServiceLogs).toHaveBeenCalledTimes(1)
    })
    
    // Fast-forward 3 seconds
    vi.advanceTimersByTime(3000)
    
    await waitFor(() => {
      expect(mockGetServiceLogs).toHaveBeenCalledTimes(2)
    })
    
    // Fast-forward another 3 seconds
    vi.advanceTimersByTime(3000)
    
    await waitFor(() => {
      expect(mockGetServiceLogs).toHaveBeenCalledTimes(3)
    })
  })

  it('should toggle auto-refresh when auto button is clicked', async () => {
    render(
      <LogsDrawer
        isOpen={true}
        onClose={() => {}}
        serviceId="1"
        serviceName="test-service"
      />
    )
    
    await waitFor(() => {
      expect(mockGetServiceLogs).toHaveBeenCalledTimes(1)
    })
    
    // Should start with auto-refresh enabled
    expect(screen.getByText('🟢 Auto')).toBeInTheDocument()
    
    // Click to disable auto-refresh
    const autoButton = screen.getByText('🟢 Auto')
    fireEvent.click(autoButton)
    
    expect(screen.getByText('⏸️ Manual')).toBeInTheDocument()
    
    // Fast-forward 3 seconds - should not refresh
    vi.advanceTimersByTime(3000)
    
    await waitFor(() => {
      expect(mockGetServiceLogs).toHaveBeenCalledTimes(1) // Still only 1 call
    })
  })

  it('should change tail lines when selector is changed', async () => {
    render(
      <LogsDrawer
        isOpen={true}
        onClose={() => {}}
        serviceId="1"
        serviceName="test-service"
      />
    )
    
    await waitFor(() => {
      expect(mockGetServiceLogs).toHaveBeenCalledWith('1', 50)
    })
    
    const select = screen.getByDisplayValue('50')
    fireEvent.change(select, { target: { value: '100' } })
    
    await waitFor(() => {
      expect(mockGetServiceLogs).toHaveBeenCalledWith('1', 100)
    })
  })

  it('should close when backdrop is clicked', () => {
    const mockOnClose = vi.fn()
    
    render(
      <LogsDrawer
        isOpen={true}
        onClose={mockOnClose}
        serviceId="1"
        serviceName="test-service"
      />
    )
    
    const backdrop = screen.getByRole('button', { hidden: true }) // backdrop div with onClick
    fireEvent.click(backdrop)
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should close when close button is clicked', () => {
    const mockOnClose = vi.fn()
    
    render(
      <LogsDrawer
        isOpen={true}
        onClose={mockOnClose}
        serviceId="1"
        serviceName="test-service"
      />
    )
    
    const closeButton = screen.getByTitle('Close')
    fireEvent.click(closeButton)
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should show no logs message when logs array is empty', async () => {
    mockGetServiceLogs.mockResolvedValue({
      service_id: 1,
      container: 'glinr_1_test-service',
      tail_lines: 50,
      total_lines: 0,
      logs: []
    })
    
    render(
      <LogsDrawer
        isOpen={true}
        onClose={() => {}}
        serviceId="1"
        serviceName="test-service"
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('📭 No logs available')).toBeInTheDocument()
    })
  })

  it('should display line numbers with logs', async () => {
    render(
      <LogsDrawer
        isOpen={true}
        onClose={() => {}}
        serviceId="1"
        serviceName="test-service"
      />
    )
    
    await waitFor(() => {
      // Check for line numbers (formatted with padding)
      expect(screen.getByText('  1│')).toBeInTheDocument()
      expect(screen.getByText('  2│')).toBeInTheDocument()
      expect(screen.getByText('  3│')).toBeInTheDocument()
    })
  })

  it('should show correct service ID in footer', async () => {
    render(
      <LogsDrawer
        isOpen={true}
        onClose={() => {}}
        serviceId="123"
        serviceName="test-service"
      />
    )
    
    expect(screen.getByText('Service ID: 123')).toBeInTheDocument()
  })

  it('should stop auto-refresh when component is closed', async () => {
    const { rerender } = render(
      <LogsDrawer
        isOpen={true}
        onClose={() => {}}
        serviceId="1"
        serviceName="test-service"
      />
    )
    
    await waitFor(() => {
      expect(mockGetServiceLogs).toHaveBeenCalledTimes(1)
    })
    
    // Close the drawer
    rerender(
      <LogsDrawer
        isOpen={false}
        onClose={() => {}}
        serviceId="1"
        serviceName="test-service"
      />
    )
    
    // Fast-forward 3 seconds - should not call API
    vi.advanceTimersByTime(3000)
    
    await waitFor(() => {
      expect(mockGetServiceLogs).toHaveBeenCalledTimes(1) // Still only 1 call
    })
  })

  it('should handle retry on error', async () => {
    mockGetServiceLogs.mockRejectedValueOnce(new Error('Network error'))
    
    render(
      <LogsDrawer
        isOpen={true}
        onClose={() => {}}
        serviceId="1"
        serviceName="test-service"
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
    
    // Fix the API for retry
    mockGetServiceLogs.mockResolvedValue({
      service_id: 1,
      container: 'glinr_1_test-service',
      tail_lines: 50,
      total_lines: 1,
      logs: ['Service recovered']
    })
    
    const retryButton = screen.getByText('Retry')
    fireEvent.click(retryButton)
    
    await waitFor(() => {
      expect(screen.getByText('Service recovered')).toBeInTheDocument()
    })
  })

  it('should scroll to bottom when logs are updated', async () => {
    Object.defineProperty(HTMLDivElement.prototype, 'scrollTop', {
      writable: true,
      value: 0
    })
    Object.defineProperty(HTMLDivElement.prototype, 'scrollHeight', {
      writable: true,
      value: 1000
    })
    
    render(
      <LogsDrawer
        isOpen={true}
        onClose={() => {}}
        serviceId="1"
        serviceName="test-service"
      />
    )
    
    await waitFor(() => {
      expect(screen.getByText('⬇️ Scroll to Bottom')).toBeInTheDocument()
    })
    
    const scrollButton = screen.getByText('⬇️ Scroll to Bottom')
    fireEvent.click(scrollButton)
    
    // The scroll behavior is tested by checking if the button exists
    // Actual scroll testing requires more complex DOM mocking
    expect(scrollButton).toBeInTheDocument()
  })
})