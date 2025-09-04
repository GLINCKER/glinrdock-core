// Authentication utilities  
import { apiClient } from './api'

// Export the auth functions for backward compatibility
export { getAuthInfo, initializeAuth, clearAuthInfo } from './rbac'

// Sign out function
export async function signOut(): Promise<void> {
  try {
    // Check auth method first
    const auth = await apiClient.getAuthInfo()
    
    // Clear local token
    apiClient.clearToken()
    
    // If using session auth, call OAuth logout endpoint
    if (auth?.method === 'session') {
      try {
        await apiClient.post('/auth/oauth/logout')
      } catch (error) {
        console.warn('OAuth logout endpoint failed:', error)
      }
    }
    
    // Redirect to login
    window.location.href = '/app/login'
  } catch (error) {
    console.error('Sign out failed:', error)
    // Force redirect anyway
    window.location.href = '/app/login'
  }
}

// Check if user is signed in
export function isSignedIn(): boolean {
  return apiClient.isAuthenticated()
}