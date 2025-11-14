import type { Task } from '../types';
import { isDateInRecurrence } from './recurrence';

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
    const existingTaskDuration = (existingTask.estimatedTime || 30) * 60 * 1000;
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
 * @returns The next available time slot
 */
export function findNextAvailableSlot(
  taskId: string | null,
  requestedTime: Date,
  taskDuration: number,
  allTasks: Task[]
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
      end: new Date(task.scheduledDate!).getTime() + ((task.estimatedTime || 30) * 60 * 1000),
    }))
    .sort((a, b) => a.start - b.start);

  // Start checking from the requested time
  let candidateTime = new Date(requestedTime);
  const maxHour = 23;
  const maxMinute = 0;

  // Try to find a slot after the requested time
  while (candidateTime.getHours() < maxHour || (candidateTime.getHours() === maxHour && candidateTime.getMinutes() <= maxMinute)) {
    const candidateStart = candidateTime.getTime();
    const candidateEnd = candidateStart + (taskDuration * 60 * 1000);

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
        if (roundedMinutes >= 60) {
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

  // If no slot found, return the requested time (user can decide)
  return requestedTime;
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

