/**
 * Timing Constants
 * Centralized timeout and delay values for consistent timing across the application
 */

export const TIMING_CONSTANTS = {
  // Intervals (in milliseconds)
  intervals: {
    timeUpdate: 60000, // 1 minute - Update current time display
    demoActivity: 5 * 60 * 1000, // 5 minutes - Demo user activity tracking
  },
  
  // Delays (in milliseconds)
  delays: {
    scroll: 100, // Scroll to current time delay
    aiScheduler: 100, // AI scheduler processing delay
    taskContext: 1000, // Task context update delay
    splashScreen: [100, 200, 2500], // Splash screen animation delays
    revenueCat: 100, // RevenueCat processing delay
    notificationCheck: 100, // Notification check delay after task update
  },
  
  // Timeouts (in milliseconds)
  timeouts: {
    configuration: 5000, // 5 seconds - Configuration timeout
    purchase: 50000, // 50 seconds - Purchase request timeout
    revenueCat: 45000, // 45 seconds - RevenueCat purchase timeout
  },
  
  // Animation durations (in milliseconds)
  animations: {
    default: 200, // 200ms - Default transition duration
    medium: 300, // 300ms - Medium transition duration
    long: 500, // 500ms - Long transition duration
  },
} as const;

