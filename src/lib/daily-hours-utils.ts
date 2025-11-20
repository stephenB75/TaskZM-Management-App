import type { Task } from '../types';
import { isDateInRecurrence } from './recurrence';

const MAX_HOURS_PER_DAY = 5;

/**
 * Estimate task duration in hours
 * Uses the same logic as useAIScheduler for consistency
 */
function estimateTaskHours(task: Task): number {
  // Priority 1: If estimated time is explicitly set by user, use it directly
  if (task.estimatedTime && task.estimatedTime > 0) {
    return task.estimatedTime / 60; // Convert minutes to hours
  }
  
  // Priority 2: Intelligent estimation based on task properties
  // Starting with 30 minutes as base
  let estimatedMinutes = 30;
  
  // Factor 1: Priority-based time adjustment
  const priorityMultiplier = {
    urgent: 0.7,   // 30 * 0.7 = 21 minutes base
    high: 1.0,      // 30 minutes base
    medium: 1.5,   // 45 minutes base
    low: 2.0       // 60 minutes base
  };
  estimatedMinutes *= priorityMultiplier[task.priority] || 1.0;
  
  // Factor 2: Description length
  if (task.description) {
    const descLength = task.description.length;
    if (descLength > 500) {
      estimatedMinutes *= 1.8;
    } else if (descLength > 200) {
      estimatedMinutes *= 1.4;
    } else if (descLength > 50) {
      estimatedMinutes *= 1.2;
    }
  }
  
  // Factor 3: Subtasks
  if (task.subtasks && task.subtasks.length > 0) {
    estimatedMinutes += task.subtasks.length * 15;
  }
  
  // Factor 4: Title keywords analysis
  const titleLower = task.title.toLowerCase();
  const titleWords = titleLower.split(/\s+/);
  
  if (titleWords.some(word => ['meeting', 'call', 'conference', 'standup', 'sync'].includes(word))) {
    estimatedMinutes = Math.max(estimatedMinutes, 30);
    estimatedMinutes = Math.min(estimatedMinutes, 90);
  } else if (titleWords.some(word => ['review', 'check', 'verify', 'audit'].includes(word))) {
    estimatedMinutes = Math.max(estimatedMinutes, 15);
    estimatedMinutes = Math.min(estimatedMinutes, 45);
  } else if (titleWords.some(word => ['plan', 'design', 'architecture', 'strategy', 'research'].includes(word))) {
    estimatedMinutes = Math.max(estimatedMinutes, 60);
    estimatedMinutes = Math.min(estimatedMinutes, 180);
  } else if (titleWords.some(word => ['write', 'draft', 'create', 'document', 'blog'].includes(word))) {
    estimatedMinutes = Math.max(estimatedMinutes, 45);
    estimatedMinutes = Math.min(estimatedMinutes, 120);
  } else if (titleWords.some(word => ['code', 'develop', 'implement', 'build', 'fix', 'debug'].includes(word))) {
    estimatedMinutes = Math.max(estimatedMinutes, 60);
    estimatedMinutes = Math.min(estimatedMinutes, 240);
  } else if (titleWords.some(word => ['project', 'feature', 'module', 'system'].includes(word))) {
    estimatedMinutes = Math.max(estimatedMinutes, 120);
    estimatedMinutes = Math.min(estimatedMinutes, 300);
  }
  
  // Factor 5: Status-based adjustment
  if (task.status === 'in-progress') {
    estimatedMinutes *= 0.6;
  }
  
  // Factor 6: Dependencies
  if (task.dependencies && task.dependencies.length > 0) {
    estimatedMinutes *= 1.2;
  }
  
  // Factor 7: Tags-based adjustment
  if (task.tags && task.tags.length > 0) {
    const tagLower = task.tags.map(t => t.toLowerCase());
    if (tagLower.some(t => ['quick', 'simple', 'easy', 'small'].includes(t))) {
      estimatedMinutes *= 0.6;
    } else if (tagLower.some(t => ['complex', 'difficult', 'large', 'major'].includes(t))) {
      estimatedMinutes *= 2.0;
    }
  }
  
  // Clamp between 15 minutes (minimum) and 300 minutes (5 hours maximum)
  estimatedMinutes = Math.max(15, Math.min(300, estimatedMinutes));
  
  // Round to nearest 15 minutes
  estimatedMinutes = Math.round(estimatedMinutes / 15) * 15;
  
  return estimatedMinutes / 60; // Convert to hours
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

