/**
 * Notification System Constants
 * Centralized configuration for notifications, toast messages, and notification settings
 */

import {
  MILLISECONDS_PER_MINUTE,
  MILLISECONDS_PER_HOUR,
  MILLISECONDS_PER_DAY,
  DEFAULT_NOTIFICATION_REMINDER_TIME,
  DEFAULT_NOTIFICATION_CHECK_INTERVAL,
} from './business-constants';
import { TASK_CARD_PRIORITY_COLORS } from './task-card-constants';
import { AGENDA_LIST_CARD } from './agenda-list-card-constants';
import {
  COLOR_PRIMARY,
  COLOR_AWARD_RARE,
  COLOR_SUCCESS,
  COLOR_PASTEL_LAVENDER,
} from './color-theme';

// Default notification settings
export const DEFAULT_NOTIFICATION_SETTINGS = {
  enabled: true,
  showBadge: true,
  dueDateReminders: true,
  overdueAlerts: true,
  reminderTime: DEFAULT_NOTIFICATION_REMINDER_TIME,
  checkInterval: DEFAULT_NOTIFICATION_CHECK_INTERVAL,
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
  updateAvailable: 'taskzm_update_available', // Service worker update notification key
  appVersion: 'taskzm_app_version', // Last loaded APP_VERSION — triggers cache purge when bumped
  tourCompleted: 'taskzm_tour_completed', // App tour completion flag
  newSignup: 'taskzm_is_new_signup', // New user signup flag
} as const;

// Notification icon paths
export const NOTIFICATION_ICONS = {
  default: '/icon-192.png',
  badge: '/icon-192.png',
  /** Browser notification icon for Pomodoro completion (small, tab-friendly) */
  pomodoroBrowser: '/favicon.ico',
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
  pomodoroComplete: (taskTitle: string) => `Tracking time reached for "${taskTitle}". Mark complete when done.`,
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
    all: 'All',
    overdue: 'Overdue',
    dueSoon: 'Due Soon',
    pomodoro: 'Focus',
    award: 'Awards',
    toast: 'Updates',
    placeholder: 'Filter',
  },
  groups: {
    today: 'Today',
    yesterday: 'Yesterday',
    earlier: 'Earlier',
  },
  selectAll: 'Select All',
  deselectAll: 'Deselect All',
  clearSelected: 'Clear',
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
  defaultCheckInterval: DEFAULT_NOTIFICATION_SETTINGS.checkInterval * MILLISECONDS_PER_MINUTE, // Convert minutes to ms
} as const;

// Error messages
export const NOTIFICATION_ERRORS = {
  contextError: 'useNotifications must be used within a NotificationProvider',
} as const;

// Pomodoro toast action and error labels (used in PomodoroContext)
export const NOTIFICATION_POMODORO_TOAST = {
  markTaskCompleteLabel: 'Mark task complete',
  markTaskCompleteError: 'Could not mark task complete',
} as const;

// Pomodoro timer UI labels (used in PomodoroTimer)
export const NOTIFICATION_POMODORO_UI = {
  modeLabel: 'Focus',
  pause: 'Pause',
  pausedLabel: 'Paused',
  resumeLabel: 'Resume',
  startFocus: 'Start Focus',
  reset: 'Reset',
  totalTracked: 'Total tracked:',
  durationOf: (durationText: string) => `of ${durationText} duration`,
} as const;

/** Aria labels for Pomodoro timer (task card, agenda, dialog) */
export const NOTIFICATION_POMODORO_ARIA = {
  startTimer: 'Start timer',
  pauseTimer: 'Pause timer',
  resumeTimer: 'Resume timer',
  stopTimer: 'Stop timer',
  timeRemaining: 'Time remaining',
  pausedTimeRemaining: 'Paused - time remaining',
} as const;

/** Accent colors for notification cards — brand-aligned pastels where possible. */
export const NOTIFICATION_CARD_ACCENT_COLORS = {
  taskOverdue: TASK_CARD_PRIORITY_COLORS.urgent.line,
  taskDueSoon: TASK_CARD_PRIORITY_COLORS.high.line,
  pomodoroComplete: COLOR_PRIMARY,
  pomodoroBreak: COLOR_PRIMARY,
  awardEarned: COLOR_AWARD_RARE,
  toastSuccess: COLOR_SUCCESS,
  toastError: TASK_CARD_PRIORITY_COLORS.urgent.line,
  toastWarning: TASK_CARD_PRIORITY_COLORS.high.line,
  toastInfo: TASK_CARD_PRIORITY_COLORS.medium.line,
  system: COLOR_PASTEL_LAVENDER,
} as const;

/** Short badge labels shown on notification cards. */
export const NOTIFICATION_CARD_BADGE_LABELS = {
  taskOverdue: 'Overdue',
  taskDueSoon: 'Due soon',
  pomodoroComplete: 'Pomodoro',
  pomodoroBreak: 'Break',
  awardEarned: 'Award',
  toastSuccess: 'Success',
  toastError: 'Error',
  toastWarning: 'Warning',
  toastInfo: 'Info',
  system: 'System',
} as const;

/** Footer source labels on notification cards. */
export const NOTIFICATION_CARD_FOOTER_LABELS = {
  taskOverdue: 'Task alert',
  taskDueSoon: 'Task reminder',
  pomodoroComplete: 'Focus timer',
  pomodoroBreak: 'Focus timer',
  awardEarned: 'Achievement',
  toastSuccess: 'App update',
  toastError: 'App update',
  toastWarning: 'App update',
  toastInfo: 'App update',
  system: 'System',
} as const;

/** Footer icon names (Phosphor) per notification type. */
export const NOTIFICATION_CARD_FOOTER_ICONS = {
  taskOverdue: 'alert-circle',
  taskDueSoon: 'clock',
  pomodoroComplete: 'timer',
  pomodoroBreak: 'timer',
  awardEarned: 'award',
  toastSuccess: 'check-circle',
  toastError: 'alert-circle',
  toastWarning: 'alert-circle',
  toastInfo: 'bell',
  system: 'bell',
} as const;

export type NotificationCardType =
  | 'task-overdue'
  | 'task-due-soon'
  | 'pomodoro-complete'
  | 'pomodoro-break'
  | 'award-earned'
  | 'system'
  | 'toast-success'
  | 'toast-error'
  | 'toast-info'
  | 'toast-warning';

/** Notification panel layout tokens. */
export const NOTIFICATION_PANEL = {
  sectionGapPx: 20,
  listGapPx: 10,
  sectionTitleFontSizePx: 11,
  sectionTitleLetterSpacingEm: 0.06,
  filterChipGapPx: 8,
  filterChipHeightPx: 32,
} as const;

export const NOTIFICATION_FILTER_OPTIONS = [
  { id: 'all', label: NOTIFICATION_PANEL_TEXT.filters.all, icon: 'bell' },
  { id: NOTIFICATION_TYPES.taskOverdue, label: NOTIFICATION_PANEL_TEXT.filters.overdue, icon: 'alert-circle' },
  { id: NOTIFICATION_TYPES.taskDueSoon, label: NOTIFICATION_PANEL_TEXT.filters.dueSoon, icon: 'clock' },
  { id: NOTIFICATION_TYPES.pomodoroComplete, label: NOTIFICATION_PANEL_TEXT.filters.pomodoro, icon: 'timer' },
  { id: NOTIFICATION_TYPES.awardEarned, label: NOTIFICATION_PANEL_TEXT.filters.award, icon: 'award' },
  { id: 'toast', label: NOTIFICATION_PANEL_TEXT.filters.toast, icon: 'sparkle' },
] as const;

/** Notification card layout tokens (AgendaListCard shell). */
export const NOTIFICATION_CARD = {
  unreadDotSizePx: AGENDA_LIST_CARD.dotSizePx,
  dismissButtonSizePx: 28,
  unreadRingClass: 'ring-1 ring-primary/25 shadow-sm',
} as const;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatNotificationRelativeTime(timestamp: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMins = Math.floor(diffMs / MILLISECONDS_PER_MINUTE);
  const diffHours = Math.floor(diffMs / MILLISECONDS_PER_HOUR);
  const diffDays = Math.floor(diffMs / MILLISECONDS_PER_DAY);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getNotificationGroupKey(timestamp: Date): string {
  const now = startOfDay(new Date());
  const target = startOfDay(timestamp);
  const diffDays = Math.floor((now.getTime() - target.getTime()) / MILLISECONDS_PER_DAY);
  if (diffDays === 0) return 'today';
  if (diffDays === 1) return 'yesterday';
  return 'earlier';
}

export function formatNotificationGroupLabel(groupKey: string): string {
  if (groupKey === 'today') return NOTIFICATION_PANEL_TEXT.groups.today;
  if (groupKey === 'yesterday') return NOTIFICATION_PANEL_TEXT.groups.yesterday;
  return NOTIFICATION_PANEL_TEXT.groups.earlier;
}

export interface NotificationGroup<T extends { timestamp: Date }> {
  key: string;
  label: string;
  items: T[];
}

export function groupNotificationsByDate<T extends { timestamp: Date }>(items: T[]): NotificationGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = getNotificationGroupKey(item.timestamp);
    const existing = groups.get(key);
    if (existing) existing.push(item);
    else groups.set(key, [item]);
  }
  const order = ['today', 'yesterday', 'earlier'];
  return order
    .filter((key) => groups.has(key))
    .map((key) => ({
      key,
      label: formatNotificationGroupLabel(key),
      items: groups.get(key) ?? [],
    }));
}
