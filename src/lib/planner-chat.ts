/**
 * Planner chat: turn free text into draft tasks or planner intents, and build replies.
 * Scheduling itself always goes through useAIScheduler (daily limits, category hours, calendar events).
 */

import { PLANNER_ANALYSIS_CONFIG, PLANNER_CHAT_CONFIG } from './ai-config';
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
import { COLOR_POP_NEUTRAL } from './color-theme';
import { tagShade } from './tag-shades';
import { DEFAULT_CREATED_BY, DEFAULT_TASK_PRIORITY, DEFAULT_TASK_STATUS } from './task-constants';
import { generateId, getClockHourCycle, getWeekStart } from './utils';
import { PLANNER_UI_TEXT, type PlannerRescheduleRange } from './navigation-constants';
import { parsePlannerWhen, stripPlannerWhen } from './planner-commands';
import {
  cleanSteps,
  estimateWithSubtasks,
  improveTitle,
  isNoteSentence,
  normalizeShorthand,
  splitTitleDetail,
  splitClauses,
  splitInlineSteps,
  suggestSubtasks,
  taskTitleKey,
} from './planner-analysis';
import type { Subtask, Task, TaskPriority } from '../types';

export type PlannerCategory = 'work' | 'personal' | 'projects';

/** Gray dot for a task category, unique per category (neutral when uncategorized). */
export function plannerCategoryColor(category: PlannerCategory | null): string {
  return category ? tagShade(category) : COLOR_POP_NEUTRAL;
}

export interface PlannerDraft {
  id: string;
  title: string;
  priority: TaskPriority;
  category: PlannerCategory | null;
  estimatedMinutes: number;
  /** Date/time the user wrote ("tomorrow at 3pm"); a time books the task there, a day sets its due date. */
  when?: { date: string; hasTime: boolean };
  /** Steps the planner found or suggested; created as subtasks when the draft is accepted. */
  subtasks?: string[];
  /** Cleaned full sentence kept as the task description when the title had to be shortened. */
  notes?: string;
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
  const { categoryPatterns, personalFirstPattern } = PLANNER_CHAT_CONFIG;
  if (personalFirstPattern.test(title)) return 'personal';
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
  return withoutDuration.replace(/\s{2,}/g, ' ').replace(/[\s,.?(-]+$/, '').replace(/\(\s*\)/g, '').trim();
}

/** Build a full Task (unsaved) so the scheduler and estimator can work with a draft. */
export function draftToTask(draft: PlannerDraft, createdBy?: string | null): Task {
  const now = new Date().toISOString();
  return {
    id: draft.id,
    title: draft.title,
    description: draft.notes ?? '',
    status: DEFAULT_TASK_STATUS,
    priority: draft.priority,
    dueDate: draft.when && !draft.when.hasTime ? endOfDay(new Date(draft.when.date)).toISOString() : null,
    scheduledDate: draft.when?.hasTime ? draft.when.date : null,
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
    subtasks: (draft.subtasks ?? []).map((title): Subtask => ({ id: generateId(), title, completed: false, createdAt: now })),
    recurrence: RECURRENCE_NONE_CONFIG,
    notes: '',
  };
}

/** One draft from one task's text: tidied title, estimate, and subtasks when the task is bigger. */
function buildDraft(rawSource: string, explicitSteps?: string[]): PlannerDraft | null {
  const source = normalizeShorthand(rawSource);
  const listedSteps = explicitSteps?.slice(0, PLANNER_ANALYSIS_CONFIG.maxSubtasks);
  const inline = listedSteps?.length ? { title: source, steps: listedSteps } : splitInlineSteps(source);
  const titleSource = inline ? inline.title : source;
  const when = parsePlannerWhen(source, new Date());
  const titleWithoutWhen = when ? cleanTitle(stripPlannerWhen(titleSource)) : '';
  const keepsWhen = titleWithoutWhen.length >= PLANNER_CHAT_CONFIG.minTitleLength;
  const { title: shortTitle, detail } = splitTitleDetail(keepsWhen ? titleWithoutWhen : cleanTitle(titleSource));
  const title = improveTitle(shortTitle);
  if (title.length < PLANNER_CHAT_CONFIG.minTitleLength) return null;
  const draft: PlannerDraft = {
    id: generateId(),
    title,
    ...(detail ? { notes: detail } : {}),
    priority: inferPriority(source),
    category: inferCategory(source),
    estimatedMinutes: 0,
    ...(when && keepsWhen ? { when: { date: when.date.toISOString(), hasTime: when.hasTime } } : {}),
  };
  const baseMinutes = Math.round(estimateTaskHours({ ...draftToTask(draft), estimatedTime: null }) * MINUTES_PER_HOUR);
  const suggestion = inline ? null : suggestSubtasks(title);
  const subtasks = cleanSteps(inline?.steps ?? suggestion?.steps ?? [], title);
  if (subtasks.length > 0) draft.subtasks = subtasks;
  draft.estimatedMinutes =
    explicitMinutes(source) ??
    (subtasks.length > 0 ? estimateWithSubtasks(baseMinutes, subtasks.length, suggestion?.minutesPerStep) : baseMinutes);
  return draft;
}

/** Task-sized pieces of one line: a line with its own steps stays one task; otherwise each clause can be its own task. */
function linePieces(text: string): string[] {
  const pieces: string[] = [];
  for (const rawLine of text.split(PLANNER_CHAT_CONFIG.draftSeparator)) {
    const line = rawLine.replace(PLANNER_CHAT_CONFIG.listMarker, '').trim();
    if (!line) continue;
    pieces.push(...(splitInlineSteps(line) ? [line] : splitClauses(line)));
  }
  return pieces;
}

export function parsePlannerDrafts(text: string): PlannerDraft[] {
  const drafts: PlannerDraft[] = [];
  for (const piece of linePieces(text)) {
    const draft = buildDraft(piece);
    if (!draft) continue;
    drafts.push(draft);
    if (drafts.length >= PLANNER_CHAT_CONFIG.maxDraftsPerMessage) return drafts;
  }
  return drafts;
}

export interface BrainDumpResult {
  drafts: PlannerDraft[];
  /** Sentences left out because they read like notes or feelings. */
  skippedNotes: number;
  /** Tasks left out because they repeat one in the dump or one already open. */
  skippedDuplicates: number;
}

interface BrainDumpBlock {
  text: string;
  indent: number;
  isHeader: boolean;
  steps: string[];
}

/** Group a brain dump into blocks: a "Header:" line or a less-indented line owns the bulleted/indented lines under it. */
function groupBrainDump(text: string): BrainDumpBlock[] {
  const blocks: BrainDumpBlock[] = [];
  let parent: BrainDumpBlock | null = null;
  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) {
      parent = null;
      continue;
    }
    const indent = (raw.match(/^\s*/)?.[0] ?? '').replace(/\t/g, '  ').length;
    const isListItem = PLANNER_CHAT_CONFIG.listMarker.test(raw);
    const content = raw.replace(PLANNER_CHAT_CONFIG.listMarker, '').trim();
    if (parent && (indent > parent.indent || (parent.isHeader && isListItem))) {
      parent.steps.push(content);
      continue;
    }
    const block: BrainDumpBlock = {
      text: content,
      indent,
      isHeader: PLANNER_ANALYSIS_CONFIG.groupHeaderPattern.test(content),
      steps: [],
    };
    blocks.push(block);
    parent = block;
  }
  return blocks;
}

/**
 * Turn a messy brain dump (notes, an email, a rambling list) into clean draft tasks: headers and indented
 * lists become a task with subtasks, notes and feelings are left out, and repeats of open tasks are skipped.
 */
export function parseBrainDump(text: string, existingTitles: string[] = []): BrainDumpResult {
  const seen = new Set(existingTitles.map(taskTitleKey));
  const drafts: PlannerDraft[] = [];
  let skippedNotes = 0;
  let skippedDuplicates = 0;

  const push = (draft: PlannerDraft | null) => {
    if (!draft) return;
    const key = taskTitleKey(draft.title);
    if (seen.has(key)) {
      skippedDuplicates += 1;
      return;
    }
    seen.add(key);
    drafts.push(draft);
  };

  for (const block of groupBrainDump(text)) {
    if (drafts.length >= PLANNER_CHAT_CONFIG.maxDraftsPerBrainDump) break;
    if (block.steps.length > 0) {
      push(buildDraft(block.text.replace(PLANNER_ANALYSIS_CONFIG.groupHeaderPattern, ''), block.steps));
      continue;
    }
    for (const piece of linePieces(block.text)) {
      if (drafts.length >= PLANNER_CHAT_CONFIG.maxDraftsPerBrainDump) break;
      if (isNoteSentence(piece)) {
        skippedNotes += 1;
        continue;
      }
      push(buildDraft(piece));
    }
  }
  return { drafts, skippedNotes, skippedDuplicates };
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

/** "Fri, Oct 16, 3:00 PM" for a booked time, "Due Fri, Oct 16" for a day only. */
export function formatDraftWhen(when: NonNullable<PlannerDraft['when']>): string {
  const date = new Date(when.date);
  if (when.hasTime) return formatPlannedWhen(date);
  return PLANNER_UI_TEXT.chat.dueOn(date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }));
}

export function formatPlannedWhen(date: Date): string {
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: getClockHourCycle(),
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
