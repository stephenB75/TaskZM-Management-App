/**
 * Correct recurring calendar occurrence times for display (Kanban, Today Agenda, etc.).
 * Backend expansion may preserve UTC hour across DST; this re-applies the anchor wall-clock
 * time on each occurrence's local calendar date.
 */

import { supabase } from './supabase-client';
import { getWallClockInTimeZone, wallClockInTimeZoneToUtcIso } from './calendar-timezone-utils';
import { parseCalendarEventTime } from './utils';
import { logger } from './logger';

export interface RecurringOccurrenceInput {
  start: string;
  end: string;
  isRecurring?: boolean;
  recurrenceBaseId?: string;
  recurrenceAnchorStart?: string;
  recurrenceAnchorEnd?: string;
}

export interface RecurringOccurrenceOutput {
  start: string;
  end: string;
  recurrenceAnchorStart?: string;
  recurrenceAnchorEnd?: string;
}

export interface RecurrenceAnchorRecord {
  start: string;
  end: string;
}

/** Load base-series start/end from calendar_events when the API omits anchor fields. */
export async function fetchRecurrenceAnchorsFromDatabase(
  recurrenceBaseIds: string[],
): Promise<Map<string, RecurrenceAnchorRecord>> {
  const uniqueIds = [...new Set(recurrenceBaseIds.filter(Boolean))];
  const anchors = new Map<string, RecurrenceAnchorRecord>();
  if (uniqueIds.length === 0) return anchors;

  try {
    const { data, error } = await supabase
      .from('calendar_events')
      .select('external_id, start_time, end_time')
      .in('external_id', uniqueIds);

    if (error) {
      logger.warn('Failed to load recurrence anchors from calendar_events:', error.message);
      return anchors;
    }

    for (const row of data ?? []) {
      if (!row?.external_id || !row.start_time || !row.end_time) continue;
      anchors.set(row.external_id, {
        start: String(row.start_time),
        end: String(row.end_time),
      });
    }
  } catch (error) {
    logger.warn('Error loading recurrence anchors:', error);
  }

  return anchors;
}

/**
 * Re-apply the anchor event's local time-of-day to this occurrence's calendar date.
 * No-op when anchor fields are missing or the event is not recurring.
 */
export function correctRecurringOccurrenceTimes(
  event: RecurringOccurrenceInput,
  timeZone: string,
): RecurringOccurrenceOutput {
  if (!event.isRecurring || !event.recurrenceAnchorStart) {
    return {
      start: event.start,
      end: event.end,
      recurrenceAnchorStart: event.recurrenceAnchorStart,
      recurrenceAnchorEnd: event.recurrenceAnchorEnd,
    };
  }

  const anchorStart = parseCalendarEventTime(event.recurrenceAnchorStart);
  const occurrenceStart = parseCalendarEventTime(event.start);
  if (Number.isNaN(anchorStart.getTime()) || Number.isNaN(occurrenceStart.getTime())) {
    return {
      start: event.start,
      end: event.end,
      recurrenceAnchorStart: event.recurrenceAnchorStart,
      recurrenceAnchorEnd: event.recurrenceAnchorEnd,
    };
  }

  const anchorWall = getWallClockInTimeZone(anchorStart, timeZone);
  const correctedStartIso = wallClockInTimeZoneToUtcIso(
    occurrenceStart.getFullYear(),
    occurrenceStart.getMonth(),
    occurrenceStart.getDate(),
    anchorWall.hour,
    anchorWall.minute,
    anchorWall.second,
    timeZone,
  );

  let durationMs = 0;
  if (event.recurrenceAnchorEnd) {
    const anchorEnd = parseCalendarEventTime(event.recurrenceAnchorEnd);
    if (!Number.isNaN(anchorEnd.getTime())) {
      durationMs = anchorEnd.getTime() - anchorStart.getTime();
    }
  }
  if (durationMs <= 0 && event.end) {
    const occurrenceEnd = parseCalendarEventTime(event.end);
    if (!Number.isNaN(occurrenceEnd.getTime())) {
      durationMs = occurrenceEnd.getTime() - occurrenceStart.getTime();
    }
  }
  if (durationMs <= 0) {
    return {
      start: correctedStartIso,
      end: event.end,
      recurrenceAnchorStart: event.recurrenceAnchorStart,
      recurrenceAnchorEnd: event.recurrenceAnchorEnd,
    };
  }

  const correctedEndIso = new Date(parseCalendarEventTime(correctedStartIso).getTime() + durationMs).toISOString();
  return {
    start: correctedStartIso,
    end: correctedEndIso,
    recurrenceAnchorStart: event.recurrenceAnchorStart,
    recurrenceAnchorEnd: event.recurrenceAnchorEnd,
  };
}

/** Resolve anchors (API or DB) and correct recurring occurrence times for display. */
export async function applyRecurrenceTimeCorrections<T extends RecurringOccurrenceInput>(
  events: T[],
  timeZone: string,
): Promise<T[]> {
  const missingAnchorIds = events
    .filter((event) => event.isRecurring && event.recurrenceBaseId && !event.recurrenceAnchorStart)
    .map((event) => event.recurrenceBaseId as string);

  const dbAnchors = await fetchRecurrenceAnchorsFromDatabase(missingAnchorIds);
  if (dbAnchors.size === 0 && missingAnchorIds.length === 0) {
    return events.map((event) => {
      if (!event.isRecurring) return event;
      const corrected = correctRecurringOccurrenceTimes(event, timeZone);
      return { ...event, ...corrected };
    });
  }

  return events.map((event) => {
    if (!event.isRecurring) return event;

    let recurrenceAnchorStart = event.recurrenceAnchorStart;
    let recurrenceAnchorEnd = event.recurrenceAnchorEnd;
    if (!recurrenceAnchorStart && event.recurrenceBaseId) {
      const dbAnchor = dbAnchors.get(event.recurrenceBaseId);
      if (dbAnchor) {
        recurrenceAnchorStart = dbAnchor.start;
        recurrenceAnchorEnd = dbAnchor.end;
      }
    }

    const corrected = correctRecurringOccurrenceTimes(
      {
        ...event,
        recurrenceAnchorStart,
        recurrenceAnchorEnd,
      },
      timeZone,
    );

    return {
      ...event,
      start: corrected.start,
      end: corrected.end,
      recurrenceAnchorStart: corrected.recurrenceAnchorStart,
      recurrenceAnchorEnd: corrected.recurrenceAnchorEnd,
    };
  });
}
