/**
 * Business Logic Constants
 * Centralized constants for business rules, defaults, and domain-specific values
 */

// Task Management Constants
export const DEFAULT_PROJECT_ID = 'default';
export const DEFAULT_PROJECT_NAME = 'Personal';
export const DEFAULT_PROJECT_DESCRIPTION = 'Personal tasks';

// Default Tags
export const DEFAULT_TAGS = ['Work', 'Personal', 'Projects', 'Business'];
export const PROTECTED_TAGS = ['Work', 'Personal', 'Projects', 'Business']; // Tags that cannot be deleted
export const RESERVED_TAG_URGENT = 'urgent'; // Reserved tag that cannot be added manually

// Pomodoro Timer Constants (in seconds)
export const POMODORO_WORK_DURATION = 25 * 60; // 25 minutes
export const POMODORO_SHORT_BREAK_DURATION = 5 * 60; // 5 minutes
export const POMODORO_LONG_BREAK_DURATION = 15 * 60; // 15 minutes

// Default Hours Settings
export const DEFAULT_WEEKDAY_WORK_START = '09:00';
export const DEFAULT_WEEKDAY_WORK_END = '17:00';
export const DEFAULT_WEEKDAY_PERSONAL_START = '18:00';
export const DEFAULT_WEEKDAY_PERSONAL_END = '22:00';
export const DEFAULT_WEEKDAY_PROJECTS_START = '19:00';
export const DEFAULT_WEEKDAY_PROJECTS_END = '23:00';

export const DEFAULT_WEEKEND_WORK_START = '10:00';
export const DEFAULT_WEEKEND_WORK_END = '14:00';
export const DEFAULT_WEEKEND_PERSONAL_START = '09:00';
export const DEFAULT_WEEKEND_PERSONAL_END = '23:00';
export const DEFAULT_WEEKEND_PROJECTS_START = '14:00';
export const DEFAULT_WEEKEND_PROJECTS_END = '18:00';

// Notification Settings Defaults
export const DEFAULT_NOTIFICATION_REMINDER_TIME = 60; // Minutes before due date
export const DEFAULT_NOTIFICATION_CHECK_INTERVAL = 15; // Minutes between checks

// Time Conversion Constants (must be defined first as they're used by other constants)
export const MINUTES_PER_HOUR = 60;
export const SECONDS_PER_MINUTE = 60;
export const HOURS_PER_DAY = 24;
export const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR; // 60 seconds * 60 minutes
export const SECONDS_PER_DAY = SECONDS_PER_HOUR * HOURS_PER_DAY; // 24 hours * 60 minutes * 60 seconds
export const MILLISECONDS_PER_SECOND = 1000;
export const MILLISECONDS_PER_MINUTE = SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND; // 60 seconds * 1000 ms
export const MILLISECONDS_PER_HOUR = SECONDS_PER_HOUR * MILLISECONDS_PER_SECOND; // 60 minutes * 60 seconds * 1000 ms
export const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR; // 24 hours * 60 minutes
export const MILLISECONDS_PER_DAY = HOURS_PER_DAY * MILLISECONDS_PER_HOUR; // 24 hours * 60 minutes * 60 seconds * 1000 ms

// Percentage and Calculation Constants
export const PERCENTAGE_MULTIPLIER = 100; // For converting decimals to percentages

// Sync and Interval Constants (in milliseconds)
export const SYNC_INTERVAL_30_SECONDS = 30 * MILLISECONDS_PER_SECOND; // 30 seconds in milliseconds

// Workspace sync interval multipliers
export const WORKSPACE_SYNC_ACTIVE_MULTIPLIER = 2; // Sync other resources every 2 intervals when active
export const WORKSPACE_SYNC_IDLE_MULTIPLIER = 3; // Sync other resources every 3 intervals when idle

// Task Duration Thresholds
export const TASK_DURATION_SHORT_THRESHOLD = 45; // Minutes - tasks under this are considered "short"
export const TASK_DURATION_MEDIUM_THRESHOLD = 120; // Minutes - tasks under this are considered "medium"
export const TASK_DURATION_LONG_THRESHOLD = 240; // Minutes - tasks under this are considered "long"

// AI Scheduler Constants
export const AI_SCHEDULER_TIME_SLOT_INTERVAL = 15; // Minutes - time slots are 15 minutes apart
export const AI_SCHEDULER_MIN_START_HOUR = 6; // Earliest hour to schedule tasks (6 AM)
export const AI_SCHEDULER_MAX_END_HOUR = 23; // Latest hour to schedule tasks (11 PM)

// Recurrence occurrence ID patterns (used in TaskDialog, TaskContext, utils, etc.)
/** Separator in occurrence subtask id: baseId + this + YYYY-MM-DD. */
export const RECURRENCE_OCCURRENCE_ID_SUFFIX_SUBTASKS = '_subtasks_';
/** Separator in completed occurrence id: baseId + this + YYYY-MM-DD. */
export const RECURRENCE_OCCURRENCE_ID_SUFFIX_COMPLETED = '_completed_';
/** Default recurrence config when no recurrence (single occurrence or cleared). */
export const RECURRENCE_NONE_CONFIG = { type: 'none' as const, interval: 1 };
/** Separator for task series occurrence ids: baseId + this + YYYY-MM-DD (each occurrence is a full task). */
export const RECURRENCE_SERIES_OCCURRENCE_SEPARATOR = '__';

// Date/Time Constants
/** Suffix for parsing date-only strings (YYYY-MM-DD) to a Date at noon, avoiding UTC-midnight timezone shifts. */
export const DATE_ONLY_PARSE_SUFFIX = 'T12:00:00';
export const END_OF_DAY_HOUR = 23;
export const END_OF_DAY_MINUTE = 59;
export const END_OF_DAY_SECOND = 59;
export const END_OF_DAY_MILLISECOND = 999;

// Day Offset Constants
export const DAYS_IN_WEEK = 7;
export const TWO_WEEKS_DAYS = 14; // 2 weeks = 14 days
export const LAST_7_DAYS_OFFSET = 6; // For calculating last 7 days (0-6)
export const DAYS_IN_MONTH_APPROX = 30; // Approximate days in a month for scheduling

// Time Period Definitions (for analytics)
export const TIME_PERIODS = {
  MORNING_START: 6, // 6 AM
  MORNING_END: 12, // 12 PM (noon)
  AFTERNOON_START: 12, // 12 PM (noon)
  AFTERNOON_END: 18, // 6 PM
  EVENING_START: 18, // 6 PM
  EVENING_END: 22, // 10 PM
  NIGHT_START: 22, // 10 PM
  NIGHT_END: 24, // 12 AM (midnight)
  DAY_START: 0, // 12 AM (midnight)
  DAY_END: 6, // 6 AM
} as const;

// Award System Constants
export const AWARD_COMPLETION_THRESHOLDS = {
  FIRST: 1,
  BEGINNER: 10,
  WARRIOR: 25,
  CHAMPION: 50,
  CENTURY: 100,
  ELITE: 250,
  LEGENDARY: 500,
};

export const AWARD_STREAK_THRESHOLDS = {
  MOMENTUM: 3,
  WEEK: 7,
  FORTNIGHT: 14,
  MONTH: 30,
  QUARTER: 90,
  YEAR: 365,
};

// Storage Keys
export const STORAGE_KEY_POMODORO = 'pomodoro-timers';
export const STORAGE_KEY_NOTIFICATION_SETTINGS = 'notificationSettings';

