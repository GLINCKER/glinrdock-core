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
import { DNSCertificatesTab } from "../../components/integrations/DNSCertificatesTab";
import { NginxProxyTab } from "../../components/integrations/NginxProxyTab";

type TabType = "github" | "dns" | "proxy";

export function IntegrationsNew() {
  usePageTitle("Integrations");

  // Get initial tab from URL
  const getInitialTab = (): TabType => {
    const path = window.location.pathname;
    const segments = path.split("/");
    const tabParam = segments[segments.length - 1];

    if (tabParam === "dns" || tabParam === "proxy" || tabParam === "github") {
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
      {/* Background decoration */}
      {/* <div class="absolute inset-0 bg-gradient-to-br from-[#9c40ff]/3 via-transparent to-[#8b008b]/3 dark:from-[#9c40ff]/5 dark:via-transparent dark:to-[#8b008b]/5 pointer-events-none" /> */}

      <div class="relative z-10 p-3 sm:p-6 max-w-7xl mx-auto space-y-6 fade-in">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "Home", href: "/", icon: Home },
            { label: "Settings", href: "/settings", icon: SettingsIcon },
            { label: "Integrations", active: true },
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
            <p class="text-gray-700 dark:text-gray-300 text-base">
              Connect external services and enhance your platform
            </p>
          </div>
        </div>

        {/* Tabs Navigation */}
        <div class="bg-white dark:glassmorphism border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-lg dark:shadow-xl">
          <div class="border-b border-gray-200 dark:border-white/10">
            <nav class="flex space-x-0">
              {[
                {
                  id: "github",
                  name: "GitHub",
                  icon: Github,
                  darkColor: "from-gray-600 to-black",
                  lightColor: "from-gray-500 to-gray-700",
                },
                {
                  id: "dns",
                  name: "DNS & Certificates",
                  icon: Globe,
                  darkColor: "from-blue-600 to-purple-700",
                  lightColor: "from-blue-500 to-purple-600",
                },
                {
                  id: "proxy",
                  name: "Nginx Proxy",
                  icon: Server,
                  darkColor: "from-green-600 to-teal-700",
                  lightColor: "from-green-500 to-teal-600",
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id as TabType)}
                  class={`flex-1 px-6 py-4 text-sm font-medium transition-all duration-200 flex items-center justify-center space-x-2 relative overflow-hidden group ${
                    activeTab === tab.id
                      ? `text-white bg-gradient-to-r ${tab.lightColor} dark:${tab.darkColor} shadow-lg`
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100/50 dark:hover:bg-white/5"
                  }`}
                >
                  {activeTab === tab.id && (
                    <div
                      class={`absolute inset-0 bg-gradient-to-r ${tab.lightColor} dark:${tab.darkColor} opacity-10 dark:opacity-20`}
                    />
                  )}
                  <tab.icon class="w-4 h-4" />
                  <span>{tab.name}</span>
                  {activeTab === tab.id && (
                    <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-[#9c40ff] to-[#e94057]" />
                  )}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div class="p-6 bg-gray-50/30 dark:bg-transparent">
            {activeTab === "github" && <GitHubIntegrationTab />}

            {activeTab === "dns" && <DNSCertificatesTab />}

            {activeTab === "proxy" && <NginxProxyTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
