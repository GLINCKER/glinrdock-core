/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/preact'
import { PortsEditor } from '../PortsEditor'

describe('PortsEditor', () => {
  const defaultProps = {
    value: [],
    onChange: vi.fn(),
    disabled: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with default port mapping', () => {
    render(<PortsEditor {...defaultProps} />)
    
    const containerInputs = screen.getAllByPlaceholderText('80')
    expect(containerInputs).toHaveLength(2) // Container and host inputs
  })

  it('renders existing port mappings', () => {
    const value = [
      { container: 8080, host: 8081 },
      { container: 3000, host: 3001 }
    ]
    
    render(<PortsEditor {...defaultProps} value={value} />)
    
    expect(screen.getByDisplayValue('8080')).toBeInTheDocument()
    expect(screen.getByDisplayValue('8081')).toBeInTheDocument()
    expect(screen.getByDisplayValue('3000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('3001')).toBeInTheDocument()
  })

  it('adds new port mapping when Add Port Mapping is clicked', () => {
    render(<PortsEditor {...defaultProps} />)
    
    const addButton = screen.getByText('Add Port Mapping')
    fireEvent.click(addButton)
    
    // Should have 2 port mappings now (default 80:80 + new 80:8080)
    expect(defaultProps.onChange).toHaveBeenCalledWith([
      { container: 80, host: 80 },
      { container: 80, host: 8080 }
    ])
  })

  it('finds next available host port', () => {
    const value = [
      { container: 80, host: 8080 },
      { container: 443, host: 8081 }
    ]
    
    render(<PortsEditor {...defaultProps} value={value} />)
    
    const addButton = screen.getByText('Add Port Mapping')
    fireEvent.click(addButton)
    
    // Should use 8082 as next available port
    expect(defaultProps.onChange).toHaveBeenCalledWith([
      { container: 80, host: 8080 },
      { container: 443, host: 8081 },
      { container: 80, host: 8082 }
    ])
  })

  it('removes port mapping when remove button is clicked', () => {
    const value = [
      { container: 8080, host: 8081 },
      { container: 3000, host: 3001 }
    ]
    
    render(<PortsEditor {...defaultProps} value={value} />)
    
    const removeButtons = screen.getAllByTitle('Remove port mapping')
    fireEvent.click(removeButtons[0])
    
    expect(defaultProps.onChange).toHaveBeenCalledWith([
      { container: 3000, host: 3001 }
    ])
  })

  it('does not show remove button when only one port', () => {
    render(<PortsEditor {...defaultProps} />)
    
    expect(screen.queryByTitle('Remove port mapping')).not.toBeInTheDocument()
  })

  it('updates container port value', () => {
    render(<PortsEditor {...defaultProps} />)
    
    const containerInput = screen.getByLabelText(/Container Port/)
    fireEvent.input(containerInput, { target: { value: '3000' } })
    
    expect(defaultProps.onChange).toHaveBeenCalledWith([
      { container: 3000, host: 80 }
    ])
  })

  it('updates host port value', () => {
    render(<PortsEditor {...defaultProps} />)
    
    const hostInput = screen.getByLabelText(/Host Port/)
    fireEvent.input(hostInput, { target: { value: '3001' } })
    
    expect(defaultProps.onChange).toHaveBeenCalledWith([
      { container: 80, host: 3001 }
    ])
  })

  it('validates port range (rejects invalid ports)', () => {
    render(<PortsEditor {...defaultProps} />)
    
    const containerInput = screen.getByLabelText(/Container Port/)
    
    // Try to set port > 65535
    fireEvent.input(containerInput, { target: { value: '99999' } })
    
    // Should not call onChange with invalid port
    expect(defaultProps.onChange).not.toHaveBeenCalledWith([
      { container: 99999, host: 80 }
    ])
  })

  it('shows port conflict warning', () => {
    const value = [
      { container: 8080, host: 3000 },
      { container: 443, host: 3000 } // Duplicate host port
    ]
    
    render(<PortsEditor {...defaultProps} value={value} />)
    
    expect(screen.getByText('Port 3000 is already mapped')).toBeInTheDocument()
  })

  it('renders common port suggestions', () => {
    render(<PortsEditor {...defaultProps} />)
    
    expect(screen.getByText('80')).toBeInTheDocument()
    expect(screen.getByText('443')).toBeInTheDocument()
    expect(screen.getByText('3000')).toBeInTheDocument()
    expect(screen.getByText('8080')).toBeInTheDocument()
  })

  it('adds port mapping from suggestions', () => {
    render(<PortsEditor {...defaultProps} />)
    
    const port443Button = screen.getByTitle('Add 443:443 mapping')
    fireEvent.click(port443Button)
    
    expect(defaultProps.onChange).toHaveBeenCalledWith([
      { container: 80, host: 80 },
      { container: 443, host: 443 }
    ])
  })

  it('disables suggestion buttons for already used ports', () => {
    const value = [{ container: 80, host: 3000 }]
    
    render(<PortsEditor {...defaultProps} value={value} />)
    
    const port3000Button = screen.getByTitle('Add 3000:3000 mapping')
    expect(port3000Button).toBeDisabled()
  })

  it('disables inputs when disabled prop is true', () => {
    render(<PortsEditor {...defaultProps} disabled={true} />)
    
    const containerInput = screen.getByLabelText(/Container Port/)
    const hostInput = screen.getByLabelText(/Host Port/)
    
    expect(containerInput).toBeDisabled()
    expect(hostInput).toBeDisabled()
  })

  it('hides add button when disabled', () => {
    render(<PortsEditor {...defaultProps} disabled={true} />)
    
    expect(screen.queryByText('Add Port Mapping')).not.toBeInTheDocument()
  })

  it('hides port suggestions when disabled', () => {
    render(<PortsEditor {...defaultProps} disabled={true} />)
    
    expect(screen.queryByText('Common ports:')).not.toBeInTheDocument()
  })

  it('filters out invalid ports from onChange', () => {
    render(<PortsEditor {...defaultProps} />)
    
    const containerInput = screen.getByLabelText(/Container Port/)
    const hostInput = screen.getByLabelText(/Host Port/)
    
    // Set container port to 0 (invalid)
    fireEvent.input(containerInput, { target: { value: '0' } })
    
    // Should filter out the port with 0 values
    expect(defaultProps.onChange).toHaveBeenCalledWith([])
  })

  it('shows directional arrow between port inputs', () => {
    render(<PortsEditor {...defaultProps} />)
    
    // Check for SVG arrow icon
    const arrow = document.querySelector('svg')
    expect(arrow).toBeInTheDocument()
  })
})