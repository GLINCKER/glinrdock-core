import { useState, useEffect } from "preact/hooks";
import { usePageTitle } from "../../hooks/usePageTitle";
import {
  Github,
  Globe,
  Server,
  Home,
  Settings as SettingsIcon,
} from "lucide-preact";
import { Breadcrumb } from "../../components/Breadcrumb";
import { GitHubIntegrationTab } from "../../components/integrations/GitHubIntegrationTab";
import { NginxProxyTab } from "../../components/integrations/NginxProxyTab";
import { Link } from "wouter";

type TabType = "github" | "proxy";

export function Integrations() {
  usePageTitle("Integrations");

  // Get initial tab from URL
  const getInitialTab = (): TabType => {
    const path = window.location.pathname;
    const segments = path.split("/");
    const tabParam = segments[segments.length - 1];

    if (tabParam === "proxy" || tabParam === "github") {
      return tabParam as TabType;
    }
    return "github";
  };

  const [activeTab, setActiveTab] = useState<TabType>(getInitialTab());

  // Update URL when tab changes
  const handleTabChange = (newTab: TabType) => {
    setActiveTab(newTab);
    const newPath = `/app/settings/integrations/${newTab}`;
    window.history.pushState({}, "", newPath);
  };

  // Handle browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      setActiveTab(getInitialTab());
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  return (
    <div class="min-h-screen">
      <div class="relative z-10 p-3 sm:p-6 max-w-7xl mx-auto space-y-6 fade-in">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "Home", href: "/", icon: Home },
            { label: "Settings", href: "/settings", icon: SettingsIcon },
            { label: "Integrations", href: "/settings/integrations" },
          ]}
          className="text-gray-600 dark:text-gray-300"
        />

        {/* Header */}
        <div class="flex items-center justify-between mb-8">
          <div>
            <h1 class="text-3xl font-bold mb-3">
              <span class="bg-gradient-to-r from-[#9c40ff] via-[#e94057] to-[#8b008b] bg-clip-text text-transparent">
                Integrations
              </span>
            </h1>
            <p class="text-gray-600 dark:text-gray-300 text-sm mt-1">
              Connect external services and enhance your platform capabilities
            </p>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div class="bg-white dark:bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 overflow-hidden shadow-lg">
          <div class="border-b border-gray-200 dark:border-gray-700/50">
            <nav class="flex space-x-0">
              {[
                {
                  id: "github",
                  name: "GitHub",
                  icon: Github,
                  activeColor: "bg-gradient-to-r from-gray-600 to-gray-800",
                  description: "Source code integration and CI/CD"
                },
                {
                  id: "proxy",
                  name: "Nginx Proxy",
                  icon: Server,
                  activeColor: "bg-gradient-to-r from-green-600 to-teal-700",
                  description: "Reverse proxy and load balancing"
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as TabType)}
                  class={`flex-1 px-6 py-4 text-sm font-medium transition-all duration-200 flex items-center justify-center space-x-2 relative overflow-hidden group ${
                    activeTab === tab.id
                      ? `text-white ${tab.activeColor} shadow-lg`
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-gray-700/30"
                  }`}
                >
                  <tab.icon class="w-4 h-4" />
                  <span class="hidden sm:inline">{tab.name}</span>
                  <span class="sm:hidden">{tab.name.split(' ')[0]}</span>
                  {activeTab === tab.id && (
                    <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#9c40ff] to-[#e94057]" />
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div class="p-6 bg-gray-50/30 dark:bg-transparent min-h-[600px]">
            {activeTab === "github" && <GitHubIntegrationTab />}
            {activeTab === "proxy" && <NginxProxyTab />}
          </div>
        </div>

        {/* Integration Status Summary */}
        <div class="bg-white dark:bg-gray-800/30 backdrop-blur-sm rounded-xl border border-gray-200 dark:border-gray-700/50 p-6">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Integration Status</h2>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <Github class="w-4 h-4 text-gray-600" />
                  <span class="text-sm font-medium text-gray-900 dark:text-white">GitHub</span>
                </div>
                <span class="text-xs text-orange-600 bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded">
                  Setup Required
                </span>
              </div>
              <p class="text-xs text-gray-600 dark:text-gray-400">
                Connect your GitHub repositories for automated deployments
              </p>
            </div>

            <div class="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div class="flex items-center justify-between mb-2">
                <div class="flex items-center gap-2">
                  <Server class="w-4 h-4 text-green-600" />
                  <span class="text-sm font-medium text-gray-900 dark:text-white">Nginx Proxy</span>
                </div>
                <span class="text-xs text-gray-600 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                  Disabled
                </span>
              </div>
              <p class="text-xs text-gray-600 dark:text-gray-400">
                Reverse proxy service for routing and load balancing
              </p>
            </div>
          </div>
          
          <div class="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div class="flex items-center gap-2 mb-2">
              <Globe class="w-4 h-4 text-blue-600" />
              <span class="text-sm font-medium text-gray-900 dark:text-white">DNS & Certificates</span>
            </div>
            <p class="text-xs text-gray-600 dark:text-gray-400">
              DNS and certificate management is now available in 
              <Link href="/settings/certificates" class="text-blue-600 dark:text-blue-400 hover:underline ml-1">
                Settings → DNS & Certificates
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}