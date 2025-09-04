interface NetworkingTabProps {
  network: any;
  links: any[];
  aliases?: string[];
  editingAlias: boolean;
  setEditingAlias: (value: boolean) => void;
  newAlias: string;
  setNewAlias: (value: string) => void;
  connectivityTest: {
    loading: boolean;
    target: string;
    result?: string;
  };
  setConnectivityTest: (value: any) => void;
  showLinksGuide: boolean;
  setShowLinksGuide: (value: boolean) => void;
  canDeploy: boolean;
  runNetworkDiagnostics: () => void;
  fetchNetworking: () => void;
  handleAliasEdit: (alias: string) => void;
  testConnectivity: (target: string) => void;
  copyToClipboard: (text: string, label: string) => void;
  setNetwork: (value: any) => void;
  setError: (value: any) => void;
}

export function NetworkingTab({
  network,
  links,
  aliases = [],
  editingAlias,
  setEditingAlias,
  newAlias,
  setNewAlias,
  connectivityTest,
  setConnectivityTest,
  showLinksGuide,
  setShowLinksGuide,
  canDeploy,
  runNetworkDiagnostics,
  fetchNetworking,
  handleAliasEdit,
  testConnectivity,
  copyToClipboard,
  setNetwork,
  setError,
}: NetworkingTabProps) {
  return (
    <div class="p-6">
      {!network ? (
        <div class="flex items-center justify-center py-12">
          <div class="text-center">
            <div class="w-8 h-8 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p class="text-gray-600 dark:text-gray-400">
              Loading networking information...
            </p>
          </div>
        </div>
      ) : network ? (
        <div class="space-y-6">
          {/* Network Overview Card */}
          <div class="bg-gradient-to-r from-blue-50/90 via-indigo-50/80 to-purple-50/90 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/20 rounded-2xl shadow-lg border border-blue-200/50 dark:border-blue-700/50 p-6">
            <div class="flex items-center justify-between mb-6">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <svg
                  class="w-5 h-5 mr-2 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
                  />
                </svg>
                Network Overview
              </h3>
              <div class="flex items-center gap-2">
                <button
                  onClick={runNetworkDiagnostics}
                  class="px-3 py-1.5 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-800/50 rounded-lg transition-colors flex items-center"
                >
                  <svg
                    class="w-4 h-4 mr-1.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                  Diagnostics
                </button>
                <button
                  onClick={fetchNetworking}
                  class="px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center"
                >
                  <svg
                    class="w-4 h-4 mr-1.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>

            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* External Hosts Section */}
              {network.external_hosts && network.external_hosts.length > 0 && (
                <div class="space-y-3">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    External Hosts
                  </label>
                  <div class="space-y-2">
                    {network.external_hosts.map((host, idx) => (
                      <div key={idx} class="flex items-center justify-between p-3 bg-white/80 dark:bg-gray-700/80 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div class="flex items-center gap-2">
                          <code class="text-sm font-mono text-gray-900 dark:text-white truncate">
                            {host}
                          </code>
                          <span class="text-xs text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded">
                            Public
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            copyToClipboard(host, "External host")
                          }
                          class="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                          title="Copy external host"
                        >
                          <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Internal DNS Section */}
              {network.internal_dns && (
                <div class="space-y-3">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Internal DNS
                  </label>
                  <div class="flex items-center justify-between p-3 bg-white/80 dark:bg-gray-700/80 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div class="flex items-center gap-2">
                      <code class="text-sm font-mono text-gray-900 dark:text-white">
                        {network.internal_dns}
                      </code>
                      <span class="text-xs text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded">
                        Internal
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        copyToClipboard(network.internal_dns, "Internal DNS")
                      }
                      class="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                      title="Copy internal DNS"
                    >
                      <svg
                        class="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Service Aliases Section */}
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Service Aliases
                  </label>
                  {canDeploy && (
                    <button
                      onClick={() => {
                        setEditingAlias(!editingAlias);
                        if (!editingAlias) setNewAlias(network.aliases?.[0] || network.alias);
                      }}
                      class="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      {editingAlias ? "Cancel" : "Edit"}
                    </button>
                  )}
                </div>

                {editingAlias && canDeploy ? (
                  <div class="space-y-2">
                    <input
                      type="text"
                      value={newAlias}
                      onChange={(e) =>
                        setNewAlias((e.target as HTMLInputElement).value)
                      }
                      class="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter new service alias"
                    />
                    <div class="flex items-center gap-2">
                      <button
                        onClick={() => handleAliasEdit(newAlias)}
                        disabled={
                          !newAlias.trim() || newAlias === (network.aliases?.[0] || network.alias)
                        }
                        class="px-2 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded"
                      >
                        Save
                      </button>
                      <span class="text-xs text-amber-600 dark:text-amber-400 flex items-center">
                        <svg
                          class="w-3 h-3 mr-1"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        Requires restart
                      </span>
                    </div>
                  </div>
                ) : (
                  <div class="space-y-2">
                    {(aliases && aliases.length > 0) || (network.aliases && network.aliases.length > 0) ? (
                      (aliases && aliases.length > 0 ? aliases : network.aliases).map((alias, idx) => (
                        <div key={idx} class="flex items-center justify-between p-3 bg-white/80 dark:bg-gray-700/80 rounded-lg border border-gray-200 dark:border-gray-600">
                          <div class="flex items-center gap-2">
                            <code class="text-sm font-mono text-gray-900 dark:text-white">
                              {alias}
                            </code>
                            {idx === 0 && (
                              <span class="text-xs text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30 px-2 py-0.5 rounded">
                                Short
                              </span>
                            )}
                            {alias.includes('.local') && (
                              <span class="text-xs text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30 px-2 py-0.5 rounded">
                                Full
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              copyToClipboard(alias, "Service alias")
                            }
                            class="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                            title="Copy alias"
                          >
                            <svg
                              class="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                              />
                            </svg>
                          </button>
                        </div>
                      ))
                    ) : (
                      <div class="flex items-center justify-between p-3 bg-white/80 dark:bg-gray-700/80 rounded-lg border border-gray-200 dark:border-gray-600">
                        <code class="text-sm font-mono text-gray-900 dark:text-white">
                          {network.alias}
                        </code>
                        <button
                          onClick={() =>
                            copyToClipboard(network.alias, "Service alias")
                          }
                          class="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                          title="Copy alias"
                        >
                          <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

            </div>

            {/* Network Details - Full Width */}
            <div class="space-y-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Network Details
              </label>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="flex justify-between text-sm">
                  <span class="text-gray-600 dark:text-gray-400">
                    Project Network:
                  </span>
                  <code class="text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
                    {network.project_network || network.network}
                  </code>
                </div>
                {network.ports_internal &&
                  network.ports_internal.length > 0 && (
                    <div class="flex justify-between text-sm">
                      <span class="text-gray-600 dark:text-gray-400">
                        Internal Ports:
                      </span>
                      <div class="flex gap-1">
                        {network.ports_internal.map((port, idx) => (
                          <code
                            key={idx}
                            class="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded"
                          >
                            {port.container}/{port.protocol}
                          </code>
                        ))}
                      </div>
                    </div>
                  )}
              </div>
            </div>
          </div>

          {/* Connection Examples & Testing */}
          <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Connection Examples */}
            <div class="bg-gradient-to-r from-white/95 via-gray-50/90 to-white/95 dark:from-gray-800/95 dark:via-gray-900/90 dark:to-gray-800/95 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-6">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <svg
                  class="w-5 h-5 mr-2 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                Connection Examples
              </h3>

              {network.ports_internal &&
                network.ports_internal.length > 0 && (
                  <div class="space-y-4">
                    <div class="space-y-2">
                      <div class="text-xs text-gray-600 dark:text-gray-400 font-medium">
                        DNS Address:
                      </div>
                      <div class="flex items-center justify-between p-3 bg-gray-900 dark:bg-gray-950 rounded-lg border">
                        <code class="text-sm font-mono text-green-400 flex-1">
                          {network.dns_hint}
                        </code>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              network.dns_hint,
                              "DNS address"
                            )
                          }
                          class="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-800 dark:hover:bg-gray-700 rounded transition-colors"
                          title="Copy DNS address"
                        >
                          <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div class="space-y-2">
                      <div class="text-xs text-gray-600 dark:text-gray-400 font-medium">
                        Test Command:
                      </div>
                      <div class="flex items-center justify-between p-3 bg-gray-900 dark:bg-gray-950 rounded-lg border">
                        <code class="text-sm font-mono text-green-400 flex-1 break-all">
                          {network.curl_hint}
                        </code>
                        <button
                          onClick={() =>
                            copyToClipboard(
                              network.curl_hint,
                              "Test command"
                            )
                          }
                          class="p-1.5 text-gray-400 hover:text-green-400 hover:bg-gray-800 dark:hover:bg-gray-700 rounded transition-colors ml-2"
                          title="Copy curl command"
                        >
                          <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
            </div>

            {/* Connectivity Testing */}
            <div class="bg-gradient-to-r from-white/95 via-gray-50/90 to-white/95 dark:from-gray-800/95 dark:via-gray-900/90 dark:to-gray-800/95 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-6">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <svg
                  class="w-5 h-5 mr-2 text-orange-600 dark:text-orange-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                Connectivity Test
              </h3>

              <div class="space-y-4">
                <div class="flex gap-2">
                  <input
                    type="text"
                    value={connectivityTest.target}
                    onChange={(e) =>
                      setConnectivityTest((prev) => ({
                        ...prev,
                        target: (e.target as HTMLInputElement).value,
                      }))
                    }
                    placeholder="service-alias or hostname"
                    class="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                    disabled={connectivityTest.loading}
                  />
                  <button
                    onClick={() =>
                      testConnectivity(connectivityTest.target)
                    }
                    disabled={
                      connectivityTest.loading ||
                      !connectivityTest.target.trim()
                    }
                    class="px-4 py-2 text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center"
                  >
                    {connectivityTest.loading ? (
                      <svg
                        class="w-4 h-4 animate-spin"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                      </svg>
                    ) : (
                      "Test"
                    )}
                  </button>
                </div>

                {connectivityTest.result && (
                  <div
                    class={`p-3 rounded-lg text-sm ${
                      connectivityTest.result.includes("✅")
                        ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800"
                        : "bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800"
                    }`}
                  >
                    {connectivityTest.result}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Service Links Management */}
          <div class="bg-gradient-to-r from-white/95 via-gray-50/90 to-white/95 dark:from-gray-800/95 dark:via-gray-900/90 dark:to-gray-800/95 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-6">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <svg
                  class="w-5 h-5 mr-2 text-purple-600 dark:text-purple-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                Service Links ({links.length})
              </h3>
              <button
                onClick={() => setShowLinksGuide(true)}
                class="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 flex items-center"
              >
                <svg
                  class="w-3 h-3 mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                How to Connect?
              </button>
            </div>

            {links.length === 0 ? (
              <div class="text-center py-8">
                <div class="mb-4">
                  <svg
                    class="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                    />
                  </svg>
                </div>
                <h4 class="text-base font-medium text-gray-700 dark:text-gray-300 mb-2">
                  No Service Links Configured
                </h4>
                <p class="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-md mx-auto">
                  Service links allow this container to communicate with
                  other services using simple aliases instead of IP
                  addresses.
                </p>
                <div class="space-y-2 text-xs text-gray-400 dark:text-gray-500">
                  <p>
                    • Links create DNS entries for easy service discovery
                  </p>
                  <p>
                    • Services can talk to each other using their alias
                    names
                  </p>
                  <p>• No need to remember IP addresses or ports</p>
                </div>
                <button
                  onClick={() => setShowLinksGuide(true)}
                  class="mt-4 px-4 py-2 text-sm text-purple-600 dark:text-purple-400 border border-purple-300 dark:border-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                >
                  Learn How to Connect Services
                </button>
              </div>
            ) : (
              <div class="space-y-4">
                <div class="text-xs text-gray-500 dark:text-gray-400 bg-purple-50/50 dark:bg-purple-900/20 p-3 rounded-lg">
                  <strong class="text-gray-700 dark:text-gray-300">
                    Connected Services:
                  </strong>{" "}
                  This service can communicate with the following services
                  using their aliases.
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {links.map((link) => (
                    <div
                      key={link.id}
                      class="flex items-center justify-between p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg"
                    >
                      <div class="flex-1">
                        <div class="flex items-center mb-2">
                          <svg
                            class="w-4 h-4 text-purple-600 dark:text-purple-400 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M5 12l5 5L20 7"
                            />
                          </svg>
                          <span class="text-sm font-medium text-gray-900 dark:text-white">
                            {link.name}
                          </span>
                        </div>
                        <div class="text-xs text-gray-500 dark:text-gray-400 mb-1">
                          Access via:{" "}
                          <code class="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono">
                            {link.alias}
                          </code>
                        </div>
                        <div class="text-xs text-purple-600 dark:text-purple-400">
                          Example:{" "}
                          <code class="bg-purple-100 dark:bg-purple-900/30 px-1 rounded">
                            curl http://{link.alias}/
                          </code>
                        </div>
                      </div>
                      <button
                        onClick={() => testConnectivity(link.alias)}
                        class="p-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-800/50 rounded-lg transition-colors"
                        title="Test connectivity"
                      >
                        <svg
                          class="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                          />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div class="text-center py-12">
          <div class="text-gray-500 text-xl mb-4">
            🔌 Network Information Unavailable
          </div>
          <p class="text-gray-600 dark:text-gray-400 mb-6">
            Unable to load networking information for this service.
          </p>
          <button
            onClick={() => {
              setNetwork(null);
              setError(null);
              fetchNetworking();
            }}
            class="px-4 py-2 text-sm font-medium text-[#9c40ff] hover:text-[#8b2bff] border border-[#9c40ff] hover:border-[#8b2bff] rounded-lg transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}