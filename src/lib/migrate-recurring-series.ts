/**
 * Migrate existing recurring series (occurrence-only, no base task) to the new model
 * by creating a base task that stores the recurrence pattern.
 * Safe to run multiple times: only creates a base when one does not exist.
 */

import type { Task, RecurrenceConfig } from '../types';
import { getSeriesBaseId } from './utils';
import { RECURRENCE_SERIES_OCCURRENCE_SEPARATOR, RECURRENCE_NONE_CONFIG, DEFAULT_PROJECT_ID, DATE_ONLY_PARSE_SUFFIX } from './business-constants';
import { TIMING_CONSTANTS } from './timing-constants';
import { logger } from './logger';

const SERIES_OCCURRENCE_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function parseDateFromOccurrenceId(taskId: string): string | null {
  const baseId = getSeriesBaseId(taskId);
  if (!baseId) return null;
  const parts = taskId.split(RECURRENCE_SERIES_OCCURRENCE_SEPARATOR);
  if (parts.length !== 2) return null;
  const datePart = parts[1];
  if (!SERIES_OCCURRENCE_DATE_REGEX.test(datePart)) return null;
  return datePart;
}

/**
 * Infer recurrence config from a sorted list of occurrence date strings (YYYY-MM-DD).
 */
function inferRecurrenceFromDates(dateStrings: string[]): RecurrenceConfig {
  if (dateStrings.length === 0) return RECURRENCE_NONE_CONFIG;
  if (dateStrings.length === 1) {
    return {
      type: 'daily',
      interval: 1,
      endDate: dateStrings[0],
    };
  }
  const dates = dateStrings
    .map((s) => {
      const [y, m, d] = s.split('-').map(Number);
      return new Date(y, m - 1, d);
    })
    .filter((d) => !isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (dates.length < 2) return { type: 'daily', interval: 1, endDate: dateStrings[0] };

  const daysToMs = TIMING_CONSTANTS.timeConversions.daysToMs;
  const gaps: number[] = [];
  for (let i = 1; i < dates.length; i++) {
    gaps.push(Math.round((dates[i].getTime() - dates[i - 1].getTime()) / daysToMs));
  }
  const allSame = gaps.every((g) => g === gaps[0]);
  const gap = gaps[0];

  if (allSame && gap === 1) {
    return {
      type: 'daily',
      interval: 1,
      endDate: dateStrings[dateStrings.length - 1],
    };
  }
  if (allSame && gap === 7) {
    return {
      type: 'weekly',
      interval: 1,
      daysOfWeek: [dates[0].getDay()],
      endDate: dateStrings[dateStrings.length - 1],
    };
  }
  if (allSame && gap >= 7 && gap % 7 === 0) {
    return {
      type: 'weekly',
      interval: gap / 7,
      daysOfWeek: [dates[0].getDay()],
      endDate: dateStrings[dateStrings.length - 1],
    };
  }
  const sameDayOfMonth = dates.every((d) => d.getDate() === dates[0].getDate());
  if (sameDayOfMonth) {
    return {
      type: 'monthly',
      interval: 1,
      dayOfMonth: dates[0].getDate(),
      endDate: dateStrings[dateStrings.length - 1],
    };
  }
  return {
    type: 'weekly',
    interval: 1,
    daysOfWeek: [dates[0].getDay()],
    endDate: dateStrings[dateStrings.length - 1],
  };
}

export interface MigrateRecurringSeriesResult {
  tasks: Task[];
  newBases: Task[];
}

/**
 * Find series that have occurrence tasks (baseId__date) but no base task,
 * create a base task for each, and return the combined task list plus the new base tasks.
 * Idempotent: does not create a base if one already exists.
 */
export function migrateOrphanRecurringSeries(tasks: Task[]): MigrateRecurringSeriesResult {
  const taskIds = new Set(tasks.map((t) => t.id));
  const byBaseId = new Map<string, Task[]>();

  for (const task of tasks) {
    const baseId = getSeriesBaseId(task.id);
    if (!baseId) continue;
    if (!taskIds.has(baseId)) {
      if (!byBaseId.has(baseId)) byBaseId.set(baseId, []);
      byBaseId.get(baseId)!.push(task);
    }
  }

  const newBases: Task[] = [];
  for (const [baseId, occurrenceTasks] of byBaseId) {
    if (occurrenceTasks.length === 0) continue;
    const dateStrings = occurrenceTasks
      .map((t) => parseDateFromOccurrenceId(t.id))
      .filter((s): s is string => s != null)
      .sort();
    if (dateStrings.length === 0) continue;

    const recurrence = inferRecurrenceFromDates(dateStrings);
    const sortedByDate = [...occurrenceTasks].sort((a, b) => {
      const da = parseDateFromOccurrenceId(a.id);
      const db = parseDateFromOccurrenceId(b.id);
      if (!da || !db) return 0;
      return da.localeCompare(db);
    });
    const first = sortedByDate[0];
    const firstDateStr = parseDateFromOccurrenceId(first.id);
    const scheduledDate = first.scheduledDate ?? (firstDateStr ? `${firstDateStr}${DATE_ONLY_PARSE_SUFFIX}` : new Date().toISOString());

    const nowIso = new Date().toISOString();
    const baseTask: Task = {
      id: baseId,
      title: first.title ?? '',
      description: first.description ?? '',
      status: first.status ?? 'todo',
      priority: first.priority ?? 'medium',
      dueDate: first.dueDate ?? null,
      scheduledDate: typeof scheduledDate === 'string' ? scheduledDate : scheduledDate.toISOString(),
      projectId: first.projectId ?? DEFAULT_PROJECT_ID,
      tags: first.tags ?? [],
      assignedTo: first.assignedTo ?? [],
      createdBy: first.createdBy ?? 'local',
      createdAt: first.createdAt ?? nowIso,
      updatedAt: nowIso,
      completedAt: null,
      estimatedTime: first.estimatedTime ?? null,
      actualTime: null,
      dependencies: first.dependencies ?? [],
      subtasks: first.subtasks ?? [],
      recurrence: { ...recurrence },
      notes: first.notes ?? '',
      folderId: first.folderId ?? null,
    } as Task;
    newBases.push(baseTask);
    logger.info('Recurring series migration: created base task for orphan series', {
      baseId,
      occurrenceCount: occurrenceTasks.length,
      inferredType: recurrence.type,
    });
  }

  if (newBases.length === 0) return { tasks, newBases };
  return {
    tasks: [...tasks, ...newBases],
    newBases,
  };
}
