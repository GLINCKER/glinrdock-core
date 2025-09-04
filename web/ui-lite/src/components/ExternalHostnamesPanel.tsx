import { useState, useEffect } from "preact/hooks";
import { apiClient, Route, useApiData } from "../api";
import { 
  Globe, 
  ExternalLink, 
  Copy, 
  Shield, 
  AlertCircle,
  CheckCircle,
  MapPin,
  FileText
} from "lucide-preact";

interface ExternalHostnamesPanelProps {
  serviceId: number;
  serviceName: string;
  servicePort?: number;
}

export function ExternalHostnamesPanel({ 
  serviceId, 
  serviceName, 
  servicePort = 80 
}: ExternalHostnamesPanelProps) {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  useEffect(() => {
    loadServiceRoutes();
  }, [serviceId]);

  const loadServiceRoutes = async () => {
    try {
      setLoading(true);
      const serviceRoutes = await apiClient.listServiceRoutes(serviceId.toString());
      setRoutes(serviceRoutes);
    } catch (err) {
      console.error("Failed to load service routes:", err);
      setError("Failed to load routes");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedUrl(text);
      setTimeout(() => setCopiedUrl(null), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const formatUrl = (route: Route) => {
    const protocol = route.tls ? 'https' : 'http';
    const path = route.path || '';
    return `${protocol}://${route.domain}${path}`;
  };

  const generateInternalUrl = () => {
    return `http://${serviceName}:${servicePort}`;
  };

  const generateDnsHint = () => {
    if (routes.length === 0) return null;
    
    const exampleRoute = routes[0];
    return {
      external: `${exampleRoute.domain} IN A your.server.ip`,
      internal: generateInternalUrl()
    };
  };

  if (loading) {
    return (
      <div class="bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-900/10 dark:to-emerald-900/10 rounded-lg border border-green-200/50 dark:border-green-700/50 p-6">
        <div class="flex items-center mb-4">
          <Globe class="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            External Hostnames
          </h3>
        </div>
        <div class="flex items-center justify-center py-8">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-green-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div class="bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-900/10 dark:to-emerald-900/10 rounded-lg border border-green-200/50 dark:border-green-700/50 p-6">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center">
          <Globe class="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
          <h3 class="text-lg font-semibold text-gray-900 dark:text-white">
            External Hostnames
          </h3>
        </div>
        {routes.length > 0 && (
          <span class="px-2 py-1 text-xs bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 rounded-full">
            {routes.length} route{routes.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {error && (
        <div class="flex items-center p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg mb-4">
          <AlertCircle class="w-4 h-4 text-red-600 dark:text-red-400 mr-2" />
          <span class="text-sm text-red-700 dark:text-red-300">{error}</span>
        </div>
      )}

      {routes.length === 0 ? (
        <div class="text-center py-6">
          <MapPin class="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
            No external routes configured for this service
          </p>
          <p class="text-xs text-gray-500 dark:text-gray-500">
            Create a route to expose this service externally
          </p>
        </div>
      ) : (
        <div class="space-y-4">
          {/* External Routes */}
          <div class="space-y-2">
            {routes.map((route) => {
              const url = formatUrl(route);
              const isHttps = route.tls;
              
              return (
                <div 
                  key={route.id}
                  class="flex items-center justify-between p-3 bg-white/80 dark:bg-gray-800/80 rounded-lg border border-gray-200/50 dark:border-gray-600/50"
                >
                  <div class="flex items-center space-x-3 flex-1">
                    <div class="flex items-center space-x-1">
                      {isHttps ? (
                        <Shield class="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <Globe class="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      )}
                      <span class={`text-xs px-2 py-1 rounded ${
                        isHttps 
                          ? 'bg-green-100 dark:bg-green-800/50 text-green-700 dark:text-green-300'
                          : 'bg-blue-100 dark:bg-blue-800/50 text-blue-700 dark:text-blue-300'
                      }`}>
                        {isHttps ? 'HTTPS' : 'HTTP'}
                      </span>
                    </div>
                    
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center space-x-2">
                        <button
                          onClick={() => window.open(url, '_blank')}
                          class="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 truncate flex items-center space-x-1 group"
                        >
                          <span class="truncate">{url}</span>
                          <ExternalLink class="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      </div>
                      {route.path && (
                        <p class="text-xs text-gray-500 dark:text-gray-400">
                          Path: {route.path}
                        </p>
                      )}
                    </div>
                  </div>

                  <div class="flex items-center space-x-2">
                    <span class="text-xs text-gray-500 dark:text-gray-400">
                      :{route.port}
                    </span>
                    <button
                      onClick={() => copyToClipboard(url)}
                      class="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                      title="Copy URL"
                    >
                      {copiedUrl === url ? (
                        <CheckCircle class="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy class="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* DNS Configuration Hints */}
          {generateDnsHint() && (
            <div class="border-t border-green-200 dark:border-green-700 pt-4">
              <div class="flex items-center mb-3">
                <FileText class="w-4 h-4 text-green-600 dark:text-green-400 mr-2" />
                <h4 class="text-sm font-medium text-green-800 dark:text-green-300">
                  DNS Configuration
                </h4>
              </div>
              <div class="space-y-3 text-xs">
                <div>
                  <span class="block text-green-700 dark:text-green-400 font-medium mb-1">
                    External DNS Record:
                  </span>
                  <div class="flex items-center space-x-2">
                    <code class="flex-1 p-2 bg-green-100 dark:bg-green-900/40 rounded text-green-800 dark:text-green-200 font-mono">
                      {generateDnsHint()!.external}
                    </code>
                    <button
                      onClick={() => copyToClipboard(generateDnsHint()!.external)}
                      class="p-1.5 text-green-600 hover:text-green-800 dark:hover:text-green-400 transition-colors"
                    >
                      <Copy class="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div>
                  <span class="block text-green-700 dark:text-green-400 font-medium mb-1">
                    Internal Service URL:
                  </span>
                  <div class="flex items-center space-x-2">
                    <code class="flex-1 p-2 bg-green-100 dark:bg-green-900/40 rounded text-green-800 dark:text-green-200 font-mono">
                      {generateDnsHint()!.internal}
                    </code>
                    <button
                      onClick={() => copyToClipboard(generateDnsHint()!.internal)}
                      class="p-1.5 text-green-600 hover:text-green-800 dark:hover:text-green-400 transition-colors"
                    >
                      <Copy class="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}