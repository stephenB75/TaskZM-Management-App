/**
 * Notification System Constants
 * Centralized configuration for notifications, toast messages, and notification settings
 */

// Default notification settings
export const DEFAULT_NOTIFICATION_SETTINGS = {
  enabled: true,
  showBadge: true,
  dueDateReminders: true,
  overdueAlerts: true,
  reminderTime: 60, // 1 hour before due date (in minutes)
  checkInterval: 15, // Check every 15 minutes (in minutes)
} as const;

// LocalStorage keys
export const NOTIFICATION_STORAGE_KEYS = {
  settings: 'notificationSettings',
  notifiedTasks: 'notifiedTasks',
  readNotifications: 'readNotifications',
  dismissedNotifications: 'dismissedNotifications',
  lastSeenPomodoroSessions: 'lastSeenPomodoroSessions',
  lastSeenAwards: 'lastSeenAwards',
  toastNotifications: 'toastNotifications',
} as const;

// Notification icon paths
export const NOTIFICATION_ICONS = {
  default: '/icon-192.png',
  badge: '/icon-192.png',
} as const;

// Toast messages
export const NOTIFICATION_TOAST_MESSAGES = {
  notSupported: 'Notifications are not supported in this browser',
  blocked: 'Notifications are blocked. Please enable them in your browser settings.',
  enabled: 'Notifications enabled',
  permissionDenied: 'Notification permission denied',
  requestFailed: 'Failed to request notification permission',
  permissionDeniedInfo: 'Permission denied',
  permissionDeniedDescription: 'Check the instructions below to enable notifications in your browser settings.',
} as const;

// Browser notification titles and messages
export const NOTIFICATION_TITLES = {
  taskOverdue: 'Task Overdue',
  taskDueSoon: 'Task Due Soon',
  taskDueNow: 'Task Due Now',
  taskUpcoming: 'Upcoming Task',
  pomodoroComplete: 'Pomodoro Complete! 🍅',
  pomodoroBreak: 'Break Over! ☕',
  awardEarned: 'Achievement Unlocked! 🏆',
} as const;

// Notification body message templates
export const NOTIFICATION_MESSAGES = {
  taskWasDue: (taskTitle: string, dueDate: string) => `${taskTitle} was due ${dueDate}`,
  taskDueIn: (taskTitle: string, timeText: string) => `${taskTitle} is due in ${timeText}`,
  taskDueNow: (taskTitle: string) => `${taskTitle} is due now!`,
  taskUpcoming: (taskTitle: string, timeText: string) => `${taskTitle} is upcoming in ${timeText}`,
  timeMinutes: (minutes: number) => `${minutes} minutes`,
  timeHours: (hours: number) => `${hours} hours`,
  pomodoroComplete: (taskTitle: string) => `Great work on "${taskTitle}"! Time for a break.`,
  pomodoroBreakOver: (taskTitle: string) => `Ready to focus on "${taskTitle}" again?`,
  pomodoroSessionsCompleted: (count: number, taskTitle: string) => 
    `Completed ${count} session${count > 1 ? 's' : ''} for "${taskTitle}"`,
  awardEarned: (awardName: string) => `You earned "${awardName}"! 🎉`,
  unreadCount: (count: number) => `${count} unread notification${count === 1 ? '' : 's'}`,
  defaultTaskTitle: 'Task', // Fallback task title when task title is missing
} as const;

// Notification panel UI text
export const NOTIFICATION_PANEL_TEXT = {
  title: 'Notifications',
  markAllRead: 'Mark all read',
  markRead: 'Mark read',
  emptyState: {
    noNotifications: 'No notifications',
    noNotificationsOfType: 'No notifications of this type',
    allCaughtUp: "You're all caught up!",
  },
  filters: {
    all: 'All Notifications',
    overdue: 'Overdue Tasks',
    dueSoon: 'Due Soon',
    pomodoro: 'Pomodoro',
    award: 'Achievements',
    toast: 'App Notifications',
    placeholder: 'Filter',
  },
  permission: {
    granted: 'Granted',
    denied: 'Denied',
    notSet: 'Not Set',
    enable: 'Enable Notifications',
    blocked: 'Notifications Blocked (Enable in Browser Settings)',
  },
  badge: {
    showAppIconBadge: 'Show App Icon Badge',
    displayTaskCount: 'Display task count on app icon',
    currentBadgeCount: 'Current Badge Count',
    taskNeedsAttention: 'task needs attention',
    tasksNeedAttention: 'tasks need attention',
  },
} as const;

// Notification type identifiers
export const NOTIFICATION_TYPES = {
  taskOverdue: 'task-overdue',
  taskDueSoon: 'task-due-soon',
  pomodoroComplete: 'pomodoro-complete',
  pomodoroBreak: 'pomodoro-break',
  awardEarned: 'award-earned',
  system: 'system',
  toast: 'toast',
} as const;

// Notification tag prefixes (for browser notifications)
export const NOTIFICATION_TAG_PREFIXES = {
  overdue: 'overdue_',
  reminder: 'reminder_',
  pomodoro: 'pomodoro_',
} as const;

// Time formatting constants
export const NOTIFICATION_TIME_FORMATS = {
  minutesThreshold: 60, // Show "X minutes" if less than 60, otherwise "X hours"
  cleanupHours: 24, // Clean up notifications older than 24 hours
} as const;

// Notification check intervals (in milliseconds)
export const NOTIFICATION_INTERVALS = {
  taskUpdateDelay: 100, // Delay before checking notifications after task update (ms)
  defaultCheckInterval: DEFAULT_NOTIFICATION_SETTINGS.checkInterval * 60 * 1000, // Convert minutes to ms
} as const;

// Error messages
export const NOTIFICATION_ERRORS = {
  contextError: 'useNotifications must be used within a NotificationProvider',
} as const;

