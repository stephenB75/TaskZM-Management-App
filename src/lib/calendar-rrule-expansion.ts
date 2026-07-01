/**
 * Expand calendar RRULE series into occurrences for a date range (browser).
 * Apple Calendar fetch returns unexpanded masters to avoid Supabase edge 546 limits;
 * expansion runs here on the client.
 */

import { TIMING_CONSTANTS } from './timing-constants';
import {
  addCalendarDays,
  addCalendarMonths,
  addCalendarYears,
  getWallClockInTimeZone,
  resolveValidIanaTimeZone,
  wallClockPartsToUtcDate,
} from './calendar-timezone-utils';
import { parseCalendarEventTime } from './utils';

const MS_PER_DAY = TIMING_CONSTANTS.timeConversions.daysToMs;
const DAYS_PER_WEEK = TIMING_CONSTANTS.calendar.daysPerWeek;
const MAX_RECURRENCE_ITERATIONS = TIMING_CONSTANTS.calendar.maxRecurrenceInterval;
const MAX_EXPANDED_EVENTS = TIMING_CONSTANTS.calendar.maxOccurrences;
const DEFAULT_EVENT_DURATION_MS =
  TIMING_CONSTANTS.calendar.defaultEventDurationMinutes *
  TIMING_CONSTANTS.timeConversions.minutesToMs;

export interface ExpandableCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  provider: 'google' | 'apple' | 'outlook';
  calendarColor?: string;
  rrule?: string;
  recurrenceBaseId?: string;
  isRecurring?: boolean;
  recurrenceAnchorStart?: string;
  recurrenceAnchorEnd?: string;
}

function ensureEventEndIso(start: string, end: string | null | undefined): string {
  if (end) return end;
  const startDate = parseCalendarEventTime(start);
  if (Number.isNaN(startDate.getTime())) return start;
  return new Date(startDate.getTime() + DEFAULT_EVENT_DURATION_MS).toISOString();
}

function eventOverlapsRange(
  startIso: string,
  endIso: string | null | undefined,
  rangeStart: Date,
  rangeEnd: Date,
): boolean {
  const eventStart = parseCalendarEventTime(startIso);
  if (Number.isNaN(eventStart.getTime())) return false;
  let eventEnd = endIso ? parseCalendarEventTime(endIso) : eventStart;
  if (Number.isNaN(eventEnd.getTime())) eventEnd = eventStart;
  if (eventEnd.getTime() < eventStart.getTime()) eventEnd = eventStart;
  return eventStart <= rangeEnd && eventEnd >= rangeStart;
}

function generateOccurrencesFromMaster(
  master: ExpandableCalendarEvent,
  rangeStart: Date,
  rangeEnd: Date,
  timeZone: string,
): ExpandableCalendarEvent[] {
  if (!master.rrule) {
    if (eventOverlapsRange(master.start, master.end, rangeStart, rangeEnd)) {
      return [master];
    }
    return [];
  }

  const validTz = resolveValidIanaTimeZone(timeZone);
  const parts: Record<string, string> = {};
  master.rrule.split(';').forEach((part) => {
    const [key, value] = part.split('=');
    if (key && value) parts[key] = value;
  });

  const freq = parts['FREQ'];
  const interval = parseInt(parts['INTERVAL'] || '1', 10);
  const count = parts['COUNT'] ? parseInt(parts['COUNT'], 10) : undefined;
  const until = parts['UNTIL'];
  const byMonthDay = parts['BYMONTHDAY'] ? parseInt(parts['BYMONTHDAY'], 10) : undefined;

  const anchorStart = master.recurrenceAnchorStart ?? master.start;
  const anchorEnd = master.recurrenceAnchorEnd ?? master.end;
  const baseStart = parseCalendarEventTime(anchorStart);
  const baseEnd = parseCalendarEventTime(ensureEventEndIso(anchorStart, anchorEnd));
  const duration = baseEnd.getTime() - baseStart.getTime();

  let untilDate = rangeEnd;
  if (until && until.length >= 8) {
    const year = parseInt(until.substring(0, 4), 10);
    const month = parseInt(until.substring(4, 6), 10) - 1;
    const day = parseInt(until.substring(6, 8), 10);
    let hour = 23;
    let minute = 59;
    let second = 59;
    if (until.length >= 15) {
      hour = parseInt(until.substring(9, 11), 10);
      minute = parseInt(until.substring(11, 13), 10);
      second = parseInt(until.substring(13, 15), 10);
    }
    untilDate = wallClockPartsToUtcDate({ year, monthIndex: month, day, hour, minute, second }, validTz);
  }

  const rangeDays = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / MS_PER_DAY);
  const rangeBasedMax = Math.min(
    MAX_RECURRENCE_ITERATIONS,
    Math.max(rangeDays + DAYS_PER_WEEK, DAYS_PER_WEEK * 4),
  );
  const maxIterations = count ? Math.min(count, rangeBasedMax) : rangeBasedMax;

  const occurrences: ExpandableCalendarEvent[] = [];
  let wall = getWallClockInTimeZone(baseStart, validTz);
  let currentInstant = wallClockPartsToUtcDate(wall, validTz);
  let iterations = 0;

  if (currentInstant < rangeStart) {
    if (freq === 'DAILY') {
      const daysDiff = Math.floor((rangeStart.getTime() - currentInstant.getTime()) / MS_PER_DAY);
      wall = addCalendarDays(wall, Math.floor(daysDiff / interval) * interval);
    } else if (freq === 'WEEKLY') {
      const daysDiff = Math.floor((rangeStart.getTime() - currentInstant.getTime()) / MS_PER_DAY);
      wall = addCalendarDays(wall, Math.floor(daysDiff / (DAYS_PER_WEEK * interval)) * DAYS_PER_WEEK * interval);
    } else {
      let skipGuard = 0;
      while (wallClockPartsToUtcDate(wall, validTz) < rangeStart && skipGuard < maxIterations) {
        if (freq === 'MONTHLY') {
          wall = addCalendarMonths(wall, interval, byMonthDay);
        } else if (freq === 'YEARLY') {
          wall = addCalendarYears(wall, interval, byMonthDay);
        } else {
          break;
        }
        skipGuard++;
      }
    }
    currentInstant = wallClockPartsToUtcDate(wall, validTz);
  }

  const baseId = master.recurrenceBaseId ?? master.id;

  while (currentInstant <= untilDate && currentInstant <= rangeEnd && iterations < maxIterations) {
    if (occurrences.length >= MAX_EXPANDED_EVENTS) break;

    if (currentInstant >= rangeStart && currentInstant <= rangeEnd) {
      const endInstant = new Date(currentInstant.getTime() + duration);
      const stamp = currentInstant.toISOString().replace(/[-:TZ.]/g, '').substring(0, 14);
      occurrences.push({
        ...master,
        id: `${master.id}_${stamp}`,
        start: currentInstant.toISOString(),
        end: endInstant.toISOString(),
        recurrenceBaseId: baseId,
        isRecurring: true,
        recurrenceAnchorStart: baseStart.toISOString(),
        recurrenceAnchorEnd: baseEnd.toISOString(),
        rrule: master.rrule,
      });
    }

    switch (freq) {
      case 'DAILY':
        wall = addCalendarDays(wall, interval);
        break;
      case 'WEEKLY':
        wall = addCalendarDays(wall, DAYS_PER_WEEK * interval);
        break;
      case 'MONTHLY':
        wall = addCalendarMonths(wall, interval, byMonthDay);
        break;
      case 'YEARLY':
        wall = addCalendarYears(wall, interval, byMonthDay);
        break;
      default:
        iterations = maxIterations;
        break;
    }

    currentInstant = wallClockPartsToUtcDate(wall, validTz);
    iterations++;
  }

  return occurrences;
}

/**
 * Expand RRULE masters and filter plain events to the requested range.
 * Events already expanded by the server (no rrule) pass through when overlapping.
 */
export function expandCalendarEventsForRange<T extends ExpandableCalendarEvent>(
  events: T[],
  rangeStartIso: string,
  rangeEndIso: string,
  timeZone: string,
): T[] {
  const rangeStart = new Date(rangeStartIso);
  const rangeEnd = new Date(rangeEndIso);
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    return events;
  }

  const result: T[] = [];
  const processedMasters = new Set<string>();

  for (const event of events) {
    if (result.length >= MAX_EXPANDED_EVENTS) break;

    if (event.rrule) {
      const masterKey = event.recurrenceBaseId ?? event.id;
      if (processedMasters.has(masterKey)) continue;
      processedMasters.add(masterKey);

      const anchorStart = event.recurrenceAnchorStart ?? event.start;
      const anchorEnd = event.recurrenceAnchorEnd ?? event.end;
      const master: ExpandableCalendarEvent = {
        ...event,
        recurrenceAnchorStart: anchorStart,
        recurrenceAnchorEnd: anchorEnd,
      };
      const occurrences = generateOccurrencesFromMaster(master, rangeStart, rangeEnd, timeZone);
      const remaining = MAX_EXPANDED_EVENTS - result.length;
      result.push(...(occurrences.slice(0, remaining) as T[]));
      continue;
    }

    if (eventOverlapsRange(event.start, event.end, rangeStart, rangeEnd)) {
      result.push(event);
    }
  }

  result.sort(
    (a, b) => parseCalendarEventTime(a.start).getTime() - parseCalendarEventTime(b.start).getTime(),
  );
  return result;
}
