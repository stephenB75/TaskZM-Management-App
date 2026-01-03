/**
 * Task Constants
 * 
 * Centralized constants for task-related defaults and common values
 */

import type { TaskStatus } from '../types';

/**
 * Default task status
 */
export const DEFAULT_TASK_STATUS: TaskStatus = 'todo';

/**
 * Default task priority
 */
export const DEFAULT_TASK_PRIORITY = 'medium' as const;

