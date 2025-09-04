import { render } from "preact";
import { useState, useEffect } from "preact/hooks";
import "./styles.css";
import { initializeTheme, setupSystemThemeListener } from "./theme";

// Initialize caching system
import { simpleIconsManager } from "./utils/simpleIcons";
// Start preloading common icons in the background
simpleIconsManager.preloadCommonIcons();

// Preload help articles for global search
import { preloadHelpArticlesForSearch } from "./utils/searchRegistry";
// Start preloading help articles in the background (non-blocking)
setTimeout(() => {
  preloadHelpArticlesForSearch().catch((error) =>
    console.warn("Background help preload failed:", error)
  );
}, 1000); // Delay to not interfere with initial app loading
// import { Router, Route, Switch, useLocation } from "wouter/preact";
import { ContentRouter } from "./router";
import { apiClient, useApiData } from "./api";
import { TopToolbar } from "./components/ui";
import { Sidebar } from "./components/ui/Sidebar";
import { LockdownBanner } from "./components/LockdownBanner";
import { PlanBadge } from "./components/PlanBadge";
import { RoleBadge } from "./components/RoleBadge";
import { RoleToggle } from "./components/RoleToggle";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { GlobalBanners } from "./components/AlertBanner";
import {
  DiagnosticsPanel,
  useDiagnostics,
} from "./components/DiagnosticsPanel";
import { ModalProvider } from "./components/ModalProvider";
import { Login } from "./pages";
import { Menu } from "lucide-preact";

// Main Application Component
function MainApp() {
  const [tokenInitialized, setTokenInitialized] = useState(false);

  // Initialize API client with token from localStorage
  useEffect(() => {
    const token = localStorage.getItem("glinrdock_token");
    if (token) {
      apiClient.setToken(token);
      // Small delay to prevent flash
      setTimeout(() => setTokenInitialized(true), 50);
    } else {
      // No token found - redirect to login
      window.location.href = "/login";
    }
  }, []);

  const getCurrentPageFromPath = () => {
    const path = window.location.pathname;
    if (path === "/app" || path === "/app/") return "dashboard";
    const segments = path.split("/").filter(Boolean);

    if (segments.length > 1) {
      // Handle nested routes like /app/services/123, /app/services/123/logs, /app/services/123/networking
      if (segments[1] === "services" && segments.length > 2) {
        const serviceId = segments[2];
        if (segments.length > 3) {
          const tabOrPage = segments[3];
          // All tabs including logs should go to service-detail page
          return { page: "service-detail", serviceId, tab: tabOrPage };
        }
        return { page: "service-detail", serviceId, tab: "overview" };
      }
      // Handle quickstart routes
      if (segments[1] === "quickstart" && segments.length > 2) {
        if (segments[2] === "spring") {
          return "quickstart-spring";
        }
      }
      // Handle settings routes
      if (segments[1] === "settings" && segments.length > 2) {
        if (segments[2] === "integrations") {
          return "settings-integrations";
        }
      }
      return segments[1]; // /app/settings -> settings
    }
    return "dashboard";
  };

  const [currentRoute, setCurrentRoute] = useState<
    string | { page: string; serviceId: string; tab?: string }
  >(getCurrentPageFromPath());

  // Extract current page for comparison
  const currentPage =
    typeof currentRoute === "string" ? currentRoute : currentRoute.page;

  // Initialize sidebar state from localStorage or default to open on desktop
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("sidebar-open");
      if (saved !== null) {
        return JSON.parse(saved);
      }
      // Default to open on desktop, closed on mobile
      return window.innerWidth >= 768;
    }
    return false;
  });
  const [isLockdownActive, setIsLockdownActive] = useState(false);

  // Save sidebar state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("sidebar-open", JSON.stringify(isSidebarOpen));
  }, [isSidebarOpen]);

  // Only make API calls after token is initialized
  const { data: systemInfo, refetch: refetchSystemInfo } = useApiData(
    () =>
      tokenInitialized ? apiClient.getSystemInfo() : Promise.resolve(null),
    [tokenInitialized]
  );

  const { refetch: refetchPlanInfo } = useApiData(
    () =>
      tokenInitialized ? apiClient.getSystemPlan() : Promise.resolve(null),
    [tokenInitialized]
  );

  const { refetch: refetchAuthInfo } = useApiData(
    () => (tokenInitialized ? apiClient.getAuthInfo() : Promise.resolve(null)),
    [tokenInitialized]
  );

  // Diagnostics panel management
  const diagnostics = useDiagnostics();

  // Fetch counts for sidebar - only after token is initialized
  const { data: projects, refetch: refetchProjects } = useApiData(
    () => (tokenInitialized ? apiClient.getProjects() : Promise.resolve([])),
    [tokenInitialized]
  );
  const [counts, setCounts] = useState({ projects: 0, services: 0, routes: 0 });

  // Update counts when projects data changes
  useEffect(() => {
    if (projects) {
      setCounts((prev) => ({ ...prev, projects: projects.length }));

      // Get services count
      Promise.all(
        projects.map((project) =>
          apiClient.getProjectServices(project.id).catch(() => [])
        )
      ).then((servicesArrays) => {
        const totalServices = servicesArrays.flat().length;
        setCounts((prev) => ({ ...prev, services: totalServices }));
      });

      // Get routes count
      apiClient
        .getAllRoutes()
        .then((routes) => {
          setCounts((prev) => ({ ...prev, routes: routes?.length || 0 }));
        })
        .catch(() => {
          setCounts((prev) => ({ ...prev, routes: 0 }));
        });
    }
  }, [projects]);

  // Listen for lockdown status changes, browser navigation, and role changes
  useEffect(() => {
    const handleLockdownEvent = (event: CustomEvent) => {
      setIsLockdownActive(event.detail.isLocked);
    };

    const handlePopState = () => {
      setCurrentRoute(getCurrentPageFromPath());
    };

    const handleRoleChange = () => {
      // Refetch all API data when role changes
      refetchAuthInfo();
      refetchSystemInfo();
      refetchPlanInfo();
      refetchProjects();
    };

    window.addEventListener(
      "lockdown-status-changed",
      handleLockdownEvent as EventListener
    );
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("role-changed", handleRoleChange);

    // Check initial lockdown status
    apiClient
      .getLockdownStatus()
      .then((status) => {
        setIsLockdownActive(status.is_locked);
      })
      .catch(() => {
        setIsLockdownActive(false);
      });

    return () => {
      window.removeEventListener(
        "lockdown-status-changed",
        handleLockdownEvent as EventListener
      );
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("role-changed", handleRoleChange);
    };
  }, [refetchAuthInfo, refetchSystemInfo, refetchPlanInfo, refetchProjects]);

  const handlePageChange = (page: string, serviceId?: string, tab?: string) => {
    let newRoute: string | { page: string; serviceId: string; tab?: string };
    let newPath: string;

    if (page === "service-detail" && serviceId) {
      newRoute = { page, serviceId, tab };
      if (tab && tab !== "overview") {
        newPath = `/app/services/${serviceId}/${tab}`;
      } else {
        newPath = `/app/services/${serviceId}`;
      }
    } else {
      newRoute = page;
      newPath = page === "dashboard" ? "/app" : `/app/${page}`;
    }

    setCurrentRoute(newRoute);
    // Close sidebar on mobile after navigation, but keep it open on desktop
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
    window.history.pushState({}, "", newPath);
  };

  const renderCurrentPage = () => {
    // Use wouter router for all pages
    return <ContentRouter />;
  };

  // Show loading screen while token is being initialized
  if (!tokenInitialized) {
    return (
      <div class="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-950 fade-in">
        <div class="text-center">
          <div class="w-16 h-16 border-4 border-[#9c40ff] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p class="text-gray-600 dark:text-gray-400">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <ModalProvider>
        <div class="min-h-screen bg-gray-100 dark:bg-gray-950 text-gray-900 dark:text-white fade-in">
        {/* Global banners - offline, API health, auth expired */}
        <GlobalBanners />

        {/* Global lockdown banner - positioned outside flex layout */}
        <LockdownBanner />

        {/* Main layout container with proper spacing */}
        <div class={`flex min-h-screen ${isLockdownActive ? "pt-24" : ""}`}>
          {/* Sidebar */}
          <Sidebar
            currentPage={currentPage}
            onPageChange={handlePageChange}
            counts={counts}
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          />

          {/* Main Content Area - Account for fixed sidebar */}
          <div
            class={`
        flex flex-col flex-1 min-h-screen
        transition-all duration-300 ease-in-out 
        bg-gray-50 dark:bg-gray-950
        ${isSidebarOpen ? "ml-56" : "md:ml-16"}
      `}
          >
            {/* Mobile & Tablet Top Bar */}
            <div class="lg:hidden bg-white/90 dark:bg-gray-850/90 backdrop-blur-xl border-b border-gray-200/30 dark:border-gray-700/30 px-4 py-3 flex items-center justify-between shadow-lg">
              <div class="flex items-center space-x-3">
                <div class="w-9 h-9 bg-gradient-to-br from-[#ffaa40] via-[#9c40ff] to-[#8b008b] rounded-xl flex items-center justify-center shadow-lg relative overflow-hidden">
                  <div class="relative z-10">
                    <svg
                      class="w-5 h-5 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2.5}
                        d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                      />
                    </svg>
                  </div>
                  <div class="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent"></div>
                </div>
                <div>
                  <div class="flex items-center gap-2">
                    <h1 class="text-gray-900 dark:text-white font-bold text-base">
                      GLINRDOCK
                    </h1>
                    {systemInfo?.go_version && (
                      <span class="text-xs font-mono text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                        v{systemInfo.go_version.replace(/^go/, "")}
                      </span>
                    )}
                  </div>
                  <p class="text-gray-600 dark:text-gray-400 text-xs font-medium">
                    Platform as a Service
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                class="p-2.5 rounded-lg bg-gray-200/50 dark:bg-gray-700/50 hover:bg-gray-300/50 dark:hover:bg-gray-600/50 border border-gray-300/30 dark:border-gray-600/30 hover:border-gray-400/50 dark:hover:border-gray-500/50 transition-all duration-200"
              >
                <Menu class="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>

            {/* Desktop Top Toolbar */}
            <div class="hidden lg:block">
              <TopToolbar />
            </div>

            {/* Page Content */}
            <main class="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950 p-8">
              <div class="w-full max-w-none">{renderCurrentPage()}</div>
            </main>
          </div>
        </div>

        {/* Diagnostics Panel */}
        <DiagnosticsPanel
          isVisible={diagnostics.isVisible}
          onClose={diagnostics.hide}
        />
        </div>
      </ModalProvider>
    </ErrorBoundary>
  );
}

// Root Application Component
function App() {
  const token = localStorage.getItem("glinrdock_token");

  // Initialize theme system
  useEffect(() => {
    initializeTheme();
    setupSystemThemeListener();
  }, []);

  if (!token) {
    return <Login />;
  }

  return <MainApp />;
}

render(<App />, document.getElementById("app")!);
