import { useState, useEffect } from 'preact/hooks'
import { Server, Plus, Trash2, Settings, Power, RefreshCw, AlertTriangle, CheckCircle, Clock, Globe, Shield, Info } from 'lucide-preact'
import { apiClient } from '../../api'
import { useModal } from '../ModalProvider'

interface NginxConfig {
  enabled: boolean
  status: 'running' | 'stopped' | 'error'
  version: string
  uptime: string
  total_routes: number
  ssl_routes: number
  last_reload: string
}

interface ProxyRoute {
  id: number
  domain: string
  target: string
  ssl_enabled: boolean
  status: 'active' | 'inactive' | 'error'
  last_checked: string
  response_time: number
}

export function NginxProxyTab() {
  const { showModal } = useModal()
  const [config, setConfig] = useState<NginxConfig | null>(null)
  const [routes, setRoutes] = useState<ProxyRoute[]>([])
  const [loading, setLoading] = useState(true)
  const [showRouteForm, setShowRouteForm] = useState(false)
  const [reloading, setReloading] = useState(false)
  
  const [routeFormData, setRouteFormData] = useState({
    domain: '',
    target: '',
    ssl_enabled: true
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Get Nginx status
      const nginxStatus = await apiClient.getNginxStatus()
      
      // Get system info for version
      const systemInfo = await apiClient.getSystemInfo()
      
      // Get routes for proxy configuration
      const allRoutes = await apiClient.listRoutes()
      
      // Calculate uptime (mock for now since API doesn't provide this)
      const now = new Date()
      const uptimeStart = nginxStatus.last_apply_time ? new Date(nginxStatus.last_apply_time) : now
      const uptimeDiff = now.getTime() - uptimeStart.getTime()
      const uptimeHours = Math.floor(uptimeDiff / (1000 * 60 * 60))
      const uptimeMinutes = Math.floor((uptimeDiff % (1000 * 60 * 60)) / (1000 * 60))
      const uptimeStr = uptimeHours > 24 
        ? `${Math.floor(uptimeHours / 24)}d ${uptimeHours % 24}h ${uptimeMinutes}m`
        : `${uptimeHours}h ${uptimeMinutes}m`
      
      setConfig({
        enabled: nginxStatus.enabled,
        status: nginxStatus.enabled ? 'running' : 'stopped',
        version: systemInfo?.nginx_version || '1.24.0', // fallback if not available
        uptime: uptimeStr,
        total_routes: allRoutes.length,
        ssl_routes: allRoutes.filter(r => r.tls).length,
        last_reload: nginxStatus.last_apply_time || new Date().toISOString()
      })
      
      // Convert API routes to our interface format
      const proxyRoutes: ProxyRoute[] = allRoutes.map(route => ({
        id: route.id,
        domain: route.domain,
        target: `${route.service_name}:${route.port}`,
        ssl_enabled: route.tls,
        status: route.last_status === 'healthy' ? 'active' : 
               route.last_status === 'unhealthy' ? 'error' : 'inactive',
        last_checked: route.last_check_at || new Date().toISOString(),
        response_time: Math.floor(Math.random() * 100) + 20 // Mock response time for now
      }))
      
      setRoutes(proxyRoutes)
      setLoading(false)
    } catch (error) {
      console.error('Failed to load Nginx data:', error)
      setLoading(false)
    }
  }

  const toggleNginx = async () => {
    try {
      const newStatus = config?.status === 'running' ? 'stopped' : 'running'
      console.log('Toggling Nginx to:', newStatus)
      if (config) {
        setConfig({ ...config, status: newStatus })
      }
    } catch (error) {
      console.error('Failed to toggle Nginx:', error)
    }
  }

  const reloadNginx = async () => {
    try {
      setReloading(true)
      await apiClient.nginxReload()
      
      // Refresh the data after reload
      await loadData()
    } catch (error) {
      console.error('Failed to reload Nginx:', error)
    } finally {
      setReloading(false)
    }
  }

  const handleRouteSubmit = async (e: Event) => {
    e.preventDefault()
    try {
      console.log('Adding proxy route:', routeFormData)
      setShowRouteForm(false)
      setRouteFormData({ domain: '', target: '', ssl_enabled: true })
      loadData()
    } catch (error) {
      console.error('Failed to add route:', error)
    }
  }

  const deleteRoute = async (id: number) => {
    if (!confirm('Are you sure you want to delete this route?')) return
    try {
      setRoutes(prev => prev.filter(r => r.id !== id))
      if (config) {
        setConfig({ ...config, total_routes: config.total_routes - 1 })
      }
    } catch (error) {
      console.error('Failed to delete route:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
      case 'active': return <CheckCircle class="w-4 h-4 text-green-400" />
      case 'stopped':
      case 'inactive': return <Clock class="w-4 h-4 text-yellow-400" />
      case 'error': return <AlertTriangle class="w-4 h-4 text-red-400" />
      default: return <AlertTriangle class="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
      case 'active': return 'from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-400'
      case 'stopped':
      case 'inactive': return 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30 text-yellow-400'
      case 'error': return 'from-red-500/20 to-pink-500/20 border-red-500/30 text-red-400'
      default: return 'from-gray-500/20 to-slate-500/20 border-gray-500/30 text-gray-400'
    }
  }

  if (loading) {
    return (
      <div class="animate-pulse space-y-6">
        <div class="h-8 bg-gray-200 dark:bg-white/10 rounded-lg w-1/3"></div>
        <div class="glassmorphism-card border border-gray-200 dark:border-white/10 rounded-xl p-6">
          <div class="h-24 bg-gray-100 dark:bg-white/5 rounded-lg"></div>
        </div>
        <div class="space-y-3">
          {[...Array(2)].map((_, i) => (
            <div key={i} class="p-4 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
              <div class="h-5 bg-gray-200 dark:bg-white/10 rounded w-1/2 mb-2"></div>
              <div class="h-4 bg-gray-200 dark:bg-white/10 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div class="space-y-8">
      <div>
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">Nginx Reverse Proxy</h3>
        <p class="text-gray-600 dark:text-gray-300 text-sm">Manage reverse proxy configuration and SSL termination</p>
      </div>

      {/* Setup Requirements Notice */}
      <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-xl p-4">
        <div class="flex items-start gap-3">
          <Info class="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <h4 class="text-sm font-medium text-amber-800 dark:text-amber-200">Setup Required</h4>
            <p class="text-sm text-amber-700 dark:text-amber-300 mt-1">
              To use SSL/TLS certificates with Nginx proxy, you must first configure a DNS provider in the "DNS & Certificates" tab. 
              This enables automatic certificate provisioning and renewal.
            </p>
            <button
              onClick={() => showModal('Nginx Proxy Setup Requirements', (
                <div class="space-y-4">
                  <p>To use Nginx reverse proxy with SSL/TLS certificates, you need to complete the setup in a specific order:</p>
                  
                  <div class="space-y-3">
                    <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                      <div class="flex items-center gap-2 mb-2">
                        <span class="flex items-center justify-center w-6 h-6 bg-blue-600 text-white text-sm font-bold rounded-full">1</span>
                        <p class="text-sm font-medium text-blue-800 dark:text-blue-200">Configure DNS Provider</p>
                      </div>
                      <p class="text-sm text-blue-700 dark:text-blue-300 ml-8">
                        Go to "DNS & Certificates" tab and add your DNS provider (Cloudflare, Route53, or DigitalOcean). 
                        This enables automatic certificate management.
                      </p>
                    </div>
                    
                    <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                      <div class="flex items-center gap-2 mb-2">
                        <span class="flex items-center justify-center w-6 h-6 bg-green-600 text-white text-sm font-bold rounded-full">2</span>
                        <p class="text-sm font-medium text-green-800 dark:text-green-200">Add Domains</p>
                      </div>
                      <p class="text-sm text-green-700 dark:text-green-300 ml-8">
                        Add the domains you want to use for your proxy routes. SSL certificates will be automatically 
                        provisioned and renewed for verified domains.
                      </p>
                    </div>
                    
                    <div class="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                      <div class="flex items-center gap-2 mb-2">
                        <span class="flex items-center justify-center w-6 h-6 bg-purple-600 text-white text-sm font-bold rounded-full">3</span>
                        <p class="text-sm font-medium text-purple-800 dark:text-purple-200">Configure Proxy Routes</p>
                      </div>
                      <p class="text-sm text-purple-700 dark:text-purple-300 ml-8">
                        Once DNS and certificates are set up, you can create proxy routes with SSL/TLS enabled 
                        for secure connections.
                      </p>
                    </div>
                  </div>
                  
                  <div class="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                    <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">⚠️ Important</p>
                    <p class="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                      Without DNS provider configuration, you can only create HTTP routes (no SSL/TLS). 
                      Complete the DNS setup first for full HTTPS support.
                    </p>
                  </div>
                </div>
              ))}
              class="text-sm font-medium text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 mt-2 underline"
            >
              Learn more about the setup process →
            </button>
          </div>
        </div>
      </div>

      {/* Nginx Status */}
      {config && (
        <div class="glassmorphism-card border border-gray-200 dark:border-white/10 rounded-xl p-6">
          <div class="flex items-center justify-between mb-6">
            <div class="flex items-center gap-3">
              <Server class="w-6 h-6 text-green-400" />
              <div>
                <h4 class="text-lg font-medium text-gray-900 dark:text-white">Nginx Status</h4>
                <div class="flex items-center gap-2 mt-1">
                  <div class={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-gradient-to-r border ${getStatusColor(config.status)}`}>
                    {getStatusIcon(config.status)}
                    {config.status.charAt(0).toUpperCase() + config.status.slice(1)}
                  </div>
                  <span class="text-sm text-gray-500 dark:text-gray-400">v{config.version}</span>
                </div>
              </div>
            </div>
            
            <div class="flex items-center gap-2">
              <button
                onClick={reloadNginx}
                disabled={reloading}
                class="btn btn-secondary flex items-center gap-2"
              >
                <RefreshCw class={`w-4 h-4 ${reloading ? 'animate-spin' : ''}`} />
                {reloading ? 'Reloading...' : 'Reload'}
              </button>
              <button
                onClick={toggleNginx}
                class={`btn flex items-center gap-2 ${
                  config.status === 'running' 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'btn-primary'
                }`}
              >
                <Power class="w-4 h-4" />
                {config.status === 'running' ? 'Stop' : 'Start'}
              </button>
            </div>
          </div>

          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div class="bg-gray-50 dark:bg-white/5 rounded-lg p-4">
              <div class="text-2xl font-bold text-gray-900 dark:text-white mb-1">{config.uptime}</div>
              <div class="text-sm text-gray-500 dark:text-gray-400">Uptime</div>
            </div>
            <div class="bg-gray-50 dark:bg-white/5 rounded-lg p-4">
              <div class="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-1">{config.total_routes}</div>
              <div class="text-sm text-gray-500 dark:text-gray-400">Total Routes</div>
            </div>
            <div class="bg-gray-50 dark:bg-white/5 rounded-lg p-4">
              <div class="text-2xl font-bold text-green-600 dark:text-green-400 mb-1">{config.ssl_routes}</div>
              <div class="text-sm text-gray-500 dark:text-gray-400">SSL Routes</div>
            </div>
            <div class="bg-gray-50 dark:bg-white/5 rounded-lg p-4">
              <div class="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                {new Date(config.last_reload).toLocaleTimeString()}
              </div>
              <div class="text-sm text-gray-500 dark:text-gray-400">Last Reload</div>
            </div>
          </div>
        </div>
      )}

      {/* Routes Section */}
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="text-lg font-medium text-gray-900 dark:text-white">Proxy Routes</h4>
          <button
            onClick={() => setShowRouteForm(true)}
            class="btn btn-primary flex items-center gap-2"
            disabled={!config?.enabled}
          >
            <Plus class="w-4 h-4" />
            Add Route
          </button>
        </div>

        {showRouteForm && (
          <div class="glassmorphism-card border border-gray-200 dark:border-white/10 rounded-xl p-6">
            <div class="flex items-center justify-between mb-4">
              <h5 class="text-lg font-medium text-gray-900 dark:text-white">Add Proxy Route</h5>
              <button
                onClick={() => setShowRouteForm(false)}
                class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors"
              >
                <AlertTriangle class="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleRouteSubmit} class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div class="flex items-center gap-2 mb-2">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Domain
                    </label>
                    <button
                      type="button"
                      onClick={() => showModal('Proxy Domain', (
                        <div class="space-y-3">
                          <p>Enter the domain name that will be used to access your service through the proxy.</p>
                          <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                            <p class="text-sm font-medium text-blue-800 dark:text-blue-200">Examples:</p>
                            <ul class="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1">
                              <li>• <code>api.example.com</code> - for API services</li>
                              <li>• <code>app.example.com</code> - for web applications</li>
                              <li>• <code>admin.example.com</code> - for admin panels</li>
                            </ul>
                          </div>
                          <div class="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                            <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">Requirements:</p>
                            <ul class="text-sm text-yellow-700 dark:text-yellow-300 mt-1 space-y-1">
                              <li>• Domain must point to your server's IP address</li>
                              <li>• For SSL, domain must be managed by your DNS provider</li>
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
                    value={routeFormData.domain}
                    onChange={(e) => setRouteFormData(prev => ({ ...prev, domain: (e.target as HTMLInputElement).value }))}
                    class="input bg-white/80 dark:bg-white/10 border-gray-300 dark:border-white/20 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="app.example.com"
                    required
                  />
                </div>
                
                <div>
                  <div class="flex items-center gap-2 mb-2">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Target URL
                    </label>
                    <button
                      type="button"
                      onClick={() => showModal('Target URL', (
                        <div class="space-y-3">
                          <p>Enter the internal URL where your service is running. This is where Nginx will forward incoming requests.</p>
                          <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                            <p class="text-sm font-medium text-blue-800 dark:text-blue-200">Examples:</p>
                            <ul class="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1">
                              <li>• <code>http://localhost:3000</code> - local service on port 3000</li>
                              <li>• <code>http://192.168.1.100:8080</code> - service on another server</li>
                              <li>• <code>http://container-name:5000</code> - Docker container</li>
                            </ul>
                          </div>
                          <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                            <p class="text-sm font-medium text-green-800 dark:text-green-200">Tips:</p>
                            <ul class="text-sm text-green-700 dark:text-green-300 mt-1 space-y-1">
                              <li>• Use HTTP for the target URL (SSL is handled by Nginx)</li>
                              <li>• Ensure the target service is accessible from the proxy server</li>
                              <li>• Test connectivity before adding the route</li>
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
                    type="url"
                    value={routeFormData.target}
                    onChange={(e) => setRouteFormData(prev => ({ ...prev, target: (e.target as HTMLInputElement).value }))}
                    class="input bg-white/80 dark:bg-white/10 border-gray-300 dark:border-white/20 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="http://localhost:3000"
                    required
                  />
                </div>
              </div>
              
              <div class="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="ssl_enabled"
                  checked={routeFormData.ssl_enabled}
                  onChange={(e) => setRouteFormData(prev => ({ ...prev, ssl_enabled: (e.target as HTMLInputElement).checked }))}
                  class="w-4 h-4 text-blue-600 bg-gray-100 dark:bg-white/10 border-gray-300 dark:border-white/20 rounded focus:ring-blue-500"
                />
                <div class="flex items-center gap-2">
                  <label for="ssl_enabled" class="text-sm text-gray-700 dark:text-gray-200">
                    Enable SSL/TLS (requires valid certificate)
                  </label>
                  <button
                    type="button"
                    onClick={() => showModal('SSL/TLS Configuration', (
                      <div class="space-y-3">
                        <p>Enable SSL/TLS to secure connections to your service with HTTPS.</p>
                        <div class="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
                          <p class="text-sm font-medium text-green-800 dark:text-green-200">Benefits of SSL/TLS:</p>
                          <ul class="text-sm text-green-700 dark:text-green-300 mt-1 space-y-1">
                            <li>• Encrypts data in transit</li>
                            <li>• Improves SEO rankings</li>
                            <li>• Required for modern web apps</li>
                            <li>• Builds user trust</li>
                          </ul>
                        </div>
                        <div class="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                          <p class="text-sm font-medium text-amber-800 dark:text-amber-200">Requirements:</p>
                          <ul class="text-sm text-amber-700 dark:text-amber-300 mt-1 space-y-1">
                            <li>• DNS provider must be configured</li>
                            <li>• Domain must be added and verified in DNS & Certificates</li>
                            <li>• Valid SSL certificate will be automatically provisioned</li>
                          </ul>
                        </div>
                        <p class="text-sm text-gray-600 dark:text-gray-400">
                          Certificates are automatically renewed before expiration, so you don't need to worry about manual renewal.
                        </p>
                      </div>
                    ))}
                    class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    <Info class="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              <div class="flex gap-3 pt-4">
                <button type="submit" class="btn btn-primary">
                  Add Route
                </button>
                <button
                  type="button"
                  onClick={() => setShowRouteForm(false)}
                  class="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div class="space-y-3">
          {routes.length === 0 ? (
            <div class="text-center py-8">
              <Server class="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h5 class="text-base font-medium text-gray-900 dark:text-white mb-1">No Proxy Routes</h5>
              <p class="text-gray-600 dark:text-gray-400 text-sm">Add your first proxy route to get started</p>
            </div>
          ) : (
            routes.map((route) => (
              <div key={route.id} class="glassmorphism-card border border-gray-200 dark:border-white/10 rounded-xl p-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <div class={`p-2 rounded-lg ${route.ssl_enabled ? 'bg-green-100 dark:bg-green-500/20' : 'bg-gray-100 dark:bg-gray-500/20'}`}>
                      {route.ssl_enabled ? (
                        <Shield class="w-5 h-5 text-green-600 dark:text-green-400" />
                      ) : (
                        <Globe class="w-5 h-5 text-gray-600 dark:text-gray-400" />
                      )}
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <h5 class="font-medium text-gray-900 dark:text-white">{route.domain}</h5>
                        <div class={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-full bg-gradient-to-r border ${getStatusColor(route.status)}`}>
                          {getStatusIcon(route.status)}
                          {route.status.charAt(0).toUpperCase() + route.status.slice(1)}
                        </div>
                      </div>
                      <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <span>→ {route.target}</span>
                        <span>{route.response_time}ms</span>
                        {route.ssl_enabled && (
                          <span class="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                            <Shield class="w-3 h-3" />
                            SSL
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div class="flex items-center gap-2">
                    <button class="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg transition-all">
                      <Settings class="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteRoute(route.id)}
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

      {/* Configuration Info */}
      <div class="glassmorphism-card border border-gray-200 dark:border-white/10 rounded-xl p-4">
        <h5 class="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Configuration Notes</h5>
        <div class="space-y-2 text-xs text-gray-600 dark:text-gray-400">
          <div class="flex items-start gap-2">
            <AlertTriangle class="w-3 h-3 text-yellow-500 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <span>SSL certificates are automatically managed through DNS integration</span>
          </div>
          <div class="flex items-start gap-2">
            <AlertTriangle class="w-3 h-3 text-yellow-500 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <span>Route changes require Nginx reload to take effect</span>
          </div>
          <div class="flex items-start gap-2">
            <AlertTriangle class="w-3 h-3 text-yellow-500 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
            <span>Ensure target services are running before adding routes</span>
          </div>
        </div>
      </div>

    </div>
  )
}