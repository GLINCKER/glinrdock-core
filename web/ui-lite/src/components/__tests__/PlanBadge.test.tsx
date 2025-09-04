import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/preact'
import { PlanBadge } from '../PlanBadge'

describe('PlanBadge', () => {
  it('renders FREE plan badge correctly', () => {
    render(<PlanBadge plan="FREE" />)
    expect(screen.getByText('FREE')).toBeInTheDocument()
  })

  it('renders PRO plan badge correctly', () => {
    render(<PlanBadge plan="PRO" />)
    expect(screen.getByText('PRO')).toBeInTheDocument()
  })

  it('renders PREMIUM plan badge correctly', () => {
    render(<PlanBadge plan="PREMIUM" />)
    expect(screen.getByText('PREMIUM')).toBeInTheDocument()
  })

  it('applies correct size classes', () => {
    const { rerender } = render(<PlanBadge plan="FREE" size="sm" />)
    expect(screen.getByText('FREE')).toHaveClass('text-xs')

    rerender(<PlanBadge plan="FREE" size="md" />)
    expect(screen.getByText('FREE')).toHaveClass('text-sm')
  })

  it('applies additional className prop', () => {
    render(<PlanBadge plan="FREE" className="extra-class" />)
    expect(screen.getByText('FREE')).toHaveClass('extra-class')
  })

  it('applies correct styling for each plan', () => {
    const { rerender } = render(<PlanBadge plan="FREE" />)
    let badge = screen.getByText('FREE')
    expect(badge).toHaveClass('bg-green-100')

    rerender(<PlanBadge plan="PRO" />)
    badge = screen.getByText('PRO')
    expect(badge).toHaveClass('bg-blue-100')

    rerender(<PlanBadge plan="PREMIUM" />)
    badge = screen.getByText('PREMIUM')
    expect(badge).toHaveClass('bg-purple-100')
  })
})