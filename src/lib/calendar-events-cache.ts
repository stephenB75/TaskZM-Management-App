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

/** Bumped whenever clearCalendarEventsCache runs so hooks refetch immediately. */
let invalidationEpoch = 0;

const invalidationListeners = new Set<() => void>();

/**
 * Subscribe to cache invalidation (for useSyncExternalStore in useCalendarEvents).
 */
export function subscribeCalendarEventsInvalidation(listener: () => void): () => void {
  invalidationListeners.add(listener);
  return () => {
    invalidationListeners.delete(listener);
  };
}

export function getCalendarEventsInvalidationEpoch(): number {
  return invalidationEpoch;
}

/**
 * Clear the global cache (useful after calendar sync)
 */
export function clearCalendarEventsCache() {
  Object.keys(globalCache).forEach((key) => {
    delete globalCache[key];
  });
  inFlightRequests.clear();
  invalidationEpoch += 1;
  invalidationListeners.forEach((listener) => listener());
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

