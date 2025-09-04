import { useState, useEffect } from 'preact/hooks'
import { Github, Plus, Trash2, Settings, ExternalLink, CheckCircle, XCircle, Clock, AlertCircle, Info } from 'lucide-preact'
import { useModal } from '../ModalProvider'

interface GitHubIntegration {
  id: number
  name: string
  repository: string
  token: string
  webhook_secret: string
  status: 'active' | 'inactive' | 'error'
  last_sync: string
}

export function GitHubIntegrationTab() {
  const { showModal } = useModal()
  const [integrations, setIntegrations] = useState<GitHubIntegration[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    repository: '',
    token: '',
    webhook_secret: ''
  })

  useEffect(() => {
    loadIntegrations()
  }, [])

  const loadIntegrations = async () => {
    try {
      setLoading(true)
      // GitHub integration API not implemented yet
      // Show empty state for now
      setIntegrations([])
      setLoading(false)
    } catch (error) {
      console.error('Failed to load GitHub integrations:', error)
      setIntegrations([])
      setLoading(false)
    }
  }

  const handleSubmit = async (e: Event) => {
    e.preventDefault()
    try {
      // Add integration logic here
      console.log('Adding GitHub integration:', formData)
      setShowForm(false)
      setFormData({ name: '', repository: '', token: '', webhook_secret: '' })
      loadIntegrations()
    } catch (error) {
      console.error('Failed to add integration:', error)
    }
  }

  const deleteIntegration = async (id: number) => {
    if (!confirm('Are you sure you want to delete this integration?')) return
    try {
      // Delete logic here
      setIntegrations(prev => prev.filter(i => i.id !== id))
    } catch (error) {
      console.error('Failed to delete integration:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle class="w-4 h-4 text-green-400" />
      case 'inactive': return <Clock class="w-4 h-4 text-yellow-400" />
      case 'error': return <XCircle class="w-4 h-4 text-red-400" />
      default: return <AlertCircle class="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-400'
      case 'inactive': return 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30 text-yellow-400'
      case 'error': return 'from-red-500/20 to-pink-500/20 border-red-500/30 text-red-400'
      default: return 'from-gray-500/20 to-slate-500/20 border-gray-500/30 text-gray-400'
    }
  }

  if (loading) {
    return (
      <div class="animate-pulse space-y-4">
        <div class="h-8 bg-gray-200 dark:bg-white/10 rounded-lg w-1/3"></div>
        <div class="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} class="p-4 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
              <div class="h-5 bg-gray-200 dark:bg-white/10 rounded w-1/4 mb-3"></div>
              <div class="h-4 bg-gray-200 dark:bg-white/10 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <div>
          <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">GitHub Integration</h3>
          <p class="text-gray-600 dark:text-gray-300 text-sm">Connect your GitHub repositories for automated deployments</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          class="btn btn-primary flex items-center gap-2"
        >
          <Plus class="w-4 h-4" />
          Add Repository
        </button>
      </div>

      {showForm && (
        <div class="glassmorphism-card border border-gray-200 dark:border-white/10 rounded-xl p-6">
          <div class="flex items-center justify-between mb-4">
            <h4 class="text-lg font-medium text-gray-900 dark:text-white">Add GitHub Repository</h4>
            <button
              onClick={() => setShowForm(false)}
              class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors"
            >
              <XCircle class="w-5 h-5" />
            </button>
          </div>
          
          <form onSubmit={handleSubmit} class="space-y-4">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div class="flex items-center gap-2 mb-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Integration Name
                  </label>
                  <button
                    type="button"
                    onClick={() => showModal('Integration Name', (
                      <div class="space-y-3">
                        <p>Give your integration a descriptive name to identify it easily.</p>
                        <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                          <p class="text-sm font-medium text-blue-800 dark:text-blue-200">Examples:</p>
                          <ul class="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1">
                            <li>• "Main Repository"</li>
                            <li>• "Frontend App"</li>
                            <li>• "API Service"</li>
                          </ul>
                        </div>
                      </div>
                    ))}
                    class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    <Info class="w-4 h-4" />
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: (e.target as HTMLInputElement).value }))}
                  class="input bg-white/80 dark:bg-white/10 border-gray-300 dark:border-white/20 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="e.g., Main Repository"
                  required
                />
              </div>
              
              <div>
                <div class="flex items-center gap-2 mb-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    Repository
                  </label>
                  <button
                    type="button"
                    onClick={() => showModal('GitHub Repository', (
                      <div class="space-y-3">
                        <p>Enter the repository in the format <code class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm">username/repository</code> or <code class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-sm">organization/repository</code>.</p>
                        <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                          <p class="text-sm font-medium text-blue-800 dark:text-blue-200">Examples:</p>
                          <ul class="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1">
                            <li>• <code>myusername/my-app</code></li>
                            <li>• <code>mycompany/backend-api</code></li>
                            <li>• <code>john-doe/portfolio</code></li>
                          </ul>
                        </div>
                      </div>
                    ))}
                    class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    <Info class="w-4 h-4" />
                  </button>
                </div>
                <input
                  type="text"
                  value={formData.repository}
                  onChange={(e) => setFormData(prev => ({ ...prev, repository: (e.target as HTMLInputElement).value }))}
                  class="input bg-white/80 dark:bg-white/10 border-gray-300 dark:border-white/20 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="username/repository"
                  required
                />
              </div>
            </div>
            
            <div>
              <div class="flex items-center gap-2 mb-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  GitHub Personal Access Token
                </label>
                <button
                  type="button"
                  onClick={() => showModal('GitHub Personal Access Token', (
                    <div class="space-y-4">
                      <p>A GitHub Personal Access Token is required to authenticate with GitHub's API.</p>
                      
                      <div class="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                        <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">How to get your token:</p>
                        <ol class="text-sm text-yellow-700 dark:text-yellow-300 space-y-1 list-decimal list-inside">
                          <li>Go to GitHub Settings → Developer settings</li>
                          <li>Click "Personal access tokens" → "Tokens (classic)"</li>
                          <li>Click "Generate new token (classic)"</li>
                          <li>Select scopes: <code class="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">repo</code>, <code class="bg-yellow-100 dark:bg-yellow-800 px-1 rounded">workflow</code></li>
                          <li>Copy the generated token</li>
                        </ol>
                      </div>
                      
                      <div class="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                        <p class="text-sm font-medium text-red-800 dark:text-red-200">⚠️ Security Notice</p>
                        <p class="text-sm text-red-700 dark:text-red-300 mt-1">Keep your token secure and never share it. The token will be encrypted when stored.</p>
                      </div>
                    </div>
                  ))}
                  class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  <Info class="w-4 h-4" />
                </button>
              </div>
              <input
                type="password"
                value={formData.token}
                onChange={(e) => setFormData(prev => ({ ...prev, token: (e.target as HTMLInputElement).value }))}
                class="input bg-white/80 dark:bg-white/10 border-gray-300 dark:border-white/20 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                required
              />
            </div>
            
            <div>
              <div class="flex items-center gap-2 mb-2">
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Webhook Secret (Optional)
                </label>
                <button
                  type="button"
                  onClick={() => showModal('Webhook Secret', (
                    <div class="space-y-3">
                      <p>An optional secret used to validate webhook payloads from GitHub.</p>
                      
                      <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                        <p class="text-sm font-medium text-blue-800 dark:text-blue-200">Options:</p>
                        <ul class="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1">
                          <li>• <strong>Leave empty:</strong> A secure random secret will be generated automatically</li>
                          <li>• <strong>Provide your own:</strong> Use a strong, random string for better security</li>
                        </ul>
                      </div>
                      
                      <p class="text-sm text-gray-600 dark:text-gray-400">The secret helps ensure webhook requests are genuinely from GitHub and haven't been tampered with.</p>
                    </div>
                  ))}
                  class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                >
                  <Info class="w-4 h-4" />
                </button>
              </div>
              <input
                type="password"
                value={formData.webhook_secret}
                onChange={(e) => setFormData(prev => ({ ...prev, webhook_secret: (e.target as HTMLInputElement).value }))}
                class="input bg-white/80 dark:bg-white/10 border-gray-300 dark:border-white/20 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="Leave empty to auto-generate"
              />
            </div>
            
            <div class="flex gap-3 pt-4">
              <button type="submit" class="btn btn-primary">
                Add Integration
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                class="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div class="space-y-4">
        {integrations.length === 0 ? (
          <div class="text-center py-12">
            <Github class="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No GitHub Integrations</h3>
            <p class="text-gray-600 dark:text-gray-400 mb-4">Connect your first GitHub repository to get started</p>
            <button
              onClick={() => setShowForm(true)}
              class="btn btn-primary"
            >
              Add Repository
            </button>
          </div>
        ) : (
          integrations.map((integration) => (
            <div key={integration.id} class="glassmorphism-card border border-gray-200 dark:border-white/10 rounded-xl p-6">
              <div class="flex items-start justify-between">
                <div class="flex-1">
                  <div class="flex items-center gap-3 mb-3">
                    <Github class="w-5 h-5 text-gray-800 dark:text-white" />
                    <h4 class="text-lg font-medium text-gray-900 dark:text-white">{integration.name}</h4>
                    <div class={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-gradient-to-r border ${getStatusColor(integration.status)}`}>
                      {getStatusIcon(integration.status)}
                      {integration.status.charAt(0).toUpperCase() + integration.status.slice(1)}
                    </div>
                  </div>
                  
                  <div class="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    <div class="flex items-center gap-2">
                      <ExternalLink class="w-4 h-4" />
                      <span>{integration.repository}</span>
                    </div>
                    <div class="flex items-center gap-2">
                      <Clock class="w-4 h-4" />
                      <span>Last sync: {new Date(integration.last_sync).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
                
                <div class="flex items-center gap-2">
                  <button class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-all">
                    <Settings class="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteIntegration(integration.id)}
                    class="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-all"
                  >
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}