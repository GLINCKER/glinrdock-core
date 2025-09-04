import { useState } from "preact/hooks";
import { apiClient, useApiData } from "../api";
import { Toast, LoadingSpinner, HealthBadge, GhostButton, PrimaryButton } from "../components/ui";
import { CreateRouteModal, ConfirmModal } from "../components";
import { isAdminSync } from "../rbac";
import {
  Plus,
  Globe,
  Shield,
  Eye,
  Trash2,
  RefreshCw,
  ExternalLink,
  Zap,
  CheckCircle,
  Clock,
  AlertCircle,
  Settings,
  Info,
} from "lucide-preact";

export function Routes() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showNginxReloadConfirm, setShowNginxReloadConfirm] = useState(false);
  const [nginxReloading, setNginxReloading] = useState(false);
  const [checkingRoutes, setCheckingRoutes] = useState<Set<number>>(new Set());
  const [toastConfig, setToastConfig] = useState({
    show: false,
    message: "",
    type: "info" as "info" | "success" | "error",
  });

  // Fetch data using the new API methods
  const { data: authInfo } = useApiData(() => apiClient.getAuthInfo());
  const {
    data: routes,
    loading: routesLoading,
    refetch: refetchRoutes,
  } = useApiData(() => apiClient.listRoutes());
  const { data: projects, loading: projectsLoading } = useApiData(() =>
    apiClient.getProjects()
  );
  const { data: systemInfo } = useApiData(() => apiClient.getSystemInfo());

  // Check if user is admin for nginx reload
  const canReloadNginx = isAdminSync(authInfo?.role);

  // Get all services across projects for route creation and display
  const [allServices, setAllServices] = useState<any[]>([]);
  const [servicesLoading, setServicesLoading] = useState(false);

  // Fetch all services when projects are loaded
  useState(() => {
    if (projects && projects.length > 0) {
      setServicesLoading(true);
      Promise.all(
        projects.map((project) =>
          apiClient.getProjectServices(project.id).catch(() => [])
        )
      )
        .then((servicesArrays) => {
          const allServicesFlat = servicesArrays
            .flat()
            .map((service, index) => ({
              ...service,
              project_name:
                projects[
                  Math.floor(
                    index /
                      (servicesArrays.reduce(
                        (acc, arr) => acc + arr.length,
                        0
                      ) /
                        projects.length)
                  )
                ]?.name || "Unknown",
            }));
          setAllServices(allServicesFlat);
        })
        .finally(() => {
          setServicesLoading(false);
        });
    }
  });

  const handleCreateRoute = async (routeData: any) => {
    try {
      await apiClient.createRoute(routeData.service_id, routeData);
      setToastConfig({
        show: true,
        message: "Route created successfully",
        type: "success",
      });
      refetchRoutes();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to create route";
      setToastConfig({ show: true, message, type: "error" });
    }
  };

  const handleNginxReload = async () => {
    if (!canReloadNginx) return;

    setNginxReloading(true);
    try {
      await apiClient.nginxReload();
      setToastConfig({
        show: true,
        message: "Nginx configuration reloaded successfully",
        type: "success",
      });
      setShowNginxReloadConfirm(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to reload nginx";
      setToastConfig({ show: true, message, type: "error" });
    } finally {
      setNginxReloading(false);
    }
  };

  const handleDeleteRoute = async (routeId: string) => {
    try {
      await apiClient.deleteRoute(routeId);
      setToastConfig({
        show: true,
        message: "Route deleted successfully",
        type: "success",
      });
      refetchRoutes();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete route";
      setToastConfig({ show: true, message, type: "error" });
    }
  };

  const handleHealthCheck = async (routeId: number) => {
    setCheckingRoutes((prev) => new Set([...prev, routeId]));

    try {
      const healthResult = await apiClient.checkRouteHealth(routeId.toString());

      // Update the route in our local state
      if (routes) {
        const updatedRoutes = routes.map((route) =>
          route.id === routeId
            ? {
                ...route,
                last_status: healthResult.status,
                last_check_at: healthResult.checked_at,
              }
            : route
        );
        // Force a re-render by updating the routes data
        refetchRoutes();
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to check route health";
      setToastConfig({ show: true, message, type: "error" });
    } finally {
      setCheckingRoutes((prev) => {
        const newSet = new Set(prev);
        newSet.delete(routeId);
        return newSet;
      });
    }
  };

  if (projectsLoading || servicesLoading) {
    return (
      <div class="min-h-screen bg-white dark:bg-black">
        <div class="p-3 sm:p-4 max-w-7xl mx-auto space-y-4 fade-in">
          <div class="animate-pulse">
            <div class="flex items-center justify-between mb-4">
              <div>
                <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-56"></div>
              </div>
              <div class="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-32"></div>
            </div>
            <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
              <div class="p-6 space-y-3">
                {[...Array(3)].map((_, index) => (
                  <div
                    key={index}
                    class="border border-gray-200/50 dark:border-gray-600/50 rounded-lg p-4"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                        <div>
                          <div class="h-5 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-1"></div>
                          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                        </div>
                      </div>
                      <div class="flex items-center space-x-2">
                        <div class="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                        <div class="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div class="min-h-screen  ">
      <div class="p-3 sm:p-4 max-w-7xl mx-auto space-y-4 fade-in">
        {/* Modern Header */}
        <div class="flex items-center justify-between mb-4">
          <div>
            <h1 class="text-2xl font-bold mb-1">
              <span class="bg-gradient-to-r from-[#8b008b] via-[#9c40ff] to-[#e94057] bg-clip-text text-transparent">
                Routes
              </span>
            </h1>
            <p class="text-gray-600 dark:text-gray-400 text-sm">
              Configure external routing and load balancing
            </p>
          </div>
          <div class="flex items-center space-x-3">
            {canReloadNginx && (
              <button
                class="group flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-purple-600/20 hover:from-purple-500/20 hover:via-blue-500/20 hover:to-purple-600/30 border border-purple-200/50 hover:border-purple-300/70 dark:border-purple-400/30 dark:hover:border-purple-300/50 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-purple-500/20 transform hover:scale-[1.02] text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                onClick={() => setShowNginxReloadConfirm(true)}
                disabled={nginxReloading}
                title="Reload nginx configuration"
              >
                {nginxReloading ? (
                  <RefreshCw class="w-4 h-4 text-purple-600 dark:text-purple-400 transition-colors duration-300 animate-spin" />
                ) : (
                  <RefreshCw class="w-4 h-4 text-purple-600 dark:text-purple-400 transition-colors duration-300" />
                )}
                <span class="font-medium text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors duration-300">
                  Reload Nginx
                </span>
              </button>
            )}
            <button
              onClick={() => {
                window.location.href = "/app/routes/wizard";
              }}
              class="group flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-bl from-pink-500/10 via-purple-500/10 to-blue-600/20 hover:from-pink-500/20 hover:via-purple-500/20 hover:to-blue-600/30 border border-pink-200/50 hover:border-pink-300/70 dark:border-pink-400/30 dark:hover:border-pink-300/50 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-pink-500/20 transform hover:scale-[1.02] text-sm"
            >
              <Plus class="w-4 h-4 text-pink-600 dark:text-pink-400 transition-colors duration-300" />
              <span class="font-medium text-gray-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-300 transition-colors duration-300">
                Add Route
              </span>
            </button>
          </div>
        </div>

        {/* Nginx Proxy Disabled Banner */}
        {systemInfo && !systemInfo.nginx_proxy_enabled && (
          <div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-xl p-4 mb-4">
            <div class="flex items-start space-x-3">
              <div class="flex-shrink-0">
                <Info class="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" />
              </div>
              <div class="flex-1">
                <h3 class="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                  Reverse Proxy Disabled
                </h3>
                <p class="text-sm text-amber-700 dark:text-amber-300 mb-3">
                  Routes are currently configured for host-bound ports. Enable nginx reverse proxy for advanced routing, SSL certificates, and load balancing.
                </p>
                <button
                  onClick={() => window.location.href = '/app/help/networking'}
                  class="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-200 bg-amber-100 dark:bg-amber-800/30 hover:bg-amber-200 dark:hover:bg-amber-800/50 rounded-lg transition-colors duration-200"
                >
                  <Settings class="w-3 h-3" />
                  Learn More
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick info when no routes exist */}
        {(!routes || routes.length === 0) && !routesLoading && (
          <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
            <div class="text-center py-8">
              <div class="w-16 h-16 bg-gradient-to-br from-[#9c40ff]/20 to-[#8b008b]/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                <Globe class="w-8 h-8 text-[#9c40ff]" />
              </div>
              <h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {allServices.length === 0
                  ? "No Services Available"
                  : "No Routes Configured"}
              </h3>
              <p class="text-gray-600 dark:text-gray-300 mb-4">
                {allServices.length === 0
                  ? "Deploy services first, then create routes to expose them to the internet with custom domains."
                  : "Routes expose your services to the internet through custom domains with automatic SSL/TLS support."}
              </p>

              {allServices.length === 0 ? (
                <button
                  class="group flex items-center gap-3 px-6 py-3 rounded-xl bg-gradient-to-br from-purple-500/10 via-blue-500/10 to-purple-600/20 hover:from-purple-500/20 hover:via-blue-500/20 hover:to-purple-600/30 border border-purple-200/50 hover:border-purple-300/70 dark:border-purple-400/30 dark:hover:border-purple-300/50 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-purple-500/20 transform hover:scale-[1.02]"
                  onClick={() => {
                    window.location.href = "/app/services";
                  }}
                >
                  <Zap class="w-4 h-4 text-purple-600 dark:text-purple-400 transition-colors duration-300" />
                  <span class="font-semibold text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-300 transition-colors duration-300">
                    Deploy Services First
                  </span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    window.location.href = "/app/routes/wizard";
                  }}
                  class="group flex items-center gap-3 px-6 py-3 rounded-xl bg-gradient-to-bl from-pink-500/10 via-purple-500/10 to-blue-600/20 hover:from-pink-500/20 hover:via-purple-500/20 hover:to-blue-600/30 border border-pink-200/50 hover:border-pink-300/70 dark:border-pink-400/30 dark:hover:border-pink-300/50 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-pink-500/20 transform hover:scale-[1.02]"
                >
                  <Plus class="w-4 h-4 text-pink-600 dark:text-pink-400 transition-colors duration-300" />
                  <span class="font-semibold text-gray-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-300 transition-colors duration-300">
                    Create Your First Route
                  </span>
                </button>
              )}
            </div>
          </div>
        )}

        <div class="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
          <div class="p-6">
            <div class="flex items-center justify-between mb-6">
              <h2 class="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                <Globe class="w-5 h-5 mr-2 text-[#9c40ff]" />
                All Routes ({routes ? routes.length : 0})
              </h2>
            </div>

            {routesLoading ? (
              <div class="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    class="animate-pulse border border-gray-200 dark:border-gray-600 rounded-lg p-4"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                        <div>
                          <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-1"></div>
                          <div class="h-3 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                        </div>
                      </div>
                      <div class="flex space-x-2">
                        <div class="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div class="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : routes && routes.length > 0 ? (
              <div class="space-y-3">
                {routes.map((route) => {
                  const service = allServices.find(
                    (s) => s.id === route.service_id
                  );
                  const getStatusIcon = (status: string) => {
                    switch (status) {
                      case "healthy":
                        return <CheckCircle class="w-4 h-4 text-green-500" />;
                      case "unhealthy":
                        return <AlertCircle class="w-4 h-4 text-red-500" />;
                      default:
                        return <Clock class="w-4 h-4 text-gray-400" />;
                    }
                  };

                  return (
                    <div
                      key={route.id}
                      class="group bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-[#9c40ff]/50 transition-all duration-200 hover:shadow-sm p-4"
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex items-center space-x-4">
                          <div class="w-10 h-10 bg-gradient-to-br from-[#9c40ff]/20 to-[#8b008b]/20 rounded-lg flex items-center justify-center">
                            <Globe class="w-5 h-5 text-[#9c40ff]" />
                          </div>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center space-x-3 mb-1">
                              <a
                                href={`${route.tls ? "https" : "http"}://${
                                  route.domain
                                }${route.path || ""}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="text-gray-900 dark:text-white font-medium hover:text-[#9c40ff] transition-colors flex items-center space-x-2"
                              >
                                <span>
                                  {route.domain}
                                  {route.path && route.path !== "/" && (
                                    <span class="text-gray-500 dark:text-gray-400">
                                      {route.path}
                                    </span>
                                  )}
                                </span>
                                <ExternalLink class="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </a>

                              <div class="flex items-center space-x-2">
                                {route.tls && (
                                  <span class="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full text-xs font-medium flex items-center">
                                    <Shield class="w-3 h-3 mr-1" />
                                    HTTPS
                                  </span>
                                )}

                                <div class="flex items-center space-x-1">
                                  {getStatusIcon(route.last_status)}
                                  <span class="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                    {route.last_status || "Unknown"}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div class="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-300">
                              <span>
                                → {service ? service.name : "Unknown service"}:
                                {route.port}
                              </span>
                              {service?.project_name && (
                                <span class="bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-0.5 rounded text-xs">
                                  {service.project_name}
                                </span>
                              )}
                            </div>

                            <div class="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Created{" "}
                              {new Date(route.created_at).toLocaleDateString()}
                              {route.last_check_at && (
                                <span class="ml-3">
                                  Last checked{" "}
                                  {new Date(
                                    route.last_check_at
                                  ).toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div class="flex items-center space-x-1">
                          <button
                            class="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            onClick={() => handleHealthCheck(route.id)}
                            disabled={checkingRoutes.has(route.id)}
                            title="Check route health"
                          >
                            {checkingRoutes.has(route.id) ? (
                              <RefreshCw class="w-4 h-4 animate-spin" />
                            ) : (
                              <Eye class="w-4 h-4" />
                            )}
                          </button>
                          <button
                            class="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            onClick={() =>
                              handleDeleteRoute(route.id.toString())
                            }
                            title="Delete route"
                          >
                            <Trash2 class="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div class="text-center py-12">
                <div class="w-16 h-16 bg-gradient-to-br from-[#9c40ff]/20 to-[#8b008b]/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <Globe class="w-8 h-8 text-[#9c40ff]" />
                </div>
                <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  No routes configured
                </h3>
                <p class="text-gray-600 dark:text-gray-300 mb-4">
                  {allServices.length === 0
                    ? "Deploy services first to create routes"
                    : "Create routes to expose your services to the internet"}
                </p>
                {allServices.length > 0 && (
                  <button
                    onClick={() => {
                      window.location.href = "/app/routes/wizard";
                    }}
                    class="group flex items-center gap-3 px-6 py-3 rounded-xl bg-gradient-to-bl from-pink-500/10 via-purple-500/10 to-blue-600/20 hover:from-pink-500/20 hover:via-purple-500/20 hover:to-blue-600/30 border border-pink-200/50 hover:border-pink-300/70 dark:border-pink-400/30 dark:hover:border-pink-300/50 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-pink-500/20 transform hover:scale-[1.02]"
                  >
                    <Plus class="w-4 h-4 text-pink-600 dark:text-pink-400 transition-colors duration-300" />
                    <span class="font-semibold text-gray-900 dark:text-white group-hover:text-pink-600 dark:group-hover:text-pink-300 transition-colors duration-300">
                      Create First Route
                    </span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Create Route Modal */}
        <CreateRouteModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateRoute}
          services={allServices}
        />

        {/* Nginx Reload Confirmation Modal */}
        <ConfirmModal
          isOpen={showNginxReloadConfirm}
          onClose={() => setShowNginxReloadConfirm(false)}
          onConfirm={handleNginxReload}
          title="Reload Nginx Configuration"
          message="This will reload the nginx configuration to apply any recent route changes. This operation is safe and won't cause downtime."
          confirmText={nginxReloading ? "Reloading..." : "Reload"}
          confirmStyle="reload"
          disabled={nginxReloading}
        />

        {/* Toast Notifications */}
        <Toast
          message={toastConfig.message}
          type={toastConfig.type}
          isVisible={toastConfig.show}
          onClose={() => setToastConfig({ ...toastConfig, show: false })}
        />
      </div>
    </div>
  );
}
