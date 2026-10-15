/**
 * Planner chat: turn free text into draft tasks or planner intents, and build replies.
 * Scheduling itself always goes through useAIScheduler (daily limits, category hours, calendar events).
 */

import { PLANNER_CHAT_CONFIG } from './ai-config';
import {
  DAYS_IN_WEEK,
  DEFAULT_PROJECT_ID,
  END_OF_DAY_HOUR,
  END_OF_DAY_MILLISECOND,
  END_OF_DAY_MINUTE,
  END_OF_DAY_SECOND,
  MINUTES_PER_HOUR,
  RECURRENCE_NONE_CONFIG,
  TWO_WEEKS_DAYS,
} from './business-constants';
import { estimateTaskHours } from './daily-hours-utils';
import { COLOR_POP_BLUE, COLOR_POP_LIME, COLOR_POP_NEUTRAL, COLOR_POP_VIOLET } from './color-theme';
import { DEFAULT_CREATED_BY, DEFAULT_TASK_PRIORITY, DEFAULT_TASK_STATUS } from './task-constants';
import { generateId, getWeekStart } from './utils';
import { PLANNER_UI_TEXT, type PlannerRescheduleRange } from './navigation-constants';
import type { Task, TaskPriority } from '../types';

export type PlannerCategory = 'work' | 'personal' | 'projects';

const CATEGORY_POP: Record<PlannerCategory, string> = {
  work: COLOR_POP_VIOLET,
  personal: COLOR_POP_BLUE,
  projects: COLOR_POP_LIME,
};

/** Pastel dot for a task category (neutral when uncategorized). */
export function plannerCategoryColor(category: PlannerCategory | null): string {
  return category ? CATEGORY_POP[category] : COLOR_POP_NEUTRAL;
}

export interface PlannerDraft {
  id: string;
  title: string;
  priority: TaskPriority;
  category: PlannerCategory | null;
  estimatedMinutes: number;
}

export type PlannerIntent =
  | { kind: 'question' }
  | { kind: 'scheduleInbox' }
  | { kind: 'reschedule'; range: PlannerRescheduleRange }
  | { kind: 'drafts'; drafts: PlannerDraft[] };

const RESCHEDULE_RANGES: PlannerRescheduleRange[] = ['day', 'week', 'month'];

export function detectPlannerIntent(text: string): PlannerIntent {
  const trimmed = text.trim();
  if (PLANNER_CHAT_CONFIG.scheduleInboxPattern.test(trimmed)) return { kind: 'scheduleInbox' };
  for (const range of RESCHEDULE_RANGES) {
    if (PLANNER_CHAT_CONFIG.reschedulePatterns[range].test(trimmed)) return { kind: 'reschedule', range };
  }
  if (PLANNER_CHAT_CONFIG.questionPattern.test(trimmed)) return { kind: 'question' };
  return { kind: 'drafts', drafts: parsePlannerDrafts(trimmed) };
}

function inferPriority(title: string): TaskPriority {
  const { priorityPatterns } = PLANNER_CHAT_CONFIG;
  if (priorityPatterns.urgent.test(title)) return 'urgent';
  if (priorityPatterns.high.test(title)) return 'high';
  if (priorityPatterns.low.test(title)) return 'low';
  return DEFAULT_TASK_PRIORITY;
}

function inferCategory(title: string): PlannerCategory | null {
  const { categoryPatterns } = PLANNER_CHAT_CONFIG;
  if (categoryPatterns.work.test(title)) return 'work';
  if (categoryPatterns.personal.test(title)) return 'personal';
  if (categoryPatterns.projects.test(title)) return 'projects';
  return null;
}

function explicitMinutes(title: string): number | null {
  const match = title.match(PLANNER_CHAT_CONFIG.durationPattern);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(PLANNER_CHAT_CONFIG.hourUnitPattern.test(match[2]) ? amount * MINUTES_PER_HOUR : amount);
}

function cleanTitle(raw: string): string {
  const withoutMarker = raw.replace(PLANNER_CHAT_CONFIG.listMarker, '');
  const withoutDuration = withoutMarker
    .replace(PLANNER_CHAT_CONFIG.durationPattern, '')
    .replace(PLANNER_CHAT_CONFIG.priorityTagPattern, '');
  return withoutDuration.replace(/\s{2,}/g, ' ').replace(/[\s,.(-]+$/, '').replace(/\(\s*\)/g, '').trim();
}

/** Build a full Task (unsaved) so the scheduler and estimator can work with a draft. */
export function draftToTask(draft: PlannerDraft, createdBy?: string | null): Task {
  const now = new Date().toISOString();
  return {
    id: draft.id,
    title: draft.title,
    description: '',
    status: DEFAULT_TASK_STATUS,
    priority: draft.priority,
    dueDate: null,
    scheduledDate: null,
    projectId: DEFAULT_PROJECT_ID,
    tags: draft.category ? [draft.category] : [],
    assignedTo: [],
    createdBy: createdBy || DEFAULT_CREATED_BY,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    estimatedTime: draft.estimatedMinutes,
    actualTime: null,
    dependencies: [],
    subtasks: [],
    recurrence: RECURRENCE_NONE_CONFIG,
    notes: '',
  };
}

export function parsePlannerDrafts(text: string): PlannerDraft[] {
  const drafts: PlannerDraft[] = [];
  for (const line of text.split(PLANNER_CHAT_CONFIG.draftSeparator)) {
    const title = cleanTitle(line);
    if (title.length < PLANNER_CHAT_CONFIG.minTitleLength) continue;
    const draft: PlannerDraft = {
      id: generateId(),
      title,
      priority: inferPriority(line),
      category: inferCategory(line),
      estimatedMinutes: 0,
    };
    const stated = explicitMinutes(line);
    draft.estimatedMinutes =
      stated ?? Math.round(estimateTaskHours({ ...draftToTask(draft), estimatedTime: null }) * MINUTES_PER_HOUR);
    drafts.push(draft);
    if (drafts.length >= PLANNER_CHAT_CONFIG.maxDraftsPerMessage) break;
  }
  return drafts;
}

export function endOfDay(date: Date): Date {
  const end = new Date(date);
  end.setHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MILLISECOND);
  return end;
}

/** Scheduling window for accepted drafts: today through the next two weeks. */
export function plannerScheduleWindow(now: Date): { startDate: Date; endDate: Date } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + TWO_WEEKS_DAYS - 1);
  return { startDate: start, endDate: endOfDay(end) };
}

/** First day of the week containing `date`, honoring the user's week-start setting. */
export function startOfPlannerWeek(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const weekStartsMonday = getWeekStart() === 'monday';
  const offset = weekStartsMonday ? (start.getDay() + DAYS_IN_WEEK - 1) % DAYS_IN_WEEK : start.getDay();
  start.setDate(start.getDate() - offset);
  return start;
}

export function formatPlannedWhen(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isOpen(task: Task): boolean {
  return task.status !== 'done';
}

export function plannerSummary(tasks: Task[], now: Date): string {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = endOfDay(dayStart);
  const weekStart = startOfPlannerWeek(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + DAYS_IN_WEEK);

  const scheduled = tasks
    .filter((task) => isOpen(task) && task.scheduledDate)
    .map((task) => ({ task, at: new Date(task.scheduledDate as string) }))
    .filter(({ at }) => !Number.isNaN(at.getTime()));

  const today = scheduled.filter(({ at }) => at >= dayStart && at <= dayEnd);
  const next = scheduled.filter(({ at }) => at >= now).sort((a, b) => a.at.getTime() - b.at.getTime())[0];
  const weekMinutes = scheduled
    .filter(({ at }) => at >= weekStart && at < weekEnd)
    .reduce((sum, { task }) => sum + (task.estimatedTime ?? 0), 0);

  return PLANNER_UI_TEXT.replies.summary({
    today: today.length,
    next: next ? `${next.task.title} (${formatPlannedWhen(next.at)})` : null,
    inbox: tasks.filter((task) => isOpen(task) && !task.scheduledDate).length,
    weekHours: Number((weekMinutes / MINUTES_PER_HOUR).toFixed(1)),
  });
}
