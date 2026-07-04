import type { Task } from '../types';
import { isDateInRecurrence } from './recurrence';
import { parseCalendarEventTime, getDateString, parseTaskScheduledDate } from './utils';
import { TASK_CALCULATION_CONSTANTS } from './task-calculation-constants';
import { getTaskMinutes, getTaskSchedulingMinutes } from './daily-hours-utils';
import { DEFAULT_WEEKDAY_WORK_START, MILLISECONDS_PER_MINUTE, MILLISECONDS_PER_HOUR, MINUTES_PER_HOUR, HOURS_PER_DAY } from './business-constants';
import {
  TIME_ROUNDING_INTERVAL_MINUTES,
  MIN_TASK_DURATION_MINUTES,
  AI_SCHEDULING_PREP_BUFFER_MINUTES,
} from './ai-config';

/**
 * Options for finding next available slot
 */
export interface FindSlotOptions {
  ensureAfterCurrentTime?: boolean;
  /** When true, only move tasks that overlap each other; do not move tasks for being "before work start" or "before now". */
  onlyFixOverlaps?: boolean;
  categoryHours?: { start: number; end: number } | null; // in minutes from midnight
  calendarEvents?: Array<{ start: Date | string; end: Date | string; title: string }>; // Calendar events to avoid (start/end as ISO string or Date)
  /** Prep buffer (minutes) after tasks and before/after calendar events — used by AI scheduler. */
  schedulingPrepBufferMinutes?: number;
}

/** Slot options for all scheduling — prep time between tasks and around calendar events. */
export function buildSchedulingSlotOptions(
  base: Omit<FindSlotOptions, 'schedulingPrepBufferMinutes'> = {},
): FindSlotOptions {
  return {
    ...base,
    schedulingPrepBufferMinutes: AI_SCHEDULING_PREP_BUFFER_MINUTES,
  };
}

/** Manual scheduling (TaskDialog, drag-drop) — same prep buffer as AI scheduler. */
export function buildManualSchedulingSlotOptions(
  base: Omit<FindSlotOptions, 'schedulingPrepBufferMinutes'> = {},
): FindSlotOptions {
  return buildSchedulingSlotOptions(base);
}

/** @deprecated Prefer `buildSchedulingSlotOptions` — kept for AI scheduler call sites. */
export function buildAISchedulerSlotOptions(
  base: Omit<FindSlotOptions, 'schedulingPrepBufferMinutes'> = {},
): FindSlotOptions {
  return buildSchedulingSlotOptions(base);
}

export function getSchedulingPrepBufferMs(options?: FindSlotOptions): number {
  const minutes = options?.schedulingPrepBufferMinutes ?? 0;
  return minutes > 0 ? minutes * MILLISECONDS_PER_MINUTE : 0;
}

/** Extend a task block end to reserve prep time before the next item. */
export function expandTaskBlockEndForSchedulingPrep(blockEndMs: number, prepBufferMs: number): number {
  return prepBufferMs > 0 ? blockEndMs + prepBufferMs : blockEndMs;
}

/** Extend a calendar block to reserve prep time before and after the event. */
export function expandCalendarBlockForSchedulingPrep(
  blockStartMs: number,
  blockEndMs: number,
  prepBufferMs: number,
): { start: number; end: number } {
  if (prepBufferMs <= 0) {
    return { start: blockStartMs, end: blockEndMs };
  }
  return { start: blockStartMs - prepBufferMs, end: blockEndMs + prepBufferMs };
}

/** Round a time up to the next scheduling slot boundary. */
export function roundTimeUpToSchedulingSlot(time: Date): Date {
  const rounded = new Date(time);
  const minutes = rounded.getMinutes();
  const roundedMinutes = Math.ceil(minutes / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
  if (roundedMinutes >= MINUTES_PER_HOUR) {
    rounded.setHours(rounded.getHours() + 1);
    rounded.setMinutes(0);
  } else {
    rounded.setMinutes(roundedMinutes);
  }
  rounded.setSeconds(0);
  rounded.setMilliseconds(0);
  return rounded;
}

function isTargetDateToday(targetDate: Date): boolean {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return targetDate.getTime() === todayStart.getTime();
}

/** Earliest allowed start (ms) — never before now when scheduling for today. */
function getSchedulingEarliestStartMs(
  requestedTime: Date,
  targetDate: Date,
  options?: FindSlotOptions,
): number {
  let earliest = requestedTime.getTime();
  if (options?.ensureAfterCurrentTime && isTargetDateToday(targetDate)) {
    earliest = Math.max(earliest, roundTimeUpToSchedulingSlot(new Date()).getTime());
  }
  return earliest;
}

function taskFitsInCategoryHours(
  startMs: number,
  taskDurationMinutes: number,
  categoryHours: { start: number; end: number },
): boolean {
  const startDate = new Date(startMs);
  const startTotalMinutes = startDate.getHours() * MINUTES_PER_HOUR + startDate.getMinutes();
  return (
    startTotalMinutes >= categoryHours.start &&
    startTotalMinutes + taskDurationMinutes <= categoryHours.end
  );
}

function buildNoSlotOnDayTime(requestedTime: Date): Date {
  const noSlotTime = new Date(requestedTime);
  noSlotTime.setHours(HOURS_PER_DAY, 0, 0, 0);
  return noSlotTime;
}

/** If a start time falls inside a calendar prep window, advance to after that window. */
export function advancePastCalendarPrepWindows(
  startMs: number,
  calendarBlocks: CalendarConflictBlock[],
  prepBufferMs: number,
): number {
  let next = startMs;
  let changed = true;
  while (changed) {
    changed = false;
    for (const block of calendarBlocks) {
      const expanded = expandCalendarBlockForSchedulingPrep(block.start, block.end, prepBufferMs);
      if (next >= expanded.start && next < expanded.end) {
        next = expanded.end;
        changed = true;
      }
    }
  }
  return next;
}

type SchedulingObstacle = { start: number; end: number };

function buildSchedulingObstaclesForDay(
  targetDate: Date,
  sortedTasks: Array<{ task: Task; start: number; end: number }>,
  calendarBlocks: CalendarConflictBlock[],
  prepBufferMs: number,
  excludeTaskId?: string | null,
): SchedulingObstacle[] {
  const obstacles: SchedulingObstacle[] = [];
  for (const block of calendarBlocks) {
    const expanded = expandCalendarBlockForSchedulingPrep(block.start, block.end, prepBufferMs);
    obstacles.push({ start: expanded.start, end: expanded.end });
  }
  for (const existing of sortedTasks) {
    if (excludeTaskId && existing.task.id === excludeTaskId) continue;
    obstacles.push({
      start: existing.start,
      end: expandTaskBlockEndForSchedulingPrep(existing.end, prepBufferMs),
    });
  }
  obstacles.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: SchedulingObstacle[] = [];
  for (const obstacle of obstacles) {
    const last = merged[merged.length - 1];
    if (!last || obstacle.start > last.end) {
      merged.push({ ...obstacle });
    } else {
      last.end = Math.max(last.end, obstacle.end);
    }
  }
  return merged;
}

function fitsCategoryHours(
  startMs: number,
  durationMinutes: number,
  categoryHours?: { start: number; end: number } | null,
): boolean {
  if (!categoryHours) return true;
  const startDate = new Date(startMs);
  const startMinutes = startDate.getHours() * MINUTES_PER_HOUR + startDate.getMinutes();
  const endMinutes = startMinutes + durationMinutes;
  return startMinutes >= categoryHours.start && endMinutes <= categoryHours.end;
}

/**
 * Find an open gap before calendar/task obstacles when forward placement exceeds category hours.
 */
function tryFindGapBeforeObstacles(
  targetDate: Date,
  earliestStartMs: number,
  taskDurationMinutes: number,
  obstacles: SchedulingObstacle[],
  categoryHours?: { start: number; end: number } | null,
): Date | null {
  const durationMs = taskDurationMinutes * MILLISECONDS_PER_MINUTE;
  let cursor = roundTimeUpToSchedulingSlot(new Date(Math.max(earliestStartMs, targetDate.getTime()))).getTime();
  const dayEndMs = new Date(targetDate);
  dayEndMs.setHours(HOURS_PER_DAY, 0, 0, 0);

  for (const obstacle of obstacles) {
    if (obstacle.end <= cursor) continue;
    if (cursor + durationMs <= obstacle.start && fitsCategoryHours(cursor, taskDurationMinutes, categoryHours)) {
      return new Date(cursor);
    }
    cursor = Math.max(cursor, obstacle.end);
    cursor = roundTimeUpToSchedulingSlot(new Date(cursor)).getTime();
  }

  if (cursor + durationMs <= dayEndMs.getTime() && fitsCategoryHours(cursor, taskDurationMinutes, categoryHours)) {
    return new Date(cursor);
  }
  return null;
}

/** Force a slot after all obstacles conflicting with the requested window. */
function findSlotAfterObstacles(
  targetDate: Date,
  requestedTime: Date,
  taskDurationMinutes: number,
  obstacles: SchedulingObstacle[],
  options?: FindSlotOptions,
): Date | null {
  const durationMs = taskDurationMinutes * MILLISECONDS_PER_MINUTE;
  const requestedStart = requestedTime.getTime();
  const requestedEnd = requestedStart + durationMs;
  let maxConflictEnd = requestedStart;
  for (const obstacle of obstacles) {
    if (scheduleBlocksConflict(requestedStart, requestedEnd, obstacle.start, obstacle.end)) {
      maxConflictEnd = Math.max(maxConflictEnd, obstacle.end);
    }
  }
  if (maxConflictEnd <= requestedStart) return null;
  const afterObstacles = roundTimeUpToSchedulingSlot(new Date(maxConflictEnd));
  const slot = findNextAvailableSlot(
    null,
    afterObstacles,
    taskDurationMinutes,
    [],
    { ...options, categoryHours: undefined },
  );
  if (slot.getHours() < HOURS_PER_DAY) {
    return slot;
  }
  return null;
}

export function resolveSchedulingSlot(
  taskId: string | null,
  requestedTime: Date,
  taskDurationMinutes: number,
  allTasks: Task[],
  options?: FindSlotOptions,
): Date {
  const targetDate = new Date(requestedTime);
  targetDate.setHours(0, 0, 0, 0);
  const prepBufferMs = getSchedulingPrepBufferMs(options);
  const calendarBlocks = options?.calendarEvents
    ? buildCalendarConflictBlocksForDay(options.calendarEvents, targetDate)
    : [];

  let slot = findNextAvailableSlot(taskId, requestedTime, taskDurationMinutes, allTasks, options);
  if (slot.getHours() < HOURS_PER_DAY) {
    const slotStart = slot.getTime();
    const slotEnd = slotStart + taskDurationMinutes * MILLISECONDS_PER_MINUTE;
    const hasCalendarConflict = calendarBlocks.some((block) => {
      const expanded = expandCalendarBlockForSchedulingPrep(block.start, block.end, prepBufferMs);
      return scheduleBlocksConflict(slotStart, slotEnd, expanded.start, expanded.end);
    });
    if (!hasCalendarConflict) {
      return slot;
    }
  }

  const dateTasks = allTasks.filter((task) => {
    if (taskId && task.id === taskId) return false;
    if (task.status === 'done' || !task.scheduledDate) return false;
    return isDateInRecurrence(task, targetDate);
  });
  const sortedTasks = dateTasks
    .map((task) => {
      const scheduledDate = parseTaskScheduledDate(task.scheduledDate);
      if (isNaN(scheduledDate.getTime())) return null;
      const start = scheduledDate.getTime();
      const end = start + getTaskSchedulingMinutes(task, { useCachedAIAnalysis: true }) * MILLISECONDS_PER_MINUTE;
      return { task, start, end };
    })
    .filter((item): item is { task: Task; start: number; end: number } => item !== null)
    .sort((a, b) => a.start - b.start);

  const obstacles = buildSchedulingObstaclesForDay(
    targetDate,
    sortedTasks,
    calendarBlocks,
    prepBufferMs,
    taskId,
  );

  const earliestStartMs = getSchedulingEarliestStartMs(requestedTime, targetDate, options);
  if (
    options?.categoryHours &&
    !taskFitsInCategoryHours(earliestStartMs, taskDurationMinutes, options.categoryHours)
  ) {
    return buildNoSlotOnDayTime(requestedTime);
  }

  const gapSlot = tryFindGapBeforeObstacles(
    targetDate,
    earliestStartMs,
    taskDurationMinutes,
    obstacles,
    options?.categoryHours ?? null,
  );
  if (gapSlot) return gapSlot;

  slot = findNextAvailableSlot(
    taskId,
    requestedTime,
    taskDurationMinutes,
    allTasks,
    { ...options, categoryHours: undefined },
  );
  if (slot.getHours() < HOURS_PER_DAY) return slot;

  const forced = findSlotAfterObstacles(
    targetDate,
    requestedTime,
    taskDurationMinutes,
    obstacles,
    options,
  );
  if (forced) return forced;

  const failureTime = new Date(requestedTime);
  failureTime.setHours(HOURS_PER_DAY, 0, 0, 0);
  return failureTime;
}

/** Calendar event shape for findNextAvailableSlot conflict checks. */
export type ConflictCalendarEvent = { start: Date | string; end: Date | string; title: string };

/** Normalized calendar block for conflict checks (ms timestamps). */
export type CalendarConflictBlock = { start: number; end: number; title: string };

/** Map API calendar events to conflict-check format. */
export function toConflictCalendarEvents(
  events: Array<{ start: Date | string; end: Date | string; title: string }>,
): ConflictCalendarEvent[] {
  return events.map((event) => ({ start: event.start, end: event.end, title: event.title }));
}

/** Parse a calendar event timestamp (ISO string or Date) to epoch ms. */
export function calendarEventToTimestamp(value: Date | string): number {
  if (value instanceof Date) return value.getTime();
  return parseCalendarEventTime(value).getTime();
}

/** End of a calendar block for scheduling; enforces a minimum duration so zero-length events still block. */
export function getCalendarEventBlockEndMs(startMs: number, endMs: number): number {
  const minEnd = startMs + MIN_TASK_DURATION_MINUTES * MILLISECONDS_PER_MINUTE;
  return Number.isNaN(endMs) || endMs <= startMs ? minEnd : Math.max(endMs, minEnd);
}

/** True when a candidate task slot shares start time or overlaps another block (tasks or calendar events). */
export function scheduleBlocksConflict(
  candidateStart: number,
  candidateEnd: number,
  blockStart: number,
  blockEnd: number,
): boolean {
  const sameStartTime = Math.abs(candidateStart - blockStart) < MILLISECONDS_PER_MINUTE;
  const overlaps = candidateStart < blockEnd && candidateEnd > blockStart;
  return sameStartTime || overlaps;
}

/** True when a candidate slot conflicts with a task block, including AI prep time after the block. */
export function aiSchedulingTaskBlockConflicts(
  candidateStartMs: number,
  candidateEndMs: number,
  blockStartMs: number,
  blockEndMs: number,
  prepBufferMs: number = AI_SCHEDULING_PREP_BUFFER_MINUTES * MILLISECONDS_PER_MINUTE,
): boolean {
  return scheduleBlocksConflict(
    candidateStartMs,
    candidateEndMs,
    blockStartMs,
    expandTaskBlockEndForSchedulingPrep(blockEndMs, prepBufferMs),
  );
}

/** True when any task or calendar event blocks overlap on a local day (post-scheduling validation). */
export function dayHasScheduleOverlaps(
  tasks: Task[],
  calendarEvents: ConflictCalendarEvent[],
  targetDate: Date,
): boolean {
  const targetDay = new Date(targetDate);
  targetDay.setHours(0, 0, 0, 0);

  type Block = { start: number; end: number };
  const blocks: Block[] = [];

  for (const event of buildCalendarConflictBlocksForDay(calendarEvents, targetDay)) {
    blocks.push({ start: event.start, end: event.end });
  }

  for (const task of tasks) {
    if (task.status === 'done' || !task.scheduledDate) continue;
    if (!isDateInRecurrence(task, targetDay)) continue;
    const startMs = calendarEventToTimestamp(task.scheduledDate);
    if (Number.isNaN(startMs)) continue;
    const durationMins = getTaskSchedulingMinutes(task, { useCachedAIAnalysis: true });
    blocks.push({
      start: startMs,
      end: startMs + durationMins * MILLISECONDS_PER_MINUTE,
    });
  }

  blocks.sort((a, b) => a.start - b.start);
  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      if (blocks[j].start >= blocks[i].end) break;
      if (scheduleBlocksConflict(blocks[i].start, blocks[i].end, blocks[j].start, blocks[j].end)) {
        return true;
      }
    }
  }
  return false;
}

/** Build normalized calendar conflict blocks for one local day. */
export function buildCalendarConflictBlocksForDay(
  events: ConflictCalendarEvent[],
  targetDate: Date,
): CalendarConflictBlock[] {
  const targetDay = new Date(targetDate);
  targetDay.setHours(0, 0, 0, 0);
  const targetTime = targetDay.getTime();
  const blocks: CalendarConflictBlock[] = [];
  for (const event of events) {
    const startMs = calendarEventToTimestamp(event.start);
    if (Number.isNaN(startMs)) continue;
    const eventDay = new Date(startMs);
    eventDay.setHours(0, 0, 0, 0);
    if (eventDay.getTime() !== targetTime) continue;
    const endMs = calendarEventToTimestamp(event.end);
    blocks.push({
      start: startMs,
      end: getCalendarEventBlockEndMs(startMs, endMs),
      title: event.title,
    });
  }
  return blocks;
}

/** Events occurring on a specific local calendar day. */
export function filterCalendarEventsForDay(
  events: Array<{ start: Date | string; end: Date | string; title: string }>,
  targetDate: Date,
): ConflictCalendarEvent[] {
  const targetDay = new Date(targetDate);
  targetDay.setHours(0, 0, 0, 0);
  const targetTime = targetDay.getTime();
  return events
    .filter((event) => {
      const eventStart = calendarEventToTimestamp(event.start);
      if (Number.isNaN(eventStart)) return false;
      const eventDay = new Date(eventStart);
      eventDay.setHours(0, 0, 0, 0);
      return eventDay.getTime() === targetTime;
    })
    .map((event) => ({ start: event.start, end: event.end, title: event.title }));
}

/** Lookup events for one day from a pre-grouped events-by-date map. */
export function filterCalendarEventsForDayFromByDate<T extends { start: string; end: string; title: string }>(
  eventsByDate: Record<string, T[]>,
  targetDate: Date,
): ConflictCalendarEvent[] {
  return toConflictCalendarEvents(eventsByDate[getDateString(targetDate)] ?? []);
}

/**
 * Check if a time slot conflicts with existing tasks on the same day
 * @param taskId - ID of the task being checked (exclude from conflict check)
 * @param scheduledTime - The scheduled time to check
 * @param taskDuration - Duration of the task in minutes
 * @param allTasks - All tasks to check against
 * @returns The conflicting task if found, null otherwise
 */
export function checkTimeConflict(
  taskId: string | null,
  scheduledTime: Date,
  taskDuration: number,
  allTasks: Task[],
  calendarEvents?: ConflictCalendarEvent[],
  options?: Pick<FindSlotOptions, 'schedulingPrepBufferMinutes'>,
): Task | null {
  const targetDate = new Date(scheduledTime);
  targetDate.setHours(0, 0, 0, 0);
  const prepBufferMs = getSchedulingPrepBufferMs(
    options ?? { schedulingPrepBufferMinutes: AI_SCHEDULING_PREP_BUFFER_MINUTES },
  );

  // Get all tasks scheduled for the target date (excluding the current task)
  const dateTasks = allTasks.filter((task) => {
    if (taskId && task.id === taskId) return false; // Exclude the task being checked
    if (task.status === 'done') return false; // Exclude completed tasks
    return isDateInRecurrence(task, targetDate);
  });

  const newTaskStart = scheduledTime.getTime();
  const newTaskEnd = newTaskStart + (taskDuration * MILLISECONDS_PER_MINUTE);

  if (calendarEvents?.length) {
    const calendarBlocks = buildCalendarConflictBlocksForDay(calendarEvents, targetDate);
    for (const event of calendarBlocks) {
      const expanded = expandCalendarBlockForSchedulingPrep(event.start, event.end, prepBufferMs);
      if (scheduleBlocksConflict(newTaskStart, newTaskEnd, expanded.start, expanded.end)) {
        return null;
      }
    }
  }

  // Check for overlaps with existing tasks (including prep time after each block)
  for (const existingTask of dateTasks) {
    if (!existingTask.scheduledDate) continue;

    // Parse scheduledDate - handle both ISO strings and Date objects
    const existingTaskScheduledDate = parseTaskScheduledDate(existingTask.scheduledDate);
    
    const existingTaskStart = existingTaskScheduledDate.getTime();
    // Use at least MIN_TASK_DURATION_MINUTES so we never treat a scheduled block as zero-length (prevents overlaps)
    const existingTaskDuration = getTaskSchedulingMinutes(existingTask, { useCachedAIAnalysis: true }) * MILLISECONDS_PER_MINUTE;
    const existingTaskEnd = existingTaskStart + existingTaskDuration;
    const existingBlockEnd = expandTaskBlockEndForSchedulingPrep(existingTaskEnd, prepBufferMs);

    // Check for overlap: new task overlaps if it starts before existing block ends AND ends after existing starts
    if (newTaskStart < existingBlockEnd && newTaskEnd > existingTaskStart) {
      return existingTask;
    }
  }

  return null;
}

/**
 * Find the next available time slot after the requested time
 * @param taskId - ID of the task being scheduled (exclude from conflict check)
 * @param requestedTime - The requested time
 * @param taskDuration - Duration of the task in minutes
 * @param allTasks - All tasks to check against
 * @param options - Optional settings for time validation
 * @returns The next available time slot
 */
export function findNextAvailableSlot(
  taskId: string | null,
  requestedTime: Date,
  taskDuration: number,
  allTasks: Task[],
  options?: FindSlotOptions
): Date {
  const targetDate = new Date(requestedTime);
  targetDate.setHours(0, 0, 0, 0);
  
  if (import.meta.env.DEV && allTasks.length > 0) {
    console.debug('findNextAvailableSlot', {
      taskId,
      requestedTime: requestedTime.toISOString(),
      taskDuration,
      allTasksCount: allTasks.length,
    });
  }

  // Get all tasks scheduled for the target date (excluding the current task)
  // CRITICAL: Include ALL tasks regardless of category to detect conflicts across categories
  // This ensures recurring tasks see regular tasks and vice versa
  // CRITICAL: Also filter out tasks with invalid times (midnight) to ensure we only check real scheduled times
  const dateTasks = allTasks.filter((task) => {
    if (taskId && task.id === taskId) return false;
    if (task.status === 'done') return false;
    if (!task.scheduledDate) return false; // Must have a scheduled date
    
    // CRITICAL: Parse scheduledDate to check if it's for the target date
    // Handle both ISO strings and Date objects
    const taskScheduledDate = parseTaskScheduledDate(task.scheduledDate);
    
    // CRITICAL: Only include tasks with valid scheduled times (not midnight/00:00:00)
    // This ensures we only check conflicts with tasks that have actual scheduled times
    const hasValidTime = !isNaN(taskScheduledDate.getTime()) && 
      (taskScheduledDate.getHours() !== 0 || taskScheduledDate.getMinutes() !== 0);
    if (!hasValidTime) return false;
    
    // Normalize to start of day for comparison
    const taskDate = new Date(taskScheduledDate);
    taskDate.setHours(0, 0, 0, 0);
    
    // CRITICAL FIX: For conflict detection, we ALWAYS check if the scheduled date matches the target date
    // This works for both recurring and non-recurring tasks because:
    // - Non-recurring tasks: scheduledDate is the exact date they occur
    // - Recurring tasks in the plan: scheduledDate is set to a specific occurrence date (adjusted to target date)
    // - Existing recurring tasks: scheduledDate should be adjusted to target date before being passed here
    // 
    // The key insight: If a task has a scheduledDate that matches the target date, it applies to that date
    // regardless of whether it's recurring or not. Tasks passed to findNextAvailableSlot should already have
    // their scheduledDate adjusted to the target date if they're recurring.
    const scheduledDateMatches = taskDate.getTime() === targetDate.getTime();
    
    // If scheduled date matches, include it (this covers both recurring and non-recurring tasks with scheduled dates)
    if (scheduledDateMatches) {
      return true;
    }
    
    // CRITICAL: If scheduled date doesn't match but task is recurring, check if target date matches recurrence pattern
    // This is a fallback for cases where recurring tasks might not have been properly adjusted
    // However, this should be rare - tasks should be adjusted before being passed to findNextAvailableSlot
    if (task.recurrence && task.recurrence.type !== 'none') {
      const appliesToDate = isDateInRecurrence(task, targetDate);
      if (appliesToDate && import.meta.env.DEV) {
        console.warn('⚠️ Recurring task date mismatch in findNextAvailableSlot', {
          taskId: task.id,
          taskTitle: task.title,
          taskScheduledDate: taskScheduledDate.toISOString(),
          targetDate: targetDate.toISOString(),
          scheduledDateMatches: false,
          appliesToDate: true,
          note: 'Task should have been adjusted to target date before being passed here'
        });
      }
      return appliesToDate;
    }
    
    // Non-recurring task with different scheduled date - doesn't apply to target date
    return false;
  });
  
  if (import.meta.env.DEV && allTasks.length > 0) {
    console.debug('findNextAvailableSlot - dateTasks', {
      taskId,
      targetDate: targetDate.toISOString(),
      allTasksCount: allTasks.length,
      dateTasksCount: dateTasks.length,
    });
  }

  // Sort tasks by scheduled time in chronological order (earliest first)
  // IMPORTANT: Ensure we properly parse scheduledDate (could be ISO string or Date object)
  // CRITICAL: For recurring tasks that apply to targetDate but have scheduledDate on another day,
  // use target date with the same time so they block the correct slot on Today Agenda / Kanban.
  // CRITICAL: Filter out invalid dates to ensure proper sorting
  // CRITICAL: Use at least MIN_TASK_DURATION_MINUTES for each block so we never treat a scheduled task as zero-length (prevents overlaps)
  const sortedTasks = dateTasks
    .filter((task) => task.scheduledDate)
    .map((task) => {
      // Parse scheduledDate - handle both ISO strings and Date objects
      const scheduledDate = parseTaskScheduledDate(task.scheduledDate);

      // Validate date is not invalid
      if (isNaN(scheduledDate.getTime())) {
        return null;
      }

      // Use start on target date when task is recurring and scheduledDate is a different calendar day.
      // This ensures recurring tasks block the correct time on Today Agenda and Kanban week view.
      const taskDayStart = new Date(scheduledDate);
      taskDayStart.setHours(0, 0, 0, 0);
      const isRecurringOnOtherDay = (task.recurrence && task.recurrence.type !== 'none') &&
        taskDayStart.getTime() !== targetDate.getTime();
      const startDateForBlock = isRecurringOnOtherDay
        ? new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), scheduledDate.getHours(), scheduledDate.getMinutes(), scheduledDate.getSeconds(), scheduledDate.getMilliseconds())
        : scheduledDate;

      const start = startDateForBlock.getTime();
      const duration = getTaskSchedulingMinutes(task) * MILLISECONDS_PER_MINUTE;
      const end = start + duration;

      return { task, start, end };
    })
    .filter((item): item is { task: Task; start: number; end: number } => item !== null) // Remove null entries from invalid dates
    .sort((a, b) => {
      // Ensure chronological order: earliest time first (ascending)
      // If start times are equal, sort by end time to maintain consistent ordering
      if (a.start !== b.start) {
        return a.start - b.start;
      }
      return a.end - b.end;
    });
  
  // Add calendar events to the conflict list (minimum block duration so short events still block scheduling)
  const calendarConflicts: CalendarConflictBlock[] = options?.calendarEvents
    ? buildCalendarConflictBlocksForDay(options.calendarEvents, targetDate)
    : [];

  // Determine start time: ensure after current time if scheduling for today
  let candidateTime = new Date(requestedTime);
  const now = new Date();
  const isToday = isTargetDateToday(targetDate);
  const earliestStartMs = getSchedulingEarliestStartMs(requestedTime, targetDate, options);
  
  if (options?.ensureAfterCurrentTime && isToday) {
    candidateTime = new Date(earliestStartMs);
  }

  // Apply category hours constraint if provided
  if (options?.categoryHours) {
    const { start, end } = options.categoryHours;
    const candidateHour = candidateTime.getHours();
    const candidateMinute = candidateTime.getMinutes();
      const candidateTotalMinutes = candidateHour * MINUTES_PER_HOUR + candidateMinute;
    
    // For today, ensure we respect both current time AND category hours
    // The effective start is the later of: current time or category start
    let effectiveStart = start;
    if (isToday && options?.ensureAfterCurrentTime) {
      const currentTimeRounded = roundTimeUpToSchedulingSlot(now);
      const currentTotalMinutes =
        currentTimeRounded.getHours() * MINUTES_PER_HOUR + currentTimeRounded.getMinutes();
      effectiveStart = Math.max(start, currentTotalMinutes);
    }
    
    // If candidate is before effective start, move to effective start
    if (candidateTotalMinutes < effectiveStart) {
      candidateTime.setHours(Math.floor(effectiveStart / MINUTES_PER_HOUR), effectiveStart % MINUTES_PER_HOUR, 0, 0);
      // Round up to next interval slot
      const roundedMinutes = Math.ceil((effectiveStart % MINUTES_PER_HOUR) / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
      if (roundedMinutes >= MINUTES_PER_HOUR) {
        candidateTime.setHours(candidateTime.getHours() + 1);
        candidateTime.setMinutes(0);
      } else {
        candidateTime.setMinutes(roundedMinutes);
      }
    }
  }

  const maxHour = TASK_CALCULATION_CONSTANTS.timeConflict.maxHour;
  const maxMinute = TASK_CALCULATION_CONSTANTS.timeConflict.maxMinute;
  const prepBufferMs = getSchedulingPrepBufferMs(options);

  // Try to find a slot after the candidate time
  while (candidateTime.getHours() < maxHour || (candidateTime.getHours() === maxHour && candidateTime.getMinutes() <= maxMinute)) {
    const candidateStart = candidateTime.getTime();
    const candidateEnd = candidateStart + (taskDuration * MILLISECONDS_PER_MINUTE);

    // Check category hours constraint
    if (options?.categoryHours) {
      const candidateHour = candidateTime.getHours();
      const candidateMinute = candidateTime.getMinutes();
      const candidateTotalMinutes = candidateHour * MINUTES_PER_HOUR + candidateMinute;
      const taskEndMinutes = candidateTotalMinutes + taskDuration;
      
      if (candidateTotalMinutes < options.categoryHours.start || taskEndMinutes > options.categoryHours.end) {
        // Task doesn't fit in category hours, try to move to next available slot
        // Move to category start if before, or skip if after
        if (candidateTotalMinutes < options.categoryHours.start) {
          candidateTime.setHours(Math.floor(options.categoryHours.start / MINUTES_PER_HOUR), options.categoryHours.start % MINUTES_PER_HOUR, 0, 0);
          // Round to nearest interval slot
          const roundedMinutes = Math.ceil((options.categoryHours.start % MINUTES_PER_HOUR) / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
          if (roundedMinutes >= MINUTES_PER_HOUR) {
            candidateTime.setHours(candidateTime.getHours() + 1);
            candidateTime.setMinutes(0);
          } else {
            candidateTime.setMinutes(roundedMinutes);
          }
          continue; // Retry with new candidate time
        } else {
          // Task end exceeds category hours — only search gaps at or after the earliest allowed start.
          // Never fall back to an earlier gap (e.g. 8 PM) when current time is already past category hours.
          if (!taskFitsInCategoryHours(earliestStartMs, taskDuration, options.categoryHours)) {
            return buildNoSlotOnDayTime(requestedTime);
          }
          const gapSlot = tryFindGapBeforeObstacles(
            targetDate,
            earliestStartMs,
            taskDuration,
            buildSchedulingObstaclesForDay(
              targetDate,
              sortedTasks,
              calendarConflicts,
              prepBufferMs,
              taskId,
            ),
            options.categoryHours,
          );
          if (gapSlot) {
            return gapSlot;
          }
          return buildNoSlotOnDayTime(requestedTime);
        }
      }
    }

    // Check if this slot conflicts with any existing task or calendar event
    // IMPORTANT: Check ALL conflicts, not just the first one, to ensure we move past all overlapping tasks
    let hasConflict = false;
    let maxConflictEnd = candidateStart; // Track the latest end time of all conflicts
    
    // Check conflicts with tasks: same start or shared time (back-to-back when no prep buffer).
    for (const existing of sortedTasks) {
      const existingBlockEnd = expandTaskBlockEndForSchedulingPrep(existing.end, prepBufferMs);
      if (scheduleBlocksConflict(candidateStart, candidateEnd, existing.start, existingBlockEnd)) {
        hasConflict = true;
        maxConflictEnd = Math.max(maxConflictEnd, existingBlockEnd);
        if (import.meta.env.DEV) {
          console.debug('🔴 Conflict detected in findNextAvailableSlot', {
            candidateTime: new Date(candidateStart).toISOString(),
            candidateEnd: new Date(candidateEnd).toISOString(),
            existingTask: existing.task.id,
            existingTaskTitle: existing.task.title,
            existingStart: new Date(existing.start).toISOString(),
            existingEnd: new Date(existing.end).toISOString(),
            maxConflictEnd: new Date(maxConflictEnd).toISOString(),
          });
        }
      }
    }
    
    // Check conflicts with calendar events: same start or shared time (+ prep buffer when set).
    for (const event of calendarConflicts) {
      const expandedEvent = expandCalendarBlockForSchedulingPrep(event.start, event.end, prepBufferMs);
      if (scheduleBlocksConflict(candidateStart, candidateEnd, expandedEvent.start, expandedEvent.end)) {
        hasConflict = true;
        maxConflictEnd = Math.max(maxConflictEnd, expandedEvent.end);
        if (import.meta.env.DEV) {
          console.debug('🔴 Calendar event conflict detected in findNextAvailableSlot', {
            candidateTime: new Date(candidateStart).toISOString(),
            candidateEnd: new Date(candidateEnd).toISOString(),
            eventTitle: event.title,
            eventStart: new Date(event.start).toISOString(),
            eventEnd: new Date(event.end).toISOString(),
          });
        }
      }
    }
    
    // CRITICAL DEBUG: Log if no conflicts were found
    if (import.meta.env.DEV && !hasConflict && (sortedTasks.length > 0 || calendarConflicts.length > 0)) {
      console.debug('✅ No conflict found in findNextAvailableSlot', {
        candidateTime: new Date(candidateStart).toISOString(),
        candidateEnd: new Date(candidateEnd).toISOString(),
        sortedTasksCount: sortedTasks.length,
        sortedTasks: sortedTasks.map(t => ({
          id: t.task.id,
          title: t.task.title,
          start: new Date(t.start).toISOString(),
          end: new Date(t.end).toISOString(),
        })),
      });
    }

    if (!hasConflict) {
      // CRITICAL DEBUG: Log if no conflicts were found
      if (import.meta.env.DEV && sortedTasks.length > 0) {
        console.debug('✅ No conflict found in findNextAvailableSlot', {
          candidateTime: new Date(candidateStart).toISOString(),
          candidateEnd: new Date(candidateEnd).toISOString(),
          sortedTasksCount: sortedTasks.length,
          sortedTasks: sortedTasks.map(t => ({
            id: t.task.id,
            title: t.task.title,
            start: new Date(t.start).toISOString(),
            end: new Date(t.end).toISOString(),
          })),
        });
      }
      return candidateTime;
    }
    
    // Move candidate time to after ALL conflicting blocks (prep buffer already included when set).
    const postConflictGapMs = prepBufferMs > 0 ? 0 : MILLISECONDS_PER_MINUTE;
    candidateTime = new Date(maxConflictEnd + postConflictGapMs);
    // Round to nearest 15-minute slot (rounding up to ensure we're past the conflict)
    const minutes = candidateTime.getMinutes();
    const roundedMinutes = Math.ceil(minutes / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
    if (roundedMinutes >= MINUTES_PER_HOUR) {
      candidateTime.setHours(candidateTime.getHours() + 1);
      candidateTime.setMinutes(0);
    } else {
      candidateTime.setMinutes(roundedMinutes);
    }
    candidateTime.setSeconds(0);
    candidateTime.setMilliseconds(0);
  }

  // If no slot found, try gaps before obstacles or after the last calendar block.
  if (
    options?.categoryHours &&
    !taskFitsInCategoryHours(earliestStartMs, taskDuration, options.categoryHours)
  ) {
    return buildNoSlotOnDayTime(requestedTime);
  }

  const gapSlot = tryFindGapBeforeObstacles(
    targetDate,
    earliestStartMs,
    taskDuration,
    buildSchedulingObstaclesForDay(targetDate, sortedTasks, calendarConflicts, prepBufferMs, taskId),
    options?.categoryHours ?? null,
  );
  if (gapSlot) {
    return gapSlot;
  }

  const forcedAfter = findSlotAfterObstacles(
    targetDate,
    requestedTime,
    taskDuration,
    buildSchedulingObstaclesForDay(targetDate, sortedTasks, calendarConflicts, prepBufferMs, taskId),
    options,
  );
  if (forcedAfter) {
    return forcedAfter;
  }

  // If no slot found, return a time that indicates failure (24:00 or later)
  // This allows the caller to detect that no slot was found
  return buildNoSlotOnDayTime(requestedTime);
}

/**
 * Reorganize all tasks on a timeline to ensure chronological order and no overlaps
 * This function reorganizes all tasks for a given date to ensure they're in order
 * @param date - The date to reorganize tasks for
 * @param allTasks - All tasks to check against
 * @param options - Optional settings for time validation
 * @returns Array of tasks that need to be moved with their new times
 */
export function reorganizeAllTasksForDate(
  date: Date,
  allTasks: Task[],
  options?: FindSlotOptions
): Array<{ taskId: string; newTime: Date }> {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  // Get all tasks scheduled for the target date (excluding done tasks)
  const dateTasks = allTasks.filter((task) => {
    if (task.status === 'done') return false;
    return isDateInRecurrence(task, targetDate);
  });

  // Sort tasks by scheduled time in chronological order (earliest first)
  // IMPORTANT: Ensure we properly parse scheduledDate (could be ISO string or Date object)
  // CRITICAL: Use at least MIN_TASK_DURATION_MINUTES so we never treat a scheduled block as zero-length
  const sortedTasks = dateTasks
    .filter((task) => task.scheduledDate)
    .map((task) => {
      // Parse scheduledDate - handle both ISO strings and Date objects
      const scheduledDate = parseTaskScheduledDate(task.scheduledDate);
      
      // Validate date is not invalid
      if (isNaN(scheduledDate.getTime())) {
        return null;
      }
      
      const start = scheduledDate.getTime();
      const duration = getTaskSchedulingMinutes(task, { useCachedAIAnalysis: true }) * MILLISECONDS_PER_MINUTE;
      const end = start + duration;
      
      return { task, start, end };
    })
    .filter((item): item is { task: Task; start: number; end: number } => item !== null) // Remove null entries from invalid dates
    .sort((a, b) => {
      // Ensure chronological order: earliest time first (ascending)
      // If start times are equal, sort by end time to maintain consistent ordering
      if (a.start !== b.start) {
        return a.start - b.start;
      }
      return a.end - b.end;
    });

  const reorganizations: Array<{ taskId: string; newTime: Date }> = [];
  let lastScheduledEnd = 0;
  const prepBufferMs = getSchedulingPrepBufferMs(options);

  // Determine the earliest start time
  const now = new Date();
  const isToday = targetDate.getTime() === new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  
  if (options?.ensureAfterCurrentTime && isToday) {
    // Start from current time (rounded up to next 15-minute slot)
    const currentMinutes = now.getMinutes();
    const roundedMinutes = Math.ceil(currentMinutes / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
    const earliestTime = new Date(now);
    if (roundedMinutes >= MINUTES_PER_HOUR) {
      earliestTime.setHours(earliestTime.getHours() + 1);
      earliestTime.setMinutes(0);
    } else {
      earliestTime.setMinutes(roundedMinutes);
    }
    earliestTime.setSeconds(0);
    earliestTime.setMilliseconds(0);
    lastScheduledEnd = earliestTime.getTime();
  } else if (options?.categoryHours) {
    // Start from category start time
    const { start } = options.categoryHours;
    const categoryStart = new Date(targetDate);
    categoryStart.setHours(Math.floor(start / MINUTES_PER_HOUR), start % MINUTES_PER_HOUR, 0, 0);
    lastScheduledEnd = categoryStart.getTime();
  } else if (options?.onlyFixOverlaps) {
    // Only resolve overlaps; do not move tasks that are merely "before work start" or "before now"
    lastScheduledEnd = 0;
  } else {
    // Start from default work start time
    const defaultStart = new Date(targetDate);
    const [workStartHour] = DEFAULT_WEEKDAY_WORK_START.split(':').map(Number);
    defaultStart.setHours(workStartHour, 0, 0, 0);
    lastScheduledEnd = defaultStart.getTime();
  }

  // Reorganize: move a task if it violates prep buffer vs prior tasks or calendar events.
  let nextAllowedStartMs = lastScheduledEnd;
  const calendarBlocks = buildCalendarConflictBlocksForDay(
    options?.calendarEvents ?? [],
    targetDate,
  );
  let workingTasks = [...allTasks];

  for (const taskInfo of sortedTasks) {
    const task = taskInfo.task;
    const taskDurationMinutes = getTaskSchedulingMinutes(task, { useCachedAIAnalysis: true });
    const taskDuration = taskDurationMinutes * MILLISECONDS_PER_MINUTE;

    nextAllowedStartMs = advancePastCalendarPrepWindows(
      nextAllowedStartMs,
      calendarBlocks,
      prepBufferMs,
    );

    const conflictsPriorTask = taskInfo.start < nextAllowedStartMs;
    const conflictsCalendar = taskConflictsCalendarWithPrep(
      taskInfo.start,
      taskInfo.end,
      calendarBlocks,
      prepBufferMs,
    );

    const needsMove = conflictsPriorTask || conflictsCalendar;

    if (needsMove) {
      const candidateTime = roundTimeUpToSchedulingSlot(new Date(nextAllowedStartMs));

      const newTime = resolveSchedulingSlot(
        task.id,
        candidateTime,
        taskDurationMinutes,
        workingTasks,
        options,
      );

      if (newTime.getHours() < HOURS_PER_DAY) {
        reorganizations.push({
          taskId: task.id,
          newTime,
        });

        workingTasks = applyTaskTimeToList(workingTasks, task.id, newTime);
        lastScheduledEnd = newTime.getTime() + taskDuration;
        nextAllowedStartMs = expandTaskBlockEndForSchedulingPrep(lastScheduledEnd, prepBufferMs);
      } else {
        // No open slot today — push after the conflicting calendar block if possible.
        const forced = findSlotAfterObstacles(
          targetDate,
          new Date(taskInfo.start),
          taskDurationMinutes,
          buildSchedulingObstaclesForDay(targetDate, sortedTasks, calendarBlocks, prepBufferMs, task.id),
          options,
        );
        if (forced && forced.getHours() < HOURS_PER_DAY) {
          reorganizations.push({ taskId: task.id, newTime: forced });
          workingTasks = applyTaskTimeToList(workingTasks, task.id, forced);
          lastScheduledEnd = forced.getTime() + taskDuration;
          nextAllowedStartMs = expandTaskBlockEndForSchedulingPrep(lastScheduledEnd, prepBufferMs);
        } else {
          lastScheduledEnd = Math.max(lastScheduledEnd, taskInfo.end);
          nextAllowedStartMs = expandTaskBlockEndForSchedulingPrep(lastScheduledEnd, prepBufferMs);
        }
      }
    } else {
      lastScheduledEnd = Math.max(lastScheduledEnd, taskInfo.end);
      nextAllowedStartMs = expandTaskBlockEndForSchedulingPrep(lastScheduledEnd, prepBufferMs);
    }
  }

  return reorganizations;
}

function taskConflictsCalendarWithPrep(
  startMs: number,
  endMs: number,
  calendarBlocks: CalendarConflictBlock[],
  prepBufferMs: number,
): boolean {
  for (const block of calendarBlocks) {
    const expanded = expandCalendarBlockForSchedulingPrep(block.start, block.end, prepBufferMs);
    if (scheduleBlocksConflict(startMs, endMs, expanded.start, expanded.end)) {
      return true;
    }
  }
  return false;
}

function applyTaskTimeToList(allTasks: Task[], taskId: string, newTime: Date): Task[] {
  return allTasks.map((task) =>
    task.id === taskId ? { ...task, scheduledDate: newTime.toISOString() } : task,
  );
}

/**
 * Iteratively reorganize a day until prep-buffer rules are satisfied or no moves remain.
 */
export function enforcePrepBufferUntilStable(
  date: Date,
  allTasks: Task[],
  options?: FindSlotOptions,
  maxPasses: number = 5,
): Array<{ taskId: string; newTime: Date }> {
  const prepBufferMs = getSchedulingPrepBufferMs(options);
  if (prepBufferMs <= 0) {
    return reorganizeAllTasksForDate(date, allTasks, options);
  }

  const allMoves: Array<{ taskId: string; newTime: Date }> = [];
  let workingTasks = [...allTasks];

  for (let pass = 0; pass < maxPasses; pass++) {
    const passMoves = reorganizeAllTasksForDate(date, workingTasks, options);
    if (passMoves.length === 0) {
      break;
    }

    for (const move of passMoves) {
      allMoves.push(move);
      workingTasks = applyTaskTimeToList(workingTasks, move.taskId, move.newTime);
    }
  }

  return allMoves;
}

/**
 * Reorganize tasks when a new task is scheduled to avoid conflicts
 * Moves conflicting tasks to available slots
 * @param taskId - ID of the task being scheduled
 * @param scheduledTime - The scheduled time for the new task
 * @param taskDuration - Duration of the new task in minutes
 * @param allTasks - All tasks to check against
 * @param options - Optional settings for time validation
 * @returns Array of tasks that need to be moved with their new times
 */
export function reorganizeConflictingTasks(
  taskId: string,
  scheduledTime: Date,
  taskDuration: number,
  allTasks: Task[],
  options?: FindSlotOptions
): Array<{ taskId: string; newTime: Date }> {
  const targetDate = new Date(scheduledTime);
  targetDate.setHours(0, 0, 0, 0);

  // Get all tasks scheduled for the target date (excluding the current task)
  const dateTasks = allTasks.filter((task) => {
    if (task.id === taskId) return false;
    if (task.status === 'done') return false;
    return isDateInRecurrence(task, targetDate);
  });

  const newTaskStart = scheduledTime.getTime();
  const newTaskEnd = newTaskStart + (taskDuration * MILLISECONDS_PER_MINUTE);

  // Find all conflicting tasks
  const conflictingTasks: Array<{ task: Task; start: number; end: number }> = [];
  
  for (const task of dateTasks) {
    if (!task.scheduledDate) continue;
    
    // Parse scheduledDate - handle both ISO strings and Date objects
    const existingTaskScheduledDate = parseTaskScheduledDate(task.scheduledDate);
    
    const existingTaskStart = existingTaskScheduledDate.getTime();
    const existingTaskDuration = getTaskSchedulingMinutes(task, { useCachedAIAnalysis: true }) * MILLISECONDS_PER_MINUTE;
    const existingTaskEnd = existingTaskStart + existingTaskDuration;
    
    // Check for overlap
    if (newTaskStart < existingTaskEnd && newTaskEnd > existingTaskStart) {
      conflictingTasks.push({
        task,
        start: existingTaskStart,
        end: existingTaskEnd,
      });
    }
  }

  // Sort conflicting tasks by start time
  conflictingTasks.sort((a, b) => a.start - b.start);

  // Reorganize each conflicting task
  const reorganizations: Array<{ taskId: string; newTime: Date }> = [];
  let lastScheduledEnd = newTaskEnd;

  for (const conflicting of conflictingTasks) {
    // Find next available slot after the new task or after the last reorganized task
    const candidateTime = new Date(Math.max(lastScheduledEnd, newTaskEnd));
    
    // Round to nearest 15-minute slot
    const minutes = candidateTime.getMinutes();
    const roundedMinutes = Math.ceil(minutes / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
    if (roundedMinutes >= MINUTES_PER_HOUR) {
      candidateTime.setHours(candidateTime.getHours() + 1);
      candidateTime.setMinutes(0);
    } else {
      candidateTime.setMinutes(roundedMinutes);
    }
    candidateTime.setSeconds(0);
    candidateTime.setMilliseconds(0);

    // Find available slot for this conflicting task
    const newTime = findNextAvailableSlot(
      conflicting.task.id,
      candidateTime,
      getTaskMinutes(conflicting.task, { useCachedAIAnalysis: true }), // Use AI estimator
      allTasks,
      options
    );

    // Check if a valid slot was found
    if (newTime.getHours() < HOURS_PER_DAY) {
      reorganizations.push({
        taskId: conflicting.task.id,
        newTime,
      });
      
      // Update last scheduled end for next iteration
      const conflictingTaskDuration = getTaskMinutes(conflicting.task, { useCachedAIAnalysis: true }) * MILLISECONDS_PER_MINUTE; // Use AI estimator
      lastScheduledEnd = newTime.getTime() + conflictingTaskDuration;
    }
  }

  return reorganizations;
}

/**
 * Format time for display
 * @param date - Date to format
 * @returns Formatted time string (e.g., "2:30 PM")
 */
export function formatTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  const displayMinutes = minutes.toString().padStart(2, '0');
  return `${displayHours}:${displayMinutes} ${period}`;
}

