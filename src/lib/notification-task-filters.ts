/**
 * Shared task eligibility and date logic for notifications (badge, alerts, panel).
 */

import type { Task } from '../types';
import { MILLISECONDS_PER_MINUTE } from './business-constants';
import { NOTIFICATION_TAG_PREFIXES } from './notification-constants';
import { TIMING_CONSTANTS } from './timing-constants';
import { getTimeAndPeriod, parseChronologicalTimeSource } from './utils';

export interface TaskNotificationFilterOptions {
  overdueAlerts?: boolean;
  dueDateReminders?: boolean;
  reminderTimeMinutes?: number;
  dismissedNotificationIds?: Set<string>;
  now?: Date;
}

/** Raw ISO field used for notification timing (scheduled date preferred). */
export function getTaskNotificationTargetRaw(task: Task): string | null {
  return task.scheduledDate ?? task.dueDate ?? null;
}

/** Primary date for notification timing — scheduled date takes precedence over due date. */
export function getTaskNotificationTargetDate(task: Task): Date | null {
  const raw = getTaskNotificationTargetRaw(task);
  if (!raw) return null;
  const parsed = parseChronologicalTimeSource(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Date-only targets (no specific time of day) vs timed scheduled tasks. */
export function isDateOnlyNotificationTarget(raw: string, targetDate: Date): boolean {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return true;
  const time = getTimeAndPeriod(raw);
  return (
    time?.timePart === '12:00' &&
    time.period === 'AM' &&
    targetDate.getMinutes() === 0 &&
    targetDate.getSeconds() === 0
  );
}

/** Scheduled (calendar) tasks eligible for due-soon/upcoming reminders. */
export function isEligibleForTaskDueReminder(task: Task): boolean {
  if (task.status === 'done') return false;
  if (task.recurrence && task.recurrence.type !== 'none') return false;
  if (task.scheduledDate) return true;
  const raw = task.dueDate;
  if (!raw) return false;
  const targetDate = getTaskNotificationTargetDate(task);
  if (!targetDate) return false;
  return !isDateOnlyNotificationTarget(raw, targetDate);
}

/** Any incomplete task with a due or scheduled date (includes inbox / rolled-over). */
export function isEligibleForTaskOverdueAlert(task: Task): boolean {
  if (task.status === 'done') return false;
  if (task.recurrence && task.recurrence.type !== 'none') return false;
  return getTaskNotificationTargetDate(task) !== null;
}

/** @deprecated Use isEligibleForTaskDueReminder or isEligibleForTaskOverdueAlert. */
export function isEligibleForTaskNotification(task: Task): boolean {
  return isEligibleForTaskDueReminder(task);
}

export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function isSameCalendarDay(a: Date, b: Date): boolean {
  return startOfDay(a).getTime() === startOfDay(b).getTime();
}

/** When to schedule a due-soon native reminder (handles lead-time windows that already started). */
export function getTaskReminderScheduleTime(
  targetDate: Date,
  reminderTimeMinutes: number,
  now: Date = new Date(),
): Date | null {
  if (targetDate <= now) return null;

  const reminderAt = new Date(targetDate.getTime() - reminderTimeMinutes * MILLISECONDS_PER_MINUTE);
  if (reminderAt > now) return reminderAt;

  return new Date(now.getTime() + TIMING_CONSTANTS.delays.nativeReminderCatchUpDelay);
}

/** Midnight on the day after a date-only target — when overdue alerts should fire. */
export function getOverdueNotificationTime(targetDate: Date): Date {
  const nextDay = startOfDay(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);
  return nextDay;
}

/** When to schedule an overdue alert (future or catch-up for already-overdue tasks). */
export function getOverdueNotificationScheduleTime(
  task: Task,
  now: Date = new Date(),
): Date | null {
  const raw = getTaskNotificationTargetRaw(task);
  const targetDate = getTaskNotificationTargetDate(task);
  if (!raw || !targetDate) return null;

  const overdueAt = isDateOnlyNotificationTarget(raw, targetDate)
    ? getOverdueNotificationTime(targetDate)
    : targetDate;

  if (overdueAt > now) return overdueAt;

  return new Date(now.getTime() + TIMING_CONSTANTS.delays.nativeReminderCatchUpDelay);
}

export function isTaskOverdue(task: Task, now: Date = new Date()): boolean {
  if (!isEligibleForTaskOverdueAlert(task)) return false;
  const raw = getTaskNotificationTargetRaw(task);
  const targetDate = getTaskNotificationTargetDate(task);
  if (!raw || !targetDate) return false;

  if (isDateOnlyNotificationTarget(raw, targetDate)) {
    return startOfDay(targetDate).getTime() < startOfDay(now).getTime();
  }

  return targetDate.getTime() < now.getTime();
}

export function isTaskDueSoon(
  task: Task,
  reminderTimeMinutes: number,
  now: Date = new Date(),
): boolean {
  if (!isEligibleForTaskDueReminder(task)) return false;
  const raw = getTaskNotificationTargetRaw(task);
  const targetDate = getTaskNotificationTargetDate(task);
  if (!raw || !targetDate) return false;

  if (isDateOnlyNotificationTarget(raw, targetDate)) {
    if (!isSameCalendarDay(targetDate, now)) return false;
    return startOfDay(now).getTime() <= startOfDay(targetDate).getTime();
  }

  if (!isSameCalendarDay(targetDate, now)) return false;
  const reminderEnd = new Date(now.getTime() + reminderTimeMinutes * MILLISECONDS_PER_MINUTE);
  return targetDate >= now && targetDate <= reminderEnd;
}

export function isTaskDueNow(
  task: Task,
  now: Date = new Date(),
): boolean {
  if (!isEligibleForTaskDueReminder(task)) return false;
  const targetDate = getTaskNotificationTargetDate(task);
  if (!targetDate) return false;
  if (!isSameCalendarDay(targetDate, now)) return false;
  const minutesUntil = Math.round((targetDate.getTime() - now.getTime()) / MILLISECONDS_PER_MINUTE);
  return minutesUntil >= 0 && minutesUntil <= TIMING_CONSTANTS.todayAgendaBadge.dueNowMinutes;
}

/** Scheduled later today (after due-now window, within dueSoonMaxMinutes). Excludes overdue. */
export function isTaskUpcomingToday(task: Task, now: Date = new Date()): boolean {
  if (!isEligibleForTaskDueReminder(task)) return false;
  const targetDate = getTaskNotificationTargetDate(task);
  if (!targetDate) return false;
  if (!isSameCalendarDay(targetDate, now)) return false;
  const minutesUntil = (targetDate.getTime() - now.getTime()) / MILLISECONDS_PER_MINUTE;
  const { dueNowMinutes, dueSoonMaxMinutes } = TIMING_CONSTANTS.todayAgendaBadge;
  return minutesUntil > dueNowMinutes && minutesUntil <= dueSoonMaxMinutes;
}

/** Sidebar / bottom-nav Today badge: due now or starting soon today — not overdue past tasks. */
export function getTodayAgendaBadgeCount(tasks: Task[], now: Date = new Date()): number {
  return tasks.filter((task) => isTaskDueNow(task, now) || isTaskUpcomingToday(task, now)).length;
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
