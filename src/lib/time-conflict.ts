import type { Task } from '../types';
import { isDateInRecurrence } from './recurrence';
import { parseCalendarEventTime } from './utils';
import { TASK_CALCULATION_CONSTANTS } from './task-calculation-constants';
import { getTaskMinutes } from './daily-hours-utils';
import { DEFAULT_WEEKDAY_WORK_START, MILLISECONDS_PER_MINUTE, MILLISECONDS_PER_HOUR, MINUTES_PER_HOUR, HOURS_PER_DAY } from './business-constants';
import { TIME_ROUNDING_INTERVAL_MINUTES } from './ai-config';

/**
 * Options for finding next available slot
 */
export interface FindSlotOptions {
  ensureAfterCurrentTime?: boolean;
  /** When true, only move tasks that overlap each other; do not move tasks for being "before work start" or "before now". */
  onlyFixOverlaps?: boolean;
  categoryHours?: { start: number; end: number } | null; // in minutes from midnight
  calendarEvents?: Array<{ start: Date | string; end: Date | string; title: string }>; // Calendar events to avoid (start/end as ISO string or Date)
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
  allTasks: Task[]
): Task | null {
  const targetDate = new Date(scheduledTime);
  targetDate.setHours(0, 0, 0, 0);

  // Get all tasks scheduled for the target date (excluding the current task)
  const dateTasks = allTasks.filter((task) => {
    if (taskId && task.id === taskId) return false; // Exclude the task being checked
    if (task.status === 'done') return false; // Exclude completed tasks
    return isDateInRecurrence(task, targetDate);
  });

  const newTaskStart = scheduledTime.getTime();
  const newTaskEnd = newTaskStart + (taskDuration * MILLISECONDS_PER_MINUTE);

  // Check for overlaps with existing tasks
  for (const existingTask of dateTasks) {
    if (!existingTask.scheduledDate) continue;

    // Parse scheduledDate - handle both ISO strings and Date objects
    const existingTaskScheduledDate = typeof existingTask.scheduledDate === 'string'
      ? new Date(existingTask.scheduledDate)
      : new Date(existingTask.scheduledDate);
    
    const existingTaskStart = existingTaskScheduledDate.getTime();
    const existingTaskDuration = getTaskMinutes(existingTask) * MILLISECONDS_PER_MINUTE; // Use AI estimator
    const existingTaskEnd = existingTaskStart + existingTaskDuration;

    // Check for overlap: new task overlaps if it starts before existing ends AND ends after existing starts
    if (newTaskStart < existingTaskEnd && newTaskEnd > existingTaskStart) {
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
    const taskScheduledDate = typeof task.scheduledDate === 'string'
      ? new Date(task.scheduledDate)
      : new Date(task.scheduledDate);
    
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
  // CRITICAL: Filter out invalid dates to ensure proper sorting
  const sortedTasks = dateTasks
    .filter((task) => task.scheduledDate)
    .map((task) => {
      // Parse scheduledDate - handle both ISO strings and Date objects
      const scheduledDate = typeof task.scheduledDate === 'string' 
        ? new Date(task.scheduledDate)
        : new Date(task.scheduledDate);
      
      // Validate date is not invalid
      if (isNaN(scheduledDate.getTime())) {
        return null;
      }
      
      const start = scheduledDate.getTime();
      const duration = getTaskMinutes(task) * MILLISECONDS_PER_MINUTE; // Use AI estimator
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
  
  // Add calendar events to the conflict list
  const calendarConflicts: Array<{ start: number; end: number; title: string }> = [];
  if (options?.calendarEvents) {
    for (const event of options.calendarEvents) {
      const eventStart = typeof event.start === 'string' ? parseCalendarEventTime(event.start) : event.start;
      const eventEnd = typeof event.end === 'string' ? parseCalendarEventTime(event.end) : event.end;
      
      // Check if event is on the target date
      const eventDate = new Date(eventStart);
      eventDate.setHours(0, 0, 0, 0);
      
      if (eventDate.getTime() === targetDate.getTime()) {
        calendarConflicts.push({
          start: eventStart.getTime(),
          end: eventEnd.getTime(),
          title: event.title,
        });
      }
    }
  }

  // Determine start time: ensure after current time if scheduling for today
  let candidateTime = new Date(requestedTime);
  const now = new Date();
  const isToday = targetDate.getTime() === new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  
  if (options?.ensureAfterCurrentTime && isToday) {
    // Start from current time (rounded up to next 15-minute slot)
    const currentMinutes = now.getMinutes();
    const roundedMinutes = Math.ceil(currentMinutes / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
    const currentTimeRounded = new Date(now);
    if (roundedMinutes >= MINUTES_PER_HOUR) {
      currentTimeRounded.setHours(currentTimeRounded.getHours() + 1);
      currentTimeRounded.setMinutes(0);
    } else {
      currentTimeRounded.setMinutes(roundedMinutes);
    }
    currentTimeRounded.setSeconds(0);
    currentTimeRounded.setMilliseconds(0);
    
    // Use the later of: current time rounded up, or requested time
    // This ensures we never schedule in the past, but also respects the drop position if it's in the future
    candidateTime = currentTimeRounded.getTime() > requestedTime.getTime() 
      ? currentTimeRounded 
      : new Date(requestedTime);
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
      const currentMinutes = now.getMinutes();
      const roundedMinutes = Math.ceil(currentMinutes / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
      const currentTimeRounded = new Date(now);
      if (roundedMinutes >= MINUTES_PER_HOUR) {
        currentTimeRounded.setHours(currentTimeRounded.getHours() + 1);
        currentTimeRounded.setMinutes(0);
      } else {
        currentTimeRounded.setMinutes(roundedMinutes);
      }
      const currentTotalMinutes = currentTimeRounded.getHours() * MINUTES_PER_HOUR + currentTimeRounded.getMinutes();
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
          // Task end exceeds category hours, no slot available today
          return requestedTime;
        }
      }
    }

    // Check if this slot conflicts with any existing task or calendar event
    // IMPORTANT: Check ALL conflicts, not just the first one, to ensure we move past all overlapping tasks
    let hasConflict = false;
    let maxConflictEnd = candidateStart; // Track the latest end time of all conflicts
    
    // Check conflicts with tasks: only true overlap (shared time). Back-to-back is not a conflict.
    for (const existing of sortedTasks) {
      const overlaps = candidateStart < existing.end && candidateEnd > existing.start;
      if (overlaps) {
        hasConflict = true;
        maxConflictEnd = Math.max(maxConflictEnd, existing.end);
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
    
    // Check conflicts with calendar events: only true overlap. Back-to-back is not a conflict.
    for (const event of calendarConflicts) {
      const overlaps = candidateStart < event.end && candidateEnd > event.start;
      if (overlaps) {
        hasConflict = true;
        maxConflictEnd = Math.max(maxConflictEnd, event.end);
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
    
    // Move candidate time to after ALL conflicting tasks (not just the first one)
    // Add a small buffer (1 minute) to ensure we don't schedule exactly at the end time
    candidateTime = new Date(maxConflictEnd + MILLISECONDS_PER_MINUTE);
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

  // If no slot found, return a time that indicates failure (24:00 or later)
  // This allows the caller to detect that no slot was found
  const failureTime = new Date(requestedTime);
  failureTime.setHours(HOURS_PER_DAY, 0, 0, 0);
  return failureTime;
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
  // CRITICAL: Filter out invalid dates to ensure proper sorting
  const sortedTasks = dateTasks
    .filter((task) => task.scheduledDate)
    .map((task) => {
      // Parse scheduledDate - handle both ISO strings and Date objects
      const scheduledDate = typeof task.scheduledDate === 'string' 
        ? new Date(task.scheduledDate)
        : new Date(task.scheduledDate);
      
      // Validate date is not invalid
      if (isNaN(scheduledDate.getTime())) {
        return null;
      }
      
      const start = scheduledDate.getTime();
      const duration = getTaskMinutes(task) * MILLISECONDS_PER_MINUTE; // Use AI estimator
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

  // Reorganize: move a task only if it truly overlaps the previous one (start < previous end). Back-to-back (start === previous end) is not overlap.
  for (const taskInfo of sortedTasks) {
    const task = taskInfo.task;
    const taskDuration = getTaskMinutes(task) * MILLISECONDS_PER_MINUTE; // Use AI estimator

    if (taskInfo.start < lastScheduledEnd) {
      // Task needs to be moved
      const candidateTime = new Date(lastScheduledEnd);
      
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

      // Find available slot for this task
      const newTime = findNextAvailableSlot(
        task.id,
        candidateTime,
        getTaskMinutes(task), // Use AI estimator
        allTasks,
        options
      );

      // Check if a valid slot was found
      if (newTime.getHours() < HOURS_PER_DAY) {
        reorganizations.push({
          taskId: task.id,
          newTime,
        });
        
        // Update last scheduled end for next iteration
        lastScheduledEnd = newTime.getTime() + taskDuration;
      } else {
        // No slot found, keep original time but update lastScheduledEnd if it's later
        lastScheduledEnd = Math.max(lastScheduledEnd, taskInfo.end);
      }
    } else {
      // Task doesn't need to be moved, but update lastScheduledEnd
      lastScheduledEnd = Math.max(lastScheduledEnd, taskInfo.end);
    }
  }

  return reorganizations;
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
    const existingTaskScheduledDate = typeof task.scheduledDate === 'string'
      ? new Date(task.scheduledDate)
      : new Date(task.scheduledDate);
    
    const existingTaskStart = existingTaskScheduledDate.getTime();
    const existingTaskDuration = getTaskMinutes(task) * MILLISECONDS_PER_MINUTE; // Use AI estimator
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
      getTaskMinutes(conflicting.task), // Use AI estimator
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
      const conflictingTaskDuration = getTaskMinutes(conflicting.task) * MILLISECONDS_PER_MINUTE; // Use AI estimator
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

