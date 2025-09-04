import { useState, useEffect } from 'preact/hooks'
import { apiClient } from '../../api'
import { Toast } from '../../components/ui'
import { Github, Shield, CheckCircle, ArrowRight, ExternalLink } from 'lucide-preact'

export function IntegrationsSetup() {
  const [toastConfig, setToastConfig] = useState({ show: false, message: '', type: 'info' as 'info' | 'success' | 'error' })
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [setupComplete, setSetupComplete] = useState(false)
  
  // Configuration state
  const [skipSetup, setSkipSetup] = useState(false)
  const [enableOAuth, setEnableOAuth] = useState(false)
  const [oauthMode, setOauthMode] = useState<'pkce' | 'confidential'>('pkce')
  const [oauthClientId, setOauthClientId] = useState('')
  const [oauthClientSecret, setOauthClientSecret] = useState('')
  
  const [enableApp, setEnableApp] = useState(false)
  const [appId, setAppId] = useState('')
  const [appPrivateKey, setAppPrivateKey] = useState('')

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToastConfig({ show: true, message, type })
  }

  const handleSkipSetup = () => {
    // Redirect to main app without configuring integrations
    window.location.href = '/app/'
  }

  const handleCompleteSetup = async () => {
    if (skipSetup) {
      handleSkipSetup()
      return
    }

    setSaving(true)
    
    try {
      const updateData: any = {}

      // Configure OAuth if enabled
      if (enableOAuth) {
        updateData.github_oauth = {
          mode: oauthMode,
          client_id: oauthClientId.trim(),
        }

        if (oauthMode === 'confidential' && oauthClientSecret.trim()) {
          updateData.github_oauth.client_secret = oauthClientSecret
        }
      }

      // Configure App if enabled
      if (enableApp) {
        updateData.github_app = {
          app_id: appId.trim(),
        }

        if (appPrivateKey.trim()) {
          updateData.github_app.private_key_pem = appPrivateKey
        }
      }

      // Save configuration if any integrations are enabled
      if (Object.keys(updateData).length > 0) {
        await apiClient.put('/settings/integrations', updateData)
      }
      
      setSetupComplete(true)
      showToast('Integration setup completed successfully', 'success')
      
      // Redirect to main app after a short delay
      setTimeout(() => {
        window.location.href = '/app/'
      }, 2000)
      
    } catch (error: any) {
      showToast(error.message || 'Failed to save integration configuration', 'error')
    } finally {
      setSaving(false)
    }
  }

  const validateStep = () => {
    if (step === 2 && enableOAuth) {
      if (!oauthClientId.trim()) {
        showToast('GitHub OAuth Client ID is required', 'error')
        return false
      }
      if (oauthMode === 'confidential' && !oauthClientSecret.trim()) {
        showToast('Client Secret is required for confidential mode', 'error')
        return false
      }
    }
    
    if (step === 3 && enableApp) {
      if (!appId.trim()) {
        showToast('GitHub App ID is required', 'error')
        return false
      }
      if (!/^\d+$/.test(appId.trim())) {
        showToast('App ID must be numeric', 'error')
        return false
      }
      if (!appPrivateKey.trim()) {
        showToast('GitHub App Private Key is required', 'error')
        return false
      }
    }
    
    return true
  }

  const nextStep = () => {
    if (validateStep()) {
      setStep(step + 1)
    }
  }

  const handleFileUpload = (event: Event) => {
    const input = event.target as HTMLInputElement
    if (input.files && input.files[0]) {
      const file = input.files[0]
      const reader = new FileReader()
      reader.onload = (e) => {
        setAppPrivateKey((e.target as FileReader).result as string)
      }
      reader.readAsText(file)
    }
  }

  if (setupComplete) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-8 max-w-md w-full text-center">
          <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Setup Complete!
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Your GitHub integrations have been configured successfully. 
            Redirecting to the dashboard...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto py-8 px-6">
        <div className="text-center mb-8">
          <Shield className="h-12 w-12 text-blue-600 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Welcome to GLINR Dock!
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Let's set up your GitHub integrations for secure CI/CD
          </p>
        </div>

        {/* Progress indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400 mb-2">
            <span className={step >= 1 ? 'text-blue-600 dark:text-blue-400' : ''}>Choose Integrations</span>
            <span className={step >= 2 ? 'text-blue-600 dark:text-blue-400' : ''}>OAuth Setup</span>
            <span className={step >= 3 ? 'text-blue-600 dark:text-blue-400' : ''}>App Setup</span>
            <span className={step >= 4 ? 'text-blue-600 dark:text-blue-400' : ''}>Complete</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${(step - 1) * 33.33}%` }}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          {/* Step 1: Choose integrations */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Choose Your GitHub Integrations
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Select the GitHub features you'd like to enable. You can always configure these later.
              </p>

              <div className="space-y-4">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableOAuth}
                    onChange={(e) => setEnableOAuth((e.target as HTMLInputElement).checked)}
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <Github className="h-4 w-4" />
                      <span className="font-medium text-gray-900 dark:text-white">
                        GitHub OAuth Login
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Allow users to log in with their GitHub accounts
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={enableApp}
                    onChange={(e) => setEnableApp((e.target as HTMLInputElement).checked)}
                    className="mt-1 h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      <span className="font-medium text-gray-900 dark:text-white">
                        GitHub App Integration
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Secure repository access and CI/CD webhooks without PATs
                    </p>
                  </div>
                </label>

                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipSetup}
                    onChange={(e) => setSkipSetup((e.target as HTMLInputElement).checked)}
                    className="mt-1 h-4 w-4 text-gray-600 border-gray-300 rounded"
                  />
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      Skip setup for now
                    </span>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Configure integrations later in Settings
                    </p>
                  </div>
                </label>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={nextStep}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium inline-flex items-center gap-2"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: OAuth Setup */}
          {step === 2 && (
            <div>
              {enableOAuth ? (
                <>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Configure GitHub OAuth
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Set up GitHub OAuth for user authentication. PKCE mode is more secure and recommended.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Authentication Mode
                      </label>
                      <select
                        value={oauthMode}
                        onChange={(e) => setOauthMode((e.target as HTMLSelectElement).value as any)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="pkce">PKCE (Recommended)</option>
                        <option value="confidential">Confidential</option>
                      </select>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                        PKCE mode doesn't require storing a client secret
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        GitHub OAuth Client ID
                      </label>
                      <input
                        type="text"
                        value={oauthClientId}
                        onChange={(e) => setOauthClientId((e.target as HTMLInputElement).value)}
                        placeholder="Enter your GitHub OAuth Client ID"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    {oauthMode === 'confidential' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Client Secret
                        </label>
                        <input
                          type="password"
                          value={oauthClientSecret}
                          onChange={(e) => setOauthClientSecret((e.target as HTMLInputElement).value)}
                          placeholder="Enter your GitHub OAuth Client Secret"
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    GitHub OAuth Skipped
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    GitHub OAuth login will not be configured. You can enable it later in Settings.
                  </p>
                </>
              )}

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setStep(step - 1)}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-4 py-2"
                >
                  Back
                </button>
                <button
                  onClick={nextStep}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium inline-flex items-center gap-2"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: App Setup */}
          {step === 3 && (
            <div>
              {enableApp ? (
                <>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    Configure GitHub App
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    Set up your GitHub App for secure repository access and CI/CD webhooks.
                  </p>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        GitHub App ID
                      </label>
                      <input
                        type="text"
                        value={appId}
                        onChange={(e) => setAppId((e.target as HTMLInputElement).value)}
                        placeholder="Enter your GitHub App ID (numeric)"
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Private Key (PEM Format)
                      </label>
                      <textarea
                        value={appPrivateKey}
                        onChange={(e) => setAppPrivateKey((e.target as HTMLTextAreaElement).value)}
                        placeholder="Paste your GitHub App private key (PEM format)"
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
                      />
                      
                      <div className="mt-2">
                        <input
                          type="file"
                          accept=".pem,.key,.txt"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="private-key-upload"
                        />
                        <label
                          htmlFor="private-key-upload"
                          className="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline text-sm"
                        >
                          Or upload PEM file
                        </label>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                    GitHub App Skipped
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    GitHub App integration will not be configured. You can enable it later in Settings.
                  </p>
                </>
              )}

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setStep(step - 1)}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-4 py-2"
                >
                  Back
                </button>
                <button
                  onClick={nextStep}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-md font-medium inline-flex items-center gap-2"
                >
                  Continue
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Complete */}
          {step === 4 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Review & Complete Setup
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Review your configuration and complete the setup.
              </p>

              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-900 dark:text-white">GitHub OAuth Login</span>
                  <span className={`text-sm ${enableOAuth ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                    {enableOAuth ? `Enabled (${oauthMode})` : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-gray-900 dark:text-white">GitHub App Integration</span>
                  <span className={`text-sm ${enableApp ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                    {enableApp ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setStep(step - 1)}
                  className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 px-4 py-2"
                >
                  Back
                </button>
                <button
                  onClick={handleCompleteSetup}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-6 py-2 rounded-md font-medium inline-flex items-center gap-2"
                >
                  {saving ? 'Saving...' : 'Complete Setup'}
                  <CheckCircle className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {toastConfig.show && (
        <Toast 
          message={toastConfig.message} 
          type={toastConfig.type} 
          onClose={() => setToastConfig({ ...toastConfig, show: false })} 
        />
      )}
    </div>
  )
}