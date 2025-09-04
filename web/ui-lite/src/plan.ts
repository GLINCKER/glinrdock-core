// Plan management and context for quota tracking
import { apiClient, type PlanInfo } from './api'

// Re-export PlanInfo type for other components
export type { PlanInfo } from './api'

export type PlanType = 'FREE' | 'PRO' | 'PREMIUM';

// Plan colors for UI
export const PLAN_COLORS: Record<PlanType, string> = {
  FREE: 'text-green-600 bg-green-100 dark:text-green-400 dark:bg-green-900/20',
  PRO: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-900/20',
  PREMIUM: 'text-purple-600 bg-purple-100 dark:text-purple-400 dark:bg-purple-900/20',
};

// Global plan state
let planInfo: PlanInfo | null = null;
let planListeners: ((plan: PlanInfo | null) => void)[] = [];

// Fetch plan information from API
export async function fetchPlanInfo(): Promise<PlanInfo | null> {
  try {
    const data = await apiClient.getSystemPlan();
    planInfo = data;
    notifyPlanListeners();
    return data;
  } catch (error) {
    console.error('Error fetching plan info:', error);
    return null;
  }
}

// Refresh plan info and notify listeners
export async function refreshPlanInfo(): Promise<void> {
  await fetchPlanInfo();
}

// Subscribe to plan changes
export function subscribeToPlan(listener: (plan: PlanInfo | null) => void): () => void {
  planListeners.push(listener);
  
  // Immediately call with current plan if available
  if (planInfo) {
    listener(planInfo);
  }
  
  // Return unsubscribe function
  return () => {
    const index = planListeners.indexOf(listener);
    if (index > -1) {
      planListeners.splice(index, 1);
    }
  };
}

// Notify all listeners
function notifyPlanListeners() {
  planListeners.forEach(listener => listener(planInfo));
}

// Get current plan info (cached)
export function getCurrentPlan(): PlanInfo | null {
  return planInfo;
}

// Check if a limit is unlimited
export function isUnlimited(limit: number | string): boolean {
  return limit === 'unlimited' || limit === -1;
}

// Calculate usage percentage for progress bars
export function getUsagePercentage(current: number, limit: number | string): number {
  if (isUnlimited(limit)) return 0;
  const numLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;
  return Math.min((current / numLimit) * 100, 100);
}

// Check if usage is near limit (80%+)
export function isNearLimit(current: number, limit: number | string): boolean {
  return getUsagePercentage(current, limit) >= 80;
}

// Check if usage is at limit
export function isAtLimit(current: number, limit: number | string): boolean {
  if (isUnlimited(limit)) return false;
  const numLimit = typeof limit === 'string' ? parseInt(limit, 10) : limit;
  return current >= numLimit;
}

// Format limit for display
export function formatLimit(limit: number | string): string {
  return isUnlimited(limit) ? 'Unlimited' : limit.toString();
}

// Get upgrade suggestion text
export function getUpgradeSuggestion(currentPlan: string): string {
  switch (currentPlan) {
    case 'FREE':
      return 'Set GLINRDOCK_PLAN=PRO to increase limits';
    case 'PRO':
      return 'Set GLINRDOCK_PLAN=PREMIUM for unlimited resources';
    default:
      return 'Contact support for assistance';
  }
}

// Initialize plan info on app start
export async function initializePlan(): Promise<void> {
  await fetchPlanInfo();
}

// Quota exceeded error type
export interface QuotaError {
  error: string;
  type: string;
  message: string;
  current: number;
  limit: number;
  plan: string;
  upgrade_hint: string;
}

// Handle quota exceeded errors
export function handleQuotaError(error: QuotaError): void {
  // Show upgrade modal or toast
  showUpgradeModal(error);
}

// Show upgrade modal (to be implemented with a proper modal component)
function showUpgradeModal(error: QuotaError): void {
  // For now, just show an alert
  // In a real implementation, this would show a proper modal
  alert(`Quota Exceeded\n\n${error.message}\n\n${error.upgrade_hint}`);
}

// Feature availability checker
export function isFeatureAvailable(feature: keyof PlanInfo['features']): boolean {
  if (!planInfo) return false;
  return planInfo.features[feature];
}

// Plan badge component data
export function getPlanBadgeProps(plan: string): { text: string; className: string } {
  const planType = plan as PlanType;
  return {
    text: planType,
    className: PLAN_COLORS[planType] || PLAN_COLORS.FREE,
  };
}