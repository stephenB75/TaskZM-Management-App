/**
 * Calendar timezone utilities (browser).
 * Converts wall-clock times in an IANA timezone to UTC for calendar event display.
 */

import { DEFAULT_FALLBACK_TIMEZONE } from './timing-constants';

/** Minutes to search each direction when resolving wall-clock → UTC (covers all current UTC offsets). */
const WALL_CLOCK_SEARCH_RANGE_MINUTES = 18 * 60;

/** Wall-clock date/time components in an IANA timezone (monthIndex is 0-based). */
export interface WallClockParts {
  year: number;
  monthIndex: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

export function resolveValidIanaTimeZone(timeZone: string, fallback: string = DEFAULT_FALLBACK_TIMEZONE): string {
  for (const candidate of [timeZone, fallback, DEFAULT_FALLBACK_TIMEZONE, 'UTC']) {
    if (!candidate) continue;
    try {
      Intl.DateTimeFormat(undefined, { timeZone: candidate });
      return candidate;
    } catch {
      // try next
    }
  }
  return 'UTC';
}

/** Extract local wall-clock components from a UTC instant in `timeZone`. */
export function getWallClockInTimeZone(date: Date, timeZone: string): WallClockParts {
  const validTz = resolveValidIanaTimeZone(timeZone);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: validTz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string): number => parseInt(parts.find((p) => p.type === type)?.value ?? '0', 10);
  let hour = get('hour');
  if (hour === 24) hour = 0;
  return {
    year: get('year'),
    monthIndex: get('month') - 1,
    day: get('day'),
    hour,
    minute: get('minute'),
    second: get('second'),
  };
}

/**
 * Convert a wall-clock local time in `timeZone` to a UTC ISO-8601 string (with Z).
 * `monthIndex` is 0-based (JavaScript Date style).
 */
export function wallClockInTimeZoneToUtcIso(
  year: number,
  monthIndex: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
  fallbackTimeZone: string = DEFAULT_FALLBACK_TIMEZONE,
): string {
  const validTz = resolveValidIanaTimeZone(timeZone, fallbackTimeZone);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: validTz,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  });

  const matchesWallClock = (date: Date): boolean => {
    const formatted = formatter.formatToParts(date);
    const get = (type: string): number => {
      const value = formatted.find((p) => p.type === type)?.value;
      return value ? parseInt(value, 10) : -1;
    };
    let h = get('hour');
    if (h === 24) h = 0;
    return (
      get('year') === year &&
      get('month') === monthIndex + 1 &&
      get('day') === day &&
      h === hour &&
      get('minute') === minute &&
      get('second') === second
    );
  };

  const naiveUtcMs = Date.UTC(year, monthIndex, day, hour, minute, second);

  for (let deltaMin = -WALL_CLOCK_SEARCH_RANGE_MINUTES; deltaMin <= WALL_CLOCK_SEARCH_RANGE_MINUTES; deltaMin++) {
    const candidate = new Date(naiveUtcMs - deltaMin * 60_000);
    if (matchesWallClock(candidate)) {
      return candidate.toISOString();
    }
  }

  return new Date(naiveUtcMs).toISOString();
}
