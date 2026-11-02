import type { Task, HoursSettings } from '../types';
import { AI_SCHEDULER_MAX_END_HOUR, MINUTES_PER_HOUR } from './business-constants';
import { DEFAULT_CATEGORY_HOURS, DEFAULT_CATEGORY_WORK_WINDOW_HOURS, DEFAULT_TASK_CATEGORY } from './ai-config';

/**
 * Get task category from tags
 * @param task - The task to check
 * @returns 'work' | 'personal' | 'projects' | null
 */
export function getTaskCategory(task: Task): 'work' | 'personal' | 'projects' | null {
  if (!task.tags || task.tags.length === 0) return null;
  
  // Check for category tags (case-insensitive)
  const tagLowerCase = task.tags.map(t => t.toLowerCase());
  if (tagLowerCase.includes('work')) return 'work';
  if (tagLowerCase.includes('personal')) return 'personal';
  if (tagLowerCase.includes('projects') || tagLowerCase.includes('project')) return 'projects';
  
  return null;
}

/**
 * Check if date is weekend
 * @param date - The date to check
 * @returns true if weekend, false otherwise
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Sunday = 0, Saturday = 6
}

/**
 * Parse time string (HH:mm) to total minutes
 * @param timeStr - Time string in HH:mm format
 * @returns Total minutes from midnight
 */
export function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return (hours || 0) * MINUTES_PER_HOUR + (minutes || 0);
}

/**
 * Get category hours for a task on a specific date
 * @param task - The task to check
 * @param date - The date to check
 * @param hoursSettings - Hours settings
 * @returns Category hours in minutes format { start: number, end: number } or null
 */
export function getCategoryHoursForTask(
  task: Task,
  date: Date,
  hoursSettings: HoursSettings
): { start: number; end: number } | null {
  if (!hoursSettings.respectHours) return null;

  const category = getTaskCategory(task);
  if (!category) return null;

  const isWeekendDate = isWeekend(date);
  const dayHours = isWeekendDate ? hoursSettings.weekendHours : hoursSettings.weekdayHours;
  const categoryHours = dayHours[category];

  // If category hours are disabled for this day type, return null
  if (!categoryHours.enabled) return null;

  const startMinutes = parseTimeToMinutes(categoryHours.start);
  const endMinutes = parseTimeToMinutes(categoryHours.end);

  return { start: startMinutes, end: endMinutes };
}

/** Category hours as "HH:mm-HH:mm" (or "off") per day type, for the enhanced planner's context. */
export function describeCategoryHours(hoursSettings: HoursSettings): Record<'weekday' | 'weekend', Record<string, string>> {
  const describe = (hours: HoursSettings['weekdayHours']) =>
    Object.fromEntries(
      Object.entries(hours).map(([category, window]) => [category, window.enabled ? `${window.start}-${window.end}` : 'off']),
    );
  return { weekday: describe(hoursSettings.weekdayHours), weekend: describe(hoursSettings.weekendHours) };
}

/**
 * Whether a task starting at `start` sits inside its category hours the way the scheduler's
 * forced category mode places it: allowed day type, and start/end inside the category window
 * (or the default window when that category's hours are off).
 */
export function fitsForcedCategoryHours(task: Task, start: Date, hoursSettings: HoursSettings): boolean {
  const category = getTaskCategory(task) ?? DEFAULT_TASK_CATEGORY;
  const weekend = isWeekend(start);
  const weekdayEnabled = !!hoursSettings.weekdayHours[category]?.enabled;
  const weekendEnabled = !!hoursSettings.weekendHours[category]?.enabled;
  if ((weekdayEnabled || weekendEnabled) && !(weekend ? weekendEnabled : weekdayEnabled)) return false;

  const window = (weekend ? hoursSettings.weekendHours : hoursSettings.weekdayHours)[category];
  let windowStart: number;
  let windowEnd: number;
  if (window?.enabled) {
    windowStart = parseTimeToMinutes(window.start);
    windowEnd = parseTimeToMinutes(window.end);
  } else {
    const defaultStartHour = DEFAULT_CATEGORY_HOURS[category] || DEFAULT_CATEGORY_HOURS[DEFAULT_TASK_CATEGORY];
    windowStart = defaultStartHour * MINUTES_PER_HOUR;
    windowEnd = Math.min(defaultStartHour + DEFAULT_CATEGORY_WORK_WINDOW_HOURS, AI_SCHEDULER_MAX_END_HOUR) * MINUTES_PER_HOUR;
  }
  const startMinutes = start.getHours() * MINUTES_PER_HOUR + start.getMinutes();
  return startMinutes >= windowStart && startMinutes + (task.estimatedTime ?? 0) <= windowEnd;
}

