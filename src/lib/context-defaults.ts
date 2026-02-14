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
// Note: Context types are not imported to avoid circular dependencies
// All context types are inferred from return values
import {
  DAYS_IN_MONTH_APPROX,
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
  POMODORO_WORK_DURATION,
  DEFAULT_NOTIFICATION_REMINDER_TIME,
  DEFAULT_NOTIFICATION_CHECK_INTERVAL,
} from './business-constants';

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
 * Note: SubscriptionContextType is inferred to avoid circular dependency
 */
export function createDefaultSubscriptionContext() {
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
 * Note: CalendarStatus type is inferred to avoid circular dependency
 */
export function createDefaultCalendarStatus() {
  return {
    google: false,
    outlook: false,
    apple: false,
  };
}

/**
 * Create default CalendarContextType
 * Note: CalendarContextType is inferred to avoid circular dependency
 */
export function createDefaultCalendarContext() {
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
 * Note: TeamContextType is defined inline to avoid circular dependency
 */
export function createDefaultTeamContext() {
  return {
    // Legacy workspace-based team
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
    // New multi-team support
    teams: [],
    currentTeamId: null,
    currentTeamMembers: [],
    isLoadingTeams: false,
    createTeam: async () => {},
    updateTeam: async () => {},
    deleteTeam: async () => {},
    selectTeam: () => {},
    syncTeams: async () => {},
    addTeamMemberToTeam: async () => {},
    removeTeamMemberFromTeam: async () => {},
    updateTeamMemberInTeam: async () => {},
  };
}

/**
 * Create default AISettings
 * Note: AISettings type is inferred to avoid circular dependency
 */
export function createDefaultAISettings() {
  return {
    autoSchedulingEnabled: true,
    priorityBasedScheduling: true,
    scheduleUnscheduledTasks: true,
    maxHoursPerDay: 5, // Default to 5 hours
  };
}

/**
 * Create default AIContextType
 * Note: AIContextType is inferred to avoid circular dependency
 */
export function createDefaultAIContext() {
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
 * Note: ThemeContextType is inferred to avoid circular dependency
 */
export function createDefaultThemeContext() {
  return {
    theme: 'system',
    setTheme: () => {},
    actualTheme: 'light',
  };
}

/**
 * Create default TaskContextType
 * This is the main fallback for useTasks() hook
 * Note: TaskContextType is defined inline to avoid circular dependency
 */
export function createDefaultTaskContext() {
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
    isLoading: true,
    isSyncing: false,
    lastSync: null,
    addTask: async () => {},
    addTaskSeries: async () => {},
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
 * Note: DragDropContextType is inferred to avoid circular dependency
 */
export function createDefaultDragDropContext() {
  return {
    activeId: null,
  };
}

/**
 * Create default PomodoroContextType
 * Note: PomodoroContextType is inferred to avoid circular dependency
 */
export function createDefaultPomodoroContext() {
  return {
    getTimerState: () => ({
      mode: 'work',
      timeLeft: POMODORO_WORK_DURATION,
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
    timers: {}, // Default empty timers object
  };
}

/**
 * Create default AwardContextType
 * Note: AwardContextType is inferred to avoid circular dependency
 */
export function createDefaultAwardContext() {
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
 * Note: NotificationContextType is inferred to avoid circular dependency
 */
export function createDefaultNotificationContext() {
  return {
    permission: 'default',
    settings: {
      enabled: true,
      showBadge: true,
      dueDateReminders: true,
      overdueAlerts: true,
      reminderTime: DEFAULT_NOTIFICATION_REMINDER_TIME,
      checkInterval: DEFAULT_NOTIFICATION_CHECK_INTERVAL,
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
 * Note: SidebarContextType is inferred to avoid circular dependency
 */
export function createDefaultSidebarContext() {
  return {
    sidebarOpen: false,
    setSidebarOpen: () => {},
    toggleSidebar: () => {},
  };
}

