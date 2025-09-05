import { ComponentChildren } from "preact";
import { Breadcrumb } from "../Breadcrumb";
import { usePageTitle } from "../../hooks/usePageTitle";
import { Link } from "wouter";
import { 
  Home, 
  Settings, 
  Lock,
  UserCheck,
  CreditCard,
  ScrollText,
  Plug
} from "lucide-preact";

interface SettingsLayoutProps {
  children: ComponentChildren;
  currentPage: string;
  title: string;
  description?: string;
}

const settingsPages = [
  {
    id: 'system',
    label: 'System Settings',
    href: '/settings',
    icon: Settings,
    description: 'System configuration and emergency controls'
  },
  {
    id: 'certificates',
    label: 'DNS & Certificates',
    href: '/settings/certificates',
    icon: Lock,
    description: 'Manage DNS providers and SSL certificates'
  },
  {
    id: 'auth',
    label: 'Authentication',
    href: '/settings/auth',
    icon: UserCheck,
    description: 'Configure authentication settings'
  },
  {
    id: 'license',
    label: 'License',
    href: '/settings/license',
    icon: ScrollText,
    description: 'View license information'
  },
  {
    id: 'plan-limits',
    label: 'Plan & Limits',
    href: '/settings/plan-limits',
    icon: CreditCard,
    description: 'Manage plan and resource limits'
  },
  {
    id: 'environment-templates',
    label: 'Environment Templates',
    href: '/settings/environment-templates',
    icon: Plug,
    description: 'Configure environment templates'
  }
];

export function SettingsLayout({ children, currentPage, title, description }: SettingsLayoutProps) {
  usePageTitle(`Settings - ${title}`);

  const currentPageInfo = settingsPages.find(page => page.id === currentPage);

  return (
    <div class="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div class="flex">
        {/* Settings Sub-sidebar */}
        <div class="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 min-h-screen">
          <div class="p-6">
            <div class="flex items-center gap-3 mb-6">
              <div class="p-2 bg-gradient-to-br from-[#9c40ff]/20 to-[#8b008b]/20 rounded-lg">
                <Settings class="w-5 h-5 text-[#9c40ff]" />
              </div>
              <div>
                <h2 class="font-semibold text-gray-900 dark:text-white">Settings</h2>
                <p class="text-xs text-gray-500 dark:text-gray-400">System Configuration</p>
              </div>
            </div>

            <nav class="space-y-1">
              {settingsPages.map((page) => {
                const isActive = page.id === currentPage;
                const Icon = page.icon;
                
                return (
                  <Link
                    key={page.id}
                    href={page.href}
                    class={`group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-gradient-to-r from-[#9c40ff]/10 to-[#8b008b]/10 text-[#9c40ff] border border-[#9c40ff]/20'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-gray-800'
                    }`}
                  >
                    <Icon class={`mr-3 h-4 w-4 ${isActive ? 'text-[#9c40ff]' : 'text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300'}`} />
                    <div>
                      <div class="text-sm font-medium">{page.label}</div>
                      <div class="text-xs text-gray-500 dark:text-gray-400">{page.description}</div>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div class="flex-1">
          <div class="p-6 max-w-6xl mx-auto">
            {/* Breadcrumb */}
            <Breadcrumb
              items={[
                { label: "Home", href: "/app", icon: Home },
                { label: "Settings", href: "/app/settings", icon: Settings },
                { label: title, active: true },
              ]}
              className="text-gray-600 dark:text-gray-300 mb-6"
            />

            {/* Page Header */}
            <div class="mb-8">
              <div class="flex items-center gap-3 mb-3">
                {currentPageInfo?.icon && (
                  <div class="p-2 bg-gradient-to-br from-[#9c40ff]/20 to-[#8b008b]/20 rounded-lg">
                    <currentPageInfo.icon class="w-6 h-6 text-[#9c40ff]" />
                  </div>
                )}
                <h1 class="text-3xl font-bold">
                  <span class="bg-gradient-to-r from-[#9c40ff] via-[#e94057] to-[#8b008b] bg-clip-text text-transparent">
                    {title}
                  </span>
                </h1>
              </div>
              {description && (
                <p class="text-gray-700 dark:text-gray-300 text-base">{description}</p>
              )}
            </div>

            {/* Page Content */}
            <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-sm">
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}