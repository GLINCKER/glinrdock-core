import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/preact'
import { RoleBadge } from '../RoleBadge'

describe('RoleBadge', () => {
  it('renders admin role badge correctly', () => {
    render(<RoleBadge role="admin" />)
    expect(screen.getByText('admin')).toBeInTheDocument()
  })

  it('renders deployer role badge correctly', () => {
    render(<RoleBadge role="deployer" />)
    expect(screen.getByText('deployer')).toBeInTheDocument()
  })

  it('renders viewer role badge correctly', () => {
    render(<RoleBadge role="viewer" />)
    expect(screen.getByText('viewer')).toBeInTheDocument()
  })

  it('renders client role badge correctly', () => {
    render(<RoleBadge role="client" />)
    expect(screen.getByText('client')).toBeInTheDocument()
  })

  it('returns null for empty role', () => {
    const { container } = render(<RoleBadge role="" />)
    expect(container.firstChild).toBeNull()
  })

  it('applies additional className prop', () => {
    render(<RoleBadge role="admin" className="extra-class" />)
    expect(screen.getByText('admin')).toHaveClass('extra-class')
  })

  it('applies correct styling for admin role', () => {
    render(<RoleBadge role="admin" />)
    const badge = screen.getByText('admin')
    expect(badge).toHaveClass('bg-red-100', 'text-red-800')
  })

  it('applies correct styling for deployer role', () => {
    render(<RoleBadge role="deployer" />)
    const badge = screen.getByText('deployer')
    expect(badge).toHaveClass('bg-blue-100', 'text-blue-800')
  })

  it('applies correct styling for viewer role', () => {
    render(<RoleBadge role="viewer" />)
    const badge = screen.getByText('viewer')
    expect(badge).toHaveClass('bg-green-100', 'text-green-800')
  })

  it('applies correct styling for client role', () => {
    render(<RoleBadge role="client" />)
    const badge = screen.getByText('client')
    expect(badge).toHaveClass('bg-gray-100', 'text-gray-800')
  })

  it('capitalizes role text', () => {
    render(<RoleBadge role="admin" />)
    const badge = screen.getByText('admin')
    expect(badge).toHaveClass('capitalize')
  })
})