/**
 * AI Scheduler Configuration
 * Centralized configuration for AI scheduling behavior
 * These values can be made user-configurable in the future
 */

import {
  DEFAULT_WEEKDAY_WORK_START,
  DEFAULT_WEEKDAY_WORK_END,
  DEFAULT_WEEKDAY_PERSONAL_START,
  DEFAULT_WEEKDAY_PERSONAL_END,
  DEFAULT_WEEKDAY_PROJECTS_START,
  DEFAULT_WEEKDAY_PROJECTS_END,
  DEFAULT_WEEKEND_WORK_START,
  DEFAULT_WEEKEND_WORK_END,
  DEFAULT_WEEKEND_PERSONAL_START,
  DEFAULT_WEEKEND_PERSONAL_END,
  DEFAULT_WEEKEND_PROJECTS_START,
  DEFAULT_WEEKEND_PROJECTS_END,
} from './business-constants';

// Helper to parse time string to hour
const parseTimeToHour = (timeStr: string): number => {
  const [hours] = timeStr.split(':').map(Number);
  return hours;
};

// ============================================================================
// Daily Hours Configuration
// ============================================================================

/**
 * Maximum hours per day for task scheduling
 * Default: 5 hours
 * TODO: Make this user-configurable through settings
 */
export const MAX_HOURS_PER_DAY = 5;

/**
 * Minimum hours requirement per day
 * Default: 5 hours (same as max for efficient packing)
 * TODO: Make this user-configurable
 */
export const MIN_HOURS_PER_DAY = 5;

/**
 * Warning threshold for daily hours
 * Shows warning when hours reach this threshold
 * Default: 4 hours
 */
export const DAILY_HOURS_WARNING_THRESHOLD = 4;

// ============================================================================
// Date Range Configuration
// ============================================================================

/**
 * Default scheduling period in days
 * Default: 14 days (two weeks)
 * TODO: Make this user-configurable
 */
export const DEFAULT_SCHEDULING_PERIOD_DAYS = 14;

/**
 * Default rescheduling period for week view
 * Default: 7 days
 */
export const DEFAULT_WEEK_RESCHEDULE_DAYS = 7;

/**
 * Days to add for two-week period calculation
 * (tomorrow + 13 days = 14 days total)
 */
export const TWO_WEEK_DAYS_OFFSET = 13;

/**
 * Days to add for one week period calculation
 * (start date + 6 days = 7 days total)
 */
export const ONE_WEEK_DAYS_OFFSET = 6;

// ============================================================================
// Time Configuration
// ============================================================================

/**
 * Time rounding interval in minutes
 * All times are rounded to the nearest interval
 * Default: 15 minutes
 * TODO: Make this user-configurable
 */
export const TIME_ROUNDING_INTERVAL_MINUTES = 15;

/**
 * Default time slots for task distribution
 * Used when distributing tasks across available time windows
 * Default: 5 slots
 */
export const DEFAULT_TIME_SLOTS = 5;

// ============================================================================
// Priority-Based Time Slots
// ============================================================================

/**
 * Default time slots based on task priority
 * These are fallback times when category hours are not available
 * Uses default work hours from business-constants.ts
 */
export const PRIORITY_TIME_SLOTS = {
  urgent: { hour: parseTimeToHour(DEFAULT_WEEKDAY_WORK_START), minute: 0 },   // Work start time
  high: { hour: 11, minute: 0 },     // 11:00 AM (mid-day) - between work start and end
  medium: { hour: 11, minute: 0 },    // 11:00 AM (mid-day) - between work start and end
  low: { hour: 14, minute: 0 },     // 2:00 PM (afternoon) - between work start and end
} as const;

/**
 * Default hours for category-based scheduling when category hours are disabled
 * Uses default category hours from business-constants.ts
 */
export const DEFAULT_CATEGORY_HOURS = {
  work: parseTimeToHour(DEFAULT_WEEKDAY_WORK_START),        // Work start hour
  personal: parseTimeToHour(DEFAULT_WEEKDAY_PERSONAL_START),   // Personal start hour
  projects: parseTimeToHour(DEFAULT_WEEKDAY_PROJECTS_START),    // Projects start hour
} as const;

// ============================================================================
// Priority Weights (for sorting)
// ============================================================================

/**
 * Priority weights for task sorting
 * Higher weight = higher priority in scheduling
 */
export const PRIORITY_WEIGHTS = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
} as const;

/**
 * Status weights for task sorting
 * Higher weight = higher priority in scheduling
 */
export const STATUS_WEIGHTS = {
  'on-hold': 1,
  todo: 2,
  'in-progress': 3,
  done: 0,
} as const;

// ============================================================================
// Duration Estimation Configuration
// ============================================================================

/**
 * Base task duration in minutes
 * Used in duration estimation formula
 * Default: 30 minutes
 */
export const BASE_TASK_DURATION_MINUTES = 30;

/**
 * Minimum task duration in minutes
 * Default: 15 minutes
 */
export const MIN_TASK_DURATION_MINUTES = 15;

/**
 * Maximum task duration in minutes
 * Default: 300 minutes (5 hours)
 */
export const MAX_TASK_DURATION_MINUTES = 300;

/**
 * Effort score normalization divisor
 * Used to normalize effort scores (1-5 scale)
 * Default: 2.5 (middle of 1-5 scale)
 */
export const EFFORT_NORMALIZATION_DIVISOR = 2.5;

/**
 * Complexity score normalization divisor
 * Used to normalize complexity scores (1-5 scale)
 * Default: 2.5 (middle of 1-5 scale)
 */
export const COMPLEXITY_NORMALIZATION_DIVISOR = 2.5;

/**
 * Priority multipliers for duration estimation
 * Applied to base duration based on task priority
 */
export const PRIORITY_MULTIPLIERS = {
  urgent: 0.7,
  high: 1.0,
  medium: 1.5,
  low: 2.0,
} as const;

// ============================================================================
// Category Tags Configuration
// ============================================================================

/**
 * Category tag names used for task categorization
 * TODO: These should be dynamic based on user's actual tags
 */
export const CATEGORY_TAGS = {
  work: ['work'],
  personal: ['personal'],
  projects: ['projects', 'project'],
} as const;

// ============================================================================
// Weekend Configuration
// ============================================================================

/**
 * Weekend day indices (JavaScript Date.getDay() values)
 * Sunday = 0, Saturday = 6
 */
export const WEEKEND_DAYS = {
  sunday: 0,
  saturday: 6,
} as const;

// ============================================================================
// AI Usage Limits
// ============================================================================

/**
 * Weekly limit for AI scheduler usage (free tier)
 * Default: 3 suggestions per week
 * TODO: This should come from subscription tier configuration
 */
export const FREE_TIER_WEEKLY_AI_LIMIT = 3;

/**
 * LocalStorage key for AI scheduler usage tracking
 */
export const AI_USAGE_STORAGE_KEY = 'ai_scheduler_usage';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a date is a weekend
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === WEEKEND_DAYS.sunday || day === WEEKEND_DAYS.saturday;
}

/**
 * Get category from task tags
 */
export function getCategoryFromTags(tags: string[]): 'work' | 'personal' | 'projects' | null {
  if (!tags || tags.length === 0) return null;
  
  const tagLower = tags.map(t => t.toLowerCase());
  
  if (CATEGORY_TAGS.work.some(tag => tagLower.includes(tag))) return 'work';
  if (CATEGORY_TAGS.personal.some(tag => tagLower.includes(tag))) return 'personal';
  if (CATEGORY_TAGS.projects.some(tag => tagLower.includes(tag))) return 'projects';
  
  return null;
}

