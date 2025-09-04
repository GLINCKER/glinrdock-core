import { ComponentChildren } from 'preact'
import { useEffect } from 'preact/hooks'
import { useLocation } from 'wouter'
import { apiClient, AuthError, PermissionError } from '../api'
import { isAdminSync, getCurrentRole } from '../rbac'
import { Toast } from './ui'
import { useState } from 'preact/hooks'

interface GuardProps {
  children: ComponentChildren
}

interface RBACGuardProps extends GuardProps {
  roles?: string[]
  fallback?: ComponentChildren
  showError?: boolean
}

interface LockdownGuardProps extends GuardProps {
  allowedForRoles?: string[]
}

// Auth Guard: Ensures user has valid token
export function AuthGuard({ children }: GuardProps) {
  const [, setLocation] = useLocation()
  const [showToast, setShowToast] = useState(false)
  
  useEffect(() => {
    if (!apiClient.isAuthenticated()) {
      setShowToast(true)
      // Small delay to show toast before redirect
      setTimeout(() => {
        setLocation('/login')
      }, 1000)
    }
  }, [setLocation])
  
  if (!apiClient.isAuthenticated()) {
    return (
      <>
        <div class="min-h-screen flex items-center justify-center bg-gray-900">
          <div class="text-center">
            <div class="w-12 h-12 mx-auto mb-4 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <span class="text-blue-400">🔐</span>
            </div>
            <h2 class="text-lg font-medium text-white mb-2">Authentication Required</h2>
            <p class="text-gray-400 text-sm">Redirecting to login...</p>
          </div>
        </div>
        <Toast
          message="Session expired. Please log in again."
          isVisible={showToast}
          type="info"
          onClose={() => setShowToast(false)}
        />
      </>
    )
  }
  
  return <>{children}</>
}

// RBAC Guard: Checks user roles and permissions
export function RBACGuard({ 
  children, 
  roles = [], 
  fallback,
  showError = true 
}: RBACGuardProps) {
  const [authInfo, setAuthInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showToast, setShowToast] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  useEffect(() => {
    const checkPermissions = async () => {
      try {
        const info = await apiClient.getAuthInfo()
        setAuthInfo(info)
        
        // Use current role (includes dev override)
        const effectiveRole = getCurrentRole()
        
        // Check if user has required role
        if (roles.length > 0 && (!effectiveRole || !roles.includes(effectiveRole))) {
          setError(`Access denied. Required role: ${roles.join(' or ')}`)
          if (showError) {
            setShowToast(true)
          }
        }
      } catch (err) {
        if (err instanceof AuthError) {
          setError('Authentication required')
        } else if (err instanceof PermissionError) {
          setError('Permission denied')
        } else {
          setError('Unable to verify permissions')
        }
        if (showError) {
          setShowToast(true)
        }
      } finally {
        setLoading(false)
      }
    }
    
    checkPermissions()
  }, [roles, showError])
  
  if (loading) {
    return (
      <div class="animate-pulse">
        <div class="h-4 bg-gray-700 rounded w-3/4 mb-2"></div>
        <div class="h-4 bg-gray-700 rounded w-1/2"></div>
      </div>
    )
  }
  
  if (error) {
    const errorContent = fallback || (
      <div class="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
        <div class="flex items-center space-x-2">
          <div class="w-5 h-5 text-red-400">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <h3 class="text-red-400 font-medium">Access Restricted</h3>
            <p class="text-red-300 text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    )
    
    return (
      <>
        {errorContent}
        <Toast
          message={error}
          isVisible={showToast}
          type="error"
          onClose={() => setShowToast(false)}
        />
      </>
    )
  }
  
  return <>{children}</>
}

// Lockdown Guard: Shows warnings during system lockdown
export function LockdownGuard({ 
  children, 
  allowedForRoles = ['admin'] 
}: LockdownGuardProps) {
  const [systemInfo, setSystemInfo] = useState<any>(null)
  const [authInfo, setAuthInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  useEffect(() => {
    const checkLockdownStatus = async () => {
      try {
        // Check both system status and user info
        const [system, auth] = await Promise.all([
          apiClient.get('/system'),
          apiClient.getAuthInfo()
        ])
        
        setSystemInfo(system)
        setAuthInfo(auth)
      } catch (err) {
        console.warn('Failed to check lockdown status:', err)
      } finally {
        setLoading(false)
      }
    }
    
    checkLockdownStatus()
  }, [])
  
  if (loading) {
    return <div class="animate-pulse h-2 bg-gray-700 rounded"></div>
  }
  
  const isLockdown = systemInfo?.lockdown || false
  const userCanBypass = authInfo?.role && allowedForRoles.includes(authInfo.role)
  
  return (
    <>
      {isLockdown && (
        <div class="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2">
          <div class="flex items-center justify-between max-w-7xl mx-auto">
            <div class="flex items-center space-x-2">
              <div class="w-4 h-4 text-yellow-400">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <span class="text-yellow-300 text-sm font-medium">
                System Lockdown Active
              </span>
              {!userCanBypass && (
                <span class="text-yellow-200 text-xs">
                  Some features may be restricted
                </span>
              )}
            </div>
            {userCanBypass && (
              <span class="text-yellow-200 text-xs">
                Admin access - full functionality available
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* Render children with lockdown context */}
      <div data-lockdown={isLockdown} data-can-bypass={userCanBypass}>
        {children}
      </div>
    </>
  )
}

// Compound guard for common auth + role checking
export function ProtectedRoute({ 
  children, 
  roles = [], 
  requireAuth = true 
}: {
  children: ComponentChildren
  roles?: string[]
  requireAuth?: boolean
}) {
  if (requireAuth) {
    return (
      <AuthGuard>
        <LockdownGuard>
          {roles.length > 0 ? (
            <RBACGuard roles={roles}>
              {children}
            </RBACGuard>
          ) : (
            children
          )}
        </LockdownGuard>
      </AuthGuard>
    )
  }
  
  return <>{children}</>
}

// Hook for accessing guard states in components
export function useGuardState() {
  const [authInfo, setAuthInfo] = useState<any>(null)
  const [systemInfo, setSystemInfo] = useState<any>(null)
  
  useEffect(() => {
    const fetchStates = async () => {
      try {
        const [auth, system] = await Promise.all([
          apiClient.getAuthInfo(),
          apiClient.get('/system')
        ])
        setAuthInfo(auth)
        setSystemInfo(system)
      } catch (err) {
        console.warn('Failed to fetch guard states:', err)
      }
    }
    
    fetchStates()
  }, [])
  
  return {
    isAuthenticated: apiClient.isAuthenticated(),
    userRole: getCurrentRole(),
    isAdmin: isAdminSync(),
    isLockdown: systemInfo?.lockdown || false,
    canBypassLockdown: getCurrentRole() === 'admin'
  }
}