import { useState, useEffect } from "preact/hooks";
import { apiClient, Route, Certificate, ServiceDetail, useApiData } from "../../api";
import { Modal } from "../../components/ui/Modal";
import { Toast } from "../../components/ui/Toast";
import { CodeBlock } from "../../components/ui/CodeBlock";
import { 
  ChevronLeft, 
  Save, 
  Eye, 
  Globe, 
  Path, 
  Zap, 
  Shield, 
  Settings,
  Lock,
  FileText,
  AlertTriangle
} from "lucide-preact";

interface RouteEditProps {
  routeId: string;
}

export function RouteEdit({ routeId }: RouteEditProps) {
  const [routeData, setRouteData] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewConfig, setPreviewConfig] = useState("");
  const [toast, setToast] = useState<{message: string, type: "success" | "error" | "info"} | null>(null);
  
  // Form fields
  const [domain, setDomain] = useState("");
  const [path, setPath] = useState("");
  const [port, setPort] = useState(80);
  const [tls, setTls] = useState(false);
  const [proxyConfig, setProxyConfig] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<number>(0);
  
  // Data fetching
  const { data: certificates } = useApiData<Certificate[]>(() => apiClient.listCertificates(), []);
  const { data: services } = useApiData<ServiceDetail[]>(() => apiClient.listServices(), []);
  
  useEffect(() => {
    loadRoute();
  }, [routeId]);

  const loadRoute = async () => {
    try {
      setLoading(true);
      const routes = await apiClient.listRoutes();
      const foundRoute = routes.find(r => r.id.toString() === routeId);
      
      if (!foundRoute) {
        showToast("Route not found", "error");
        window.history.pushState({}, '', '/app/routes');
        return;
      }

      setRouteData(foundRoute);
      setDomain(foundRoute.domain);
      setPath(foundRoute.path || "");
      setPort(foundRoute.port);
      setTls(foundRoute.tls);
      setProxyConfig(foundRoute.proxy_config || "");
      setSelectedServiceId(foundRoute.service_id);
    } catch (error) {
      console.error("Failed to load route:", error);
      showToast("Failed to load route", "error");
    } finally {
      setLoading(false);
    }
  };

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const validateForm = () => {
    if (!domain.trim()) {
      showToast("Domain is required", "error");
      return false;
    }
    
    if (!selectedServiceId) {
      showToast("Service is required", "error");
      return false;
    }
    
    if (port < 1 || port > 65535) {
      showToast("Port must be between 1 and 65535", "error");
      return false;
    }

    // Basic domain validation
    const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*\..*$/;
    if (!domainPattern.test(domain)) {
      showToast("Please enter a valid domain name", "error");
      return false;
    }

    // Path validation (if provided)
    if (path && !path.startsWith("/")) {
      showToast("Path must start with /", "error");
      return false;
    }

    // JSON validation for proxy_config
    if (proxyConfig.trim()) {
      try {
        JSON.parse(proxyConfig);
      } catch {
        showToast("Proxy config must be valid JSON", "error");
        return false;
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      await apiClient.updateRoute(routeId, {
        domain: domain.trim(),
        path: path.trim() || undefined,
        port,
        tls,
        proxy_config: proxyConfig.trim() || undefined,
      });

      showToast("Route updated successfully", "success");
      
      // Refresh route data
      await loadRoute();
    } catch (error) {
      console.error("Failed to update route:", error);
      showToast(
        `Failed to update route: ${error instanceof Error ? error.message : "Unknown error"}`,
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!validateForm()) return;

    setPreviewing(true);
    try {
      const { config } = await apiClient.previewRouteNginxConfig(routeId);
      setPreviewConfig(config);
      setShowPreview(true);
    } catch (error) {
      console.error("Failed to preview nginx config:", error);
      showToast("Failed to generate nginx preview", "error");
    } finally {
      setPreviewing(false);
    }
  };

  const selectedService = services?.find(s => s.id === selectedServiceId);
  const selectedServicePorts = selectedService?.config?.ports || [];
  const availableCerts = certificates?.filter(cert => cert.domain === domain) || [];

  if (loading) {
    return (
      <div class="flex items-center justify-center py-12">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!routeData) {
    return (
      <div class="text-center py-12">
        <AlertTriangle class="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-2">Route not found</h3>
        <p class="text-gray-600 dark:text-gray-400">The route you're looking for doesn't exist.</p>
      </div>
    );
  }

  return (
    <div class="space-y-6">
      {/* Header */}
      <div class="flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <button
            onClick={() => window.history.pushState({}, '', '/app/routes')}
            class="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <ChevronLeft class="h-4 w-4 mr-1" />
            Back to Routes
          </button>
          <h1 class="text-2xl font-semibold text-gray-900 dark:text-white">
            Edit Route
          </h1>
        </div>

        <div class="flex space-x-3">
          <button
            onClick={handlePreview}
            disabled={previewing}
            class="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <Eye class="h-4 w-4 mr-2" />
            {previewing ? "Generating..." : "Preview Nginx"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <Save class="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div class="lg:col-span-2 space-y-6">
          {/* Basic Settings */}
          <div class="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-lg border border-blue-200/50 dark:border-blue-700/50 p-6">
            <div class="flex items-center mb-4">
              <Globe class="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Basic Settings
              </h3>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Domain *
                </label>
                <input
                  type="text"
                  value={domain}
                  onInput={(e) => setDomain((e.target as HTMLInputElement).value)}
                  placeholder="example.com"
                  class="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                />
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Path (optional)
                </label>
                <input
                  type="text"
                  value={path}
                  onInput={(e) => setPath((e.target as HTMLInputElement).value)}
                  placeholder="/api"
                  class="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Service & Port Settings */}
          <div class="bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-900/10 dark:to-emerald-900/10 rounded-lg border border-green-200/50 dark:border-green-700/50 p-6">
            <div class="flex items-center mb-4">
              <Zap class="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Target Service
              </h3>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Service *
                </label>
                <select
                  value={selectedServiceId}
                  onChange={(e) => setSelectedServiceId(parseInt((e.target as HTMLSelectElement).value))}
                  class="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                >
                  <option value={0}>Select a service</option>
                  {services?.map(service => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Internal Port *
                </label>
                <select
                  value={port}
                  onChange={(e) => setPort(parseInt((e.target as HTMLSelectElement).value))}
                  class="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white"
                >
                  {selectedServicePorts.length > 0 ? (
                    selectedServicePorts.map(portConfig => (
                      <option key={portConfig.internal} value={portConfig.internal}>
                        {portConfig.internal} ({portConfig.protocol || 'tcp'})
                      </option>
                    ))
                  ) : (
                    <option value={port}>{port}</option>
                  )}
                </select>
              </div>
            </div>

            {selectedService && (
              <div class="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                <p class="text-sm text-gray-600 dark:text-gray-400">
                  <span class="font-medium">Selected:</span> {selectedService.name} 
                  <span class="mx-2">•</span>
                  <span class="font-mono">{selectedService.image}</span>
                </p>
              </div>
            )}
          </div>

          {/* TLS & Security */}
          <div class="bg-gradient-to-r from-purple-50/50 to-pink-50/50 dark:from-purple-900/10 dark:to-pink-900/10 rounded-lg border border-purple-200/50 dark:border-purple-700/50 p-6">
            <div class="flex items-center mb-4">
              <Shield class="w-5 h-5 text-purple-600 dark:text-purple-400 mr-2" />
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                TLS & Security
              </h3>
            </div>

            <div class="space-y-4">
              <div class="flex items-center">
                <input
                  id="tls-enabled"
                  type="checkbox"
                  checked={tls}
                  onChange={(e) => setTls((e.target as HTMLInputElement).checked)}
                  class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="tls-enabled" class="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  <Lock class="w-4 h-4 inline mr-1" />
                  Enable HTTPS/TLS
                </label>
              </div>

              {tls && (
                <div>
                  <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Available Certificates for {domain}
                  </label>
                  {availableCerts.length > 0 ? (
                    <div class="space-y-2">
                      {availableCerts.map(cert => (
                        <div key={cert.id} class="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
                          <div class="flex items-center justify-between">
                            <div>
                              <span class="text-sm font-medium text-green-800 dark:text-green-300">
                                {cert.type.charAt(0).toUpperCase() + cert.type.slice(1)} Certificate
                              </span>
                              {cert.expires_at && (
                                <span class="ml-2 text-xs text-green-600 dark:text-green-400">
                                  Expires: {new Date(cert.expires_at).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <div class="flex items-center space-x-1">
                              {cert.has_cert && <span class="px-2 py-1 text-xs bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 rounded">Cert</span>}
                              {cert.has_key && <span class="px-2 py-1 text-xs bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 rounded">Key</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div class="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                      <p class="text-sm text-amber-800 dark:text-amber-300">
                        No certificates found for domain "{domain}". 
                        <a href="/app/certificates" class="underline hover:no-underline ml-1">
                          Upload a certificate
                        </a>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Advanced Configuration */}
          <div class="bg-gradient-to-r from-gray-50/50 to-slate-50/50 dark:from-gray-900/10 dark:to-slate-900/10 rounded-lg border border-gray-200/50 dark:border-gray-700/50 p-6">
            <div class="flex items-center mb-4">
              <Settings class="w-5 h-5 text-gray-600 dark:text-gray-400 mr-2" />
              <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
                Advanced Configuration
              </h3>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Proxy Configuration (JSON)
              </label>
              <textarea
                value={proxyConfig}
                onInput={(e) => setProxyConfig((e.target as HTMLTextAreaElement).value)}
                placeholder='{"proxy_read_timeout": "60s", "client_max_body_size": "10m"}'
                rows={4}
                class="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-white font-mono text-sm"
              />
              <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Optional nginx proxy configuration as JSON. Leave empty for defaults.
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div class="space-y-6">
          {/* Route Info */}
          <div class="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Route Information</h3>
            <div class="space-y-3 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">ID:</span>
                <span class="font-mono text-gray-900 dark:text-white">{routeData.id}</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Created:</span>
                <span class="text-gray-900 dark:text-white">
                  {new Date(routeData.created_at).toLocaleDateString()}
                </span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-600 dark:text-gray-400">Updated:</span>
                <span class="text-gray-900 dark:text-white">
                  {new Date(routeData.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* DNS Hints */}
          <div class="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-6">
            <h3 class="text-lg font-medium text-blue-900 dark:text-blue-300 mb-4">
              <FileText class="w-5 h-5 inline mr-2" />
              DNS Configuration
            </h3>
            <div class="space-y-3 text-sm">
              <div>
                <span class="block text-blue-700 dark:text-blue-400 font-medium mb-1">External DNS:</span>
                <code class="block p-2 bg-blue-100 dark:bg-blue-900/40 rounded text-blue-800 dark:text-blue-200 font-mono text-xs">
                  {domain} IN A your.server.ip
                </code>
              </div>
              <div>
                <span class="block text-blue-700 dark:text-blue-400 font-medium mb-1">Internal Access:</span>
                <code class="block p-2 bg-blue-100 dark:bg-blue-900/40 rounded text-blue-800 dark:text-blue-200 font-mono text-xs">
                  {selectedService?.name}:{port}
                </code>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Nginx Config Preview Modal */}
      <Modal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="Nginx Configuration Preview"
        size="large"
      >
        <div class="space-y-4">
          <p class="text-sm text-gray-600 dark:text-gray-400">
            This is how the nginx configuration will look after saving your changes:
          </p>
          <CodeBlock code={previewConfig} language="nginx" />
        </div>
      </Modal>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}