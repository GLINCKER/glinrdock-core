import { useState, useEffect } from 'preact/hooks'
import { Globe, Plus, Trash2, Settings, Shield, AlertCircle, CheckCircle, Clock, XCircle, Eye, EyeOff, Info } from 'lucide-preact'
import { apiClient } from '../../api'
import { useModal } from '../ModalProvider'

interface DNSProvider {
  id: number
  name: string
  type: 'cloudflare' | 'route53' | 'digitalocean'
  status: 'active' | 'inactive' | 'error'
  domains_count: number
  last_verified: string
}

interface Domain {
  id: number
  domain: string
  provider_id: number
  verification_status: 'verified' | 'pending' | 'failed'
  has_certificate: boolean
  certificate_expires: string | null
  last_checked: string
}

export function DNSCertificatesTab() {
  const { showModal } = useModal()
  const [providers, setProviders] = useState<DNSProvider[]>([])
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [showProviderForm, setShowProviderForm] = useState(false)
  const [showDomainForm, setShowDomainForm] = useState(false)
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null)
  const [showApiKey, setShowApiKey] = useState(false)
  
  const [providerFormData, setProviderFormData] = useState({
    name: '',
    type: 'cloudflare' as const,
    api_key: '',
    email: ''
  })
  
  const [domainFormData, setDomainFormData] = useState({
    domain: '',
    provider_id: ''
  })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load certificates from API
      const certificates = await apiClient.listCertificates()
      
      // Convert certificates to domains format
      const domainsFromCerts: Domain[] = certificates.map((cert, index) => ({
        id: cert.id,
        domain: cert.domain,
        provider_id: 1, // Default since DNS providers API not implemented yet
        verification_status: cert.has_cert ? 'verified' : 'pending',
        has_certificate: cert.has_cert,
        certificate_expires: cert.expiry_date,
        last_checked: new Date().toISOString()
      }))
      
      // For now, show empty providers until DNS provider API is implemented
      // This is a placeholder for when DNS provider management is added
      setProviders([])
      
      setDomains(domainsFromCerts)
      setLoading(false)
    } catch (error) {
      console.error('Failed to load DNS data:', error)
      setLoading(false)
      // Fallback to empty state if API fails
      setProviders([])
      setDomains([])
    }
  }

  const handleProviderSubmit = async (e: Event) => {
    e.preventDefault()
    try {
      console.log('Adding DNS provider:', providerFormData)
      setShowProviderForm(false)
      setProviderFormData({ name: '', type: 'cloudflare', api_key: '', email: '' })
      loadData()
    } catch (error) {
      console.error('Failed to add provider:', error)
    }
  }

  const handleDomainSubmit = async (e: Event) => {
    e.preventDefault()
    try {
      console.log('Adding domain:', domainFormData)
      setShowDomainForm(false)
      setDomainFormData({ domain: '', provider_id: '' })
      loadData()
    } catch (error) {
      console.error('Failed to add domain:', error)
    }
  }

  const verifyDomain = async (domainId: number) => {
    try {
      console.log('Verifying domain:', domainId)
      // Verification logic here
    } catch (error) {
      console.error('Failed to verify domain:', error)
    }
  }

  const renewCertificate = async (domainId: number) => {
    try {
      console.log('Renewing certificate for domain:', domainId)
      // Renewal logic here
    } catch (error) {
      console.error('Failed to renew certificate:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
      case 'verified': return <CheckCircle class="w-4 h-4 text-green-400" />
      case 'pending': return <Clock class="w-4 h-4 text-yellow-400" />
      case 'error':
      case 'failed': return <XCircle class="w-4 h-4 text-red-400" />
      default: return <AlertCircle class="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
      case 'verified': return 'from-green-500/20 to-emerald-500/20 border-green-500/30 text-green-400'
      case 'pending': return 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30 text-yellow-400'
      case 'error':
      case 'failed': return 'from-red-500/20 to-pink-500/20 border-red-500/30 text-red-400'
      default: return 'from-gray-500/20 to-slate-500/20 border-gray-500/30 text-gray-400'
    }
  }

  if (loading) {
    return (
      <div class="animate-pulse space-y-6">
        <div class="h-8 bg-gray-200 dark:bg-white/10 rounded-lg w-1/3"></div>
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div class="space-y-3">
            <div class="h-6 bg-gray-200 dark:bg-white/10 rounded w-1/2"></div>
            <div class="p-4 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
              <div class="h-5 bg-gray-200 dark:bg-white/10 rounded w-3/4 mb-2"></div>
              <div class="h-4 bg-gray-200 dark:bg-white/10 rounded w-1/2"></div>
            </div>
          </div>
          <div class="space-y-3">
            <div class="h-6 bg-gray-200 dark:bg-white/10 rounded w-1/2"></div>
            <div class="p-4 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10">
              <div class="h-5 bg-gray-200 dark:bg-white/10 rounded w-3/4 mb-2"></div>
              <div class="h-4 bg-gray-200 dark:bg-white/10 rounded w-1/2"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div class="space-y-8">
      <div>
        <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">DNS & TLS Certificates</h3>
        <p class="text-gray-600 dark:text-gray-300 text-sm">Manage DNS providers and automate SSL certificate provisioning</p>
      </div>

      {/* DNS Providers Section */}
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="text-lg font-medium text-gray-900 dark:text-white">DNS Providers</h4>
          <button
            onClick={() => setShowProviderForm(true)}
            class="btn btn-primary flex items-center gap-2"
          >
            <Plus class="w-4 h-4" />
            Add Provider
          </button>
        </div>

        {showProviderForm && (
          <div class="glassmorphism-card border border-gray-200 dark:border-white/10 rounded-xl p-6">
            <div class="flex items-center justify-between mb-4">
              <h5 class="text-lg font-medium text-gray-900 dark:text-white">Add DNS Provider</h5>
              <button
                onClick={() => setShowProviderForm(false)}
                class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors"
              >
                <XCircle class="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleProviderSubmit} class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div class="flex items-center gap-2 mb-2">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Provider Name
                    </label>
                    <button
                      type="button"
                      onClick={() => showModal('Provider Name', (
                        <div class="space-y-3">
                          <p>Give your DNS provider a descriptive name to identify it easily.</p>
                          <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                            <p class="text-sm font-medium text-blue-800 dark:text-blue-200">Examples:</p>
                            <ul class="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1">
                              <li>• "Cloudflare Main"</li>
                              <li>• "AWS Production"</li>
                              <li>• "DigitalOcean Dev"</li>
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
                    value={providerFormData.name}
                    onChange={(e) => setProviderFormData(prev => ({ ...prev, name: (e.target as HTMLInputElement).value }))}
                    class="input bg-white/80 dark:bg-white/10 border-gray-300 dark:border-white/20 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="e.g., Cloudflare Main"
                    required
                  />
                </div>
                
                <div>
                  <div class="flex items-center gap-2 mb-2">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Provider Type
                    </label>
                    <button
                      type="button"
                      onClick={() => showModal('DNS Provider Type', (
                        <div class="space-y-3">
                          <p>Select your DNS provider. Each provider has different capabilities and requirements.</p>
                          <div class="space-y-3">
                            <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                              <p class="text-sm font-medium text-blue-800 dark:text-blue-200">Cloudflare</p>
                              <p class="text-sm text-blue-700 dark:text-blue-300 mt-1">Fast global DNS with excellent security features. Requires API token and email.</p>
                            </div>
                            <div class="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-lg">
                              <p class="text-sm font-medium text-orange-800 dark:text-orange-200">AWS Route 53</p>
                              <p class="text-sm text-orange-700 dark:text-orange-300 mt-1">Amazon's DNS service with AWS integration. Requires AWS Access Key ID and Secret.</p>
                            </div>
                            <div class="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-lg">
                              <p class="text-sm font-medium text-purple-800 dark:text-purple-200">DigitalOcean</p>
                              <p class="text-sm text-purple-700 dark:text-purple-300 mt-1">Simple and reliable DNS service. Requires API token.</p>
                            </div>
                          </div>
                        </div>
                      ))}
                      class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                      <Info class="w-4 h-4" />
                    </button>
                  </div>
                  <select
                    value={providerFormData.type}
                    onChange={(e) => setProviderFormData(prev => ({ ...prev, type: (e.target as HTMLSelectElement).value as any }))}
                    class="input bg-white/80 dark:bg-white/10 border-gray-300 dark:border-white/20 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="cloudflare">Cloudflare</option>
                    <option value="route53">AWS Route 53</option>
                    <option value="digitalocean">DigitalOcean</option>
                  </select>
                </div>
              </div>
              
              <div>
                <div class="flex items-center gap-2 mb-2">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">
                    API Key
                  </label>
                  <button
                    type="button"
                    onClick={() => showModal('API Key', (
                      <div class="space-y-4">
                        <p>API credentials are required to manage DNS records automatically.</p>
                        
                        <div class="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                          <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">Where to find your API key:</p>
                          <div class="space-y-2 text-sm text-yellow-700 dark:text-yellow-300">
                            <div>
                              <strong>Cloudflare:</strong> My Profile → API Tokens → Global API Key
                            </div>
                            <div>
                              <strong>AWS Route 53:</strong> IAM → Users → Security credentials → Access keys
                            </div>
                            <div>
                              <strong>DigitalOcean:</strong> API → Tokens/Keys → Generate New Token
                            </div>
                          </div>
                        </div>
                        
                        <div class="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                          <p class="text-sm font-medium text-red-800 dark:text-red-200">⚠️ Security Notice</p>
                          <p class="text-sm text-red-700 dark:text-red-300 mt-1">API keys provide full access to your DNS. Store them securely and never share them.</p>
                        </div>
                      </div>
                    ))}
                    class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                  >
                    <Info class="w-4 h-4" />
                  </button>
                </div>
                <div class="relative">
                  <input
                    type={showApiKey ? "text" : "password"}
                    value={providerFormData.api_key}
                    onChange={(e) => setProviderFormData(prev => ({ ...prev, api_key: (e.target as HTMLInputElement).value }))}
                    class="input bg-white/80 dark:bg-white/10 border-gray-300 dark:border-white/20 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 pr-10"
                    placeholder="Enter your API key"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-white"
                  >
                    {showApiKey ? <EyeOff class="w-4 h-4" /> : <Eye class="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              {providerFormData.type === 'cloudflare' && (
                <div>
                  <div class="flex items-center gap-2 mb-2">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Email Address
                    </label>
                    <button
                      type="button"
                      onClick={() => showModal('Cloudflare Email', (
                        <div class="space-y-3">
                          <p>Enter the email address associated with your Cloudflare account.</p>
                          <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                            <p class="text-sm font-medium text-blue-800 dark:text-blue-200">Important:</p>
                            <p class="text-sm text-blue-700 dark:text-blue-300 mt-1">This must be the same email you use to log in to your Cloudflare dashboard. It's used together with your Global API Key for authentication.</p>
                          </div>
                        </div>
                      ))}
                      class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                      <Info class="w-4 h-4" />
                    </button>
                  </div>
                  <input
                    type="email"
                    value={providerFormData.email}
                    onChange={(e) => setProviderFormData(prev => ({ ...prev, email: (e.target as HTMLInputElement).value }))}
                    class="input bg-white/80 dark:bg-white/10 border-gray-300 dark:border-white/20 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="your@email.com"
                    required
                  />
                </div>
              )}
              
              <div class="flex gap-3 pt-4">
                <button type="submit" class="btn btn-primary">
                  Add Provider
                </button>
                <button
                  type="button"
                  onClick={() => setShowProviderForm(false)}
                  class="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {providers.length === 0 ? (
            <div class="col-span-full text-center py-8">
              <Globe class="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h5 class="text-base font-medium text-gray-900 dark:text-white mb-1">No DNS Providers</h5>
              <p class="text-gray-600 dark:text-gray-400 text-sm">Add a DNS provider to get started</p>
            </div>
          ) : (
            providers.map((provider) => (
              <div key={provider.id} class="glassmorphism-card border border-gray-200 dark:border-white/10 rounded-xl p-4">
                <div class="flex items-start justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <Globe class="w-5 h-5 text-blue-400" />
                    <h5 class="font-medium text-gray-900 dark:text-white">{provider.name}</h5>
                  </div>
                  <div class={`inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-full bg-gradient-to-r border ${getStatusColor(provider.status)}`}>
                    {getStatusIcon(provider.status)}
                    {provider.status.charAt(0).toUpperCase() + provider.status.slice(1)}
                  </div>
                </div>
                
                <div class="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                  <div class="flex items-center justify-between">
                    <span>Type:</span>
                    <span class="capitalize">{provider.type}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span>Domains:</span>
                    <span>{provider.domains_count}</span>
                  </div>
                </div>
                
                <div class="flex items-center gap-2 mt-4">
                  <button class="p-1.5 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 rounded transition-all">
                    <Settings class="w-3.5 h-3.5" />
                  </button>
                  <button class="p-1.5 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-all">
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Domains Section */}
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h4 class="text-lg font-medium text-gray-900 dark:text-white">Managed Domains</h4>
          <button
            onClick={() => setShowDomainForm(true)}
            class="btn btn-primary flex items-center gap-2"
            disabled={providers.length === 0}
          >
            <Plus class="w-4 h-4" />
            Add Domain
          </button>
        </div>

        {showDomainForm && (
          <div class="glassmorphism-card border border-gray-200 dark:border-white/10 rounded-xl p-6">
            <div class="flex items-center justify-between mb-4">
              <h5 class="text-lg font-medium text-gray-900 dark:text-white">Add Domain</h5>
              <button
                onClick={() => setShowDomainForm(false)}
                class="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white transition-colors"
              >
                <XCircle class="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleDomainSubmit} class="space-y-4">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div class="flex items-center gap-2 mb-2">
                    <label class="block text-sm font-medium text-gray-700 dark:text-gray-200">
                      Domain Name
                    </label>
                    <button
                      type="button"
                      onClick={() => showModal('Domain Name', (
                        <div class="space-y-3">
                          <p>Enter the domain name you want to manage SSL certificates for.</p>
                          <div class="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                            <p class="text-sm font-medium text-blue-800 dark:text-blue-200">Examples:</p>
                            <ul class="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1">
                              <li>• <code>example.com</code> (root domain)</li>
                              <li>• <code>api.example.com</code> (subdomain)</li>
                              <li>• <code>*.example.com</code> (wildcard - covers all subdomains)</li>
                            </ul>
                          </div>
                          <div class="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                            <p class="text-sm font-medium text-yellow-800 dark:text-yellow-200">Requirements:</p>
                            <ul class="text-sm text-yellow-700 dark:text-yellow-300 mt-1 space-y-1">
                              <li>• Domain must use the selected DNS provider's nameservers</li>
                              <li>• You must have DNS management permissions</li>
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
                    value={domainFormData.domain}
                    onChange={(e) => setDomainFormData(prev => ({ ...prev, domain: (e.target as HTMLInputElement).value }))}
                    class="input bg-white/80 dark:bg-white/10 border-gray-300 dark:border-white/20 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="example.com"
                    required
                  />
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                    DNS Provider
                  </label>
                  <select
                    value={domainFormData.provider_id}
                    onChange={(e) => setDomainFormData(prev => ({ ...prev, provider_id: (e.target as HTMLSelectElement).value }))}
                    class="input bg-white/80 dark:bg-white/10 border-gray-300 dark:border-white/20 text-gray-900 dark:text-white"
                    required
                  >
                    <option value="">Select Provider</option>
                    {providers.map(provider => (
                      <option key={provider.id} value={provider.id.toString()}>
                        {provider.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              <div class="flex gap-3 pt-4">
                <button type="submit" class="btn btn-primary">
                  Add Domain
                </button>
                <button
                  type="button"
                  onClick={() => setShowDomainForm(false)}
                  class="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div class="space-y-3">
          {domains.length === 0 ? (
            <div class="text-center py-8">
              <Shield class="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <h5 class="text-base font-medium text-gray-900 dark:text-white mb-1">No Domains</h5>
              <p class="text-gray-600 dark:text-gray-400 text-sm">Add a domain to manage certificates</p>
            </div>
          ) : (
            domains.map((domain) => (
              <div key={domain.id} class="glassmorphism-card border border-gray-200 dark:border-white/10 rounded-xl p-4">
                <div class="flex items-center justify-between">
                  <div class="flex items-center gap-3">
                    <Globe class="w-5 h-5 text-blue-400" />
                    <div>
                      <h5 class="font-medium text-gray-900 dark:text-white">{domain.domain}</h5>
                      <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mt-1">
                        <div class={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs rounded-full bg-gradient-to-r border ${getStatusColor(domain.verification_status)}`}>
                          {getStatusIcon(domain.verification_status)}
                          {domain.verification_status === 'verified' ? 'Verified' : domain.verification_status.charAt(0).toUpperCase() + domain.verification_status.slice(1)}
                        </div>
                        {domain.has_certificate ? (
                          <div class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/30 text-green-400">
                            <Shield class="w-2.5 h-2.5" />
                            SSL Active
                          </div>
                        ) : (
                          <div class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-gradient-to-r from-gray-500/20 to-slate-500/20 border border-gray-500/30 text-gray-400">
                            <Shield class="w-2.5 h-2.5" />
                            No SSL
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div class="flex items-center gap-2">
                    {domain.verification_status !== 'verified' && (
                      <button
                        onClick={() => verifyDomain(domain.id)}
                        class="btn btn-sm bg-blue-600 hover:bg-blue-700 text-white"
                      >
                        Verify
                      </button>
                    )}
                    {domain.has_certificate && (
                      <button
                        onClick={() => renewCertificate(domain.id)}
                        class="btn btn-sm bg-green-600 hover:bg-green-700 text-white"
                      >
                        Renew SSL
                      </button>
                    )}
                    <button class="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded transition-all">
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

    </div>
  )
}