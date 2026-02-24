import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { logger } from './logger';
import type { Task, TaskPriority, TaskStatus, RecurrenceConfig } from '../types';
import { MILLISECONDS_PER_MINUTE, MILLISECONDS_PER_HOUR, MILLISECONDS_PER_DAY, MINUTES_PER_HOUR, HOURS_PER_DAY, DAYS_IN_WEEK, PERCENTAGE_MULTIPLIER, SECONDS_PER_MINUTE, SECONDS_PER_HOUR, RECURRENCE_OCCURRENCE_ID_SUFFIX_SUBTASKS, RECURRENCE_OCCURRENCE_ID_SUFFIX_COMPLETED, RECURRENCE_NONE_CONFIG, RECURRENCE_SERIES_OCCURRENCE_SEPARATOR } from './business-constants';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Date utilities
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'No date';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function formatTimeAMPM(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** Returns time part (e.g. "11:00") and period ("AM" | "PM") for styling AM/PM separately. */
export function getTimeAndPeriod(dateStr: string | null): { timePart: string; period: 'AM' | 'PM' } | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return null;
  const hours = date.getHours();
  const period: 'AM' | 'PM' = hours < 12 ? 'AM' : 'PM';
  const hour12 = hours % 12 || 12;
  const minutes = date.getMinutes();
  const timePart = `${hour12}:${minutes.toString().padStart(2, '0')}`;
  return { timePart, period };
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / MILLISECONDS_PER_MINUTE);
  const diffHours = Math.floor(diffMs / MILLISECONDS_PER_HOUR);
  const diffDays = Math.floor(diffMs / MILLISECONDS_PER_DAY);

  if (diffMins < 1) return 'Just now';
  if (diffMins < MINUTES_PER_HOUR) return `${diffMins}m ago`;
  if (diffHours < HOURS_PER_DAY) return `${diffHours}h ago`;
  if (diffDays < DAYS_IN_WEEK) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

export function getWeekDates(startDate?: Date): Date[] {
  const start = startDate || new Date();
  const dates: Date[] = [];
  
  for (let i = 0; i < DAYS_IN_WEEK; i++) {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    dates.push(date);
  }
  
  return dates;
}

export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Get date string in YYYY-MM-DD format using LOCAL timezone
 * This ensures tasks are assigned to the correct day based on user's local time,
 * not UTC (which can cause tasks to appear on wrong day in some timezones)
 */
export function getDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse calendar event start/end string to a Date for correct local-time display and sorting.
 * - Date-only (YYYY-MM-DD): local midnight.
 * - ISO with Z or offset: parsed as-is (correct UTC/local).
 * - ISO datetime without Z or offset: treated as UTC so kanban/week view shows correct local time.
 */
export function parseCalendarEventTime(isoString: string): Date {
  const s = (isoString || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
      return new Date(y, m - 1, d);
    }
  }
  // Full ISO without timezone is often UTC from APIs; appending Z ensures correct local conversion
  if (/^\d{4}-\d{2}-\d{2}T\d/.test(s) && !/Z|[-+]\d{2}:?\d{2}$/.test(s)) {
    return new Date(s.endsWith('Z') ? s : s + 'Z');
  }
  return new Date(s);
}

/**
 * Parse YYYY-MM-DD string as local midnight (not UTC).
 * Use this when comparing to "today" or column dates so tasks appear on the correct day in all timezones.
 */
export function dateStringToLocalDate(dateString: string): Date {
  const s = (dateString || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
      return new Date(y, m - 1, d);
    }
  }
  const fallback = new Date(dateString);
  return new Date(fallback.getFullYear(), fallback.getMonth(), fallback.getDate());
}

/**
 * Calculate total tracked time across all occurrences in a recurring task series
 * Includes both completed occurrences and active occurrences
 * @param baseTaskId - The base recurring task ID (without date suffix)
 * @param allTasks - All tasks to search through
 * @returns Total minutes tracked across all occurrences
 */
export function calculateRecurringTaskSeriesTotalTime(baseTaskId: string, allTasks: Array<{ id: string; actualTime?: number | null }>): number {
  // Find all tasks that belong to this recurring series:
  // 1. Base task (may hold time for legacy or first occurrence)
  // 2. Per-occurrence records: baseId + _subtasks_ + date (subtasks + actualTime per occurrence)
  // 3. Legacy active occurrences: baseId__date (kanban/today)
  // 4. Completed occurrences: baseId + _completed_ + date
  const seriesTasks = allTasks.filter(t => {
    if (t.id === baseTaskId) return true;
    if (t.id.startsWith(`${baseTaskId}${RECURRENCE_OCCURRENCE_ID_SUFFIX_SUBTASKS}`)) return true;
    if (t.id.startsWith(`${baseTaskId}${RECURRENCE_SERIES_OCCURRENCE_SEPARATOR}`)) return true;
    if (t.id.startsWith(`${baseTaskId}${RECURRENCE_OCCURRENCE_ID_SUFFIX_COMPLETED}`)) return true;
    return false;
  });
  
  // Sum up all actualTime values
  return seriesTasks.reduce((total, task) => {
    const time = task.actualTime || 0;
    return total + time;
  }, 0);
}

const SERIES_OCCURRENCE_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * If taskId is a series occurrence id (baseId__YYYY-MM-DD), return the baseId; otherwise null.
 * Used to find all tasks in a series and for "Edit series" / series time total.
 */
export function getSeriesBaseId(taskId: string): string | null {
  if (!taskId || !taskId.includes(RECURRENCE_SERIES_OCCURRENCE_SEPARATOR)) return null;
  const parts = taskId.split(RECURRENCE_SERIES_OCCURRENCE_SEPARATOR);
  if (parts.length !== 2) return null;
  const datePart = parts[1];
  if (!SERIES_OCCURRENCE_DATE_REGEX.test(datePart)) return null;
  return parts[0] || null;
}

/**
 * True when the task is a recurring series "base" (holds recurrence pattern, not an occurrence).
 * Such a task has recurrence.type !== 'none' and an id that does not contain the series occurrence separator.
 */
export function isSeriesBaseTask(task: { id?: string; recurrence?: { type?: string } }): boolean {
  if (!task?.id || !task.recurrence || task.recurrence.type === 'none') return false;
  return !task.id.includes(RECURRENCE_SERIES_OCCURRENCE_SEPARATOR);
}

/**
 * Normalize an occurrence id suffix (date part after __) to YYYY-MM-DD for comparison.
 * Handles both "YYYY-MM-DD" and ISO datetime "YYYY-MM-DDTHH:mm:ss..." from APIs.
 */
function occurrenceSuffixToDateString(suffix: string): string | null {
  const trimmed = (suffix || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return getDateString(d);
}

/**
 * For a series occurrence task id (baseId__suffix), return the normalized YYYY-MM-DD.
 * Returns null if taskId is not a series occurrence id. Handles API-style suffixes (ISO datetime).
 */
export function getOccurrenceDateString(taskId: string): string | null {
  if (!taskId || !taskId.includes(RECURRENCE_SERIES_OCCURRENCE_SEPARATOR)) return null;
  const parts = taskId.split(RECURRENCE_SERIES_OCCURRENCE_SEPARATOR);
  if (parts.length !== 2) return null;
  return occurrenceSuffixToDateString(parts[1]);
}

/**
 * Series key for dedupe: (baseId, dateStr). Null for non-series tasks.
 * Used so we show at most one task per (baseId, date) per day.
 */
export function getSeriesKeyForTask(
  task: { id?: string; recurrence?: { type?: string } },
  dateString: string
): { baseId: string; dateStr: string } | null {
  if (!task?.id) return null;
  const baseId = getSeriesBaseId(task.id);
  if (baseId !== null) {
    const dateStr = getOccurrenceDateString(task.id);
    if (dateStr) return { baseId, dateStr };
    const fallback = task.id.split(RECURRENCE_SERIES_OCCURRENCE_SEPARATOR)[1];
    if (fallback) {
      const normalized = occurrenceSuffixToDateString(fallback);
      if (normalized) return { baseId, dateStr: normalized };
    }
    return { baseId, dateStr: dateString };
  }
  if (isSeriesBaseTask(task)) return { baseId: task.id, dateStr: dateString };
  return null;
}

/**
 * Dedupe tasks so at most one task per (baseId, date) is shown. Prefer occurrence over base; then by updatedAt desc.
 * Call with the already-filtered list for the day (dateString is that day).
 */
export function dedupeTasksForDay(tasks: Task[], dateString: string): Task[] {
  const keyToTasks = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = getSeriesKeyForTask(task, dateString);
    if (!key) {
      const id = task.id ?? `no-id-${Math.random()}`;
      keyToTasks.set(id, [task]);
      continue;
    }
    const groupKey = `${key.baseId}\0${key.dateStr}`;
    const list = keyToTasks.get(groupKey) ?? [];
    list.push(task);
    keyToTasks.set(groupKey, list);
  }
  const result: Task[] = [];
  for (const list of keyToTasks.values()) {
    if (list.length === 1) {
      result.push(list[0]);
      continue;
    }
    list.sort((a, b) => {
      const aOcc = getSeriesBaseId(a.id ?? '') != null ? 1 : 0;
      const bOcc = getSeriesBaseId(b.id ?? '') != null ? 1 : 0;
      if (aOcc !== bOcc) return bOcc - aOcc;
      const aUp = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bUp = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bUp - aUp;
    });
    result.push(list[0]);
  }
  return result;
}

/**
 * True when there is a series occurrence task (baseId__dateStr) for the given date.
 * Used so day views show the occurrence and hide the base to avoid duplicates.
 * Matches exact id (baseId__YYYY-MM-DD) and also occurrence ids whose date part
 * normalizes to dateString (e.g. from API as baseId__YYYY-MM-DDTHH:mm:ssZ).
 */
export function hasSeriesOccurrenceForDate(
  tasks: Array<{ id: string }>,
  baseId: string,
  dateString: string
): boolean {
  const prefix = `${baseId}${RECURRENCE_SERIES_OCCURRENCE_SEPARATOR}`;
  return tasks.some((t) => {
    if (!t.id || !t.id.startsWith(prefix)) return false;
    const suffix = t.id.slice(prefix.length);
    const normalized = occurrenceSuffixToDateString(suffix);
    return normalized === dateString;
  });
}

export function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const due = new Date(dueDate);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return due < now;
}

// Task utilities
export function getPriorityColor(priority: TaskPriority): string {
  const colors = {
    low: 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-muted dark:border-border',
    medium: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-800',
    high: 'text-orange-600 bg-orange-50 border-orange-200 dark:text-orange-400 dark:bg-orange-950/30 dark:border-orange-800',
    urgent: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/30 dark:border-red-800',
  };
  return colors[priority];
}

export function getStatusColor(status: TaskStatus): string {
  const colors = {
    'todo': 'text-gray-600 bg-gray-50 border-gray-200 dark:text-gray-400 dark:bg-muted dark:border-border',
    'in-progress': 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-800',
    'done': 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/30 dark:border-green-800',
    'on-hold': 'text-yellow-600 bg-yellow-50 border-yellow-200 dark:text-yellow-400 dark:bg-yellow-950/30 dark:border-yellow-800',
  };
  return colors[status];
}

export function calculateProgress(task: Task): number {
  if (!task.subtasks || task.subtasks.length === 0) {
    return task.status === 'done' ? PERCENTAGE_MULTIPLIER : 0;
  }
  
  const completed = task.subtasks.filter(st => st.completed).length;
  return Math.round((completed / task.subtasks.length) * PERCENTAGE_MULTIPLIER);
}

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Time utilities
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const secs = seconds % SECONDS_PER_MINUTE;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${secs}s`;
}

export function parseDuration(durationStr: string): number {
  const hoursMatch = durationStr.match(/(\d+)h/);
  const minutesMatch = durationStr.match(/(\d+)m/);
  const secondsMatch = durationStr.match(/(\d+)s/);

  const hours = hoursMatch ? parseInt(hoursMatch[1]) : 0;
  const minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0;
  const seconds = secondsMatch ? parseInt(secondsMatch[1]) : 0;

  return hours * SECONDS_PER_HOUR + minutes * SECONDS_PER_MINUTE + seconds;
}

// Filter and search utilities
export function filterTasks(tasks: Task[], filters: {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  projects?: string[];
  searchQuery?: string;
}): Task[] {
  return tasks.filter(task => {
    if (filters.status && !filters.status.includes(task.status)) {
      return false;
    }
    
    if (filters.priority && !filters.priority.includes(task.priority)) {
      return false;
    }
    
    if (filters.projects && !filters.projects.includes(task.projectId)) {
      return false;
    }
    
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      return (
        (task.title?.toLowerCase().includes(query) || false) ||
        (task.description?.toLowerCase().includes(query) || false) ||
        (task.tags && task.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }
    
    return true;
  });
}

export function sortTasks(tasks: Task[], sortBy: 'dueDate' | 'priority' | 'createdAt' | 'title', order: 'asc' | 'desc' = 'asc'): Task[] {
  const sorted = [...tasks].sort((a, b) => {
    let comparison = 0;
    
    switch (sortBy) {
      case 'dueDate':
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        comparison = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        break;
      case 'priority':
        const priorityOrder = { urgent: 4, high: 3, medium: 2, low: 1 };
        comparison = priorityOrder[b.priority] - priorityOrder[a.priority];
        break;
      case 'createdAt':
        comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        break;
      case 'title':
        comparison = a.title.localeCompare(b.title);
        break;
    }
    
    return order === 'asc' ? comparison : -comparison;
  });
  
  return sorted;
}

// Export utilities
export function exportToCSV(tasks: Task[]): string {
  const headers = ['Title', 'Description', 'Status', 'Priority', 'Due Date', 'Project', 'Tags'];
  const rows = tasks.map(task => [
    task.title,
    task.description,
    task.status,
    task.priority,
    task.dueDate || '',
    task.projectId,
    (task.tags || []).join('; ')
  ]);
  
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
  
  return csv;
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Local storage utilities
// Get the current user ID from localStorage (set on signin/signup)
function getCurrentUserId(): string | null {
  try {
    return localStorage.getItem('taskzm_current_user_id');
  } catch {
    return null;
  }
}

// Set the current user ID in localStorage
function setCurrentUserId(userId: string): void {
  try {
    localStorage.setItem('taskzm_current_user_id', userId);
  } catch (error) {
    logger.error('Failed to set current user ID:', error);
  }
}

// Clear all user data from localStorage
export function clearUserLocalStorage(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (
        key === 'tasks' ||
        key === 'projects' ||
        key === 'folders' ||
        key === 'availableTags' ||
        key === 'hoursSettings' ||
        key === 'rolloverSettings' ||
        key === 'ai-settings' ||
        key.startsWith('taskzm_') ||
        key.startsWith('subscription_') ||
        key.startsWith('calendar_') ||
        key.startsWith('last_sync_timestamp_') ||
        key.startsWith('last_etag_')
      )) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        logger.warn(`Failed to remove localStorage key: ${key}`, e);
      }
    });
    logger.debug(`Cleared ${keysToRemove.length} localStorage keys`);
  } catch (error) {
    logger.error('Error clearing localStorage:', error);
  }
}

/**
 * Get week start setting from localStorage
 * @returns 'sunday' | 'monday' - defaults to 'sunday'
 */
export function getWeekStart(): 'sunday' | 'monday' {
  const stored = localStorage.getItem('week-start');
  return (stored === 'sunday' || stored === 'monday') ? stored : 'sunday';
}

export function getFromLocalStorage<T>(key: string, defaultValue: T, userId?: string | null): T {
  try {
    // If userId is provided, check if it matches the stored user
    if (userId) {
      const storedUserId = getCurrentUserId();
      if (storedUserId && storedUserId !== userId) {
        // Different user - don't return old data
        logger.debug(`User mismatch: stored=${storedUserId}, current=${userId}, skipping localStorage for key: ${key}`);
        return defaultValue;
      }
    }
    
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function saveToLocalStorage<T>(key: string, value: T, userId?: string | null): void {
  try {
    // If userId is provided, store it to track which user's data this is
    if (userId) {
      setCurrentUserId(userId);
    }
    
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    logger.error('Failed to save to localStorage:', error);
  }
}

// Task dependency utilities
export function isTaskBlocked(task: Task, allTasks: Task[]): boolean {
  if (!task.dependencies || task.dependencies.length === 0) return false;
  
  return task.dependencies.some(depId => {
    const depTask = allTasks.find(t => t.id === depId);
    return depTask && depTask.status !== 'done';
  });
}

export function getIncompleteDependencies(task: Task, allTasks: Task[]): Task[] {
  if (!task.dependencies) return [];
  return task.dependencies
    .map(depId => allTasks.find(t => t.id === depId))
    .filter(t => t && t.status !== 'done') as Task[];
}

export function getCompleteDependencies(task: Task, allTasks: Task[]): Task[] {
  if (!task.dependencies) return [];
  return task.dependencies
    .map(depId => allTasks.find(t => t.id === depId))
    .filter(t => t && t.status === 'done') as Task[];
}

export function getDependentTasks(taskId: string, allTasks: Task[]): Task[] {
  return allTasks.filter(t => t.dependencies && t.dependencies.includes(taskId));
}

export function hasCircularDependency(
  taskId: string,
  newDepId: string,
  allTasks: Task[]
): boolean {
  const visited = new Set<string>();
  
  function checkCycle(currentId: string): boolean {
    if (currentId === taskId) return true;
    if (visited.has(currentId)) return false;
    
    visited.add(currentId);
    const currentTask = allTasks.find(t => t.id === currentId);
    
    return currentTask?.dependencies?.some(depId => checkCycle(depId)) || false;
  }
  
  return checkCycle(newDepId);
}

export function validateDependencies(
  task: Task,
  newDeps: string[],
  allTasks: Task[]
): { valid: boolean; error?: string } {
  // Check for self-dependency
  if (newDeps.includes(task.id)) {
    return { valid: false, error: 'A task cannot depend on itself' };
  }
  
  // Check for circular dependencies
  for (const depId of newDeps) {
    if (hasCircularDependency(task.id, depId, allTasks)) {
      return { valid: false, error: 'Circular dependency detected' };
    }
  }
  
  return { valid: true };
}

export function calculateDependencyDepth(task: Task, allTasks: Task[]): number {
  if (!task.dependencies || task.dependencies.length === 0) return 0;
  
  const visited = new Set<string>();
  
  function getDepth(currentTask: Task): number {
    if (visited.has(currentTask.id)) return 0;
    visited.add(currentTask.id);
    
    if (!currentTask.dependencies || currentTask.dependencies.length === 0) return 0;
    
    const depthsArray = currentTask.dependencies.map(depId => {
      const depTask = allTasks.find(t => t.id === depId);
      return depTask ? getDepth(depTask) : 0;
    });
    
    return Math.max(...depthsArray) + 1;
  }
  
  return getDepth(task);
}

// Safe initials extraction
export function getInitials(name: string | undefined | null): string {
  if (!name || typeof name !== 'string') return '??';
  
  const parts = name.trim().split(/\s+/).filter(p => p.length > 0);
  
  if (parts.length === 0) return '??';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  
  return parts
    .slice(0, 2)
    .map(p => p.charAt(0))
    .join('')
    .toUpperCase();
}

/**
 * Abbreviate name for display on user/assignee cards: "FirstName L." (first name + first letter of last name + dot).
 * Single-word names are returned as-is (trimmed).
 */
export function getAbbreviatedDisplayName(name: string | undefined | null): string {
  if (!name || typeof name !== 'string') return '';
  const parts = name.trim().split(/\s+/).filter(p => p.length > 0);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first} ${lastInitial}.`;
}

// Safe first name extraction
// Sanitize HTML to prevent XSS attacks while preserving formatting
/**
 * Check if a string contains HTML tags
 */
export function hasHTMLTags(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  // Check for HTML tags (simple regex check)
  const htmlTagPattern = /<[^>]+>/;
  return htmlTagPattern.test(text);
}

export function sanitizeHTML(html: string): string {
  if (!html || typeof window === 'undefined') return html || '';
  
  // If it's not HTML, return as-is
  if (!hasHTMLTags(html)) {
    return html;
  }
  
  try {
    // Create a temporary div to parse HTML
    const div = document.createElement('div');
    div.innerHTML = html;
    
    // Allow only safe formatting tags
    const allowedTags = ['b', 'strong', 'i', 'em', 'u', 's', 'strike', 'mark', 'ul', 'ol', 'li', 'p', 'br', 'span', 'code'];
    const allowedAttributes = ['style', 'class'];
    
    // Remove all non-allowed tags
    const walker = document.createTreeWalker(
      div,
      NodeFilter.SHOW_ELEMENT,
      null
    );
    
    const nodesToRemove: Node[] = [];
    let node;
    
    while (node = walker.nextNode()) {
      const element = node as HTMLElement;
      if (!allowedTags.includes(element.tagName.toLowerCase())) {
        nodesToRemove.push(node);
      } else {
        // Remove non-allowed attributes
        Array.from(element.attributes).forEach(attr => {
          if (!allowedAttributes.includes(attr.name.toLowerCase())) {
            element.removeAttribute(attr.name);
          }
        });
        
        // Sanitize style attribute to only allow safe CSS properties
        if (element.hasAttribute('style')) {
          const style = element.getAttribute('style') || '';
          // Allow background-color, font-size, and other safe properties
          const sanitizedStyle = style
            .split(';')
            .filter(prop => {
              const trimmed = prop.trim().toLowerCase();
              return trimmed.startsWith('background-color:') || 
                     trimmed.startsWith('background:') ||
                     trimmed.startsWith('font-size:') ||
                     trimmed.startsWith('color:');
            })
            .join(';');
          if (sanitizedStyle) {
            element.setAttribute('style', sanitizedStyle);
          } else {
            element.removeAttribute('style');
          }
        }
      }
    }
    
    nodesToRemove.forEach(node => {
      const parent = node.parentNode;
      if (parent) {
        while (node.firstChild) {
          parent.insertBefore(node.firstChild, node);
        }
        parent.removeChild(node);
      }
    });
    
    return div.innerHTML;
  } catch (error) {
    // If sanitization fails, return plain text
    logger.warn('HTML sanitization failed, returning plain text:', error);
    return html.replace(/<[^>]*>/g, ''); // Strip all HTML tags
  }
}

export function getFirstName(name: string | undefined | null): string {
  if (!name || typeof name !== 'string') return 'Unknown';
  
  const parts = name.trim().split(/\s+/).filter(p => p.length > 0);
  
  return parts.length > 0 ? parts[0] : 'Unknown';
}

/**
 * For recurring tasks, return the task with subtasks merged from the occurrence-specific record if it exists.
 * This ensures "2/5 subtasks" on cards reflects only that day's progress, not the whole series.
 */
export function getTaskWithOccurrenceSubtasks(
  task: Task,
  occurrenceDateStr: string | undefined,
  allTasks: Task[]
): Task {
  if (!task?.id || !occurrenceDateStr || !(task.recurrence?.type && task.recurrence.type !== 'none')) {
    return task;
  }
  const occurrenceSubtaskId = `${task.id}${RECURRENCE_OCCURRENCE_ID_SUFFIX_SUBTASKS}${occurrenceDateStr}`;
  const occurrenceTask = allTasks.find((t) => t.id === occurrenceSubtaskId);
  if (!occurrenceTask) {
    return task;
  }
  return {
    ...task,
    subtasks: Array.isArray(occurrenceTask.subtasks) ? occurrenceTask.subtasks : task.subtasks,
    actualTime: occurrenceTask.actualTime ?? task.actualTime,
    scheduledDate: occurrenceTask.scheduledDate ?? task.scheduledDate,
  };
}

/**
 * Safely prepare a task for editing in TaskDialog
 * Ensures all required fields are present and valid
 */
export function prepareTaskForDialog(task: Task | null | undefined): Task | null {
  if (!task) {
    return null;
  }

  try {
    // Validate required fields
    if (!task.id) {
      logger.error('Task missing ID:', task);
      return null;
    }

    // Create a safe copy with all required fields
    const safeTask: Task = {
      ...task,
      // Ensure required fields have values
      id: task.id,
      title: task.title || '',
      description: task.description || '',
      status: task.status || 'todo',
      priority: task.priority || 'medium',
      createdAt: task.createdAt || new Date().toISOString(),
      updatedAt: task.updatedAt || new Date().toISOString(),
      createdBy: task.createdBy || '',
      projectId: task.projectId || 'default',
      // Ensure arrays are always arrays
      tags: Array.isArray(task.tags) ? task.tags : [],
      subtasks: Array.isArray(task.subtasks) ? task.subtasks : [],
      dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
      assignedTo: Array.isArray(task.assignedTo) ? task.assignedTo : [],
      // Ensure recurrence config is valid
      recurrence: task.recurrence && typeof task.recurrence === 'object'
        ? {
            type: task.recurrence.type || RECURRENCE_NONE_CONFIG.type,
            interval: (typeof task.recurrence.interval === 'number' && task.recurrence.interval > 0) ? task.recurrence.interval : RECURRENCE_NONE_CONFIG.interval,
            daysOfWeek: Array.isArray(task.recurrence.daysOfWeek) ? task.recurrence.daysOfWeek : undefined,
            dayOfMonth: task.recurrence.dayOfMonth,
            endDate: task.recurrence.endDate || null,
          }
        : { ...RECURRENCE_NONE_CONFIG },
      // Optional fields with safe defaults
      notes: task.notes || '',
      dueDate: task.dueDate || null,
      scheduledDate: task.scheduledDate || null,
      completedAt: task.completedAt || null,
      estimatedTime: task.estimatedTime || null,
      actualTime: task.actualTime || null,
      folderId: task.folderId || null,
    };

    return safeTask;
  } catch (error) {
    logger.error('Error preparing task for dialog:', error, task);
    return null;
  }
}
