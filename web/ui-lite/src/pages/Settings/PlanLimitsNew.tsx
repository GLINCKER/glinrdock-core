import { useState, useEffect } from 'preact/hooks';
import { Breadcrumb } from "../../components/Breadcrumb";
import { usePageTitle } from "../../hooks/usePageTitle";
import { apiClient as api, type PlanInfo } from "../../api";
import { Home, Crown, Users, Key, Cpu, CheckCircle, XCircle, RefreshCw } from "lucide-preact";

export function PlanLimitsNew() {
  usePageTitle("Plan & Limits");
  
  const [planInfo, setPlanInfo] = useState<PlanInfo | null>(null);
  const [licenseInfo, setLicenseInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [licenseLoading, setLicenseLoading] = useState(false);
  const [showLicenseForm, setShowLicenseForm] = useState(false);
  const [licenseData, setLicenseData] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [planData, licenseData] = await Promise.all([
        api.getSystemPlan(),
        api.getLicense().catch(() => null) // License might not exist
      ]);
      setPlanInfo(planData);
      setLicenseInfo(licenseData);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Failed to load plan information');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleActivateLicense = async () => {
    if (!licenseData.trim()) {
      setError('License data is required');
      return;
    }

    try {
      setLicenseLoading(true);
      await api.activateLicense(licenseData);
      await loadData();
      setShowLicenseForm(false);
      setLicenseData('');
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Failed to activate license');
    } finally {
      setLicenseLoading(false);
    }
  };

  const handleDeactivateLicense = async () => {
    if (!confirm('Are you sure you want to deactivate the current license? This will reset to the FREE plan.')) {
      return;
    }

    try {
      setLicenseLoading(true);
      await api.deactivateLicense();
      await loadData();
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Failed to deactivate license');
    } finally {
      setLicenseLoading(false);
    }
  };

  const getPlanColor = (plan: string) => {
    switch (plan.toUpperCase()) {
      case 'FREE': return 'text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-gray-800';
      case 'PRO': return 'text-blue-600 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/20';
      case 'ENTERPRISE': return 'text-purple-600 bg-purple-100 dark:text-purple-300 dark:bg-purple-900/20';
      default: return 'text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-gray-800';
    }
  };

  const getUsageColor = (used: number, max: number) => {
    const percentage = (used / max) * 100;
    if (percentage >= 90) return 'bg-red-500';
    if (percentage >= 75) return 'bg-orange-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div class="min-h-screen">
      <div class="relative z-10 p-3 sm:p-6 max-w-7xl mx-auto space-y-6 fade-in">
        {/* Breadcrumb */}
        <Breadcrumb 
          items={[
            { icon: Home, label: "Home", href: "/" },
            { label: "Settings", href: "/settings" },
            { label: "Plan & Limits", href: "/settings/plan-limits" }
          ]} 
        />

        {/* Header */}
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold mb-3">
              <span class="bg-gradient-to-r from-[#9c40ff] via-[#e94057] to-[#8b008b] bg-clip-text text-transparent">
                Plan & Limits
              </span>
            </h1>
            <p class="text-gray-600 dark:text-gray-300 text-sm mt-1">
              Manage your plan and resource limits
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
            <p class="text-gray-600 dark:text-gray-400">Loading plan information...</p>
          </div>
        ) : (
          <>
            {/* Current Plan */}
            {planInfo && (
              <div class="bg-white dark:bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 p-6">
                <div class="flex items-center justify-between mb-6">
                  <div class="flex items-center gap-3">
                    <Crown class="w-6 h-6 text-purple-500" />
                    <div>
                      <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Current Plan</h2>
                      <p class="text-sm text-gray-600 dark:text-gray-400">
                        Your active subscription and resource allocation
                      </p>
                    </div>
                  </div>
                  <span class={`px-3 py-1 rounded-full text-sm font-medium ${getPlanColor(planInfo.plan)}`}>
                    {planInfo.plan.toUpperCase()}
                  </span>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Users */}
                  <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center gap-2">
                        <Users class="w-4 h-4 text-blue-500" />
                        <span class="font-medium text-gray-900 dark:text-white">Users</span>
                      </div>
                      <span class="text-sm text-gray-600 dark:text-gray-400">
                        {planInfo.usage.users}/{planInfo.limits.MaxUsers}
                      </span>
                    </div>
                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        class={`h-2 rounded-full ${getUsageColor(planInfo.usage.users, planInfo.limits.MaxUsers)}`}
                        style={`width: ${Math.min((planInfo.usage.users / planInfo.limits.MaxUsers) * 100, 100)}%`}
                      ></div>
                    </div>
                  </div>

                  {/* Tokens */}
                  <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center gap-2">
                        <Key class="w-4 h-4 text-green-500" />
                        <span class="font-medium text-gray-900 dark:text-white">API Tokens</span>
                      </div>
                      <span class="text-sm text-gray-600 dark:text-gray-400">
                        {planInfo.usage.tokens}/{planInfo.limits.MaxTokens}
                      </span>
                    </div>
                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        class={`h-2 rounded-full ${getUsageColor(planInfo.usage.tokens, planInfo.limits.MaxTokens)}`}
                        style={`width: ${Math.min((planInfo.usage.tokens / planInfo.limits.MaxTokens) * 100, 100)}%`}
                      ></div>
                    </div>
                  </div>

                  {/* Clients */}
                  <div class="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4">
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center gap-2">
                        <Cpu class="w-4 h-4 text-purple-500" />
                        <span class="font-medium text-gray-900 dark:text-white">Clients</span>
                      </div>
                      <span class="text-sm text-gray-600 dark:text-gray-400">
                        {planInfo.usage.clients}/{planInfo.limits.MaxClients}
                      </span>
                    </div>
                    <div class="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        class={`h-2 rounded-full ${getUsageColor(planInfo.usage.clients, planInfo.limits.MaxClients)}`}
                        style={`width: ${Math.min((planInfo.usage.clients / planInfo.limits.MaxClients) * 100, 100)}%`}
                      ></div>
                    </div>
                  </div>
                </div>

                {planInfo.upgrade_hint && (
                  <div class="mt-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/30 rounded-lg p-4">
                    <p class="text-amber-800 dark:text-amber-200 text-sm">
                      💡 {planInfo.upgrade_hint}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* License Management */}
            <div class="bg-white dark:bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50">
              <div class="p-6 border-b border-gray-200 dark:border-gray-700/50">
                <div class="flex items-center justify-between">
                  <div>
                    <h2 class="text-lg font-semibold text-gray-900 dark:text-white">License Management</h2>
                    <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Manage your software license and activation
                    </p>
                  </div>
                  {!showLicenseForm && (
                    <button
                      onClick={() => setShowLicenseForm(true)}
                      class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-[#9c40ff] to-[#8b008b] text-white rounded-lg hover:from-[#8a39e6] hover:to-[#7a0078] transition-all duration-200"
                    >
                      Activate License
                    </button>
                  )}
                </div>
              </div>

              <div class="p-6">
                {licenseInfo ? (
                  <div class="space-y-4">
                    <div class="flex items-center gap-3 mb-4">
                      <CheckCircle class="w-6 h-6 text-green-500" />
                      <div>
                        <h3 class="font-medium text-gray-900 dark:text-white">License Active</h3>
                        <p class="text-sm text-gray-600 dark:text-gray-400">Your license is valid and active</p>
                      </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p class="text-gray-500 dark:text-gray-400">License Type</p>
                        <p class="font-medium text-gray-900 dark:text-white">
                          {licenseInfo.license_type || 'Standard'}
                        </p>
                      </div>
                      <div>
                        <p class="text-gray-500 dark:text-gray-400">Status</p>
                        <p class="font-medium text-gray-900 dark:text-white">
                          {licenseInfo.status || 'Active'}
                        </p>
                      </div>
                    </div>

                    <div class="flex items-center gap-3 mt-6">
                      <button
                        onClick={handleDeactivateLicense}
                        disabled={licenseLoading}
                        class="inline-flex items-center px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
                      >
                        {licenseLoading ? (
                          <>
                            <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                            Processing...
                          </>
                        ) : (
                          <>
                            <XCircle class="w-4 h-4 mr-2" />
                            Deactivate License
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {showLicenseForm ? (
                      <div class="space-y-4">
                        <div>
                          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            License Data (Base64 encoded)
                          </label>
                          <textarea
                            value={licenseData}
                            onInput={(e) => setLicenseData((e.target as HTMLTextAreaElement).value)}
                            placeholder="Paste your license data here..."
                            rows={8}
                            class="w-full min-h-[200px] px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-y"
                          />
                        </div>
                        <div class="flex items-center gap-3">
                          <button
                            onClick={handleActivateLicense}
                            disabled={licenseLoading}
                            class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200 disabled:opacity-50"
                          >
                            {licenseLoading ? (
                              <>
                                <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                Activating...
                              </>
                            ) : (
                              <>
                                <CheckCircle class="w-4 h-4 mr-2" />
                                Activate License
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setShowLicenseForm(false);
                              setLicenseData('');
                              setError('');
                            }}
                            class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div class="text-center py-8">
                        <XCircle class="w-12 h-12 mx-auto text-gray-400 mb-4" />
                        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                          No License Active
                        </h3>
                        <p class="text-gray-600 dark:text-gray-400 mb-4">
                          You're currently using the FREE plan. Activate a license to unlock additional features.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}