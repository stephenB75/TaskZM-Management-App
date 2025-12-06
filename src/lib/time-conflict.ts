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
  const newTaskEnd = newTaskStart + (taskDuration * 60 * 1000);

  // Check for overlaps with existing tasks
  for (const existingTask of dateTasks) {
    if (!existingTask.scheduledDate) continue;

    const existingTaskStart = new Date(existingTask.scheduledDate).getTime();
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

  // Get all tasks scheduled for the target date (excluding the current task)
  const dateTasks = allTasks.filter((task) => {
    if (taskId && task.id === taskId) return false;
    if (task.status === 'done') return false;
    return isDateInRecurrence(task, targetDate);
  });

  // Sort tasks by scheduled time
  const sortedTasks = dateTasks
    .filter((task) => task.scheduledDate)
    .map((task) => ({
      task,
      start: new Date(task.scheduledDate!).getTime(),
      end: new Date(task.scheduledDate!).getTime() + (getTaskMinutes(task) * MILLISECONDS_PER_MINUTE), // Use AI estimator
    }))
    .sort((a, b) => a.start - b.start);

  // Determine start time: ensure after current time if scheduling for today
  let candidateTime = new Date(requestedTime);
  const now = new Date();
  const isToday = targetDate.getTime() === new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  
  if (options?.ensureAfterCurrentTime && isToday) {
    // Start from current time (rounded up to next 15-minute slot)
    const currentMinutes = now.getMinutes();
    const roundedMinutes = Math.ceil(currentMinutes / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
    const currentTimeRounded = new Date(now);
    if (roundedMinutes >= 60) {
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
    const candidateTotalMinutes = candidateHour * 60 + candidateMinute;
    
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
      const currentTotalMinutes = currentTimeRounded.getHours() * 60 + currentTimeRounded.getMinutes();
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
      const candidateTotalMinutes = candidateHour * 60 + candidateMinute;
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

    // Check if this slot conflicts with any existing task
    let hasConflict = false;
    for (const existing of sortedTasks) {
      if (candidateStart < existing.end && candidateEnd > existing.start) {
        hasConflict = true;
        // Move candidate time to after this conflicting task
        candidateTime = new Date(existing.end);
        // Round to nearest 15-minute slot
        const minutes = candidateTime.getMinutes();
        const roundedMinutes = Math.ceil(minutes / 15) * 15;
        if (roundedMinutes >= MINUTES_PER_HOUR) {
          candidateTime.setHours(candidateTime.getHours() + 1);
          candidateTime.setMinutes(0);
        } else {
          candidateTime.setMinutes(roundedMinutes);
        }
        break;
      }
    }

    if (!hasConflict) {
      return candidateTime;
    }
  }

  // If no slot found, return a time that indicates failure (24:00 or later)
  // This allows the caller to detect that no slot was found
  const failureTime = new Date(requestedTime);
  failureTime.setHours(24, 0, 0, 0);
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
  const sortedTasks = dateTasks
    .filter((task) => task.scheduledDate)
    .map((task) => ({
      task,
      start: new Date(task.scheduledDate!).getTime(),
      end: new Date(task.scheduledDate!).getTime() + (getTaskMinutes(task) * MILLISECONDS_PER_MINUTE), // Use AI estimator
    }))
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
    if (roundedMinutes >= 60) {
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
      const roundedMinutes = Math.ceil(minutes / 15) * 15;
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
  const newTaskEnd = newTaskStart + (taskDuration * 60 * 1000);

  // Find all conflicting tasks
  const conflictingTasks: Array<{ task: Task; start: number; end: number }> = [];
  
  for (const task of dateTasks) {
    if (!task.scheduledDate) continue;
    
    const existingTaskStart = new Date(task.scheduledDate).getTime();
    const existingTaskDuration = getTaskMinutes(task) * 60 * 1000; // Use AI estimator
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
    const roundedMinutes = Math.ceil(minutes / 15) * 15;
    if (roundedMinutes >= 60) {
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
    if (newTime.getHours() < 24) {
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

