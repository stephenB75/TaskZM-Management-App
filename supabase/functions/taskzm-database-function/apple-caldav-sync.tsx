/**
 * Apple iCloud CalDAV Sync - One-Way Import
 * 
 * Imports events from Apple iCloud Calendar into TaskZM.
 * This is READ-ONLY - we never modify the user's calendar.
 * 
 * Flow:
 * 1. Authenticate with iCloud email + app-specific password
 * 2. Discover calendars via PROPFIND
 * 3. Fetch events using REPORT queries
 * 4. Convert VEVENT to TaskZM calendar events
 * 5. Store as read-only items with source="iCloud"
 */

import {
  DEFAULT_CALENDAR_TIMEZONE,
  normalizeCalDavTimeZone,
  wallClockInTimeZoneToUtcIso,
} from './calendar-timezone-utils.ts';

// Constants
const DEFAULT_TIMEZONE = DEFAULT_CALENDAR_TIMEZONE;
const MAX_RECURRENCE_ITERATIONS = 365; // Maximum iterations for recurring event expansion (1 year)
const CALENDAR_SYNC_PAST_DAYS = 365; // Days to look back when syncing calendar (to capture recurring events)
const CALENDAR_SYNC_FUTURE_DAYS = 90; // Days to look ahead when syncing calendar
/** Batch size for calendar_events upsert during CalDAV sync (reduces edge 546 timeouts). */
const CALDAV_DB_UPSERT_BATCH_SIZE = 50;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000; // 86400000 ms

// Module-level variable to store user's timezone (set during sync)
let currentUserTimezone = DEFAULT_TIMEZONE;

// Types
export interface AppleCalDAVCredentials {
  email: string;
  appPassword: string;
}

export interface DiscoveredCalendar {
  href: string;
  displayName: string;
  color?: string;
  ctag?: string;
}

export interface CalendarEvent {
  uid: string;
  summary: string;
  description?: string;
  dtstart: string;
  dtend: string;
  location?: string;
  lastModified?: string;
  calendarHref: string;
  calendarColor?: string;
  rrule?: string; // Original RRULE string for recurring events
  recurrenceBaseId?: string; // Links instances to base recurring event
  isRecurring?: boolean; // Flag indicating if this is a recurring event
}

export interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
  /** Set when we had to re-discover calendars (e.g. stored hrefs were only calendar-home); caller should persist selectedCalendars. */
  correctedCalendars?: DiscoveredCalendar[];
}

// Constants
const ICLOUD_CALDAV_URL = 'https://caldav.icloud.com';
const USER_AGENT = 'TaskZM/1.0 (CalDAV; +https://taskzm.app)';

/**
 * Clean and format the app-specific password
 */
function cleanPassword(password: string): string {
  return password.replace(/[\s-]/g, '');
}

/**
 * Create Basic Auth header
 */
function createAuthHeader(email: string, password: string): string {
  const cleanedPassword = cleanPassword(password);
  return `Basic ${btoa(`${email}:${cleanedPassword}`)}`;
}

/**
 * Make a CalDAV request with proper redirect handling
 */
async function caldavRequest(
  url: string,
  method: string,
  credentials: AppleCalDAVCredentials,
  body?: string,
  depth: string = '0',
  maxRedirects: number = 5
): Promise<{ status: number; body: string; finalUrl: string }> {
  let currentUrl = url;
  let redirectCount = 0;

  while (redirectCount < maxRedirects) {
    const headers: Record<string, string> = {
      'Authorization': createAuthHeader(credentials.email, credentials.appPassword),
      'User-Agent': USER_AGENT,
      'Depth': depth,
      'Accept': 'application/xml, text/xml, */*',
    };

    if (body) {
      headers['Content-Type'] = 'application/xml; charset=utf-8';
    }

    console.log(`CalDAV request: ${method} ${currentUrl}`);
    
    const response = await fetch(currentUrl, {
      method,
      headers,
      body,
      redirect: 'manual', // Handle redirects manually
    });

    console.log(`Response status: ${response.status}`);

    // Handle redirects manually to track the final URL
    if (response.status === 301 || response.status === 302 || response.status === 307 || response.status === 308) {
      const location = response.headers.get('Location');
      if (location) {
        // Handle relative redirects
        if (location.startsWith('/')) {
          const urlObj = new URL(currentUrl);
          currentUrl = `${urlObj.protocol}//${urlObj.host}${location}`;
        } else {
          currentUrl = location;
        }
        console.log(`Redirecting to: ${currentUrl}`);
        redirectCount++;
        continue;
      }
    }

    const responseBody = await response.text();
    return { status: response.status, body: responseBody, finalUrl: currentUrl };
  }

  throw new Error('Too many redirects');
}

/**
 * Extract all hrefs from XML response
 */
function extractAllHrefs(xml: string): string[] {
  const hrefs: string[] = [];
  const patterns = [
    /<href[^>]*>([^<]+)<\/href>/gi,
    /<D:href[^>]*>([^<]+)<\/D:href>/gi,
    /<d:href[^>]*>([^<]+)<\/d:href>/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(xml)) !== null) {
      if (match[1]) {
        hrefs.push(match[1].trim());
      }
    }
  }
  
  return [...new Set(hrefs)]; // Remove duplicates
}

/**
 * Extract href from XML response for a specific element
 */
function extractHref(xml: string, elementName: string): string | null {
  // Normalize the XML - remove newlines within tags
  const normalizedXml = xml.replace(/>\s+</g, '><');
  
  // Try various patterns that Apple CalDAV might return
  const patterns = [
    // Standard patterns
    new RegExp(`<${elementName}[^>]*>\\s*<href[^>]*>([^<]+)</href>`, 'i'),
    new RegExp(`<D:${elementName}[^>]*>\\s*<D:href[^>]*>([^<]+)</D:href>`, 'i'),
    new RegExp(`<d:${elementName}[^>]*>\\s*<d:href[^>]*>([^<]+)</d:href>`, 'i'),
    // CalDAV specific
    new RegExp(`<cal:${elementName}[^>]*>\\s*<D:href[^>]*>([^<]+)</D:href>`, 'i'),
    new RegExp(`<C:${elementName}[^>]*>\\s*<D:href[^>]*>([^<]+)</D:href>`, 'i'),
    // More flexible patterns
    new RegExp(`${elementName}[^>]*>[^<]*<[^:]*:?href[^>]*>([^<]+)<`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = normalizedXml.match(pattern) || xml.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return null;
}

/**
 * Discover the user's calendar home URL using multiple strategies
 */
export async function discoverCalendarHome(
  credentials: AppleCalDAVCredentials
): Promise<string | null> {
  console.log('=== Starting CalDAV discovery ===');
  console.log('Email:', credentials.email);
  
  // Strategy 1: Try the well-known endpoint with PROPFIND
  try {
    const result = await tryWellKnownDiscovery(credentials);
    if (result) {
      console.log('Strategy 1 (well-known) succeeded:', result);
      return result;
    }
  } catch (error) {
    console.log('Strategy 1 failed:', error);
  }

  // Strategy 2: Try direct principal discovery on numbered servers
  try {
    const result = await tryNumberedServerDiscovery(credentials);
    if (result) {
      console.log('Strategy 2 (numbered servers) succeeded:', result);
      return result;
    }
  } catch (error) {
    console.log('Strategy 2 failed:', error);
  }

  // Strategy 3: Try with OPTIONS request first to get server info
  try {
    const result = await tryOptionsDiscovery(credentials);
    if (result) {
      console.log('Strategy 3 (OPTIONS) succeeded:', result);
      return result;
    }
  } catch (error) {
    console.log('Strategy 3 failed:', error);
  }

  // Strategy 4: Try direct user-based URL pattern
  try {
    const result = await tryDirectUserDiscovery(credentials);
    if (result) {
      console.log('Strategy 4 (direct user URL) succeeded:', result);
      return result;
    }
  } catch (error) {
    console.log('Strategy 4 failed:', error);
  }

  throw new Error('Could not discover calendar. Please verify your iCloud email and app-specific password are correct.');
}

/**
 * Strategy 4: Try direct user-based URL patterns
 * Apple sometimes uses dsid-based URLs or direct user paths
 */
async function tryDirectUserDiscovery(credentials: AppleCalDAVCredentials): Promise<string | null> {
  const serverNumbers = ['01', '02', '03', '04', '05'];
  
  // Try to authenticate and find calendars via direct path guessing
  for (const num of serverNumbers) {
    const baseUrl = `https://p${num}-caldav.icloud.com`;
    
    // Try a direct PROPFIND on the base URL which sometimes returns the user's info
    try {
      const propfindBody = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:current-user-principal/>
    <D:resourcetype/>
  </D:prop>
</D:propfind>`;

      const response = await caldavRequest(
        baseUrl,
        'PROPFIND',
        credentials,
        propfindBody,
        '0'
      );

      if (response.status === 207) {
        console.log(`Direct discovery on p${num}: Got 207, checking response...`);
        console.log('Response preview:', response.body.substring(0, 1000));
        
        // Look for any calendar-related hrefs
        const hrefs = extractAllHrefs(response.body);
        for (const href of hrefs) {
          if (href.includes('/calendars/') || href.includes('/calendar/')) {
            const fullUrl = normalizeUrl(href, response.finalUrl);
            console.log(`Found potential calendar home: ${fullUrl}`);
            return fullUrl;
          }
        }
        
        // Check for principal and follow it
        const principalUrl = extractHref(response.body, 'current-user-principal');
        if (principalUrl) {
          const fullPrincipalUrl = normalizeUrl(principalUrl, response.finalUrl);
          console.log(`Found principal: ${fullPrincipalUrl}`);
          
          // Get calendar-home-set from principal
          const principalPropfind = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <C:calendar-home-set/>
  </D:prop>
</D:propfind>`;
          
          const principalResponse = await caldavRequest(
            fullPrincipalUrl,
            'PROPFIND',
            credentials,
            principalPropfind,
            '0'
          );
          
          if (principalResponse.status === 207) {
            const calendarHome = extractHref(principalResponse.body, 'calendar-home-set');
            if (calendarHome) {
              return normalizeUrl(calendarHome, principalResponse.finalUrl);
            }
          }
        }
      }
    } catch (error) {
      console.log(`Direct discovery on p${num} failed:`, error);
    }
  }

  return null;
}

/**
 * Strategy 1: Standard well-known discovery
 */
async function tryWellKnownDiscovery(credentials: AppleCalDAVCredentials): Promise<string | null> {
  const propfindBody = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:current-user-principal/>
    <C:calendar-home-set/>
  </D:prop>
</D:propfind>`;

  const response = await caldavRequest(
    `${ICLOUD_CALDAV_URL}/.well-known/caldav`,
    'PROPFIND',
    credentials,
    propfindBody,
    '0'
  );

  console.log('Well-known response:', response.status);
  console.log('Response preview:', response.body.substring(0, 1500));

  if (response.status === 401 || response.status === 403) {
    throw new Error('Authentication failed. Please check your email and app-specific password.');
  }

  // Try to find calendar-home-set directly
  let calendarHome = extractHref(response.body, 'calendar-home-set');
  if (calendarHome) {
    return normalizeUrl(calendarHome, response.finalUrl);
  }

  // Try to find current-user-principal
  const principalUrl = extractHref(response.body, 'current-user-principal');
  if (principalUrl) {
    console.log('Found principal URL:', principalUrl);
    const fullPrincipalUrl = normalizeUrl(principalUrl, response.finalUrl);
    
    // Fetch calendar-home-set from principal
    const principalResponse = await caldavRequest(
      fullPrincipalUrl,
      'PROPFIND',
      credentials,
      propfindBody,
      '0'
    );

    console.log('Principal response:', principalResponse.status);
    console.log('Principal body preview:', principalResponse.body.substring(0, 1500));

    calendarHome = extractHref(principalResponse.body, 'calendar-home-set');
    if (calendarHome) {
      return normalizeUrl(calendarHome, principalResponse.finalUrl);
    }
  }

  // Look for any href that might be a calendar home
  const hrefs = extractAllHrefs(response.body);
  for (const href of hrefs) {
    if (href.includes('/calendars/') || href.includes('/calendar/')) {
      return normalizeUrl(href, response.finalUrl);
    }
  }

  return null;
}

/**
 * Strategy 2: Try numbered iCloud servers (p01-p99)
 */
async function tryNumberedServerDiscovery(credentials: AppleCalDAVCredentials): Promise<string | null> {
  // Common iCloud server numbers
  const serverNumbers = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15'];
  
  const propfindBody = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:current-user-principal/>
    <C:calendar-home-set/>
  </D:prop>
</D:propfind>`;

  for (const num of serverNumbers) {
    try {
      const serverUrl = `https://p${num}-caldav.icloud.com`;
      console.log(`Trying server: ${serverUrl}`);
      
      const response = await caldavRequest(
        `${serverUrl}/.well-known/caldav`,
        'PROPFIND',
        credentials,
        propfindBody,
        '0'
      );

      if (response.status === 207) {
        const calendarHome = extractHref(response.body, 'calendar-home-set');
        if (calendarHome) {
          return normalizeUrl(calendarHome, response.finalUrl);
        }

        const principalUrl = extractHref(response.body, 'current-user-principal');
        if (principalUrl) {
          const fullPrincipalUrl = normalizeUrl(principalUrl, response.finalUrl);
          const principalResponse = await caldavRequest(
            fullPrincipalUrl,
            'PROPFIND',
            credentials,
            propfindBody,
            '0'
          );

          const home = extractHref(principalResponse.body, 'calendar-home-set');
          if (home) {
            return normalizeUrl(home, principalResponse.finalUrl);
          }
        }
      }
    } catch (error) {
      // Continue to next server
      console.log(`Server p${num} failed, trying next...`);
    }
  }

  return null;
}

/**
 * Strategy 3: Use OPTIONS to discover capabilities first
 */
async function tryOptionsDiscovery(credentials: AppleCalDAVCredentials): Promise<string | null> {
  const response = await caldavRequest(
    `${ICLOUD_CALDAV_URL}/`,
    'OPTIONS',
    credentials,
    undefined,
    '0'
  );

  console.log('OPTIONS response status:', response.status);
  console.log('OPTIONS final URL:', response.finalUrl);

  if (response.status === 200 || response.status === 204) {
    // The final URL after OPTIONS might give us a clue
    if (response.finalUrl !== `${ICLOUD_CALDAV_URL}/`) {
      // Try PROPFIND on the final URL
      const propfindBody = `<?xml version="1.0" encoding="utf-8"?>
<D:propfind xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
  <D:prop>
    <D:current-user-principal/>
    <C:calendar-home-set/>
  </D:prop>
</D:propfind>`;

      const propfindResponse = await caldavRequest(
        response.finalUrl,
        'PROPFIND',
        credentials,
        propfindBody,
        '0'
      );

      const calendarHome = extractHref(propfindResponse.body, 'calendar-home-set');
      if (calendarHome) {
        return normalizeUrl(calendarHome, propfindResponse.finalUrl);
      }
    }
  }

  return null;
}

/**
 * Normalize a URL (handle relative URLs)
 */
function normalizeUrl(url: string, baseUrl: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  const base = new URL(baseUrl);
  if (url.startsWith('/')) {
    return `${base.protocol}//${base.host}${url}`;
  }

  return `${base.protocol}//${base.host}/${url}`;
}

/**
 * Returns true if href is the calendar home collection (e.g. .../218434715/calendars/).
 * REPORT (calendar-query) is only valid on individual calendar resources; iCloud returns 403 for the home.
 * Stored credentials from before we filtered discovery may still contain this URL.
 */
function isCalendarHomeUrl(href: string): boolean {
  try {
    const u = new URL(href);
    const path = u.pathname.replace(/\/$/, '');
    return path.endsWith('/calendars');
  } catch {
    return false;
  }
}

/**
 * Discover all calendars for the user
 */
export async function discoverCalendars(
  credentials: AppleCalDAVCredentials,
  calendarHomeUrl?: string
): Promise<DiscoveredCalendar[]> {
  // Get calendar home if not provided
  const homeUrl = calendarHomeUrl || await discoverCalendarHome(credentials);
  if (!homeUrl) {
    throw new Error('Could not discover calendar home');
  }

  const fullHomeUrl = homeUrl.startsWith('http') 
    ? homeUrl 
    : `${ICLOUD_CALDAV_URL}${homeUrl}`;

  // PROPFIND to list calendars
  const listCalendarsBody = `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav" xmlns:apple="http://apple.com/ns/ical/">
  <prop>
    <displayname/>
    <cal:calendar-description/>
    <apple:calendar-color/>
    <getctag xmlns="http://calendarserver.org/ns/"/>
    <resourcetype/>
  </prop>
</propfind>`;

  const response = await caldavRequest(
    fullHomeUrl,
    'PROPFIND',
    credentials,
    listCalendarsBody,
    '1'
  );

  if (response.status !== 207) {
    console.error('Failed to list calendars:', response.status, response.body.substring(0, 500));
    throw new Error(`Failed to list calendars: ${response.status}`);
  }

  // Parse calendars from response
  const calendars: DiscoveredCalendar[] = [];
  
  // Match each response element
  const responsePattern = /<response[^>]*>[\s\S]*?<\/response>/gi;
  const responses = response.body.match(responsePattern) || [];

  // Normalize calendar home URL for comparison (no trailing slash)
  const normalizedHome = fullHomeUrl.replace(/\/$/, '');

  for (const resp of responses) {
    // Check if it's a calendar (has calendar resourcetype)
    if (!resp.includes('calendar') || resp.includes('schedule-inbox') || resp.includes('schedule-outbox')) {
      continue;
    }

    // Extract href and normalize to full URL so we use the same host (e.g. p02-caldav.icloud.com) when fetching events.
    // Relative hrefs (e.g. 218434715/calendars/primary) would otherwise be resolved with ICLOUD_CALDAV_URL and get 403.
    const hrefMatch = resp.match(/<href[^>]*>([^<]+)<\/href>/i);
    if (!hrefMatch) continue;
    const rawHref = hrefMatch[1].trim();
    const fullHref = rawHref.startsWith('http') ? rawHref : normalizeUrl(rawHref, response.finalUrl);

    // Skip the calendar home collection itself (e.g. .../218434715/calendars/). REPORT (calendar-query) is only valid on
    // individual calendar resources (e.g. .../calendars/primary); iCloud returns 403 when REPORT is sent to the collection.
    const normalizedHref = fullHref.replace(/\/$/, '');
    if (normalizedHref === normalizedHome) continue;

    // Extract display name
    const displayNameMatch = resp.match(/<displayname[^>]*>([^<]*)<\/displayname>/i);
    
    // Extract color
    const colorMatch = resp.match(/<calendar-color[^>]*>([^<]*)<\/calendar-color>/i);
    
    // Extract ctag
    const ctagMatch = resp.match(/<getctag[^>]*>([^<]*)<\/getctag>/i);

    calendars.push({
      href: fullHref,
      displayName: displayNameMatch?.[1] || 'Untitled Calendar',
      color: colorMatch?.[1],
      ctag: ctagMatch?.[1],
    });
  }

  return calendars;
}

/**
 * Fetch events from a specific calendar
 */
export async function fetchCalendarEvents(
  credentials: AppleCalDAVCredentials,
  calendarHref: string,
  startDate?: Date,
  endDate?: Date
): Promise<CalendarEvent[]> {
  const fullUrl = calendarHref.startsWith('http')
    ? calendarHref
    : `${ICLOUD_CALDAV_URL}${calendarHref}`;

  // Use a very wide date range to ensure we capture all events, including:
  // - Base recurring events that started long ago
  // - Events that were recently added or modified
  // - Events that might be outside the typical viewing range
  // This ensures sync captures all changes (additions, updates, deletions)
  const start = startDate || new Date(Date.now() - (CALENDAR_SYNC_PAST_DAYS * MILLISECONDS_PER_DAY));
  const end = endDate || new Date(Date.now() + (CALENDAR_SYNC_FUTURE_DAYS * MILLISECONDS_PER_DAY));
  
  console.log(`Fetching events from ${start.toISOString()} to ${end.toISOString()}`);

  // Format dates for CalDAV
  const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  // REPORT query to fetch events
  // Note: We do NOT use <cal:expand> because iCloud doesn't support it well
  // Instead we parse RRULE and expand recurring events client-side
  const reportBody = `<?xml version="1.0" encoding="utf-8"?>
<cal:calendar-query xmlns="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <prop>
    <getetag/>
    <cal:calendar-data/>
  </prop>
  <cal:filter>
    <cal:comp-filter name="VCALENDAR">
      <cal:comp-filter name="VEVENT">
        <cal:time-range start="${formatDate(start)}" end="${formatDate(end)}"/>
      </cal:comp-filter>
    </cal:comp-filter>
  </cal:filter>
</cal:calendar-query>`;

  const response = await caldavRequest(
    fullUrl,
    'REPORT',
    credentials,
    reportBody,
    '1'
  );

  if (response.status !== 207) {
    console.error('Failed to fetch events:', response.status, response.body.substring(0, 500));
    throw new Error(`Failed to fetch events: ${response.status}`);
  }

  // Parse events from response
  const events: CalendarEvent[] = [];
  
  // Match calendar-data elements (with or without XML namespace prefix, e.g. cal:calendar-data or calendar-data)
  const calDataPattern = /<(?:[a-zA-Z0-9]+:)?calendar-data[^>]*>([\s\S]*?)<\/(?:[a-zA-Z0-9]+:)?calendar-data>/gi;
  let match;

  while ((match = calDataPattern.exec(response.body)) !== null) {
    const icalData = match[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"');

    // parseVEvent returns base events only (recurring not expanded during sync)
    const parsedEvents = parseVEvent(icalData, calendarHref, start, end);
    events.push(...parsedEvents);
  }

  if (events.length === 0 && response.body.length > 0) {
    console.warn('[Calendar Sync] No calendar-data blocks parsed from CalDAV response. Response may use a different XML namespace (e.g. cal:calendar-data). Body length:', response.body.length, 'Sample:', response.body.substring(0, 300));
  }

  // Deduplicate events to prevent duplicates from recurring event expansion
  const deduplicatedEvents = deduplicateEvents(events);
  
  console.log(`Fetched ${deduplicatedEvents.length} events (${events.length} before deduplication)`);
  return deduplicatedEvents;
}

/**
 * Format a date to ISO string (always UTC with Z suffix)
 * This ensures consistent timezone handling across all events
 */
function formatDatePreservingTimezone(date: Date, _isUtc: boolean): string {
  // Always output in UTC format for consistent timezone handling
  return date.toISOString();
}

/**
 * Deduplicate calendar events based on start time, end time, and title
 * This prevents duplicate recurring event instances
 */
function deduplicateEvents(events: CalendarEvent[]): CalendarEvent[] {
  const seen = new Map<string, CalendarEvent>();
  
  for (const event of events) {
    // Create a unique key from start time, end time, and title
    // This identifies duplicate occurrences of the same recurring event
    const key = `${event.dtstart}_${event.dtend}_${event.summary}`;
    
    // Only keep the first occurrence of each unique event
    if (!seen.has(key)) {
      seen.set(key, event);
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Parse RRULE and expand recurring events
 */
function expandRecurringEvent(
  baseEvent: CalendarEvent,
  rrule: string,
  rangeStart: Date,
  rangeEnd: Date,
  recurrenceBaseId?: string
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  
  // Parse RRULE parts
  const parts: Record<string, string> = {};
  rrule.split(';').forEach(part => {
    const [key, value] = part.split('=');
    if (key && value) parts[key] = value;
  });
  
  const freq = parts['FREQ'];
  const interval = parseInt(parts['INTERVAL'] || '1', 10);
  const count = parts['COUNT'] ? parseInt(parts['COUNT'], 10) : undefined;
  const until = parts['UNTIL'];
  const byDay = parts['BYDAY'];
  const byMonthDay = parts['BYMONTHDAY'];
  
  // Parse base event start time
  const baseStart = new Date(baseEvent.dtstart);
  const baseEnd = new Date(baseEvent.dtend);
  const duration = baseEnd.getTime() - baseStart.getTime();
  
  // Calculate until date
  let untilDate = rangeEnd;
  if (until) {
    // Parse UNTIL date (format: 20251231T235959Z or 20251231)
    if (until.length >= 8) {
      const year = parseInt(until.substring(0, 4), 10);
      const month = parseInt(until.substring(4, 6), 10) - 1;
      const day = parseInt(until.substring(6, 8), 10);
      let hour = 23, minute = 59, second = 59;
      if (until.length >= 15) {
        hour = parseInt(until.substring(9, 11), 10);
        minute = parseInt(until.substring(11, 13), 10);
        second = parseInt(until.substring(13, 15), 10);
      }
      untilDate = new Date(Date.UTC(year, month, day, hour, minute, second));
    }
  }
  
  // Limit iterations to prevent infinite loops
  const maxIterations = count || MAX_RECURRENCE_ITERATIONS;
  let iterations = 0;
  let currentDate = new Date(baseStart);
  
  while (currentDate <= untilDate && currentDate <= rangeEnd && iterations < maxIterations) {
    // Check if this occurrence is within range
    if (currentDate >= rangeStart && currentDate <= rangeEnd) {
      const endDate = new Date(currentDate.getTime() + duration);
      const eventUid = `${baseEvent.uid}_${currentDate.toISOString().replace(/[-:TZ.]/g, '').substring(0, 14)}`;
      
      events.push({
        ...baseEvent,
        uid: eventUid,
        dtstart: formatDatePreservingTimezone(currentDate, true),
        dtend: formatDatePreservingTimezone(endDate, true),
        // Preserve recurrence metadata for all instances
        rrule: baseEvent.rrule || rrule, // Ensure RRULE is preserved
        recurrenceBaseId: recurrenceBaseId || baseEvent.uid, // Link to base event
        isRecurring: true, // All instances are part of recurring series
      });
    }
    
    // Move to next occurrence (always UTC — dtstart/dtend are UTC instants after parseDate)
    switch (freq) {
      case 'DAILY':
        currentDate.setUTCDate(currentDate.getUTCDate() + interval);
        break;
      case 'WEEKLY':
        currentDate.setUTCDate(currentDate.getUTCDate() + (7 * interval));
        break;
      case 'MONTHLY':
        if (byMonthDay) {
          const targetDay = parseInt(byMonthDay, 10);
          currentDate.setUTCMonth(currentDate.getUTCMonth() + interval);
          currentDate.setUTCDate(Math.min(targetDay, new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 0)).getUTCDate()));
        } else {
          currentDate.setUTCMonth(currentDate.getUTCMonth() + interval);
        }
        break;
      case 'YEARLY':
        currentDate.setUTCFullYear(currentDate.getUTCFullYear() + interval);
        break;
      default:
        iterations = maxIterations;
    }
    
    iterations++;
  }
  
  return events;
}

/**
 * Parse a VEVENT from iCalendar data - returns array for recurring events
 */
function parseVEvent(
  icalData: string, 
  calendarHref: string,
  rangeStart?: Date,
  rangeEnd?: Date
): CalendarEvent[] {
  // Extract VEVENT block
  const veventMatch = icalData.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/i);
  if (!veventMatch) return [];

  const vevent = veventMatch[0];

  // Helper to extract property value only
  const getProp = (name: string): string | undefined => {
    const regex = new RegExp(`^${name}[;:](.*)$`, 'mi');
    const match = vevent.match(regex);
    if (!match) return undefined;
    
    // Handle properties with parameters (e.g., DTSTART;VALUE=DATE:20231225)
    let value = match[1];
    if (value.includes(':')) {
      value = value.split(':').pop() || value;
    }
    
    // Handle line folding (continued lines start with space or tab)
    return value.replace(/\r?\n[ \t]/g, '');
  };

  // Helper to extract property with full line (to get TZID parameter)
  const getPropWithParams = (name: string): { value: string; tzid?: string } | undefined => {
    const regex = new RegExp(`^${name}([;:].*)$`, 'mi');
    const match = vevent.match(regex);
    if (!match) return undefined;
    
    const fullValue = match[1].replace(/\r?\n[ \t]/g, '');
    
    // Extract TZID if present (e.g., ;TZID=America/New_York:20231225T100000)
    // Handle both quoted and unquoted TZIDs
    const tzidMatch = fullValue.match(/TZID="?([^":;]+)"?/i);
    let tzid = tzidMatch ? tzidMatch[1].trim() : undefined;
    
    // Clean up any remaining quotes or spaces
    if (tzid) {
      tzid = tzid.replace(/["']/g, '').trim();
    }
    
    // Extract the actual value after the colon
    const colonIndex = fullValue.lastIndexOf(':');
    const value = colonIndex >= 0 ? fullValue.substring(colonIndex + 1) : fullValue;
    
    return { value, tzid };
  };

  const baseUid = getProp('UID');
  const summary = getProp('SUMMARY');
  const dtstartData = getPropWithParams('DTSTART');
  const dtendData = getPropWithParams('DTEND');
  const rrule = getProp('RRULE');
  const recurrenceId = getProp('RECURRENCE-ID');

  // Log missing required fields for debugging
  if (!baseUid || !summary || !dtstartData) {
    console.warn('Skipping event due to missing required fields:', {
      hasUid: !!baseUid,
      hasSummary: !!summary,
      hasDtstart: !!dtstartData,
      calendarHref,
    });
    return [];
  }

  const dtstart = dtstartData.value;
  const dtstartTzid = dtstartData.tzid;

  // Parse dates - properly handle timezone and convert to UTC for storage
  // Browser will convert from UTC to user's local timezone when displaying
  const parseDate = (dateStr: string, tzid?: string): string => {
    // Check if already has Z (UTC)
    const isUtc = dateStr.endsWith('Z');
    const cleanDateStr = isUtc ? dateStr.slice(0, -1) : dateStr;
    
    // Handle DATE-TIME format (e.g., 20231225T100000 or 20231225T100000Z)
    if (cleanDateStr.length >= 15 && cleanDateStr.includes('T')) {
      const year = cleanDateStr.substring(0, 4);
      const month = cleanDateStr.substring(4, 6);
      const day = cleanDateStr.substring(6, 8);
      const hour = cleanDateStr.substring(9, 11);
      const minute = cleanDateStr.substring(11, 13);
      const second = cleanDateStr.length >= 15 ? cleanDateStr.substring(13, 15) : '00';
      
      const yearNum = parseInt(year, 10);
      const monthNum = parseInt(month, 10) - 1; // JS months are 0-indexed
      const dayNum = parseInt(day, 10);
      const hourNum = parseInt(hour, 10);
      const minuteNum = parseInt(minute, 10);
      const secondNum = parseInt(second, 10);

      const convertToUTC = (targetTzid: string): string => {
        const normalized = normalizeCalDavTimeZone(targetTzid, currentUserTimezone || DEFAULT_TIMEZONE);
        return wallClockInTimeZoneToUtcIso(
          yearNum,
          monthNum,
          dayNum,
          hourNum,
          minuteNum,
          secondNum,
          normalized,
          currentUserTimezone || DEFAULT_TIMEZONE,
        );
      };

      // TZID wins over a Z suffix (some feeds incorrectly mark local wall times as UTC)
      if (tzid) {
        return convertToUTC(tzid);
      }

      // Explicit UTC (Z suffix, no TZID): keep wall-clock components as UTC
      if (isUtc) {
        return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
      }

      // No TZID and no Z = floating/local time — use the user's browser timezone from sync
      console.log(`Parsing floating time ${dateStr} with user timezone: ${currentUserTimezone}`);
      return convertToUTC(currentUserTimezone || DEFAULT_TIMEZONE);
    }
    
    // Handle DATE format (e.g., 20231225) - all-day events
    // Convert midnight on this date in user's timezone to UTC so the correct day shows in all timezones
    if (cleanDateStr.length === 8) {
      const yr = parseInt(cleanDateStr.substring(0, 4), 10);
      const mo = parseInt(cleanDateStr.substring(4, 6), 10) - 1; // 0-indexed
      const dy = parseInt(cleanDateStr.substring(6, 8), 10);
      const tzid = currentUserTimezone || DEFAULT_TIMEZONE;
      try {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: tzid,
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric',
          hour12: false,
        });
        for (let offsetHours = -12; offsetHours <= 14; offsetHours++) {
          const testUTC = new Date(Date.UTC(yr, mo, dy, -offsetHours, 0, 0));
          const parts = formatter.formatToParts(testUTC);
          const getPart = (type: string): number => {
            const part = parts.find((p: { type: string }) => p.type === type);
            return part ? parseInt(part.value, 10) : 0;
          };
          const tzYear = getPart('year');
          const tzMonth = getPart('month');
          const tzDay = getPart('day');
          const tzHour = getPart('hour');
          const tzMin = getPart('minute');
          if (tzYear === yr && tzMonth === mo + 1 && tzDay === dy && tzHour === 0 && tzMin === 0) {
            return testUTC.toISOString();
          }
        }
      } catch (e) {
        console.warn(`All-day date conversion failed for ${cleanDateStr}, using UTC midnight:`, e);
      }
      return `${cleanDateStr.substring(0, 4)}-${cleanDateStr.substring(4, 6)}-${cleanDateStr.substring(6, 8)}T00:00:00.000Z`;
    }
    
    return dateStr;
  };

  const parsedDtstart = parseDate(dtstart, dtstartTzid);
  const dtendValue = dtendData?.value || dtstart;
  const dtendTzid = dtendData?.tzid || dtstartTzid;
  
  // For already-expanded recurring events (server sent RECURRENCE-ID), create unique ID
  const uid = recurrenceId 
    ? `${baseUid}_${parsedDtstart.replace(/[-:TZ]/g, '')}`
    : baseUid;

  // Determine if this is a recurring event
  const isRecurring = !!rrule && !recurrenceId;
  const baseUidForRecurrence = baseUid; // Store original UID for recurrence linking

  const baseEvent: CalendarEvent = {
    uid,
    summary: summary.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\\\/g, '\\'),
    description: getProp('DESCRIPTION')?.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\\\/g, '\\'),
    dtstart: parsedDtstart,
    dtend: parseDate(dtendValue, dtendTzid),
    location: getProp('LOCATION')?.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\\\/g, '\\'),
    lastModified: getProp('LAST-MODIFIED') ? parseDate(getProp('LAST-MODIFIED')!) : undefined,
    calendarHref,
    rrule: isRecurring ? rrule : undefined, // Preserve RRULE for recurring events
    recurrenceBaseId: recurrenceId ? baseUidForRecurrence : undefined, // Link instances to base
    isRecurring: isRecurring, // Flag for recurring events
  };

  // For recurring events, DO NOT expand during sync
  // Store only the base event with RRULE, expand on-demand when fetching
  // This ensures we can generate occurrences for any date range
  if (rrule && !recurrenceId) {
    // Return only the base recurring event (not expanded)
    // The expansion will happen on-demand in getAppleEventsFromDatabase
    return [baseEvent];
  }

  return [baseEvent];
}

/**
 * Test connection with credentials
 */
export async function testConnection(
  credentials: AppleCalDAVCredentials
): Promise<{ success: boolean; message: string; calendars?: DiscoveredCalendar[] }> {
  try {
    const calendars = await discoverCalendars(credentials);
    return {
      success: true,
      message: `Successfully connected! Found ${calendars.length} calendar(s).`,
      calendars,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Connection failed';
    return {
      success: false,
      message,
    };
  }
}

/**
 * Sync events from selected calendars to database
 * @param userTimezone - User's timezone from browser (e.g., 'America/New_York', 'America/Los_Angeles')
 */
export interface SyncCalendarsOptions {
  /** Sync only this calendar href (one CalDAV REPORT per edge request). */
  singleCalendarHref?: string;
  /** Skip deletion pass (use on per-calendar sync; run once on final calendar). */
  skipDeletions?: boolean;
  /** Pre-known calendar colors from stored credentials (skips discovery when provided). */
  calendarColors?: Record<string, string>;
}

export async function syncCalendarsToDatabase(
  supabase: any,
  userId: string,
  workspaceId: string,
  credentials: AppleCalDAVCredentials,
  selectedCalendarHrefs: string[],
  userTimezone: string = DEFAULT_TIMEZONE,
  options: SyncCalendarsOptions = {},
): Promise<SyncResult> {
  // Store the user timezone for use in date parsing
  currentUserTimezone = userTimezone;
  console.log(`Syncing with user timezone: ${userTimezone}`);
  
  const result: SyncResult = {
    success: true,
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [],
  };

  try {
    const calendarColorMap = new Map<string, string>();
    if (options.calendarColors) {
      for (const [href, color] of Object.entries(options.calendarColors)) {
        if (href && color) {
          calendarColorMap.set(href, color);
        }
      }
    }

    let hrefsToFetch = selectedCalendarHrefs.filter((href) => {
      if (isCalendarHomeUrl(href)) {
        console.warn('[Calendar Sync] Skipping calendar home URL (REPORT not allowed):', href);
        return false;
      }
      return true;
    });

    if (options.singleCalendarHref) {
      hrefsToFetch = [options.singleCalendarHref];
    }

    if (calendarColorMap.size === 0) {
      const allCalendars = await discoverCalendars(credentials);
      for (const cal of allCalendars) {
        if (cal.color) {
          calendarColorMap.set(cal.href, cal.color);
        }
      }
    }
    if (hrefsToFetch.length === 0) {
      // Stored selection was only the calendar home; re-discover to get real calendars (caller should persist)
      console.log('[Calendar Sync] Stored selection was invalid; re-discovering calendars');
      const rediscovered = await discoverCalendars(credentials);
      hrefsToFetch = rediscovered.map((cal) => cal.href);
      if (hrefsToFetch.length === 0) {
        result.success = false;
        result.errors.push('No calendars found. Please check your iCloud account.');
        return result;
      }
      result.correctedCalendars = rediscovered;
    }

    // Fetch events from each selected calendar
    const allEvents: CalendarEvent[] = [];

    for (const href of hrefsToFetch) {
      try {
        console.log(`[Calendar Sync] Fetching events from calendar: ${href}`);
        const events = await fetchCalendarEvents(credentials, href);
        console.log(`[Calendar Sync] Fetched ${events.length} events from calendar ${href}`);
        
        // Add calendar color to each event
        const calendarColor = calendarColorMap.get(href);
        for (const event of events) {
          event.calendarColor = calendarColor;
        }
        allEvents.push(...events);
      } catch (error) {
        const message = `Failed to fetch from ${href}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(message);
        console.error(`[Calendar Sync] ${message}`, error);
      }
    }
    
    console.log(`[Calendar Sync] Total events fetched from all calendars: ${allEvents.length}`);

    // Deduplicate events before syncing to database
    // This prevents duplicate recurring event instances from being stored
    const deduplicatedEvents = deduplicateEvents(allEvents);
    console.log(`Syncing ${deduplicatedEvents.length} unique events (${allEvents.length} before deduplication)`);

    // Get existing synced events for this user
    // Include calendar_href to properly filter deletions by synced calendars
    const { data: existingEvents, error: fetchError } = await supabase
      .from('calendar_events')
      .select('id, external_id, external_updated_at, calendar_href')
      .eq('user_id', userId)
      .eq('source', 'icloud');

    if (fetchError) {
      result.errors.push(`Failed to fetch existing events: ${fetchError.message}`);
      result.success = false;
      return result;
    }

    // Build map of existing events by external_id (which should match event UID for base events)
    // For recurring events, external_id should be the base UID
    const existingMap = new Map(
      (existingEvents || []).map((e: any) => [e.external_id, e])
    );
    
    // For fetched events, use base UID for recurring events (same format as external_id)
    // This ensures we can properly match and detect deletions
    const fetchedUids = new Set(deduplicatedEvents.map(e => {
      // For base recurring events, use the event UID (which is stored as external_id)
      // For instances (shouldn't happen now, but handle for safety), use base UID
      // This should match the external_id format in the database
      return e.recurrenceBaseId || e.uid;
    }));

    // Build rows and upsert in batches (avoids 170 sequential DB round-trips → edge 546).
    console.log(`[Calendar Sync] Upserting ${deduplicatedEvents.length} events in batches...`);
    const rowsToUpsert: Record<string, unknown>[] = [];
    const nowIso = new Date().toISOString();

    for (const event of deduplicatedEvents) {
      if (!event.uid || !event.summary || !event.dtstart || !event.dtend) {
        result.errors.push(`Event missing required fields: ${event.uid || 'unknown'}`);
        continue;
      }

      const matchKey = event.recurrenceBaseId || event.uid;
      const externalId = matchKey;
      if (existingMap.has(matchKey)) {
        result.updated++;
      } else {
        result.created++;
      }

      rowsToUpsert.push({
        user_id: userId,
        workspace_id: workspaceId,
        external_id: externalId,
        title: event.summary,
        description: event.description ?? null,
        start_time: event.dtstart,
        end_time: event.dtend,
        location: event.location ?? null,
        source: 'icloud',
        calendar_href: event.calendarHref,
        calendar_color: event.calendarColor ?? null,
        external_updated_at: event.lastModified ?? null,
        rrule: event.rrule ?? null,
        recurrence_base_id: event.recurrenceBaseId ?? null,
        is_recurring: event.isRecurring ?? false,
        is_readonly: true,
        updated_at: nowIso,
      });
    }

    for (let i = 0; i < rowsToUpsert.length; i += CALDAV_DB_UPSERT_BATCH_SIZE) {
      const batch = rowsToUpsert.slice(i, i + CALDAV_DB_UPSERT_BATCH_SIZE);
      const { error: upsertError } = await supabase
        .from('calendar_events')
        .upsert(batch, { onConflict: 'user_id,source,external_id' });

      if (upsertError) {
        result.errors.push(`Batch upsert failed: ${upsertError.message}`);
        console.error('[Calendar Sync] Batch upsert error:', upsertError);
      }
    }

    if (!options.skipDeletions) {
    // Only delete events from calendars that were synced (selectedCalendarHrefs)
    // This prevents deleting events from calendars that weren't included in this sync
    const syncedCalendarHrefs = new Set(selectedCalendarHrefs);
    
    // Compare external_id from DB with fetched event UIDs
    for (const [externalId, existing] of existingMap) {
      // Check if this external_id exists in the fetched events
      // external_id should match the event UID for base events
      if (!fetchedUids.has(externalId)) {
        // Only delete if this event is from a calendar that was synced
        // This prevents accidental deletion of events from unsynced calendars
        if (existing.calendar_href && syncedCalendarHrefs.has(existing.calendar_href)) {
          // Event was deleted from iCloud - remove from database
          const { error: deleteError } = await supabase
            .from('calendar_events')
            .delete()
            .eq('id', existing.id);

          if (deleteError) {
            result.errors.push(`Failed to delete event ${externalId}: ${deleteError.message}`);
          } else {
            result.deleted++;
            console.log(`Deleted event ${externalId} from calendar ${existing.calendar_href} (no longer in iCloud)`);
          }
        } else {
          // Event is from a calendar that wasn't synced - skip deletion
          console.debug(`Skipping deletion of event ${externalId} - not from synced calendar (href: ${existing.calendar_href})`);
        }
      }
    }
    }

    if (result.errors.length > 0) {
      result.success = false;
    }

    // Log sync result
    console.log('CalDAV sync completed:', {
      userId,
      created: result.created,
      updated: result.updated,
      deleted: result.deleted,
      errors: result.errors.length,
    });

    return result;
  } catch (error) {
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : 'Sync failed');
    return result;
  }
}

