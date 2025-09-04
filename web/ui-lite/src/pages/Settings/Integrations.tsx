import { useState, useEffect } from "preact/hooks";
import { apiClient, useApiData } from "../../api";
import { Toast } from "../../components/ui";
import { Github, Key, Shield, ExternalLink, Server, Eye, RefreshCw, CheckCircle } from "lucide-preact";
import { isAdminSync } from "../../rbac";

interface GitHubOAuthConfig {
  mode: "off" | "pkce" | "confidential";
  client_id?: string;
  has_client_secret?: boolean;
}

interface GitHubAppConfig {
  installed: boolean;
  app_id?: string;
  has_private_key?: boolean;
  has_webhook_secret?: boolean;
}

interface IntegrationsConfig {
  github_oauth?: GitHubOAuthConfig;
  github_app?: GitHubAppConfig;
}

export function Integrations() {
  const [toastConfig, setToastConfig] = useState({
    show: false,
    message: "",
    type: "info" as "info" | "success" | "error",
  });
  const [saving, setSaving] = useState(false);
  const isAdmin = isAdminSync();

  // GitHub OAuth state
  const [oauthMode, setOauthMode] = useState<"off" | "pkce" | "confidential">(
    "off"
  );
  const [oauthClientId, setOauthClientId] = useState("");
  const [oauthClientSecret, setOauthClientSecret] = useState("");
  const [oauthHasSecret, setOauthHasSecret] = useState(false);

  // GitHub App state
  const [appId, setAppId] = useState("");
  const [appPrivateKey, setAppPrivateKey] = useState("");
  const [appHasPrivateKey, setAppHasPrivateKey] = useState(false);
  const [appWebhookSecret, setAppWebhookSecret] = useState("");
  const [appHasWebhookSecret, setAppHasWebhookSecret] = useState(false);
  const [appInstallUrl, setAppInstallUrl] = useState("");

  // Nginx state
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [nginxConfig, setNginxConfig] = useState("");
  const [nginxStatus, setNginxStatus] = useState<{
    enabled: boolean;
    last_apply_hash?: string;
    last_apply_time?: string;
  } | null>(null);

  // Data fetching
  const { data: config, refetch } = useApiData<IntegrationsConfig>(() =>
    apiClient.get("/settings/integrations")
  );

  const showToast = (
    message: string,
    type: "info" | "success" | "error" = "info"
  ) => {
    setToastConfig({ show: true, message, type });
  };

  // Load configuration when data changes
  useEffect(() => {
    if (config) {
      // Load GitHub OAuth config
      if (config.github_oauth) {
        setOauthMode(config.github_oauth.mode || "off");
        setOauthClientId(config.github_oauth.client_id || "");
        setOauthHasSecret(config.github_oauth.has_client_secret || false);
      }

      // Load GitHub App config
      if (config.github_app) {
        setAppId(config.github_app.app_id || "");
        setAppHasPrivateKey(config.github_app.has_private_key || false);
        setAppHasWebhookSecret(config.github_app.has_webhook_secret || false);
      }
    }
  }, [config]);

  // Fetch GitHub App install URL when app_id is set
  useEffect(() => {
    if (appId && isAdmin) {
      apiClient
        .get("/settings/github/install-url")
        .then((response: any) => {
          if (response.install_url) {
            setAppInstallUrl(response.install_url);
          }
        })
        .catch(() => {
          // Ignore errors for install URL
        });
    }
  }, [appId, isAdmin]);

  // Fetch Nginx status on component mount
  useEffect(() => {
    const fetchNginxStatus = async () => {
      try {
        const status = await apiClient.getNginxStatus();
        setNginxStatus(status);
      } catch (error) {
        console.error("Failed to fetch Nginx status:", error);
        setNginxStatus({ enabled: false });
      }
    };

    fetchNginxStatus();
  }, []);

  const handleSaveOAuth = async () => {
    if (!isAdmin) {
      showToast("Admin privileges required", "error");
      return;
    }

    // Validate inputs
    if (oauthMode !== "off" && !oauthClientId.trim()) {
      showToast("Client ID is required when OAuth is enabled", "error");
      return;
    }

    if (
      oauthMode === "confidential" &&
      !oauthClientSecret.trim() &&
      !oauthHasSecret
    ) {
      showToast("Client Secret is required for confidential mode", "error");
      return;
    }

    setSaving(true);

    try {
      const updateData: any = {
        github_oauth: {
          mode: oauthMode,
          client_id: oauthClientId.trim(),
        },
      };

      // Only include secret if provided
      if (oauthClientSecret.trim()) {
        updateData.github_oauth.client_secret = oauthClientSecret;
      }

      await apiClient.put("/settings/integrations", updateData);

      showToast("GitHub OAuth configuration saved successfully", "success");
      setOauthClientSecret(""); // Clear the secret input
      refetch(); // Refresh the config
    } catch (error: any) {
      showToast(error.message || "Failed to save OAuth configuration", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveApp = async () => {
    if (!isAdmin) {
      showToast("Admin privileges required", "error");
      return;
    }

    // Validate inputs
    if (!appId.trim()) {
      showToast("App ID is required", "error");
      return;
    }

    if (!/^\d+$/.test(appId.trim())) {
      showToast("App ID must be numeric", "error");
      return;
    }

    if (!appPrivateKey.trim() && !appHasPrivateKey) {
      showToast("Private Key PEM is required", "error");
      return;
    }

    if (!appWebhookSecret.trim() && !appHasWebhookSecret) {
      showToast("Webhook Secret is required", "error");
      return;
    }

    setSaving(true);

    try {
      const updateData: any = {
        github_app: {
          app_id: appId.trim(),
        },
      };

      // Only include private key if provided
      if (appPrivateKey.trim()) {
        updateData.github_app.private_key_pem = appPrivateKey;
      }

      // Only include webhook secret if provided
      if (appWebhookSecret.trim()) {
        updateData.github_app.webhook_secret = appWebhookSecret;
      }

      await apiClient.put("/settings/integrations", updateData);

      showToast("GitHub App configuration saved successfully", "success");
      setAppPrivateKey(""); // Clear the private key input
      setAppWebhookSecret(""); // Clear the webhook secret input
      refetch(); // Refresh the config
    } catch (error: any) {
      showToast(error.message || "Failed to save App configuration", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = (event: Event) => {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        setAppPrivateKey((e.target as FileReader).result as string);
      };
      reader.readAsText(file);
    }
  };

  // Nginx handlers
  const handleNginxValidate = async () => {
    if (!isAdmin) {
      showToast("Admin privileges required", "error");
      return;
    }

    try {
      const result = await apiClient.nginxValidate();
      showToast(
        result.valid ? "Nginx configuration is valid" : `Nginx validation failed: ${result.message}`,
        result.valid ? "success" : "error"
      );
    } catch (error: any) {
      showToast(error.message || "Failed to validate Nginx configuration", "error");
    }
  };

  const handleNginxReload = async () => {
    if (!isAdmin) {
      showToast("Admin privileges required", "error");
      return;
    }

    try {
      const result = await apiClient.nginxReload();
      showToast(result.message || "Nginx configuration reloaded successfully", "success");
      
      // Refresh status after reload
      const status = await apiClient.getNginxStatus();
      setNginxStatus(status);
    } catch (error: any) {
      showToast(error.message || "Failed to reload Nginx configuration", "error");
    }
  };

  const handleViewNginxConfig = async () => {
    if (!isAdmin) {
      showToast("Admin privileges required", "error");
      return;
    }

    try {
      const result = await apiClient.getNginxConfig();
      setNginxConfig(result.config);
      setShowConfigModal(true);
    } catch (error: any) {
      showToast(error.message || "Failed to fetch Nginx configuration", "error");
    }
  };

  return (
    <div class="p-3 sm:p-4 max-w-7xl mx-auto space-y-4 fade-in">
      {/* Compact Header */}
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-2xl font-bold mb-1">
            <span class="bg-gradient-to-r from-[#8b008b] via-[#9c40ff] to-[#e94057] bg-clip-text text-transparent">
              Integrations
            </span>
          </h1>
          <p class="text-gray-600 dark:text-gray-400 text-sm">
            Connect external services and platforms
          </p>
        </div>
      </div>

      {/* GitHub Integrations Banner */}
      <div class="bg-gradient-to-r from-[#2d3748] via-[#1a202c] to-[#2d3748] text-white rounded-lg p-4 mb-6 border border-gray-600/30">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-black rounded-lg flex items-center justify-center">
            <Github class="h-5 w-5 text-white" />
          </div>
          <div>
            <h3 class="font-semibold text-white">GitHub Integrations</h3>
            <p class="text-gray-300 text-sm">OAuth authentication and GitHub Apps • More integrations coming soon</p>
          </div>
        </div>
      </div>

      {/* Integration Cards Container */}
      <div class="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div class="p-4 space-y-6">
          {/* GitHub OAuth Card */}
          <div class="group bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-200 p-4">
          <div class="flex items-center gap-3 mb-4">
            <Github class="h-5 w-5 text-gray-700 dark:text-gray-300" />
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              GitHub OAuth Login
            </h2>
          </div>

          <p class="text-gray-600 dark:text-gray-400 mb-6">
            Enable GitHub OAuth for user authentication. PKCE mode is more
            secure and doesn't require a client secret.
          </p>

          <div class="space-y-4">
            {/* Mode selector */}
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Authentication Mode
              </label>
              <select
                value={oauthMode}
                onChange={(e) =>
                  setOauthMode((e.target as HTMLSelectElement).value as any)
                }
                disabled={!isAdmin}
                class="input"
              >
                <option value="off">Disabled</option>
                <option value="pkce">PKCE (No Secret Required)</option>
                <option value="confidential">Confidential (Uses Secret)</option>
              </select>
            </div>

            {/* Client ID */}
            {oauthMode !== "off" && (
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  GitHub OAuth Client ID
                </label>
                <input
                  type="text"
                  value={oauthClientId}
                  onChange={(e) =>
                    setOauthClientId((e.target as HTMLInputElement).value)
                  }
                  disabled={!isAdmin}
                  placeholder="Enter your GitHub OAuth Client ID"
                  class="input"
                />
              </div>
            )}

            {/* Client Secret */}
            {oauthMode === "confidential" && (
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  GitHub OAuth Client Secret
                </label>
                <div class="relative">
                  <input
                    type="password"
                    value={oauthClientSecret}
                    onChange={(e) =>
                      setOauthClientSecret((e.target as HTMLInputElement).value)
                    }
                    disabled={!isAdmin}
                    placeholder={
                      oauthHasSecret
                        ? "••••••••••••••••"
                        : "Enter your GitHub OAuth Client Secret"
                    }
                    class="input"
                  />
                  {oauthHasSecret && (
                    <div class="absolute right-3 top-2 text-green-500">
                      <Shield class="h-4 w-4" />
                    </div>
                  )}
                </div>
                {oauthHasSecret && (
                  <p class="text-sm text-green-600 dark:text-green-400 mt-1">
                    Secret is configured and encrypted. Leave empty to keep
                    existing secret.
                  </p>
                )}
              </div>
            )}

            {isAdmin && (
              <button
                onClick={handleSaveOAuth}
                disabled={saving}
                class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-[#9c40ff] to-[#8b008b] hover:from-[#8b008b] hover:to-[#9c40ff] text-white font-medium rounded-lg shadow-md transition-all duration-200 hover:scale-[1.02] text-sm disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save OAuth Configuration"}
              </button>
            )}
          </div>
          </div>

          {/* GitHub App Card */}
          <div class="group bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-200 p-4">
          <div class="flex items-center gap-3 mb-4">
            <Key class="h-5 w-5 text-gray-700 dark:text-gray-300" />
            <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
              GitHub App (Repository Access & Webhooks)
            </h2>
          </div>

          <p class="text-gray-600 dark:text-gray-400 mb-6">
            Configure GitHub App for secure repository access and CI/CD webhooks
            without Personal Access Tokens.
          </p>

          <div class="space-y-4">
            {/* App ID */}
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                GitHub App ID
              </label>
              <input
                type="text"
                value={appId}
                onChange={(e) => setAppId((e.target as HTMLInputElement).value)}
                disabled={!isAdmin}
                placeholder="Enter your GitHub App ID (numeric)"
                class="input"
              />
            </div>

            {/* Private Key */}
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                GitHub App Private Key (PEM Format)
              </label>
              <div class="space-y-2">
                <textarea
                  value={appPrivateKey}
                  onChange={(e) =>
                    setAppPrivateKey((e.target as HTMLTextAreaElement).value)
                  }
                  disabled={!isAdmin}
                  placeholder={
                    appHasPrivateKey
                      ? "Private key is configured and encrypted. Paste new key to rotate."
                      : "Paste your GitHub App private key (PEM format)"
                  }
                  rows={6}
                  class="input font-mono text-sm"
                />

                {isAdmin && (
                  <div class="flex items-center gap-2">
                    <input
                      type="file"
                      accept=".pem,.key,.txt"
                      onChange={handleFileUpload}
                      class="hidden"
                      id="private-key-upload"
                    />
                    <label
                      htmlFor="private-key-upload"
                      class="cursor-pointer text-blue-600 dark:text-blue-400 hover:underline text-sm"
                    >
                      Or upload PEM file
                    </label>
                    {appHasPrivateKey && (
                      <div class="flex items-center gap-1 text-green-600 dark:text-green-400 text-sm">
                        <Shield class="h-3 w-3" />
                        Key configured and encrypted
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Webhook Secret */}
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                GitHub App Webhook Secret
              </label>
              <div class="relative">
                <input
                  type="password"
                  value={appWebhookSecret}
                  onChange={(e) =>
                    setAppWebhookSecret((e.target as HTMLInputElement).value)
                  }
                  disabled={!isAdmin}
                  placeholder={
                    appHasWebhookSecret
                      ? "••••••••••••••••"
                      : "Enter your GitHub App webhook secret"
                  }
                  class="input"
                />
                {appHasWebhookSecret && (
                  <div class="absolute right-3 top-2 text-green-500">
                    <Shield class="h-4 w-4" />
                  </div>
                )}
              </div>
              {appHasWebhookSecret && (
                <p class="text-sm text-green-600 dark:text-green-400 mt-1">
                  Webhook secret is configured and encrypted. Leave empty to
                  keep existing secret.
                </p>
              )}
            </div>

            {isAdmin && (
              <div class="flex items-center gap-4">
                <button
                  onClick={handleSaveApp}
                  disabled={saving}
                  class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-[#9c40ff] to-[#8b008b] hover:from-[#8b008b] hover:to-[#9c40ff] text-white font-medium rounded-lg shadow-md transition-all duration-200 hover:scale-[1.02] text-sm disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save App Configuration"}
                </button>

                {appInstallUrl && (
                  <a
                    href={appInstallUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <ExternalLink class="h-4 w-4" />
                    Install App on GitHub
                  </a>
                )}
              </div>
            )}
          </div>
          </div>

          {/* Nginx Reverse Proxy Card */}
          <div class="group bg-gray-50 dark:bg-gray-700/50 rounded-lg border-2 border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-all duration-200 p-4">
            <div class="flex items-center gap-3 mb-4">
              <Server class="h-5 w-5 text-gray-700 dark:text-gray-300" />
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white">
                Reverse Proxy (Nginx)
              </h2>
            </div>

            <p class="text-gray-600 dark:text-gray-400 mb-6">
              Manage Nginx reverse proxy configuration for load balancing and SSL termination.
            </p>

            {/* Status Display */}
            <div class="mb-6 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
              <div class="flex items-center justify-between mb-3">
                <span class="text-sm font-medium text-gray-700 dark:text-gray-300">Status</span>
                <div class="flex items-center gap-2">
                  <div class={`w-2 h-2 rounded-full ${nginxStatus?.enabled ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                  <span class={`text-sm font-medium ${nginxStatus?.enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                    {nginxStatus?.enabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>
              
              {nginxStatus?.enabled && (
                <>
                  {nginxStatus.last_apply_hash && (
                    <div class="flex items-center justify-between py-1">
                      <span class="text-xs text-gray-600 dark:text-gray-400">Last Apply Hash</span>
                      <code class="text-xs font-mono text-gray-800 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                        {nginxStatus.last_apply_hash.substring(0, 8)}...
                      </code>
                    </div>
                  )}
                  {nginxStatus.last_apply_time && (
                    <div class="flex items-center justify-between py-1">
                      <span class="text-xs text-gray-600 dark:text-gray-400">Last Applied</span>
                      <span class="text-xs text-gray-800 dark:text-gray-200">
                        {new Date(nginxStatus.last_apply_time).toLocaleString()}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Action Buttons */}
            <div class="flex gap-3 flex-wrap">
              <button
                onClick={handleNginxValidate}
                disabled={!isAdmin || !nginxStatus?.enabled}
                class={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  nginxStatus?.enabled && isAdmin
                    ? 'bg-blue-500 hover:bg-blue-600 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle class="w-4 h-4 mr-2" />
                Validate
              </button>
              
              <button
                onClick={handleNginxReload}
                disabled={!isAdmin || !nginxStatus?.enabled}
                class={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  nginxStatus?.enabled && isAdmin
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
              >
                <RefreshCw class="w-4 h-4 mr-2" />
                Reload
              </button>
              
              <button
                onClick={handleViewNginxConfig}
                disabled={!isAdmin || !nginxStatus?.enabled}
                class={`inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  nginxStatus?.enabled && isAdmin
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                }`}
              >
                <Eye class="w-4 h-4 mr-2" />
                View Active Config
              </button>
            </div>

            {!nginxStatus?.enabled && (
              <div class="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-600 rounded-lg">
                <p class="text-yellow-700 dark:text-yellow-300 text-sm">
                  <strong>Nginx proxy is disabled.</strong> Enable it in system settings to use these controls.
                </p>
              </div>
            )}
          </div>

          {!isAdmin && (
          <div class="border border-amber-200 dark:border-amber-600 rounded-lg p-4 bg-amber-50 dark:bg-amber-900/20">
            <p class="text-amber-700 dark:text-amber-300">
              <strong>Admin privileges required</strong> to modify integration
              settings. Contact your administrator to configure GitHub
              integrations.
            </p>
          </div>
          )}
        </div>
      </div>

      {/* Nginx Config Modal */}
      {showConfigModal && (
        <div class="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-4xl max-h-[80vh] overflow-hidden">
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Server class="w-5 h-5 mr-2 text-gray-600 dark:text-gray-400" />
                Active Nginx Configuration
              </h3>
              <button
                onClick={() => setShowConfigModal(false)}
                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div class="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 overflow-auto max-h-96">
              <pre class="text-sm text-gray-800 dark:text-gray-200 font-mono whitespace-pre-wrap">
                {nginxConfig}
              </pre>
            </div>

            <div class="flex justify-end mt-6">
              <button
                onClick={() => setShowConfigModal(false)}
                class="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast
        message={toastConfig.message}
        type={toastConfig.type}
        isVisible={toastConfig.show}
        onClose={() => setToastConfig({ ...toastConfig, show: false })}
      />
    </div>
  );
}
