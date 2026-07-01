/**
 * Native Notification Helper
 * Provides unified interface for browser and native (iOS/Android) notifications
 */

import type { Task } from '../types';
import { getPlatform } from './platform';
import {
  MOBILE_NOTIFICATION_SMALL_ICON,
  MOBILE_NOTIFICATION_ICON_COLOR,
} from './mobile-constants';
import { logger } from './logger';
import {
  NOTIFICATION_TITLES,
  NOTIFICATION_MESSAGES,
  NOTIFICATION_ICONS,
  NOTIFICATION_TAG_PREFIXES,
  NOTIFICATION_STORAGE_KEYS,
  NOTIFICATION_OPEN_TASK_EVENT,
  SCHEDULED_NOTIFICATION_PREFIXES,
} from './notification-constants';
import { MILLISECONDS_PER_MINUTE, MINUTES_PER_HOUR } from './business-constants';
import { TIMING_CONSTANTS } from './timing-constants';
import {
  getDueSoonTasks,
  getOverdueNotificationTime,
  getOverdueTasks,
  getTaskNotificationTargetDate,
  isEligibleForTaskNotification,
  isTaskDueNow,
} from './notification-task-filters';
import { getFromLocalStorage, saveToLocalStorage } from './utils';

interface NotificationOptions {
  title: string;
  body: string;
  tag?: string;
  requireInteraction?: boolean;
  data?: Record<string, unknown>;
}

export interface TaskNotificationSyncSettings {
  enabled: boolean;
  dueDateReminders: boolean;
  overdueAlerts: boolean;
  reminderTime: number;
}

/** Deterministic Capacitor notification ID from prefix + task id. */
export function getScheduledNotificationId(prefix: string, taskId: string): number {
  const str = `${prefix}_${taskId}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 2147483647 || 1;
}

function tagToNotificationId(tag: string): number {
  return getScheduledNotificationId('tag', tag);
}

function markTaskNotified(taskId: string, type: 'overdue' | 'reminder'): void {
  const prefix =
    type === 'overdue' ? NOTIFICATION_TAG_PREFIXES.overdue : NOTIFICATION_TAG_PREFIXES.reminder;
  const key = `${prefix}${taskId}`;
  const notified = new Set(getFromLocalStorage<string[]>(NOTIFICATION_STORAGE_KEYS.notifiedTasks, []));
  notified.add(key);
  saveToLocalStorage(NOTIFICATION_STORAGE_KEYS.notifiedTasks, Array.from(notified));
}

function buildDueSoonCopy(task: Task, now: Date): { title: string; body: string; requireInteraction: boolean } {
  const targetDate = getTaskNotificationTargetDate(task);
  if (!targetDate) {
    return {
      title: NOTIFICATION_TITLES.taskDueSoon,
      body: task.title,
      requireInteraction: false,
    };
  }
  const timeUntil = Math.round((targetDate.getTime() - now.getTime()) / MILLISECONDS_PER_MINUTE);
  const isDueNow = isTaskDueNow(task, now);
  const timeText =
    timeUntil < 60
      ? NOTIFICATION_MESSAGES.timeMinutes(timeUntil)
      : NOTIFICATION_MESSAGES.timeHours(Math.round(timeUntil / MINUTES_PER_HOUR));
  return {
    title: isDueNow ? NOTIFICATION_TITLES.taskDueNow : NOTIFICATION_TITLES.taskUpcoming,
    body: isDueNow
      ? NOTIFICATION_MESSAGES.taskDueNow(task.title)
      : NOTIFICATION_MESSAGES.taskUpcoming(task.title, timeText),
    requireInteraction: isDueNow,
  };
}

async function loadLocalNotifications() {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  return LocalNotifications;
}

/**
 * Check if native notifications are available (Capacitor Local Notifications)
 */
export async function isNativeNotificationsAvailable(): Promise<boolean> {
  const platform = getPlatform();
  if (!platform.isNative) return false;

  try {
    await loadLocalNotifications();
    return true;
  } catch (error) {
    logger.debug('Local Notifications plugin not available:', error);
    return false;
  }
}

/**
 * Request notification permission (works for both browser and native)
 */
export async function requestNotificationPermission(): Promise<'granted' | 'denied' | 'default'> {
  const platform = getPlatform();

  if (platform.isNative) {
    try {
      const LocalNotifications = await loadLocalNotifications();
      const result = await LocalNotifications.requestPermissions();
      if (result.display === 'granted') return 'granted';
      if (result.display === 'denied') return 'denied';
      return 'default';
    } catch (error) {
      logger.error('Error requesting native notification permission:', error);
      return 'default';
    }
  }

  if (!('Notification' in window)) return 'default';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';

  try {
    const result = await Notification.requestPermission();
    return result as 'granted' | 'denied' | 'default';
  } catch (error) {
    logger.error('Error requesting browser notification permission:', error);
    return 'default';
  }
}

/**
 * Check current notification permission status
 */
export async function getNotificationPermission(): Promise<'granted' | 'denied' | 'default'> {
  const platform = getPlatform();

  if (platform.isNative) {
    try {
      const LocalNotifications = await loadLocalNotifications();
      const result = await LocalNotifications.checkPermissions();
      return result.display as 'granted' | 'denied' | 'default';
    } catch (error) {
      logger.debug('Could not check native notification permission:', error);
      return 'default';
    }
  }

  if (!('Notification' in window)) return 'default';
  return Notification.permission as 'granted' | 'denied' | 'default';
}

/**
 * Show a notification (uses native on iOS/Android, browser on web)
 */
export async function showNotification(options: NotificationOptions): Promise<void> {
  const platform = getPlatform();

  if (platform.isNative) {
    try {
      const LocalNotifications = await loadLocalNotifications();
      const notificationId = options.tag ? tagToNotificationId(options.tag) : Date.now();

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title: options.title,
            body: options.body,
            sound: 'default',
            actionTypeId: '',
            extra: options.data ?? {},
            ...(platform.isIOS && { summary: options.title }),
            ...(platform.isAndroid && {
              smallIcon: MOBILE_NOTIFICATION_SMALL_ICON,
              iconColor: MOBILE_NOTIFICATION_ICON_COLOR,
            }),
          },
        ],
      });

      logger.debug('Native notification sent:', options.title);
    } catch (error) {
      logger.error('Failed to show native notification:', error);
      throw error;
    }
    return;
  }

  if (!('Notification' in window)) {
    throw new Error('Notifications are not supported in this browser');
  }

  if (Notification.permission !== 'granted') {
    throw new Error('Notification permission not granted');
  }

  try {
    const notification = new Notification(options.title, {
      body: options.body,
      icon: NOTIFICATION_ICONS.default,
      badge: NOTIFICATION_ICONS.badge,
      tag: options.tag,
      requireInteraction: options.requireInteraction ?? false,
      data: options.data,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      const taskId = options.data?.taskId;
      if (typeof taskId === 'string') {
        window.dispatchEvent(
          new CustomEvent(NOTIFICATION_OPEN_TASK_EVENT, { detail: { taskId } }),
        );
      }
    };

    logger.debug('Browser notification sent:', options.title);
  } catch (error) {
    logger.error('Failed to show browser notification:', error);
    throw error;
  }
}

/**
 * Schedule future task reminders on native (background delivery when app is closed).
 */
export async function syncScheduledTaskNotifications(
  tasks: Task[],
  settings: TaskNotificationSyncSettings,
  permission: 'granted' | 'denied' | 'default',
): Promise<void> {
  const platform = getPlatform();
  if (!platform.isNative) return;

  try {
    const LocalNotifications = await loadLocalNotifications();
    const now = new Date();
    const cancelIds: { id: number }[] = [];

    for (const task of tasks) {
      cancelIds.push(
        { id: getScheduledNotificationId(SCHEDULED_NOTIFICATION_PREFIXES.reminder, task.id) },
        { id: getScheduledNotificationId(SCHEDULED_NOTIFICATION_PREFIXES.overdue, task.id) },
      );
    }

    if (cancelIds.length > 0) {
      await LocalNotifications.cancel({ notifications: cancelIds });
    }

    if (!settings.enabled || permission !== 'granted') return;

    const scheduled: Array<{
      id: number;
      title: string;
      body: string;
      schedule: { at: Date; allowWhileIdle?: boolean };
      sound: string;
      extra: Record<string, unknown>;
      summary?: string;
      smallIcon?: string;
      iconColor?: string;
    }> = [];

    for (const task of tasks) {
      if (!isEligibleForTaskNotification(task)) continue;
      const targetDate = getTaskNotificationTargetDate(task);
      if (!targetDate) continue;

      if (settings.dueDateReminders) {
        const reminderAt = new Date(targetDate.getTime() - settings.reminderTime * MILLISECONDS_PER_MINUTE);
        if (reminderAt > now) {
          const copy = buildDueSoonCopy(task, reminderAt);
          scheduled.push({
            id: getScheduledNotificationId(SCHEDULED_NOTIFICATION_PREFIXES.reminder, task.id),
            title: copy.title,
            body: copy.body,
            schedule: { at: reminderAt, allowWhileIdle: true },
            sound: 'default',
            extra: { taskId: task.id, type: 'reminder' },
            ...(platform.isIOS && { summary: copy.title }),
            ...(platform.isAndroid && {
              smallIcon: MOBILE_NOTIFICATION_SMALL_ICON,
              iconColor: MOBILE_NOTIFICATION_ICON_COLOR,
            }),
          });
        }
      }

      if (settings.overdueAlerts) {
        const overdueAt = getOverdueNotificationTime(targetDate);
        if (overdueAt > now) {
          const dateText = targetDate.toLocaleDateString();
          scheduled.push({
            id: getScheduledNotificationId(SCHEDULED_NOTIFICATION_PREFIXES.overdue, task.id),
            title: NOTIFICATION_TITLES.taskOverdue,
            body: NOTIFICATION_MESSAGES.taskWasDue(task.title, dateText),
            schedule: { at: overdueAt, allowWhileIdle: true },
            sound: 'default',
            extra: { taskId: task.id, type: 'overdue' },
            ...(platform.isIOS && { summary: NOTIFICATION_TITLES.taskOverdue }),
            ...(platform.isAndroid && {
              smallIcon: MOBILE_NOTIFICATION_SMALL_ICON,
              iconColor: MOBILE_NOTIFICATION_ICON_COLOR,
            }),
          });
        }
      }
    }

    if (scheduled.length > 0) {
      await LocalNotifications.schedule({ notifications: scheduled });
      logger.debug(`Scheduled ${scheduled.length} native task notification(s)`);
    }
  } catch (error) {
    logger.error('Failed to sync scheduled task notifications:', error);
  }
}

/** Register native notification tap + delivery listeners (call once on app start). */
export function initNativeNotificationHandlers(): void {
  const platform = getPlatform();
  if (!platform.isNative) return;

  void (async () => {
    try {
      const LocalNotifications = await loadLocalNotifications();

      await LocalNotifications.addListener('localNotificationReceived', (event) => {
        const extra = event.notification.extra as { taskId?: string; type?: 'overdue' | 'reminder' } | undefined;
        if (extra?.taskId && extra.type) {
          markTaskNotified(extra.taskId, extra.type);
        }
      });

      await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
        const extra = event.notification.extra as { taskId?: string; type?: string } | undefined;
        if (extra?.taskId) {
          window.dispatchEvent(
            new CustomEvent(NOTIFICATION_OPEN_TASK_EVENT, { detail: { taskId: extra.taskId } }),
          );
        } else {
          window.dispatchEvent(new CustomEvent(NOTIFICATION_OPEN_TASK_EVENT, { detail: {} }));
        }
      });
    } catch (error) {
      logger.error('Failed to init native notification handlers:', error);
    }
  })();
}

/**
 * Cancel a notification by tag (web) or ID (native)
 */
export async function cancelNotification(tagOrId: string | number): Promise<void> {
  const platform = getPlatform();

  if (platform.isNative) {
    try {
      const LocalNotifications = await loadLocalNotifications();
      const id = typeof tagOrId === 'number' ? tagOrId : tagToNotificationId(String(tagOrId));
      await LocalNotifications.cancel({ notifications: [{ id }] });
    } catch (error) {
      logger.debug('Could not cancel native notification:', error);
    }
  }
}

/**
 * Cancel all notifications
 */
export async function cancelAllNotifications(): Promise<void> {
  const platform = getPlatform();

  if (platform.isNative) {
    try {
      const LocalNotifications = await loadLocalNotifications();
      await LocalNotifications.cancelAll();
    } catch (error) {
      logger.debug('Could not cancel all native notifications:', error);
    }
  }
}

/** Helpers used by NotificationContext polling (shared copy builders). */
export function buildOverdueNotificationPayload(task: Task): NotificationOptions {
  const dateToUse = getTaskNotificationTargetDate(task);
  const dateText = dateToUse ? dateToUse.toLocaleDateString() : '';
  return {
    title: NOTIFICATION_TITLES.taskOverdue,
    body: NOTIFICATION_MESSAGES.taskWasDue(task.title, dateText),
    tag: `${NOTIFICATION_TAG_PREFIXES.overdue}${task.id}`,
    requireInteraction: false,
    data: { taskId: task.id, type: 'overdue' },
  };
}

export function buildDueSoonNotificationPayload(task: Task, now: Date): NotificationOptions {
  const copy = buildDueSoonCopy(task, now);
  return {
    title: copy.title,
    body: copy.body,
    tag: `${NOTIFICATION_TAG_PREFIXES.reminder}${task.id}`,
    requireInteraction: copy.requireInteraction,
    data: { taskId: task.id, type: isTaskDueNow(task, now) ? 'dueNow' : 'upcoming' },
  };
}

export { getOverdueTasks, getDueSoonTasks };
