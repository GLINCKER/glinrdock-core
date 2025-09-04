import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  isAtLimit, 
  getUsagePercentage, 
  getPlanBadgeProps,
  subscribeToPlan,
  refreshPlanInfo,
  isUnlimited,
  isNearLimit,
  formatLimit
} from '../plan'

// Mock the API client
vi.mock('../api', () => ({
  apiClient: {
    getSystemPlan: vi.fn(),
  },
}))

describe('Plan utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('isAtLimit', () => {
    it('returns true when current equals limit', () => {
      expect(isAtLimit(5, 5)).toBe(true)
    })

    it('returns true when current exceeds limit', () => {
      expect(isAtLimit(6, 5)).toBe(true)
    })

    it('returns false when current is below limit', () => {
      expect(isAtLimit(3, 5)).toBe(false)
    })

    it('handles zero limit', () => {
      expect(isAtLimit(0, 0)).toBe(false) // 0 >= 0 but isUnlimited returns true for 0
      expect(isAtLimit(1, 0)).toBe(true)
    })

    it('handles unlimited limits', () => {
      expect(isAtLimit(100, 'unlimited')).toBe(false)
      expect(isAtLimit(100, -1)).toBe(false)
    })
  })

  describe('getUsagePercentage', () => {
    it('calculates percentage correctly', () => {
      expect(getUsagePercentage(3, 5)).toBe(60)
      expect(getUsagePercentage(1, 4)).toBe(25)
      expect(getUsagePercentage(5, 5)).toBe(100)
    })

    it('handles zero limit', () => {
      expect(getUsagePercentage(0, 0)).toBe(0) // Should return 0 for unlimited
      expect(getUsagePercentage(1, 0)).toBe(0) // Should return 0 for unlimited
    })

    it('handles over-limit usage', () => {
      expect(getUsagePercentage(6, 5)).toBe(100) // Capped at 100%
    })

    it('handles unlimited limits', () => {
      expect(getUsagePercentage(100, 'unlimited')).toBe(0)
      expect(getUsagePercentage(100, -1)).toBe(0)
    })
  })

  describe('getPlanBadgeProps', () => {
    it('returns correct props for FREE plan', () => {
      const props = getPlanBadgeProps('FREE')
      expect(props.text).toBe('FREE')
      expect(props.className).toContain('text-green-600')
      expect(props.className).toContain('bg-green-100')
    })

    it('returns correct props for PRO plan', () => {
      const props = getPlanBadgeProps('PRO')
      expect(props.text).toBe('PRO')
      expect(props.className).toContain('text-blue-600')
      expect(props.className).toContain('bg-blue-100')
    })

    it('returns correct props for PREMIUM plan', () => {
      const props = getPlanBadgeProps('PREMIUM')
      expect(props.text).toBe('PREMIUM')
      expect(props.className).toContain('text-purple-600')
      expect(props.className).toContain('bg-purple-100')
    })

    it('returns default props for unknown plan', () => {
      const props = getPlanBadgeProps('UNKNOWN')
      expect(props.text).toBe('UNKNOWN')
      expect(props.className).toContain('text-green-600') // Falls back to FREE plan colors
      expect(props.className).toContain('bg-green-100')
    })
  })

  describe('utility functions', () => {
    it('formatLimit formats limits correctly', () => {
      expect(formatLimit(5)).toBe('5')
      expect(formatLimit('unlimited')).toBe('Unlimited')
      expect(formatLimit(-1)).toBe('Unlimited')
    })

    it('isUnlimited detects unlimited limits', () => {
      expect(isUnlimited('unlimited')).toBe(true)
      expect(isUnlimited(-1)).toBe(true)
      expect(isUnlimited(5)).toBe(false)
      expect(isUnlimited(0)).toBe(false)
    })

    it('isNearLimit detects near-limit usage', () => {
      expect(isNearLimit(4, 5)).toBe(true) // 80%
      expect(isNearLimit(3, 5)).toBe(false) // 60%
      expect(isNearLimit(5, 'unlimited')).toBe(false)
    })
  })
})