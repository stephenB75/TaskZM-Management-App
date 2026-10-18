/**
 * Native Notification Helper
 * Provides unified interface for browser and native (iOS/Android) notifications
 */

import type { Task } from '../types';
import { LocalNotifications } from '@capacitor/local-notifications';
import { getPlatform } from './platform';
import {
  MOBILE_NOTIFICATION_SMALL_ICON,
  MOBILE_NOTIFICATION_ICON_COLOR,
  MOBILE_NOTIFICATION_CHANNELS,
  MOBILE_NOTIFICATION_CHANNEL_LABELS,
  MOBILE_SILENT_NOTIFICATION_CHANNELS,
  ANDROID_CHANNEL_IMPORTANCE,
} from './mobile-constants';
import { logger } from './logger';
import {
  NOTIFICATION_TITLES,
  NOTIFICATION_MESSAGES,
  NOTIFICATION_ICONS,
  NOTIFICATION_TAG_PREFIXES,
  NOTIFICATION_STORAGE_KEYS,
  NOTIFICATION_OPEN_TASK_EVENT,
  NOTIFICATION_FOREGROUND_DELIVERED_EVENT,
  SCHEDULED_NOTIFICATION_PREFIXES,
  IOS_PENDING_NOTIFICATION_LIMIT,
} from './notification-constants';
import { MILLISECONDS_PER_MINUTE, MINUTES_PER_HOUR, STORAGE_KEY_NOTIFICATION_SETTINGS } from './business-constants';
import { isAppInForeground, shouldUseSystemNotification } from './app-visibility';
import { TIMING_CONSTANTS } from './timing-constants';
import {
  getDueSoonTasks,
  getOverdueNotificationScheduleTime,
  getOverdueTasks,
  getTaskNotificationTargetDate,
  getTaskReminderScheduleTime,
  isEligibleForTaskDueReminder,
  isEligibleForTaskOverdueAlert,
  isTaskDueNow,
} from './notification-task-filters';
import { getFromLocalStorage, saveToLocalStorage } from './utils';
import { isServerPushRemindersActive } from './native-push-notifications';

interface NotificationOptions {
  title: string;
  body: string;
  tag?: string;
  requireInteraction?: boolean;
  data?: Record<string, unknown>;
  channelId?: string;
}

export interface AchievementNotificationPayload {
  awardId: string;
  awardName: string;
  tag: string;
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

function wasTaskNotified(taskId: string, type: 'overdue' | 'reminder'): boolean {
  const prefix =
    type === 'overdue' ? NOTIFICATION_TAG_PREFIXES.overdue : NOTIFICATION_TAG_PREFIXES.reminder;
  return getFromLocalStorage<string[]>(NOTIFICATION_STORAGE_KEYS.notifiedTasks, []).includes(
    `${prefix}${taskId}`,
  );
}

function isCatchUpScheduleTime(scheduleAt: Date, now: Date): boolean {
  return scheduleAt.getTime() <= now.getTime() + TIMING_CONSTANTS.delays.nativeReminderCatchUpDelay;
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
  return LocalNotifications;
}

function getAndroidNotificationFields(channelId?: string): {
  smallIcon: string;
  iconColor: string;
  channelId: string;
} {
  return {
    smallIcon: MOBILE_NOTIFICATION_SMALL_ICON,
    iconColor: MOBILE_NOTIFICATION_ICON_COLOR,
    channelId: resolveSoundAwareChannel(channelId ?? MOBILE_NOTIFICATION_CHANNELS.tasks),
  };
}

function resolveSoundAwareChannel(channelId: string): string {
  if (isNotificationSoundEnabled()) return channelId;
  return MOBILE_SILENT_NOTIFICATION_CHANNELS[channelId] ?? channelId;
}

/** iOS plays no sound when `sound` is omitted from a local notification. */
function notificationSoundFields(): { sound?: string } {
  return isNotificationSoundEnabled() ? { sound: 'default' } : {};
}

type LocalNotificationsPlugin = Awaited<ReturnType<typeof loadLocalNotifications>>;

async function ensureAndroidNotificationChannels(
  LocalNotifications: LocalNotificationsPlugin,
): Promise<void> {
  const platform = getPlatform();
  if (!platform.isAndroid) return;

  const createChannel = (
    LocalNotifications as LocalNotificationsPlugin & {
      createChannel?: (channel: {
        id: string;
        name: string;
        description: string;
        importance?: number;
        visibility?: number;
        sound?: string;
      }) => Promise<void>;
    }
  ).createChannel;

  if (typeof createChannel !== 'function') return;

  await Promise.allSettled([
    createChannel.call(LocalNotifications, {
      id: MOBILE_NOTIFICATION_CHANNELS.tasks,
      name: MOBILE_NOTIFICATION_CHANNEL_LABELS.tasks,
      description: 'Due date reminders and overdue task alerts',
      importance: ANDROID_CHANNEL_IMPORTANCE.high,
      visibility: 1,
      sound: 'default',
    }),
    createChannel.call(LocalNotifications, {
      id: MOBILE_NOTIFICATION_CHANNELS.achievements,
      name: MOBILE_NOTIFICATION_CHANNEL_LABELS.achievements,
      description: 'Achievement unlocked alerts',
      importance: ANDROID_CHANNEL_IMPORTANCE.high,
      visibility: 1,
      sound: 'default',
    }),
    createChannel.call(LocalNotifications, {
      id: MOBILE_SILENT_NOTIFICATION_CHANNELS[MOBILE_NOTIFICATION_CHANNELS.tasks],
      name: MOBILE_NOTIFICATION_CHANNEL_LABELS.tasksSilent,
      description: 'Task reminders when sound is turned off in Settings',
      importance: ANDROID_CHANNEL_IMPORTANCE.low,
      visibility: 1,
    }),
    createChannel.call(LocalNotifications, {
      id: MOBILE_SILENT_NOTIFICATION_CHANNELS[MOBILE_NOTIFICATION_CHANNELS.achievements],
      name: MOBILE_NOTIFICATION_CHANNEL_LABELS.achievementsSilent,
      description: 'Achievement alerts when sound is turned off in Settings',
      importance: ANDROID_CHANNEL_IMPORTANCE.low,
      visibility: 1,
    }),
  ]);
}

/** Synchronous browser permission read (use before any await in click handlers). */
export function getWebNotificationPermission(): NotificationPermission | null {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return null;
  }
  return Notification.permission;
}

/** Map Capacitor permission states to browser NotificationPermission. */
export function normalizeNotificationPermission(
  state: string,
): 'granted' | 'denied' | 'default' {
  if (state === 'granted') return 'granted';
  if (state === 'denied') return 'denied';
  if (state === 'prompt') return 'default';
  return 'default';
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
 * Request notification permission (works for both browser and native).
 * Must not await unrelated work before calling the OS/browser prompt (user-gesture requirement).
 */
export async function requestNotificationPermission(): Promise<'granted' | 'denied' | 'default'> {
  const platform = getPlatform();

  if (platform.isNative) {
    try {
      const result = await LocalNotifications.requestPermissions();
      return normalizeNotificationPermission(result.display);
    } catch (error) {
      logger.error('Error requesting native notification permission:', error);
      return 'default';
    }
  }

  if (!('Notification' in window)) return 'default';

  const syncPermission = Notification.permission;
  if (syncPermission === 'granted') return 'granted';
  if (syncPermission === 'denied') return 'denied';

  try {
    const result = await Notification.requestPermission();
    return normalizeNotificationPermission(result);
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
      return normalizeNotificationPermission(result.display);
    } catch (error) {
      logger.debug('Could not check native notification permission:', error);
      return 'default';
    }
  }

  if (!('Notification' in window)) return 'default';
  return Notification.permission as 'granted' | 'denied' | 'default';
}

function isNotificationSoundEnabled(): boolean {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY_NOTIFICATION_SETTINGS) ?? '{}');
    return stored?.soundEnabled !== false;
  } catch {
    return true;
  }
}

/**
 * Show a notification (uses native on iOS/Android, browser on web)
 */
export async function showNotification(options: NotificationOptions): Promise<void> {
  const platform = getPlatform();
  if (!platform.isNative && !shouldUseSystemNotification()) {
    logger.debug('Skipping system notification while app is in foreground:', options.title);
    return;
  }

  if (platform.isNative) {
    try {
      const LocalNotifications = await loadLocalNotifications();
      const notificationId = tagToNotificationId(options.tag ?? `${options.title}_${Date.now()}`);

      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title: options.title,
            body: options.body,
            ...notificationSoundFields(),
            actionTypeId: '',
            extra: options.data ?? {},
            ...(platform.isIOS && { summary: options.title }),
            ...(platform.isAndroid && getAndroidNotificationFields(options.channelId)),
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
      silent: !isNotificationSoundEnabled(),
      data: options.data,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
      const taskId = options.data?.taskId;
      const awardId = options.data?.awardId;
      if (typeof taskId === 'string') {
        window.dispatchEvent(
          new CustomEvent(NOTIFICATION_OPEN_TASK_EVENT, { detail: { taskId } }),
        );
      } else if (typeof awardId === 'string') {
        window.dispatchEvent(
          new CustomEvent(NOTIFICATION_OPEN_TASK_EVENT, { detail: { view: 'notifications', awardId } }),
        );
      }
    };

    logger.debug('Browser notification sent:', options.title);
  } catch (error) {
    logger.error('Failed to show browser notification:', error);
    throw error;
  }
}

/** Show an immediate achievement notification (background delivery). */
export async function showAchievementNotification(payload: AchievementNotificationPayload): Promise<void> {
  await showNotification({
    title: NOTIFICATION_TITLES.awardEarned,
    body: NOTIFICATION_MESSAGES.awardEarned(payload.awardName),
    tag: payload.tag,
    channelId: MOBILE_NOTIFICATION_CHANNELS.achievements,
    data: { type: 'award', awardId: payload.awardId },
  });
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
    // The context's permission state starts as 'default' until its async check resolves; ask the OS directly.
    const osPermission =
      permission === 'granted'
        ? permission
        : normalizeNotificationPermission((await LocalNotifications.checkPermissions()).display);

    if (!settings.enabled || osPermission !== 'granted' || isServerPushRemindersActive()) {
      try {
        const pending = await LocalNotifications.getPending();
        const pendingIds = pending.notifications?.map((notification) => ({ id: notification.id })) ?? [];
        if (pendingIds.length > 0) {
          await LocalNotifications.cancel({ notifications: pendingIds });
        }
      } catch (cancelError) {
        logger.debug('Could not cancel pending native notifications when disabled:', cancelError);
      }
      return;
    }

    const scheduled: Array<{
      id: number;
      title: string;
      body: string;
      schedule: { at: Date; allowWhileIdle?: boolean };
      sound?: string;
      extra: Record<string, unknown>;
      summary?: string;
      silent?: boolean;
      smallIcon?: string;
      iconColor?: string;
      channelId?: string;
    }> = [];

    for (const task of tasks) {
      const targetDate = getTaskNotificationTargetDate(task);
      if (!targetDate) continue;

      if (settings.dueDateReminders && isEligibleForTaskDueReminder(task)) {
        const reminderAt = getTaskReminderScheduleTime(targetDate, settings.reminderTime, now);
        if (reminderAt) {
          if (
            isCatchUpScheduleTime(reminderAt, now) &&
            !wasTaskNotified(task.id, 'reminder') &&
            shouldUseSystemNotification()
          ) {
            await deliverScheduledTaskNotification(buildDueSoonNotificationPayload(task, now), 'reminder');
            continue;
          }

          const copy = buildDueSoonCopy(task, reminderAt);
          scheduled.push({
            id: getScheduledNotificationId(SCHEDULED_NOTIFICATION_PREFIXES.reminder, task.id),
            title: copy.title,
            body: copy.body,
            schedule: { at: reminderAt, allowWhileIdle: true },
            ...notificationSoundFields(),
            extra: { taskId: task.id, type: 'reminder' },
            ...(platform.isIOS && { summary: copy.title }),
            ...(platform.isAndroid && getAndroidNotificationFields(MOBILE_NOTIFICATION_CHANNELS.tasks)),
          });
        }
      }

      if (settings.overdueAlerts && isEligibleForTaskOverdueAlert(task)) {
        const overdueAt = getOverdueNotificationScheduleTime(task, now);
        if (overdueAt) {
          if (
            isCatchUpScheduleTime(overdueAt, now) &&
            !wasTaskNotified(task.id, 'overdue') &&
            shouldUseSystemNotification()
          ) {
            await deliverScheduledTaskNotification(buildOverdueNotificationPayload(task), 'overdue');
            continue;
          }

          const dateText = targetDate.toLocaleDateString();
          scheduled.push({
            id: getScheduledNotificationId(SCHEDULED_NOTIFICATION_PREFIXES.overdue, task.id),
            title: NOTIFICATION_TITLES.taskOverdue,
            body: NOTIFICATION_MESSAGES.taskWasDue(task.title, dateText),
            schedule: { at: overdueAt, allowWhileIdle: true },
            ...notificationSoundFields(),
            extra: { taskId: task.id, type: 'overdue' },
            ...(platform.isIOS && { summary: NOTIFICATION_TITLES.taskOverdue }),
            ...(platform.isAndroid && getAndroidNotificationFields(MOBILE_NOTIFICATION_CHANNELS.tasks)),
          });
        }
      }
    }

    // iOS keeps only the soonest IOS_PENDING_NOTIFICATION_LIMIT requests; schedule those explicitly.
    scheduled.sort((a, b) => a.schedule.at.getTime() - b.schedule.at.getTime());
    scheduled.splice(IOS_PENDING_NOTIFICATION_LIMIT);

    const scheduledIds = new Set(scheduled.map((notification) => notification.id));

    try {
      const pending = await LocalNotifications.getPending();
      const staleIds =
        pending.notifications
          ?.filter((notification) => !scheduledIds.has(notification.id))
          .map((notification) => ({ id: notification.id })) ?? [];
      if (staleIds.length > 0) {
        await LocalNotifications.cancel({ notifications: staleIds });
      }
    } catch (cancelError) {
      logger.debug('Could not prune stale native notifications:', cancelError);
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
      await ensureAndroidNotificationChannels(LocalNotifications);

      await LocalNotifications.addListener('localNotificationReceived', (notification) => {
        const extra = notification?.extra as { taskId?: string; type?: string } | undefined;
        const notifyType = extra?.type === 'overdue' ? 'overdue' : 'reminder';
        if (extra?.taskId) {
          markTaskNotified(extra.taskId, notifyType);
        }
        if (isAppInForeground()) {
          window.dispatchEvent(
            new CustomEvent(NOTIFICATION_FOREGROUND_DELIVERED_EVENT, {
              detail: {
                title: notification?.title,
                body: notification?.body,
                variant: notifyType,
              },
            }),
          );
        }
      });

      await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
        const extra = event?.notification?.extra as {
          taskId?: string;
          awardId?: string;
          type?: string;
        } | undefined;
        if (extra?.taskId) {
          window.dispatchEvent(
            new CustomEvent(NOTIFICATION_OPEN_TASK_EVENT, { detail: { taskId: extra.taskId } }),
          );
        } else if (extra?.type === 'award' && extra.awardId) {
          window.dispatchEvent(
            new CustomEvent(NOTIFICATION_OPEN_TASK_EVENT, {
              detail: { view: 'notifications', awardId: extra.awardId },
            }),
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
      const { notifications } = await LocalNotifications.getPending();
      if (notifications.length > 0) {
        await LocalNotifications.cancel({ notifications: notifications.map(({ id }) => ({ id })) });
      }
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
    channelId: MOBILE_NOTIFICATION_CHANNELS.tasks,
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
    channelId: MOBILE_NOTIFICATION_CHANNELS.tasks,
    data: { taskId: task.id, type: isTaskDueNow(task, now) ? 'dueNow' : 'upcoming' },
  };
}

/** Deliver a scheduled reminder (native or web timer) — toast in foreground, system alert in background. */
export async function deliverScheduledTaskNotification(
  payload: NotificationOptions,
  variant: 'overdue' | 'reminder',
): Promise<void> {
  const taskId = payload.data?.taskId;
  if (typeof taskId === 'string') {
    markTaskNotified(taskId, variant);
  }

  if (isAppInForeground() && !getPlatform().isNative) {
    window.dispatchEvent(
      new CustomEvent(NOTIFICATION_FOREGROUND_DELIVERED_EVENT, {
        detail: {
          title: payload.title,
          body: payload.body,
          variant,
        },
      }),
    );
    return;
  }

  await showNotification(payload);
}

export { getOverdueTasks, getDueSoonTasks };
