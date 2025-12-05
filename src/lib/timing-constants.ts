/**
 * Timing Constants
 * Centralized timeout and delay values for consistent timing across the application
 */

export const TIMING_CONSTANTS = {
  // Intervals (in milliseconds)
  intervals: {
    timeUpdate: 60000, // 1 minute - Update current time display
    demoActivity: 5 * 60 * 1000, // 5 minutes - Demo user activity tracking
    pomodoro: 1000, // 1 second - Pomodoro timer interval
    activityCheck: 60000, // 1 minute - Activity checking interval
    notificationCheck: 60000, // 1 minute - Notification check interval (multiplied by settings.checkInterval)
  },
  
  // Delays (in milliseconds)
  delays: {
    scroll: 100, // Scroll to current time delay
    aiScheduler: 100, // AI scheduler processing delay
    taskContext: 1000, // Task context update delay
    splashScreen: [100, 200, 2500], // Splash screen animation delays
    revenueCat: 100, // RevenueCat processing delay
    notificationCheck: 100, // Notification check delay after task update
    throttle: 1000, // Throttle delay for activity tracking
    calendarPopup: 100, // Calendar popup delay
    calendarCheck: 1000, // Calendar check interval delay
  },
  
  // Timeouts (in milliseconds)
  timeouts: {
    configuration: 5000, // 5 seconds - Configuration timeout
    purchase: 50000, // 50 seconds - Purchase request timeout
    revenueCat: 45000, // 45 seconds - RevenueCat purchase timeout
    notification: 5000, // 5 seconds - Notification timeout (for closing)
    notificationDueNow: 15000, // 15 seconds - Due now notification timeout
  },
  
  // Animation durations (in milliseconds)
  animations: {
    default: 200, // 200ms - Default transition duration
    medium: 300, // 300ms - Medium transition duration
    long: 500, // 500ms - Long transition duration
  },
  
  // Time conversion constants (in milliseconds)
  timeConversions: {
    secondsToMs: 1000, // 1 second = 1000ms
    minutesToMs: 60000, // 1 minute = 60000ms
    hoursToMs: 3600000, // 1 hour = 3600000ms
    daysToMs: 86400000, // 1 day = 86400000ms
    weeksToMs: 604800000, // 1 week = 7 days = 604800000ms
    minutesToSeconds: 60, // 1 minute = 60 seconds
    hoursToMinutes: 60, // 1 hour = 60 minutes
  },
  
  // Calendar constants
  calendar: {
    daysPerWeek: 7, // Number of days in a week
    monthsPerYear: 12, // Number of months in a year
    minDayOfWeek: 0, // Sunday (0) - minimum day of week index
    maxDayOfWeek: 6, // Saturday (6) - maximum day of week index
    minDayOfMonth: 1, // First day of month
    maxDayOfMonth: 31, // Last day of month (maximum)
    minRecurrenceInterval: 1, // Minimum recurrence interval
    maxRecurrenceInterval: 365, // Maximum recurrence interval (1 year)
  },
  
  // Recurrence-specific delays
  recurrence: {
    nextOccurrenceLockTimeout: 2000, // 2 seconds - Lock timeout to prevent duplicate next occurrence creation
  },
} as const;

