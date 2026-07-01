/**
 * Shared task eligibility and date logic for notifications (badge, alerts, panel).
 */

import type { Task } from '../types';
import { MILLISECONDS_PER_MINUTE } from './business-constants';
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
