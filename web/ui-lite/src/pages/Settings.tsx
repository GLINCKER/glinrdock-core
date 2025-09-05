import { useState, useEffect } from 'preact/hooks'
import { apiClient, useApiData } from '../api'
import { Toast } from '../components/ui'
import { 
  Settings as SettingsIcon, 
  Server, 
  Shield, 
  Database, 
  Key,
  Home,
  Lock,
  UserCheck,
  CreditCard,
  ScrollText,
  Plug,
  Monitor,
  Crown
} from 'lucide-preact'
import { isAdminSync } from '../rbac'
import { Link } from 'wouter'
import { Breadcrumb } from '../components/Breadcrumb'
import { usePageTitle } from '../hooks/usePageTitle'

export function Settings() {
  usePageTitle("Settings");

  const [toastConfig, setToastConfig] = useState({ show: false, message: '', type: 'info' as 'info' | 'success' | 'error' })
  const [showTokenModal, setShowTokenModal] = useState(false)
  const [showLockdownModal, setShowLockdownModal] = useState(false)
  const [showEmergencyModal, setShowEmergencyModal] = useState(false)
  const [showLicenseModal, setShowLicenseModal] = useState(false)
  const [licenseText, setLicenseText] = useState('')
  const [activatingLicense, setActivatingLicense] = useState(false)
  const [deactivatingLicense, setDeactivatingLicense] = useState(false)
  const [isLockdownActive, setIsLockdownActive] = useState(false)
  const [showBackupModal, setShowBackupModal] = useState(false)
  const [showRestoreModal, setShowRestoreModal] = useState(false)
  const [creatingBackup, setCreatingBackup] = useState(false)
  const [restoreFile, setRestoreFile] = useState<File | null>(null)
  const [restoringBackup, setRestoringBackup] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const { data: systemInfo } = useApiData(() => apiClient.getSystemInfo())
  const { data: systemStatus, refetch: refetchSystemStatus } = useApiData(() => apiClient.getSystemStatus())
  const { data: licenseStatus, refetch: refetchLicenseStatus } = useApiData(() => apiClient.getLicense())

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToastConfig({ show: true, message, type })
  }

  // Format time_ago string to clean format
  const formatTimeAgo = (timeAgo: string) => {
    if (!timeAgo) return 'Unknown'
    
    // Handle formats like "4m32.567018875s" or "1h2m3s" 
    const match = timeAgo.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?/)
    if (!match) return timeAgo
    
    const [, hours, minutes, seconds] = match
    const parts = []
    
    if (hours && parseInt(hours) > 0) parts.push(`${hours}h`)
    if (minutes && parseInt(minutes) > 0) parts.push(`${minutes}m`) 
    // Only show seconds if less than 1 minute total
    if (seconds && !hours && !minutes) {
      parts.push(`${Math.floor(parseFloat(seconds))}s`)
    }
    
    return parts.join(' ') || '0s'
  }

  // Check if restart info should be hidden (after 1 hour for Settings page)
  const shouldShowRestartInfo = () => {
    if (!systemStatus?.last_restart?.timestamp) return false
    
    const restartTime = new Date(systemStatus.last_restart.timestamp)
    const now = new Date()
    const diffMinutes = (now.getTime() - restartTime.getTime()) / (1000 * 60)
    
    // Hide after 1 hour in Settings page
    return diffMinutes < 60
  }

  const handleSignOut = () => {
    apiClient.clearToken()
    window.location.reload()
  }

  const handleEmergencyRestart = async () => {
    try {
      await apiClient.emergencyRestart()
      showToast(`Emergency restart initiated at ${new Date().toLocaleTimeString()} - system restarting now!`, 'success')
      setShowEmergencyModal(false)
      
      // Refresh system status after a brief delay to show the restart time
      setTimeout(() => {
        refetchSystemStatus()
      }, 2000)
      
    } catch (error: any) {
      showToast(error.message || 'Failed to initiate emergency restart', 'error')
    }
  }

  const handleLicenseActivate = async () => {
    if (!licenseText.trim()) {
      showToast('Please enter a license', 'error')
      return
    }

    setActivatingLicense(true)
    try {
      await apiClient.activateLicense(licenseText.trim())
      showToast('License activated successfully', 'success')
      setShowLicenseModal(false)
      setLicenseText('')
      refetchLicenseStatus()
    } catch (error: any) {
      showToast(error.message || 'Failed to activate license', 'error')
    } finally {
      setActivatingLicense(false)
    }
  }

  const handleLicenseDeactivate = async () => {
    setDeactivatingLicense(true)
    try {
      await apiClient.deactivateLicense()
      showToast('License deactivated successfully', 'success')
      refetchLicenseStatus()
    } catch (error: any) {
      showToast(error.message || 'Failed to deactivate license', 'error')
    } finally {
      setDeactivatingLicense(false)
    }
  }

  const handleLicenseFileUpload = (event: Event) => {
    const target = event.target as HTMLInputElement
    const file = target.files?.[0]
    if (!file) return

    if (file.size > 64 * 1024) {
      showToast('License file too large (max 64KB)', 'error')
      return
    }

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setLicenseText(content)
    }
    reader.onerror = () => {
      showToast('Failed to read license file', 'error')
    }
    reader.readAsText(file)
  }

  const handleCreateBackup = async () => {
    setCreatingBackup(true)
    try {
      const blob = await apiClient.createBackup()
      
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = url
      a.download = `glinrdock-backup-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.tar.gz`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      
      showToast('Backup created and downloaded successfully', 'success')
      setShowBackupModal(false)
    } catch (error: any) {
      showToast(error.message || 'Failed to create backup', 'error')
    } finally {
      setCreatingBackup(false)
    }
  }

  const validateRestoreFile = (file: File): boolean => {
    // Check file type - should be .tar.gz or .tgz
    if (!file.name.toLowerCase().match(/\.(tar\.gz|tgz)$/)) {
      showToast('Please select a valid backup file (.tar.gz or .tgz)', 'error')
      return false
    }

    // Check file size - max 500MB for backups
    const maxSize = 500 * 1024 * 1024 // 500MB
    if (file.size > maxSize) {
      showToast(`Backup file too large (max ${maxSize / (1024 * 1024)}MB)`, 'error')
      return false
    }

    // Check minimum file size (at least 1KB for a valid tar.gz archive)
    if (file.size < 1024) {
      showToast('Backup file appears to be invalid (too small). Minimum size: 1KB', 'error')
      return false
    }

    return true
  }

  const handleSystemLockdown = async () => {
    try {
      await apiClient.systemLockdown('Manual lockdown initiated from Settings page')
      
      // Set lockdown state globally
      const lockdownData = {
        isLocked: true,
        timestamp: new Date().toISOString(),
        reason: 'Manual lockdown initiated from Settings page'
      }
      
      setIsLockdownActive(true)
      
      // Dispatch global lockdown event
      window.dispatchEvent(new CustomEvent('lockdown-status-changed', {
        detail: lockdownData
      }))
      
      showToast('System locked down - only admin access permitted', 'success')
      setShowLockdownModal(false)
    } catch (error: any) {
      showToast(error.message || 'Failed to initiate system lockdown', 'error')
    }
  }

  const handleLiftLockdown = async () => {
    try {
      await apiClient.liftLockdown()
      setIsLockdownActive(false)
      
      // Dispatch global lockdown lift event
      window.dispatchEvent(new CustomEvent('lockdown-status-changed', {
        detail: { isLocked: false }
      }))
      
      showToast('System lockdown has been lifted', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to lift system lockdown', 'error')
    }
  }

  // Check lockdown status on component mount
  useEffect(() => {
    const checkLockdownStatus = async () => {
      try {
        const status = await apiClient.getLockdownStatus()
        setIsLockdownActive(status.is_locked)
      } catch (error) {
        console.error('Failed to check lockdown status:', error)
        setIsLockdownActive(false)
      }
    }

    checkLockdownStatus()

    // Listen for lockdown events
    const handleLockdownEvent = (event: CustomEvent) => {
      setIsLockdownActive(event.detail.isLocked)
    }

    window.addEventListener('lockdown-status-changed', handleLockdownEvent as EventListener)
    
    return () => {
      window.removeEventListener('lockdown-status-changed', handleLockdownEvent as EventListener)
    }
  }, [])

  return (
    <div class="min-h-screen">
      <div class="relative z-10 p-3 sm:p-6 max-w-7xl mx-auto space-y-6 fade-in">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "Home", href: "/", icon: Home },
            { label: "Settings", active: true, icon: SettingsIcon },
          ]}
          className="text-gray-600 dark:text-gray-300"
        />

        {/* Header */}
        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-3xl font-bold mb-3">
              <span class="bg-gradient-to-r from-[#9c40ff] via-[#e94057] to-[#8b008b] bg-clip-text text-transparent">
                Settings
              </span>
            </h1>
            <p class="text-gray-700 dark:text-gray-300 text-base">
              Configure system settings, security, and platform features
            </p>
          </div>
        </div>

        {/* Settings Cards */}
        <div class="space-y-8">
          {/* Authentication & Security Section */}
          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/30 dark:to-indigo-900/30 rounded-xl">
                <Shield class="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Authentication & Security</h2>
                <p class="text-sm text-gray-600 dark:text-gray-400">Manage authentication, tokens, and certificates</p>
              </div>
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Link href="/settings/certificates" class="p-6 bg-white dark:glassmorphism border border-gray-200 dark:border-white/10 rounded-2xl shadow-lg dark:shadow-xl hover:shadow-xl dark:hover:shadow-2xl transition-all group">
                <div class="flex items-center justify-between mb-4">
                  <div class="p-3 bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl">
                    <Lock class="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <svg class="w-5 h-5 text-gray-400 group-hover:text-green-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">DNS & Certificates</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Manage DNS providers, SSL certificates, and secure connections for your domains.
                </p>
                <div class="flex items-center text-xs">
                  <span class="text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">Configured</span>
                </div>
              </Link>

              <Link href="/settings/auth" class="p-6 bg-white dark:glassmorphism border border-gray-200 dark:border-white/10 rounded-2xl shadow-lg dark:shadow-xl hover:shadow-xl dark:hover:shadow-2xl transition-all group">
                <div class="flex items-center justify-between mb-4">
                  <div class="p-3 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-xl">
                    <UserCheck class="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <svg class="w-5 h-5 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Authentication</h3>
                <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Configure authentication methods, user access controls, and session management.
                </p>
                <div class="flex items-center text-xs">
                  <span class="text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">Active</span>
                </div>
              </Link>
            </div>
          </div>

          {/* Plan & Licensing Section */}
          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-gradient-to-br from-blue-100 to-cyan-100 dark:from-blue-900/30 dark:to-cyan-900/30 rounded-xl">
                <CreditCard class="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Plan & Licensing</h2>
                <p class="text-sm text-gray-600 dark:text-gray-400">Manage subscription plans and licenses</p>
              </div>
            </div>
            
            <Link href="/settings/plan-limits" class="p-6 bg-white dark:glassmorphism border border-gray-200 dark:border-white/10 rounded-2xl shadow-lg dark:shadow-xl hover:shadow-xl dark:hover:shadow-2xl transition-all group block">
              <div class="flex items-center justify-between mb-4">
                <div class="p-3 bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 rounded-xl">
                  <CreditCard class="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <svg class="w-5 h-5 text-gray-400 group-hover:text-orange-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Plan & Limits</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Current plan status, resource limits, and license management
              </p>
              <div class="flex items-center text-xs">
                <span class="text-orange-600 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded">FREE Plan</span>
              </div>
            </Link>
          </div>

          {/* System Administration Section */}
          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/30 dark:to-orange-900/30 rounded-xl">
                <Shield class="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h2 class="text-xl font-semibold text-gray-900 dark:text-white">System Administration</h2>
                <p class="text-sm text-gray-600 dark:text-gray-400">Emergency controls, monitoring, and backups</p>
              </div>
            </div>
            
            <Link href="/settings/system-admin" class="p-6 bg-white dark:glassmorphism border border-gray-200 dark:border-white/10 rounded-2xl shadow-lg dark:shadow-xl hover:shadow-xl dark:hover:shadow-2xl transition-all group block">
              <div class="flex items-center justify-between mb-4">
                <div class="p-3 bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/30 dark:to-rose-900/30 rounded-xl">
                  <Monitor class="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <svg class="w-5 h-5 text-gray-400 group-hover:text-red-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">System Administration</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Emergency controls, system monitoring, and backup management
              </p>
              <div class="flex items-center text-xs">
                <span class="text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded">System Healthy</span>
              </div>
            </Link>
          </div>

          {/* Integrations Section */}
          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-gradient-to-br from-green-100 to-teal-100 dark:from-green-900/30 dark:to-teal-900/30 rounded-xl">
                <Plug class="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Integrations</h2>
                <p class="text-sm text-gray-600 dark:text-gray-400">External service connections and configurations</p>
              </div>
            </div>
            
            <Link href="/settings/integrations" class="p-6 bg-white dark:glassmorphism border border-gray-200 dark:border-white/10 rounded-2xl shadow-lg dark:shadow-xl hover:shadow-xl dark:hover:shadow-2xl transition-all group block">
              <div class="flex items-center justify-between mb-4">
                <div class="p-3 bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-900/30 dark:to-cyan-900/30 rounded-xl">
                  <Plug class="w-6 h-6 text-teal-600 dark:text-teal-400" />
                </div>
                <svg class="w-5 h-5 text-gray-400 group-hover:text-teal-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">External Integrations</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                GitHub, DNS providers, and Nginx proxy configuration
              </p>
              <div class="grid grid-cols-3 gap-2 text-xs mt-4">
                <span class="text-orange-600 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded text-center">GitHub</span>
                <span class="text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded text-center">DNS</span>
                <span class="text-gray-600 bg-gray-100 dark:bg-gray-800/30 px-2 py-1 rounded text-center">Nginx</span>
              </div>
            </Link>
          </div>

          {/* Environment Templates Section */}
          <div class="space-y-4">
            <div class="flex items-center gap-3">
              <div class="p-2 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-xl">
                <ScrollText class="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Environment Templates</h2>
                <p class="text-sm text-gray-600 dark:text-gray-400">Pre-configured environment variable templates</p>
              </div>
            </div>
            
            <Link href="/settings/environment-templates" class="p-6 bg-white dark:glassmorphism border border-gray-200 dark:border-white/10 rounded-2xl shadow-lg dark:shadow-xl hover:shadow-xl dark:hover:shadow-2xl transition-all group block">
              <div class="flex items-center justify-between mb-4">
                <div class="p-3 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 rounded-xl">
                  <ScrollText class="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <svg class="w-5 h-5 text-gray-400 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Environment Templates</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Manage reusable environment variable templates for deployments
              </p>
              <div class="flex items-center text-xs">
                <span class="text-indigo-600 bg-indigo-100 dark:bg-indigo-900/30 px-2 py-1 rounded">3 Templates</span>
              </div>
            </Link>
          </div>

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