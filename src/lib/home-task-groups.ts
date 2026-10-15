import { getCategoryFromTags } from './ai-config';
import { HOME_ACTIVITY_MONTH_COUNT, MILLISECONDS_PER_DAY } from './business-constants';
import {
  COLOR_PASTEL_LAVENDER,
  COLOR_PASTEL_LILAC,
  COLOR_PASTEL_MINT,
  COLOR_PASTEL_PEACH,
  COLOR_PASTEL_SKY,
  COLOR_POP_BLUE,
  COLOR_POP_LIME,
  COLOR_POP_NEUTRAL,
  COLOR_POP_ORANGE,
  COLOR_POP_VIOLET,
} from './color-theme';
import { isSameCalendarDay, isTaskOverdue } from './notification-task-filters';
import { getCalendarEventSortTimeOnDay, parseCalendarEventTime } from './utils';
import type { CalendarEvent } from '../hooks/useCalendarEvents';
import type { Task } from '../types';

export type PastelWash = {
  fill: string;
  bar: string;
};

const CATEGORY_WASH: Record<'work' | 'personal' | 'projects', PastelWash> = {
  work: { fill: COLOR_PASTEL_LAVENDER, bar: COLOR_POP_VIOLET },
  personal: { fill: COLOR_PASTEL_SKY, bar: COLOR_POP_BLUE },
  projects: { fill: COLOR_PASTEL_MINT, bar: COLOR_POP_LIME },
};

export function pastelWashForTask(task: Task, options?: { unfinished?: boolean; done?: boolean }): PastelWash {
  if (options?.done || task.status === 'done') {
    return { fill: COLOR_PASTEL_MINT, bar: COLOR_POP_NEUTRAL };
  }
  if (options?.unfinished) {
    return { fill: COLOR_PASTEL_PEACH, bar: COLOR_POP_ORANGE };
  }
  const category = getCategoryFromTags(task.tags);
  if (category) return CATEGORY_WASH[category];
  return { fill: COLOR_PASTEL_LILAC, bar: COLOR_POP_NEUTRAL };
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

export type HomeAgendaItem =
  | { kind: 'task'; key: string; time: number; task: Task }
  | { kind: 'event'; key: string; time: number; event: CalendarEvent };

export function calendarEventsOn(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const dayEnd = dayStart + MILLISECONDS_PER_DAY;
  return events.filter((event) => {
    const start = parseCalendarEventTime(event.start).getTime();
    if (Number.isNaN(start)) return false;
    const endRaw = parseCalendarEventTime(event.end || event.start).getTime();
    const end = Number.isNaN(endRaw) ? start : endRaw;
    // Exclusive end: an all-day event ending at midnight does not spill into the next day.
    return start < dayEnd && (end > dayStart || start === dayStart);
  });
}

export function isAllDayCalendarEvent(event: CalendarEvent): boolean {
  const start = parseCalendarEventTime(event.start);
  const end = parseCalendarEventTime(event.end || event.start);
  const atMidnight = (date: Date) => date.getHours() === 0 && date.getMinutes() === 0;
  return atMidnight(start) && atMidnight(end) && end.getTime() > start.getTime();
}

/** Tasks scheduled on `day` merged with that day's calendar events, in time order. */
export function homeAgendaOn(tasks: Task[], events: CalendarEvent[], day: Date): HomeAgendaItem[] {
  const items: HomeAgendaItem[] = [
    ...tasksScheduledOn(tasks, day).map((task) => ({
      kind: 'task' as const,
      key: `task-${task.id}`,
      time: task.scheduledDate ? new Date(task.scheduledDate).getTime() : 0,
      task,
    })),
    ...calendarEventsOn(events, day).map((event) => ({
      kind: 'event' as const,
      key: `event-${event.id}`,
      time: getCalendarEventSortTimeOnDay(day, event.start),
      event,
    })),
  ];
  return items.sort((a, b) => a.time - b.time);
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
