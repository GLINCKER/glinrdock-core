import { useState, useEffect } from 'preact/hooks'
import { RoleBadge } from '../../components/RoleBadge'
import { Toast } from '../../components/ui'
import { getAuthInfo } from '../../rbac'
import { signOut } from '../../auth'

export function AuthSettings() {
  const [toastConfig, setToastConfig] = useState({ show: false, message: '', type: 'info' as 'info' | 'success' | 'error' })
  const [authInfo, setAuthInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    loadAuthInfo()
  }, [])

  const loadAuthInfo = async () => {
    try {
      const info = await getAuthInfo()
      setAuthInfo(info)
    } catch (error) {
      console.error('Failed to load auth info:', error)
      showToast('Failed to load authentication information', 'error')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToastConfig({ show: true, message, type })
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await signOut()
      showToast('Signed out successfully', 'success')
    } catch (error) {
      console.error('Sign out failed:', error)
      showToast('Failed to sign out', 'error')
    } finally {
      setSigningOut(false)
    }
  }

  if (loading) {
    return (
      <div class="space-y-6 fade-in flex items-center justify-center min-h-96">
        <div class="text-center">
          <div class="w-12 h-12 border-4 border-[#9c40ff] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p class="text-gray-600 dark:text-gray-400">Loading authentication settings...</p>
        </div>
      </div>
    )
  }

  return (
    <div class="space-y-6 fade-in">
      <Toast
        show={toastConfig.show}
        message={toastConfig.message}
        type={toastConfig.type}
        onClose={() => setToastConfig(prev => ({ ...prev, show: false }))}
      />

      {/* Header */}
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Authentication Settings
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          Manage your authentication method and credentials
        </p>
      </div>

      {/* Current Authentication */}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
          <svg class="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Current Authentication
        </h2>

        <div class="grid gap-4 md:grid-cols-2">
          <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Method
            </h3>
            <div class="flex items-center space-x-2">
              <span class="inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                {authInfo?.method === 'session' ? 'Session-based' : 'Token-based'}
              </span>
              <div class="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Active"></div>
            </div>
            <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
              {authInfo?.method === 'session' 
                ? 'Using session cookies for authentication' 
                : 'Using bearer tokens for API access'
              }
            </p>
          </div>

          {authInfo?.role && (
            <div class="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Access Level
              </h3>
              <RoleBadge role={authInfo.role} />
              <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Your current role and permissions
              </p>
            </div>
          )}
        </div>

        {authInfo?.user && (
          <div class="mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <h3 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              GitHub Account
            </h3>
            <div class="flex items-center space-x-3">
              {authInfo.user.avatar_url ? (
                <img 
                  src={authInfo.user.avatar_url} 
                  alt={`${authInfo.user.login}'s avatar`}
                  class="w-8 h-8 rounded-full"
                />
              ) : (
                <div class="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                  <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
              <div>
                <p class="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {authInfo.user.name || authInfo.user.login}
                </p>
                <p class="text-xs text-gray-600 dark:text-gray-400">
                  @{authInfo.user.login}
                </p>
                <p class="text-xs text-gray-500 dark:text-gray-500 mt-0.5">
                  Connected via GitHub OAuth
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Token Management */}
      <div class="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center">
          <svg class="w-5 h-5 text-purple-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m0 0a2 2 0 012 2 2 2 0 01-2 2 2 2 0 01-2-2m0 0V9a2 2 0 012-2m0 0V7a2 2 0 011-1.732c.445-.264.99-.398 1.548-.416C18.418 5.359 19 5.932 19 6.616V8" />
          </svg>
          API Tokens
        </h2>
        
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Manage your API tokens for programmatic access to GLINR Dock
        </p>
        
        <a 
          href="/administration/tokens"
          class="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Manage Tokens
        </a>
      </div>

      {/* Sign Out Section */}
      {authInfo?.method === 'session' && (
        <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h2 class="text-lg font-semibold text-red-900 dark:text-red-300 mb-4 flex items-center">
            <svg class="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Session Management
          </h2>
          
          <p class="text-sm text-red-800 dark:text-red-400 mb-4">
            End your current session and sign out from GLINR Dock
          </p>
          
          <button 
            onClick={handleSignOut}
            disabled={signingOut}
            class="inline-flex items-center px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {signingOut ? 'Signing Out...' : 'Sign Out'}
          </button>
        </div>
      )}

      {/* Security Notice */}
      <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
        <div class="flex items-start space-x-3">
          <svg class="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <h3 class="text-sm font-medium text-amber-900 dark:text-amber-300">
              Security Best Practices
            </h3>
            <p class="text-sm text-amber-800 dark:text-amber-400 mt-1">
              • Keep your API tokens secure and rotate them regularly<br/>
              • Use specific roles with minimal required permissions<br/>
              • Sign out from shared or public computers
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}