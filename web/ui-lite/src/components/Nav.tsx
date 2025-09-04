import { useLocation } from 'wouter'

const navItems = [
  { name: 'Dashboard', path: '/', icon: 'M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2v10z' },
  { name: 'Projects', path: '/projects', icon: 'M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10' },
  { name: 'Services', path: '/services', icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2' },
  { name: 'Routes', path: '/routes', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
  { name: 'Nodes', path: '/nodes', icon: 'M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z' },
  { name: 'Administration', path: '/administration', icon: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z' },
  { name: 'Clients', path: '/clients', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z' },
  { name: 'Settings', path: '/settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z' },
]

function NavItem({ name, path, icon, isActive }: { name: string; path: string; icon: string; isActive: boolean }) {
  return (
    <a
      href={`/app${path}`}
      class={`group flex items-center px-3 py-3 text-sm font-medium rounded-xl transition-all duration-300 cursor-pointer transform hover:scale-[1.02] ${
        isActive
          ? 'bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-200/50 dark:border-purple-400/50 text-white shadow-lg'
          : 'text-gray-300 hover:bg-gradient-to-r hover:from-purple-500/10 hover:to-pink-500/10 hover:border hover:border-purple-200/30 dark:hover:border-purple-400/30 hover:text-white'
      }`}
    >
      <svg
        class={`mr-3 h-5 w-5 transition-colors duration-300 ${
          isActive ? 'text-purple-400' : 'text-gray-400 group-hover:text-purple-400'
        }`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={icon} />
      </svg>
      <span class="transition-colors duration-300">{name}</span>
    </a>
  )
}

export function Nav() {
  const [location] = useLocation()

  return (
    <aside class="hidden md:flex md:w-64 md:flex-col">
      <div class="flex flex-col flex-grow pt-6 bg-black border-r border-gray-800 overflow-hidden">
        {/* Header with gradient accent */}
        <div class="relative flex items-center flex-shrink-0 px-6 pb-6">
          <div class="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-blue-500"></div>
          <h1 class="text-xl font-bold text-white">
            <a href="/app/" class="flex items-center gap-3">
              <div class="w-3 h-3 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full shadow-lg"></div>
              GLINR Dock
            </a>
          </h1>
        </div>
        
        <div class="flex-grow flex flex-col overflow-hidden">
          <nav class="flex-1 px-3 space-y-2 overflow-y-auto scrollbar-hide">
            {navItems.map((item) => (
              <NavItem
                key={item.path}
                name={item.name}
                path={item.path}
                icon={item.icon}
                isActive={location === item.path || (item.path !== '/' && location.startsWith(item.path))}
              />
            ))}
          </nav>
        </div>
        
        {/* Footer with gradient button style */}
        <div class="flex-shrink-0 p-4">
          <div class="bg-gradient-to-r from-gray-900 to-black/90 border border-gray-700/50 rounded-xl p-3 text-center">
            <div class="text-xs text-gray-400 font-medium">
              UI-Lite v1.0
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}