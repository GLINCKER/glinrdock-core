import { useState, useEffect } from 'preact/hooks';
import { Breadcrumb } from "../../components/Breadcrumb";
import { usePageTitle } from "../../hooks/usePageTitle";
import { apiClient as api, type SystemInfo } from "../../api";
import { useServiceManagementModal } from "../../components/ServiceManagementModal";
import { useSearchSettingsModal } from "../../components/SearchSettingsModal";
import { useNotificationModal } from "../../components/NotificationModal";
import { useConfirmationModal } from "../../components/ConfirmationModal";
import { 
  Home, 
  Shield, 
  AlertTriangle, 
  RotateCcw, 
  Server, 
  HardDrive,
  Download,
  Upload,
  RefreshCw,
  Lock,
  Unlock,
  FileArchive,
  Settings as SettingsIcon,
  Clock,
  CheckCircle,
  XCircle,
  Activity,
  Database,
  Search,
  Play,
  Square,
  Cpu
} from "lucide-preact";

interface SystemStatus {
  last_restart: {
    timestamp: string;
    time_ago: string;
  };
}

export function SystemAdmin() {
  usePageTitle("System Administration");
  
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isLockdownActive, setIsLockdownActive] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [restoringBackup, setRestoringBackup] = useState(false);
  const [searchMode, setSearchMode] = useState<'auto' | 'basic' | 'advanced'>('auto');
  const [savingSearchMode, setSavingSearchMode] = useState(false);
  const [serviceStatus, setServiceStatus] = useState<'running' | 'stopped' | 'unknown'>('unknown');
  const { showServiceModal } = useServiceManagementModal();
  const { showSearchSettingsModal } = useSearchSettingsModal();
  const { showNotification } = useNotificationModal();
  const { showConfirmation } = useConfirmationModal();

  const loadData = async () => {
    try {
      setLoading(true);
      const [sysInfo, lockdownStatus] = await Promise.all([
        api.getSystemInfo(),
        api.getLockdownStatus().catch(() => ({ active: false }))
      ]);
      
      setSystemInfo(sysInfo);
      setIsLockdownActive(lockdownStatus.active || false);
      
      // Mock system status for now - replace with real API when available
      setSystemStatus({
        last_restart: {
          timestamp: '2025-01-13T08:00:00Z',
          time_ago: '2h 15m'
        }
      });
      
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Failed to load system information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    checkServiceStatus();
    
    // Load search mode preference
    const savedSearchMode = localStorage.getItem('glinr_search_mode') as 'auto' | 'basic' | 'advanced' | null;
    if (savedSearchMode) {
      setSearchMode(savedSearchMode);
    }
    
    // Check service status periodically
    const statusInterval = setInterval(checkServiceStatus, 30000); // Every 30 seconds
    
    return () => clearInterval(statusInterval);
  }, []);

  const handleSystemLockdown = async () => {
    try {
      await api.systemLockdown('Manual lockdown initiated from Settings page');
      setIsLockdownActive(true);
      showNotification('System lockdown activated successfully', 'success');
    } catch (err: any) {
      showNotification(err?.message || 'Failed to activate lockdown', 'error');
    }
  };

  const confirmSystemLockdown = () => {
    showConfirmation(
      'Activate System Lockdown',
      'This will prevent all users from logging in and block most API operations. Only emergency operations will remain available. Are you sure you want to proceed?',
      handleSystemLockdown,
      { 
        type: 'danger', 
        confirmText: 'Activate Lockdown',
        cancelText: 'Cancel'
      }
    );
  };

  const handleLiftLockdown = async () => {
    try {
      await api.liftLockdown();
      setIsLockdownActive(false);
      showNotification('System lockdown lifted successfully', 'success');
    } catch (err: any) {
      showNotification(err?.message || 'Failed to lift lockdown', 'error');
    }
  };

  const confirmLiftLockdown = () => {
    showConfirmation(
      'Lift System Lockdown',
      'This will restore normal system operations and allow users to log in again. Continue?',
      handleLiftLockdown,
      { 
        type: 'success', 
        confirmText: 'Lift Lockdown',
        cancelText: 'Cancel'
      }
    );
  };

  const handleEmergencyRestart = async () => {
    try {
      await api.emergencyRestart('Emergency restart initiated from Settings page');
      showNotification('Emergency restart initiated successfully', 'success');
      
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (err: any) {
      showNotification(err?.message || 'Failed to initiate emergency restart', 'error');
    }
  };

  const confirmEmergencyRestart = () => {
    showConfirmation(
      'Emergency Restart',
      'This will immediately restart the entire system. All active connections will be dropped and the service will be temporarily unavailable. This action cannot be undone.',
      handleEmergencyRestart,
      { 
        type: 'danger', 
        confirmText: 'Restart Now',
        cancelText: 'Cancel'
      }
    );
  };

  const handleCreateBackup = async () => {
    try {
      const response = await api.createBackup();
      // Handle backup download
      showNotification('Backup created successfully', 'success');
    } catch (err: any) {
      showNotification(err?.message || 'Failed to create backup', 'error');
    }
  };

  const confirmCreateBackup = () => {
    showConfirmation(
      'Create System Backup',
      'This will create a complete backup of your system including database, certificates, and configuration files. The backup will be available for download once completed.',
      handleCreateBackup,
      { 
        type: 'info', 
        confirmText: 'Create Backup',
        cancelText: 'Cancel'
      }
    );
  };

  const handleRestoreBackup = async () => {
    if (!restoreFile) return;

    setRestoringBackup(true);
    try {
      await api.restoreBackup(restoreFile);
      showNotification('Backup restore initiated successfully. System will restart shortly.', 'success');
      setRestoreFile(null);
      
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (err: any) {
      showNotification(err?.message || 'Failed to restore backup', 'error');
    } finally {
      setRestoringBackup(false);
    }
  };

  const confirmRestoreBackup = () => {
    if (!restoreFile) {
      showNotification('Please select a backup file first', 'error');
      return;
    }
    
    showConfirmation(
      'Restore System Backup',
      `This will restore the system from the backup file "${restoreFile.name}". All current data will be replaced with the backup data. The system will restart automatically after restoration. This action cannot be undone.`,
      handleRestoreBackup,
      { 
        type: 'danger', 
        confirmText: 'Restore Backup',
        cancelText: 'Cancel'
      }
    );
  };

  const handleSearchModeChange = async (mode: 'auto' | 'basic' | 'advanced') => {
    setSavingSearchMode(true);
    try {
      // Save to localStorage for now - in production this would be an API call
      localStorage.setItem('glinr_search_mode', mode);
      setSearchMode(mode);
      showNotification(`Search mode set to ${mode}`, 'success');
    } catch (err: any) {
      showNotification('Failed to save search mode setting', 'error');
    } finally {
      setSavingSearchMode(false);
    }
  };

  const confirmSearchModeChange = (mode: 'auto' | 'basic' | 'advanced') => {
    const modeDescriptions = {
      auto: 'The system will automatically choose the best available search method based on system capabilities.',
      basic: 'Use simple text matching. This is faster but offers limited search features.',
      advanced: 'Use full-text search with FTS5. This provides powerful search capabilities but requires SQLite FTS5 support.'
    };
    
    showConfirmation(
      `Change Search Mode to ${mode.charAt(0).toUpperCase() + mode.slice(1)}`,
      `${modeDescriptions[mode]} Do you want to apply this search mode setting?`,
      () => handleSearchModeChange(mode),
      { 
        type: 'info', 
        confirmText: 'Apply Setting',
        cancelText: 'Cancel'
      }
    );
  };

  const checkServiceStatus = async () => {
    try {
      const response = await fetch('/v1/health', { 
        method: 'HEAD',
        timeout: 3000 
      });
      setServiceStatus(response.ok ? 'running' : 'stopped');
    } catch (error) {
      setServiceStatus('stopped');
    }
  };

  const handleServiceAction = (action: 'start' | 'stop' | 'restart') => {
    showServiceModal(action, serviceStatus, () => {
      // Callback after action completion
      setTimeout(() => {
        checkServiceStatus();
      }, 2000);
    });
  };

  const handleRestoreDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    
    const files = event.dataTransfer?.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (validateRestoreFile(file)) {
      setRestoreFile(file);
      showNotification(`Backup file selected: ${file.name}`, 'info');
    }
  };

  const validateRestoreFile = (file: File): boolean => {
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (file.size > maxSize) {
      showNotification('Backup file is too large (max 500MB)', 'error');
      return false;
    }
    
    const validExtensions = ['.backup', '.tar.gz', '.zip'];
    const hasValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
    
    if (!hasValidExtension) {
      showNotification('Invalid file type. Please select a backup file (.backup, .tar.gz, .zip)', 'error');
      return false;
    }
    
    return true;
  };


  const formatTimeAgo = (timeAgo: string) => {
    return timeAgo;
  };

  const shouldShowRestartInfo = () => {
    return systemStatus?.last_restart;
  };

  return (
    <div class="min-h-screen">
      <div class="relative z-10 p-3 sm:p-6 max-w-7xl mx-auto space-y-6 fade-in">
        {/* Breadcrumb */}
        <Breadcrumb 
          items={[
            { icon: Home, label: "Home", href: "/" },
            { label: "Settings", href: "/settings" },
            { label: "System Administration", href: "/settings/system-admin" }
          ]} 
        />

        {/* Header */}
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold mb-3">
              <span class="bg-gradient-to-r from-[#9c40ff] via-[#e94057] to-[#8b008b] bg-clip-text text-transparent">
                System Administration
              </span>
            </h1>
            <p class="text-gray-600 dark:text-gray-300 text-sm mt-1">
              Emergency controls, system monitoring, and backup management
            </p>
          </div>
          <button
            onClick={() => loadData()}
            disabled={loading}
            class="inline-flex items-center px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw class={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg p-4">
            <p class="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <div class="text-center py-12">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500 mb-4"></div>
            <p class="text-gray-600 dark:text-gray-400">Loading system information...</p>
          </div>
        ) : (
          <div class="space-y-6">
            {/* System Status */}
            <div class="bg-white dark:bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 p-6">
              <div class="flex items-center gap-3 mb-6">
                <Activity class="w-6 h-6 text-green-500" />
                <div>
                  <h2 class="text-lg font-semibold text-gray-900 dark:text-white">System Status</h2>
                  <p class="text-sm text-gray-600 dark:text-gray-400">Current system health and information</p>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Docker Engine</span>
                    <div class="flex items-center">
                      <div class={`w-2 h-2 rounded-full mr-2 ${
                        systemInfo?.docker_status === 'connected' ? 'bg-green-500' : 'bg-red-500'
                      }`}></div>
                      <span class="text-xs font-medium text-gray-900 dark:text-white capitalize">
                        {systemInfo?.docker_status || 'Unknown'}
                      </span>
                    </div>
                  </div>
                  <p class="text-xs text-gray-600 dark:text-gray-400">Container orchestration engine</p>
                </div>
                
                <div class="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-medium text-gray-700 dark:text-gray-300">System Info</span>
                    <span class="text-xs font-mono text-gray-900 dark:text-white">
                      {systemInfo?.os || 'Unknown'}/{systemInfo?.arch || 'Unknown'}
                    </span>
                  </div>
                  <p class="text-xs text-gray-600 dark:text-gray-400">
                    Runtime: v{systemInfo?.go_version?.replace(/^go/, '') || 'Unknown'}
                  </p>
                </div>
              </div>
            </div>

            {/* Service Management */}
            <div class="bg-white dark:bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 p-6">
              <div class="flex items-center gap-3 mb-6">
                <Cpu class="w-6 h-6 text-indigo-500" />
                <div>
                  <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Service Management</h2>
                  <p class="text-sm text-gray-600 dark:text-gray-400">Control backend services and connectivity</p>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div class={`relative overflow-hidden rounded-xl border transition-all duration-300 ${
                  serviceStatus === 'running' ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/30' :
                  serviceStatus === 'stopped' ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30' :
                  'bg-yellow-50 dark:bg-yellow-900/10 border-yellow-200 dark:border-yellow-800/30'
                }`}>
                  <div class="p-6">
                    <div class="flex items-center justify-between mb-4">
                      <div class="flex items-center gap-3">
                        <div class={`p-2 rounded-lg ${
                          serviceStatus === 'running' ? 'bg-green-100 dark:bg-green-900/20' :
                          serviceStatus === 'stopped' ? 'bg-red-100 dark:bg-red-900/20' :
                          'bg-yellow-100 dark:bg-yellow-900/20'
                        }`}>
                          <Server class={`w-5 h-5 ${
                            serviceStatus === 'running' ? 'text-green-600 dark:text-green-400' :
                            serviceStatus === 'stopped' ? 'text-red-600 dark:text-red-400' :
                            'text-yellow-600 dark:text-yellow-400'
                          }`} />
                        </div>
                        <span class="text-sm font-semibold text-gray-900 dark:text-white">Backend Service</span>
                      </div>
                      <div class="flex items-center gap-2">
                        <div class={`w-3 h-3 rounded-full transition-all duration-300 ${
                          serviceStatus === 'running' ? 'bg-green-500 animate-pulse' : 
                          serviceStatus === 'stopped' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'
                        }`}></div>
                        <span class={`text-xs font-bold uppercase tracking-wider ${
                          serviceStatus === 'running' ? 'text-green-700 dark:text-green-300' :
                          serviceStatus === 'stopped' ? 'text-red-700 dark:text-red-300' :
                          'text-yellow-700 dark:text-yellow-300'
                        }`}>
                          {serviceStatus === 'unknown' ? 'Checking...' : serviceStatus}
                        </span>
                      </div>
                    </div>
                    <p class="text-sm text-gray-600 dark:text-gray-400">
                      Core API endpoints and system services
                    </p>
                    {serviceStatus === 'running' && (
                      <div class="mt-3 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <Activity class="w-3 h-3" />
                        All systems operational
                      </div>
                    )}
                  </div>
                  {serviceStatus === 'running' && (
                    <div class="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-green-400 to-green-600 animate-pulse"></div>
                  )}
                </div>
                
                <div class="relative overflow-hidden rounded-xl border bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 border-blue-200 dark:border-blue-800/30">
                  <div class="p-6">
                    <div class="flex items-center justify-between mb-4">
                      <div class="flex items-center gap-3">
                        <div class="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                          <Activity class="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span class="text-sm font-semibold text-gray-900 dark:text-white">Connection Info</span>
                      </div>
                    </div>
                    <div class="space-y-2">
                      <div class="flex justify-between text-sm">
                        <span class="text-gray-600 dark:text-gray-400">Endpoint:</span>
                        <span class="font-mono text-gray-900 dark:text-white bg-white dark:bg-gray-800 px-2 py-1 rounded text-xs">
                          {window.location.hostname}:{window.location.port || '80'}
                        </span>
                      </div>
                      <div class="flex justify-between text-sm">
                        <span class="text-gray-600 dark:text-gray-400">Protocol:</span>
                        <span class="text-gray-900 dark:text-white font-medium">
                          {window.location.protocol.toUpperCase().replace(':', '')}
                        </span>
                      </div>
                      <div class="flex justify-between text-sm">
                        <span class="text-gray-600 dark:text-gray-400">Environment:</span>
                        <span class="text-blue-600 dark:text-blue-400 font-medium">
                          {window.location.hostname === 'localhost' ? 'Development' : 'Production'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div class="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-blue-400 to-indigo-500"></div>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={() => handleServiceAction('start')}
                  disabled={serviceStatus === 'running'}
                  class="group relative overflow-hidden flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all duration-300 shadow-md hover:shadow-green-500/30 hover:scale-105"
                >
                  <div class="relative z-10 p-1.5 bg-white/25 rounded-md group-hover:bg-white/35 group-hover:scale-110 transition-all duration-300">
                    <Play class="w-4 h-4" />
                  </div>
                  <div class="relative z-10 flex-1 text-left">
                    <div class="font-semibold text-sm">Start Service</div>
                    <div class="text-xs text-green-100/80">Launch server</div>
                  </div>
                  {/* Subtle animated background */}
                  <div class="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                </button>

                <button
                  onClick={() => handleServiceAction('restart')}
                  class="group relative overflow-hidden flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-sm font-medium rounded-lg transition-all duration-300 shadow-md hover:shadow-orange-500/30 hover:scale-105"
                >
                  <div class="relative z-10 p-1.5 bg-white/25 rounded-md group-hover:bg-white/35 group-hover:rotate-180 transition-all duration-500">
                    <RotateCcw class="w-4 h-4" />
                  </div>
                  <div class="relative z-10 flex-1 text-left">
                    <div class="font-semibold text-sm">Request Restart</div>
                    <div class="text-xs text-orange-100/80">Log restart request</div>
                  </div>
                  <div class="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                </button>

                <button
                  onClick={() => handleServiceAction('stop')}
                  disabled={serviceStatus === 'stopped'}
                  class="group relative overflow-hidden flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-all duration-300 shadow-md hover:shadow-red-500/30 hover:scale-105"
                >
                  <div class="relative z-10 p-1.5 bg-white/25 rounded-md group-hover:bg-white/35 group-hover:scale-90 transition-all duration-300">
                    <Square class="w-4 h-4 fill-white" />
                  </div>
                  <div class="relative z-10 flex-1 text-left">
                    <div class="font-semibold text-sm">Stop Service</div>
                    <div class="text-xs text-red-100/80">Safe shutdown</div>
                  </div>
                  <div class="absolute inset-0 bg-gradient-to-r from-white/0 via-white/5 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                </button>
              </div>

              {/* Service management info */}
              <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-lg">
                <div class="flex items-start space-x-3">
                  <CheckCircle class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div class="text-sm">
                    <p class="font-medium text-blue-800 dark:text-blue-300 mb-1">Service Control</p>
                    <ul class="text-blue-700 dark:text-blue-400 space-y-1 text-xs">
                      <li>• <strong>Start:</strong> Launch backend services (development mode shows instructions)</li>
                      <li>• <strong>Restart:</strong> Gracefully restart all services with brief downtime</li>
                      <li>• <strong>Stop:</strong> Safely shutdown services (use with caution)</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Search Settings */}
            <div class="bg-white dark:bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 p-6">
              <div class="flex items-center justify-between mb-6">
                <div class="flex items-center gap-3">
                  <Search class="w-6 h-6 text-purple-500" />
                  <div>
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Search Settings</h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400">Configure search behavior and performance</p>
                  </div>
                </div>
                <button
                  onClick={() => showSearchSettingsModal(() => {
                    console.log('Search settings updated');
                  })}
                  class="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white text-sm font-medium rounded-lg transition-all duration-200 hover:scale-105 hover:shadow-lg"
                >
                  <SettingsIcon class="w-4 h-4" />
                  Configure Search
                </button>
              </div>

              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    Search Mode
                  </label>
                  <div class="space-y-2">
                    {[
                      { value: 'auto', label: 'Auto', description: 'Automatically choose best available search method' },
                      { value: 'basic', label: 'Basic', description: 'Simple text matching (fast, limited features)' },
                      { value: 'advanced', label: 'Advanced', description: 'Full-text search with FTS5 (requires SQLite FTS5)' }
                    ].map((option) => (
                      <label key={option.value} class="flex items-start space-x-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 cursor-pointer">
                        <input
                          type="radio"
                          name="searchMode"
                          value={option.value}
                          checked={searchMode === option.value}
                          onChange={(e) => confirmSearchModeChange(e.target.value as 'auto' | 'basic' | 'advanced')}
                          disabled={savingSearchMode}
                          class="mt-1 text-purple-600 dark:text-purple-400 focus:ring-purple-500 dark:focus:ring-purple-400"
                        />
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2">
                            <span class="text-sm font-medium text-gray-900 dark:text-white">
                              {option.label}
                            </span>
                            {searchMode === option.value && (
                              <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                                Active
                              </span>
                            )}
                          </div>
                          <p class="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {option.description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {searchMode === 'advanced' && (
                  <div class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/30 rounded-lg">
                    <div class="flex items-start space-x-3">
                      <CheckCircle class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                      <div class="text-sm">
                        <p class="font-medium text-blue-800 dark:text-blue-300 mb-1">Advanced Search Features</p>
                        <ul class="text-blue-700 dark:text-blue-400 space-y-1 text-xs">
                          <li>• Fuzzy matching and typo tolerance</li>
                          <li>• Stemming and language support</li>
                          <li>• Boolean operators (AND, OR, NOT)</li>
                          <li>• Phrase matching with quotes</li>
                          <li>• Field-specific search</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {searchMode === 'basic' && (
                  <div class="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800/30 rounded-lg">
                    <div class="flex items-start space-x-3">
                      <AlertTriangle class="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                      <div class="text-sm">
                        <p class="font-medium text-yellow-800 dark:text-yellow-300 mb-1">Limited Search Capabilities</p>
                        <p class="text-yellow-700 dark:text-yellow-400 text-xs">
                          Basic mode only supports simple text matching. Consider enabling Advanced mode for better search experience.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Emergency Controls */}
            <div class="bg-white dark:bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 p-6">
              <div class="flex items-center gap-3 mb-6">
                <AlertTriangle class="w-6 h-6 text-red-500" />
                <div>
                  <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Emergency Controls</h2>
                  <p class="text-sm text-gray-600 dark:text-gray-400">Critical system controls for emergency situations</p>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* System Lockdown */}
                <div class={`p-4 rounded-lg border ${
                  isLockdownActive 
                    ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/30' 
                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800/30'
                }`}>
                  <div class="flex items-center gap-2 mb-2">
                    {isLockdownActive ? (
                      <Lock class="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    ) : (
                      <Unlock class="w-5 h-5 text-red-600 dark:text-red-400" />
                    )}
                    <h3 class={`text-sm font-semibold ${
                      isLockdownActive 
                        ? 'text-orange-900 dark:text-orange-300' 
                        : 'text-red-900 dark:text-red-300'
                    }`}>
                      {isLockdownActive ? 'System Lockdown Active' : 'System Lockdown'}
                    </h3>
                  </div>
                  <p class={`text-xs mb-4 ${
                    isLockdownActive 
                      ? 'text-orange-700 dark:text-orange-400' 
                      : 'text-red-700 dark:text-red-400'
                  }`}>
                    {isLockdownActive 
                      ? 'System is currently in lockdown mode. Only admin access is permitted.' 
                      : 'Immediately restrict access to admin-only operations. Use during security incidents.'
                    }
                  </p>
                  {isLockdownActive ? (
                    <button 
                      onClick={confirmLiftLockdown}
                      class="w-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      <Unlock class="w-4 h-4 inline mr-2" />
                      Lift Lockdown
                    </button>
                  ) : (
                    <button 
                      onClick={confirmSystemLockdown}
                      class="w-full bg-red-500 hover:bg-red-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
                    >
                      <Lock class="w-4 h-4 inline mr-2" />
                      Initiate Lockdown
                    </button>
                  )}
                </div>
                
                {/* Emergency Restart */}
                <div class="p-4 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800/30">
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center gap-2">
                      <RotateCcw class="w-5 h-5 text-orange-600 dark:text-orange-400" />
                      <h3 class="text-sm font-semibold text-orange-900 dark:text-orange-300">Emergency Restart</h3>
                    </div>
                    {shouldShowRestartInfo() && (
                      <div class="flex items-center text-xs text-orange-600 dark:text-orange-400">
                        <Clock class="w-3 h-3 mr-1" />
                        Last: {formatTimeAgo(systemStatus?.last_restart?.time_ago || '')} ago
                      </div>
                    )}
                  </div>
                  <p class="text-xs text-orange-700 dark:text-orange-400 mb-3">
                    Force restart all services. Will cause brief downtime but may resolve critical issues.
                  </p>
                  
                  {shouldShowRestartInfo() && (
                    <div class="mb-3 p-3 bg-green-100 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800/30">
                      <div class="flex items-center text-xs text-green-800 dark:text-green-300">
                        <CheckCircle class="w-4 h-4 mr-2 text-green-600 dark:text-green-400" />
                        <div>
                          <div class="font-semibold">Last successful restart</div>
                          <div class="font-mono text-xs mt-1">
                            {systemStatus?.last_restart ? new Date(systemStatus.last_restart.timestamp).toLocaleString() : ''}
                          </div>
                          <div class="text-xs opacity-75 mt-1">
                            System has been running for {formatTimeAgo(systemStatus?.last_restart?.time_ago || '')}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <button 
                    onClick={confirmEmergencyRestart}
                    class="w-full bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    <RotateCcw class="w-4 h-4 inline mr-2" />
                    Emergency Restart
                  </button>
                </div>
              </div>
            </div>

            {/* Backup & Restore */}
            <div class="bg-white dark:bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 p-6">
              <div class="flex items-center justify-between mb-6">
                <div class="flex items-center gap-3">
                  <FileArchive class="w-6 h-6 text-blue-500" />
                  <div>
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Backup & Restore</h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400">System backup and recovery management</p>
                  </div>
                </div>
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
                  <AlertTriangle class="w-3 h-3 mr-1" />
                  BETA
                </span>
              </div>
              
              {/* Beta Warning */}
              <div class="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div class="flex items-start space-x-3">
                  <AlertTriangle class="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                  <div class="text-sm">
                    <p class="font-medium text-yellow-800 dark:text-yellow-300 mb-2">Beta Feature - Use with Caution</p>
                    <ul class="text-yellow-700 dark:text-yellow-400 space-y-1 text-xs">
                      <li>• Backup & restore functionality is still in development</li>
                      <li>• May not capture all system data correctly</li>
                      <li>• Restore process might not fully restore system state</li>
                      <li>• Recommended for testing and development environments only</li>
                      <li>• Create external backups for production systems</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800/30">
                  <div class="flex items-center gap-2 mb-2">
                    <Download class="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h3 class="text-sm font-semibold text-blue-900 dark:text-blue-300">Create Backup</h3>
                  </div>
                  <p class="text-xs text-blue-700 dark:text-blue-400 mb-4">
                    Download a complete system backup including database, certificates, and configuration files.
                  </p>
                  <button 
                    onClick={confirmCreateBackup}
                    class="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    <Download class="w-4 h-4 inline mr-2" />
                    Create Backup
                  </button>
                </div>
                
                <div class="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800/30">
                  <div class="flex items-center gap-2 mb-2">
                    <Upload class="w-5 h-5 text-green-600 dark:text-green-400" />
                    <h3 class="text-sm font-semibold text-green-900 dark:text-green-300">Restore from Backup</h3>
                  </div>
                  <p class="text-xs text-green-700 dark:text-green-400 mb-4">
                    Restore your system from a previous backup. This will overwrite current data and restart services.
                  </p>
                  <button 
                    onClick={confirmRestoreBackup}
                    class="w-full bg-green-500 hover:bg-green-600 text-white text-sm font-medium py-2 px-4 rounded-lg transition-colors"
                  >
                    <Upload class="w-4 h-4 inline mr-2" />
                    Restore Backup
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modals would go here - simplified for now */}
        {/* Add modal implementations for lockdown, emergency restart, backup, and restore */}
      </div>
    </div>
  );
}