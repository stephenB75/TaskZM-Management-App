import type { Task } from '../types';
import { isDateInRecurrence } from './recurrence';
import { analyzeTaskVerbs, calculateComplexity, applyVerbSpecificAdjustments } from './verb-analysis';

const MAX_HOURS_PER_DAY = 5;

/**
 * Estimate task duration in hours
 * Uses the same logic as useAIScheduler for consistency
 * Formula: Base × Effort × Priority × Complexity
 */
function estimateTaskHours(task: Task): number {
  // Priority 1: If estimated time is explicitly set by user, use it directly
  if (task.estimatedTime && task.estimatedTime > 0) {
    return task.estimatedTime / 60; // Convert minutes to hours
  }
  
  // Priority 2: Formula-based estimation using effort + priority + complexity
  const { effortScore, primaryVerb } = analyzeTaskVerbs(task);
  const complexityScore = calculateComplexity(task);
  
  // Priority multiplier (existing values maintained)
  const priorityMultiplier = {
    urgent: 0.7,
    high: 1.0,
    medium: 1.5,
    low: 2.0
  };
  
  // Base time in minutes (30 minutes default)
  const baseMinutes = 30;
  
  // Formula: Base × Effort × Priority × Complexity
  let estimatedMinutes = baseMinutes;
  estimatedMinutes *= (effortScore / 2.5); // Normalize effort (2.5 is middle of 1-5 scale)
  estimatedMinutes *= priorityMultiplier[task.priority] || 1.0;
  estimatedMinutes *= (complexityScore / 2.5); // Normalize complexity
  
  // Apply verb-specific adjustments for known action types (maintains existing behavior)
  estimatedMinutes = applyVerbSpecificAdjustments(estimatedMinutes, primaryVerb, task);
  
  // Clamp between 15 minutes (minimum) and 300 minutes (5 hours maximum)
  estimatedMinutes = Math.max(15, Math.min(300, estimatedMinutes));
  
  // Round to nearest 15 minutes for cleaner scheduling
  estimatedMinutes = Math.round(estimatedMinutes / 15) * 15;
  
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
  
  if (currentHours >= 4 || newTotal >= 4) {
    return 'warning'; // Close to limit (4+ hours)
  }
  
  return 'none';
}

export { MAX_HOURS_PER_DAY };

