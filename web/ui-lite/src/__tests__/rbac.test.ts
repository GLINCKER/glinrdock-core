import { describe, it, expect } from 'vitest'
import { getRoleBadgeClass } from '../rbac'

describe('RBAC utilities', () => {

  describe('getRoleBadgeClass', () => {
    it('returns correct classes for admin role', () => {
      const className = getRoleBadgeClass('admin')
      expect(className).toContain('bg-red-100')
      expect(className).toContain('text-red-800')
    })

    it('returns correct classes for deployer role', () => {
      const className = getRoleBadgeClass('deployer')
      expect(className).toContain('bg-blue-100')
      expect(className).toContain('text-blue-800')
    })

    it('returns correct classes for viewer role', () => {
      const className = getRoleBadgeClass('viewer')
      expect(className).toContain('bg-green-100')
      expect(className).toContain('text-green-800')
    })

    it('returns correct classes for client role', () => {
      const className = getRoleBadgeClass('client')
      expect(className).toContain('bg-gray-100')
      expect(className).toContain('text-gray-800')
    })

    it('returns default classes for unknown role', () => {
      const className = getRoleBadgeClass('unknown')
      expect(className).toContain('bg-gray-100')
      expect(className).toContain('text-gray-800')
    })
  })

})