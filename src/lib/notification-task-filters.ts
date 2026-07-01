/**
 * Shared task eligibility and date logic for notifications (badge, alerts, panel).
 */

import type { Task } from '../types';
import { MILLISECONDS_PER_MINUTE } from './business-constants';
import { NOTIFICATION_TAG_PREFIXES } from './notification-constants';
import { TIMING_CONSTANTS } from './timing-constants';

export interface TaskNotificationFilterOptions {
  overdueAlerts?: boolean;
  dueDateReminders?: boolean;
  reminderTimeMinutes?: number;
  dismissedNotificationIds?: Set<string>;
  now?: Date;
}

/** Rolled-over (no scheduled date), recurring, and completed tasks are excluded. */
export function isEligibleForTaskNotification(task: Task): boolean {
  if (task.status === 'done') return false;
  if (task.scheduledDate === null || task.scheduledDate === undefined) return false;
  if (task.recurrence && task.recurrence.type !== 'none') return false;
  return true;
}

/** Primary date for notification timing — scheduled date takes precedence over due date. */
export function getTaskNotificationTargetDate(task: Task): Date | null {
  const raw = task.scheduledDate ?? task.dueDate;
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** Midnight on the day after the target date — when overdue alerts should fire. */
export function getOverdueNotificationTime(targetDate: Date): Date {
  const nextDay = startOfDay(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);
  return nextDay;
}

export function isTaskOverdue(task: Task, now: Date = new Date()): boolean {
  if (!isEligibleForTaskNotification(task)) return false;
  const targetDate = getTaskNotificationTargetDate(task);
  if (!targetDate) return false;
  return startOfDay(targetDate).getTime() < startOfDay(now).getTime();
}

export function isTaskDueSoon(
  task: Task,
  reminderTimeMinutes: number,
  now: Date = new Date(),
): boolean {
  if (!isEligibleForTaskNotification(task)) return false;
  const targetDate = getTaskNotificationTargetDate(task);
  if (!targetDate) return false;
  // Foreground/badge/panel reminders only for tasks due today (future days use native schedule).
  if (!isSameCalendarDay(targetDate, now)) return false;
  const reminderEnd = new Date(now.getTime() + reminderTimeMinutes * MILLISECONDS_PER_MINUTE);
  return targetDate >= now && targetDate <= reminderEnd;
}

export function isTaskDueNow(
  task: Task,
  now: Date = new Date(),
): boolean {
  if (!isEligibleForTaskNotification(task)) return false;
  const targetDate = getTaskNotificationTargetDate(task);
  if (!targetDate) return false;
  const minutesUntil = Math.round((targetDate.getTime() - now.getTime()) / MILLISECONDS_PER_MINUTE);
  return minutesUntil >= 0 && minutesUntil <= TIMING_CONSTANTS.todayAgendaBadge.dueNowMinutes;
}

export function getOverdueTasks(
  tasks: Task[],
  options: Pick<TaskNotificationFilterOptions, 'dismissedNotificationIds' | 'now'> = {},
): Task[] {
  const now = options.now ?? new Date();
  return tasks.filter((task) => {
    if (!isTaskOverdue(task, now)) return false;
    if (options.dismissedNotificationIds?.has(`overdue_${task.id}`)) return false;
    return true;
  });
}

export function getDueSoonTasks(
  tasks: Task[],
  reminderTimeMinutes: number,
  options: Pick<TaskNotificationFilterOptions, 'dismissedNotificationIds' | 'now'> = {},
): Task[] {
  const now = options.now ?? new Date();
  return tasks.filter((task) => {
    if (!isTaskDueSoon(task, reminderTimeMinutes, now)) return false;
    if (options.dismissedNotificationIds?.has(`due-soon_${task.id}`)) return false;
    return true;
  });
}

const PANEL_NOTIFICATION_PREFIXES = {
  overdue: 'overdue_',
  dueSoon: 'due-soon_',
  pomodoro: 'pomodoro_',
} as const;

/** Extract task id from stored notification keys (panel, dedupe, native tags). */
export function getTaskIdFromNotificationKey(key: string): string | null {
  if (key.startsWith(NOTIFICATION_TAG_PREFIXES.overdue) || key.startsWith(PANEL_NOTIFICATION_PREFIXES.overdue)) {
    return key.slice(PANEL_NOTIFICATION_PREFIXES.overdue.length);
  }
  if (key.startsWith(NOTIFICATION_TAG_PREFIXES.reminder) || key.startsWith(PANEL_NOTIFICATION_PREFIXES.dueSoon)) {
    const prefix = key.startsWith(NOTIFICATION_TAG_PREFIXES.reminder)
      ? NOTIFICATION_TAG_PREFIXES.reminder
      : PANEL_NOTIFICATION_PREFIXES.dueSoon;
    return key.slice(prefix.length);
  }
  if (key.startsWith(PANEL_NOTIFICATION_PREFIXES.pomodoro)) {
    const rest = key.slice(PANEL_NOTIFICATION_PREFIXES.pomodoro.length);
    const lastSep = rest.lastIndexOf('_');
    return lastSep === -1 ? rest : rest.slice(0, lastSep);
  }
  return null;
}

/** Drop notification storage entries tied to deleted or completed tasks. */
export function pruneStaleTaskNotificationKeys(keys: Iterable<string>, tasks: Task[]): string[] {
  const activeTaskIds = new Set(
    tasks.filter((task) => task.status !== 'done').map((task) => task.id),
  );
  return Array.from(keys).filter((key) => {
    const taskId = getTaskIdFromNotificationKey(key);
    if (!taskId) return true;
    return activeTaskIds.has(taskId);
  });
}
