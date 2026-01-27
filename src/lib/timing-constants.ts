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
    badgeUpdateFallback: 100, // Fallback delay for badge updates when requestIdleCallback is not available
    splashScreen: [100, 200, 800], // Splash screen animation delays (optimized for faster loading)
    splashScreenFallback: 2000, // Fallback delay to hide splash screen (increased to ensure app loads)
    splashScreenFinal: 4000, // Final fallback delay to hide splash screen (increased to ensure full render)
    splashScreenAggressive: 6000, // Aggressive fallback to force hide splash (increased to ensure app is fully loaded)
    splashScreenRemoval: 500, // Delay before removing splash element from DOM
    splashScreenImmediate: 100, // Immediate fallback delay for splash hiding
    splashScreenMinDisplay: 2000, // Minimum time splash screen should be visible (increased to ensure app loads)
    splashScreenPostReadyDelay: 800, // Delay after app-ready event before hiding (increased to ensure React has fully rendered and initialized)
    splashScreenPollInterval: 150, // Interval for polling if app is fully loaded (ms) - increased for better reliability
    splashScreenMinContentLength: 500, // Minimum innerHTML length (chars) to consider React content rendered (increased for more reliable detection)
    splashScreenMaxChecks: 100, // Maximum number of readiness checks (100 * 150ms = 15 seconds)
    splashScreenTimeout: 10000, // Timeout fallback for app readiness check (10 seconds)
    splashScreenMinInteractiveElements: 3, // Minimum number of interactive elements required for app to be considered ready
    splashScreenReactInitDelay: 300, // Extra delay for React initialization after readiness check passes (ms)
    splashScreenCheckDelay: 200, // Delay before starting readiness check to ensure React has rendered (ms)
    splashScreenKanbanAnimationDelay: 600, // Additional delay to account for kanban view animations (duration 0.4s + delay 0.2s = 600ms)
    splashScreenMinKanbanColumns: 3, // Minimum number of kanban columns required to consider kanban view ready
    revenueCat: 100, // RevenueCat processing delay
    notificationCheck: 100, // Notification check delay after task update
    throttle: 1000, // Throttle delay for activity tracking
    calendarPopup: 100, // Calendar popup delay
    calendarCheck: 1000, // Calendar check interval delay
    rolloverCheck: 3000, // Rollover check delay to allow UI to load
    nextUpScrollReset: 5000, // Reset scroll tracking after 5 seconds of inactivity to allow next up to work again
    programmaticScrollComplete: 600, // Timeout for programmatic scroll completion (smooth scroll ~500ms + buffer)
    scrollDetectionDebounce: 50, // Debounce delay for detecting user-initiated scroll vs programmatic scroll
    calendarEventsDebounce: 200, // Debounce delay for calendar events fetch (faster for today view)
  },
  
  // Timeouts (in milliseconds)
  timeouts: {
    configuration: 5000, // 5 seconds - Configuration timeout
    purchase: 50000, // 50 seconds - Purchase request timeout
    revenueCat: 45000, // 45 seconds - RevenueCat purchase timeout
    notification: 5000, // 5 seconds - Notification timeout (for closing)
    notificationDueNow: 15000, // 15 seconds - Due now notification timeout
    idleCallback: 1000, // 1 second - requestIdleCallback timeout for background operations
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
    maxOccurrences: 365, // Maximum number of occurrences to pre-create for a recurring task
    syncInterval: 5 * 60 * 1000, // 5 minutes - Calendar sync interval
    minAutoSyncInterval: 2 * 60 * 1000, // 2 minutes - Minimum time between auto syncs
    cacheDuration: 5 * 60 * 1000, // 5 minutes - Calendar status cache duration
    popupCheckInterval: 500, // 500ms - OAuth popup check interval
    popupWidth: 600, // 600px - OAuth popup width
    popupHeight: 700, // 700px - OAuth popup height
  },
  
  // Recurrence-specific delays
  recurrence: {
    nextOccurrenceLockTimeout: 2000, // 2 seconds - Lock timeout to prevent duplicate next occurrence creation
  },
  
  // Error Boundary constants
  errorBoundary: {
    reloadCooldown: 30000, // 30 seconds - Cooldown between reload attempts to prevent reload loops
    maxReloadsPerSession: 2, // Maximum automatic reloads per session
    reloadDelay: 3000, // 3 seconds - Delay before attempting automatic reload (gives user time to see error)
  },
  
  // Tour-specific delays and timeouts
  tour: {
    navigationComplete: 300, // ms - Wait for navigation to complete before opening panels
    navigationReset: 500, // ms - Delay before resetting navigation flag
    highlightDelay: 600, // ms - Wait for navigation and panel opening before highlighting
    initializationReset: 100, // ms - Short delay for initialization reset
    pricingDialogDelay: 300, // ms - Delay before showing pricing dialog after tour
    animation: {
      delay: 0.2, // seconds - Default animation delay for illustrations
      duration: 0.8, // seconds - Default animation duration for illustrations
      springDamping: 25, // Spring animation damping value
      springStiffness: 200, // Spring animation stiffness value
    },
  },
  
  // Service Worker update checking
  serviceWorker: {
    updateCheckInterval: 4 * 60 * 60 * 1000, // 4 hours - Check for updates in background (increased to prevent random refreshes)
    notificationCooldown: 30 * 60 * 1000, // 30 minutes - Don't show notification again within this time (increased to prevent spam)
    notificationDuration: 15000, // 15 seconds - How long to show update notification
    visibilityCheckInterval: 5 * 60 * 1000, // 5 minutes - Minimum time between visibility-based update checks (not used - kept for reference)
    initialUpdateCheckDelay: 60 * 1000, // 60 seconds - Delay for initial update check to ensure page is fully loaded (increased to prevent early checks)
    minHiddenTime: 5 * 60 * 1000, // 5 minutes - Page must be hidden for this long before checking for updates (prevents checks during brief tab switches)
  },
  
  // Task sync constants
    taskSync: {
      errorToastCooldown: 5000, // 5 seconds - Don't show same error within cooldown period
      debounceInterval: 2000, // 2 seconds - Only sync once per interval from events
      serverProcessDelay: 1000, // 1 second - Delay to allow server to process
      networkErrorLogCooldown: 60000, // 1 minute - Don't log network errors more than once per minute
      uiUpdateDelay: 500, // 500ms - Delay for UI updates after server operations
      intervalUpdateCheck: 1000, // 1 second - Interval for checking if sync interval has changed
    },
    
    // State update logging delay (for development debugging)
    STATE_UPDATE_LOG_DELAY: 100, // 100ms - Delay before logging state updates
  
  // Drag and drop constants
  dragDrop: {
    timeDifferenceThreshold: 15 * 60 * 1000, // 15 minutes - Threshold for showing time difference dialog
    toastDuration: 5000, // 5 seconds - Duration for toast notifications
  },
  
  // Demo account constants
  demo: {
    cleanupTimeoutMinutes: 15, // 15 minutes - Demo accounts are cleaned up after this inactivity period
    cleanupTimeoutMs: 15 * 60 * 1000, // 15 minutes in milliseconds - Demo account cleanup timeout
    activityTrackingInterval: 5 * 60 * 1000, // 5 minutes - How often to track demo user activity
  },
} as const;

