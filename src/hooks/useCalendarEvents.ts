import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCalendar } from '../contexts/CalendarContext';
import { API_BASE } from '../lib/api';
import { logger } from '../lib/logger';
import { getCalendarEventsCache, getInFlightRequests, clearCalendarEventsCache } from '../lib/calendar-events-cache';
import { getDateString } from '../lib/utils';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  provider: 'google' | 'apple';
  calendarColor?: string;
  rrule?: string; // Original RRULE string for recurring events
  recurrenceBaseId?: string; // Links instances to base recurring event
  isRecurring?: boolean; // Flag indicating if this is a recurring event
}

interface CacheEntry {
  events: CalendarEvent[];
  timestamp: number;
  dateRange: { start: string; end: string };
}

interface CalendarEventsCache {
  [key: string]: CacheEntry;
}

// Cache duration: 2 minutes (events don't change frequently)
const CACHE_DURATION = 2 * 60 * 1000;

// Debounce delay: 300ms (prevents rapid re-fetches during view changes)
const DEBOUNCE_DELAY = 300;

// Get cache and in-flight requests from shared utility (breaks circular dependency)
const globalCache = getCalendarEventsCache();
const inFlightRequests = getInFlightRequests();

/**
 * Generate cache key from date range
 */
function getCacheKey(startDate: string, endDate: string): string {
  return `${startDate}_${endDate}`;
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_DURATION;
}

/**
 * Fetch calendar events from a single provider
 */
async function fetchProviderEvents(
  provider: 'google' | 'apple',
  startDate: string,
  endDate: string,
  accessToken: string
): Promise<CalendarEvent[]> {
  try {
    const resp = await fetch(
      `${API_BASE}/calendar/events/${provider}?startDate=${startDate}&endDate=${endDate}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!resp.ok) {
      logger.warn(`Failed to fetch ${provider} events: ${resp.status}`);
      return [];
    }

    const data = await resp.json();
    if (!Array.isArray(data.events)) {
      return [];
    }

    const events: CalendarEvent[] = [];
    for (const event of data.events) {
      if (!event?.start || !event?.end) continue;
      const eventStart = new Date(event.start);
      if (isNaN(eventStart.getTime())) continue;

      events.push({
        id: event.id || `${provider}-${event.providerEventId || event.start}-${events.length}`,
        title: event.title || 'Calendar Event',
        start: event.start,
        end: event.end,
        location: event.location,
        provider,
        calendarColor: event.calendarColor,
        // Include recurrence metadata if available
        rrule: event.rrule,
        recurrenceBaseId: event.recurrenceBaseId,
        isRecurring: event.isRecurring || false,
      });
    }

    return events;
  } catch (error) {
    logger.warn(`Error fetching ${provider} events:`, error);
    return [];
  }
}

/**
 * Fetch calendar events for all providers in parallel
 */
async function fetchAllEvents(
  providers: Array<'google' | 'apple'>,
  startDate: string,
  endDate: string,
  accessToken: string
): Promise<CalendarEvent[]> {
  // Fetch all providers in parallel
  const promises = providers.map(provider =>
    fetchProviderEvents(provider, startDate, endDate, accessToken)
  );

  const results = await Promise.all(promises);
  
  // Flatten and combine all events
  return results.flat();
}

/**
 * Hook to fetch and cache calendar events
 * 
 * Features:
 * - Parallel fetching for multiple providers
 * - Shared global cache across components
 * - Debouncing to prevent rapid re-fetches
 * - Automatic cache invalidation
 * - Deduplication of in-flight requests
 */
export function useCalendarEvents(
  startDate: Date | string,
  endDate: Date | string,
  options?: {
    enabled?: boolean;
    debounceMs?: number;
  }
) {
  const { accessToken } = useAuth();
  const { calendarStatus } = useCalendar();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const prevProvidersLengthRef = useRef(providers.length);
  const enabled = options?.enabled !== false;

  // Normalize dates to ISO strings
  const startIso = useMemo(() => {
    if (typeof startDate === 'string') return startDate;
    return startDate.toISOString();
  }, [startDate]);

  const endIso = useMemo(() => {
    if (typeof endDate === 'string') return endDate;
    return endDate.toISOString();
  }, [endDate]);

  const cacheKey = useMemo(() => getCacheKey(startIso, endIso), [startIso, endIso]);

  // Determine which providers to fetch
  const providers = useMemo(() => {
    const active: Array<'google' | 'apple'> = [];
    if (calendarStatus.google) active.push('google');
    if (calendarStatus.apple) active.push('apple');
    return active;
  }, [calendarStatus.google, calendarStatus.apple]);

  // Fetch events with caching and deduplication
  const fetchEvents = useCallback(async () => {
    if (!enabled || !accessToken || providers.length === 0) {
      setEvents([]);
      setIsLoading(false);
      return;
    }

    // Check cache first
    const cached = globalCache[cacheKey];
    if (cached && isCacheValid(cached)) {
      // Verify date range matches (in case of cache collision)
      if (cached.dateRange.start === startIso && cached.dateRange.end === endIso) {
        setEvents(cached.events);
        setIsLoading(false);
        logger.debug(`Calendar events: Using cached data for ${cacheKey}`);
        return;
      }
    }

    // Check if request is already in flight
    const inFlightKey = `${cacheKey}_${providers.join(',')}`;
    if (inFlightRequests.has(inFlightKey)) {
      logger.debug(`Calendar events: Waiting for in-flight request for ${cacheKey}`);
      try {
        const cachedEvents = await inFlightRequests.get(inFlightKey)!;
        setEvents(cachedEvents);
        setIsLoading(false);
        return;
      } catch (err) {
        // If in-flight request fails, continue to fetch
        logger.warn('In-flight request failed, fetching fresh:', err);
      }
    }

    setIsLoading(true);
    setError(null);

    // Create and store the promise
    const fetchPromise = fetchAllEvents(providers, startIso, endIso, accessToken)
      .then((fetchedEvents) => {
        // Update cache
        globalCache[cacheKey] = {
          events: fetchedEvents,
          timestamp: Date.now(),
          dateRange: { start: startIso, end: endIso },
        };

        // Clean up old cache entries (keep last 50 entries)
        const cacheEntries = Object.entries(globalCache);
        if (cacheEntries.length > 50) {
          // Sort by timestamp and remove oldest
          const sorted = cacheEntries.sort((a, b) => a[1].timestamp - b[1].timestamp);
          const toRemove = sorted.slice(0, sorted.length - 50);
          toRemove.forEach(([key]) => delete globalCache[key]);
        }

        setEvents(fetchedEvents);
        setIsLoading(false);
        return fetchedEvents;
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error('Failed to fetch calendar events'));
        setIsLoading(false);
        setEvents([]);
        throw err;
      })
      .finally(() => {
        // Remove from in-flight requests
        inFlightRequests.delete(inFlightKey);
      });

    inFlightRequests.set(inFlightKey, fetchPromise);

    return fetchPromise;
  }, [enabled, accessToken, providers, startIso, endIso, cacheKey]);

  // When providers goes from empty to non-empty, clear cache so the next fetch is not skipped by stale empty data
  useEffect(() => {
    const prevLen = prevProvidersLengthRef.current;
    const currLen = providers.length;
    prevProvidersLengthRef.current = currLen;
    if (prevLen === 0 && currLen > 0) {
      clearCalendarEventsCache();
    }
  }, [providers.length]);

  // Debounced fetch effect
  useEffect(() => {
    // Clear any existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set up debounced fetch
    debounceTimerRef.current = setTimeout(() => {
      fetchEvents();
    }, options?.debounceMs ?? DEBOUNCE_DELAY);

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [fetchEvents, options?.debounceMs]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Dev-only: log when enabled, providers, or events change to confirm flow
  const providersKey = providers.join(',');
  useEffect(() => {
    if (import.meta.env.DEV) {
      logger.debug('Calendar events state', {
        enabled,
        providers: providersKey || '(none)',
        eventsLength: events.length,
      });
    }
  }, [enabled, providersKey, events.length]);

  return {
    events,
    isLoading,
    error,
    refetch: fetchEvents,
  };
}

/**
 * Helper hook to get events grouped by date
 */
export function useCalendarEventsByDate(
  startDate: Date | string,
  endDate: Date | string,
  options?: {
    enabled?: boolean;
    debounceMs?: number;
  }
) {
  const { events, isLoading, error, refetch } = useCalendarEvents(startDate, endDate, options);

  const eventsByDate = useMemo(() => {
    const grouped: Record<string, CalendarEvent[]> = {};

    for (const event of events) {
      if (!event?.start) continue;
      const eventStart = new Date(event.start);
      if (isNaN(eventStart.getTime())) continue;

      // Normalize to local date string (YYYY-MM-DD) using getDateString for consistency
      // This ensures the same date formatting is used across desktop and mobile views
      const normalizedDate = new Date(
        eventStart.getFullYear(),
        eventStart.getMonth(),
        eventStart.getDate()
      );
      const dateKey = getDateString(normalizedDate);

      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(event);
    }

    return grouped;
  }, [events]);

  return {
    eventsByDate,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Helper hook to get event counts by date (for dots/badges)
 */
export function useCalendarEventCounts(
  startDate: Date | string,
  endDate: Date | string,
  options?: {
    enabled?: boolean;
    debounceMs?: number;
  }
) {
  const { eventsByDate, isLoading, error, refetch } = useCalendarEventsByDate(
    startDate,
    endDate,
    options
  );

  const eventCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [dateKey, events] of Object.entries(eventsByDate)) {
      counts[dateKey] = events.length;
    }
    return counts;
  }, [eventsByDate]);

  return {
    eventCounts,
    isLoading,
    error,
    refetch,
  };
}

// clearCalendarEventsCache moved to ../lib/calendar-events-cache.ts to break circular dependency
// Re-export for backward compatibility
export { clearCalendarEventsCache } from '../lib/calendar-events-cache';

