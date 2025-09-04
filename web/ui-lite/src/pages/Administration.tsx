import { useState, useEffect } from 'preact/hooks'
import { apiClient, useApiData, type Token, isQuotaError } from '../api'
import { Toast } from '../components/ui'
import { QuotaBar } from '../components/QuotaBar'
import { PlanBadge } from '../components/PlanBadge'
import { UpgradeCTA } from '../components/UpgradeCTA'
import { subscribeToPlan, getCurrentPlan, initializePlan, refreshPlanInfo, type PlanInfo, isAtLimit } from '../plan'
import { useMinimumDelay } from '../hooks/useMinimumDelay'


export function Administration() {
  const [toastConfig, setToastConfig] = useState({ show: false, message: '', type: 'info' as 'info' | 'success' | 'error' })
  const [showCreateTokenModal, setShowCreateTokenModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [showUpgradeCTA, setShowUpgradeCTA] = useState(false)
  const [quotaError, setQuotaError] = useState<any>(null)
  const [tokenForm, setTokenForm] = useState({ name: '', plain: '', role: 'viewer', kind: 'pat' })
  const [creating, setCreating] = useState(false)
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  
  // Subscribe to plan updates and initialize data
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Initialize plan first
        await initializePlan()
        const currentPlan = getCurrentPlan()
        if (currentPlan) {
          setPlanInfo(currentPlan)
        }
      } catch (error) {
        console.error('Failed to initialize plan:', error)
      } finally {
        setInitialLoading(false)
      }
    }
    
    initializeData()
    
    const unsubscribe = subscribeToPlan((plan) => {
      setPlanInfo(plan)
    })
    
    return unsubscribe
  }, [])
  
  const { data: tokens, loading: tokensLoading, refetch: refetchTokens } = useApiData(async () => {
    try {
      return await apiClient.getTokens()
    } catch (error) {
      console.error('Failed to fetch tokens:', error)
      return []
    }
  })

  // Fallback to empty array if tokens is null/undefined
  const safeTokens = tokens || []
  
  // Get current usage from plan info
  const currentUsage = planInfo?.usage || { tokens: 0, clients: 0, users: 0 }
  const currentLimits = planInfo?.limits || { MaxTokens: 3, MaxClients: 2, MaxUsers: 1 }
  
  // Use minimum delay to prevent flicker
  const showLoading = useMinimumDelay(initialLoading || tokensLoading, 200)
  
  // Debug logging
  
  // Calculate total usage for upgrade banner
  const totalUsed = currentUsage.tokens
  const totalLimit = typeof currentLimits.MaxTokens === 'string' ? 
    parseInt(currentLimits.MaxTokens as string) : 
    currentLimits.MaxTokens

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToastConfig({ show: true, message, type })
  }

  const handleCreateToken = async () => {
    if (!tokenForm.name || !tokenForm.plain) {
      showToast('Name and token are required', 'error')
      return
    }
    
    setCreating(true)
    try {
      await apiClient.createToken({
        name: tokenForm.name,
        role: tokenForm.role,
        kind: tokenForm.kind
      })
      
      showToast(`Token "${tokenForm.name}" created successfully`, 'success')
      setShowCreateTokenModal(false)
      setTokenForm({ name: '', plain: '', role: 'viewer', kind: 'pat' })
      refetchTokens()
      await refreshPlanInfo()
    } catch (error: any) {
      if (isQuotaError(error)) {
        setQuotaError(error)
        setShowUpgradeCTA(true)
      } else {
        showToast(error.message || 'Failed to create token', 'error')
      }
    } finally {
      setCreating(false)
    }
  }


  const handleDeleteToken = async (tokenName: string) => {
    try {
      await apiClient.deleteToken(tokenName)
      showToast(`Token "${tokenName}" deleted successfully`, 'success')
      setShowDeleteConfirm(null)
      refetchTokens()
      await refreshPlanInfo()
    } catch (error: any) {
      showToast(error.message || 'Failed to delete token', 'error')
    }
  }

  const generateRandomToken = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    let token = ''
    for (let i = 0; i < 32; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setTokenForm(prev => ({ ...prev, plain: token }))
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast('Copied to clipboard', 'success')
    } catch (error) {
      showToast('Failed to copy to clipboard', 'error')
    }
  }


  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
      case 'user': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
      case 'viewer': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
      case 'client': return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
      default: return 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300'
    }
  }
  
  // Get upgrade suggestion for current plan
  const getUpgradeText = () => {
    if (!planInfo) return ''
    switch (planInfo.plan) {
      case 'FREE':
        return 'Set GLINRDOCK_PLAN=PRO to increase limits'
      case 'PRO':
        return 'Set GLINRDOCK_PLAN=PREMIUM for unlimited resources'
      default:
        return 'Contact support for assistance'
    }
  }

  // Show loading state while initializing or loading tokens
  if (showLoading) {
    return (
      <div class="space-y-6 flex items-center justify-center min-h-96">
        <div class="text-center">
          <div class="w-12 h-12 border-4 border-[#9c40ff] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p class="text-gray-600 dark:text-gray-400">Loading administration panel...</p>
        </div>
      </div>
    )
  }

  return (
    <div class="space-y-4 fade-in pb-16">
      {/* Header */}
      <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <div class="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 bg-gradient-to-br from-[#9c40ff] via-[#8b008b] to-[#e94057] rounded-lg flex items-center justify-center shadow-sm">
              <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5-6V5a2 2 0 00-2-2H6a2 2 0 00-2 2v5l3.5-3.5a1 1 0 011.414 0L15 10l4.5-4.5V5z" />
              </svg>
            </div>
            <div>
              <h1 class="text-xl font-bold mb-0.5">
                <span class="bg-gradient-to-r from-[#8b008b] via-[#9c40ff] to-[#e94057] bg-clip-text text-transparent">
                  Administration
                </span>
              </h1>
              <p class="text-sm text-gray-600 dark:text-gray-400">Manage API tokens and role-based access control</p>
              {planInfo && (
                <div class="flex items-center gap-2 mt-1">
                  <PlanBadge plan={planInfo.plan} size="sm" />
                  <span class="text-xs text-gray-500 dark:text-gray-400">
                    {planInfo.usage.tokens}/{planInfo.limits.MaxTokens} tokens • {planInfo.usage.clients}/{planInfo.limits.MaxClients} clients
                  </span>
                </div>
              )}
            </div>
          </div>
          <div class="flex flex-col sm:flex-row gap-2">
            <button 
              onClick={() => setShowCreateTokenModal(true)}
              disabled={isAtLimit(currentUsage.tokens, currentLimits.MaxTokens)}
              class={`inline-flex items-center px-4 py-2 rounded-lg text-sm font-medium text-white shadow-sm transition-colors ${
                isAtLimit(currentUsage.tokens, currentLimits.MaxTokens) 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-[#9c40ff] to-[#8b008b] hover:from-[#8a2be2] hover:to-[#7a007a]'
              }`}
              title={
                isAtLimit(currentUsage.tokens, currentLimits.MaxTokens) 
                  ? `Token limit reached (${currentUsage.tokens}/${currentLimits.MaxTokens}) - ${getUpgradeText()}` 
                  : 'Create new API token'
              }
            >
              <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              {isAtLimit(currentUsage.tokens, currentLimits.MaxTokens) ? 'Limit Reached' : 'Create Token'}
            </button>
            {isAtLimit(currentUsage.tokens, currentLimits.MaxTokens) && (
              <button class="inline-flex items-center px-3 py-2 bg-gradient-to-r from-green-500 to-blue-500 text-white text-sm font-medium rounded-lg shadow-sm hover:from-green-600 hover:to-blue-600 transition-colors">
                <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Upgrade Plan
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2 2 2 0 01-2 2 2 2 0 01-2-2m0 0V9a2 2 0 012-2m0 0V7a2 2 0 011-1.732c.445-.264.99-.398 1.548-.416C18.418 5.359 19 5.932 19 6.616V8" />
              </svg>
            </div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">API Tokens</h3>
          </div>
          <QuotaBar 
            label="" 
            current={currentUsage.tokens} 
            limit={currentLimits.MaxTokens} 
          />
        </div>
        
        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3 mb-3">
            <div class="w-8 h-8 bg-gradient-to-br from-green-500 to-teal-600 rounded-lg flex items-center justify-center">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Clients</h3>
          </div>
          <QuotaBar 
            label="" 
            current={currentUsage.clients} 
            limit={currentLimits.MaxClients} 
          />
        </div>
        
        <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div class="flex items-center gap-3 mb-2">
            <div class="w-8 h-8 bg-gradient-to-br from-orange-500 to-red-600 rounded-lg flex items-center justify-center">
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300">Active</h3>
          </div>
          <div class="text-xl font-bold text-gray-900 dark:text-white mb-0.5">
            {safeTokens.length}
          </div>
          <p class="text-xs text-gray-600 dark:text-gray-400">Active Tokens</p>
        </div>
      </div>

      {/* RBAC Overview */}
      <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <svg class="w-5 h-5 text-[#9c40ff] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5-6V5a2 2 0 00-2-2H6a2 2 0 00-2 2v5l3.5-3.5a1 1 0 011.414 0L15 10l4.5-4.5V5z" />
          </svg>
          Role-Based Access Control
        </h2>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div class="p-3 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/30 rounded-lg border border-red-200 dark:border-red-700/50 hover:shadow-sm transition-shadow">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-xs font-semibold text-red-900 dark:text-red-300">Admin</h3>
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                Full
              </span>
            </div>
            <ul class="space-y-0.5 text-xs text-red-700 dark:text-red-400">
              <li>• System access</li>
              <li>• Token management</li>
              <li>• Emergency controls</li>
            </ul>
          </div>
          
          <div class="p-3 bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/30 rounded-lg border border-yellow-200 dark:border-yellow-700/50 hover:shadow-sm transition-shadow">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-xs font-semibold text-yellow-900 dark:text-yellow-300">User</h3>
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300">
                Deploy
              </span>
            </div>
            <ul class="space-y-0.5 text-xs text-yellow-700 dark:text-yellow-400">
              <li>• Deploy services</li>
              <li>• Manage projects</li>
              <li>• Configure routes</li>
            </ul>
          </div>
          
          <div class="p-3 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/30 rounded-lg border border-blue-200 dark:border-blue-700/50 hover:shadow-sm transition-shadow">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-xs font-semibold text-blue-900 dark:text-blue-300">Viewer</h3>
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                Read
              </span>
            </div>
            <ul class="space-y-0.5 text-xs text-blue-700 dark:text-blue-400">
              <li>• View services</li>
              <li>• Read logs</li>
              <li>• Monitor status</li>
            </ul>
          </div>
          
          <div class="p-3 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/30 rounded-lg border border-purple-200 dark:border-purple-700/50 hover:shadow-sm transition-shadow">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-xs font-semibold text-purple-900 dark:text-purple-300">Client</h3>
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                API
              </span>
            </div>
            <ul class="space-y-0.5 text-xs text-purple-700 dark:text-purple-400">
              <li>• External access</li>
              <li>• API integrations</li>
              <li>• Higher limits</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Token List */}
      <div class="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <svg class="w-5 h-5 text-[#8b008b] mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2 2 2 0 01-2 2 2 2 0 01-2-2m0 0V9a2 2 0 012-2m0 0V7a2 2 0 011-1.732c.445-.264.99-.398 1.548-.416C18.418 5.359 19 5.932 19 6.616V8" />
          </svg>
          API Tokens
        </h2>

        {safeTokens.length === 0 ? (
          <div class="text-center py-8">
            <svg class="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2 2 2 0 01-2 2 2 2 0 01-2-2m0 0V9a2 2 0 012-2m0 0V7a2 2 0 011-1.732c.445-.264.99-.398 1.548-.416C18.418 5.359 19 5.932 19 6.616V8" />
            </svg>
            <h3 class="text-base font-semibold text-gray-900 dark:text-white mb-2">No API Tokens</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Create your first API token to get started</p>
            <button 
              onClick={() => setShowCreateTokenModal(true)}
              class="px-4 py-2 bg-gradient-to-r from-[#9c40ff] to-[#8b008b] text-white text-sm font-medium rounded-lg"
            >
              Create Token
            </button>
          </div>
        ) : (
          <div class="space-y-3">
            {safeTokens.map(token => (
              <div key={token.id} class="group relative bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-[#9c40ff]/30 dark:hover:border-[#9c40ff]/50 transition-all duration-200">
                {/* Token Header */}
                <div class="flex items-start justify-between mb-3">
                  <div class="flex items-center gap-3">
                    <div class="relative">
                      <div class="w-10 h-10 bg-gradient-to-br from-[#9c40ff] via-[#8b008b] to-[#e94057] rounded-lg flex items-center justify-center shadow-sm">
                        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2 2 2 0 01-2 2 2 2 0 01-2-2m0 0V9a2 2 0 012-2m0 0V7a2 2 0 011-1.732c.445-.264.99-.398 1.548-.416C18.418 5.359 19 5.932 19 6.616V8" />
                        </svg>
                      </div>
                      <div class="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                    </div>
                    <div>
                      <h3 class="text-base font-semibold text-gray-900 dark:text-white">{token.name}</h3>
                      <div class="flex items-center gap-2 mt-0.5">
                        <span class={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleBadge(token.role)}`}>
                          {token.role.toUpperCase()}
                        </span>
                        <span class="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                          ID: {token.id}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div class="flex items-center">
                    <button 
                      onClick={() => setShowDeleteConfirm(token.name)}
                      class="opacity-0 group-hover:opacity-100 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                      title="Delete token"
                      aria-label={`Delete token ${token.name}`}
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
                
                {/* Token Details */}
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div class="flex items-center gap-2">
                    <div class="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center">
                      <svg class="w-3 h-3 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 dark:text-gray-400">Created</p>
                      <p class="text-sm font-medium text-gray-900 dark:text-white">
                        {new Date(token.created_at).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric' 
                        })}
                      </p>
                    </div>
                  </div>
                  
                  <div class="flex items-center gap-2">
                    <div class="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded flex items-center justify-center">
                      <svg class="w-3 h-3 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p class="text-xs text-gray-500 dark:text-gray-400">Last Used</p>
                      <p class="text-sm font-medium text-gray-900 dark:text-white">
                        {token.last_used_at ? 
                          new Date(token.last_used_at).toLocaleDateString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric' 
                          }) : 
                          'Never'
                        }
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Token Actions - Hidden initially, show on hover */}
                <div class="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-1.5">
                      <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                      <span class="text-xs font-medium text-green-600 dark:text-green-400">Active</span>
                    </div>
                    <button 
                      onClick={() => copyToClipboard(`Token: ${token.name} (ID: ${token.id})`)}
                      class="inline-flex items-center px-2 py-1 text-xs font-medium text-[#9c40ff] bg-[#9c40ff]/10 rounded hover:bg-[#9c40ff]/20 transition-colors"
                    >
                      <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Token Modal */}
      {showCreateTokenModal && (
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-800 rounded-lg p-4 w-full max-w-lg">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-base font-semibold text-gray-900 dark:text-white">Create API Token</h3>
              <button 
                onClick={() => setShowCreateTokenModal(false)}
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
                  Token Name
                </label>
                <input
                  type="text"
                  value={tokenForm.name}
                  onChange={e => setTokenForm(prev => ({ ...prev, name: (e.target as HTMLInputElement).value }))}
                  placeholder="e.g., production-api, mobile-app"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#9c40ff] focus:border-transparent"
                />
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Role
                </label>
                <select
                  value={tokenForm.role}
                  onChange={e => setTokenForm(prev => ({ ...prev, role: (e.target as HTMLSelectElement).value }))}
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#9c40ff] focus:border-transparent"
                >
                  <option value="viewer">
                    Viewer - Read only access
                  </option>
                  <option value="user">
                    User - Deploy and manage services
                  </option>
                  <option value="admin">
                    Admin - Full system access
                  </option>
                  <option value="client">
                    Client - External app integration
                  </option>
                </select>
              </div>
              
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Token Value
                </label>
                <div class="flex gap-2">
                  <input
                    type="text"
                    value={tokenForm.plain}
                    onChange={e => setTokenForm(prev => ({ ...prev, plain: (e.target as HTMLInputElement).value }))}
                    placeholder="Enter token or generate random"
                    class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#9c40ff] focus:border-transparent"
                  />
                  <button 
                    onClick={generateRandomToken}
                    class="px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title="Generate random token"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            
            <div class="flex gap-2 mt-4">
              <button 
                onClick={() => setShowCreateTokenModal(false)}
                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleCreateToken}
                disabled={creating}
                class="flex-1 bg-[#9c40ff] hover:bg-[#8b008b] text-white font-medium py-2 px-3 rounded-lg text-sm transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Token'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-800 rounded-lg p-4 w-full max-w-lg">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-base font-semibold text-red-600 dark:text-red-400">Delete Token</h3>
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div class="mb-4">
              <p class="text-gray-600 dark:text-gray-400 mb-3 text-sm">
                Are you sure you want to delete the token <strong>"{showDeleteConfirm}"</strong>?
              </p>
              <div class="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                <p class="text-xs text-red-700 dark:text-red-300">
                  <strong>Warning:</strong> This action cannot be undone. Any services using this token will lose access immediately.
                </p>
              </div>
            </div>
            
            <div class="flex gap-2">
              <button 
                onClick={() => setShowDeleteConfirm(null)}
                class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (showDeleteConfirm) handleDeleteToken(showDeleteConfirm)
                }}
                class="flex-1 bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-3 rounded-lg text-sm transition-colors"
              >
                Delete Token
              </button>
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

      {/* Pro Upgrade Banner - Always visible with gap */}
      {planInfo?.plan === 'FREE' && (
        <div class="relative mt-8 bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-600 rounded-lg p-6 shadow-lg overflow-hidden">
          {/* Background pattern */}
          <div class="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent"></div>
          <div class="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -translate-y-12 translate-x-12"></div>
          <div class="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full translate-y-10 -translate-x-10"></div>
          
          <div class="relative z-10">
            <div class="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div class="flex-1">
                <div class="flex items-center gap-2 mb-3">
                  <div class="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                    <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h3 class="text-lg font-bold text-white">Upgrade to Pro Plan</h3>
                </div>
                <p class="text-white/90 text-sm mb-4">
                  Unlock advanced features and remove limits. Perfect for growing teams and production environments.
                </p>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                  <div class="flex items-center gap-2 text-white/90">
                    <svg class="w-4 h-4 text-green-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span class="text-sm">Unlimited API tokens</span>
                  </div>
                  <div class="flex items-center gap-2 text-white/90">
                    <svg class="w-4 h-4 text-green-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span class="text-sm">Advanced dashboards</span>
                  </div>
                  <div class="flex items-center gap-2 text-white/90">
                    <svg class="w-4 h-4 text-green-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span class="text-sm">CI/CD integrations</span>
                  </div>
                  <div class="flex items-center gap-2 text-white/90">
                    <svg class="w-4 h-4 text-green-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span class="text-sm">SMTP alerts & notifications</span>
                  </div>
                  <div class="flex items-center gap-2 text-white/90">
                    <svg class="w-4 h-4 text-green-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span class="text-sm">Multi-environment support</span>
                  </div>
                  <div class="flex items-center gap-2 text-white/90">
                    <svg class="w-4 h-4 text-green-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span class="text-sm">Audit logs & compliance</span>
                  </div>
                </div>
              </div>
              
              <div class="flex flex-col sm:flex-row gap-3 lg:flex-col lg:items-end">
                <div class="bg-white/10 backdrop-blur-sm rounded-lg p-4 text-center lg:mb-3">
                  <div class="text-2xl font-bold text-white mb-0.5">{totalUsed}/{totalLimit}</div>
                  <div class="text-white/70 text-xs">Tokens Used</div>
                </div>
                
                <div class="flex flex-col gap-2">
                  <button class="inline-flex items-center px-6 py-3 bg-white text-purple-600 font-semibold rounded-lg shadow-lg hover:bg-gray-50 hover:scale-105 transition-all duration-200 group">
                    <svg class="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    Upgrade Now
                  </button>
                  
                  <p class="text-white/60 text-xs text-center lg:text-right">
                    Set GLINRDOCK_PLAN=PRO
                  </p>
                </div>
              </div>
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