/**
 * Apple Calendar events — read directly from Supabase (RLS) instead of the edge function.
 * Avoids HTTP 546 when the monolithic edge function times out on fetch + RRULE expansion.
 */

import { supabase } from './supabase-client';
import { TIMING_CONSTANTS } from './timing-constants';
import { parseCalendarEventTime } from './utils';
import { logger } from './logger';

const ICLOUD_SOURCE = 'icloud';
const DB_COLUMNS =
  'id,title,start_time,end_time,location,external_id,calendar_color,rrule,recurrence_base_id,is_recurring';

const DEFAULT_EVENT_DURATION_MS =
  TIMING_CONSTANTS.calendar.defaultEventDurationMinutes *
  TIMING_CONSTANTS.timeConversions.minutesToMs;

interface CalendarEventRow {
  id: string;
  title: string;
  start_time: string;
  end_time: string | null;
  location: string | null;
  external_id: string | null;
  calendar_color: string | null;
  rrule: string | null;
  recurrence_base_id: string | null;
  is_recurring: boolean | null;
}

export interface AppleDbCalendarEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  location?: string;
  provider: 'apple';
  calendarColor?: string;
  rrule?: string;
  recurrenceBaseId?: string;
  isRecurring?: boolean;
  recurrenceAnchorStart?: string;
  recurrenceAnchorEnd?: string;
}

function resolveEndIso(start: string, end: string | null): string {
  if (end) return end;
  const startDate = parseCalendarEventTime(start);
  if (Number.isNaN(startDate.getTime())) return start;
  return new Date(startDate.getTime() + DEFAULT_EVENT_DURATION_MS).toISOString();
}

function mapRowToCalendarEvent(row: CalendarEventRow): AppleDbCalendarEvent {
  const endIso = resolveEndIso(row.start_time, row.end_time);
  const hasRecurrence = Boolean(row.rrule || row.is_recurring);

  return {
    id: row.id,
    title: row.title || 'Calendar Event',
    start: row.start_time,
    end: endIso,
    location: row.location ?? undefined,
    provider: 'apple',
    calendarColor: row.calendar_color ?? undefined,
    rrule: row.rrule ?? undefined,
    recurrenceBaseId: row.external_id ?? row.recurrence_base_id ?? undefined,
    isRecurring: hasRecurrence,
    recurrenceAnchorStart: row.start_time,
    recurrenceAnchorEnd: endIso,
  };
}

/**
 * Load iCloud calendar rows that may produce occurrences in [startDate, endDate].
 * RRULE expansion runs on the client via calendar-rrule-expansion.ts.
 */
export async function fetchAppleCalendarEventsFromDb(
  startDate: string,
  endDate: string,
): Promise<AppleDbCalendarEvent[]> {
  const overlapFilter =
    `and(rrule.is.null,start_time.lte.${endDate},or(end_time.gte.${startDate},end_time.is.null))`;
  const recurringFilter = `and(rrule.not.is.null,start_time.lte.${endDate})`;

  const { data, error } = await supabase
    .from('calendar_events')
    .select(DB_COLUMNS)
    .eq('source', ICLOUD_SOURCE)
    .or(`${recurringFilter},${overlapFilter}`)
    .order('start_time', { ascending: true })
    .limit(TIMING_CONSTANTS.calendar.dbQueryMaxRows);

  if (error) {
    logger.warn('[Apple Calendar] Direct DB fetch failed:', error.message);
    throw new Error(error.message);
  }

  return (data ?? [])
    .filter((row): row is CalendarEventRow => Boolean(row?.start_time))
    .map(mapRowToCalendarEvent);
}
