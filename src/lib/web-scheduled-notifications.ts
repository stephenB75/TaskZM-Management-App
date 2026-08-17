/**
 * Web scheduled task reminders — in-page timers while the tab/PWA session is alive.
 * Complements foreground polling; does not run when the browser tab is fully closed.
 */

import type { Task } from '../types';
import { MILLISECONDS_PER_DAY, WEB_NOTIFICATION_MAX_SCHEDULE_DAYS } from './business-constants';
import { logger } from './logger';
import { getPlatform } from './platform';
import { SCHEDULED_NOTIFICATION_PREFIXES } from './notification-constants';
import {
  buildDueSoonNotificationPayload,
  buildOverdueNotificationPayload,
  deliverScheduledTaskNotification,
  type TaskNotificationSyncSettings,
} from './native-notifications';
import {
  getOverdueNotificationTime,
  getTaskNotificationTargetDate,
  getTaskReminderScheduleTime,
  isEligibleForTaskNotification,
} from './notification-task-filters';

const webReminderTimers = new Map<string, ReturnType<typeof setTimeout>>();

function timerKey(prefix: string, taskId: string): string {
  return `${prefix}:${taskId}`;
}

function clearWebReminderTimers(): void {
  for (const timeoutId of webReminderTimers.values()) {
    clearTimeout(timeoutId);
  }
  webReminderTimers.clear();
}

function scheduleWebReminder(
  prefix: string,
  task: Task,
  fireAt: Date,
  now: Date,
  maxScheduleMs: number,
  buildPayload: () => ReturnType<typeof buildOverdueNotificationPayload>,
  variant: 'overdue' | 'reminder',
): void {
  const delayMs = fireAt.getTime() - now.getTime();
  if (delayMs <= 0 || delayMs > maxScheduleMs) return;

  const key = timerKey(prefix, task.id);
  const existing = webReminderTimers.get(key);
  if (existing !== undefined) {
    clearTimeout(existing);
  }

  webReminderTimers.set(
    key,
    setTimeout(() => {
      webReminderTimers.delete(key);
      void deliverScheduledTaskNotification(buildPayload(), variant).catch((error) => {
        logger.error('Failed to deliver scheduled web task notification:', error);
      });
    }, delayMs),
  );
}

/** Register future web reminders (requires notification permission). */
export function syncWebScheduledTaskNotifications(
  tasks: Task[],
  settings: TaskNotificationSyncSettings,
  permission: 'granted' | 'denied' | 'default',
): void {
  const platform = getPlatform();
  if (platform.isNative) return;
  if (typeof window === 'undefined') return;

  clearWebReminderTimers();

  if (!settings.enabled || permission !== 'granted') return;
  if (!('Notification' in window)) return;

  const now = new Date();
  const maxScheduleMs = WEB_NOTIFICATION_MAX_SCHEDULE_DAYS * MILLISECONDS_PER_DAY;
  let scheduledCount = 0;

  for (const task of tasks) {
    if (!isEligibleForTaskNotification(task)) continue;
    const targetDate = getTaskNotificationTargetDate(task);
    if (!targetDate) continue;

    if (settings.dueDateReminders) {
      const reminderAt = getTaskReminderScheduleTime(targetDate, settings.reminderTime, now);
      if (reminderAt) {
        scheduleWebReminder(
          SCHEDULED_NOTIFICATION_PREFIXES.reminder,
          task,
          reminderAt,
          now,
          maxScheduleMs,
          () => buildDueSoonNotificationPayload(task, reminderAt),
          'reminder',
        );
        scheduledCount += 1;
      }
    }

    if (settings.overdueAlerts) {
      const overdueAt = getOverdueNotificationTime(targetDate);
      if (overdueAt > now) {
        scheduleWebReminder(
          SCHEDULED_NOTIFICATION_PREFIXES.overdue,
          task,
          overdueAt,
          now,
          maxScheduleMs,
          () => buildOverdueNotificationPayload(task),
          'overdue',
        );
        scheduledCount += 1;
      }
    }
  }

  if (scheduledCount > 0) {
    logger.debug(`Scheduled ${scheduledCount} web task notification timer(s)`);
  }
}

export function clearWebScheduledTaskNotifications(): void {
  clearWebReminderTimers();
}
