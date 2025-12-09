import type { Task } from '../types';
import { isDateInRecurrence } from './recurrence';
import { TASK_CALCULATION_CONSTANTS } from './task-calculation-constants';
import { getTaskMinutes } from './daily-hours-utils';
import { DEFAULT_WEEKDAY_WORK_START, MILLISECONDS_PER_MINUTE, MILLISECONDS_PER_HOUR, MINUTES_PER_HOUR, HOURS_PER_DAY } from './business-constants';
import { TIME_ROUNDING_INTERVAL_MINUTES } from './ai-config';

/**
 * Options for finding next available slot
 */
export interface FindSlotOptions {
  ensureAfterCurrentTime?: boolean;
  categoryHours?: { start: number; end: number } | null; // in minutes from midnight
  calendarEvents?: Array<{ start: Date; end: Date; title: string }>; // Calendar events to avoid
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
  
  // CRITICAL DEBUG: Log what tasks are being checked
  if (import.meta.env.DEV && allTasks.length > 0) {
    console.debug('findNextAvailableSlot - checking tasks', {
      taskId,
      requestedTime: requestedTime.toISOString(),
      taskDuration,
      allTasksCount: allTasks.length,
      allTasks: allTasks.map(t => ({
        id: t.id,
        title: t.title,
        scheduledDate: t.scheduledDate,
        scheduledTime: t.scheduledDate ? new Date(t.scheduledDate).toLocaleTimeString() : 'none',
        scheduledDateType: typeof t.scheduledDate,
      })),
    });
  }

  // Get all tasks scheduled for the target date (excluding the current task)
  // CRITICAL: Include ALL tasks regardless of category to detect conflicts across categories
  // This ensures recurring tasks see regular tasks and vice versa
  const dateTasks = allTasks.filter((task) => {
    if (taskId && task.id === taskId) return false;
    if (task.status === 'done') return false;
    if (!task.scheduledDate) return false; // Must have a scheduled date
    
    // CRITICAL: Parse scheduledDate to check if it's for the target date
    // Handle both ISO strings and Date objects
    const taskScheduledDate = typeof task.scheduledDate === 'string'
      ? new Date(task.scheduledDate)
      : new Date(task.scheduledDate);
    
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
  
  // CRITICAL DEBUG: Log what tasks were found
  if (import.meta.env.DEV && allTasks.length > 0) {
    console.debug('findNextAvailableSlot - dateTasks filtered', {
      taskId,
      requestedTime: requestedTime.toISOString(),
      targetDate: targetDate.toISOString(),
      allTasksCount: allTasks.length,
      dateTasksCount: dateTasks.length,
      dateTasks: dateTasks.map(t => ({
        id: t.id,
        title: t.title,
        scheduledDate: t.scheduledDate,
        scheduledTime: t.scheduledDate ? new Date(t.scheduledDate).toLocaleTimeString() : 'none',
        isRecurring: !!(t.recurrence && t.recurrence.type !== 'none'),
      })),
    });
  }

  // Sort tasks by scheduled time
  // IMPORTANT: Ensure we properly parse scheduledDate (could be ISO string or Date object)
  const sortedTasks = dateTasks
    .filter((task) => task.scheduledDate)
    .map((task) => {
      // Parse scheduledDate - handle both ISO strings and Date objects
      const scheduledDate = typeof task.scheduledDate === 'string' 
        ? new Date(task.scheduledDate)
        : new Date(task.scheduledDate);
      
      const start = scheduledDate.getTime();
      const duration = getTaskMinutes(task) * MILLISECONDS_PER_MINUTE; // Use AI estimator
      const end = start + duration;
      
      return { task, start, end };
    })
    .sort((a, b) => a.start - b.start);
  
  // Add calendar events to the conflict list
  const calendarConflicts: Array<{ start: number; end: number; title: string }> = [];
  if (options?.calendarEvents) {
    for (const event of options.calendarEvents) {
      const eventStart = new Date(event.start);
      const eventEnd = new Date(event.end);
      
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
    
    // Check conflicts with tasks
    for (const existing of sortedTasks) {
      // CRITICAL: Check for conflicts with multiple conditions to catch all edge cases
      // 1. Overlap: candidate starts before existing ends AND ends after existing starts
      const overlaps = candidateStart < existing.end && candidateEnd > existing.start;
      
      // 2. Exact same start time (most common case for duplicate scheduling)
      // CRITICAL: Use a small tolerance (1 millisecond) to catch exact matches that might have rounding differences
      const timeDifference = Math.abs(candidateStart - existing.start);
      const sameStartTime = timeDifference < 1; // Exact match or within 1ms
      
      // 3. Candidate starts slightly before existing but still overlaps
      const startsBeforeAndOverlaps = candidateStart < existing.start && candidateEnd > existing.start;
      
      // 4. Candidate starts at or very close to existing start (within 1 minute tolerance)
      // This catches rounding issues or time precision problems
      const withinOneMinute = timeDifference < MILLISECONDS_PER_MINUTE;
      
      // 5. Candidate ends at or very close to existing start (within 1 minute)
      const endsAtExistingStart = Math.abs(candidateEnd - existing.start) < MILLISECONDS_PER_MINUTE;
      
      // CRITICAL: Also check if candidate starts within the duration of existing task
      // This catches cases where tasks are scheduled very close together
      const startsWithinExisting = candidateStart >= existing.start && candidateStart < existing.end;
      
      if (overlaps || sameStartTime || startsBeforeAndOverlaps || withinOneMinute || endsAtExistingStart || startsWithinExisting) {
        hasConflict = true;
        // Track the latest end time of all conflicts to move past all overlapping tasks
        maxConflictEnd = Math.max(maxConflictEnd, existing.end);
        
        // Debug logging in development - ALWAYS log conflicts
        if (import.meta.env.DEV) {
          console.debug('🔴 Conflict detected in findNextAvailableSlot', {
            candidateTime: new Date(candidateStart).toISOString(),
            candidateEnd: new Date(candidateEnd).toISOString(),
            existingTask: existing.task.id,
            existingTaskTitle: existing.task.title,
            existingStart: new Date(existing.start).toISOString(),
            existingEnd: new Date(existing.end).toISOString(),
            overlaps,
            sameStartTime,
            startsBeforeAndOverlaps,
            withinOneMinute,
            endsAtExistingStart,
            timeDifferenceMs: timeDifference,
            maxConflictEnd: new Date(maxConflictEnd).toISOString(),
          });
        }
      }
    }
    
    // Check conflicts with calendar events
    for (const event of calendarConflicts) {
      const overlaps = candidateStart < event.end && candidateEnd > event.start;
      const sameStartTime = Math.abs(candidateStart - event.start) < 1;
      const withinOneMinute = Math.abs(candidateStart - event.start) < MILLISECONDS_PER_MINUTE;
      
      if (overlaps || sameStartTime || withinOneMinute) {
        hasConflict = true;
        maxConflictEnd = Math.max(maxConflictEnd, event.end);
        
        if (import.meta.env.DEV) {
          console.debug('🔴 Calendar event conflict detected in findNextAvailableSlot', {
            candidateTime: new Date(candidateStart).toISOString(),
            candidateEnd: new Date(candidateEnd).toISOString(),
            eventTitle: event.title,
            eventStart: new Date(event.start).toISOString(),
            eventEnd: new Date(event.end).toISOString(),
            overlaps,
            sameStartTime,
            withinOneMinute,
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

  // Sort tasks by scheduled time
  // IMPORTANT: Ensure we properly parse scheduledDate (could be ISO string or Date object)
  const sortedTasks = dateTasks
    .filter((task) => task.scheduledDate)
    .map((task) => {
      // Parse scheduledDate - handle both ISO strings and Date objects
      const scheduledDate = typeof task.scheduledDate === 'string' 
        ? new Date(task.scheduledDate)
        : new Date(task.scheduledDate);
      
      const start = scheduledDate.getTime();
      const duration = getTaskMinutes(task) * MILLISECONDS_PER_MINUTE; // Use AI estimator
      const end = start + duration;
      
      return { task, start, end };
    })
    .sort((a, b) => a.start - b.start);

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
  } else {
    // Start from default work start time
    const defaultStart = new Date(targetDate);
    const [workStartHour] = DEFAULT_WEEKDAY_WORK_START.split(':').map(Number);
    defaultStart.setHours(workStartHour, 0, 0, 0);
    lastScheduledEnd = defaultStart.getTime();
  }

  // Reorganize each task to ensure no overlaps and tasks are after current time (for today)
  // lastScheduledEnd is initialized to current time (for today) or category start/default start
  // So any task before lastScheduledEnd will be moved forward
  for (const taskInfo of sortedTasks) {
    const task = taskInfo.task;
    const taskDuration = getTaskMinutes(task) * MILLISECONDS_PER_MINUTE; // Use AI estimator
    
    // Check if task overlaps with previous task or is before the earliest allowed time
    // (lastScheduledEnd is set to current time for today, so tasks before current time will be moved)
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

