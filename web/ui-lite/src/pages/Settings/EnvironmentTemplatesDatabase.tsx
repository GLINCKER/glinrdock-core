import { useState } from 'preact/hooks'
import { apiClient, useApiData } from '../../api'
import { Toast } from '../../components/ui'
import { isAdminSync } from '../../rbac'
import { 
  Database, 
  Plus, 
  Settings, 
  FileText, 
  Eye, 
  Trash2, 
  ChevronDown, 
  Code2, 
  Server, 
  Key, 
  Copy,
  CheckCircle
} from 'lucide-preact'

interface EnvironmentTemplate {
  id: string
  name: string
  description?: string
  environment_type: 'development' | 'staging' | 'production' | 'testing'
  variables: Record<string, string>
  secrets: string[]
  is_system: boolean
  created_at: string
  updated_at: string
}

export function EnvironmentTemplatesDatabase() {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null)
  const [toastConfig, setToastConfig] = useState({ show: false, message: '', type: 'info' as 'info' | 'success' | 'error' })
  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>({})

  const isAdmin = isAdminSync()

  // Mock data for now - replace with actual API call
  const templates: EnvironmentTemplate[] = [
    {
      id: '1',
      name: 'Database Production',
      description: 'Production database configuration with security settings',
      environment_type: 'production',
      variables: {
        'DB_HOST': 'prod-db.company.com',
        'DB_PORT': '5432',
        'DB_NAME': 'production_db',
        'DB_SSL': 'require',
        'POOL_SIZE': '20'
      },
      secrets: ['DB_PASSWORD', 'DB_ADMIN_KEY', 'ENCRYPTION_KEY'],
      is_system: false,
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-20T15:30:00Z'
    },
    {
      id: '2',
      name: 'Database Development',
      description: 'Development database with debug settings',
      environment_type: 'development',
      variables: {
        'DB_HOST': 'dev-db.local',
        'DB_PORT': '5432',
        'DB_NAME': 'dev_db',
        'DB_SSL': 'disable',
        'DEBUG_QUERIES': 'true'
      },
      secrets: ['DB_PASSWORD'],
      is_system: false,
      created_at: '2024-01-10T09:00:00Z',
      updated_at: '2024-01-18T11:15:00Z'
    },
    {
      id: '3',
      name: 'Redis Cache Template',
      description: 'Redis configuration for caching layer',
      environment_type: 'production',
      variables: {
        'REDIS_HOST': 'cache.company.com',
        'REDIS_PORT': '6379',
        'REDIS_DB': '0',
        'MAX_CONNECTIONS': '100'
      },
      secrets: ['REDIS_PASSWORD', 'REDIS_AUTH_TOKEN'],
      is_system: true,
      created_at: '2024-01-08T14:20:00Z',
      updated_at: '2024-01-22T16:45:00Z'
    }
  ]

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToastConfig({ show: true, message, type })
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'production': return 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300'
      case 'staging': return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300'
      case 'development': return 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
      case 'testing': return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
      default: return 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      showToast('Copied to clipboard', 'success')
    }).catch(() => {
      showToast('Failed to copy', 'error')
    })
  }

  return (
    <div class="p-3 sm:p-4 max-w-7xl mx-auto space-y-4 fade-in">
      {/* Header */}
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-2xl font-bold mb-1">
            <span class="bg-gradient-to-r from-[#8b008b] via-[#9c40ff] to-[#e94057] bg-clip-text text-transparent">
              Environment Templates
            </span>
          </h1>
          <p class="text-gray-600 dark:text-gray-400 text-sm">
            Database and service configuration templates
          </p>
        </div>
        
        {isAdmin && (
          <button 
            class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-[#9c40ff] to-[#8b008b] hover:from-[#8b008b] hover:to-[#9c40ff] text-white font-medium rounded-lg shadow-md transition-all duration-200 hover:scale-[1.02] text-sm"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus class="w-4 h-4 mr-2" />
            New Template
          </button>
        )}
      </div>

      {/* Templates List */}
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="p-4">
          {templates && templates.length > 0 ? (
            <div class="space-y-3">
              {templates.map(template => (
                <div 
                  key={template.id} 
                  class={`group bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 transition-all duration-200 cursor-pointer hover:shadow-md ${
                    selectedTemplateId === template.id
                      ? 'border-[#9c40ff] bg-purple-50 dark:bg-purple-900/20' 
                      : 'border-transparent hover:border-gray-200 dark:hover:border-gray-600'
                  }`}
                  onClick={() => setSelectedTemplateId(selectedTemplateId === template.id ? null : template.id)}
                >
                  <div class="p-4">
                    <div class="flex items-center justify-between">
                      <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-gradient-to-br from-[#9c40ff]/20 to-[#8b008b]/20 rounded-lg flex items-center justify-center">
                          <Database class="w-5 h-5 text-[#9c40ff]" />
                        </div>
                        <div class="flex-1">
                          <div class="flex items-center gap-3 mb-1">
                            <h3 class="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-[#8b008b] dark:group-hover:text-[#9c40ff] transition-colors">
                              {template.name}
                            </h3>
                            {template.description && (
                              <span class="text-sm text-gray-600 dark:text-gray-400">• {template.description}</span>
                            )}
                            {template.is_system && (
                              <span class="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full">
                                System
                              </span>
                            )}
                          </div>
                          <div class="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                            <span>ID: {template.id}</span>
                            <span class={`px-2 py-0.5 rounded ${getTypeColor(template.environment_type)}`}>
                              {template.environment_type}
                            </span>
                            <span>{Object.keys(template.variables).length} variables</span>
                            <span>{template.secrets.length} secrets</span>
                            <span>Updated {new Date(template.updated_at).toLocaleDateString()}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div class="flex items-center space-x-2">
                        <button 
                          class="p-1.5 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/20 rounded transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            showToast('Template details view opened', 'info')
                          }}
                          title="View template details"
                        >
                          <Eye class="w-4 h-4" />
                        </button>
                        {isAdmin && !template.is_system && (
                          <button 
                            class="p-1.5 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteTemplateId(template.id)
                            }}
                            title="Delete template"
                          >
                            <Trash2 class="w-4 h-4" />
                          </button>
                        )}
                        <ChevronDown 
                          class={`w-4 h-4 text-gray-400 transition-transform duration-200 ${
                            selectedTemplateId === template.id ? 'rotate-180' : ''
                          }`}
                        />
                      </div>
                    </div>

                    {/* Expandable Template Details */}
                    {selectedTemplateId === template.id && (
                      <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600 space-y-4 bg-white dark:bg-gray-800 rounded-b-lg -mx-4 -mb-4 px-4 pb-4">
                        {/* Variables Section */}
                        <div>
                          <div class="flex items-center justify-between mb-3">
                            <h4 class="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
                              <Code2 class="w-4 h-4 mr-1.5 text-gray-500" />
                              Environment Variables ({Object.keys(template.variables).length})
                            </h4>
                          </div>
                          
                          {Object.keys(template.variables).length > 0 ? (
                            <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                              <div class="grid gap-2">
                                {Object.entries(template.variables).map(([key, value]) => (
                                  <div key={key} class="flex items-center justify-between py-1 px-2 bg-white dark:bg-gray-800 rounded border">
                                    <div class="flex items-center gap-2 min-w-0 flex-1">
                                      <span class="text-xs font-mono font-semibold text-blue-600 dark:text-blue-400">{key}</span>
                                      <span class="text-xs text-gray-400">=</span>
                                      <span class="text-xs font-mono text-gray-700 dark:text-gray-300 truncate">{value}</span>
                                    </div>
                                    <button
                                      onClick={() => copyToClipboard(`${key}=${value}`)}
                                      class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
                                      title="Copy variable"
                                    >
                                      <Copy class="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div class="text-center py-4 text-gray-500 dark:text-gray-400">
                              <Code2 class="w-6 h-6 mx-auto mb-2 text-gray-400" />
                              <p class="text-xs">No variables defined</p>
                            </div>
                          )}
                        </div>

                        {/* Secrets Section */}
                        <div>
                          <div class="flex items-center justify-between mb-3">
                            <h4 class="text-sm font-semibold text-gray-900 dark:text-white flex items-center">
                              <Key class="w-4 h-4 mr-1.5 text-gray-500" />
                              Secret Keys ({template.secrets.length})
                            </h4>
                          </div>
                          
                          {template.secrets.length > 0 ? (
                            <div class="bg-red-50 dark:bg-red-900/10 rounded-lg p-3">
                              <div class="grid gap-2">
                                {template.secrets.map((secret) => (
                                  <div key={secret} class="flex items-center justify-between py-1 px-2 bg-white dark:bg-gray-800 rounded border border-red-200 dark:border-red-800">
                                    <div class="flex items-center gap-2">
                                      <Key class="w-3 h-3 text-red-500" />
                                      <span class="text-xs font-mono font-semibold text-red-600 dark:text-red-400">{secret}</span>
                                      <span class="text-xs text-gray-400">(secret)</span>
                                    </div>
                                    <button
                                      onClick={() => copyToClipboard(secret)}
                                      class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded transition-colors"
                                      title="Copy secret key name"
                                    >
                                      <Copy class="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div class="text-center py-4 text-gray-500 dark:text-gray-400">
                              <Key class="w-6 h-6 mx-auto mb-2 text-gray-400" />
                              <p class="text-xs">No secrets defined</p>
                            </div>
                          )}
                        </div>

                        {/* Template Info */}
                        <div class="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                          <h5 class="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide flex items-center mb-2">
                            <Settings class="w-3 h-3 mr-1.5" />
                            Template Information
                          </h5>
                          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div>
                              <span class="text-gray-600 dark:text-gray-400">Created:</span>
                              <span class="ml-1 text-gray-900 dark:text-white">{new Date(template.created_at).toLocaleDateString()}</span>
                            </div>
                            <div>
                              <span class="text-gray-600 dark:text-gray-400">Updated:</span>
                              <span class="ml-1 text-gray-900 dark:text-white">{new Date(template.updated_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div class="text-center py-12">
              <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Database class="w-8 h-8 text-gray-400" />
              </div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">No templates found</h3>
              <p class="text-gray-600 dark:text-gray-400 text-sm mb-6">
                {isAdmin 
                  ? 'Create your first environment template to standardize configurations.' 
                  : 'No environment templates have been created yet.'}
              </p>
              {isAdmin && (
                <button 
                  class="inline-flex items-center px-4 py-2 bg-[#9c40ff] hover:bg-[#8b008b] text-white font-medium rounded-lg transition-colors"
                  onClick={() => setShowCreateModal(true)}
                >
                  <Plus class="w-4 h-4 mr-2" />
                  Create Template
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Toast Notifications */}
      <Toast
        message={toastConfig.message}
        type={toastConfig.type}
        isVisible={toastConfig.show}
        onClose={() => setToastConfig({ ...toastConfig, show: false })}
      />
    </div>
  )
}