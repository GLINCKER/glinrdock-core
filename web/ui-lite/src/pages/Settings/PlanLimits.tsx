import { useState, useEffect } from 'preact/hooks'
import { PlanBadge } from '../../components/PlanBadge'
import { QuotaBar } from '../../components/QuotaBar'
import { subscribeToPlan, type PlanInfo, getUpgradeSuggestion } from '../../plan'

export function PlanLimits() {
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null)

  useEffect(() => {
    const unsubscribe = subscribeToPlan((plan) => {
      setPlanInfo(plan)
    })
    return unsubscribe
  }, [])

  if (!planInfo) {
    return (
      <div class="space-y-6 fade-in flex items-center justify-center min-h-96">
        <div class="text-center">
          <div class="w-12 h-12 border-4 border-[#9c40ff] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p class="text-gray-600 dark:text-gray-400">Loading plan information...</p>
        </div>
      </div>
    )
  }

  return (
    <div class="space-y-6 fade-in">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Plan & Limits
          </h1>
          <p class="text-gray-600 dark:text-gray-400">
            View your current plan limits and usage quotas
          </p>
        </div>
        <PlanBadge plan={planInfo.plan} size="md" />
      </div>

      {/* Current Plan Overview */}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Current Plan: {planInfo.plan}
        </h2>
        
        <div class="grid gap-6 md:grid-cols-3">
          <div class="space-y-4">
            <QuotaBar 
              label="API Tokens" 
              current={planInfo.usage.tokens} 
              limit={planInfo.limits.max_tokens} 
            />
          </div>
          
          <div class="space-y-4">
            <QuotaBar 
              label="Connected Clients" 
              current={planInfo.usage.clients} 
              limit={planInfo.limits.max_clients} 
            />
          </div>
          
          <div class="space-y-4">
            <QuotaBar 
              label="Users" 
              current={planInfo.usage.users} 
              limit={planInfo.limits.max_users} 
            />
          </div>
        </div>
      </div>

      {/* Feature Comparison */}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Available Features
        </h2>
        
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(planInfo.features).map(([feature, available]) => (
            <div key={feature} class="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div class={`w-4 h-4 rounded-full flex-shrink-0 ${
                available ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}>
                {available && (
                  <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <span class={`text-sm capitalize ${
                available ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'
              }`}>
                {feature.replace(/_/g, ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Upgrade Options */}
      <div class="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <div class="flex items-start space-x-4">
          <div class="flex-shrink-0">
            <svg class="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-medium text-blue-900 dark:text-blue-300 mb-2">
              Need More Resources?
            </h3>
            <p class="text-blue-800 dark:text-blue-400 mb-3">
              {getUpgradeSuggestion(planInfo.plan)}
            </p>
            <div class="flex space-x-3">
              <a
                href="/docs/PLANS.md"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                View Plans
                <svg class="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Comparison Table (if FREE plan) */}
      {planInfo.plan === 'FREE' && (
        <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div class="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Plan Comparison
            </h2>
          </div>
          
          <div class="overflow-x-auto">
            <table class="min-w-full">
              <thead class="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Feature
                  </th>
                  <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Free
                  </th>
                  <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Pro
                  </th>
                  <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Premium
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    API Tokens
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400">
                    3
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400">
                    10
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-green-600 dark:text-green-400">
                    Unlimited
                  </td>
                </tr>
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    Connected Clients
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400">
                    2
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400">
                    10
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-green-600 dark:text-green-400">
                    Unlimited
                  </td>
                </tr>
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    Users
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400">
                    1
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400">
                    10
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-green-600 dark:text-green-400">
                    Unlimited
                  </td>
                </tr>
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    SMTP Alerts
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-red-500">
                    ✗
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-green-500">
                    ✓
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-green-500">
                    ✓
                  </td>
                </tr>
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    CI Integrations
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-red-500">
                    ✗
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-green-500">
                    ✓
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-green-500">
                    ✓
                  </td>
                </tr>
                <tr>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    SSO & Advanced Auth
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-red-500">
                    ✗
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-red-500">
                    ✗
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-center text-sm text-green-500">
                    ✓
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}