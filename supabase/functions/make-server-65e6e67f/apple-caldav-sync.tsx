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
}

export interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

// Constants
const ICLOUD_CALDAV_URL = 'https://caldav.icloud.com';
const USER_AGENT = 'TaskZM-CalDAV-Client/1.0';

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
 * Make a CalDAV request
 */
async function caldavRequest(
  url: string,
  method: string,
  credentials: AppleCalDAVCredentials,
  body?: string,
  depth: string = '0'
): Promise<{ status: number; body: string }> {
  const headers: Record<string, string> = {
    'Authorization': createAuthHeader(credentials.email, credentials.appPassword),
    'User-Agent': USER_AGENT,
    'Depth': depth,
  };

  if (body) {
    headers['Content-Type'] = 'application/xml; charset=utf-8';
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
    redirect: 'follow',
  });

  const responseBody = await response.text();
  return { status: response.status, body: responseBody };
}

/**
 * Discover the user's calendar home URL
 */
export async function discoverCalendarHome(
  credentials: AppleCalDAVCredentials
): Promise<string | null> {
  // Step 1: Hit the well-known endpoint to get principal URL
  const wellKnownBody = `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:">
  <prop>
    <current-user-principal/>
  </prop>
</propfind>`;

  const wellKnownResponse = await caldavRequest(
    `${ICLOUD_CALDAV_URL}/.well-known/caldav`,
    'PROPFIND',
    credentials,
    wellKnownBody
  );

  if (wellKnownResponse.status === 401 || wellKnownResponse.status === 403) {
    throw new Error('Authentication failed. Please check your email and app-specific password.');
  }

  // Parse principal URL from response
  const principalMatch = wellKnownResponse.body.match(/<current-user-principal>[\s\S]*?<href>([^<]+)<\/href>/i);
  if (!principalMatch) {
    // Try alternative pattern
    const altMatch = wellKnownResponse.body.match(/<D:current-user-principal>[\s\S]*?<D:href>([^<]+)<\/D:href>/i);
    if (!altMatch) {
      console.error('Could not find principal URL in response:', wellKnownResponse.body.substring(0, 500));
      throw new Error('Could not discover calendar principal URL');
    }
    return altMatch[1];
  }

  const principalUrl = principalMatch[1];

  // Step 2: Get calendar home from principal
  const calendarHomeBody = `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
  <prop>
    <cal:calendar-home-set/>
  </prop>
</propfind>`;

  const fullPrincipalUrl = principalUrl.startsWith('http') 
    ? principalUrl 
    : `${ICLOUD_CALDAV_URL}${principalUrl}`;

  const principalResponse = await caldavRequest(
    fullPrincipalUrl,
    'PROPFIND',
    credentials,
    calendarHomeBody
  );

  // Parse calendar home URL
  const homeMatch = principalResponse.body.match(/<calendar-home-set>[\s\S]*?<href>([^<]+)<\/href>/i);
  if (!homeMatch) {
    const altHomeMatch = principalResponse.body.match(/<cal:calendar-home-set>[\s\S]*?<D:href>([^<]+)<\/D:href>/i);
    if (!altHomeMatch) {
      console.error('Could not find calendar home in response:', principalResponse.body.substring(0, 500));
      throw new Error('Could not discover calendar home URL');
    }
    return altHomeMatch[1];
  }

  return homeMatch[1];
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

  for (const resp of responses) {
    // Check if it's a calendar (has calendar resourcetype)
    if (!resp.includes('calendar') || resp.includes('schedule-inbox') || resp.includes('schedule-outbox')) {
      continue;
    }

    // Extract href
    const hrefMatch = resp.match(/<href[^>]*>([^<]+)<\/href>/i);
    if (!hrefMatch) continue;

    // Extract display name
    const displayNameMatch = resp.match(/<displayname[^>]*>([^<]*)<\/displayname>/i);
    
    // Extract color
    const colorMatch = resp.match(/<calendar-color[^>]*>([^<]*)<\/calendar-color>/i);
    
    // Extract ctag
    const ctagMatch = resp.match(/<getctag[^>]*>([^<]*)<\/getctag>/i);

    calendars.push({
      href: hrefMatch[1],
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

  // Default to 30 days in past and 90 days in future
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const end = endDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  // Format dates for CalDAV
  const formatDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  // REPORT query to fetch events
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
  
  // Match calendar-data elements containing VEVENT
  const calDataPattern = /<calendar-data[^>]*>([\s\S]*?)<\/calendar-data>/gi;
  let match;

  while ((match = calDataPattern.exec(response.body)) !== null) {
    const icalData = match[1]
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"');

    const event = parseVEvent(icalData, calendarHref);
    if (event) {
      events.push(event);
    }
  }

  return events;
}

/**
 * Parse a VEVENT from iCalendar data
 */
function parseVEvent(icalData: string, calendarHref: string): CalendarEvent | null {
  // Extract VEVENT block
  const veventMatch = icalData.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/i);
  if (!veventMatch) return null;

  const vevent = veventMatch[0];

  // Helper to extract property
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

  const uid = getProp('UID');
  const summary = getProp('SUMMARY');
  const dtstart = getProp('DTSTART');

  if (!uid || !summary || !dtstart) {
    return null;
  }

  // Parse dates
  const parseDate = (dateStr: string): string => {
    // Handle DATE-TIME format (e.g., 20231225T100000Z)
    if (dateStr.length >= 15) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      const hour = dateStr.substring(9, 11);
      const minute = dateStr.substring(11, 13);
      const second = dateStr.substring(13, 15);
      return `${year}-${month}-${day}T${hour}:${minute}:${second}Z`;
    }
    // Handle DATE format (e.g., 20231225)
    if (dateStr.length === 8) {
      const year = dateStr.substring(0, 4);
      const month = dateStr.substring(4, 6);
      const day = dateStr.substring(6, 8);
      return `${year}-${month}-${day}T00:00:00Z`;
    }
    return dateStr;
  };

  return {
    uid,
    summary: summary.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\\\/g, '\\'),
    description: getProp('DESCRIPTION')?.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\\\/g, '\\'),
    dtstart: parseDate(dtstart),
    dtend: parseDate(getProp('DTEND') || dtstart),
    location: getProp('LOCATION')?.replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\\\/g, '\\'),
    lastModified: getProp('LAST-MODIFIED') ? parseDate(getProp('LAST-MODIFIED')!) : undefined,
    calendarHref,
  };
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
 */
export async function syncCalendarsToDatabase(
  supabase: any,
  userId: string,
  workspaceId: string,
  credentials: AppleCalDAVCredentials,
  selectedCalendarHrefs: string[]
): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [],
  };

  try {
    // Fetch events from each selected calendar
    const allEvents: CalendarEvent[] = [];
    
    for (const href of selectedCalendarHrefs) {
      try {
        const events = await fetchCalendarEvents(credentials, href);
        allEvents.push(...events);
      } catch (error) {
        const message = `Failed to fetch from ${href}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(message);
        console.error(message);
      }
    }

    // Get existing synced events for this user
    const { data: existingEvents, error: fetchError } = await supabase
      .from('calendar_events')
      .select('id, external_id, external_updated_at')
      .eq('user_id', userId)
      .eq('source', 'icloud');

    if (fetchError) {
      result.errors.push(`Failed to fetch existing events: ${fetchError.message}`);
      result.success = false;
      return result;
    }

    const existingMap = new Map(
      (existingEvents || []).map((e: any) => [e.external_id, e])
    );
    const fetchedUids = new Set(allEvents.map(e => e.uid));

    // Process each fetched event
    for (const event of allEvents) {
      const existing = existingMap.get(event.uid);
      
      if (existing) {
        // Check if update needed
        if (event.lastModified && existing.external_updated_at !== event.lastModified) {
          const { error: updateError } = await supabase
            .from('calendar_events')
            .update({
              title: event.summary,
              description: event.description,
              start_time: event.dtstart,
              end_time: event.dtend,
              location: event.location,
              external_updated_at: event.lastModified,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) {
            result.errors.push(`Failed to update event ${event.uid}: ${updateError.message}`);
          } else {
            result.updated++;
          }
        }
      } else {
        // Create new event
        const { error: insertError } = await supabase
          .from('calendar_events')
          .insert({
            user_id: userId,
            workspace_id: workspaceId,
            external_id: event.uid,
            title: event.summary,
            description: event.description,
            start_time: event.dtstart,
            end_time: event.dtend,
            location: event.location,
            source: 'icloud',
            calendar_href: event.calendarHref,
            external_updated_at: event.lastModified,
            is_readonly: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          result.errors.push(`Failed to create event ${event.uid}: ${insertError.message}`);
        } else {
          result.created++;
        }
      }
    }

    // Handle deletions - events that exist in DB but not in iCloud
    for (const [uid, existing] of existingMap) {
      if (!fetchedUids.has(uid)) {
        const { error: deleteError } = await supabase
          .from('calendar_events')
          .delete()
          .eq('id', existing.id);

        if (deleteError) {
          result.errors.push(`Failed to delete event ${uid}: ${deleteError.message}`);
        } else {
          result.deleted++;
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

