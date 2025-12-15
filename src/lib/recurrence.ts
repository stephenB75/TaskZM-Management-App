import type { Task, RecurrenceConfig } from '../types';
import { TIMING_CONSTANTS } from './timing-constants';

/**
 * Check if a date matches a task's recurrence pattern
 */
export function isDateInRecurrence(task: Task, checkDate: Date): boolean {
  // If task has no recurrence, only match exact scheduled date
  if (!task.recurrence || task.recurrence.type === 'none') {
    if (!task.scheduledDate) return false;
    const taskDate = new Date(task.scheduledDate);
    // Normalize both dates to local time (date only, no time component)
    // This ensures timezone differences don't cause mismatches
    const taskDateOnly = new Date(taskDate.getFullYear(), taskDate.getMonth(), taskDate.getDate());
    const checkDateOnly = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
    return (
      taskDateOnly.getFullYear() === checkDateOnly.getFullYear() &&
      taskDateOnly.getMonth() === checkDateOnly.getMonth() &&
      taskDateOnly.getDate() === checkDateOnly.getDate()
    );
  }

  // If task has no scheduled date, it can't recur
  if (!task.scheduledDate) return false;

  const baseDate = new Date(task.scheduledDate);
  const checkDateOnly = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
  const baseDateOnly = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());

  // For recurring tasks that are completed: only show if the scheduledDate matches the exact checkDate
  // This ensures that when a recurring task is marked as done, only that specific occurrence is affected
  // Note: Completed occurrences have recurrence.type === 'none', so they won't reach this point
  // This check is for the main recurring task that was marked as done (shouldn't happen in normal flow)
  if (task.status === 'done' && task.recurrence.type !== 'none') {
    // If the main recurring task is marked as done, only show on its scheduled date
    return (
      baseDateOnly.getFullYear() === checkDateOnly.getFullYear() &&
      baseDateOnly.getMonth() === checkDateOnly.getMonth() &&
      baseDateOnly.getDate() === checkDateOnly.getDate()
    );
  }

  // Check if we're before the base date
  if (checkDateOnly < baseDateOnly) return false;

  // Check if recurrence has ended
  if (task.recurrence.endDate) {
    const endDate = new Date(task.recurrence.endDate);
    if (checkDateOnly > endDate) return false;
  }

  const recurrence = task.recurrence;
  const daysDiff = Math.floor((checkDateOnly.getTime() - baseDateOnly.getTime()) / TIMING_CONSTANTS.timeConversions.daysToMs);

  switch (recurrence.type) {
    case 'daily':
      return daysDiff >= 0 && daysDiff % recurrence.interval === 0;

    case 'weekly':
      if (recurrence.daysOfWeek && recurrence.daysOfWeek.length > 0) {
        // Check if the day of week matches
        const checkDayOfWeek = checkDateOnly.getDay();
        if (!recurrence.daysOfWeek.includes(checkDayOfWeek)) return false;

        // Find the first occurrence of any of the specified days starting from the base date
        let firstOccurrence = new Date(baseDateOnly);
        const baseDayOfWeek = baseDateOnly.getDay();
        
        // Find the first matching day on or after the base date
        const sortedDays = [...recurrence.daysOfWeek].sort((a, b) => a - b);
        const nextDayInWeek = sortedDays.find(day => day >= baseDayOfWeek);
        
        if (nextDayInWeek !== undefined) {
          // Found a day in the current week (including today if it matches)
          firstOccurrence.setDate(baseDateOnly.getDate() + (nextDayInWeek - baseDayOfWeek));
        } else {
          // First occurrence is in the next interval week
          const daysUntilNextWeek = TIMING_CONSTANTS.calendar.daysPerWeek - baseDayOfWeek;
          const daysToFirstDay = sortedDays[0];
          const daysToAdd = daysUntilNextWeek + daysToFirstDay + (TIMING_CONSTANTS.calendar.daysPerWeek * (recurrence.interval - 1));
          firstOccurrence.setDate(baseDateOnly.getDate() + daysToAdd);
        }
        firstOccurrence.setHours(0, 0, 0, 0);
        
        // Calculate the week number (0-based) from the first occurrence
        // All days in the same week as the first occurrence are in week 0
        // All days in the week that is interval weeks later are in week interval, etc.
        const firstOccurrenceWeekStart = new Date(firstOccurrence);
        firstOccurrenceWeekStart.setDate(firstOccurrence.getDate() - firstOccurrence.getDay()); // Start of week (Sunday)
        
        const checkDateWeekStart = new Date(checkDateOnly);
        checkDateWeekStart.setDate(checkDateOnly.getDate() - checkDateOnly.getDay()); // Start of week (Sunday)
        
        // Calculate weeks difference from first occurrence week
        const weeksFromFirst = Math.floor((checkDateWeekStart.getTime() - firstOccurrenceWeekStart.getTime()) / TIMING_CONSTANTS.timeConversions.weeksToMs);
        
        // Check if we're on a valid interval week and the day matches
        // All days in week 0, interval, 2*interval, etc. should match
        return weeksFromFirst >= 0 && weeksFromFirst % recurrence.interval === 0;
      }
      // Fallback: simple weekly interval (same day of week every interval weeks)
      if (checkDateOnly.getDay() !== baseDateOnly.getDay()) return false;
      return daysDiff >= 0 && Math.floor(daysDiff / TIMING_CONSTANTS.calendar.daysPerWeek) % recurrence.interval === 0;

    case 'monthly':
      if (recurrence.dayOfMonth) {
        // Check if the day of month matches
        if (checkDateOnly.getDate() !== recurrence.dayOfMonth) return false;
        
        // Calculate month difference
        const monthsDiff = 
          (checkDateOnly.getFullYear() - baseDateOnly.getFullYear()) * 12 +
          (checkDateOnly.getMonth() - baseDateOnly.getMonth());
        
        return monthsDiff >= 0 && monthsDiff % recurrence.interval === 0;
      }
      // Fallback: same day of month every interval months
      if (checkDateOnly.getDate() !== baseDateOnly.getDate()) return false;
      const monthsDiff = 
        (checkDateOnly.getFullYear() - baseDateOnly.getFullYear()) * 12 +
        (checkDateOnly.getMonth() - baseDateOnly.getMonth());
      return monthsDiff >= 0 && monthsDiff % recurrence.interval === 0;

    default:
      return false;
  }
}

