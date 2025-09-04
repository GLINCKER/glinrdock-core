import { useState, useEffect } from 'preact/hooks'
import { apiClient } from '../api'
import { Modal } from '../components/ui/Modal'
import { Toast } from '../components/ui/Toast'
import { PrimaryButton, SecondaryButton, DangerButton } from '../components/ui/Button'
import { RBACGuard } from '../components/Guards'
import { getAuthInfo } from '../rbac'
import { Plus, Trash2, Server, Eye, EyeOff, TestTube, AlertCircle, CheckCircle, Settings } from 'lucide-preact'

interface Registry {
  id: string
  name: string
  type: string
  server: string
  username: string
  created_at: string
  updated_at: string
}

interface RegistryType {
  type: string
  server: string
}

interface CreateRegistryData {
  name: string
  type: string
  server: string
  username: string
  password: string
}

export function Registries() {
  const [registries, setRegistries] = useState<Registry[]>([])
  const [registryTypes, setRegistryTypes] = useState<RegistryType[]>([])
  const [loading, setLoading] = useState(true)
  const [authLoading, setAuthLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [testingRegistry, setTestingRegistry] = useState<string | null>(null)

  const [createData, setCreateData] = useState<CreateRegistryData>({
    name: '',
    type: 'dockerhub',
    server: '',
    username: '',
    password: ''
  })

  useEffect(() => {
    loadRegistries()
    loadRegistryTypes()
    loadAuthInfo()
  }, [])

  const loadAuthInfo = async () => {
    try {
      const auth = await getAuthInfo()
      setIsAdmin(auth?.role === 'admin')
    } catch (error) {
      console.error('Failed to load auth info:', error)
      setIsAdmin(false)
    } finally {
      setAuthLoading(false)
    }
  }

  const loadRegistries = async () => {
    try {
      const response = await apiClient.getRegistries()
      setRegistries(response.registries || [])
    } catch (error) {
      console.error('Failed to load registries:', error)
      showToast('Failed to load registries', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadRegistryTypes = async () => {
    try {
      const response = await apiClient.getRegistryTypes()
      setRegistryTypes(response.types || [])
    } catch (error) {
      console.error('Failed to load registry types:', error)
    }
  }

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 5000)
  }

  const handleCreateRegistry = async () => {
    if (!createData.name.trim() || !createData.username.trim() || !createData.password.trim()) {
      showToast('Please fill in all required fields', 'error')
      return
    }

    try {
      await apiClient.createRegistry(createData)
      showToast('Registry created successfully', 'success')
      setIsCreateModalOpen(false)
      resetCreateForm()
      loadRegistries()
    } catch (error: any) {
      console.error('Failed to create registry:', error)
      showToast(error.message || 'Failed to create registry', 'error')
    }
  }

  const handleDeleteRegistry = async (registry: Registry) => {
    try {
      await apiClient.deleteRegistry(registry.id)
      showToast('Registry deleted successfully', 'success')
      setDeleteConfirm(null)
      loadRegistries()
    } catch (error: any) {
      console.error('Failed to delete registry:', error)
      showToast(error.message || 'Failed to delete registry', 'error')
    }
  }

  const handleTestRegistry = async (registryId: string) => {
    setTestingRegistry(registryId)
    try {
      await apiClient.testRegistryConnection(registryId)
      showToast('Registry connection test successful', 'success')
    } catch (error: any) {
      console.error('Registry test failed:', error)
      showToast(error.message || 'Registry connection test failed', 'error')
    } finally {
      setTestingRegistry(null)
    }
  }

  const resetCreateForm = () => {
    setCreateData({
      name: '',
      type: 'dockerhub',
      server: '',
      username: '',
      password: ''
    })
    setShowPassword(false)
  }

  const handleTypeChange = (type: string) => {
    const registryType = registryTypes.find(t => t.type === type)
    setCreateData(prev => ({
      ...prev,
      type,
      server: registryType?.server || ''
    }))
  }

  const getRegistryTypeIcon = (type: string) => {
    switch (type) {
      case 'dockerhub':
        return '🐳'
      case 'ghcr':
        return '🐱'
      case 'ecr':
        return '☁️'
      default:
        return '📦'
    }
  }

  const getRegistryTypeName = (type: string) => {
    switch (type) {
      case 'dockerhub':
        return 'Docker Hub'
      case 'ghcr':
        return 'GitHub Container Registry'
      case 'ecr':
        return 'Amazon ECR'
      default:
        return 'Generic Registry'
    }
  }

  if (loading || authLoading) {
    return (
      <div class="space-y-6 fade-in">
        <div class="animate-pulse space-y-6">
          {/* Header skeleton */}
          <div>
            <div class="h-10 bg-gray-300 dark:bg-gray-700 rounded w-2/3 mb-2"></div>
            <div class="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
          </div>
          
          {/* Content skeleton */}
          <div class="bg-white dark:bg-gray-800 rounded-2xl p-6">
            <div class="space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} class="h-20 bg-gray-100 dark:bg-gray-700 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div class="space-y-6 fade-in">
      {/* Header */}
      <div>
        <h1 class="text-3xl font-bold mb-2">
          <span class="bg-gradient-to-r from-[#8b008b] via-[#9c40ff] to-[#e94057] bg-clip-text text-transparent">
            Container Registries
          </span>
        </h1>
        <p class="text-gray-600 dark:text-gray-400">
          Manage private container registry credentials for secure image pulls
        </p>
      </div>

      {/* Main Registry Card */}
      <div class="bg-gradient-to-r from-white/95 via-gray-50/90 to-white/95 dark:from-gray-800/95 dark:via-gray-900/90 dark:to-gray-800/95 rounded-2xl shadow-lg shadow-[#8b008b]/10">
        {/* Registry Header */}
        <div class="p-6 border-b border-gray-200/50 dark:border-gray-700/50">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-3">
              <div class="w-12 h-12 bg-gradient-to-br from-[#8b008b] to-[#9c40ff] rounded-xl flex items-center justify-center shadow-lg">
                <Server class="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 class="text-xl font-bold text-gray-900 dark:text-white">Registry Management</h2>
                <p class="text-gray-600 dark:text-gray-400 text-sm">
                  Configure authentication for private container registries
                </p>
              </div>
            </div>
            
            <RBACGuard roles={['admin']} showError={false}>
              <button
                onClick={() => setIsCreateModalOpen(true)}
                class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-[#8b008b] to-[#9c40ff] hover:from-[#7a0077] hover:to-[#8a36e6] text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
              >
                <Plus class="w-4 h-4 mr-2" />
                Add Registry
              </button>
            </RBACGuard>
          </div>
        </div>

        {/* Registry List */}
        <div class="p-6">
          {registries.length === 0 ? (
            <div class="text-center py-12">
              <div class="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Server class="w-8 h-8 text-gray-400" />
              </div>
              <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">No registries configured</h3>
              <p class="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                Add container registries to pull images from private repositories like GitHub Container Registry, Amazon ECR, or Docker Hub private repos.
              </p>
              {isAdmin && (
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  class="inline-flex items-center px-6 py-3 bg-gradient-to-r from-[#8b008b] to-[#9c40ff] hover:from-[#7a0077] hover:to-[#8a36e6] text-white rounded-lg font-medium transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <Plus class="w-4 h-4 mr-2" />
                  Add Your First Registry
                </button>
              )}
            </div>
          ) : (
            <div class="grid grid-cols-1 gap-4">
              {registries.map((registry) => (
                <div key={registry.id} class="bg-white/60 dark:bg-gray-700/60 rounded-xl p-4 border border-gray-200/50 dark:border-gray-600/50 hover:shadow-lg transition-all duration-200">
                  <div class="flex items-center justify-between">
                    <div class="flex items-center space-x-4">
                      <div class="w-12 h-12 bg-gray-100 dark:bg-gray-600 rounded-lg flex items-center justify-center text-2xl">
                        {getRegistryTypeIcon(registry.type)}
                      </div>
                      <div>
                        <h3 class="text-lg font-semibold text-gray-900 dark:text-white">{registry.name}</h3>
                        <div class="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                          <span class="flex items-center">
                            <span class="font-medium">{getRegistryTypeName(registry.type)}</span>
                          </span>
                          <span>•</span>
                          <span class="font-mono">{registry.server}</span>
                          <span>•</span>
                          <span>@{registry.username}</span>
                        </div>
                        <div class="text-xs text-gray-400 dark:text-gray-500 mt-1">
                          Created {new Date(registry.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center space-x-2">
                      {isAdmin && (
                        <>
                          <button
                            onClick={() => handleTestRegistry(registry.id)}
                            disabled={testingRegistry === registry.id}
                            class="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors disabled:opacity-50"
                            title="Test connection"
                          >
                            {testingRegistry === registry.id ? (
                              <div class="w-4 h-4 animate-spin border-2 border-blue-500 border-t-transparent rounded-full"></div>
                            ) : (
                              <TestTube class="w-4 h-4" />
                            )}
                          </button>
                          
                          <button
                            onClick={() => setDeleteConfirm({ id: registry.id, name: registry.name })}
                            class="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            title="Delete registry"
                          >
                            <Trash2 class="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Info Card */}
      <div class="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-800/30">
        <div class="flex items-start space-x-3">
          <AlertCircle class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
          <div class="text-sm text-blue-800 dark:text-blue-200">
            <h4 class="font-semibold mb-2">Registry Usage</h4>
            <ul class="space-y-1 text-xs">
              <li>• Credentials are encrypted at rest using AES-GCM encryption</li>
              <li>• Only administrators can manage registry credentials</li>
              <li>• Deployers and above can select registries when configuring services</li>
              <li>• Registry authentication is automatically used during image pulls</li>
              <li>• Password/tokens are never displayed after creation for security</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Create Registry Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false)
          resetCreateForm()
        }}
        title="Add Container Registry"
      >
        <div class="space-y-4">
          {/* Registry Name */}
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Registry Name <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={createData.name}
              onInput={(e) => setCreateData(prev => ({ ...prev, name: e.currentTarget.value }))}
              class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-[#9c40ff] focus:border-transparent"
              placeholder="My Private Registry"
            />
          </div>

          {/* Registry Type */}
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Registry Type <span class="text-red-500">*</span>
            </label>
            <select
              value={createData.type}
              onChange={(e) => handleTypeChange(e.currentTarget.value)}
              class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-[#9c40ff] focus:border-transparent"
            >
              {registryTypes.map((type) => (
                <option key={type.type} value={type.type}>
                  {getRegistryTypeName(type.type)}
                </option>
              ))}
            </select>
          </div>

          {/* Server URL */}
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Registry Server <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={createData.server}
              onInput={(e) => setCreateData(prev => ({ ...prev, server: e.currentTarget.value }))}
              class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-[#9c40ff] focus:border-transparent"
              placeholder="registry.example.com"
            />
          </div>

          {/* Username */}
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Username <span class="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={createData.username}
              onInput={(e) => setCreateData(prev => ({ ...prev, username: e.currentTarget.value }))}
              class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-[#9c40ff] focus:border-transparent"
              placeholder="username"
            />
          </div>

          {/* Password */}
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password / Token <span class="text-red-500">*</span>
            </label>
            <div class="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={createData.password}
                onInput={(e) => setCreateData(prev => ({ ...prev, password: e.currentTarget.value }))}
                class="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-[#9c40ff] focus:border-transparent pr-10"
                placeholder="password or access token"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPassword ? <EyeOff class="w-4 h-4" /> : <Eye class="w-4 h-4" />}
              </button>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Password will be encrypted and stored securely
            </p>
          </div>

          {/* Security Notice */}
          <div class="flex items-start space-x-2 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg">
            <AlertCircle class="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
            <div class="text-xs text-amber-800 dark:text-amber-200">
              <p class="font-medium mb-1">Security Notice</p>
              <p>Credentials are encrypted at rest. Only admins can manage registries. Passwords are never displayed after creation.</p>
            </div>
          </div>
        </div>

        <div class="flex justify-end space-x-3 mt-6">
          <SecondaryButton
            onClick={() => {
              setIsCreateModalOpen(false)
              resetCreateForm()
            }}
            size="md"
          >
            Cancel
          </SecondaryButton>
          <PrimaryButton
            onClick={handleCreateRegistry}
            size="md"
          >
            Create Registry
          </PrimaryButton>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <Modal
          isOpen={true}
          onClose={() => setDeleteConfirm(null)}
          title="Delete Registry"
        >
          <div class="space-y-4">
            <div class="flex items-start space-x-3">
              <div class="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                <Trash2 class="w-5 h-5 text-red-500" />
              </div>
              <div>
                <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Delete Registry</h3>
                <p class="text-gray-600 dark:text-gray-400 text-sm">
                  Are you sure you want to delete <strong class="text-gray-900 dark:text-white">{deleteConfirm.name}</strong>? 
                  This action cannot be undone.
                </p>
                <p class="text-amber-600 dark:text-amber-400 text-sm mt-2">
                  Services using this registry may fail to pull images.
                </p>
              </div>
            </div>
          </div>

          <div class="flex justify-end space-x-3 mt-6">
            <SecondaryButton
              onClick={() => setDeleteConfirm(null)}
              size="md"
            >
              Cancel
            </SecondaryButton>
            <DangerButton
              onClick={() => {
                const registry = registries.find(r => r.id === deleteConfirm.id)
                if (registry) handleDeleteRegistry(registry)
              }}
              size="md"
            >
              Delete Registry
            </DangerButton>
          </div>
        </Modal>
      )}

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          isVisible={true}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  )
}