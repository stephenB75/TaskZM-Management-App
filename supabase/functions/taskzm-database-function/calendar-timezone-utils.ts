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
