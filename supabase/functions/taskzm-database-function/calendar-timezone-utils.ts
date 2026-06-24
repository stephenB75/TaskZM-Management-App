/**
 * Calendar timezone utilities for edge functions (CalDAV / API sync).
 * Converts wall-clock times in an IANA timezone to UTC ISO strings for timestamptz storage.
 */

export const DEFAULT_CALENDAR_TIMEZONE = 'America/New_York';

/** Minutes to search each direction when resolving wall-clock → UTC (covers all current UTC offsets). */
const WALL_CLOCK_SEARCH_RANGE_MINUTES = 18 * 60;

/** True when an ISO timestamp string carries an explicit UTC or offset suffix. */
export function isUtcIsoTimestamp(iso: string | null | undefined): boolean {
  if (!iso) return false;
  const s = iso.trim();
  if (/Z$/i.test(s)) return true;
  if (/[+-]00:00(?::00)?$/i.test(s)) return true;
  if (/[+-]0000$/i.test(s)) return true;
  return false;
}

/**
 * Normalize CalDAV TZID values (IANA, GMT offsets, abbreviations) to a valid IANA timezone.
 */
export function normalizeCalDavTimeZone(tzid: string | undefined, fallback: string): string {
  const clean = (tzid || '').trim().replace(/["']/g, '');
  if (!clean) return resolveValidIanaTimeZone(fallback);

  if (clean.includes('/')) {
    return resolveValidIanaTimeZone(clean, fallback);
  }

  const gmtMatch = clean.match(/^GMT([+-])(\d{2})(\d{2})$/i);
  if (gmtMatch) {
    const sign = gmtMatch[1];
    const hours = parseInt(gmtMatch[2], 10);
    const minutes = parseInt(gmtMatch[3], 10);
    const totalOffsetMinutes = (sign === '+' ? 1 : -1) * (hours * 60 + minutes);

    if (totalOffsetMinutes === -300 || totalOffsetMinutes === -240) return 'America/New_York';
    if (totalOffsetMinutes === -360) return 'America/Chicago';
    if (totalOffsetMinutes === -420) return 'America/Denver';
    if (totalOffsetMinutes === -480) return 'America/Los_Angeles';
    if (totalOffsetMinutes === 0) return 'UTC';
  }

  const abbrevMap: Record<string, string> = {
    EST: 'America/New_York',
    EDT: 'America/New_York',
    CST: 'America/Chicago',
    CDT: 'America/Chicago',
    MST: 'America/Denver',
    MDT: 'America/Denver',
    PST: 'America/Los_Angeles',
    PDT: 'America/Los_Angeles',
    UTC: 'UTC',
    GMT: 'UTC',
  };

  const mapped = abbrevMap[clean.toUpperCase()];
  if (mapped) return mapped;

  return resolveValidIanaTimeZone(fallback);
}

export function resolveValidIanaTimeZone(timeZone: string, fallback: string = DEFAULT_CALENDAR_TIMEZONE): string {
  for (const candidate of [timeZone, fallback, DEFAULT_CALENDAR_TIMEZONE, 'UTC']) {
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
  fallbackTimeZone: string = DEFAULT_CALENDAR_TIMEZONE,
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
    const parts = formatter.formatToParts(date);
    const get = (type: string): number => {
      const value = parts.find((p) => p.type === type)?.value;
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

  console.warn(
    `wallClockInTimeZoneToUtcIso: could not resolve ${year}-${monthIndex + 1}-${day} ` +
      `${hour}:${minute}:${second} in ${validTz}; storing naive UTC`,
  );
  return new Date(naiveUtcMs).toISOString();
}

/** Wall-clock date/time components in an IANA timezone (monthIndex is 0-based). */
export interface WallClockParts {
  year: number;
  monthIndex: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
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

/** Days in a civil calendar month (timezone-agnostic month lengths). */
export function calendarDaysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Convert wall-clock parts in `timeZone` to a UTC Date instant. */
export function wallClockPartsToUtcDate(parts: WallClockParts, timeZone: string): Date {
  return new Date(
    wallClockInTimeZoneToUtcIso(
      parts.year,
      parts.monthIndex,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      timeZone,
    ),
  );
}

/** Advance a civil calendar date by `days`, preserving time-of-day. */
export function addCalendarDays(parts: WallClockParts, days: number): WallClockParts {
  const d = new Date(Date.UTC(parts.year, parts.monthIndex, parts.day + days));
  return {
    year: d.getUTCFullYear(),
    monthIndex: d.getUTCMonth(),
    day: d.getUTCDate(),
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/** Advance a civil calendar date by `months`, preserving time-of-day (handles BYMONTHDAY clamp). */
export function addCalendarMonths(
  parts: WallClockParts,
  months: number,
  byMonthDay?: number,
): WallClockParts {
  let monthIndex = parts.monthIndex + months;
  let year = parts.year;
  while (monthIndex > 11) {
    monthIndex -= 12;
    year++;
  }
  while (monthIndex < 0) {
    monthIndex += 12;
    year--;
  }
  const day = byMonthDay ?? parts.day;
  const maxDay = calendarDaysInMonth(year, monthIndex);
  return {
    year,
    monthIndex,
    day: Math.min(day, maxDay),
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

/** Advance a civil calendar date by `years`, preserving time-of-day. */
export function addCalendarYears(
  parts: WallClockParts,
  years: number,
  byMonthDay?: number,
): WallClockParts {
  const year = parts.year + years;
  const day = byMonthDay ?? parts.day;
  const maxDay = calendarDaysInMonth(year, parts.monthIndex);
  return {
    year,
    monthIndex: parts.monthIndex,
    day: Math.min(day, maxDay),
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}
