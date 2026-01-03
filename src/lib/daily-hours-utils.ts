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
import { MINUTES_PER_HOUR } from './business-constants';

/**
 * Estimate task duration in hours
 * 
 * This is the core AI Duration Estimator that works with all AI scheduling functions.
 * It uses a formula-based approach: Base × Effort × Priority × Complexity
 * 
 * Integration Points:
 * - scheduleAllTasks: Uses getTaskHours() for new task scheduling
 * - generateSchedulePlan: Uses getTaskHours() for plan generation
 * - rescheduleDay/Week/Month: Uses getTaskHours() for rescheduling
 * - calculateDailyHours: Uses estimateTaskHours() for hour tracking
 * - time-conflict.ts: Uses getTaskMinutes() for conflict detection
 * 
 * @param task - The task to estimate duration for
 * @returns Estimated duration in hours
 */
export function estimateTaskHours(task: Task): number {
  // Validate task input
  if (!task || typeof task !== 'object') {
    console.warn('⚠️ estimateTaskHours: Invalid task provided', task);
    return BASE_TASK_DURATION_MINUTES / MINUTES_PER_HOUR; // Return base duration as fallback
  }

  // Priority 1: If user has explicitly set estimated time, use it directly
  // IMPORTANT: Check for null/undefined explicitly, not just truthy (0 is falsy but valid)
  if (task.estimatedTime !== null && task.estimatedTime !== undefined && task.estimatedTime > 0) {
    const userSetHours = task.estimatedTime / MINUTES_PER_HOUR;
    // Only log in development to reduce console noise
    if (import.meta.env.DEV) {
      console.log('✅ estimateTaskHours: Using user-set estimated time', {
        taskId: task.id,
        taskTitle: task.title,
        estimatedTimeMinutes: task.estimatedTime,
        estimatedHours: userSetHours,
      });
    }
    return userSetHours;
  }
  
  // Priority 2: Formula-based estimation using AI analysis
  // Get effort score from verb analysis (1-5 scale)
  const verbAnalysis = analyzeTaskVerbs(task);
  let effortScore = verbAnalysis.effortScore;
  let primaryVerb = verbAnalysis.primaryVerb || '';
  
  // Validate effort score
  if (typeof effortScore !== 'number' || isNaN(effortScore) || !isFinite(effortScore)) {
    console.warn('⚠️ estimateTaskHours: Invalid effort score, using default', { effortScore, verbAnalysis });
    effortScore = 2.5;
  }
  
  // Get complexity score from task properties (1-5 scale)
  let complexityScore = calculateComplexity(task);
  
  // Validate complexity score
  if (typeof complexityScore !== 'number' || isNaN(complexityScore) || !isFinite(complexityScore)) {
    console.warn('⚠️ estimateTaskHours: Invalid complexity score, using default', { complexityScore });
    complexityScore = 2.5;
  }
  
  // Get priority multiplier
  let priorityMultiplier = PRIORITY_MULTIPLIERS[task.priority] || PRIORITY_MULTIPLIERS.medium;
  
  // Validate priority multiplier
  if (typeof priorityMultiplier !== 'number' || isNaN(priorityMultiplier) || !isFinite(priorityMultiplier)) {
    console.warn('⚠️ estimateTaskHours: Invalid priority multiplier, using default', { priorityMultiplier, priority: task.priority });
    priorityMultiplier = PRIORITY_MULTIPLIERS.medium;
  }
  
  // Formula: Base × (Effort / Normalization) × Priority × (Complexity / Normalization)
  // This ensures:
  // - Base duration is the starting point
  // - Effort score (1-5) is normalized to a multiplier (0.4-2.0)
  // - Priority multiplier adjusts based on urgency
  // - Complexity score (1-5) is normalized to a multiplier (0.4-2.0)
  let estimatedMinutes = BASE_TASK_DURATION_MINUTES;
  
  // Apply effort multiplier (normalized from 1-5 scale to 0.4-2.0)
  const effortMultiplier = effortScore / EFFORT_NORMALIZATION_DIVISOR;
  estimatedMinutes *= effortMultiplier;
  
  // Apply priority multiplier
  estimatedMinutes *= priorityMultiplier;
  
  // Apply complexity multiplier (normalized from 1-5 scale to 0.4-2.0)
  const complexityMultiplier = complexityScore / COMPLEXITY_NORMALIZATION_DIVISOR;
  estimatedMinutes *= complexityMultiplier;
  
  // Apply verb-specific adjustments for known action types
  // This refines the estimate based on the type of action (meeting, review, development, etc.)
  const beforeAdjustment = estimatedMinutes;
  estimatedMinutes = applyVerbSpecificAdjustments(estimatedMinutes, primaryVerb, task);
  
  // Validate estimated minutes before clamping
  if (typeof estimatedMinutes !== 'number' || isNaN(estimatedMinutes) || !isFinite(estimatedMinutes)) {
    console.warn('⚠️ estimateTaskHours: Invalid estimated minutes after calculation, using base', { estimatedMinutes });
    estimatedMinutes = BASE_TASK_DURATION_MINUTES;
  }
  
  // Clamp between minimum and maximum task duration
  estimatedMinutes = Math.max(MIN_TASK_DURATION_MINUTES, Math.min(MAX_TASK_DURATION_MINUTES, estimatedMinutes));
  
  // Round to nearest interval for cleaner scheduling
  estimatedMinutes = Math.round(estimatedMinutes / TIME_ROUNDING_INTERVAL_MINUTES) * TIME_ROUNDING_INTERVAL_MINUTES;
  
  // Convert to hours
  let estimatedHours = estimatedMinutes / 60;
  
  // Final validation - ensure we return a valid number
  if (typeof estimatedHours !== 'number' || isNaN(estimatedHours) || !isFinite(estimatedHours) || estimatedHours <= 0) {
    console.warn('⚠️ estimateTaskHours: Invalid final hours calculated, using base duration', { 
      estimatedHours, 
      estimatedMinutes,
      effortScore,
      complexityScore,
      priorityMultiplier 
    });
    estimatedHours = BASE_TASK_DURATION_MINUTES / MINUTES_PER_HOUR;
  }
  
  // Only log in development to reduce console noise
  // The estimation process is called frequently during renders and scheduling
  if (import.meta.env.DEV) {
    console.log('🤖 estimateTaskHours: AI Duration Estimation', {
      taskId: task.id,
      taskTitle: task.title,
      taskPriority: task.priority,
      primaryVerb,
      effortScore: effortScore.toFixed(2),
      complexityScore: complexityScore.toFixed(2),
      priorityMultiplier: priorityMultiplier.toFixed(2),
      baseMinutes: BASE_TASK_DURATION_MINUTES,
      effortMultiplier: effortMultiplier.toFixed(2),
      complexityMultiplier: complexityMultiplier.toFixed(2),
      beforeAdjustment: beforeAdjustment.toFixed(2),
      afterAdjustment: estimatedMinutes.toFixed(2),
      finalMinutes: estimatedMinutes,
      finalHours: estimatedHours.toFixed(2),
    });
  }
  
  return estimatedHours;
}

/**
 * Calculate total hours for a specific date from all tasks
 * 
 * NOTE: This function calculates hours for TASKS only (regular and recurring tasks).
 * Calendar events are NOT included in daily hours calculation - they are checked for
 * conflicts in findNextAvailableSlot() but don't count toward the MAX_HOURS_PER_DAY limit.
 * 
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
  // This includes both regular tasks (by direct date match) and recurring tasks (by recurrence pattern)
  const dateTasks = allTasks.filter((task) => {
    if (excludeTaskId && task.id === excludeTaskId) return false;
    if (task.status === 'done') return false; // Exclude completed tasks
    return isDateInRecurrence(task, targetDate);
  });
  
  // Calculate total hours using AI estimator
  // This respects the 5-hour (MAX_HOURS_PER_DAY) requirement for all task types:
  // - Regular tasks: Counted once on their scheduled date
  // - Recurring tasks: Counted on each day they occur (via isDateInRecurrence)
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
 * @param maxHoursPerDay - Maximum hours per day (defaults to MAX_HOURS_PER_DAY constant)
 * @returns Object with wouldExceed (boolean) and currentHours (number)
 */
export function checkDailyLimit(
  date: Date,
  task: Task,
  allTasks: Task[],
  maxHoursPerDay: number = MAX_HOURS_PER_DAY
): { wouldExceed: boolean; currentHours: number; newTotalHours: number } {
  const currentHours = calculateDailyHours(date, allTasks, task.id);
  const taskHours = estimateTaskHours(task);
  const newTotalHours = currentHours + taskHours;
  
  return {
    wouldExceed: newTotalHours >= maxHoursPerDay,
    currentHours,
    newTotalHours,
  };
}

/**
 * Get warning level for daily hours
 * @param currentHours - Current hours scheduled
 * @param taskHours - Hours of task being added
 * @param maxHoursPerDay - Maximum hours per day (defaults to MAX_HOURS_PER_DAY constant)
 * @returns 'none' | 'warning' | 'error'
 */
export function getDailyHoursWarningLevel(
  currentHours: number,
  taskHours: number,
  maxHoursPerDay: number = MAX_HOURS_PER_DAY
): 'none' | 'warning' | 'error' {
  const newTotal = currentHours + taskHours;
  
  if (newTotal >= maxHoursPerDay) {
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
 * 
 * This is the primary function used by AI scheduling functions.
 * It wraps estimateTaskHours() and provides a clean interface.
 * 
 * Used by:
 * - scheduleAllTasks: For scheduling new tasks
 * - generateSchedulePlan: For generating schedule plans
 * - rescheduleDay/Week/Month: For rescheduling tasks
 * - All AI scheduling operations
 * 
 * @param task - The task to get duration for
 * @returns Duration in hours
 */
export function getTaskHours(task: Task): number {
  if (!task) {
    console.warn('⚠️ getTaskHours: No task provided');
    return BASE_TASK_DURATION_MINUTES / MINUTES_PER_HOUR;
  }
  
  return estimateTaskHours(task);
}

/**
 * Get task duration in minutes using AI estimator
 * 
 * This is the shared utility function used across the app
 * to ensure consistent duration calculations.
 * 
 * Used by:
 * - time-conflict.ts: For conflict detection
 * - task-layout.ts: For layout calculations
 * - Display components: For height calculations
 * - All duration-related operations
 * 
 * @param task - The task to get duration for
 * @returns Duration in minutes (rounded)
 */
export function getTaskMinutes(task: Task): number {
  if (!task) {
    console.warn('⚠️ getTaskMinutes: No task provided');
    return BASE_TASK_DURATION_MINUTES;
  }
  
  const hours = estimateTaskHours(task);
  return Math.round(hours * MINUTES_PER_HOUR); // Convert hours to minutes, rounded
}
