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

