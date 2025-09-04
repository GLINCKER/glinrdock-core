import { useState, useEffect } from 'preact/hooks'
import { apiClient, type Client, isQuotaError } from '../api'
import { Toast } from '../components/ui'
import { QuotaBar } from '../components/QuotaBar'
import { UpgradeCTA } from '../components/UpgradeCTA'
import { subscribeToPlan, refreshPlanInfo, type PlanInfo } from '../plan'
import { useMinimumDelay } from '../hooks/useMinimumDelay'

export function Clients() {
  const [toastConfig, setToastConfig] = useState({ show: false, message: '', type: 'info' as 'info' | 'success' | 'error' })
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [clientForm, setClientForm] = useState({ name: '', ip: '' })
  const [registering, setRegistering] = useState(false)
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null)
  const [showUpgradeCTA, setShowUpgradeCTA] = useState(false)
  const [quotaError, setQuotaError] = useState<any>(null)

  // Subscribe to plan updates and initialize data
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Fetch clients and plan data simultaneously
        const [clientsData] = await Promise.all([
          apiClient.getClients(),
          refreshPlanInfo()
        ])
        setClients(clientsData)
      } catch (error) {
        console.error('Failed to fetch data:', error)
        showToast('Failed to fetch data', 'error')
      } finally {
        setLoading(false)
      }
    }
    
    initializeData()
    
    const unsubscribe = subscribeToPlan((plan) => {
      setPlanInfo(plan)
    })
    return unsubscribe
  }, [])

  // Keep fetchClients for manual refresh
  const fetchClients = async () => {
    try {
      setLoading(true)
      const data = await apiClient.getClients()
      setClients(data)
    } catch (error) {
      console.error('Failed to fetch clients:', error)
      showToast('Failed to fetch clients', 'error')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToastConfig({ show: true, message, type })
  }

  const handleRegisterClient = async () => {
    if (!clientForm.name) {
      showToast('Client name is required', 'error')
      return
    }

    setRegistering(true)
    try {
      await apiClient.touchClient({
        name: clientForm.name,
        ip: clientForm.ip || undefined
      })
      
      showToast(`Client "${clientForm.name}" registered successfully`, 'success')
      setShowRegisterModal(false)
      setClientForm({ name: '', ip: '' })
      fetchClients()
      await refreshPlanInfo()
    } catch (error: any) {
      if (isQuotaError(error)) {
        setQuotaError(error)
        setShowUpgradeCTA(true)
      } else {
        showToast(error.message || 'Failed to register client', 'error')
      }
    } finally {
      setRegistering(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
      case 'inactive':
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300'
      case 'error':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
      default:
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
    }
  }

  // Use minimum delay to prevent flicker
  const showLoading = useMinimumDelay(loading, 200)
  
  if (showLoading) {
    return (
      <div class="space-y-6 flex items-center justify-center min-h-96">
        <div class="text-center">
          <div class="w-12 h-12 border-4 border-[#9c40ff] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p class="text-gray-600 dark:text-gray-400">Loading clients...</p>
        </div>
      </div>
    )
  }

  return (
    <div class="space-y-6 fade-in">
      <Toast
        isVisible={toastConfig.show}
        message={toastConfig.message}
        type={toastConfig.type}
        onClose={() => setToastConfig(prev => ({ ...prev, show: false }))}
      />

      {/* Header */}
      <div class="flex justify-between items-center">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100">Clients</h1>
        <button
          onClick={() => setShowRegisterModal(true)}
          class="px-4 py-2 bg-[#9c40ff] hover:bg-[#8a2be2] text-white font-medium rounded-lg transition-colors"
        >
          Register Client
        </button>
      </div>

      {/* Quota Info */}
      {planInfo && (
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-3">
          <QuotaBar 
            label="Connected Clients" 
            current={planInfo.usage.clients} 
            limit={planInfo.limits.MaxClients} 
          />
        </div>
      )}

      {/* Clients Table */}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <h2 class="text-base font-semibold text-gray-900 dark:text-gray-100">
            Registered Clients ({clients.length})
          </h2>
        </div>
        
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead class="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Name</th>
                <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
                <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last IP</th>
                <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Last Seen</th>
                <th class="px-4 py-2.5 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Requests</th>
              </tr>
            </thead>
            <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={5} class="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    <div class="flex flex-col items-center">
                      <div class="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-2">
                        <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <p class="text-base font-medium mb-1">No clients registered</p>
                      <p class="text-sm text-gray-400 dark:text-gray-500 mb-3">
                        Register your first client to start monitoring connections
                      </p>
                      <button
                        onClick={() => setShowRegisterModal(true)}
                        class="px-3 py-1.5 bg-[#9c40ff] hover:bg-[#8a2be2] text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        Register Client
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.name}>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="font-medium text-gray-900 dark:text-gray-100">
                        {client.name}
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(client.status)}`}>
                        {client.status}
                      </span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {client.last_ip || '-'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {client.last_seen ? new Date(client.last_seen).toLocaleString() : 'Never'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {client.requests || 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Register Client Modal */}
      {showRegisterModal && (
        <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full mx-4">
            <div class="p-6">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Register New Client
              </h3>
              
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Client Name
                  </label>
                  <input
                    type="text"
                    value={clientForm.name}
                    onChange={(e) => setClientForm(prev => ({ ...prev, name: (e.target as HTMLInputElement).value }))}
                    placeholder="e.g., web-app-prod"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-[#9c40ff] dark:bg-gray-700 dark:text-gray-100"
                    required
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    IP Address (Optional)
                  </label>
                  <input
                    type="text"
                    value={clientForm.ip}
                    onChange={(e) => setClientForm(prev => ({ ...prev, ip: (e.target as HTMLInputElement).value }))}
                    placeholder="e.g., 192.168.1.100"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-[#9c40ff] dark:bg-gray-700 dark:text-gray-100"
                  />
                </div>
              </div>

              <div class="flex justify-end space-x-3 mt-6">
                <button 
                  onClick={() => {
                    setShowRegisterModal(false)
                    setClientForm({ name: '', ip: '' })
                  }}
                  class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  disabled={registering}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleRegisterClient}
                  disabled={registering || !clientForm.name}
                  class="px-4 py-2 bg-[#9c40ff] hover:bg-[#8a2be2] text-white font-medium rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {registering ? 'Registering...' : 'Register Client'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade CTA Modal */}
      {showUpgradeCTA && quotaError && (
        <UpgradeCTA 
          error={quotaError}
          onClose={() => {
            setShowUpgradeCTA(false)
            setQuotaError(null)
          }}
        />
      )}
    </div>
  )
}