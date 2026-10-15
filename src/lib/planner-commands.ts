/**
 * Planner chat commands on existing tasks: find a task from a loose reference, then adjust it
 * (move, rename, priority, duration, done), start focus, add subtasks or tags, assign, or duplicate.
 */

import { PLANNER_CHAT_CONFIG } from './ai-config';
import { DAYS_IN_WEEK, HOURS_PER_DAY, HOURS_PER_HALF_DAY, MINUTES_PER_HOUR } from './business-constants';
import type { Task, TaskPriority, User } from '../types';

const CONFIG = PLANNER_CHAT_CONFIG;
const PATTERNS = CONFIG.commandPatterns;

export type PlannerCommand =
  | { kind: 'pomodoro'; ref: string }
  | { kind: 'subtasks'; ref: string; items: string[] }
  | { kind: 'tags'; ref: string; tags: string[] }
  | { kind: 'createTags'; tags: string[] }
  | { kind: 'assign'; ref: string; member: string }
  | { kind: 'duplicate'; ref: string }
  | { kind: 'unschedule'; ref: string }
  | { kind: 'rename'; ref: string; title: string }
  | { kind: 'duration'; ref: string; minutes: number }
  | { kind: 'priority'; ref: string; priority: TaskPriority }
  | { kind: 'done'; ref: string }
  | { kind: 'move'; ref: string; when: string }
  | { kind: 'find'; ref: string };

function clean(value: string): string {
  return value.trim().replace(/^["'“‘]+|["'”’.!]+$/g, '').trim();
}

export function splitList(value: string): string[] {
  return value
    .split(CONFIG.listSplitPattern)
    .map((item) => clean(item.replace(CONFIG.listMarker, '')))
    .filter((item) => item.length >= CONFIG.minTitleLength);
}

/** Tag names are stored lowercase, without "#", with spaces as dashes. */
export function normalizeTag(value: string): string {
  return clean(value).replace(/^#/, '').toLowerCase().replace(/\s+/g, '-');
}

function parseTags(value: string): string[] {
  return [...new Set(splitList(value).map(normalizeTag).filter(Boolean))];
}

export function parseDurationMinutes(value: string): number | null {
  const match = value.match(CONFIG.durationPattern);
  if (!match) return null;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(CONFIG.hourUnitPattern.test(match[2]) ? amount * MINUTES_PER_HOUR : amount);
}

/** Recognize a command on an existing task. Returns null for anything else (questions, new tasks). */
export function parsePlannerCommand(text: string): PlannerCommand | null {
  const input = text.trim();
  let match: RegExpMatchArray | null;

  if ((match = input.match(PATTERNS.pomodoro)) || (match = input.match(PATTERNS.focus))) {
    return { kind: 'pomodoro', ref: clean(match[1]) };
  }
  if ((match = input.match(PATTERNS.subtasks)) || (match = input.match(PATTERNS.breakDown))) {
    const items = splitList(match[2]);
    if (items.length > 0) return { kind: 'subtasks', ref: clean(match[1]), items };
  }
  if ((match = input.match(PATTERNS.addTags))) {
    const tags = parseTags(match[1]);
    if (tags.length > 0) return { kind: 'tags', ref: clean(match[2]), tags };
  }
  if ((match = input.match(PATTERNS.tagTask))) {
    const tags = parseTags(match[2]);
    if (tags.length > 0) return { kind: 'tags', ref: clean(match[1]), tags };
  }
  if ((match = input.match(PATTERNS.createTag))) {
    const tags = parseTags(match[1]);
    if (tags.length > 0) return { kind: 'createTags', tags };
  }
  if ((match = input.match(PATTERNS.assign))) {
    return { kind: 'assign', ref: clean(match[1]), member: clean(match[2]) };
  }
  if ((match = input.match(PATTERNS.duplicate))) return { kind: 'duplicate', ref: clean(match[1]) };
  if ((match = input.match(PATTERNS.unschedule))) return { kind: 'unschedule', ref: clean(match[1]) };
  if ((match = input.match(PATTERNS.rename))) {
    return { kind: 'rename', ref: clean(match[1]), title: clean(match[2]) };
  }
  if ((match = input.match(PATTERNS.durationSet)) || (match = input.match(PATTERNS.durationTakes))) {
    const minutes = parseDurationMinutes(match[2]);
    if (minutes) return { kind: 'duration', ref: clean(match[1]), minutes };
  }
  if ((match = input.match(PATTERNS.priority))) {
    return { kind: 'priority', ref: clean(match[1]), priority: match[2].toLowerCase() as TaskPriority };
  }
  if ((match = input.match(PATTERNS.done)) || (match = input.match(PATTERNS.complete))) {
    return { kind: 'done', ref: clean(match[1]) };
  }
  if ((match = input.match(PATTERNS.move))) return { kind: 'move', ref: clean(match[1]), when: match[2].trim() };
  if ((match = input.match(PATTERNS.find))) return { kind: 'find', ref: clean(match[1]) };
  return null;
}

// ---------------------------------------------------------------------------
// Task lookup
// ---------------------------------------------------------------------------

function words(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function normalizeReference(ref: string): string {
  return clean(ref).replace(CONFIG.referenceNoisePattern, '').trim();
}

/** 1 for an exact title, high when one contains the other, else the share of reference words in the title. */
function matchScore(title: string, ref: string): number {
  const a = title.trim().toLowerCase();
  const b = ref.toLowerCase();
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) {
    const overlap = Math.min(a.length, b.length) / Math.max(a.length, b.length);
    return CONFIG.containsBaseScore + (1 - CONFIG.containsBaseScore) * overlap;
  }
  const titleWords = new Set(words(a));
  const refWords = words(b);
  if (refWords.length === 0) return 0;
  const hits = refWords.filter((word) => titleWords.has(word) || [...titleWords].some((t) => t.startsWith(word))).length;
  return hits / Math.max(refWords.length, titleWords.size);
}

export type TaskLookup =
  | { kind: 'found'; task: Task }
  | { kind: 'ambiguous'; options: Task[] }
  | { kind: 'missing'; ref: string };

export function findTaskByReference(tasks: Task[], ref: string, lastTaskId: string | null): TaskLookup {
  const reference = normalizeReference(ref);
  if (CONFIG.pronounPattern.test(reference) || reference.length === 0) {
    const last = lastTaskId ? tasks.find((task) => task.id === lastTaskId) : undefined;
    return last ? { kind: 'found', task: last } : { kind: 'missing', ref };
  }

  const scored = tasks
    .map((task) => ({ task, score: matchScore(task.title, reference) }))
    .filter(({ score }) => score >= CONFIG.minMatchScore)
    // Prefer open tasks over finished ones with the same score.
    .sort((x, y) => y.score - x.score || Number(x.task.status === 'done') - Number(y.task.status === 'done'));

  if (scored.length === 0) return { kind: 'missing', ref };
  const best = scored[0];
  const close = scored.filter(
    ({ task, score }) => best.score - score <= CONFIG.ambiguityMargin && task.title.toLowerCase() !== best.task.title.toLowerCase(),
  );
  if (best.score < 1 && close.length > 0) {
    return { kind: 'ambiguous', options: [best.task, ...close.map(({ task }) => task)].slice(0, CONFIG.maxAmbiguousShown) };
  }
  return { kind: 'found', task: best.task };
}

export function findTeamMember(members: User[], ref: string): User | null {
  const reference = clean(ref).toLowerCase();
  const exact = members.find(
    (member) => member.name?.toLowerCase() === reference || member.email?.toLowerCase() === reference,
  );
  if (exact) return exact;
  const partial = members.filter(
    (member) =>
      words(member.name ?? '').some((word) => word.startsWith(reference)) ||
      member.email?.toLowerCase().startsWith(reference),
  );
  return partial.length === 1 ? partial[0] : null;
}

// ---------------------------------------------------------------------------
// Dates: "tomorrow", "friday 3pm", "next tue at 9:30", "oct 20", "in 3 days"
// ---------------------------------------------------------------------------

export interface PlannerWhen {
  date: Date;
  /** False when only a day was given; the scheduler then picks the time. */
  hasTime: boolean;
}

function nameIndex(names: readonly string[], word: string): number {
  const value = word.toLowerCase();
  if (value.length < CONFIG.when.namePrefixLength) return -1;
  return names.findIndex((name) => name.startsWith(value));
}

/** Weekday index for a word, skipping ambiguous abbreviations ("sun hat") unless a lead-in precedes them. */
function weekdayAt(text: string, word: string, index: number): number {
  const { when } = CONFIG;
  const weekday = nameIndex(when.weekdays, word);
  if (weekday < 0) return -1;
  if (!(when.ambiguousDayWords as readonly string[]).includes(word.toLowerCase())) return weekday;
  const previous = text.slice(0, index).trim().split(/\s+/).pop()?.toLowerCase() ?? '';
  return (when.leadInWords as readonly string[]).includes(previous) ? weekday : -1;
}

function parseTime(text: string): { hours: number; minutes: number } | null {
  const { when } = CONFIG;
  if (when.noonPattern.test(text)) return { hours: HOURS_PER_HALF_DAY, minutes: 0 };
  const meridiem = text.match(when.meridiemTimePattern);
  if (meridiem) {
    const hour = Number(meridiem[1]);
    const minutes = Number(meridiem[2] ?? 0);
    if (hour < 1 || hour > HOURS_PER_HALF_DAY || minutes >= MINUTES_PER_HOUR) return null;
    const isPm = when.pmPattern.test(meridiem[3]);
    const hours = (hour % HOURS_PER_HALF_DAY) + (isPm ? HOURS_PER_HALF_DAY : 0);
    return { hours, minutes };
  }
  const clock = text.match(when.clockTimePattern);
  if (clock) {
    const hours = Number(clock[1]);
    const minutes = Number(clock[2]);
    if (hours >= HOURS_PER_DAY || minutes >= MINUTES_PER_HOUR) return null;
    return { hours, minutes };
  }
  return null;
}

function parseDay(text: string, now: Date): Date | null {
  const { when } = CONFIG;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const plus = (days: number) => {
    const day = new Date(today);
    day.setDate(day.getDate() + days);
    return day;
  };

  if (when.todayPattern.test(text)) return today;
  if (when.tomorrowPattern.test(text)) return plus(1);
  const inDays = text.match(when.inDaysPattern);
  if (inDays) return plus(Number(inDays[1]));

  const monthDay = text.match(when.monthDayPattern);
  if (monthDay) {
    const month = nameIndex(when.months, monthDay[1]);
    if (month >= 0) {
      const date = new Date(today.getFullYear(), month, Number(monthDay[2]));
      if (date < today) date.setFullYear(date.getFullYear() + 1);
      return date;
    }
  }
  const numeric = text.match(when.numericDatePattern);
  if (numeric) {
    const date = new Date(today.getFullYear(), Number(numeric[1]) - 1, Number(numeric[2]));
    if (!Number.isNaN(date.getTime())) {
      if (date < today) date.setFullYear(date.getFullYear() + 1);
      return date;
    }
  }

  const next = text.match(when.nextPrefixPattern);
  const nextWeekday = next ? nameIndex(when.weekdays, next[1]) : -1;
  if (nextWeekday >= 0) {
    const ahead = (nextWeekday - today.getDay() + DAYS_IN_WEEK) % DAYS_IN_WEEK || DAYS_IN_WEEK;
    return plus(ahead);
  }
  if (when.nextWeekPattern.test(text)) return plus(DAYS_IN_WEEK);

  for (const { 0: word, index } of text.matchAll(when.wordPattern)) {
    const weekday = weekdayAt(text, word, index ?? 0);
    if (weekday >= 0) return plus((weekday - today.getDay() + DAYS_IN_WEEK) % DAYS_IN_WEEK);
  }
  return null;
}

/** Remove the date/time phrases `parsePlannerWhen` reads, plus lead-in words like "on" or "at". */
export function stripPlannerWhen(text: string): string {
  const { when } = CONFIG;
  const isMonthDay = (match: string) => {
    const parts = match.match(when.monthDayPattern);
    return Boolean(parts && nameIndex(when.months, parts[1]) >= 0);
  };
  const isWeekday = (match: string, index: number, source: string) => weekdayAt(source, match, index) >= 0;
  const phrases: Array<{ pattern: RegExp; keep?: (match: string, index: number, source: string) => boolean }> = [
    { pattern: when.todayPattern },
    { pattern: when.tomorrowPattern },
    { pattern: when.inDaysPattern },
    { pattern: when.nextWeekPattern },
    { pattern: when.monthDayPattern, keep: (match) => !isMonthDay(match) },
    { pattern: when.numericDatePattern },
    { pattern: when.meridiemTimePattern },
    { pattern: when.clockTimePattern },
    { pattern: when.noonPattern },
    { pattern: when.wordPattern, keep: (match, index, source) => !isWeekday(match, index, source) },
  ];

  const marker = '\u0000';
  let result = text;
  for (const { pattern, keep } of phrases) {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    result = result.replace(new RegExp(pattern.source, flags), (...args: unknown[]) => {
      const match = args[0] as string;
      const index = args[args.length - 2] as number;
      const source = args[args.length - 1] as string;
      return keep?.(match, index, source) ? match : marker;
    });
  }
  const leadIns = new RegExp(`(?:\\b(?:${when.leadInWords.join('|')})\\s+)*${marker}`, 'gi');
  return clean(result.replace(leadIns, ' ').replace(/\s+/g, ' ').replace(/\s+([,.;!?])/g, '$1').replace(/[\s,;-]+$/, ''));
}

export function parsePlannerWhen(text: string, now: Date): PlannerWhen | null {
  const time = parseTime(text);
  const day = parseDay(text, now);
  if (!day && !time) return null;

  const date = new Date(day ?? now);
  if (!day) date.setHours(0, 0, 0, 0);
  if (time) {
    date.setHours(time.hours, time.minutes, 0, 0);
    // A bare time that already passed today means tomorrow.
    if (!day && date.getTime() <= now.getTime()) date.setDate(date.getDate() + 1);
  }
  return { date, hasTime: Boolean(time) };
}
