import { render, screen, fireEvent, waitFor } from '@testing-library/preact'
import { vi } from 'vitest'
import { HealthStatusBadge } from '../components/HealthStatusBadge'
import { CrashLoopBanner } from '../components/CrashLoopBanner'
import { HealthCheckButton } from '../components/HealthCheckButton'
import { apiClient } from '../api'

// Mock API client
vi.mock('../api', () => ({
  apiClient: {
    unlockService: vi.fn(),
    runHealthCheck: vi.fn()
  }
}))

const mockApiClient = apiClient as any

describe('Health Status Components', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('HealthStatusBadge', () => {
    it('renders healthy status correctly', () => {
      render(
        <HealthStatusBadge 
          status="ok" 
          lastProbeAt="2024-01-01T12:00:00Z"
        />
      )

      expect(screen.getByText('Healthy')).toBeInTheDocument()
      expect(screen.getByText('✓')).toBeInTheDocument()
    })

    it('renders unhealthy status correctly', () => {
      render(
        <HealthStatusBadge 
          status="fail" 
          lastProbeAt="2024-01-01T12:00:00Z"
        />
      )

      expect(screen.getByText('Unhealthy')).toBeInTheDocument()
      expect(screen.getByText('✗')).toBeInTheDocument()
    })

    it('renders unknown status correctly', () => {
      render(<HealthStatusBadge status="unknown" />)

      expect(screen.getByText('Unknown')).toBeInTheDocument()
      expect(screen.getByText('?')).toBeInTheDocument()
    })

    it('displays probe time when available', () => {
      const recentTime = new Date(Date.now() - 60000).toISOString() // 1 minute ago
      
      render(
        <HealthStatusBadge 
          status="ok" 
          lastProbeAt={recentTime}
        />
      )

      // Should show some indication of "1 minute ago" or similar
      // The exact text depends on the formatTimeAgo implementation
      expect(screen.getByText(/ago/)).toBeInTheDocument()
    })

    it('handles missing probe time gracefully', () => {
      render(<HealthStatusBadge status="ok" />)

      expect(screen.getByText('Healthy')).toBeInTheDocument()
      // Should not show probe time
      expect(screen.queryByText(/ago/)).not.toBeInTheDocument()
    })
  })

  describe('CrashLoopBanner', () => {
    const defaultProps = {
      serviceId: '1',
      serviceName: 'test-service',
      restartCount: 5,
      lastExitCode: 1,
      canUnlock: true,
      onUnlock: vi.fn()
    }

    it('renders crash loop information correctly', () => {
      render(<CrashLoopBanner {...defaultProps} />)

      expect(screen.getByText('Service in Crash Loop')).toBeInTheDocument()
      expect(screen.getByText(/test-service.*stopped/)).toBeInTheDocument()
      expect(screen.getByText(/Restart attempts:.*5/)).toBeInTheDocument()
      expect(screen.getByText(/Last exit code:.*1/)).toBeInTheDocument()
    })

    it('shows unlock button when user can unlock', () => {
      render(<CrashLoopBanner {...defaultProps} />)

      expect(screen.getByText('Unlock and Start')).toBeInTheDocument()
    })

    it('hides unlock button when user cannot unlock', () => {
      render(<CrashLoopBanner {...defaultProps} canUnlock={false} />)

      expect(screen.queryByText('Unlock and Start')).not.toBeInTheDocument()
    })

    it('handles unlock action correctly', async () => {
      mockApiClient.unlockService.mockResolvedValueOnce({})
      const onUnlock = vi.fn()

      render(<CrashLoopBanner {...defaultProps} onUnlock={onUnlock} />)

      fireEvent.click(screen.getByText('Unlock and Start'))

      await waitFor(() => {
        expect(mockApiClient.unlockService).toHaveBeenCalledWith('1')
        expect(onUnlock).toHaveBeenCalled()
      })
    })

    it('shows loading state during unlock', async () => {
      mockApiClient.unlockService.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      )

      render(<CrashLoopBanner {...defaultProps} />)

      fireEvent.click(screen.getByText('Unlock and Start'))

      expect(screen.getByText('Unlocking...')).toBeInTheDocument()
      
      await waitFor(() => {
        expect(screen.getByText('Unlock and Start')).toBeInTheDocument()
      })
    })

    it('handles unlock error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockApiClient.unlockService.mockRejectedValueOnce(new Error('Network error'))

      render(<CrashLoopBanner {...defaultProps} />)

      fireEvent.click(screen.getByText('Unlock and Start'))

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to unlock service:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })

    it('handles missing exit code gracefully', () => {
      render(<CrashLoopBanner {...defaultProps} lastExitCode={undefined} />)

      expect(screen.getByText('Service in Crash Loop')).toBeInTheDocument()
      expect(screen.queryByText(/Last exit code/)).not.toBeInTheDocument()
    })
  })

  describe('HealthCheckButton', () => {
    it('renders health check button correctly', () => {
      render(<HealthCheckButton serviceId="1" />)

      expect(screen.getByText('Run health check')).toBeInTheDocument()
    })

    it('handles health check action correctly', async () => {
      const healthResult = {
        message: 'Health check completed',
        service_id: 1,
        health_status: 'ok' as const,
        last_probe_at: '2024-01-01T12:00:00Z'
      }
      
      mockApiClient.runHealthCheck.mockResolvedValueOnce(healthResult)
      const onHealthUpdate = vi.fn()

      render(
        <HealthCheckButton 
          serviceId="1" 
          onHealthUpdate={onHealthUpdate}
        />
      )

      fireEvent.click(screen.getByText('Run health check'))

      await waitFor(() => {
        expect(mockApiClient.runHealthCheck).toHaveBeenCalledWith('1')
        expect(onHealthUpdate).toHaveBeenCalledWith('ok', '2024-01-01T12:00:00Z')
      })
    })

    it('shows loading state during health check', async () => {
      mockApiClient.runHealthCheck.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 100))
      )

      render(<HealthCheckButton serviceId="1" />)

      fireEvent.click(screen.getByText('Run health check'))

      expect(screen.getByText('Checking...')).toBeInTheDocument()
      
      await waitFor(() => {
        expect(screen.getByText('Run health check')).toBeInTheDocument()
      })
    })

    it('handles health check error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      mockApiClient.runHealthCheck.mockRejectedValueOnce(new Error('Network error'))

      render(<HealthCheckButton serviceId="1" />)

      fireEvent.click(screen.getByText('Run health check'))

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Health check failed:', expect.any(Error))
      })

      consoleSpy.mockRestore()
    })

    it('supports different button sizes', () => {
      const { rerender } = render(<HealthCheckButton serviceId="1" size="sm" />)
      
      let button = screen.getByText('Run health check')
      expect(button).toHaveClass('px-2', 'py-1', 'text-xs')

      rerender(<HealthCheckButton serviceId="1" size="md" />)
      
      button = screen.getByText('Run health check')
      expect(button).toHaveClass('px-3', 'py-2', 'text-sm')
    })

    it('applies custom className', () => {
      render(<HealthCheckButton serviceId="1" className="custom-class" />)
      
      expect(screen.getByText('Run health check')).toHaveClass('custom-class')
    })

    it('disables button during health check', async () => {
      mockApiClient.runHealthCheck.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 100))
      )

      render(<HealthCheckButton serviceId="1" />)

      const button = screen.getByText('Run health check')
      fireEvent.click(button)

      expect(button).toBeDisabled()
      
      await waitFor(() => {
        expect(button).not.toBeDisabled()
      })
    })

    it('prevents multiple concurrent health checks', async () => {
      mockApiClient.runHealthCheck.mockImplementation(() =>
        new Promise(resolve => setTimeout(resolve, 100))
      )

      render(<HealthCheckButton serviceId="1" />)

      const button = screen.getByText('Run health check')
      
      // Click multiple times quickly
      fireEvent.click(button)
      fireEvent.click(button)
      fireEvent.click(button)

      await waitFor(() => {
        // Should only be called once despite multiple clicks
        expect(mockApiClient.runHealthCheck).toHaveBeenCalledTimes(1)
      })
    })

    it('calls onHealthUpdate only when provided', async () => {
      const healthResult = {
        message: 'Health check completed',
        service_id: 1,
        health_status: 'fail' as const,
        last_probe_at: '2024-01-01T12:00:00Z'
      }
      
      mockApiClient.runHealthCheck.mockResolvedValueOnce(healthResult)

      // Render without onHealthUpdate callback
      render(<HealthCheckButton serviceId="1" />)

      fireEvent.click(screen.getByText('Run health check'))

      await waitFor(() => {
        expect(mockApiClient.runHealthCheck).toHaveBeenCalledWith('1')
      })

      // Should not throw error when onHealthUpdate is not provided
    })
  })

  describe('Integration Tests', () => {
    it('crash loop banner and health check button work together', async () => {
      const onUnlock = vi.fn()
      mockApiClient.unlockService.mockResolvedValueOnce({})

      render(
        <div>
          <CrashLoopBanner
            serviceId="1"
            serviceName="test-service"
            restartCount={5}
            lastExitCode={1}
            canUnlock={true}
            onUnlock={onUnlock}
          />
          <HealthCheckButton serviceId="1" />
        </div>
      )

      // Both components should be rendered
      expect(screen.getByText('Service in Crash Loop')).toBeInTheDocument()
      expect(screen.getByText('Run health check')).toBeInTheDocument()

      // Unlock the service
      fireEvent.click(screen.getByText('Unlock and Start'))

      await waitFor(() => {
        expect(mockApiClient.unlockService).toHaveBeenCalledWith('1')
        expect(onUnlock).toHaveBeenCalled()
      })
    })

    it('health status badge reflects health check results', async () => {
      const healthResult = {
        message: 'Health check completed',
        service_id: 1,
        health_status: 'ok' as const,
        last_probe_at: '2024-01-01T12:00:00Z'
      }
      
      mockApiClient.runHealthCheck.mockResolvedValueOnce(healthResult)

      let currentStatus = 'unknown'
      let currentProbeTime = undefined

      const onHealthUpdate = (status: string, probeTime: string) => {
        currentStatus = status
        currentProbeTime = probeTime
      }

      const { rerender } = render(
        <div>
          <HealthStatusBadge 
            status={currentStatus as any} 
            lastProbeAt={currentProbeTime}
          />
          <HealthCheckButton 
            serviceId="1" 
            onHealthUpdate={onHealthUpdate}
          />
        </div>
      )

      // Initially shows unknown status
      expect(screen.getByText('Unknown')).toBeInTheDocument()

      // Run health check
      fireEvent.click(screen.getByText('Run health check'))

      await waitFor(() => {
        expect(mockApiClient.runHealthCheck).toHaveBeenCalledWith('1')
      })

      // Re-render with updated status
      rerender(
        <div>
          <HealthStatusBadge 
            status={currentStatus as any} 
            lastProbeAt={currentProbeTime}
          />
          <HealthCheckButton 
            serviceId="1" 
            onHealthUpdate={onHealthUpdate}
          />
        </div>
      )

      // Should now show healthy status
      expect(screen.getByText('Healthy')).toBeInTheDocument()
    })
  })
})