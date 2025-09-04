import { apiClient } from '../../api'
import { RoleToggle } from '../RoleToggle'
import { useState, useEffect } from 'preact/hooks'
import { getCurrentRole, isDevMode } from '../../rbac'
import { 
  ChevronDown, 
  ChevronRight, 
  ChevronLeft,
  LayoutDashboard,
  FolderOpen,
  Server,
  Route,
  HardDrive,
  Zap,
  Leaf,
  FileText,
  Settings,
  Shield,
  Database,
  FileSearch,
  Users,
  Code,
  LogOut,
  User,
  HelpCircle
} from 'lucide-preact'

interface MenuItem {
  id: string
  label: string
  icon: string
  count?: number
  children?: MenuItem[]
  href?: string
}

interface MenuSection {
  id: string
  label: string
  items: MenuItem[]
  collapsed?: boolean
}

interface SidebarProps {
  currentPage: string
  onPageChange: (page: string) => void
  counts: { projects: number; services: number; routes: number }
  isOpen?: boolean
  onToggle?: () => void
}

const getIcon = (iconType: string) => {
  const iconMap: Record<string, any> = {
    'dashboard': <LayoutDashboard class="w-5 h-5" />,
    'projects': <FolderOpen class="w-5 h-5" />,
    'services': <Server class="w-5 h-5" />,
    'routes': <Route class="w-5 h-5" />,
    'nodes': <HardDrive class="w-5 h-5" />,
    'quickstart': <Zap class="w-5 h-5" />,
    'spring': <Leaf class="w-5 h-5" />,
    'templates': <FileText class="w-5 h-5" />,
    'administration': <Shield class="w-5 h-5" />,
    'registries': <Database class="w-5 h-5" />,
    'logs': <FileSearch class="w-5 h-5" />,
    'clients': <Users class="w-5 h-5" />,
    'integrations': <Code class="w-5 h-5" />,
    'settings': <Settings class="w-5 h-5" />,
    'help': <HelpCircle class="w-5 h-5" />,
    'signout': <LogOut class="w-5 h-5" />
  }
  return iconMap[iconType] || <Settings class="w-5 h-5" />
}

export function Sidebar({ currentPage, onPageChange, counts, isOpen = true, onToggle }: SidebarProps) {
  const [currentRole, setCurrentRole] = useState<string>('admin')
  const [devMode, setDevMode] = useState<boolean>(false)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  // Load sidebar state from localStorage on mount
  useEffect(() => {
    const savedState = localStorage.getItem('sidebar-collapsed-sections')
    if (savedState) {
      try {
        const parsedSections = JSON.parse(savedState)
        setCollapsedSections(new Set(parsedSections))
      } catch (error) {
// Failed to parse saved sidebar state - using defaults
      }
    }
  }, [])

  useEffect(() => {
    const role = getCurrentRole() || 'admin'
    setCurrentRole(role)
    setDevMode(isDevMode())
  }, [])

  const handleRoleChange = () => {
    // Update local state when role changes
    const role = getCurrentRole() || 'admin'
    setCurrentRole(role)
    setDevMode(isDevMode())
  }

  const toggleSection = (sectionId: string) => {
    const newCollapsed = new Set(collapsedSections)
    if (newCollapsed.has(sectionId)) {
      newCollapsed.delete(sectionId)
    } else {
      newCollapsed.add(sectionId)
    }
    setCollapsedSections(newCollapsed)
    // Save to localStorage
    localStorage.setItem('sidebar-collapsed-sections', JSON.stringify([...newCollapsed]))
  }

  const menuSections: MenuSection[] = [
    {
      id: 'core',
      label: 'Core',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: 'dashboard' }
      ]
    },
    {
      id: 'resources',
      label: 'Resources',
      items: [
        { id: 'projects', label: 'Projects', icon: 'projects', count: counts.projects },
        { id: 'services', label: 'Services', icon: 'services', count: counts.services },
        { id: 'routes', label: 'Routes', icon: 'routes', count: counts.routes },
        { id: 'nodes', label: 'Nodes', icon: 'nodes' }
      ]
    },
    {
      id: 'deployment',
      label: 'Deployment',
      items: [
        { 
          id: 'quickstart', 
          label: 'Quick Start', 
          icon: 'quickstart',
          children: [
            { id: 'quickstart-spring', label: 'Spring Boot', icon: 'spring', href: '/app/quickstart/spring' }
          ]
        },
        { id: 'templates', label: 'Templates', icon: 'templates' }
      ]
    },
    {
      id: 'administration',
      label: 'Administration',
      items: [
        { id: 'administration', label: 'System Admin', icon: 'administration' },
        { id: 'registries', label: 'Registries', icon: 'registries' },
        { id: 'logs', label: 'System Logs', icon: 'logs' },
        { id: 'clients', label: 'Clients', icon: 'clients' }
      ]
    },
    {
      id: 'configuration',
      label: 'Configuration',
      items: [
        { 
          id: 'settings', 
          label: 'Settings', 
          icon: 'settings',
          href: '/app/settings'
        },
        { 
          id: 'integrations', 
          label: 'Integrations', 
          icon: 'integrations', 
          href: '/app/settings/integrations' 
        }
      ]
    },
    {
      id: 'support',
      label: 'Support',
      items: [
        { 
          id: 'help', 
          label: 'Help & Documentation', 
          icon: 'help',
          href: '/app/help'
        }
      ]
    }
  ]

  const handleSignOut = () => {
    apiClient.clearToken()
    window.location.reload()
  }

  const isItemActive = (item: MenuItem): boolean => {
    if (currentPage === item.id) return true
    if (item.children) {
      return item.children.some(child => currentPage === child.id)
    }
    // Handle parent-child relationships
    if (item.id === 'services' && currentPage === 'service-detail') return true
    if (item.id === 'settings' && currentPage.startsWith('settings')) return true
    return false
  }

  const handleItemClick = (item: MenuItem) => {
    if (item.children && item.children.length > 0) {
      // If has children, toggle expansion
      const sectionId = `item-${item.id}`
      toggleSection(sectionId)
    } else if (item.href) {
      window.history.pushState({}, '', item.href)
    } else {
      const path = item.id === 'dashboard' ? '/app' : `/app/${item.id}`
      window.history.pushState({}, '', path)
    }
  }


  const renderMenuItem = (item: MenuItem, level: number = 0) => {
    const isActive = isItemActive(item)
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = !collapsedSections.has(`item-${item.id}`)
    const paddingLeft = level === 0 ? '' : 'pl-6'

    return (
      <div key={item.id} class="space-y-1">
        <div
          onClick={() => handleItemClick(item)}
          class={`
            nav-item cursor-pointer group flex items-center gap-3
            transition-all duration-200 ${paddingLeft}
            ${!isOpen && level === 0 && 'md:justify-center md:px-2 md:mx-1 md:gap-0'}
            ${isActive
              ? 'nav-item-active bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-200/50 dark:border-purple-400/50 text-white shadow-lg rounded-xl'
              : 'nav-item-inactive text-gray-300 hover:text-white hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-pink-500/10 hover:border hover:border-purple-200/30 dark:hover:border-purple-400/30 rounded-xl'
            }
          `}
          title={!isOpen && level === 0 ? item.label : ''}
        >
          <div class={`flex-shrink-0 transition-colors duration-300 ${
            isActive ? 'text-purple-400' : 'text-gray-400 group-hover:text-purple-400'
          }`}>{getIcon(item.icon)}</div>
          <span class={`
            flex-1 transition-all duration-300 overflow-hidden whitespace-nowrap
            ${!isOpen && level === 0 && 'md:w-0 md:opacity-0'}
          `}>
            {item.label}
          </span>
          
          {item.count !== undefined && item.count > 0 && (
            <span class={`
              px-2 py-1 text-xs font-medium rounded-full
              transition-all duration-300
              ${isActive
                ? 'bg-purple-500/20 text-purple-300'
                : 'bg-gray-600 text-gray-300'
              }
              ${!isOpen && level === 0 && 'md:hidden'}
            `}>
              {item.count}
            </span>
          )}
          
          {hasChildren && (
            <div class={`
              flex-shrink-0 transition-transform duration-200
              ${!isOpen && level === 0 && 'md:hidden'}
              ${isExpanded ? 'rotate-90' : ''}
            `}>
              <ChevronRight class="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Render children */}
        {hasChildren && isExpanded && isOpen && (
          <div class="space-y-1 transition-all duration-200 overflow-hidden">
            {item.children!.map(child => renderMenuItem(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div 
          class="fixed inset-0 bg-black/60 z-40 md:hidden"
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <aside class={`
        fixed
        top-0 left-0
        z-50 md:z-auto
        h-screen
        bg-black
        border-r border-gray-800
        shadow-2xl
        flex flex-col
        transition-all duration-300 ease-in-out
        ${isOpen 
          ? 'w-56 translate-x-0' 
          : 'w-0 md:w-16 -translate-x-full md:translate-x-0'
        }
        md:translate-x-0
        overflow-hidden
      `}>
        {/* Header with gradient accent */}
        <div class={`
          relative pb-4
          transition-all duration-300
          ${isOpen ? 'p-4' : 'p-2 md:p-3'}
        `}>
          <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500"></div>
          <div class={`
            flex items-center justify-between
            transition-all duration-300
          `}>
            <div class={`
              flex items-center gap-3
              transition-all duration-300
              ${!isOpen && 'md:justify-center md:gap-0'}
            `}>
              <div class="w-10 h-10 bg-gradient-to-br from-[#9c40ff] via-[#8b008b] to-[#e94057] rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
                <span class="text-white font-bold text-lg">G</span>
              </div>
              <div class={`
                transition-all duration-300 overflow-hidden
                ${!isOpen && 'md:w-0 md:opacity-0'}
              `}>
                <h1 class="text-white font-bold whitespace-nowrap">GLINR Dock</h1>
                <p class="text-gray-400 text-xs whitespace-nowrap">Container Platform</p>
              </div>
            </div>
            
            {/* Desktop Toggle Button */}
            {isOpen ? (
              <button
                onClick={onToggle}
                class="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/50 transition-all duration-200"
                title="Collapse sidebar"
              >
                <ChevronLeft class="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={onToggle}
                class="hidden md:flex items-center justify-center w-8 h-8 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/50 transition-all duration-200 mx-auto"
                title="Expand sidebar"
              >
                <ChevronRight class="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav class={`
          flex-1 overflow-y-auto scrollbar-hide
          transition-all duration-300
          ${!isOpen && 'md:px-0'}
        `}>
          <div class={`
            transition-all duration-300
            ${isOpen ? 'p-3 space-y-2' : 'p-1 space-y-1'}
          `}>
            {menuSections.map((section, index) => (
              <div key={section.id} class={`space-y-1 ${index > 0 ? 'pt-3 mt-3 border-t border-gray-700/30' : ''}`}>
                {/* Section Header */}
                <div
                  onClick={() => toggleSection(section.id)}
                  class={`
                    cursor-pointer flex items-center justify-between
                    text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider
                    px-3 py-1 hover:text-gray-300 dark:hover:text-gray-200 transition-colors
                    bg-gray-800/20 dark:bg-gray-700/20 rounded-md
                    ${!isOpen && 'md:hidden'}
                  `}
                >
                  <span>{section.label}</span>
                  <ChevronDown class={`
                    w-3 h-3 transition-transform duration-200
                    ${collapsedSections.has(section.id) ? '-rotate-90' : ''}
                  `} />
                </div>
                
                {/* Section Items */}
                <div class={`
                  space-y-1 transition-all duration-200 overflow-hidden
                  ${collapsedSections.has(section.id) ? 'max-h-0' : 'max-h-96'}
                `}>
                  {section.items.map(item => renderMenuItem(item))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* Role Toggle for Testing */}
        <div class={`
          px-4 pb-2
          transition-all duration-300
          ${!isOpen && 'md:hidden'}
        `}>
          <RoleToggle onRoleChange={handleRoleChange} />
        </div>

        {/* Footer with gradient button style */}
        <div class={`
          transition-all duration-300
          ${isOpen ? 'p-4' : 'p-3'}
        `}>
          <div class="bg-gradient-to-r from-gray-900 to-black/90 border border-gray-700/50 rounded-xl p-3">
            <div class="flex items-center justify-between">
              <div class={`
                flex items-center gap-3
                transition-all duration-300
                ${!isOpen && 'md:w-0 md:opacity-0 md:gap-0'}
              `}>
                <div class="w-8 h-8 bg-gradient-to-br from-[#ffaa40] to-[#9c40ff] rounded-full flex items-center justify-center shadow-md">
                  <User class="w-4 h-4 text-white" />
                </div>
                <div class="overflow-hidden">
                  <p class="text-white text-sm font-medium whitespace-nowrap">
                    {devMode ? `Dev - ${currentRole}` : 'Admin User'}
                  </p>
                  <p class="text-gray-400 text-xs whitespace-nowrap">
                    {devMode ? 'Testing Mode' : 'Online'}
                  </p>
                </div>
              </div>
              
              <button 
                onClick={handleSignOut}
                class={`
                  p-2 rounded-lg text-gray-400 hover:bg-red-500/10 hover:text-red-400
                  transition-all duration-200 group flex-shrink-0
                  ${!isOpen && 'md:mx-auto'}
                `}
                title="Sign Out"
              >
                {getIcon('signout')}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}