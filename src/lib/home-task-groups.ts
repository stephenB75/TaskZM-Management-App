import { getCategoryFromTags } from './ai-config';
import { HOME_ACTIVITY_MONTH_COUNT } from './business-constants';
import {
  COLOR_PASTEL_LAVENDER,
  COLOR_PASTEL_LILAC,
  COLOR_PASTEL_MINT,
  COLOR_PASTEL_PEACH,
  COLOR_PASTEL_SKY,
  COLOR_PRIMARY,
  COLOR_PRIMARY_DARK,
} from './color-theme';
import { isSameCalendarDay, isTaskOverdue } from './notification-task-filters';
import type { Task } from '../types';

export type PastelWash = {
  fill: string;
  bar: string;
};

const CATEGORY_WASH: Record<'work' | 'personal' | 'projects', PastelWash> = {
  work: { fill: COLOR_PASTEL_LAVENDER, bar: COLOR_PRIMARY },
  personal: { fill: COLOR_PASTEL_SKY, bar: COLOR_PRIMARY_DARK },
  projects: { fill: COLOR_PASTEL_MINT, bar: COLOR_PRIMARY_DARK },
};

export function pastelWashForTask(task: Task, options?: { unfinished?: boolean; done?: boolean }): PastelWash {
  if (options?.done || task.status === 'done') {
    return { fill: COLOR_PASTEL_MINT, bar: COLOR_PRIMARY_DARK };
  }
  if (options?.unfinished) {
    return { fill: COLOR_PASTEL_PEACH, bar: COLOR_PRIMARY_DARK };
  }
  const category = getCategoryFromTags(task.tags);
  if (category) return CATEGORY_WASH[category];
  return { fill: COLOR_PASTEL_LILAC, bar: COLOR_PRIMARY };
}

export function isUnfinishedTask(task: Task, now: Date): boolean {
  if (task.status === 'done') return false;
  if (task.recurrence && task.recurrence.type !== 'none') return false;
  return isTaskOverdue(task, now);
}

export function tasksToPlace(tasks: Task[], unfinished: Task[]): Task[] {
  const unfinishedIds = new Set(unfinished.map((task) => task.id));
  return tasks.filter(
    (task) => task.status !== 'done' && !task.scheduledDate && !unfinishedIds.has(task.id),
  );
}

export function tasksScheduledOn(tasks: Task[], day: Date): Task[] {
  return tasks
    .filter((task) => task.status !== 'done' && task.scheduledDate && isSameCalendarDay(new Date(task.scheduledDate), day))
    .sort((a, b) => {
      const aTime = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
      const bTime = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
      return aTime - bTime;
    });
}

export function completedCountByRecentMonth(tasks: Task[], now: Date): { label: string; count: number }[] {
  const months: { label: string; count: number; key: string }[] = [];
  for (let offset = HOME_ACTIVITY_MONTH_COUNT - 1; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    months.push({
      label: date.toLocaleDateString(undefined, { month: 'short' }),
      count: 0,
      key,
    });
  }
  tasks.forEach((task) => {
    if (!task.completedAt) return;
    const completed = new Date(task.completedAt);
    if (Number.isNaN(completed.getTime())) return;
    const key = `${completed.getFullYear()}-${completed.getMonth()}`;
    const bucket = months.find((month) => month.key === key);
    if (bucket) bucket.count += 1;
  });
  return months.map(({ label, count }) => ({ label, count }));
}
