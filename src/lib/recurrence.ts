import type { Task, RecurrenceConfig } from '../types';
import { TIMING_CONSTANTS } from './timing-constants';

/**
 * Parse a scheduledDate string to local date-only.
 * Date-only strings (YYYY-MM-DD) are parsed as UTC by JavaScript, which shifts the day in timezones behind UTC.
 * We treat YYYY-MM-DD as local date so tasks appear on the correct calendar day everywhere.
 */
function parseToLocalDateOnly(dateString: string): Date {
  const s = dateString.trim();
  // Match YYYY-MM-DD (optionally with nothing or only whitespace after)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number);
    if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
      return new Date(y, m - 1, d);
    }
  }
  const d = new Date(dateString);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Check if a date matches a task's recurrence pattern
 */
export function isDateInRecurrence(task: Task, checkDate: Date): boolean {
  const recurrenceType = task.recurrence ? String(task.recurrence.type || 'none').toLowerCase() : 'none';
  if (!task.recurrence || recurrenceType === 'none') {
    if (!task.scheduledDate) return false;
    const taskDateOnly = parseToLocalDateOnly(task.scheduledDate);
    const checkDateOnly = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
    return (
      taskDateOnly.getFullYear() === checkDateOnly.getFullYear() &&
      taskDateOnly.getMonth() === checkDateOnly.getMonth() &&
      taskDateOnly.getDate() === checkDateOnly.getDate()
    );
  }

  // If task has no scheduled date, it can't recur
  if (!task.scheduledDate) return false;

  const baseDateOnly = parseToLocalDateOnly(task.scheduledDate);
  if (Number.isNaN(baseDateOnly.getTime())) return false;

  const checkDateOnly = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());

  // For recurring tasks that are completed: only show if the scheduledDate matches the exact checkDate
  if (task.status === 'done' && recurrenceType !== 'none') {
    return (
      baseDateOnly.getFullYear() === checkDateOnly.getFullYear() &&
      baseDateOnly.getMonth() === checkDateOnly.getMonth() &&
      baseDateOnly.getDate() === checkDateOnly.getDate()
    );
  }

  // Check if we're before the base date
  if (checkDateOnly < baseDateOnly) return false;

  // Check if recurrence has ended (normalize endDate to local date-only so the end day is inclusive)
  if (task.recurrence.endDate) {
    const endDateOnly = parseToLocalDateOnly(task.recurrence.endDate);
    if (!Number.isNaN(endDateOnly.getTime()) && checkDateOnly > endDateOnly) return false;
  }

  const recurrence = task.recurrence;
  const interval = Math.max(1, Number(recurrence.interval) || 1);
  const daysDiff = Math.floor((checkDateOnly.getTime() - baseDateOnly.getTime()) / TIMING_CONSTANTS.timeConversions.daysToMs);

  switch (recurrenceType) {
    case 'daily':
      return daysDiff >= 0 && daysDiff % interval === 0;

    case 'weekly':
      // Normalize to numbers (API/JSON may return strings); 0–6 = Sun–Sat
      const daysOfWeek =
        recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0
          ? recurrence.daysOfWeek.map((d) => Number(d)).filter((d) => !Number.isNaN(d) && d >= 0 && d <= 6)
          : null;
      if (daysOfWeek && daysOfWeek.length > 0) {
        const checkDayOfWeek = checkDateOnly.getDay();
        if (!daysOfWeek.includes(checkDayOfWeek)) return false;

        // Find the first occurrence of any of the specified days starting from the base date
        let firstOccurrence = new Date(baseDateOnly);
        const baseDayOfWeek = baseDateOnly.getDay();

        const sortedDays = [...daysOfWeek].sort((a, b) => a - b);
        const nextDayInWeek = sortedDays.find(day => day >= baseDayOfWeek);
        
        if (nextDayInWeek !== undefined) {
          // Found a day in the current week (including today if it matches)
          firstOccurrence.setDate(baseDateOnly.getDate() + (nextDayInWeek - baseDayOfWeek));
        } else {
          // First occurrence is in the next interval week
          const daysUntilNextWeek = TIMING_CONSTANTS.calendar.daysPerWeek - baseDayOfWeek;
          const daysToFirstDay = sortedDays[0];
          const daysToAdd = daysUntilNextWeek + daysToFirstDay + (TIMING_CONSTANTS.calendar.daysPerWeek * (interval - 1));
          firstOccurrence.setDate(baseDateOnly.getDate() + daysToAdd);
        }
        firstOccurrence.setHours(0, 0, 0, 0);

        // Week boundaries (Sunday start) for "week 0" = week containing first occurrence
        const firstOccurrenceWeekStart = new Date(firstOccurrence);
        firstOccurrenceWeekStart.setDate(firstOccurrence.getDate() - firstOccurrence.getDay());

        const checkDateWeekStart = new Date(checkDateOnly);
        checkDateWeekStart.setDate(checkDateOnly.getDate() - checkDateOnly.getDay());

        // Only exclude dates before the first occurrence *week* (so Mon/Wed/Fri all show in same week)
        if (checkDateWeekStart < firstOccurrenceWeekStart) return false;

        const weeksFromFirst = Math.floor((checkDateWeekStart.getTime() - firstOccurrenceWeekStart.getTime()) / TIMING_CONSTANTS.timeConversions.weeksToMs);
        return weeksFromFirst >= 0 && weeksFromFirst % interval === 0;
      }
      // Fallback: simple weekly interval (same day of week every interval weeks)
      if (checkDateOnly.getDay() !== baseDateOnly.getDay()) return false;
      return daysDiff >= 0 && Math.floor(daysDiff / TIMING_CONSTANTS.calendar.daysPerWeek) % interval === 0;

    case 'monthly': {
      // Normalize to number (API/JSON may return string); 1–31
      const dayOfMonth = recurrence.dayOfMonth != null ? Number(recurrence.dayOfMonth) : undefined;
      if (dayOfMonth != null && !Number.isNaN(dayOfMonth) && dayOfMonth >= 1 && dayOfMonth <= 31) {
        if (checkDateOnly.getDate() !== dayOfMonth) return false;

        const monthsDiff =
          (checkDateOnly.getFullYear() - baseDateOnly.getFullYear()) * TIMING_CONSTANTS.calendar.monthsPerYear +
          (checkDateOnly.getMonth() - baseDateOnly.getMonth());

        return monthsDiff >= 0 && monthsDiff % interval === 0;
      }
      // Fallback: same day of month every interval months
      if (checkDateOnly.getDate() !== baseDateOnly.getDate()) return false;
      const monthsDiff = 
        (checkDateOnly.getFullYear() - baseDateOnly.getFullYear()) * TIMING_CONSTANTS.calendar.monthsPerYear +
        (checkDateOnly.getMonth() - baseDateOnly.getMonth());
      return monthsDiff >= 0 && monthsDiff % interval === 0;
    }

    default:
      return false;
  }
}

