/**
 * One-time migration: align occurrence task ids with scheduledDate and dedupe by (baseId, date).
 * Run when tasks are loaded so existing repeat tasks are fixed.
 */

import type { Task } from '../types';
import { getSeriesBaseId, getOccurrenceDateString, getDateString } from './utils';
import { RECURRENCE_SERIES_OCCURRENCE_SEPARATOR, RECURRENCE_NONE_CONFIG } from './business-constants';
import { logger } from './logger';

export interface MigrateRecurringOccurrenceIdsResult {
  tasks: Task[];
  changes: { moved: string[]; deduped: string[] };
}

/**
 * 1. Move occurrence tasks whose id date does not match scheduledDate day (create baseId__newDate, drop old id).
 * 2. Dedupe: for each (baseId, date) keep one occurrence, remove the rest.
 */
export function migrateRecurringOccurrenceIds(tasks: Task[]): MigrateRecurringOccurrenceIdsResult {
  if (!Array.isArray(tasks)) {
    return { tasks: [], changes: { moved: [], deduped: [] } };
  }
  const toRemove = new Set<string>();
  const newTasks: Task[] = [];
  const moved: string[] = [];

  for (const task of tasks) {
    const baseId = getSeriesBaseId(task.id ?? '');
    if (baseId == null) continue;
    const dateFromId = getOccurrenceDateString(task.id ?? '');
    if (!dateFromId) continue;
    if (!task.scheduledDate) continue;
    const dateFromScheduled = getDateString(new Date(task.scheduledDate));
    if (dateFromId === dateFromScheduled) continue;

    const newId = `${baseId}${RECURRENCE_SERIES_OCCURRENCE_SEPARATOR}${dateFromScheduled}`;
    const newTask: Task = {
      ...task,
      id: newId,
      recurrence: RECURRENCE_NONE_CONFIG,
    } as Task;
    newTasks.push(newTask);
    toRemove.add(task.id!);
    moved.push(task.id!);
  }

  const effectiveTasks = tasks.filter((t) => !toRemove.has(t.id ?? '')).concat(newTasks);
  const deduped: string[] = [];
  const keyToOccurrences = new Map<string, Task[]>();

  for (const task of effectiveTasks) {
    const baseId = getSeriesBaseId(task.id ?? '');
    if (baseId == null) continue;
    const dateStr = getOccurrenceDateString(task.id ?? '') ?? task.id?.split(RECURRENCE_SERIES_OCCURRENCE_SEPARATOR)[1];
    if (!dateStr) continue;
    const key = `${baseId}\0${dateStr}`;
    const list = keyToOccurrences.get(key) ?? [];
    list.push(task);
    keyToOccurrences.set(key, list);
  }

  for (const list of keyToOccurrences.values()) {
    if (list.length <= 1) continue;
    list.sort((a, b) => {
      const aStrict = /^\d{4}-\d{2}-\d{2}$/.test((a.id ?? '').split(RECURRENCE_SERIES_OCCURRENCE_SEPARATOR)[1] ?? '') ? 1 : 0;
      const bStrict = /^\d{4}-\d{2}-\d{2}$/.test((b.id ?? '').split(RECURRENCE_SERIES_OCCURRENCE_SEPARATOR)[1] ?? '') ? 1 : 0;
      if (aStrict !== bStrict) return bStrict - aStrict;
      const aUp = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bUp = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bUp - aUp;
    });
    for (let i = 1; i < list.length; i++) {
      toRemove.add(list[i].id!);
      deduped.push(list[i].id!);
    }
  }

  const finalTasks = effectiveTasks.filter((t) => !toRemove.has(t.id ?? ''));
  if (moved.length > 0 || deduped.length > 0) {
    logger.info('Recurring occurrence ids migration', { moved: moved.length, deduped: deduped.length });
  }
  return { tasks: finalTasks, changes: { moved, deduped } };
}
