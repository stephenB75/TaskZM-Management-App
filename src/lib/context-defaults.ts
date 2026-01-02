/**
 * Type-Safe Context Default Factories
 * 
 * Centralized factory functions that return properly typed default values
 * for all context providers. These ensure type safety and consistency
 * across fallback objects in context hooks.
 */

import type {
  HoursSettings,
  RolloverSettings,
  ViewConfig,
  TaskFilters,
  SubscriptionInfo,
  SubscriptionFeatures,
} from '../types';
import type { TaskContextType } from '../contexts/TaskContext';
import type { SubscriptionContextType } from '../contexts/SubscriptionContext';
import type { TeamContextType } from '../contexts/TeamContext';
import type { CalendarContextType, CalendarStatus } from '../contexts/CalendarContext';
import type { AIContextType, AISettings } from '../contexts/AIContext';
import type { ThemeContextType } from '../contexts/ThemeContext';
import type { DragDropContextType } from '../contexts/DragDropContext';
import type { PomodoroContextType } from '../contexts/PomodoroContext';
import type { AwardContextType } from '../contexts/AwardContext';
import type { NotificationContextType } from '../contexts/NotificationContext';
import type { SidebarContextType } from '../contexts/SidebarContext';
import {
  DEFAULT_WEEKDAY_WORK_START,
  DEFAULT_WEEKDAY_WORK_END,
  DEFAULT_WEEKDAY_PERSONAL_START,
  DEFAULT_WEEKDAY_PERSONAL_END,
  DEFAULT_WEEKDAY_PROJECTS_START,
  DEFAULT_WEEKDAY_PROJECTS_END,
  DEFAULT_WEEKEND_WORK_START,
  DEFAULT_WEEKEND_WORK_END,
  DEFAULT_WEEKEND_PERSONAL_START,
  DEFAULT_WEEKEND_PERSONAL_END,
  DEFAULT_WEEKEND_PROJECTS_START,
  DEFAULT_WEEKEND_PROJECTS_END,
  DEFAULT_TAGS,
} from './business-constants';
import { DAYS_IN_MONTH_APPROX } from './business-constants';

/**
 * Create default HoursSettings
 */
export function createDefaultHoursSettings(): HoursSettings {
  return {
    weekdayHours: {
      work: {
        start: DEFAULT_WEEKDAY_WORK_START,
        end: DEFAULT_WEEKDAY_WORK_END,
        enabled: true,
      },
      personal: {
        start: DEFAULT_WEEKDAY_PERSONAL_START,
        end: DEFAULT_WEEKDAY_PERSONAL_END,
        enabled: true,
      },
      projects: {
        start: DEFAULT_WEEKDAY_PROJECTS_START,
        end: DEFAULT_WEEKDAY_PROJECTS_END,
        enabled: true,
      },
    },
    weekendHours: {
      work: {
        start: DEFAULT_WEEKEND_WORK_START,
        end: DEFAULT_WEEKEND_WORK_END,
        enabled: false,
      },
      personal: {
        start: DEFAULT_WEEKEND_PERSONAL_START,
        end: DEFAULT_WEEKEND_PERSONAL_END,
        enabled: true,
      },
      projects: {
        start: DEFAULT_WEEKEND_PROJECTS_START,
        end: DEFAULT_WEEKEND_PROJECTS_END,
        enabled: false,
      },
    },
    respectHours: true,
  };
}

/**
 * Create default RolloverSettings
 */
export function createDefaultRolloverSettings(): RolloverSettings {
  return {
    autoRollover: false,
    askBeforeRolling: false,
  };
}

/**
 * Create default ViewConfig
 */
export function createDefaultViewConfig(): ViewConfig {
  return {
    groupBy: 'none',
    sortBy: 'dueDate',
    sortOrder: 'asc',
    showCompleted: true,
  };
}

/**
 * Create default TaskFilters
 */
export function createDefaultTaskFilters(): TaskFilters {
  return {};
}

/**
 * Get default subscription features based on tier
 * This matches the logic in SubscriptionContext
 */
function getDefaultFeatures(tier: 'free' | 'pro', billingPeriod?: 'monthly' | 'yearly' | null): SubscriptionFeatures {
  if (tier === 'pro') {
    const isYearly = billingPeriod === 'yearly';
    
    return {
      unlimitedTasks: true,
      customTags: true,
      aiScheduler: true,
      aiSchedulerLimit: undefined, // Unlimited for pro
      taskHours: true,
      analytics: true,
      analyticsDaysLimit: isYearly ? undefined : DAYS_IN_MONTH_APPROX,
      taskRollover: true,
      pomodoroTimer: true,
      teamFeatures: isYearly,
      teamMembersLimit: isYearly ? undefined : 0,
      calendarSync: true,
      calendarSyncLimit: isYearly ? undefined : 1,
      recurringTasks: true,
      recurringTasksLimit: isYearly ? undefined : 5,
      taskTemplates: isYearly,
      taskDependencies: isYearly,
      multipleWorkspaces: isYearly,
    };
  }
  
  // Free tier
  return {
    unlimitedTasks: true,
    customTags: true,
    aiScheduler: true,
    aiSchedulerLimit: 3, // 3 suggestions per week
    taskHours: false,
    analytics: false,
    analyticsDaysLimit: undefined,
    taskRollover: false,
    pomodoroTimer: true,
    teamFeatures: false,
    teamMembersLimit: 0,
    calendarSync: false,
    recurringTasks: false,
    taskTemplates: false,
    taskDependencies: false,
    multipleWorkspaces: false,
  };
}

/**
 * Create default SubscriptionInfo
 */
export function createDefaultSubscriptionInfo(): SubscriptionInfo {
  return {
    tier: 'free',
    status: 'active',
    startDate: null,
    endDate: null,
    cancelAtPeriodEnd: false,
    billingPeriod: null,
  };
}

/**
 * Create default SubscriptionContextType
 */
export function createDefaultSubscriptionContext(): SubscriptionContextType {
  const subscription = createDefaultSubscriptionInfo();
  return {
    subscription,
    features: getDefaultFeatures('free'),
    isLoading: true,
    upgradeToPro: async () => {},
    cancelSubscription: async () => {},
    downgradeToFree: async () => {},
    refreshSubscription: async () => {},
    hasFeature: () => false,
  };
}

/**
 * Create default CalendarStatus
 */
export function createDefaultCalendarStatus(): CalendarStatus {
  return {
    google: false,
    outlook: false,
    apple: false,
  };
}

/**
 * Create default CalendarContextType
 */
export function createDefaultCalendarContext(): CalendarContextType {
  return {
    calendarStatus: createDefaultCalendarStatus(),
    isSyncing: false,
    lastSync: null,
    connectCalendar: async () => {},
    disconnectCalendar: async () => {},
    syncTask: async () => {},
    syncAllTasks: async () => {},
    checkCalendarStatus: async () => {},
    testAppleConnection: async () => ({
      success: false,
      error: 'Not connected',
    }),
  };
}

/**
 * Create default TeamContextType
 */
export function createDefaultTeamContext(): TeamContextType {
  return {
    teamMembers: [],
    isLoading: false,
    addTeamMember: async () => {},
    removeTeamMember: async () => {},
    updateTeamMember: async () => {},
    getTeamMember: () => undefined,
    markMemberAsViewed: () => {},
    acceptInvitation: () => {},
    resendInvitation: async () => {},
    declineInvitation: async () => {},
    syncTeamMembers: async () => {},
  };
}

/**
 * Create default AISettings
 */
export function createDefaultAISettings(): AISettings {
  return {
    autoSchedulingEnabled: true,
    priorityBasedScheduling: true,
    scheduleUnscheduledTasks: true,
  };
}

/**
 * Create default AIContextType
 */
export function createDefaultAIContext(): AIContextType {
  return {
    settings: createDefaultAISettings(),
    updateSettings: () => {},
    toggleAutoScheduling: () => {},
    togglePriorityBasedScheduling: () => {},
    toggleScheduleUnscheduledTasks: () => {},
  };
}

/**
 * Create default ThemeContextType
 */
export function createDefaultThemeContext(): ThemeContextType {
  return {
    theme: 'system',
    setTheme: () => {},
    actualTheme: 'light',
  };
}

/**
 * Create default TaskContextType
 * This is the main fallback for useTasks() hook
 */
export function createDefaultTaskContext(): TaskContextType {
  return {
    tasks: [],
    projects: [],
    folders: [],
    availableTags: DEFAULT_TAGS,
    filters: createDefaultTaskFilters(),
    viewConfig: createDefaultViewConfig(),
    hoursSettings: createDefaultHoursSettings(),
    rolloverSettings: createDefaultRolloverSettings(),
    workspaceId: null,
    isSyncing: false,
    lastSync: null,
    addTask: async () => {},
    updateTask: async () => {},
    deleteTask: async () => {},
    bulkDeleteTasks: async () => {},
    addProject: async () => {},
    updateProject: async () => {},
    addFolder: async () => {},
    updateFolder: async () => {},
    deleteFolder: async () => {},
    addAvailableTag: async () => {},
    removeAvailableTag: async () => {},
    setFilters: () => {},
    setViewConfig: () => {},
    updateHoursSettings: async () => {},
    updateRolloverSettings: async () => {},
    syncWithServer: async () => {},
    ensureWorkspace: async () => null,
  };
}

/**
 * Create default DragDropContextType
 */
export function createDefaultDragDropContext(): DragDropContextType {
  return {
    activeId: null,
  };
}

/**
 * Create default PomodoroContextType
 */
export function createDefaultPomodoroContext(): PomodoroContextType {
  return {
    getTimerState: () => ({
      mode: 'work',
      timeLeft: 25 * 60,
      isRunning: false,
      sessionsCompleted: 0,
      totalTimeTracked: 0,
    }),
    startTimer: () => {},
    pauseTimer: async () => {},
    stopTimer: async () => {},
    initializeTimer: () => {},
    setWorkDuration: () => {},
    registerCallback: () => {},
    unregisterCallback: async () => {},
  };
}

/**
 * Create default AwardContextType
 */
export function createDefaultAwardContext(): AwardContextType {
  return {
    awards: [],
    earnedAwards: [],
    checkAndAwardAchievements: async () => [],
    getAwardProgress: () => null,
    celebrationQueue: [],
    dismissCelebration: () => {},
  };
}

/**
 * Create default NotificationContextType
 */
export function createDefaultNotificationContext(): NotificationContextType {
  return {
    permission: 'default',
    settings: {
      enabled: true,
      showBadge: true,
      dueDateReminders: true,
      overdueAlerts: true,
      reminderTime: 60,
      checkInterval: 15,
    },
    badgeCount: 0,
    requestPermission: async () => false,
    updateSettings: () => {},
    updateBadge: () => {},
    addToastNotification: () => {},
    getToastNotifications: () => [],
    markToastAsRead: () => {},
    clearToastNotification: () => {},
  };
}

/**
 * Create default SidebarContextType
 */
export function createDefaultSidebarContext(): SidebarContextType {
  return {
    sidebarOpen: false,
    setSidebarOpen: () => {},
    toggleSidebar: () => {},
  };
}

