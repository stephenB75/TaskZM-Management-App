/**
 * Calendar Events Cache Utility
 * 
 * Separated from useCalendarEvents to break circular dependency with CalendarContext
 * Note: Types are kept generic to avoid circular dependency
 */

interface CacheEntry {
  events: unknown[];
  timestamp: number;
  dateRange: { start: string; end: string };
}

interface CalendarEventsCache {
  [key: string]: CacheEntry;
}

// Global cache shared across all hook instances
const globalCache: CalendarEventsCache = {};

// In-flight requests cache to prevent duplicate simultaneous requests
const inFlightRequests = new Map<string, Promise<unknown[]>>();

/**
 * Clear the global cache (useful after calendar sync)
 */
export function clearCalendarEventsCache() {
  Object.keys(globalCache).forEach((key) => {
    delete globalCache[key];
  });
  inFlightRequests.clear();
}

/**
 * Get the global cache (for useCalendarEvents internal use)
 * @internal
 */
export function getCalendarEventsCache() {
  return globalCache;
}

/**
 * Get the in-flight requests map (for useCalendarEvents internal use)
 * @internal
 */
export function getInFlightRequests() {
  return inFlightRequests;
}

