// Role-based access control utilities
import { apiClient, type AuthInfo } from './api'

// Role hierarchy (higher number = more permissions)
const ROLE_HIERARCHY: Record<string, number> = {
  'client': 1,
  'viewer': 2,
  'user': 3,
  'deployer': 4,
  'admin': 5,
}

// Cache for auth info
let authInfo: AuthInfo | null = null
let authChecked = false

// Development mode role override
let devRoleOverride: string | null = null

// Development role override functions
export function setDevRoleOverride(role: string | null): void {
  devRoleOverride = role
  // Store in localStorage for persistence
  if (role) {
    localStorage.setItem('devRoleOverride', role)
  } else {
    localStorage.removeItem('devRoleOverride')
  }
}

export function getDevRoleOverride(): string | null {
  if (devRoleOverride) return devRoleOverride
  // Check localStorage
  return localStorage.getItem('devRoleOverride')
}

export function isDevMode(): boolean {
  return getDevRoleOverride() !== null
}

// Get current effective role (override or actual)
export function getCurrentRole(): string | undefined {
  const override = getDevRoleOverride()
  if (override) return override
  return authInfo?.role
}

// Fetch current user's auth info
export async function getAuthInfo(): Promise<AuthInfo | null> {
  if (authChecked && authInfo) {
    // If we have dev override, return modified auth info
    const override = getDevRoleOverride()
    if (override) {
      return { ...authInfo, role: override }
    }
    return authInfo
  }

  try {
    authInfo = await apiClient.getAuthInfo()
    authChecked = true
    
    // If we have dev override, return modified auth info
    const override = getDevRoleOverride()
    if (override) {
      return { ...authInfo, role: override }
    }
    return authInfo
  } catch (error) {
    console.error('Failed to get auth info:', error)
    authChecked = true
    authInfo = { method: 'token' }
    
    // If we have dev override, return modified auth info
    const override = getDevRoleOverride()
    if (override) {
      return { ...authInfo, role: override }
    }
    return authInfo
  }
}

// Check if user has a specific role or higher
export function hasRole(requiredRole: string, userRole?: string): boolean {
  if (!userRole) return false
  
  const userLevel = ROLE_HIERARCHY[userRole] || 0
  const requiredLevel = ROLE_HIERARCHY[requiredRole] || 0
  
  return userLevel >= requiredLevel
}

// Role check functions
export async function isAdmin(): Promise<boolean> {
  const auth = await getAuthInfo()
  return hasRole('admin', auth?.role)
}

export async function isDeployer(): Promise<boolean> {
  const auth = await getAuthInfo()
  return hasRole('deployer', auth?.role)
}

export async function isUser(): Promise<boolean> {
  const auth = await getAuthInfo()
  return hasRole('user', auth?.role)
}

export async function isViewer(): Promise<boolean> {
  const auth = await getAuthInfo()
  return hasRole('viewer', auth?.role)
}

export async function isClient(): Promise<boolean> {
  const auth = await getAuthInfo()
  return hasRole('client', auth?.role)
}

// Synchronous role checks (prefer passed role over cached auth info)
export function isAdminSync(role?: string): boolean {
  // If role is explicitly provided, use it. Otherwise fall back to current role (including dev override)
  const userRole = role || getCurrentRole()
  return hasRole('admin', userRole)
}

export function isDeployerSync(role?: string): boolean {
  // If role is explicitly provided, use it. Otherwise fall back to current role (including dev override)
  const userRole = role || getCurrentRole()
  return hasRole('deployer', userRole)
}

export function isUserSync(role?: string): boolean {
  // If role is explicitly provided, use it. Otherwise fall back to current role (including dev override)
  const userRole = role || getCurrentRole()
  return hasRole('user', userRole)
}

export function isViewerSync(role?: string): boolean {
  // If role is explicitly provided, use it. Otherwise fall back to current role (including dev override)
  const userRole = role || getCurrentRole()
  return hasRole('viewer', userRole)
}

export function isClientSync(role?: string): boolean {
  // If role is explicitly provided, use it. Otherwise fall back to current role (including dev override)
  const userRole = role || getCurrentRole()
  return hasRole('client', userRole)
}

// Get role badge color classes
export function getRoleBadgeClass(role: string): string {
  switch (role.toLowerCase()) {
    case 'admin':
      return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
    case 'deployer':
      return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300'
    case 'user':
      return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
    case 'viewer':
      return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300'
    case 'client':
      return 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300'
    default:
      return 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-300'
  }
}

// Initialize auth info on app start
export function initializeAuth(): void {
  // Load dev role override from localStorage on startup
  devRoleOverride = localStorage.getItem('devRoleOverride')
  getAuthInfo()
}

// Clear cached auth info (useful on logout)
export function clearAuthInfo(): void {
  authInfo = null
  authChecked = false
  // Clear dev override on logout
  setDevRoleOverride(null)
}