import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/preact'
import { QuotaBar } from '../QuotaBar'

describe('QuotaBar', () => {
  it('renders usage information correctly', () => {
    render(<QuotaBar label="Tokens" current={2} limit={5} />)
    
    expect(screen.getByText('Tokens')).toBeInTheDocument()
    expect(screen.getByText('2 / 5')).toBeInTheDocument()
  })

  it('renders progress bar with correct width', () => {
    render(<QuotaBar label="Tokens" current={3} limit={5} />)
    
    // Find progress bar by looking for the styled div
    const progressBar = screen.getByText('3/5').closest('div')?.parentElement?.querySelector('[style*="width"]')
    expect(progressBar).toHaveStyle('width: 60%')
  })

  it('shows blue color when usage is low', () => {
    render(<QuotaBar label="Tokens" current={3} limit={5} />)
    
    const progressBar = screen.getByText('3/5').closest('div')?.parentElement
    const progressBarInner = progressBar?.querySelector('.bg-blue-500')
    expect(progressBarInner).toBeInTheDocument()
  })

  it('shows yellow color when usage is near limit (≥80%)', () => {
    render(<QuotaBar label="Tokens" current={4} limit={5} />)
    
    const progressBar = screen.getByText('4/5').closest('div')?.parentElement
    const progressBarInner = progressBar?.querySelector('.bg-yellow-500')
    expect(progressBarInner).toBeInTheDocument()
  })

  it('shows red color when usage is at limit', () => {
    render(<QuotaBar label="Tokens" current={5} limit={5} />)
    
    const progressBar = screen.getByText('5/5').closest('div')?.parentElement
    const progressBarInner = progressBar?.querySelector('.bg-red-500')
    expect(progressBarInner).toBeInTheDocument()
  })

  it('handles zero limit gracefully', () => {
    render(<QuotaBar label="Tokens" current={0} limit={0} />)
    
    expect(screen.getByText('Tokens')).toBeInTheDocument()
    expect(screen.getByText('0/Unlimited')).toBeInTheDocument() // 0 is treated as unlimited
  })

  it('handles current exceeding limit', () => {
    render(<QuotaBar label="Tokens" current={6} limit={5} />)
    
    expect(screen.getByText('6/5')).toBeInTheDocument()
    
    // Should show red color for over-limit and show quota reached message
    expect(screen.getByText('Quota limit reached')).toBeInTheDocument()
  })

  it('shows unlimited usage message for unlimited limits', () => {
    render(<QuotaBar label="Tokens" current={100} limit="unlimited" />)
    
    expect(screen.getByText('Tokens')).toBeInTheDocument()
    expect(screen.getByText('Unlimited usage')).toBeInTheDocument()
  })
})