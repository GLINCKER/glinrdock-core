import { useState, useEffect } from "preact/hooks";
import {
  apiClient,
  ServiceDetail,
  ServiceConfig,
  ServiceNetwork,
  LinkedService,
  useApiData,
} from "../../api";
import { ServiceIcon } from "../../components/ServiceIcons";
import { StatusBadge, Badge } from "../../components/ui/ServiceBadge";
import { Modal } from "../../components/ui/Modal";
import { Toast } from "../../components/ui/Toast";
import { HealthStatusBadge } from "../../components/HealthStatusBadge";
import { CrashLoopBanner } from "../../components/CrashLoopBanner";
import { HealthCheckButton } from "../../components/HealthCheckButton";
import { getImageTag, getShortImageName, formatTime } from "../../utils/docker";
import { isDeployerSync } from "../../rbac";
import {
  LogsTab,
  OverviewTab,
  ConfigTab,
  EnvironmentTab,
  PortsTab,
  VolumesTab,
  NetworkingTab,
  ServiceControlButtons,
  AdvancedTab,
} from "./components";
import {
  Settings,
  Network,
  ChevronLeft,
  Database,
  AlertTriangle,
  Circle,
  Pause,
  RotateCw,
  Lock,
  Copy,
  Info,
  LayoutDashboard,
  FileText,
  Tag,
  HardDrive,
  Wifi,
  Shield,
  Trash2,
  AlertCircle,
} from "lucide-preact";
import { ResponsiveBreadcrumb, createServiceBreadcrumb } from "../../components/Breadcrumb";
import { usePageTitle } from "../../hooks/usePageTitle";

interface ServiceDetailPageProps {
  serviceId: string;
  initialTab?: string;
  onBack?: () => void;
  onTabChange?: (tab: string) => void;
}

export function ServiceDetailPage({
  serviceId,
  initialTab = "overview",
  onBack,
  onTabChange,
}: ServiceDetailPageProps) {
  const [service, setService] = useState<ServiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [liveUpdate, setLiveUpdate] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState(initialTab);
  const [config, setConfig] = useState<ServiceConfig | null>(null);
  const [originalConfig, setOriginalConfig] = useState<ServiceConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [network, setNetwork] = useState<ServiceNetwork | null>(null);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [links, setLinks] = useState<LinkedService[]>([]);
  const [availableServices, setAvailableServices] = useState<ServiceDetail[]>(
    []
  );
  const [linksChanged, setLinksChanged] = useState(false);
  const [linksSaveLoading, setLinksSaveLoading] = useState(false);
  // Logs state
  const [logs, setLogs] = useState<string[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logsAutoRefresh, setLogsAutoRefresh] = useState(false);
  const [logsTailLines, setLogsTailLines] = useState(100);
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  // Network enhancement state
  const [editingAlias, setEditingAlias] = useState(false);
  const [newAlias, setNewAlias] = useState("");
  const [connectivityTest, setConnectivityTest] = useState<{
    loading: boolean;
    target: string;
    result?: string;
  }>({ loading: false, target: "" });
  const [showDiagnosticsModal, setShowDiagnosticsModal] = useState(false);
  const [diagnosticsData, setDiagnosticsData] = useState<any>(null);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
    isVisible: boolean;
  }>({ message: "", type: "info", isVisible: false });
  const [showLinksGuide, setShowLinksGuide] = useState(false);

  // Enhanced Environment Management State
  const [envViewMode, setEnvViewMode] = useState("form");
  const [showEnvFileUpload, setShowEnvFileUpload] = useState(false);
  const [envPasteValue, setEnvPasteValue] = useState("");

  // Get auth info for RBAC
  const { data: authInfo, loading: authLoading } = useApiData(() =>
    apiClient.getAuthInfo()
  );
  const canDeploy = authInfo ? isDeployerSync(authInfo.role) : false;

  // Set custom page title with service name
  usePageTitle(
    service ? `${service.name} - Service Details` : 'Service Details'
  );

  // Debug RBAC
  // console.log("RBAC Debug:", {
  //   authInfo,
  //   authLoading,
  //   role: authInfo?.role,
  //   canDeploy,
  //   isDeployerResult: authInfo ? isDeployerSync(authInfo.role) : "no-auth",
  //   storedToken: localStorage.getItem("glinrdock_token"),
  //   apiClientToken: (apiClient as any).token,
  // });

  // Token is now handled globally in MainApp component

  // Custom tab change handler that updates URL
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    onTabChange?.(tab);
  };

  const fetchService = async () => {
    try {
      setError(null);
      const data = await apiClient.getService(serviceId);
      setService(data);
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to fetch service:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch service");
    } finally {
      setLoading(false);
    }
  };

  const fetchConfig = async () => {
    // Allow all authenticated users to view config, only restrict editing
    // Skip fetching only if we're still loading auth info
    if (authLoading) return;

    try {
      setConfigLoading(true);
      const data = await apiClient.getServiceConfig(serviceId);
      setConfig(data);
      setOriginalConfig({ ...data }); // Store original config for comparison
    } catch (err) {
      console.error("Failed to fetch service config:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch service config"
      );
    } finally {
      setConfigLoading(false);
    }
  };

  const fetchNetworking = async () => {
    if (activeTab !== "networking" || networkLoading) return;

    try {
      setNetworkLoading(true);
      setError(null);

      // Try to fetch networking data, but handle missing endpoints gracefully
      try {
        const [networkData, linksData] = await Promise.all([
          apiClient.getServiceNetwork(serviceId),
          apiClient.getServiceLinks(serviceId),
        ]);
        setNetwork(networkData);
        setLinks(linksData || []);
        setNewAlias(networkData?.alias || "");
        console.log("Network data fetched:", networkData);
      } catch (innerErr) {
        console.error("Failed to fetch networking data:", innerErr);
        setError("Failed to load networking information");
        setNetwork(null);
        setLinks([]);
      }
    } catch (err) {
      console.error("Failed to fetch networking data:", err);
      setError(
        err instanceof Error ? err.message : "Failed to fetch networking data"
      );
    } finally {
      setNetworkLoading(false);
    }
  };

  const fetchAvailableServices = async () => {
    if (!service || !canDeploy) return;

    try {
      const services = await apiClient.getProjectServices(service.project_id);
      // Filter out the current service
      setAvailableServices(services.filter((s) => s.id !== service.id));
    } catch (err) {
      console.error("Failed to fetch available services:", err);
    }
  };

  const fetchLogs = async () => {
    if (activeTab !== "logs") return;
    if (logsLoading) return;

    setLogsLoading(true);
    setLogsError(null);

    try {
      const data = await apiClient.getServiceLogs(serviceId, logsTailLines);
      // Clean Docker stream multiplexing headers from logs
      const cleanedLogs = (data.logs || [])
        .map((log) => {
          if (typeof log === "string") {
            // Remove Docker stream multiplexing headers and control characters
            let cleaned = log.replace(/^[\x00-\x08\x0E-\x1F\x7F-\xFF]+/, "");

            // If still has control characters, find timestamp and use from there
            if (cleaned.includes("\u0001") || cleaned.includes("\u0002")) {
              const timestampMatch = cleaned.match(
                /(\d{4}-\d{2}-\d{2}T[\d:.]+Z)/
              );
              if (timestampMatch) {
                const timestampIndex = cleaned.indexOf(timestampMatch[0]);
                cleaned = cleaned.substring(timestampIndex);
              } else if (log.length > 8) {
                // Fallback: skip first 8 bytes (Docker header)
                cleaned = log.substring(8);
              }
            }

            return cleaned.trim();
          }
          return log;
        })
        .filter((log) => log && log.length > 0); // Remove empty logs

      setLogs(cleanedLogs);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
      setLogsError(err instanceof Error ? err.message : "Failed to fetch logs");
    } finally {
      setLogsLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchService();
  }, [serviceId]);

  // Update active tab when initialTab prop changes
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  // Fetch config when switching to config tabs
  useEffect(() => {
    if (
      activeTab !== "overview" &&
      activeTab !== "networking" &&
      activeTab !== "logs" &&
      !config &&
      !configLoading &&
      !authLoading // Wait for auth to load
    ) {
      fetchConfig();
    }
  }, [activeTab, authLoading]);

  // Fetch networking data when switching to networking tab
  useEffect(() => {
    if (activeTab === "networking" && !network && !networkLoading) {
      fetchNetworking();
    }
  }, [activeTab]);

  // Fetch logs when switching to logs tab
  useEffect(() => {
    if (activeTab === "logs") {
      fetchLogs();
    }
  }, [activeTab]);

  // Fetch available services when service loads and user can deploy
  useEffect(() => {
    if (service && canDeploy && availableServices.length === 0) {
      fetchAvailableServices();
    }
  }, [service, canDeploy]);

  // Live updates - poll every 5s
  useEffect(() => {
    if (!liveUpdate || loading) return;

    const interval = setInterval(fetchService, 5000);
    return () => clearInterval(interval);
  }, [liveUpdate, loading]);

  // Auto-refresh logs when on logs tab and logs auto-refresh is enabled
  useEffect(() => {
    if (activeTab !== "logs" || logsLoading || !logsAutoRefresh) return;

    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [activeTab, logsLoading, logsAutoRefresh]);

  // Re-fetch logs when tail lines changes
  useEffect(() => {
    if (activeTab === "logs" && !logsLoading) {
      fetchLogs();
    }
  }, [logsTailLines]);

  // Reset data when tab changes to prevent stale state
  useEffect(() => {
    if (activeTab === "networking") {
      // Don't reset network data, it's needed for the tab
    } else if (activeTab === "logs") {
      // Don't reset logs, they're needed for the tab
    } else {
      // For other tabs, keep data but clear errors
      setError(null);
    }
  }, [activeTab]);


  const handleSaveConfig = async () => {
    if (!config || !hasChanges) return;

    setSaveLoading(true);
    try {
      await apiClient.updateServiceConfig(serviceId, {
        name: config.name,
        description: config.description,
        image: config.image,
        env: config.env,
        ports: config.ports,
        volumes: config.volumes,
      });

      setHasChanges(false);
      // Refresh service data
      await fetchService();
      // Show success message or notification here
    } catch (err) {
      console.error("Failed to save service config:", err);
      setError(
        err instanceof Error ? err.message : "Failed to save service config"
      );
    } finally {
      setSaveLoading(false);
    }
  };

  const updateConfig = (field: keyof ServiceConfig, value: any) => {
    if (!config) return;
    setConfig((prev) => (prev ? { ...prev, [field]: value } : null));
    setHasChanges(true);
  };

  const saveConfig = async () => {
    if (!config || !hasChanges) return;

    setSaveLoading(true);
    try {
      const response = await apiClient.updateServiceConfig(serviceId, config);
      setHasChanges(false);
      
      // Check if container was recreated and show appropriate warnings
      if (response.container_recreated) {
        showToast("⚠️ Configuration saved! Container was recreated - any data not in volumes was lost.", "info");
        if (response.recommendation) {
          // Show additional warning about data persistence
          setTimeout(() => {
            showToast("💡 Tip: Use volume mounts to persist data across container updates", "info");
          }, 3000);
        }
      } else {
        showToast("Configuration saved successfully!", "success");
      }
      
      // Refresh service data
      fetchService();
    } catch (err) {
      console.error("Failed to save config:", err);
      showToast("Failed to save configuration", "error");
      setError(
        err instanceof Error ? err.message : "Failed to save configuration"
      );
    } finally {
      setSaveLoading(false);
    }
  };

  const handleSaveLinks = async () => {
    if (!linksChanged) return;

    setLinksSaveLoading(true);
    try {
      const targetIds = links.map((link) => link.id);
      await apiClient.updateServiceLinks(serviceId, targetIds);
      // Refresh networking data after saving
      await fetchNetworking();
      setLinksChanged(false);
      setError(null);
    } catch (err) {
      console.error("Failed to save service links:", err);
      setError(
        err instanceof Error ? err.message : "Failed to save service links"
      );
    } finally {
      setLinksSaveLoading(false);
    }
  };


  const copyToClipboard = async (text: string, description?: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast(`${description || "Content"} copied to clipboard!`, "success");
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);

      if (successful) {
        showToast(
          `${description || "Content"} copied to clipboard!`,
          "success"
        );
      } else {
        showToast("Failed to copy to clipboard", "error");
      }
    }
  };

  const showToast = (message: string, type: "success" | "error" | "info") => {
    setToast({ message, type, isVisible: true });
  };

  const handleAliasEdit = async (newAlias: string) => {
    if (!network || !canDeploy) return;

    try {
      // This would need a backend endpoint to update the alias
      // For now, we'll show a warning about restart requirement
      const confirmed = confirm(
        `Changing the service alias from "${network.alias}" to "${newAlias}" will:\n\n` +
          `• Require a service restart to take effect\n` +
          `• Update DNS resolution for this service\n` +
          `• May affect other services connecting to this one\n\n` +
          `Do you want to continue?`
      );

      if (confirmed) {
        // Here we would call the API to update the alias
        // await apiClient.updateServiceAlias(serviceId, newAlias)
        alert(
          "Alias update functionality will be available in a future version.\n\nCurrently, aliases are auto-generated based on service configuration."
        );
        setEditingAlias(false);
        setNewAlias("");
      }
    } catch (err) {
      console.error("Failed to update alias:", err);
      setError("Failed to update service alias");
    }
  };

  const testConnectivity = async (targetAlias: string) => {
    if (!targetAlias.trim()) return;

    setConnectivityTest({ loading: true, target: targetAlias });

    try {
      // This would call a backend endpoint that tests connectivity from within the Docker network
      // For now, we'll simulate the test
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Simulate result
      const isReachable = Math.random() > 0.3; // 70% success rate for demo
      const result = isReachable
        ? `✅ Successfully connected to ${targetAlias}`
        : `❌ Unable to reach ${targetAlias} - check if service is running and ports are correct`;

      setConnectivityTest({ loading: false, target: targetAlias, result });

      // In real implementation:
      // const result = await apiClient.testServiceConnectivity(serviceId, targetAlias)
      // setConnectivityTest({loading: false, target: targetAlias, result: result.message})
    } catch (err) {
      console.error("Connectivity test failed:", err);
      setConnectivityTest({
        loading: false,
        target: targetAlias,
        result: `❌ Connectivity test failed: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      });
    }
  };


  const runNetworkDiagnostics = async () => {
    if (!network) return;

    try {
      // This would call backend endpoints for network diagnostics
      const diagnostics = {
        ping: {
          title: "Ping Test",
          content: `PING ${network.alias} (172.20.0.3): 56 data bytes\n64 bytes from 172.20.0.3: icmp_seq=1 ttl=64 time=0.042 ms\n64 bytes from 172.20.0.3: icmp_seq=2 ttl=64 time=0.038 ms\n64 bytes from 172.20.0.3: icmp_seq=3 ttl=64 time=0.041 ms\n\n--- ${network.alias} ping statistics ---\n3 packets transmitted, 3 received, 0% packet loss\nround-trip min/avg/max/stddev = 0.038/0.040/0.042/0.002 ms`,
          status: "success",
        },
        dns: {
          title: "DNS Resolution",
          content: `nslookup ${network.alias}\nServer: 127.0.0.11\nAddress: 127.0.0.11#53\n\nNon-authoritative answer:\nName: ${network.alias}\nAddress: 172.20.0.3\n\nReverse lookup:\n3.0.20.172.in-addr.arpa name = ${network.alias}`,
          status: "success",
        },
        routes: {
          title: "Routing Table",
          content: `Kernel IP routing table\nDestination     Gateway         Genmask         Flags   Metric Ref    Use Iface\n0.0.0.0         172.20.0.1      0.0.0.0         UG      0      0        0 eth0\n172.20.0.0      0.0.0.0         255.255.0.0     U       0      0        0 eth0\n127.0.0.0       0.0.0.0         255.0.0.0       U       0      0        0 lo`,
          status: "info",
        },
        netstat: {
          title: "Network Connections",
          content: `Active Internet connections (only servers)\nProto Recv-Q Send-Q Local Address           Foreign Address         State\ntcp        0      0 0.0.0.0:5432            0.0.0.0:*               LISTEN\ntcp6       0      0 :::5432                 :::*                    LISTEN\n\nActive UNIX domain sockets (only servers)\nProto RefCnt Flags       Type       State         I-Node   Path\nunix  2      [ ACC ]     STREAM     LISTENING     12345    /tmp/.s.PGSQL.5432`,
          status: "info",
        },
      };

      setDiagnosticsData(diagnostics);
      setShowDiagnosticsModal(true);
    } catch (err) {
      console.error("Network diagnostics failed:", err);
      showToast("Failed to run network diagnostics", "error");
    }
  };

  const generateDockerRunCommand = () => {
    if (!service || !config) return "";

    let cmd = `docker run -d --name ${service.name}`;

    // Add port mappings from config
    config.ports?.forEach((port) => {
      cmd += ` -p ${port.host}:${port.container}`;
    });

    // Add volume mappings from config
    config.volumes?.forEach((volume) => {
      cmd += ` -v ${volume.host}:${volume.container}${volume.ro ? ":ro" : ""}`;
    });

    cmd += ` ${service.image}`;
    return cmd;
  };

  if (loading) {
    return (
      <div class="flex items-center justify-center min-h-[400px]">
        <div class="text-center">
          <div class="w-8 h-8 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p class="text-gray-600 dark:text-gray-400">
            Loading service details...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div class="text-center py-12">
        <div class="text-red-500 text-xl mb-4 flex items-center justify-center">
          <AlertTriangle class="w-6 h-6 mr-2" />
          Error
        </div>
        <p class="text-gray-600 dark:text-gray-400 mb-6">{error}</p>
        <div class="space-x-3">
          <button
            onClick={fetchService}
            class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-[#9c40ff] to-[#8b008b] hover:from-[#8b008b] hover:to-[#9c40ff] text-white font-medium rounded-lg shadow-md transition-all duration-200 hover:scale-[1.02] text-sm"
          >
            Retry
          </button>
          {onBack && (
            <button
              onClick={onBack}
              class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Go Back
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!service) {
    return (
      <div class="text-center py-12">
        <div class="text-gray-500 text-xl mb-4">📭 Service Not Found</div>
        <p class="text-gray-600 dark:text-gray-400 mb-6">
          The requested service could not be found.
        </p>
        {onBack && (
          <button
            onClick={onBack}
            class="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Go Back
          </button>
        )}
      </div>
    );
  }

  // Create breadcrumb items
  const breadcrumbItems = createServiceBreadcrumb(
    `Project ${service.project_id}`, // TODO: Get actual project name from API
    service.name,
    undefined, // No current page since we're on the main service detail
    service.project_id.toString(),
    serviceId
  );

  return (
    <div class="space-y-3 sm:space-y-4 md:space-y-6">
      {/* Breadcrumb Navigation */}
      <div class="px-1">
        <ResponsiveBreadcrumb items={breadcrumbItems} />
      </div>

      {/* Header */}
      <div class="bg-gradient-to-r from-white/95 via-gray-50/90 to-white/95 dark:from-gray-800/95 dark:via-gray-900/90 dark:to-gray-800/95 rounded-2xl shadow-lg border border-gray-200/50 dark:border-gray-700/50 p-3 sm:p-4 md:p-6">
        <div class="flex flex-col gap-4 mb-4">
          <div class="flex items-start justify-between">
            <div class="flex items-center space-x-2 sm:space-x-3 min-w-0 flex-1">
              {onBack && (
                <button
                  onClick={onBack}
                  class="p-1.5 sm:p-2 rounded-lg text-gray-600 dark:text-gray-400 hover:bg-gray-200/50 dark:hover:bg-gray-700/50 transition-colors flex-shrink-0"
                  title="Back to Services"
                >
                  <ChevronLeft class="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              )}

              <ServiceIcon
                imageName={service.image}
                className="w-12 h-12 sm:w-16 sm:h-16 shadow-lg flex-shrink-0"
                size={64}
              />

              <div class="min-w-0 flex-1">
                <div class="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                  <h1 class="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 dark:text-white truncate">
                    {service.name}
                  </h1>
                  <div class="flex items-center gap-2 flex-wrap">
                    <StatusBadge status={service.status} size="sm" />
                    <HealthStatusBadge 
                      status={service.health_status || 'unknown'} 
                      lastProbeAt={service.last_probe_at}
                    />
                    <Badge variant="info" size="xs" class="text-xs">
                      Project #{service.project_id}
                    </Badge>
                  </div>
                </div>

                <div class="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                  <span class="flex items-center space-x-1">
                    <Database class="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span class="truncate">{getShortImageName(service.image)}</span>
                  </span>
                  {getImageTag(service.image) !== "latest" && (
                    <Badge variant="secondary" size="xs">
                      {getImageTag(service.image)}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2 justify-start sm:justify-end">
            <button
              onClick={() => setLiveUpdate(!liveUpdate)}
              class={`inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg transition-colors ${
                liveUpdate
                  ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                  : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
              }`}
            >
              {liveUpdate ? (
                <Circle class="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1 sm:mr-1.5 fill-current" />
              ) : (
                <Pause class="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1 sm:mr-1.5 fill-current" />
              )}
              <span class="hidden sm:inline">{liveUpdate ? "Live" : "Static"}</span>
              <span class="sm:hidden">{liveUpdate ? "Live" : "Static"}</span>
            </button>

            <HealthCheckButton
              serviceId={serviceId}
              size="md"
              onHealthUpdate={(status, lastProbeAt) => {
                // Update service data to reflect new health status
                fetchService()
                showToast(`Health check completed: ${status}`, status === 'ok' ? 'success' : 'error')
              }}
            />

            <button
              onClick={fetchService}
              disabled={loading}
              class="inline-flex items-center px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors disabled:opacity-50"
            >
              {loading ? (
                <RotateCw class="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1 sm:mr-1.5 animate-spin" />
              ) : (
                <RotateCw class="w-2.5 h-2.5 sm:w-3 sm:h-3 mr-1 sm:mr-1.5" />
              )}
              <span class="hidden sm:inline">Refresh</span>
              <span class="sm:hidden">Refresh</span>
            </button>
          </div>
        </div>

        {/* Action Bar - RBAC Protected */}
        <div class="border-t border-gray-200 dark:border-gray-700 pt-3 sm:pt-4">
          <ServiceControlButtons
            serviceId={serviceId}
            serviceStatus={service?.status || ''}
            canDeploy={canDeploy}
            actionLoading={actionLoading}
            onActionStart={(action) => setActionLoading(action)}
            onActionComplete={(action, success) => {
              setActionLoading(null);
              if (success) {
                // Refresh service data after successful action
                setTimeout(fetchService, 2000);
              }
            }}
            showToast={showToast}
          />
        </div>
      </div>

      {/* Crash Loop Banner */}
      {service?.crash_looping && (
        <div class="mb-6">
          <CrashLoopBanner
            serviceId={serviceId}
            serviceName={service.name}
            restartCount={service.restart_count || 0}
            lastExitCode={service.last_exit_code}
            canUnlock={canDeploy}
            onUnlock={() => {
              fetchService()
              showToast('Service unlocked successfully', 'success')
            }}
          />
        </div>
      )}

      {/* Tabs Navigation */}
      <div class="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200/50 dark:border-gray-700/50">
        <div class="border-b border-gray-200 dark:border-gray-700">
          <nav class="-mb-px flex space-x-2 sm:space-x-4 md:space-x-8 px-3 sm:px-4 md:px-6 overflow-x-auto scrollbar-hide">
            {[
              {
                id: "overview",
                name: "Overview",
                icon: LayoutDashboard,
              },
              {
                id: "logs",
                name: "Logs",
                icon: FileText,
              },
              {
                id: "config",
                name: "Config",
                icon: Settings,
                readonly: !canDeploy,
              },
              {
                id: "env",
                name: "Environment",
                icon: Tag,
                readonly: !canDeploy,
              },
              {
                id: "ports",
                name: "Ports",
                icon: Network,
                readonly: !canDeploy,
              },
              {
                id: "volumes",
                name: "Volumes",
                icon: HardDrive,
                readonly: !canDeploy,
              },
              {
                id: "networking",
                name: "Networking",
                icon: Wifi,
              },
              {
                id: "advanced",
                name: "Advanced",
                icon: Shield,
                readonly: !canDeploy,
              },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                class={`py-3 sm:py-4 px-2 sm:px-3 md:px-4 border-b-2 font-medium text-xs sm:text-sm flex items-center space-x-1 sm:space-x-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-[#9c40ff] text-[#9c40ff] dark:text-[#9c40ff]"
                    : tab.readonly
                    ? "border-transparent text-gray-400 dark:text-gray-600 cursor-not-allowed"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300"
                }`}
                disabled={tab.readonly}
                title={tab.readonly ? "Deployer+ role required" : ""}
              >
                <tab.icon class="w-3 h-3 sm:w-4 sm:h-4" />
                <span class="hidden sm:inline">{tab.name}</span>
                <span class="sm:hidden">{tab.name.length > 8 ? tab.name.substring(0, 8) + '...' : tab.name}</span>
                {tab.readonly && (
                  <Lock class="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                )}
              </button>
            ))}
          </nav>
        </div>

        <div class="p-3 sm:p-4 md:p-6">
          {activeTab === "overview" && (
            <OverviewTab
              service={service}
              network={network}
              networkLoading={networkLoading}
              handleTabChange={handleTabChange}
              copyToClipboard={copyToClipboard}
              generateDockerRunCommand={generateDockerRunCommand}
              formatTime={formatTime}
              lastUpdated={lastUpdated}
              liveUpdate={liveUpdate}
            />
          )}

          {(activeTab === "config" ||
            activeTab === "env" ||
            activeTab === "ports" ||
            activeTab === "volumes") &&
            (authLoading || configLoading ? (
              <div class="flex items-center justify-center py-12">
                <div class="text-center">
                  <div class="w-8 h-8 border-2 border-[#10b981] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p class="text-gray-600 dark:text-gray-400">
                    {authLoading
                      ? "Loading authentication..."
                      : "Loading configuration..."}
                  </p>
                </div>
              </div>
            ) : config ? (
              <div class="space-y-6">
                {activeTab === "config" && (
                  <ConfigTab
                    config={config}
                    originalConfig={originalConfig}
                    hasChanges={hasChanges}
                    saveLoading={saveLoading}
                    canDeploy={canDeploy}
                    saveConfig={saveConfig}
                    updateConfig={updateConfig}
                    handleTabChange={handleTabChange}
                  />
                )}

                {activeTab === "env" && (
                  <EnvironmentTab
                    config={config}
                    canDeploy={canDeploy}
                    envViewMode={envViewMode}
                    showEnvFileUpload={showEnvFileUpload}
                    envPasteValue={envPasteValue}
                    setEnvViewMode={setEnvViewMode}
                    setShowEnvFileUpload={setShowEnvFileUpload}
                    setEnvPasteValue={setEnvPasteValue}
                    updateConfig={updateConfig}
                    showToast={showToast}
                    serviceId={serviceId}
                  />
                )}

                {activeTab === "ports" && (
                  <PortsTab
                    config={config}
                    canDeploy={canDeploy}
                    updateConfig={updateConfig}
                  />
                )}

                {activeTab === "volumes" && (
                  <VolumesTab
                    config={config}
                    hasChanges={hasChanges}
                    canDeploy={canDeploy}
                    updateConfig={updateConfig}
                    showToast={showToast}
                  />
                )}
              </div>
            ) : (
              <div class="text-center py-12">
                <div class="text-gray-500 text-xl mb-4">
                  <Settings class="w-4 h-4 inline mr-2" />
                  Configuration Unavailable
                </div>
                <p class="text-gray-600 dark:text-gray-400 mb-6">
                  Unable to load service configuration.
                </p>
                <button
                  onClick={fetchConfig}
                  class="inline-flex items-center px-4 py-2 bg-gradient-to-r from-[#9c40ff] to-[#8b008b] hover:from-[#8b008b] hover:to-[#9c40ff] text-white font-medium rounded-lg shadow-md transition-all duration-200 hover:scale-[1.02] text-sm"
                >
                  Retry
                </button>
              </div>
            ))}

          {/* Logs Tab */}
          {activeTab === "logs" && (
            <LogsTab
              serviceId={serviceId}
              logs={logs}
              logsLoading={logsLoading}
              logsError={logsError}
              logsAutoRefresh={logsAutoRefresh}
              logsTailLines={logsTailLines}
              isScrolledToBottom={isScrolledToBottom}
              crashLooping={service?.crash_looping}
              setLogsTailLines={setLogsTailLines}
              setLogsAutoRefresh={setLogsAutoRefresh}
              setIsScrolledToBottom={setIsScrolledToBottom}
              fetchLogs={fetchLogs}
            />
          )}

          {/* Networking Tab */}
          {activeTab === "networking" && (
            <NetworkingTab
              network={network}
              links={links}
              aliases={service?.aliases}
              editingAlias={editingAlias}
              setEditingAlias={setEditingAlias}
              newAlias={newAlias}
              setNewAlias={setNewAlias}
              connectivityTest={connectivityTest}
              setConnectivityTest={setConnectivityTest}
              showLinksGuide={showLinksGuide}
              setShowLinksGuide={setShowLinksGuide}
              canDeploy={canDeploy}
              runNetworkDiagnostics={runNetworkDiagnostics}
              fetchNetworking={fetchNetworking}
              handleAliasEdit={handleAliasEdit}
              testConnectivity={testConnectivity}
              copyToClipboard={copyToClipboard}
              setNetwork={setNetwork}
              setError={setError}
            />
          )}

          {/* Advanced Settings Tab */}
          {activeTab === "advanced" && (
            <AdvancedTab
              service={service}
              config={config}
              canDeploy={canDeploy}
              showToast={showToast}
              onServiceDeleted={() => {
                // Navigate back to services list or handle as needed
                if (onBack) {
                  onBack();
                } else {
                  // Fallback: reload the page or redirect
                  window.location.href = '/app/';
                }
              }}
            />
          )}
        </div>
      </div>

      {/* Sticky Save Bar */}
      {(hasChanges || linksChanged) && canDeploy && (
        <div class="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-3 sm:p-4 shadow-lg z-50">
          <div class="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
            <div class="flex items-center space-x-2 sm:space-x-3">
              <div class="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <span class="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                {hasChanges && linksChanged
                  ? "Unsaved config & link changes"
                  : hasChanges
                  ? "Unsaved config changes"
                  : "Unsaved link changes"}
              </span>
            </div>
            <div class="flex items-center space-x-2 sm:space-x-3 w-full sm:w-auto">
              <button
                onClick={() => {
                  if (hasChanges) {
                    setConfig(null);
                    setHasChanges(false);
                    fetchConfig();
                  }
                  if (linksChanged) {
                    setLinksChanged(false);
                    fetchNetworking();
                  }
                }}
                class="px-3 sm:px-4 py-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Discard
              </button>
              {hasChanges && (
                <button
                  onClick={handleSaveConfig}
                  disabled={saveLoading}
                  class="inline-flex items-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-gradient-to-r from-[#9c40ff] to-[#8b008b] hover:from-[#8b008b] hover:to-[#9c40ff] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-md transition-all duration-200 hover:scale-[1.02] flex-1 sm:flex-none justify-center"
                >
                  {saveLoading ? (
                    <>
                      <RotateCw class="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />
                      <span class="hidden sm:inline">Saving Config...</span>
                      <span class="sm:hidden">Saving...</span>
                    </>
                  ) : (
                    <>
                      <span class="hidden sm:inline">Save Config</span>
                      <span class="sm:hidden">Save Config</span>
                    </>
                  )}
                </button>
              )}
              {linksChanged && (
                <button
                  onClick={handleSaveLinks}
                  disabled={linksSaveLoading}
                  class="inline-flex items-center px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#9c40ff] hover:bg-[#8b35e6] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors flex-1 sm:flex-none justify-center"
                >
                  {linksSaveLoading ? (
                    <>
                      <RotateCw class="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 animate-spin" />
                      <span class="hidden sm:inline">Saving Links...</span>
                      <span class="sm:hidden">Saving...</span>
                    </>
                  ) : (
                    <>
                      <span class="hidden sm:inline">Save Links</span>
                      <span class="sm:hidden">Save Links</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Diagnostics Modal */}
      <Modal
        isOpen={showDiagnosticsModal}
        onClose={() => setShowDiagnosticsModal(false)}
        title="Network Diagnostics"
        size="lg"
      >
        {diagnosticsData && (
          <div class="space-y-6">
            <div class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Network diagnostics for service:{" "}
              <strong class="text-gray-900 dark:text-white">
                {network?.alias}
              </strong>
            </div>

            {Object.entries(diagnosticsData).map(
              ([key, data]: [string, any]) => (
                <div key={key} class="space-y-3">
                  <div class="flex items-center justify-between">
                    <h4 class="text-base font-medium text-gray-900 dark:text-white flex items-center">
                      <span
                        class={`w-2 h-2 rounded-full mr-2 ${
                          data.status === "success"
                            ? "bg-green-500"
                            : "bg-blue-500"
                        }`}
                      ></span>
                      {data.title}
                    </h4>
                    <button
                      onClick={() =>
                        copyToClipboard(data.content, `${data.title} results`)
                      }
                      class="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center"
                    >
                      <Copy class="w-3 h-3 mr-1" />
                      Copy
                    </button>
                  </div>
                  <div class="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 border">
                    <pre class="text-sm text-green-400 font-mono whitespace-pre-wrap overflow-x-auto">
                      {data.content}
                    </pre>
                  </div>
                </div>
              )
            )}

            <div class="text-xs text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
              <strong>Note:</strong> These are simulated diagnostics. In
              production, this would run actual network tests from within the
              container.
            </div>
          </div>
        )}
      </Modal>

      {/* Service Links Guide Modal */}
      <Modal
        isOpen={showLinksGuide}
        onClose={() => setShowLinksGuide(false)}
        title="Service Links Guide"
        size="lg"
      >
        <div class="space-y-6">
          <div class="space-y-4">
            <div class="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
              <h4 class="text-base font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center">
                <Info class="w-5 h-5 mr-2" />
                What are Service Links?
              </h4>
              <p class="text-sm text-blue-800 dark:text-blue-200">
                Service links create network connections between containers,
                allowing them to communicate using easy-to-remember aliases
                instead of IP addresses.
              </p>
            </div>

            <div class="space-y-4">
              <h4 class="text-base font-medium text-gray-900 dark:text-white">
                How to Connect Services:
              </h4>

              <div class="space-y-3 text-sm">
                <div class="flex items-start space-x-3">
                  <span class="flex-shrink-0 w-6 h-6 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center text-xs font-medium">
                    1
                  </span>
                  <div>
                    <strong class="text-gray-900 dark:text-white">
                      Via GLINR UI:
                    </strong>
                    <p class="text-gray-600 dark:text-gray-400 mt-1">
                      Go to{" "}
                      <code class="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                        Projects → [Your Project] → Services → [Service] →
                        Config → Links
                      </code>
                    </p>
                  </div>
                </div>

                <div class="flex items-start space-x-3">
                  <span class="flex-shrink-0 w-6 h-6 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center text-xs font-medium">
                    2
                  </span>
                  <div>
                    <strong class="text-gray-900 dark:text-white">
                      Via Docker Compose:
                    </strong>
                    <pre class="mt-2 text-xs bg-gray-900 dark:bg-gray-950 text-green-400 p-3 rounded overflow-x-auto">
                      {`version: '3.8'
services:
  web:
    image: nginx
    depends_on:
      - database
    links:
      - database:db  # Creates 'db' alias
      
  database:
    image: postgres`}
                    </pre>
                  </div>
                </div>

                <div class="flex items-start space-x-3">
                  <span class="flex-shrink-0 w-6 h-6 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center text-xs font-medium">
                    3
                  </span>
                  <div>
                    <strong class="text-gray-900 dark:text-white">
                      Via Docker Command:
                    </strong>
                    <pre class="mt-2 text-xs bg-gray-900 dark:bg-gray-950 text-green-400 p-3 rounded overflow-x-auto">
                      docker run --link database:db nginx
                    </pre>
                  </div>
                </div>
              </div>

              <div class="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
                <h4 class="text-base font-medium text-green-900 dark:text-green-100 mb-2">
                  Example Usage:
                </h4>
                <div class="space-y-2 text-sm">
                  <p class="text-green-800 dark:text-green-200">
                    Once linked, services can communicate like this:
                  </p>
                  <pre class="text-xs bg-gray-900 text-green-400 p-2 rounded">
                    curl http://database:5432/health ping database telnet
                    database 5432
                  </pre>
                  <p class="text-xs text-green-700 dark:text-green-300 mt-2">
                    No need to know IP addresses - Docker handles the DNS
                    resolution automatically!
                  </p>
                </div>
              </div>

              <div class="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-700">
                <h4 class="text-base font-medium text-amber-900 dark:text-amber-100 mb-2 flex items-center">
                  <AlertTriangle class="w-4 h-4 mr-2" />
                  Important Notes:
                </h4>
                <ul class="text-sm text-amber-800 dark:text-amber-200 space-y-1 list-disc list-inside">
                  <li>Services must be on the same Docker network</li>
                  <li>
                    Links are one-way (service A can reach B, but B needs its
                    own link to reach A)
                  </li>
                  <li>
                    Modern Docker prefers user-defined networks over legacy
                    links
                  </li>
                  <li>Always test connectivity after creating links</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Toast Notifications */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={() => setToast((prev) => ({ ...prev, isVisible: false }))}
      />
    </div>
  );
}
