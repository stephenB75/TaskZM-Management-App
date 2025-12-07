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

// Task Duration Thresholds
export const TASK_DURATION_SHORT_THRESHOLD = 45; // Minutes - tasks under this are considered "short"
export const TASK_DURATION_MEDIUM_THRESHOLD = 120; // Minutes - tasks under this are considered "medium"
export const TASK_DURATION_LONG_THRESHOLD = 240; // Minutes - tasks under this are considered "long"

// AI Scheduler Constants
export const AI_SCHEDULER_TIME_SLOT_INTERVAL = 15; // Minutes - time slots are 15 minutes apart
export const AI_SCHEDULER_MIN_START_HOUR = 6; // Earliest hour to schedule tasks (6 AM)
export const AI_SCHEDULER_MAX_END_HOUR = 23; // Latest hour to schedule tasks (11 PM)

// Time Conversion Constants
export const MINUTES_PER_HOUR = 60;
export const SECONDS_PER_MINUTE = 60;
export const MILLISECONDS_PER_SECOND = 1000;
export const MILLISECONDS_PER_MINUTE = 60 * 1000; // 60 seconds * 1000 ms
export const MILLISECONDS_PER_HOUR = 60 * 60 * 1000; // 60 minutes * 60 seconds * 1000 ms
export const HOURS_PER_DAY = 24;
export const MINUTES_PER_DAY = 24 * 60; // 24 hours * 60 minutes
export const MILLISECONDS_PER_DAY = HOURS_PER_DAY * MILLISECONDS_PER_HOUR; // 24 hours * 60 minutes * 60 seconds * 1000 ms

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

