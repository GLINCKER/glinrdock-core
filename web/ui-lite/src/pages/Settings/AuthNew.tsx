import { useState, useEffect } from 'preact/hooks';
import { Breadcrumb } from "../../components/Breadcrumb";
import { usePageTitle } from "../../hooks/usePageTitle";
import { apiClient as api, type Token, type AuthInfo, type IntegrationsConfig, type GitHubOAuthConfig } from "../../api";
import { Home, Plus, Key, Trash2, Calendar, Clock, Github, Settings as SettingsIcon, Eye, EyeOff, LogOut, Shield, User } from "lucide-preact";

export function AuthNew() {
  usePageTitle("Authentication");
  
  const [tokens, setTokens] = useState<Token[]>([]);
  const [authInfo, setAuthInfo] = useState<AuthInfo | null>(null);
  const [integrationsConfig, setIntegrationsConfig] = useState<IntegrationsConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showOAuthForm, setShowOAuthForm] = useState(false);
  const [oauthSaving, setOauthSaving] = useState(false);
  const [showClientSecret, setShowClientSecret] = useState(false);
  const [createTokenData, setCreateTokenData] = useState({
    name: '',
    plain: '',
    role: 'viewer'
  });
  const [oauthFormData, setOauthFormData] = useState<GitHubOAuthConfig>({
    mode: 'off',
    client_id: '',
    client_secret: '',
    redirect_url: ''
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const [tokensData, authData, integrationsData] = await Promise.all([
        api.getTokens(),
        api.getAuthInfo(),
        api.getIntegrationsConfig().catch(() => null) // Don't fail if integrations config is not available
      ]);
      setTokens(tokensData);
      setAuthInfo(authData);
      setIntegrationsConfig(integrationsData);
      
      // Update OAuth form with existing config
      if (integrationsData?.github_oauth) {
        setOauthFormData({
          mode: integrationsData.github_oauth.mode || 'off',
          client_id: integrationsData.github_oauth.client_id || '',
          client_secret: '', // Never pre-populate secrets for security
          redirect_url: integrationsData.github_oauth.redirect_url || ''
        });
      }
      
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Failed to load authentication data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateToken = async () => {
    if (!createTokenData.name.trim() || !createTokenData.plain.trim()) {
      setError('Name and token are required');
      return;
    }

    try {
      await api.createToken(createTokenData);
      await loadData();
      setShowCreateForm(false);
      setCreateTokenData({ name: '', plain: '', role: 'viewer' });
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Failed to create token');
    }
  };

  const handleDeleteToken = async (name: string) => {
    if (!confirm(`Are you sure you want to delete the token "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.deleteToken(name);
      await loadData();
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Failed to delete token');
    }
  };

  const handleSaveOAuth = async () => {
    setOauthSaving(true);
    try {
      const updatedConfig: IntegrationsConfig = {
        ...integrationsConfig,
        github_oauth: {
          mode: oauthFormData.mode,
          client_id: oauthFormData.client_id || undefined,
          client_secret: oauthFormData.client_secret || undefined,
          redirect_url: oauthFormData.redirect_url || undefined,
        }
      };

      await api.updateIntegrationsConfig(updatedConfig);
      await loadData(); // Refresh data
      setShowOAuthForm(false);
      setError('');
    } catch (err: any) {
      setError(err?.message || 'Failed to save OAuth configuration');
    } finally {
      setOauthSaving(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'admin': return 'text-red-600 bg-red-100 dark:text-red-300 dark:bg-red-900/20';
      case 'deployer': return 'text-orange-600 bg-orange-100 dark:text-orange-300 dark:bg-orange-900/20';
      default: return 'text-blue-600 bg-blue-100 dark:text-blue-300 dark:bg-blue-900/20';
    }
  };

  return (
    <div class="min-h-screen">
      <div class="relative z-10 p-3 sm:p-6 max-w-7xl mx-auto space-y-6 fade-in">
        {/* Breadcrumb */}
        <Breadcrumb 
          items={[
            { icon: Home, label: "Home", href: "/" },
            { label: "Settings", href: "/settings" },
            { label: "Authentication", href: "/settings/auth" }
          ]} 
        />

        {/* Header */}
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-3xl font-bold mb-3">
              <span class="bg-gradient-to-r from-[#9c40ff] via-[#e94057] to-[#8b008b] bg-clip-text text-transparent">
                Authentication
              </span>
            </h1>
            <p class="text-gray-600 dark:text-gray-300 text-sm mt-1">
              Manage API tokens and authentication settings
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-[#9c40ff] to-[#8b008b] text-white rounded-lg hover:from-[#8a39e6] hover:to-[#7a0078] transition-all duration-200 shadow-lg hover:shadow-xl"
          >
            <Plus class="w-4 h-4 mr-2" />
            Create Token
          </button>
        </div>

        {error && (
          <div class="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/30 rounded-lg p-4">
            <p class="text-red-800 dark:text-red-200 text-sm">{error}</p>
          </div>
        )}

        {/* Current Authentication Info & Session Management */}
        {authInfo && (
          <div class="bg-white dark:bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <User class="w-5 h-5" />
                Current Session
              </h2>
              {authInfo.method === 'session' && (
                <button
                  onClick={async () => {
                    if (confirm('Are you sure you want to sign out? You will need to re-authenticate.')) {
                      try {
                        await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'include' });
                        window.location.reload();
                      } catch (error) {
                        setError('Failed to sign out');
                      }
                    }
                  }}
                  class="inline-flex items-center px-3 py-1 text-sm bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
                >
                  <LogOut class="w-4 h-4 mr-1" />
                  Sign Out
                </button>
              )}
            </div>
            
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <p class="text-sm text-gray-500 dark:text-gray-400">Authentication Method</p>
                <div class="flex items-center gap-2 mt-1">
                  {authInfo.method === 'session' ? (
                    <Shield class="w-4 h-4 text-blue-600" />
                  ) : (
                    <Key class="w-4 h-4 text-orange-600" />
                  )}
                  <p class="font-medium text-gray-900 dark:text-white capitalize">
                    {authInfo.method === 'session' ? 'OAuth Session' : 'API Token'}
                  </p>
                </div>
              </div>
              
              <div>
                <p class="text-sm text-gray-500 dark:text-gray-400">User/Token</p>
                <p class="font-medium text-gray-900 dark:text-white">
                  {authInfo.user?.login || authInfo.token_name || 'Unknown'}
                </p>
              </div>
              
              <div>
                <p class="text-sm text-gray-500 dark:text-gray-400">Role</p>
                <span class={`inline-flex px-2 py-1 rounded-full text-xs font-medium mt-1 ${getRoleColor(authInfo.role || 'viewer')}`}>
                  {authInfo.role || 'viewer'}
                </span>
              </div>

              {authInfo.user && (
                <>
                  {authInfo.user.name && (
                    <div>
                      <p class="text-sm text-gray-500 dark:text-gray-400">Full Name</p>
                      <p class="font-medium text-gray-900 dark:text-white">{authInfo.user.name}</p>
                    </div>
                  )}
                  
                  {authInfo.user.avatar_url && (
                    <div class="md:col-span-2 lg:col-span-1">
                      <p class="text-sm text-gray-500 dark:text-gray-400 mb-2">Avatar</p>
                      <div class="flex items-center gap-3">
                        <img 
                          src={authInfo.user.avatar_url} 
                          alt={`${authInfo.user.login}'s avatar`}
                          class="w-8 h-8 rounded-full"
                        />
                        <span class="text-sm text-gray-600 dark:text-gray-400">
                          GitHub Profile Picture
                        </span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Session Security Info */}
            {authInfo.method === 'session' && (
              <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/50">
                <div class="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <Shield class="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                  <div>
                    <h4 class="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                      Secure Session Active
                    </h4>
                    <p class="text-sm text-blue-800 dark:text-blue-200">
                      You're authenticated via GitHub OAuth with secure session management. 
                      Your session will automatically expire for security.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Token Security Warning */}
            {authInfo.method === 'token' && (
              <div class="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700/50">
                <div class="flex items-start gap-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                  <Key class="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5" />
                  <div>
                    <h4 class="text-sm font-medium text-orange-900 dark:text-orange-100 mb-1">
                      API Token Authentication
                    </h4>
                    <p class="text-sm text-orange-800 dark:text-orange-200">
                      You're using API token authentication. Keep your token secure and consider using OAuth for interactive sessions.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* OAuth Configuration Section */}
        <div class="bg-white dark:bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 p-6">
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Github class="w-5 h-5" />
                GitHub OAuth Integration
              </h2>
              <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Configure GitHub OAuth for user authentication
              </p>
            </div>
            <div class="flex items-center gap-2">
              <span class={`px-3 py-1 rounded-full text-xs font-medium ${
                integrationsConfig?.github_oauth?.mode === 'on' 
                  ? 'text-green-600 bg-green-100 dark:text-green-300 dark:bg-green-900/20'
                  : 'text-gray-600 bg-gray-100 dark:text-gray-300 dark:bg-gray-900/20'
              }`}>
                {integrationsConfig?.github_oauth?.mode === 'on' ? 'Enabled' : 'Disabled'}
              </span>
              <button
                onClick={() => setShowOAuthForm(!showOAuthForm)}
                class="inline-flex items-center px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <SettingsIcon class="w-4 h-4 mr-1" />
                Configure
              </button>
            </div>
          </div>

          {/* OAuth Configuration Form */}
          {showOAuthForm && (
            <div class="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700/50">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    OAuth Status
                  </label>
                  <select
                    value={oauthFormData.mode}
                    onChange={(e) => setOauthFormData({ ...oauthFormData, mode: (e.target as HTMLSelectElement).value as 'on' | 'off' })}
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="off">Disabled</option>
                    <option value="on">Enabled</option>
                  </select>
                </div>
                
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Redirect URL
                  </label>
                  <input
                    type="url"
                    value={oauthFormData.redirect_url}
                    onInput={(e) => setOauthFormData({ ...oauthFormData, redirect_url: (e.target as HTMLInputElement).value })}
                    placeholder="https://yourdomain.com/auth/github/callback"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Client ID
                  </label>
                  <input
                    type="text"
                    value={oauthFormData.client_id}
                    onInput={(e) => setOauthFormData({ ...oauthFormData, client_id: (e.target as HTMLInputElement).value })}
                    placeholder="GitHub OAuth App Client ID"
                    class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Client Secret
                  </label>
                  <div class="relative">
                    <input
                      type={showClientSecret ? "text" : "password"}
                      value={oauthFormData.client_secret}
                      onInput={(e) => setOauthFormData({ ...oauthFormData, client_secret: (e.target as HTMLInputElement).value })}
                      placeholder="GitHub OAuth App Client Secret"
                      class="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => setShowClientSecret(!showClientSecret)}
                      class="absolute inset-y-0 right-0 pr-3 flex items-center"
                    >
                      {showClientSecret ? (
                        <EyeOff class="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye class="h-4 w-4 text-gray-400" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* OAuth Configuration Help */}
              <div class="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800/30">
                <div class="flex items-start gap-3">
                  <div class="flex-shrink-0">
                    <Github class="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 class="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                      GitHub OAuth Setup Instructions
                    </h4>
                    <ol class="text-sm text-blue-800 dark:text-blue-200 space-y-1 list-decimal list-inside">
                      <li>Go to GitHub Settings → Developer settings → OAuth Apps</li>
                      <li>Create a new OAuth App or use an existing one</li>
                      <li>Set the Authorization callback URL to the Redirect URL above</li>
                      <li>Copy the Client ID and Client Secret from your GitHub OAuth App</li>
                      <li>Enable OAuth and save the configuration</li>
                    </ol>
                  </div>
                </div>
              </div>

              {/* Save/Cancel buttons */}
              <div class="flex items-center gap-3 mt-6">
                <button
                  onClick={handleSaveOAuth}
                  disabled={oauthSaving}
                  class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {oauthSaving ? (
                    <div class="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Github class="w-4 h-4 mr-2" />
                  )}
                  {oauthSaving ? 'Saving...' : 'Save OAuth Config'}
                </button>
                <button
                  onClick={() => {
                    setShowOAuthForm(false);
                    setError('');
                    // Reset form to current config
                    if (integrationsConfig?.github_oauth) {
                      setOauthFormData({
                        mode: integrationsConfig.github_oauth.mode || 'off',
                        client_id: integrationsConfig.github_oauth.client_id || '',
                        client_secret: '',
                        redirect_url: integrationsConfig.github_oauth.redirect_url || ''
                      });
                    }
                  }}
                  class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Create Token Form */}
        {showCreateForm && (
          <div class="bg-white dark:bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 p-6">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New Token</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Token Name
                </label>
                <input
                  type="text"
                  value={createTokenData.name}
                  onInput={(e) => setCreateTokenData({ ...createTokenData, name: (e.target as HTMLInputElement).value })}
                  placeholder="e.g., ci-deployer"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Token Value
                </label>
                <input
                  type="text"
                  value={createTokenData.plain}
                  onInput={(e) => setCreateTokenData({ ...createTokenData, plain: (e.target as HTMLInputElement).value })}
                  placeholder="e.g., secret-token-123"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Role
                </label>
                <select
                  value={createTokenData.role}
                  onChange={(e) => setCreateTokenData({ ...createTokenData, role: (e.target as HTMLSelectElement).value })}
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="viewer">Viewer</option>
                  <option value="deployer">Deployer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <div class="flex items-center gap-3 mt-6">
              <button
                onClick={handleCreateToken}
                class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:from-green-600 hover:to-green-700 transition-all duration-200"
              >
                <Key class="w-4 h-4 mr-2" />
                Create Token
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setCreateTokenData({ name: '', plain: '', role: 'viewer' });
                  setError('');
                }}
                class="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Tokens List */}
        <div class="bg-white dark:bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50">
          <div class="p-6 border-b border-gray-200 dark:border-gray-700/50">
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">API Tokens</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Manage API tokens for programmatic access
            </p>
          </div>
          
          {loading ? (
            <div class="p-6 text-center">
              <div class="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-purple-500"></div>
              <p class="text-gray-600 dark:text-gray-400 mt-2">Loading tokens...</p>
            </div>
          ) : tokens.length === 0 ? (
            <div class="p-12 text-center">
              <Key class="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No API Tokens
              </h3>
              <p class="text-gray-600 dark:text-gray-400 mb-4">
                Create your first API token to enable programmatic access
              </p>
              <button
                onClick={() => setShowCreateForm(true)}
                class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-[#9c40ff] to-[#8b008b] text-white rounded-lg hover:from-[#8a39e6] hover:to-[#7a0078] transition-all duration-200"
              >
                <Plus class="w-4 h-4 mr-2" />
                Create First Token
              </button>
            </div>
          ) : (
            <div class="divide-y divide-gray-200 dark:divide-gray-700/50">
              {tokens.map((token) => (
                <div key={token.id} class="p-6">
                  <div class="flex items-center justify-between">
                    <div class="flex-1">
                      <div class="flex items-center gap-3 mb-2">
                        <h3 class="font-medium text-gray-900 dark:text-white">
                          {token.name}
                        </h3>
                        <span class={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(token.role)}`}>
                          {token.role}
                        </span>
                      </div>
                      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <div class="flex items-center gap-2">
                          <Calendar class="w-4 h-4" />
                          <span>Created: {formatDate(token.created_at)}</span>
                        </div>
                        <div class="flex items-center gap-2">
                          <Clock class="w-4 h-4" />
                          <span>Last used: {formatDate(token.last_used_at)}</span>
                        </div>
                        {token.expires_at && (
                          <div class="flex items-center gap-2">
                            <Calendar class="w-4 h-4" />
                            <span>Expires: {formatDate(token.expires_at)}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteToken(token.name)}
                      class="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Delete token"
                    >
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}