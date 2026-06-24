/**
 * Correct recurring calendar occurrence times for display (Kanban, Today Agenda, etc.).
 * Backend expansion may preserve UTC hour across DST; this re-applies the anchor wall-clock
 * time on each occurrence's local calendar date.
 */

import { getWallClockInTimeZone, wallClockInTimeZoneToUtcIso } from './calendar-timezone-utils';
import { parseCalendarEventTime } from './utils';

export interface RecurringOccurrenceInput {
  start: string;
  end: string;
  isRecurring?: boolean;
  recurrenceAnchorStart?: string;
  recurrenceAnchorEnd?: string;
}

export interface RecurringOccurrenceOutput {
  start: string;
  end: string;
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
    return { start: event.start, end: event.end };
  }

  const anchorStart = parseCalendarEventTime(event.recurrenceAnchorStart);
  const occurrenceStart = parseCalendarEventTime(event.start);
  if (Number.isNaN(anchorStart.getTime()) || Number.isNaN(occurrenceStart.getTime())) {
    return { start: event.start, end: event.end };
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
    return { start: correctedStartIso, end: event.end };
  }

  const correctedEndIso = new Date(parseCalendarEventTime(correctedStartIso).getTime() + durationMs).toISOString();
  return { start: correctedStartIso, end: correctedEndIso };
}
