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

/**
 * Default domain for tasks when domain cannot be detected
 */
export const DEFAULT_TASK_DOMAIN = 'personal' as const;

/**
 * Default createdBy value for local tasks
 */
export const DEFAULT_CREATED_BY = 'local' as const;

/**
 * Placeholder task ID used only for in-memory analysis (e.g. useTaskBreakdown)
 */
export const TEMP_TASK_ID = 'temp';

