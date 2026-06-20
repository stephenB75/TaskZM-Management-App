/**
 * Archive panel — UI strings and layout tokens.
 */

import { MILLISECONDS_PER_DAY } from './business-constants';
import type { Task } from '../types';

export const ARCHIVE_UI_TEXT = {
  title: 'Archive',
  searchPlaceholder: 'Search completed tasks…',
  priorityAll: 'All Priorities',
  timeAll: 'All Time',
  emptyTitle: 'No completed tasks',
  emptyFiltered: 'No tasks match your filters. Try adjusting your search.',
  emptyDefault: 'Complete some tasks and they will appear here.',
  completedTask: 'completed task',
  completedTasks: 'completed tasks',
  selectAll: 'Select All',
  deselectAll: 'Deselect All',
  selectAllShort: 'Select All',
  deselectShort: 'Deselect',
  deleteSelected: 'Delete',
  deleteConfirmTitle: 'Delete Selected Tasks?',
  deleteConfirmDescription: (count: number) =>
    `Are you sure you want to delete ${count} task${count === 1 ? '' : 's'}? This action cannot be undone.`,
  cancel: 'Cancel',
  delete: 'Delete',
  restoreTask: 'Restore task',
  deleteTask: 'Delete permanently',
  sourceLabel: 'Archive',
  doneBadge: 'Done',
  groups: {
    today: 'Today',
    yesterday: 'Yesterday',
    noDate: 'No completion date',
  },
  completedRelative: {
    today: 'Completed today',
    yesterday: 'Completed yesterday',
    daysAgo: (days: number) => `Completed ${days} days ago`,
    weeksAgo: (weeks: number) => `Completed ${weeks} weeks ago`,
  },
} as const;

export const ARCHIVE_SECTION = {
  titleFontSizePx: 11,
  titleLetterSpacingEm: 0.06,
  headerGapPx: 6,
  sectionGapPx: 20,
  listGapPx: 10,
  actionButtonSizePx: 28,
} as const;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function formatArchiveRelativeCompleted(completedAt: string | null): string {
  if (!completedAt) return ARCHIVE_UI_TEXT.groups.noDate;
  const date = new Date(completedAt);
  const now = new Date();
  const diffInDays = Math.floor(
    (now.getTime() - date.getTime()) / MILLISECONDS_PER_DAY,
  );

  if (diffInDays === 0) return ARCHIVE_UI_TEXT.completedRelative.today;
  if (diffInDays === 1) return ARCHIVE_UI_TEXT.completedRelative.yesterday;
  if (diffInDays < 7) return ARCHIVE_UI_TEXT.completedRelative.daysAgo(diffInDays);
  if (diffInDays < 30) {
    return ARCHIVE_UI_TEXT.completedRelative.weeksAgo(Math.floor(diffInDays / 7));
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function getArchiveGroupKey(completedAt: string | null): string {
  if (!completedAt) return 'no-date';
  const date = startOfDay(new Date(completedAt));
  return date.toISOString().slice(0, 10);
}

export function formatArchiveGroupLabel(groupKey: string): string {
  if (groupKey === 'no-date') return ARCHIVE_UI_TEXT.groups.noDate;

  const [year, month, day] = groupKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const now = new Date();
  const today = startOfDay(now);
  const target = startOfDay(date);
  const diffDays = Math.floor((today.getTime() - target.getTime()) / MILLISECONDS_PER_DAY);

  if (diffDays === 0) return ARCHIVE_UI_TEXT.groups.today;
  if (diffDays === 1) return ARCHIVE_UI_TEXT.groups.yesterday;
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  }
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

export interface ArchiveTaskGroup {
  key: string;
  label: string;
  tasks: Task[];
}

export function groupArchivedTasksByDate(tasks: Task[]): ArchiveTaskGroup[] {
  const groups = new Map<string, Task[]>();

  for (const task of tasks) {
    const key = getArchiveGroupKey(task.completedAt);
    const existing = groups.get(key);
    if (existing) {
      existing.push(task);
    } else {
      groups.set(key, [task]);
    }
  }

  const sortedKeys = [...groups.keys()].sort((a, b) => {
    if (a === 'no-date') return 1;
    if (b === 'no-date') return -1;
    return b.localeCompare(a);
  });

  return sortedKeys.map((key) => ({
    key,
    label: formatArchiveGroupLabel(key),
    tasks: groups.get(key) ?? [],
  }));
}
