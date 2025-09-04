import { QuotaError } from '../api'
import { getPlanBadgeProps } from '../plan'

interface UpgradeCTAProps {
  error: QuotaError
  onClose: () => void
}

export function UpgradeCTA({ error, onClose }: UpgradeCTAProps) {
  const planBadge = getPlanBadgeProps(error.plan)
  
  return (
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div class="p-6">
          {/* Header */}
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center space-x-2">
              <div class="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                <svg class="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Quota Exceeded
              </h3>
            </div>
            <button 
              onClick={onClose}
              class="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Current Plan */}
          <div class="mb-4">
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">Current Plan:</p>
            <span class={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${planBadge.className}`}>
              {planBadge.text}
            </span>
          </div>
          
          {/* Error Message */}
          <div class="mb-6">
            <p class="text-gray-800 dark:text-gray-200 mb-2">
              {error.message}
            </p>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              You've reached your limit of <strong>{error.limit}</strong> for your current plan.
            </p>
          </div>
          
          {/* Upgrade Hint */}
          <div class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 class="text-sm font-medium text-blue-900 dark:text-blue-300 mb-1">
              Upgrade Suggestion
            </h4>
            <p class="text-sm text-blue-800 dark:text-blue-300">
              {error.upgrade_hint}
            </p>
          </div>
          
          {/* Actions */}
          <div class="flex justify-end space-x-3">
            <button 
              onClick={onClose}
              class="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
            >
              Close
            </button>
            <a 
              href="/docs/PLANS.md"
              target="_blank"
              rel="noopener noreferrer"
              class="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
            >
              Learn More
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

interface UpgradeBannerProps {
  error: QuotaError
  onClose: () => void
  compact?: boolean
}

export function UpgradeBanner({ error, onClose, compact = false }: UpgradeBannerProps) {
  if (compact) {
    return (
      <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-2">
            <svg class="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p class="text-sm text-yellow-800 dark:text-yellow-300">
              Quota reached: {error.limit} limit
            </p>
          </div>
          <button 
            onClick={onClose}
            class="text-yellow-500 hover:text-yellow-600 dark:hover:text-yellow-400"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    )
  }
  
  return (
    <div class="bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4 mb-4">
      <div class="flex items-start space-x-3">
        <div class="flex-shrink-0">
          <svg class="w-5 h-5 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="flex-1">
          <h3 class="text-sm font-medium text-orange-900 dark:text-orange-300">
            Quota Limit Reached
          </h3>
          <p class="mt-1 text-sm text-orange-800 dark:text-orange-400">
            {error.message}
          </p>
          <p class="mt-2 text-xs text-orange-700 dark:text-orange-500">
            {error.upgrade_hint}
          </p>
        </div>
        <button 
          onClick={onClose}
          class="flex-shrink-0 text-orange-500 hover:text-orange-600 dark:hover:text-orange-400"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}