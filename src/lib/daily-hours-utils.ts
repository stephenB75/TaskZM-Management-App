import type { Task } from '../types';
import { isDateInRecurrence } from './recurrence';
import { analyzeTaskVerbs, calculateComplexity, applyVerbSpecificAdjustments } from './verb-analysis';
import {
  MAX_HOURS_PER_DAY,
  DAILY_HOURS_WARNING_THRESHOLD,
  BASE_TASK_DURATION_MINUTES,
  MIN_TASK_DURATION_MINUTES,
  MAX_TASK_DURATION_MINUTES,
  EFFORT_NORMALIZATION_DIVISOR,
  COMPLEXITY_NORMALIZATION_DIVISOR,
  PRIORITY_MULTIPLIERS,
  TIME_ROUNDING_INTERVAL_MINUTES,
} from './ai-config';

/**
 * Estimate task duration in hours
 * Uses the same logic as useAIScheduler for consistency
 * Formula: Base × Effort × Priority × Complexity
 */
export function estimateTaskHours(task: Task): number {
  // Priority 1: If estimated time is explicitly set by user, use it directly
  // IMPORTANT: Check for null/undefined explicitly, not just truthy (0 is falsy but valid)
  if (task.estimatedTime !== null && task.estimatedTime !== undefined && task.estimatedTime > 0) {
    return task.estimatedTime / 60; // Convert minutes to hours
  }
  
  // Priority 2: Formula-based estimation using effort + priority + complexity
  const { effortScore, primaryVerb } = analyzeTaskVerbs(task);
  const complexityScore = calculateComplexity(task);
  
  // Formula: Base × Effort × Priority × Complexity
  let estimatedMinutes = BASE_TASK_DURATION_MINUTES;
  estimatedMinutes *= (effortScore / EFFORT_NORMALIZATION_DIVISOR);
  estimatedMinutes *= PRIORITY_MULTIPLIERS[task.priority] || 1.0;
  estimatedMinutes *= (complexityScore / COMPLEXITY_NORMALIZATION_DIVISOR);
  
  // Apply verb-specific adjustments for known action types (maintains existing behavior)
  estimatedMinutes = applyVerbSpecificAdjustments(estimatedMinutes, primaryVerb, task);
  
  // Clamp between minimum and maximum task duration
  estimatedMinutes = Math.max(MIN_TASK_DURATION_MINUTES, Math.min(MAX_TASK_DURATION_MINUTES, estimatedMinutes));
  
  // Round to nearest interval for cleaner scheduling
  estimatedMinutes = Math.round(estimatedMinutes / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
  
  return estimatedMinutes / 60; // Convert to hours (maintains interface compatibility)
}

/**
 * Calculate total hours for a specific date from all tasks
 * @param date - The date to calculate hours for
 * @param allTasks - All tasks to check
 * @param excludeTaskId - Optional task ID to exclude from calculation
 * @returns Total hours scheduled for that date
 */
export function calculateDailyHours(
  date: Date,
  allTasks: Task[],
  excludeTaskId?: string
): number {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);
  
  // Get all tasks scheduled for the target date
  const dateTasks = allTasks.filter((task) => {
    if (excludeTaskId && task.id === excludeTaskId) return false;
    if (task.status === 'done') return false; // Exclude completed tasks
    return isDateInRecurrence(task, targetDate);
  });
  
  // Calculate total hours
  let totalHours = 0;
  for (const task of dateTasks) {
    totalHours += estimateTaskHours(task);
  }
  
  return totalHours;
}

/**
 * Check if adding a task would exceed the daily limit
 * @param date - The date to check
 * @param task - The task being added
 * @param allTasks - All tasks to check against
 * @returns Object with wouldExceed (boolean) and currentHours (number)
 */
export function checkDailyLimit(
  date: Date,
  task: Task,
  allTasks: Task[]
): { wouldExceed: boolean; currentHours: number; newTotalHours: number } {
  const currentHours = calculateDailyHours(date, allTasks, task.id);
  const taskHours = estimateTaskHours(task);
  const newTotalHours = currentHours + taskHours;
  
  return {
    wouldExceed: newTotalHours >= MAX_HOURS_PER_DAY,
    currentHours,
    newTotalHours,
  };
}

/**
 * Get warning level for daily hours
 * @param currentHours - Current hours scheduled
 * @param taskHours - Hours of task being added
 * @returns 'none' | 'warning' | 'error'
 */
export function getDailyHoursWarningLevel(
  currentHours: number,
  taskHours: number
): 'none' | 'warning' | 'error' {
  const newTotal = currentHours + taskHours;
  
  if (newTotal >= MAX_HOURS_PER_DAY) {
    return 'error'; // Would exceed limit
  }
  
  if (currentHours >= DAILY_HOURS_WARNING_THRESHOLD || newTotal >= DAILY_HOURS_WARNING_THRESHOLD) {
    return 'warning'; // Close to limit
  }
  
  return 'none';
}

export { MAX_HOURS_PER_DAY };

/**
 * Get task duration in hours using AI estimator
 * This is a convenience wrapper around estimateTaskHours
 */
export function getTaskHours(task: Task): number {
  return estimateTaskHours(task);
}

/**
 * Get task duration in minutes using AI estimator
 * This is the shared utility function used across the app
 * to ensure consistent duration calculations
 */
export function getTaskMinutes(task: Task): number {
  const hours = estimateTaskHours(task);
  return Math.round(hours * 60); // Convert hours to minutes, rounded
}

