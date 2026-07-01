import { useState, useEffect, useCallback, useRef, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useCalendar } from '../contexts/CalendarContext';
import { CALENDAR_API_BASE } from '../lib/calendar-api-base';
import { logger } from '../lib/logger';
import {
  getCalendarEventsCache,
  getInFlightRequests,
  clearCalendarEventsCache,
  subscribeCalendarEventsInvalidation,
  getCalendarEventsInvalidationEpoch,
} from '../lib/calendar-events-cache';
import { TIMING_CONSTANTS, getBrowserTimezone } from '../lib/timing-constants';
import { getDateString, parseCalendarEventTime, dateStringToLocalDate, getCalendarEventSortTimeOnDay, toCalendarQueryRangeIso } from '../lib/utils';
import { applyRecurrenceTimeCorrections } from '../lib/calendar-recurrence-utils';
import { expandCalendarEventsForRange } from '../lib/calendar-rrule-expansion';
import { fetchAppleCalendarEventsFromDb } from '../lib/apple-calendar-db';
import { resolveCalendarProvidersForFetch, getActiveCalendarProviders, type CalendarProviderKey } from '../lib/calendar-status';

/** Bump when calendar event time/recurrence handling changes (invalidates in-memory cache). */
const CALENDAR_EVENTS_CACHE_VERSION = 'v10-apple-direct-db-read';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  provider: 'google' | 'apple' | 'outlook';
  calendarColor?: string;
  rrule?: string; // Original RRULE string for recurring events
  recurrenceBaseId?: string; // Links instances to base recurring event
  isRecurring?: boolean; // Flag indicating if this is a recurring event
  /** Base series start/end from DB — used to correct DST drift on expanded occurrences */
  recurrenceAnchorStart?: string;
  recurrenceAnchorEnd?: string;
}

interface CacheEntry {
  events: CalendarEvent[];
  timestamp: number;
  dateRange: { start: string; end: string };
  providers: CalendarProviderKey[];
}

// Serialize per-provider API calls so parallel views don't stampede the edge function (546).
const providerFetchChains = new Map<CalendarProviderKey, Promise<unknown>>();

const TRANSIENT_CALENDAR_HTTP_STATUSES = new Set([502, 503, 546]);

function eventOverlapsIsoRange(event: CalendarEvent, startIso: string, endIso: string): boolean {
  const rangeStart = new Date(startIso).getTime();
  const rangeEnd = new Date(endIso).getTime();
  const eventStart = parseCalendarEventTime(event.start).getTime();
  const eventEnd = parseCalendarEventTime(event.end || event.start).getTime();
  if (Number.isNaN(eventStart)) return false;
  const end = Number.isNaN(eventEnd) ? eventStart : eventEnd;
  return eventStart <= rangeEnd && end >= rangeStart;
}

function findSupersetCachedEvents(
  startIso: string,
  endIso: string,
  activeProviders: CalendarProviderKey[],
): CalendarEvent[] | null {
  const reqStart = new Date(startIso).getTime();
  const reqEnd = new Date(endIso).getTime();
  if (Number.isNaN(reqStart) || Number.isNaN(reqEnd)) return null;

  const needed = new Set(activeProviders);
  let best: CacheEntry | null = null;
  let bestSpan = Number.POSITIVE_INFINITY;

  for (const entry of Object.values(globalCache) as CacheEntry[]) {
    if (!isCacheValid(entry) || entry.events.length === 0) continue;
    if (
      !entry.providers ||
      entry.providers.length !== needed.size ||
      !entry.providers.every((p) => needed.has(p))
    ) {
      continue;
    }
    const cacheStart = new Date(entry.dateRange.start).getTime();
    const cacheEnd = new Date(entry.dateRange.end).getTime();
    if (Number.isNaN(cacheStart) || Number.isNaN(cacheEnd)) continue;
    if (cacheStart > reqStart || cacheEnd < reqEnd) continue;

    const span = cacheEnd - cacheStart;
    if (span < bestSpan) {
      bestSpan = span;
      best = entry;
    }
  }

  if (!best) return null;
  return best.events.filter((event) => eventOverlapsIsoRange(event, startIso, endIso));
}

function runSerializedProviderFetch<T>(
  provider: CalendarProviderKey,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = providerFetchChains.get(provider) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(fn);
  providerFetchChains.set(provider, next);
  return next.finally(() => {
    if (providerFetchChains.get(provider) === next) {
      providerFetchChains.delete(provider);
    }
  });
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

interface CalendarFetchBatchWaiter {
  startIso: string;
  endIso: string;
  providers: CalendarProviderKey[];
  resolve: (events: CalendarEvent[]) => void;
  reject: (error: unknown) => void;
}

interface CalendarFetchBatch {
  startIso: string;
  endIso: string;
  providers: Set<CalendarProviderKey>;
  accessToken: string;
  userTimezone: string;
  waiters: CalendarFetchBatchWaiter[];
}

let pendingCalendarFetchBatch: CalendarFetchBatch | null = null;
let calendarFetchBatchTimer: ReturnType<typeof setTimeout> | null = null;

function mergeCalendarFetchBatch(
  startIso: string,
  endIso: string,
  providers: CalendarProviderKey[],
  accessToken: string,
  userTimezone: string,
  waiter: CalendarFetchBatchWaiter,
): void {
  if (!pendingCalendarFetchBatch) {
    pendingCalendarFetchBatch = {
      startIso,
      endIso,
      providers: new Set(providers),
      accessToken,
      userTimezone,
      waiters: [waiter],
    };
    return;
  }

  const batch = pendingCalendarFetchBatch;
  if (startIso < batch.startIso) batch.startIso = startIso;
  if (endIso > batch.endIso) batch.endIso = endIso;
  providers.forEach((provider) => batch.providers.add(provider));
  batch.waiters.push(waiter);
}

async function flushCalendarFetchBatch(): Promise<void> {
  const batch = pendingCalendarFetchBatch;
  pendingCalendarFetchBatch = null;
  calendarFetchBatchTimer = null;
  if (!batch) return;

  const mergedProviders = [...batch.providers];
  try {
    const fetchedEvents = await fetchAllEvents(
      mergedProviders,
      batch.startIso,
      batch.endIso,
      batch.accessToken,
      batch.userTimezone,
    );

    if (fetchedEvents.length > 0) {
      const wideCacheKey = getCacheKey(
        batch.startIso,
        batch.endIso,
        mergedProviders,
        batch.userTimezone,
      );
      globalCache[wideCacheKey] = {
        events: fetchedEvents,
        timestamp: Date.now(),
        dateRange: { start: batch.startIso, end: batch.endIso },
        providers: mergedProviders,
      };
    }

    for (const waiter of batch.waiters) {
      const needed = new Set(waiter.providers);
      const filtered = fetchedEvents.filter(
        (event) => needed.has(event.provider) && eventOverlapsIsoRange(event, waiter.startIso, waiter.endIso),
      );
      waiter.resolve(filtered);
    }
  } catch (error) {
    for (const waiter of batch.waiters) {
      waiter.reject(error);
    }
  }
}

function scheduleBatchedCalendarFetch(
  startIso: string,
  endIso: string,
  providers: CalendarProviderKey[],
  accessToken: string,
  userTimezone: string,
): Promise<CalendarEvent[]> {
  return new Promise((resolve, reject) => {
    mergeCalendarFetchBatch(startIso, endIso, providers, accessToken, userTimezone, {
      startIso,
      endIso,
      providers,
      resolve,
      reject,
    });

    if (calendarFetchBatchTimer != null) {
      clearTimeout(calendarFetchBatchTimer);
    }
    calendarFetchBatchTimer = setTimeout(() => {
      void flushCalendarFetchBatch();
    }, TIMING_CONSTANTS.calendar.eventsFetchBatchCoalesceMs);
  });
}

interface CalendarEventsCache {
  [key: string]: CacheEntry;
}

// Cache duration from shared constant (aligns with calendar status cache; single source of truth)
const CACHE_DURATION = TIMING_CONSTANTS.calendar.cacheDuration;

// Debounce delay: 300ms (prevents rapid re-fetches during view changes)
const DEBOUNCE_DELAY = 300;

// Get cache and in-flight requests from shared utility (breaks circular dependency)
const globalCache = getCalendarEventsCache();
const inFlightRequests = getInFlightRequests();

/**
 * Generate cache key from date range and providers so different provider sets don't share stale cache
 */
function getCacheKey(
  startDate: string,
  endDate: string,
  providers: Array<'google' | 'apple' | 'outlook'>,
  userTimezone: string
): string {
  return `${CALENDAR_EVENTS_CACHE_VERSION}_${startDate}_${endDate}_${providers.join(',')}_${userTimezone}`;
}

/**
 * Check if cache entry is still valid
 */
function isCacheValid(entry: CacheEntry): boolean {
  return Date.now() - entry.timestamp < CACHE_DURATION;
}

const DEFAULT_EVENT_DURATION_MS =
  TIMING_CONSTANTS.calendar.defaultEventDurationMinutes *
  TIMING_CONSTANTS.timeConversions.secondsToMs *
  60;

function resolveEventEndIso(start: string, end: string | null | undefined): string {
  if (end != null && end !== '') return end;
  const startDate = parseCalendarEventTime(start);
  if (isNaN(startDate.getTime())) return start;
  return new Date(startDate.getTime() + DEFAULT_EVENT_DURATION_MS).toISOString();
}

/**
 * Fetch calendar events from a single provider
 */
async function fetchProviderEvents(
  provider: 'google' | 'apple' | 'outlook',
  startDate: string,
  endDate: string,
  accessToken: string,
  userTimezone: string
): Promise<CalendarEvent[]> {
  return runSerializedProviderFetch(provider, () =>
    fetchProviderEventsOnce(provider, startDate, endDate, accessToken, userTimezone),
  );
}

async function fetchProviderEventsOnce(
  provider: 'google' | 'apple' | 'outlook',
  startDate: string,
  endDate: string,
  accessToken: string,
  userTimezone: string
): Promise<CalendarEvent[]> {
  if (provider === 'apple') {
    try {
      const rows = await fetchAppleCalendarEventsFromDb(startDate, endDate);
      return expandCalendarEventsForRange(rows, startDate, endDate, userTimezone);
    } catch (error) {
      logger.warn('Apple Calendar direct DB fetch failed:', error);
      return [];
    }
  }

  const maxRetries = TIMING_CONSTANTS.calendar.eventsFetchMaxRetries;
  const retryDelayMs = TIMING_CONSTANTS.calendar.eventsFetchRetryDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const params = new URLSearchParams({
        startDate,
        endDate,
        userTimezone,
      });
      const resp = await fetch(
        `${CALENDAR_API_BASE}/calendar/events/${provider}?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!resp.ok) {
        if (TRANSIENT_CALENDAR_HTTP_STATUSES.has(resp.status) && attempt < maxRetries) {
          logger.warn(`Calendar ${provider} fetch ${resp.status} — retry ${attempt + 1}/${maxRetries}`);
          await sleep(retryDelayMs * (attempt + 1));
          continue;
        }
        logger.warn(`Failed to fetch ${provider} events: ${resp.status}`);
        return [];
      }

      const data = await resp.json();
      if (!Array.isArray(data.events)) {
        return [];
      }

      const events: CalendarEvent[] = [];
      for (const event of data.events) {
        if (!event?.start) continue;
        const eventStart = parseCalendarEventTime(event.start);
        if (isNaN(eventStart.getTime())) continue;

        const endIso = resolveEventEndIso(event.start, event.end);

        events.push({
          id: event.id || `${provider}-${event.providerEventId || event.start}-${events.length}`,
          title: event.title || 'Calendar Event',
          start: event.start,
          end: endIso,
          location: event.location,
          provider,
          calendarColor: event.calendarColor,
          rrule: event.rrule,
          recurrenceBaseId: event.recurrenceBaseId,
          isRecurring: Boolean(event.isRecurring || event.rrule || event.recurrenceBaseId),
          recurrenceAnchorStart: event.recurrenceAnchorStart,
          recurrenceAnchorEnd: event.recurrenceAnchorEnd,
        });
      }

      return events;
    } catch (error) {
      if (attempt < maxRetries) {
        logger.warn(`Error fetching ${provider} events — retry ${attempt + 1}/${maxRetries}:`, error);
        await sleep(retryDelayMs * (attempt + 1));
        continue;
      }
      logger.warn(`Error fetching ${provider} events:`, error);
      return [];
    }
  }

  return [];
}

/**
 * Fetch calendar events for all providers in parallel
 */
async function fetchAllEvents(
  providers: Array<'google' | 'apple' | 'outlook'>,
  startDate: string,
  endDate: string,
  accessToken: string,
  userTimezone: string
): Promise<CalendarEvent[]> {
  // Fetch all providers in parallel
  const promises = providers.map(provider =>
    fetchProviderEvents(provider, startDate, endDate, accessToken, userTimezone)
  );

  const results = await Promise.all(promises);
  const combined = results.flat();
  return applyRecurrenceTimeCorrections(combined, userTimezone);
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
  const { user, accessToken } = useAuth();
  const { calendarStatus, checkCalendarStatus, lastSync } = useCalendar();
  const invalidationEpoch = useSyncExternalStore(
    subscribeCalendarEventsInvalidation,
    getCalendarEventsInvalidationEpoch,
    getCalendarEventsInvalidationEpoch,
  );
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const emptyResultRetryRef = useRef(false);
  const enabled = options?.enabled !== false;

  const { startIso, endIso } = useMemo(
    () => toCalendarQueryRangeIso(startDate, endDate),
    [startDate, endDate],
  );

  // Determine which providers to fetch (context + persisted fallback when API cache is stale)
  const providers = useMemo(
    () => resolveCalendarProvidersForFetch(calendarStatus, user?.id),
    [calendarStatus.google, calendarStatus.outlook, calendarStatus.apple, user?.id],
  );

  const providersRef = useRef(providers);
  providersRef.current = providers;

  const userTimezone = useMemo(() => getBrowserTimezone(), []);

  const fetchEventsForProviders = useCallback(async (activeProviders: CalendarProviderKey[]) => {
    if (!enabled || !accessToken || activeProviders.length === 0) {
      setEvents([]);
      setIsLoading(false);
      return;
    }

    const runtimeCacheKey = getCacheKey(startIso, endIso, activeProviders, userTimezone);

    const cached = globalCache[runtimeCacheKey];
    if (cached && isCacheValid(cached)) {
      if (cached.dateRange.start === startIso && cached.dateRange.end === endIso) {
        setEvents(cached.events);
        setIsLoading(false);
        logger.debug(`Calendar events: Using cached data for ${runtimeCacheKey}`);
        return;
      }
    }

    const supersetEvents = findSupersetCachedEvents(startIso, endIso, activeProviders);
    if (supersetEvents) {
      setEvents(supersetEvents);
      setIsLoading(false);
      logger.debug('Calendar events: Using superset cache for requested range');
      return;
    }

    if (inFlightRequests.has(runtimeCacheKey)) {
      logger.debug(`Calendar events: Waiting for in-flight request for ${runtimeCacheKey}`);
      try {
        const cachedEvents = await inFlightRequests.get(runtimeCacheKey)!;
        setEvents(cachedEvents);
        setIsLoading(false);
        return;
      } catch (err) {
        logger.warn('In-flight request failed, fetching fresh:', err);
      }
    }

    setIsLoading(true);
    setError(null);

    const fetchPromise = scheduleBatchedCalendarFetch(startIso, endIso, activeProviders, accessToken, userTimezone)
      .then((fetchedEvents) => {
        // Do not cache empty results — avoids locking views into "no events" before sync finishes
        if (fetchedEvents.length > 0) {
          globalCache[runtimeCacheKey] = {
            events: fetchedEvents,
            timestamp: Date.now(),
            dateRange: { start: startIso, end: endIso },
            providers: [...activeProviders],
          };
        } else {
          delete globalCache[runtimeCacheKey];
        }

        const cacheEntries = Object.entries(globalCache);
        if (cacheEntries.length > 50) {
          const sorted = cacheEntries.sort((a, b) => a[1].timestamp - b[1].timestamp);
          const toRemove = sorted.slice(0, sorted.length - 50);
          toRemove.forEach(([key]) => delete globalCache[key]);
        }

        setEvents(fetchedEvents);
        setIsLoading(false);

        // One retry when connected but empty — covers in-flight sync or stale edge cache
        if (
          fetchedEvents.length === 0 &&
          activeProviders.length > 0 &&
          !emptyResultRetryRef.current
        ) {
          emptyResultRetryRef.current = true;
          delete globalCache[runtimeCacheKey];
          window.setTimeout(() => {
            fetchEventsForProviders(activeProviders);
          }, TIMING_CONSTANTS.delays.calendarCheck);
        }

        return fetchedEvents;
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error('Failed to fetch calendar events'));
        setIsLoading(false);
        setEvents([]);
        throw err;
      })
      .finally(() => {
        inFlightRequests.delete(runtimeCacheKey);
      });

    inFlightRequests.set(runtimeCacheKey, fetchPromise);

    return fetchPromise;
  }, [enabled, accessToken, startIso, endIso, userTimezone]);

  const fetchEvents = useCallback(async () => {
    return fetchEventsForProviders(providersRef.current);
  }, [fetchEventsForProviders]);

  const providersKey = providers.join(',');

  // Reset empty-result retry when range or providers change
  useEffect(() => {
    emptyResultRetryRef.current = false;
  }, [providersKey, startIso, endIso]);

  // When connected providers change, clear cache and refetch immediately
  const prevProvidersKeyRef = useRef(providersKey);
  useEffect(() => {
    const prevKey = prevProvidersKeyRef.current;
    prevProvidersKeyRef.current = providersKey;
    if (prevKey === providersKey) return;

    if (providers.length === 0) {
      setEvents([]);
      setIsLoading(false);
      return;
    }

    clearCalendarEventsCache();
    if (enabled && accessToken) {
      fetchEvents();
    }
  }, [providersKey, providers.length, enabled, accessToken, fetchEvents]);

  // When a view that needs calendar events mounts with no providers, force a fresh status check once so we pick up connections from another tab or recent connect
  const didRefreshStatusRef = useRef(false);
  useEffect(() => {
    if (providers.length > 0) {
      didRefreshStatusRef.current = false;
      return;
    }
    if (!enabled || !accessToken || !user?.id || didRefreshStatusRef.current) return;
    didRefreshStatusRef.current = true;
    try {
      localStorage.removeItem(`calendar_status_cache_${user.id}`);
      localStorage.removeItem(`calendar_status_cache_time_${user.id}`);
    } catch {
      // ignore
    }
    checkCalendarStatus();
  }, [enabled, accessToken, user?.id, providers.length, checkCalendarStatus]);

  // Refetch immediately when cache is invalidated (e.g. after calendar import/sync)
  const prevInvalidationEpochRef = useRef(invalidationEpoch);
  useEffect(() => {
    if (invalidationEpoch === prevInvalidationEpochRef.current) return;
    prevInvalidationEpochRef.current = invalidationEpoch;
    if (!enabled || !accessToken) return;

    const refreshAfterInvalidation = async () => {
      try {
        if (user?.id) {
          localStorage.removeItem(`calendar_status_cache_${user.id}`);
          localStorage.removeItem(`calendar_status_cache_time_${user.id}`);
        }
        const status = await checkCalendarStatus();
        const activeProviders = status
          ? getActiveCalendarProviders(status)
          : resolveCalendarProvidersForFetch(calendarStatus, user?.id);
        await fetchEventsForProviders(activeProviders);
      } catch {
        await fetchEvents();
      }
    };
    refreshAfterInvalidation();
  }, [invalidationEpoch, enabled, accessToken, user?.id, calendarStatus, checkCalendarStatus, fetchEvents, fetchEventsForProviders]);

  // Refetch when a calendar sync completes (lastSync updates even when cache was already cleared)
  const lastSyncMs = lastSync?.getTime() ?? 0;
  const prevLastSyncMsRef = useRef(0);
  useEffect(() => {
    if (!lastSyncMs || lastSyncMs === prevLastSyncMsRef.current) return;
    prevLastSyncMsRef.current = lastSyncMs;
    if (!enabled || !accessToken) return;
    fetchEvents();
  }, [lastSyncMs, enabled, accessToken, fetchEvents]);

  // Debounced fetch when date range, providers, or auth changes
  useEffect(() => {
    if (!enabled || !accessToken || providers.length === 0) {
      if (providers.length === 0) {
        setEvents([]);
      }
      return;
    }

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchEvents();
    }, options?.debounceMs ?? DEBOUNCE_DELAY);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [fetchEvents, options?.debounceMs, providersKey, startIso, endIso, enabled, accessToken, providers.length]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Refetch when tab becomes visible (e.g. user connected calendar in another tab or first fetch failed)
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && enabled && accessToken && providers.length > 0) {
        fetchEvents();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [enabled, accessToken, providers.length, fetchEvents]);

  // Dev-only: log when enabled, providers, or events change to confirm flow
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
      const eventStart = parseCalendarEventTime(event.start);
      if (isNaN(eventStart.getTime())) continue;

      const eventEnd = parseCalendarEventTime(event.end || event.start);
      const startDay = new Date(eventStart.getFullYear(), eventStart.getMonth(), eventStart.getDate());
      let endDay = new Date(
        eventEnd.getFullYear(),
        eventEnd.getMonth(),
        eventEnd.getDate(),
      );

      // Exclusive midnight end (common for all-day) — don't add an extra column day
      if (
        eventEnd.getHours() === 0 &&
        eventEnd.getMinutes() === 0 &&
        eventEnd.getSeconds() === 0 &&
        eventEnd.getTime() > eventStart.getTime() &&
        endDay.getTime() > startDay.getTime()
      ) {
        endDay.setDate(endDay.getDate() - 1);
      }
      if (endDay.getTime() < startDay.getTime()) {
        endDay = new Date(startDay);
      }

      const cursor = new Date(startDay);
      while (cursor.getTime() <= endDay.getTime()) {
        const dateKey = getDateString(cursor);
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(event);
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    for (const dateKey of Object.keys(grouped)) {
      const referenceDay = dateStringToLocalDate(dateKey);
      grouped[dateKey].sort(
        (a, b) => getCalendarEventSortTimeOnDay(referenceDay, a.start) - getCalendarEventSortTimeOnDay(referenceDay, b.start),
      );
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

