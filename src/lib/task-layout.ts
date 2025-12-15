import type { Task } from '../types';
import { TASK_CARD_HEIGHT_CONFIG, TASK_CARD_LAYOUT_METRICS } from './task-card-constants';
import { TASK_CALCULATION_CONSTANTS } from './task-calculation-constants';
import { getTaskMinutes } from './daily-hours-utils';
import { MINUTES_PER_HOUR } from './business-constants';

const DEFAULT_DAY_START_MINUTES = TASK_CALCULATION_CONSTANTS.dragDrop.hourMin * MINUTES_PER_HOUR;

export interface TaskLayoutSpacing {
  task: Task;
  marginTop: number;
}

// Helper: Calculate approximate task height based on duration and components
// This matches the logic in DraggableTaskCard for consistency
function estimateTaskHeight(task: Task): number {
  const duration = getDurationMinutes(task);
  const hasDescription = !!task.description;
  const hasAssignedUsers = task.assignedTo && task.assignedTo.length > 0;
  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  
  // Get standard height based on duration
  // Short tasks use 20px increments per 15-minute interval from 15 to 45 mins
  let baseHeight: number;
  if (duration < 30) {
    // 15-29 mins: Base height (72px)
    baseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.short.veryShort; // 72px
  } else if (duration < 35) {
    // 30-34 mins: Base + 1 increment (72px + 20px = 92px)
    baseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.short.veryShort + TASK_CARD_HEIGHT_CONFIG.baseHeights.short.incrementPer15Mins; // 92px
  } else if (duration < 40) {
    // 35-39 mins: Base + 2 increments (72px + 40px = 112px)
    baseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.short.veryShort + (TASK_CARD_HEIGHT_CONFIG.baseHeights.short.incrementPer15Mins * 2); // 112px
  } else if (duration < 45) {
    // 40-44 mins: Base + 3 increments (72px + 60px = 132px)
    baseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.short.veryShort + (TASK_CARD_HEIGHT_CONFIG.baseHeights.short.incrementPer15Mins * 3); // 132px
  } else if (duration < 60) {
    baseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.medium.min; // 120px
  } else {
    // Long tasks: use duration-based heights
    if (duration >= 180) {
      baseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.long.beyond180mins; // 500px
    } else if (duration >= 150) {
      baseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.long.at150mins; // 425px
    } else if (duration >= 120) {
      baseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.long.at120mins; // 350px
    } else if (duration >= 90) {
      baseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.long.at90mins; // 275px
    } else {
      baseHeight = TASK_CARD_HEIGHT_CONFIG.baseHeights.long.at60mins; // 200px
    }
  }
  
  // Add component heights (simplified estimation)
  if (hasDescription) {
    const estimatedLines = task.description ? Math.ceil(task.description.length / 50) : 1;
    baseHeight += Math.max(estimatedLines * 16, 16) + (hasAssignedUsers && !hasSubtasks ? 0 : 6);
  }
  if (hasAssignedUsers && duration >= 45) {
    // For medium/long tasks, assigned users are absolutely positioned, so they don't add height
    // Only add spacing if description is present
    if (hasDescription && !hasSubtasks) {
      baseHeight += 20 + 16; // base + reduced spacing
    } else if (!hasDescription) {
      baseHeight += 20 + 20; // base + standard spacing
    }
  }
  if (hasSubtasks) {
    const subtaskCount = Math.min(task.subtasks.length, 3);
    baseHeight += subtaskCount * 14 + (subtaskCount > 1 ? (subtaskCount - 1) * 4 : 0) + (hasDescription ? 6 : 0);
  }
  
  // Enforce max height
  return Math.min(baseHeight, TASK_CARD_HEIGHT_CONFIG.maxHeight);
}

export function buildTaskLayouts(tasks: Task[], minGapOverride?: number, useTimeBasedSpacing: boolean = false): TaskLayoutSpacing[] {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return [];
  }

  const pixelsPerMinute = TASK_CARD_LAYOUT_METRICS.pixelsPerMinute;
  const minGapPx = typeof minGapOverride === 'number' ? minGapOverride : TASK_CARD_LAYOUT_METRICS.minGapPx;

  // Sort tasks by scheduled time to ensure proper ordering
  const sortedTasks = [...tasks].sort((a, b) => {
    const timeA = getStartMinutes(a);
    const timeB = getStartMinutes(b);
    // Tasks with times come first, sorted by time
    if (timeA !== null && timeB !== null) {
      return timeA - timeB;
    }
    if (timeA !== null) return -1;
    if (timeB !== null) return 1;
    // Both have no time, maintain original order
    return 0;
  });

  // If not using time-based spacing, just stack tasks with minimum gap
  if (!useTimeBasedSpacing) {
    return sortedTasks.map((task, index) => ({
      task,
      marginTop: index === 0 ? 0 : minGapPx,
    }));
  }

  // Time-based spacing (for timeline view)
  const firstStartMinutes = getStartMinutes(sortedTasks[0]);
  let previousEndMinutes = firstStartMinutes ?? DEFAULT_DAY_START_MINUTES;

  return sortedTasks.map((task, index) => {
    const startMinutes = getStartMinutes(task);
    const duration = getDurationMinutes(task);

    let marginTop = 0;

    if (index === 0) {
      // First task: no margin, but update previousEndMinutes to include duration for next task calculation
      marginTop = 0;
      if (startMinutes !== null) {
        previousEndMinutes = startMinutes + duration; // Set to end time of first task
      } else {
        // Task without scheduled time: estimate end time based on duration
        previousEndMinutes += duration;
      }
    } else {
      if (startMinutes !== null) {
        // Calculate gap based on time difference between tasks
        const gapMinutes = startMinutes - previousEndMinutes;
        
        if (gapMinutes > 0) {
          // There's a time gap: use fixed spacing (respects minGapPx override)
          // Always use minGapPx to ensure consistent spacing regardless of time difference
          marginTop = minGapPx;
        } else {
          // Tasks overlap or are at same time: use minimum gap (respects minGapPx override)
          marginTop = minGapPx;
        }
        
        // Update previous end time to the end of this task
        previousEndMinutes = startMinutes + duration;
      } else {
        // Task without scheduled time: stack with minimum gap
        marginTop = minGapPx;
        // Estimate end time based on previous task end + duration
        previousEndMinutes += duration;
      }
    }

    return {
      task,
      marginTop,
    };
  });
}

function getStartMinutes(task: Task): number | null {
  if (!task || !task.scheduledDate) return null;
  const date = new Date(task.scheduledDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours() * MINUTES_PER_HOUR + date.getMinutes();
}

function getDurationMinutes(task: Task): number {
  // Use AI Duration Estimator instead of hardcoded fallback
  // This ensures consistent duration calculation across the app
  return getTaskMinutes(task);
}

