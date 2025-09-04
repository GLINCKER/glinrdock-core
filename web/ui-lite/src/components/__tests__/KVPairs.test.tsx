/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/preact'
import { KVPairs } from '../KVPairs'

describe('KVPairs', () => {
  const defaultProps = {
    value: {},
    onChange: vi.fn(),
    placeholder: { key: 'KEY', value: 'VALUE' },
    disabled: false
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders empty pair by default', () => {
    render(<KVPairs {...defaultProps} />)
    
    const keyInputs = screen.getAllByPlaceholderText('KEY')
    const valueInputs = screen.getAllByPlaceholderText('VALUE')
    
    expect(keyInputs).toHaveLength(1)
    expect(valueInputs).toHaveLength(1)
  })

  it('renders existing values', () => {
    const value = {
      NODE_ENV: 'production',
      PORT: '3000'
    }
    
    render(<KVPairs {...defaultProps} value={value} />)
    
    expect(screen.getByDisplayValue('NODE_ENV')).toBeInTheDocument()
    expect(screen.getByDisplayValue('production')).toBeInTheDocument()
    expect(screen.getByDisplayValue('PORT')).toBeInTheDocument()
    expect(screen.getByDisplayValue('3000')).toBeInTheDocument()
  })

  it('adds new pair when Add Variable is clicked', () => {
    render(<KVPairs {...defaultProps} />)
    
    const addButton = screen.getByText('Add Variable')
    fireEvent.click(addButton)
    
    const keyInputs = screen.getAllByPlaceholderText('KEY')
    expect(keyInputs).toHaveLength(2)
  })

  it('removes pair when remove button is clicked', () => {
    const value = {
      NODE_ENV: 'production',
      PORT: '3000'
    }
    
    render(<KVPairs {...defaultProps} value={value} />)
    
    const removeButtons = screen.getAllByTitle('Remove')
    fireEvent.click(removeButtons[0])
    
    expect(defaultProps.onChange).toHaveBeenCalledWith({ PORT: '3000' })
  })

  it('does not show remove button when only one pair', () => {
    render(<KVPairs {...defaultProps} />)
    
    expect(screen.queryByTitle('Remove')).not.toBeInTheDocument()
  })

  it('updates value when key changes', () => {
    render(<KVPairs {...defaultProps} />)
    
    const keyInput = screen.getByPlaceholderText('KEY')
    fireEvent.input(keyInput, { target: { value: 'NEW_KEY' } })
    
    expect(defaultProps.onChange).toHaveBeenCalledWith({})
    
    const valueInput = screen.getByPlaceholderText('VALUE')
    fireEvent.input(valueInput, { target: { value: 'new_value' } })
    
    expect(defaultProps.onChange).toHaveBeenCalledWith({ NEW_KEY: 'new_value' })
  })

  it('filters out empty keys', () => {
    render(<KVPairs {...defaultProps} />)
    
    const keyInput = screen.getByPlaceholderText('KEY')
    const valueInput = screen.getByPlaceholderText('VALUE')
    
    // Set value without key
    fireEvent.input(valueInput, { target: { value: 'some_value' } })
    
    expect(defaultProps.onChange).toHaveBeenCalledWith({})
  })

  it('trims whitespace from keys', () => {
    render(<KVPairs {...defaultProps} />)
    
    const keyInput = screen.getByPlaceholderText('KEY')
    const valueInput = screen.getByPlaceholderText('VALUE')
    
    fireEvent.input(keyInput, { target: { value: '  TRIMMED_KEY  ' } })
    fireEvent.input(valueInput, { target: { value: 'value' } })
    
    expect(defaultProps.onChange).toHaveBeenCalledWith({ TRIMMED_KEY: 'value' })
  })

  it('disables inputs when disabled prop is true', () => {
    render(<KVPairs {...defaultProps} disabled={true} />)
    
    const keyInput = screen.getByPlaceholderText('KEY')
    const valueInput = screen.getByPlaceholderText('VALUE')
    
    expect(keyInput).toBeDisabled()
    expect(valueInput).toBeDisabled()
  })

  it('hides Add Variable button when disabled', () => {
    render(<KVPairs {...defaultProps} disabled={true} />)
    
    expect(screen.queryByText('Add Variable')).not.toBeInTheDocument()
  })

  it('uses default placeholders when not provided', () => {
    const { placeholder, ...props } = defaultProps
    render(<KVPairs {...props} />)
    
    expect(screen.getByPlaceholderText('Key')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Value')).toBeInTheDocument()
  })

  it('handles multiple pairs with same key correctly', () => {
    render(<KVPairs {...defaultProps} />)
    
    // Add another pair
    const addButton = screen.getByText('Add Variable')
    fireEvent.click(addButton)
    
    const keyInputs = screen.getAllByPlaceholderText('KEY')
    const valueInputs = screen.getAllByPlaceholderText('VALUE')
    
    // Set same key for both pairs
    fireEvent.input(keyInputs[0], { target: { value: 'DUPLICATE' } })
    fireEvent.input(valueInputs[0], { target: { value: 'first' } })
    
    fireEvent.input(keyInputs[1], { target: { value: 'DUPLICATE' } })
    fireEvent.input(valueInputs[1], { target: { value: 'second' } })
    
    // Second value should override first
    expect(defaultProps.onChange).toHaveBeenLastCalledWith({ DUPLICATE: 'second' })
  })
})