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
    return (
      taskDate.getFullYear() === checkDate.getFullYear() &&
      taskDate.getMonth() === checkDate.getMonth() &&
      taskDate.getDate() === checkDate.getDate()
    );
  }

  // If task has no scheduled date, it can't recur
  if (!task.scheduledDate) return false;

  const baseDate = new Date(task.scheduledDate);
  const checkDateOnly = new Date(checkDate.getFullYear(), checkDate.getMonth(), checkDate.getDate());
  const baseDateOnly = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate());

  // For recurring tasks that are completed: only show if the scheduledDate matches the exact checkDate
  // This ensures that when a recurring task is marked as done, only that specific occurrence is affected
  if (task.status === 'done') {
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

        // Find the first occurrence of any of the specified days in the base week
        let firstOccurrence = new Date(baseDateOnly);
        const baseDayOfWeek = baseDateOnly.getDay();
        
        // Find the first matching day in the base week (or next week if needed)
        const sortedDays = [...recurrence.daysOfWeek].sort((a, b) => a - b);
        const nextDayInWeek = sortedDays.find(day => day >= baseDayOfWeek);
        
        if (nextDayInWeek !== undefined) {
          firstOccurrence.setDate(baseDateOnly.getDate() + (nextDayInWeek - baseDayOfWeek));
        } else {
          // First occurrence is in the next week
          firstOccurrence.setDate(baseDateOnly.getDate() + (TIMING_CONSTANTS.calendar.daysPerWeek - baseDayOfWeek + sortedDays[0]));
        }
        firstOccurrence.setHours(0, 0, 0, 0);
        
        // Calculate weeks difference from first occurrence
        const weeksFromFirst = Math.floor((checkDateOnly.getTime() - firstOccurrence.getTime()) / TIMING_CONSTANTS.timeConversions.weeksToMs);
        
        // Check if we're on a valid interval week and the day matches
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

