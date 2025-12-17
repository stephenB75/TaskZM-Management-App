/**
 * Feature Gating Utilities
 * Centralized utilities for checking feature access and displaying upgrade prompts
 */

import { useSubscription } from '../contexts/SubscriptionContext';
import type { SubscriptionFeatures } from '../types';

/**
 * Hook to check if a feature is available
 * @param feature - The feature key to check
 * @returns boolean indicating if feature is available
 */
export function useFeatureGate(feature: keyof SubscriptionFeatures): boolean {
  const { hasFeature } = useSubscription();
  return hasFeature(feature);
}

/**
 * Hook to get feature access info including limits
 * @param feature - The feature key to check
 * @returns Object with access info
 */
export function useFeatureAccess(feature: keyof SubscriptionFeatures) {
  const { features, hasFeature } = useSubscription();
  
  return {
    hasAccess: hasFeature(feature),
    feature: features[feature],
    // Specific limit checks
    aiSchedulerLimit: features.aiSchedulerLimit,
    analyticsDaysLimit: features.analyticsDaysLimit,
    teamMembersLimit: features.teamMembersLimit,
    recurringTasksLimit: features.recurringTasksLimit,
    calendarSyncLimit: features.calendarSyncLimit,
  };
}

/**
 * Check if a feature requires Pro (monthly or yearly)
 */
export function requiresPro(feature: keyof SubscriptionFeatures): boolean {
  const proFeatures: (keyof SubscriptionFeatures)[] = [
    'taskHours',
    'analytics',
    'taskRollover',
    'calendarSync',
    'recurringTasks', // Available in both monthly and yearly Pro
  ];
  return proFeatures.includes(feature);
}

/**
 * Check if a feature requires Pro Yearly
 */
export function requiresProYearly(feature: keyof SubscriptionFeatures): boolean {
  const yearlyFeatures: (keyof SubscriptionFeatures)[] = [
    'taskTemplates',
    'taskDependencies',
    'multipleWorkspaces',
    'teamFeatures',
  ];
  return yearlyFeatures.includes(feature);
}

/**
 * Get upgrade message for a locked feature
 */
export function getUpgradeMessage(feature: keyof SubscriptionFeatures): {
  title: string;
  description: string;
  requiredTier: 'Pro Monthly' | 'Pro Yearly';
} {
  if (requiresProYearly(feature)) {
    return {
      title: 'Pro Yearly Feature',
      description: `This feature is available with Pro Yearly subscription. Upgrade to unlock ${getFeatureName(feature)}.`,
      requiredTier: 'Pro Yearly',
    };
  }
  
  if (requiresPro(feature)) {
    return {
      title: 'Pro Feature',
      description: `This feature is available with Pro subscription. Upgrade to unlock ${getFeatureName(feature)}.`,
      requiredTier: 'Pro Monthly',
    };
  }
  
  return {
    title: 'Feature Unavailable',
    description: 'This feature is not available.',
    requiredTier: 'Pro Monthly',
  };
}

/**
 * Get human-readable feature name
 */
function getFeatureName(feature: keyof SubscriptionFeatures): string {
  const names: Record<keyof SubscriptionFeatures, string> = {
    unlimitedTasks: 'Unlimited Tasks',
    calendar: 'Calendar',
    customTags: 'Custom Tags',
    aiScheduler: 'AI Scheduler',
    taskHours: 'Task Hours & Time Tracking',
    analytics: 'Analytics Dashboard',
    taskRollover: 'Auto Task Rollover',
    pomodoroTimer: 'Pomodoro Timer',
    teamFeatures: 'Team Collaboration',
    calendarSync: 'Calendar Sync',
    recurringTasks: 'Recurring Tasks',
    taskTemplates: 'Task Templates',
    taskDependencies: 'Task Dependencies',
    multipleWorkspaces: 'Multiple Workspaces',
  };
  return names[feature] || feature;
}
