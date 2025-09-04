import { useState, useEffect } from 'preact/hooks'

export function Login() {
  const [token, setToken] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [oauthLoading, setOAuthLoading] = useState(false)

  // Check for OAuth errors in URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const oauthError = urlParams.get('error')
    
    if (oauthError) {
      switch (oauthError) {
        case 'oauth_failed':
          setError('GitHub authentication failed. Please try again.')
          break
        case 'csrf_failed':
          setError('Security check failed. Please try again.')
          break
        case 'invalid_state':
          setError('Invalid authentication state. Please try again.')
          break
        case 'token_exchange_failed':
          setError('Failed to exchange authorization code. Please try again.')
          break
        case 'user_fetch_failed':
          setError('Failed to fetch user information from GitHub.')
          break
        case 'auth_failed':
          setError('Authentication failed. Please contact your administrator.')
          break
        case 'session_failed':
          setError('Failed to create session. Please try again.')
          break
        default:
          setError('Authentication failed. Please try again.')
      }
      
      // Clean up URL
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
    }
  }, [])

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    
    if (!token.trim()) {
      setError('Please enter a token')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await fetch('/v1/health', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        localStorage.setItem('glinrdock_token', token)
        window.location.reload() // Simple reload to switch to dashboard
      } else {
        setError('Invalid token')
      }
    } catch (err) {
      setError('Failed to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const handleGitHubSignIn = () => {
    setOAuthLoading(true)
    setError('')
    
    // Redirect to GitHub OAuth flow
    window.location.href = '/v1/auth/github/login'
  }

  return (
    <div class="min-h-screen flex items-center justify-center bg-gray-900">
      <div class="max-w-md w-full space-y-8 p-8">
        <div>
          <h1 class="text-3xl font-bold text-center text-white mb-2">GLINR Dock</h1>
          <h2 class="text-xl text-center text-gray-400">Sign in to continue</h2>
        </div>
        
        <div class="mt-8 space-y-6">
          {/* GitHub OAuth Sign-in */}
          <div class="space-y-4">
            <button
              onClick={handleGitHubSignIn}
              disabled={oauthLoading || loading}
              class="btn btn-secondary w-full flex justify-center items-center border border-gray-600 bg-gray-800 hover:bg-gray-700 text-white"
            >
              {oauthLoading ? (
                <>
                  <div class="spinner w-4 h-4" />
                  <span class="ml-2">Redirecting to GitHub...</span>
                </>
              ) : (
                <>
                  <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clip-rule="evenodd" />
                  </svg>
                  Sign in with GitHub
                </>
              )}
            </button>
            
            <div class="relative">
              <div class="absolute inset-0 flex items-center">
                <div class="w-full border-t border-gray-600"></div>
              </div>
              <div class="relative flex justify-center text-sm">
                <span class="px-2 bg-gray-900 text-gray-400">Or continue with</span>
              </div>
            </div>
          </div>

          {/* API Token Form */}
          <form onSubmit={handleSubmit} class="space-y-6">
            <div>
              <label class="block text-sm font-medium text-gray-300 mb-2">
                API Token
              </label>
              <input
                type="password"
                value={token}
                onInput={(e) => setToken((e.target as HTMLInputElement).value)}
                placeholder="Enter your API token"
                class="input"
                disabled={loading || oauthLoading}
                required
              />
              <p class="text-xs text-gray-400 mt-2">
                Use your API token to access the GLINR Dock dashboard
              </p>
            </div>

            {error && (
              <p class="text-sm text-red-400 text-center">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || oauthLoading || !token.trim()}
              class="btn btn-primary w-full flex justify-center items-center"
            >
              {loading ? (
                <>
                  <div class="spinner w-4 h-4" />
                  <span class="ml-2">Signing in...</span>
                </>
              ) : (
                <>
                  <span class="mr-2">🔑</span>
                  Sign in
                </>
              )}
            </button>
          </form>
        </div>

        <div class="text-center">
          <p class="text-xs text-gray-500">
            Need help? Contact your administrator for an API token
          </p>
        </div>
      </div>
    </div>
  )
}