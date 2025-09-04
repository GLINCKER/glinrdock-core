import { useState, useEffect } from 'preact/hooks'
import { setDevRoleOverride, getDevRoleOverride, isDevMode, getRoleBadgeClass } from '../rbac'

interface RoleToggleProps {
  onRoleChange?: () => void
}

const AVAILABLE_ROLES = [
  { value: 'admin', label: 'Admin', description: 'Full access to all features' },
  { value: 'deployer', label: 'Deployer', description: 'Manage services and deployments' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access' }
]

export function RoleToggle({ onRoleChange }: RoleToggleProps) {
  const [currentRole, setCurrentRole] = useState<string | null>(getDevRoleOverride())
  const [isOpen, setIsOpen] = useState(false)
  const [devModeEnabled, setDevModeEnabled] = useState(isDevMode())

  useEffect(() => {
    const role = getDevRoleOverride()
    setCurrentRole(role)
    setDevModeEnabled(isDevMode())
  }, [])

  const handleRoleChange = (role: string | null) => {
    setDevRoleOverride(role)
    setCurrentRole(role)
    setDevModeEnabled(role !== null)
    setIsOpen(false)
    onRoleChange?.()
  }

  const toggleDevMode = () => {
    if (devModeEnabled) {
      handleRoleChange(null)
    } else {
      handleRoleChange('admin') // Default to admin when enabling dev mode
    }
  }

  return (
    <div class="relative">
      {/* Dev Mode Toggle Button */}
      <button
        onClick={toggleDevMode}
        class={`
          flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium
          transition-all duration-200 w-full
          ${devModeEnabled 
            ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' 
            : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50 hover:text-gray-300'
          }
        `}
        title={devModeEnabled ? 'Disable Role Testing Mode' : 'Enable Role Testing Mode'}
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>
          {devModeEnabled ? 'Dev Mode' : 'Role Test'}
        </span>
      </button>

      {/* Role Selector (only shown in dev mode) */}
      {devModeEnabled && (
        <div class="mt-2">
          <button
            onClick={() => setIsOpen(!isOpen)}
            class={`
              flex items-center justify-between w-full px-3 py-2 rounded-lg text-xs
              transition-all duration-200
              ${getRoleBadgeClass(currentRole || 'viewer')} 
              hover:opacity-80
            `}
          >
            <div class="flex items-center space-x-2">
              <div class="w-2 h-2 rounded-full bg-current opacity-60"></div>
              <span class="font-medium capitalize">
                {currentRole || 'viewer'}
              </span>
            </div>
            <svg class={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Dropdown */}
          {isOpen && (
            <div class="absolute bottom-full left-0 right-0 mb-1 bg-gray-800 rounded-lg border border-gray-700 shadow-lg z-50">
              <div class="p-2 space-y-1">
                {AVAILABLE_ROLES.map(role => (
                  <button
                    key={role.value}
                    onClick={() => handleRoleChange(role.value)}
                    class={`
                      w-full flex items-center justify-between px-3 py-2 rounded-md text-xs
                      transition-all duration-150
                      ${currentRole === role.value 
                        ? `${getRoleBadgeClass(role.value)} font-medium` 
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                      }
                    `}
                  >
                    <div class="flex items-center space-x-2">
                      <div class={`w-2 h-2 rounded-full ${currentRole === role.value ? 'bg-current' : 'bg-gray-500'}`}></div>
                      <div class="text-left">
                        <div class="font-medium">{role.label}</div>
                        <div class="text-gray-400 text-xs opacity-75">{role.description}</div>
                      </div>
                    </div>
                    {currentRole === role.value && (
                      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
                
                {/* Reset to actual role */}
                <div class="border-t border-gray-700 pt-1 mt-1">
                  <button
                    onClick={() => handleRoleChange(null)}
                    class="w-full flex items-center space-x-2 px-3 py-2 rounded-md text-xs text-gray-400 hover:bg-gray-700 hover:text-white transition-all duration-150"
                  >
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    <span>Use Actual Role</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dev Mode Indicator */}
      {devModeEnabled && (
        <div class="mt-1 px-2 py-1 text-xs text-yellow-400 bg-yellow-500/10 rounded border border-yellow-500/20">
          <div class="flex items-center space-x-1">
            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span>Testing as {currentRole}</span>
          </div>
        </div>
      )}
    </div>
  )
}