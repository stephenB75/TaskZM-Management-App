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
 * Daily hour limit options for AI scheduling
 */
export const AI_DAILY_HOUR_OPTIONS = {
  FIVE_HOURS: 5,
  EIGHT_HOURS: 8,
  TEN_HOURS: 10,
} as const;

/**
 * Daily hour option labels and descriptions for UI display
 */
export const AI_DAILY_HOUR_LABELS = {
  [AI_DAILY_HOUR_OPTIONS.FIVE_HOURS]: {
    label: '5 Hours',
    description: 'Standard work day limit',
  },
  [AI_DAILY_HOUR_OPTIONS.EIGHT_HOURS]: {
    label: '8 Hours',
    description: 'Full work day limit',
  },
  [AI_DAILY_HOUR_OPTIONS.TEN_HOURS]: {
    label: '10 Hours',
    description: 'Extended work day limit',
  },
} as const;

/**
 * Maximum hours per day for task scheduling
 * Default: 5 hours
 * This is now user-configurable through settings (5HR/8HR/10HR)
 */
export const MAX_HOURS_PER_DAY = AI_DAILY_HOUR_OPTIONS.FIVE_HOURS; // Default fallback

/**
 * DuckDuckGo Search Configuration
 */
export const DUCKDUCKGO_CONFIG = {
  instantAnswerApiUrl: 'https://api.duckduckgo.com/',
  timeout: 5000, // 5 seconds timeout for search requests
  maxResults: 5, // Maximum number of search results to process
  minConfidenceForSearch: 0.5, // Minimum confidence to use search results
  highConfidenceThreshold: 0.7, // Confidence threshold for high-quality search results (used in UI to indicate source)
  cacheEnabled: true, // Enable caching for search results
  cacheExpiryHours: 24 * 7, // Cache expires after 7 days
  maxCacheSize: 1000, // Maximum number of cached search results
} as const;

/**
 * Description Generation Configuration
 */
export const DESCRIPTION_GENERATION_CONFIG = {
  maxContextLength: 500, // Maximum characters from search results to use
  minSearchResults: 1, // Minimum search results needed to use search-based description
  searchTimeout: 5000, // Timeout for DuckDuckGo search (ms)
  // Context processing thresholds
  minContextLength: 50, // Minimum context length to use in description
  minSentenceLength: 20, // Minimum sentence length to extract
  maxSentenceLength: 150, // Maximum sentence length to extract
  // Query processing
  minWordLength: 2, // Minimum word length to consider in task name
  maxQueriesPerSearch: 5, // Maximum number of queries to search in parallel
  resultsMultiplier: 2, // Multiplier for max results when combining multiple queries
  // Extraction limits
  maxTopKeywords: 2, // Maximum top keywords to use in queries
  maxTopPhrases: 2, // Maximum top phrases to use in queries
  maxTopVerbs: 2, // Maximum top verbs to use in queries
  maxTopNouns: 2, // Maximum top nouns to use in queries
  maxExtractedKeywords: 5, // Maximum extracted keywords to return
  maxExtractedPhrases: 3, // Maximum extracted phrases to return
  maxExtractedVerbs: 3, // Maximum extracted verbs to return
  maxExtractedNouns: 3, // Maximum extracted nouns to return
  maxExtractedPronouns: 2, // Maximum extracted pronouns to return
  maxSnippetLength: 200, // Maximum snippet length for context extraction
  // Confidence calculation weights
  baseConfidence: 0.3, // Base confidence for fallback descriptions
  searchBaseConfidence: 0.6, // Base confidence for search-based descriptions
  keywordWeight: 0.03, // Weight per keyword in confidence calculation
  phraseWeight: 0.05, // Weight per phrase in confidence calculation (higher = more specific)
  verbWeight: 0.04, // Weight per verb in confidence calculation
  nounWeight: 0.03, // Weight per noun in confidence calculation
  pronounWeight: 0.01, // Weight per pronoun in confidence calculation
  resultCountWeight: 0.02, // Weight per search result in confidence calculation
  maxConfidence: 0.95, // Maximum confidence value
  highConfidenceThreshold: 0.7, // Confidence threshold for high-quality descriptions (used in UI to indicate source)
  // Fallback confidence weights
  fallbackKeywordWeight: 0.2, // Weight per keyword in fallback confidence
  fallbackVerbWeight: 0.15, // Weight per verb in fallback confidence
  fallbackMaxConfidence: 0.9, // Maximum confidence for fallback descriptions
  // Database cache
  cacheQueryLimit: 1, // Limit for cache query results
  initialHitCount: 1, // Initial hit count for new cache entries
  defaultHitCount: 0, // Default hit count if not set
  // Description display limits (for UI text generation)
  maxDisplayItemsSingle: 1, // Maximum items to display when showing single item
  maxDisplayItemsPair: 2, // Maximum items to display when showing pair
  // Domain context query modifiers for Instant Answer API searches
  domainContextModifiers: {
    business: 'professional work business',
    home: 'home maintenance household',
    personal: 'personal life self-care',
    world: 'global international travel',
    mixed: 'general',
  },
  // Text extraction from API results
  minPhraseLength: 2, // Minimum phrase length (words)
  maxPhraseLength: 5, // Maximum phrase length (words)
  minKeywordLength: 3, // Minimum keyword length (characters)
  maxKeywordLength: 20, // Maximum keyword length (characters)
  minWordFrequency: 2, // Minimum word frequency to be considered a keyword
  minWordLengthForFiltering: 3, // Minimum word length for filtering similar terms (to avoid matching very short words)
  stopWords: ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which', 'who', 'where', 'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'now'],
  // Description template strings
  descriptionTemplates: {
    involves: 'This task involves',
    focuses: 'This task focuses',
  },
  // Domain-specific guidance messages
  domainGuidance: {
    business: 'Apply professional standards, best practices, and ensure efficiency in execution.',
    home: 'Follow established home maintenance methods and organize your living space effectively.',
    personal: 'Take a thoughtful and personal approach, prioritizing your well-being and preferences.',
    world: 'Consider global perspectives, cultural contexts, and broader implications.',
    mixed: 'Balance multiple aspects and consider different perspectives.',
  },
  // Description separator for appending
  descriptionSeparator: '\n\n', // Separator when appending descriptions
} as const;

/**
 * AI function explanation text
 */
export const AI_FUNCTION_EXPLANATION = {
  TITLE: "How AI Schedules Tasks:",
  getDescription: (maxHoursPerDay: number, schedulingPeriodDays: number) => {
    return `The AI scheduler automatically organizes your tasks into optimal schedules by analyzing each task's properties—examining action verbs to estimate effort, calculating complexity from subtasks and dependencies, and considering priority levels. It estimates task duration based on priority, description length, subtasks, and task complexity, while considering task categories (Work, Personal, Projects) and your custom category hours. Using a formula (Base Duration × Effort Score × Priority Multiplier × Complexity Score), it estimates task duration, then sorts tasks by priority and due dates, respecting due dates and scheduling urgent tasks first when priority-based scheduling is enabled, with active tasks getting preference. When scheduling, the AI checks your calendar to prevent conflicts, enforces your ${maxHoursPerDay}-hour daily limit to prevent over-scheduling, schedules tasks within your defined category hours (e.g., Work hours 9 AM-5 PM), separates weekday and weekend schedules based on your preferences, and distributes tasks across available days starting from tomorrow, finding optimal time slots within your configured work hours when possible. If a day exceeds your limit, you'll be consulted before proceeding, tasks that can't be scheduled within ${schedulingPeriodDays} days are flagged for manual scheduling, and you can reschedule entire days, weeks, or months with one click. Both regular and recurring tasks are handled appropriately, and all schedules can be manually adjusted anytime.`;
  },
  DEFAULT_WORK_HOURS_EXAMPLE: "9 AM-5 PM", // Example work hours for display
} as const;

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

/**
 * Maximum attempts when finding a conflict-free time slot for recurring tasks
 * This represents the maximum number of time slots to try when checking all occurrence days
 * Default: 48 slots (12 hours * 4 slots per hour at 15-minute intervals)
 * This ensures we try enough slots to find a valid time even in busy schedules
 */
export const MAX_RECURRING_TASK_SCHEDULING_ATTEMPTS = 48;

/**
 * Number of days to distribute high priority tasks across
 * High priority tasks are distributed across the first few days using round-robin
 * Default: 3 days
 */
export const HIGH_PRIORITY_DISTRIBUTION_DAYS = 3;

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
// Browser AI Task Breakdown Configuration
// ============================================================================

/**
 * Debounce delay for real-time task breakdown analysis (milliseconds)
 */
export const TASK_BREAKDOWN_DEBOUNCE_MS = 300;

/**
 * Maximum cache size for task breakdown results
 */
export const TASK_BREAKDOWN_CACHE_SIZE = 100;

/**
 * Domain detection confidence thresholds
 */
export const DOMAIN_DETECTION_THRESHOLDS = {
  MIN_CONFIDENCE: 0.1, // Minimum confidence to return a domain
  MIXED_THRESHOLD: 0.4, // Below this, mark as mixed if multiple domains are close
  MIXED_SIMILARITY: 0.7, // Second domain must be at least this % of top domain to be mixed
} as const;

/**
 * Domain detection scoring weights
 */
export const DOMAIN_SCORING_WEIGHTS = {
  KEYWORD: 1.0, // Weight for keyword matches
  PHRASE: 2.0, // Weight for phrase matches (more specific)
  VERB: 1.5, // Weight for verb matches (action-oriented)
} as const;

/**
 * Sequential indicators for detecting step-by-step tasks in descriptions
 * Used to identify tasks that have natural sequential structure
 */
export const SEQUENTIAL_INDICATORS = [
  'first', 'then', 'next', 'after', 'before', 'finally', 'last',
  'step 1', 'step 2', 'step 3', 'phase 1', 'phase 2',
  'start with', 'begin by', 'end with', 'finish by'
] as const;

/**
 * Action plan time distribution percentages
 */
export const ACTION_PLAN_TIME_DISTRIBUTION = {
  PREPARATION: {
    BUSINESS_MEETING: 0.2,
    BUSINESS_REPORT: 0.25,
    HOME_REPAIR: 0.15,
    HOME_CLEANING: 0.1,
    PERSONAL_EXERCISE: 0.1,
    PERSONAL_TRAVEL: 0.3,
    WORLD_TRAVEL: 0.2,
    WORLD_CALL: 0.15,
    GENERIC: 0.2,
  },
  EXECUTION: {
    BUSINESS: 0.6,
    HOME: 0.7,
    PERSONAL: 0.7,
    WORLD: 0.6,
    GENERIC: 0.6,
  },
  FOLLOW_UP: {
    BUSINESS_MEETING: 0.15,
    BUSINESS_REPORT: 0.15,
    HOME_CLEANING: 0.15,
    PERSONAL_EXERCISE: 0.2,
    GENERIC: 0.2,
  },
} as const;

/**
 * Description analysis complexity thresholds
 */
export const DESCRIPTION_COMPLEXITY_THRESHOLDS = {
  COMPLEX: {
    WORD_COUNT: 50,
    CHAR_COUNT: 300,
  },
  MODERATE: {
    WORD_COUNT: 20,
    CHAR_COUNT: 100,
  },
  MIN_DESCRIPTION_LENGTH: 20, // Minimum chars to suggest enhancement
  MIN_PHRASE_LENGTH: 5, // Minimum chars for phrase extraction
} as const;

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

