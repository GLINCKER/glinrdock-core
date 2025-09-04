import { useState } from 'preact/hooks'
import { apiClient, useApiData } from '../../api'
import { Toast } from '../../components/ui'

interface LicenseStatus {
  valid: boolean
  plan: string
  name?: string
  org?: string
  expiry?: string
  expires_in?: string
  expiring_soon?: boolean
  features: string[]
  limits: Record<string, number>
  usage: Record<string, number>
}

export function License() {
  const [toastConfig, setToastConfig] = useState({ show: false, message: '', type: 'info' as 'info' | 'success' | 'error' })
  const [showActivateModal, setShowActivateModal] = useState(false)
  const [licenseText, setLicenseText] = useState('')
  const [activating, setActivating] = useState(false)
  const [deactivating, setDeactivating] = useState(false)

  const { data: licenseStatus, loading, refetch } = useApiData<LicenseStatus>(() => apiClient.getLicense())

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToastConfig({ show: true, message, type })
  }

  const handleActivate = async () => {
    if (!licenseText.trim()) {
      showToast('Please enter a license', 'error')
      return
    }

    setActivating(true)
    try {
      await apiClient.activateLicense(licenseText.trim())
      showToast('License activated successfully', 'success')
      setShowActivateModal(false)
      setLicenseText('')
      refetch()
    } catch (error: any) {
      showToast(error.message || 'Failed to activate license', 'error')
    } finally {
      setActivating(false)
    }
  }

  const handleDeactivate = async () => {
    setDeactivating(true)
    try {
      await apiClient.deactivateLicense()
      showToast('License deactivated successfully', 'success')
      refetch()
    } catch (error: any) {
      showToast(error.message || 'Failed to deactivate license', 'error')
    } finally {
      setDeactivating(false)
    }
  }

  const handleFileUpload = (event: Event) => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return

    if (file.size > 64 * 1024) {
      showToast('License file too large (max 64KB)', 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setLicenseText(content)
    }
    reader.onerror = () => {
      showToast('Failed to read license file', 'error')
    }
    reader.readAsText(file)
  }

  if (loading) {
    return (
      <div class="flex items-center justify-center min-h-96">
        <div class="text-center">
          <div class="w-8 h-8 border-4 border-[#9c40ff] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p class="text-sm text-gray-600 dark:text-gray-400">Loading license information...</p>
        </div>
      </div>
    )
  }

  return (
    <div class="space-y-4">
      {/* Header with Back Button */}
      <div>
        <div class="flex items-center mb-2">
          <a 
            href="/app/settings"
            class="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors mr-3"
          >
            <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Settings
          </a>
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">License & Plan</h2>
        </div>
        <p class="text-sm text-gray-600 dark:text-gray-400">Manage your GLINRDOCK license and view plan details</p>
      </div>

      {/* Current License Status */}
      <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white">Current License</h3>
          <div class="flex gap-2">
            {licenseStatus?.valid ? (
              <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                ✓ Valid
              </span>
            ) : (
              <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300">
                No License
              </span>
            )}
            <span class={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
              licenseStatus?.plan === 'FREE' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300' :
              licenseStatus?.plan === 'PRO' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300' :
              'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
            }`}>
              {licenseStatus?.plan || 'FREE'}
            </span>
          </div>
        </div>

        {licenseStatus?.valid && (
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {licenseStatus.name && (
              <div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Licensed To</p>
                <p class="text-sm font-medium text-gray-900 dark:text-white">{licenseStatus.name}</p>
              </div>
            )}
            {licenseStatus.org && (
              <div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Organization</p>
                <p class="text-sm font-medium text-gray-900 dark:text-white">{licenseStatus.org}</p>
              </div>
            )}
            {licenseStatus.expiry && (
              <div>
                <p class="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Expires</p>
                <p class={`text-sm font-medium ${
                  licenseStatus.expiring_soon 
                    ? 'text-amber-600 dark:text-amber-400' 
                    : 'text-gray-900 dark:text-white'
                }`}>
                  {new Date(licenseStatus.expiry).toLocaleDateString()}
                  {licenseStatus.expiring_soon && ' (Soon)'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div class="flex gap-2">
          <button
            onClick={() => setShowActivateModal(true)}
            class="px-3 py-2 bg-[#9c40ff] hover:bg-[#8b008b] text-white text-sm font-medium rounded-lg transition-colors"
          >
            {licenseStatus?.valid ? 'Update License' : 'Activate License'}
          </button>
          {licenseStatus?.valid && (
            <button
              onClick={handleDeactivate}
              disabled={deactivating}
              class="px-3 py-2 border border-red-300 dark:border-red-600 text-red-600 dark:text-red-400 text-sm font-medium rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
            >
              {deactivating ? 'Deactivating...' : 'Deactivate'}
            </button>
          )}
        </div>
      </div>

      {/* Plan Limits */}
      {licenseStatus && (
        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-3">Plan Limits & Usage</h3>
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Object.entries(licenseStatus.limits).map(([key, limit]) => {
              const usage = licenseStatus.usage[key.toLowerCase()] || 0
              const isUnlimited = limit === -1
              const percentage = isUnlimited ? 0 : Math.min((usage / limit) * 100, 100)
              
              return (
                <div key={key} class="space-y-1">
                  <div class="flex justify-between items-center">
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                      {key.replace('Max', '').replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span class="text-xs text-gray-700 dark:text-gray-300">
                      {usage}/{isUnlimited ? '∞' : limit}
                    </span>
                  </div>
                  {!isUnlimited && (
                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                      <div
                        class={`h-1.5 rounded-full transition-all ${
                          percentage >= 90 ? 'bg-red-500' : 
                          percentage >= 70 ? 'bg-amber-500' : 
                          'bg-green-500'
                        }`}
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Features */}
      {licenseStatus?.features && licenseStatus.features.length > 0 && (
        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-3">Available Features</h3>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {licenseStatus.features.map((feature) => (
              <div key={feature} class="flex items-center gap-1.5">
                <div class="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                <span class="text-xs text-gray-700 dark:text-gray-300 capitalize">
                  {feature.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activate License Modal */}
      {showActivateModal && (
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-800 rounded-lg p-4 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">Activate License</h3>
              <button
                onClick={() => setShowActivateModal(false)}
                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  License Content
                </label>
                <textarea
                  value={licenseText}
                  onChange={(e) => setLicenseText((e.target as HTMLTextAreaElement).value)}
                  placeholder="Paste your license content here..."
                  class="w-full h-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm font-mono resize-none focus:ring-2 focus:ring-[#9c40ff] focus:border-transparent"
                />
              </div>

              <div class="flex items-center gap-4">
                <span class="text-sm text-gray-600 dark:text-gray-400">Or</span>
                <label class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span class="text-sm text-gray-700 dark:text-gray-300">Upload .license file</span>
                  <input
                    type="file"
                    accept=".license,.json,.txt"
                    onChange={handleFileUpload}
                    class="hidden"
                  />
                </label>
              </div>
            </div>

            <div class="flex gap-2 mt-4">
              <button
                onClick={() => setShowActivateModal(false)}
                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleActivate}
                disabled={activating || !licenseText.trim()}
                class="flex-1 bg-[#9c40ff] hover:bg-[#8b008b] text-white font-medium py-2 px-3 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {activating ? 'Activating...' : 'Activate License'}
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast
        message={toastConfig.message}
        type={toastConfig.type}
        isVisible={toastConfig.show}
        onClose={() => setToastConfig({ ...toastConfig, show: false })}
      />
    </div>
  )
}