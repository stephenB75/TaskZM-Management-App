/**
 * CalDAV Client for Apple Calendar/iCloud
 * Handles CalDAV protocol operations for calendar sync
 */

interface CalDAVCredentials {
  url: string;
  username: string;
  password: string;
}

interface CalDAVEvent {
  uid: string;
  dtstart: string;
  dtend: string;
  summary: string;
  description?: string;
  location?: string;
}

/**
 * Clean app-specific password (remove spaces, keep dashes)
 * App-specific passwords format: xxxx-xxxx-xxxx-xxxx
 */
function cleanAppPassword(password: string): string {
  return password.replace(/\s/g, '');
}

/**
 * Test CalDAV connection
 * Returns detailed error message if connection fails
 * For iCloud, tries multiple URL formats if the base URL returns 404
 */
export async function testCalDAVConnection(
  url: string,
  username: string,
  password: string
): Promise<{ success: boolean; error?: string; workingUrl?: string }> {
  try {
    // Clean the password
    const cleanPassword = cleanAppPassword(password);
    
    // Ensure URL is properly formatted
    let testUrl = url.trim();
    if (!testUrl.endsWith('/')) {
      testUrl += '/';
    }
    // If a username path was appended, also keep the bare origin as first attempt
    let baseOrigin: string | null = null;
    try {
      const u = new URL(testUrl);
      baseOrigin = `${u.protocol}//${u.host}/`;
    } catch {}

    // For iCloud, try multiple URL formats if base URL fails
    // Start with the most common working format first
    const testUrls: string[] = [];
    
    // If it's iCloud, try alternative formats in order of likelihood
    if (testUrl.includes('caldav.icloud.com') || testUrl.includes('icloud.com')) {
      // Extract username part (before @) for iCloud-specific URLs
      const usernamePart = username.split('@')[0];
      const encodedUsername = encodeURIComponent(username);
      const encodedUsernamePart = encodeURIComponent(usernamePart);
      
      // Try comprehensive list of iCloud CalDAV URL formats
      // Order matters - try most common formats first
      // iCloud uses different URL structures based on account type and region
      testUrls.push(
        // Base origin (often works when user path 404s)
        ...(baseOrigin ? [baseOrigin] : []),
        // Well-known discovery
        ...(baseOrigin ? [`${baseOrigin}.well-known/caldav/`] : []),
        // Principal-based
        ...(baseOrigin ? [`${baseOrigin}principals/`] : []),
        ...(baseOrigin ? [`${baseOrigin}principals/${encodedUsername}/`] : []),
        ...(baseOrigin ? [`${baseOrigin}principals/${encodedUsernamePart}/`] : []),
        // User paths
        ...(baseOrigin ? [`${baseOrigin}users/${encodedUsername}/`] : []),
        ...(baseOrigin ? [`${baseOrigin}users/${encodedUsernamePart}/`] : []),
        // Most common working format (try this first)
        `https://caldav.icloud.com/${encodedUsername}/`,
        
        // Alternative username formats
        `https://caldav.icloud.com/${usernamePart}/`,
        `https://caldav.icloud.com/${encodedUsernamePart}/`,
        
        // Base URL (original)
        testUrl,
        
        // Principal-based formats (often work for iCloud)
        `https://caldav.icloud.com/`,
        
        // Calendar-specific paths
        `https://caldav.icloud.com/${usernamePart}/calendars/`,
        `https://caldav.icloud.com/${encodedUsername}/calendars/`,
        
        // Server-specific formats (for some account types)
        `https://p${usernamePart.charAt(0).toLowerCase()}${usernamePart.slice(1)}-caldav.icloud.com/`,
        
        // Alternative base URLs with port
        `https://caldav.icloud.com:443/`,
        `https://caldav.icloud.com:443/${usernamePart}/`,
        `https://caldav.icloud.com:443/${encodedUsername}/`,
      );
    } else {
      // For non-iCloud, just use the provided URL
      testUrls.push(testUrl);
    }

    let lastError: string | null = null;
    let lastStatus: number | null = null;

    // Try each URL format
    for (const testUrlToTry of testUrls) {
      try {
        console.log(`🔍 Trying CalDAV URL: ${testUrlToTry}`);
        
        // Perform PROPFIND request to discover calendar
        // Try with enhanced XML namespace declarations
        // For iCloud, we need to try different approaches
        let response: Response;
        
        // First, try a simple OPTIONS request to check if the endpoint exists
        if (testUrlToTry.includes('caldav.icloud.com')) {
          try {
            const optionsResponse = await fetch(testUrlToTry, {
              method: 'OPTIONS',
              headers: {
                'Authorization': `Basic ${btoa(`${username}:${cleanPassword}`)}`,
                'User-Agent': 'TaskZM-CalDAV-Client/1.0',
              },
            });
            
            // If OPTIONS returns 200/207, the endpoint exists
            if (optionsResponse.ok || optionsResponse.status === 207) {
              console.log(`✅ OPTIONS request successful for ${testUrlToTry}`);
            }
          } catch (e) {
            // OPTIONS failed, continue with PROPFIND
          }
        }
        
        // Now try PROPFIND
        response = await fetch(testUrlToTry, {
          method: 'PROPFIND',
          headers: {
            'Authorization': `Basic ${btoa(`${username}:${cleanPassword}`)}`,
            'Depth': '0',
            'Content-Type': 'application/xml; charset=utf-8',
            'User-Agent': 'TaskZM-CalDAV-Client/1.0',
          },
          body: `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
  <prop>
    <cal:calendar-home-set/>
    <current-user-principal/>
    <displayname/>
    <resourcetype/>
  </prop>
</propfind>`,
        });

        // PROPFIND can return 207 (Multi-Status) which is also success
        if (response.ok || response.status === 207) {
          // Success! Return the working URL
          const workingUrl = testUrlToTry;
          if (workingUrl !== testUrl) {
            console.log(`✅ CalDAV connection successful with alternative URL: ${workingUrl}`);
          } else {
            console.log(`✅ CalDAV connection successful with base URL: ${workingUrl}`);
          }
          return { success: true, workingUrl };
        }

        // Track error details
        lastStatus = response.status;
        const statusText = response.statusText;
        let responseText = '';
        try {
          const text = await response.text();
          responseText = text.substring(0, 300); // Limit length
        } catch (e) {
          // Ignore text read errors
        }
        lastError = `Connection failed (${lastStatus} ${statusText})${responseText ? ': ' + responseText : ''}`;

        // Log the attempt
        console.log(`❌ CalDAV URL ${testUrlToTry} returned ${lastStatus} ${statusText}`);

        // If it's authentication error (401/403), stop trying - credentials are wrong
        if (lastStatus === 401 || lastStatus === 403) {
          console.log(`⚠️ Authentication failed (${lastStatus}) - stopping attempts`);
          break; // Auth failed, no point trying other URLs
        }
        
        // If it's not a 404 or 405, stop trying (likely server error)
        if (lastStatus !== 404 && lastStatus !== 405) {
          console.log(`⚠️ Stopping URL attempts - non-404/405 error: ${lastStatus}`);
          break;
        }

        // For 404 or 405 (Method Not Allowed), try next URL format
        console.log(`🔄 Trying next alternative URL format...`);
      } catch (fetchError) {
        // Network error, try next URL
        console.log(`CalDAV fetch error for ${testUrlToTry}:`, fetchError);
        if (!lastError) {
          lastError = fetchError instanceof Error ? fetchError.message : String(fetchError);
        }
      }
    }

    // All URLs failed, return detailed error
    let errorMessage = lastError || 'Connection failed';

    // Get more details from the last response if available
    if (lastStatus) {
      // Provide specific error messages for common issues
      if (lastStatus === 401 || lastStatus === 403) {
        errorMessage = 'Authentication failed. Please check your iCloud email and app-specific password. Make sure you copied the entire password without spaces.';
      } else if (lastStatus === 404) {
        errorMessage = 'CalDAV endpoint not found. This may indicate:\n' +
          '1. Your iCloud account may not have CalDAV enabled\n' +
          '2. The CalDAV URL format may have changed\n' +
          '3. Please verify your iCloud email is correct\n' +
          '4. Try enabling CalDAV in your iCloud account settings';
      } else if (lastStatus === 500 || lastStatus === 502 || lastStatus === 503) {
        errorMessage = 'iCloud server error. Please try again in a few moments.';
      }
    }

    console.log('CalDAV connection test failed after trying all URLs:', {
      status: lastStatus,
      error: lastError,
      urlsTried: testUrls,
      username,
    });

    return { success: false, error: errorMessage };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.log('CalDAV connection test exception:', errorMessage);
    
    // Provide user-friendly error message
    let friendlyMessage = 'Failed to connect to iCloud CalDAV server.';
    if (errorMessage.includes('fetch')) {
      friendlyMessage = 'Network error. Please check your internet connection and try again.';
    } else if (errorMessage.includes('Invalid URL')) {
      friendlyMessage = 'Invalid CalDAV URL. Please use https://caldav.icloud.com';
    }
    
    return { success: false, error: friendlyMessage };
  }
}

/**
 * Discover calendar URL
 * For iCloud, tries multiple URL formats if base URL fails
 */
export async function discoverCalendarURL(
  credentials: CalDAVCredentials
): Promise<string | null> {
  try {
    // Clean the password
    const cleanPassword = cleanAppPassword(credentials.password);
    
    // Ensure URL is properly formatted
    let testUrl = credentials.url.trim();
    if (!testUrl.endsWith('/')) {
      testUrl += '/';
    }

    // For iCloud, try multiple URL formats if base URL fails
    // Start with the most common working format first
    const testUrls: string[] = [];
    
    // If it's iCloud, try alternative formats in order of likelihood
    if (testUrl.includes('caldav.icloud.com') || testUrl.includes('icloud.com')) {
      // Extract username part (before @) for iCloud-specific URLs
      const usernamePart = credentials.username.split('@')[0];
      const encodedUsername = encodeURIComponent(credentials.username);
      const encodedUsernamePart = encodeURIComponent(usernamePart);
      
      // Try comprehensive list of iCloud CalDAV URL formats
      // Order matters - try most common formats first
      // iCloud uses different URL structures based on account type and region
      testUrls.push(
        // Most common working format (try this first)
        `https://caldav.icloud.com/${encodedUsername}/`,
        
        // Alternative username formats
        `https://caldav.icloud.com/${usernamePart}/`,
        `https://caldav.icloud.com/${encodedUsernamePart}/`,
        
        // Base URL (original)
        testUrl,
        
        // Principal-based formats (often work for iCloud)
        `https://caldav.icloud.com/`,
        
        // Calendar-specific paths
        `https://caldav.icloud.com/${usernamePart}/calendars/`,
        `https://caldav.icloud.com/${encodedUsername}/calendars/`,
        
        // Server-specific formats (for some account types)
        `https://p${usernamePart.charAt(0).toLowerCase()}${usernamePart.slice(1)}-caldav.icloud.com/`,
        
        // Alternative base URLs with port
        `https://caldav.icloud.com:443/`,
        `https://caldav.icloud.com:443/${usernamePart}/`,
        `https://caldav.icloud.com:443/${encodedUsername}/`,
      );
    } else {
      // For non-iCloud, just use the provided URL
      testUrls.push(testUrl);
    }

    let workingUrl: string | null = null;

    // Try each URL format
    for (const urlToTry of testUrls) {
      try {
        console.log(`🔍 Discovering calendar URL: ${urlToTry}`);
        
        // First, get calendar home set with enhanced XML
        const homeSetResponse = await fetch(urlToTry, {
          method: 'PROPFIND',
          headers: {
            'Authorization': `Basic ${btoa(`${credentials.username}:${cleanPassword}`)}`,
            'Depth': '0',
            'Content-Type': 'application/xml; charset=utf-8',
            'User-Agent': 'TaskZM-CalDAV-Client/1.0',
          },
          body: `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
  <prop>
    <cal:calendar-home-set/>
    <current-user-principal/>
    <displayname/>
  </prop>
</propfind>`,
        });

        // PROPFIND can return 207 (Multi-Status) which is also success
        if (homeSetResponse.ok || homeSetResponse.status === 207) {
          workingUrl = urlToTry;
          console.log(`✅ Found working CalDAV URL: ${urlToTry}`);
          break; // Found working URL
        }

        // If it's authentication error (401/403), stop trying - credentials are wrong
        if (homeSetResponse.status === 401 || homeSetResponse.status === 403) {
          console.log(`⚠️ Authentication failed (${homeSetResponse.status}) - stopping discovery`);
          break; // Auth failed, no point trying other URLs
        }
        
        // Allow 400 to continue; stop on other errors
        if (homeSetResponse.status !== 404 && homeSetResponse.status !== 405 && homeSetResponse.status !== 400) {
          console.log(`⚠️ Stopping discovery - non-404/405/400 error: ${homeSetResponse.status}`);
          break;
        }

        console.log(`🔄 CalDAV discovery URL returned ${homeSetResponse.status}, trying alternative: ${urlToTry}`);
      } catch (fetchError) {
        // Network error, try next URL
        console.log(`CalDAV discovery fetch error for ${urlToTry}:`, fetchError);
      }
    }

    if (!workingUrl) {
      console.log('CalDAV discovery failed: no working URL found');
      return null;
    }

    // Use the working URL for discovery
    const homeSetResponse = await fetch(workingUrl, {
      method: 'PROPFIND',
      headers: {
        'Authorization': `Basic ${btoa(`${credentials.username}:${cleanPassword}`)}`,
        'Depth': '0',
        'Content-Type': 'application/xml',
      },
      body: `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:">
  <prop>
    <calendar-home-set xmlns="urn:ietf:params:xml:ns:caldav"/>
  </prop>
</propfind>`,
    });

    if (!homeSetResponse.ok) {
      return null;
    }

    const homeSetText = await homeSetResponse.text();
    
    // Parse calendar home set URL
    const homeSetMatch = homeSetText.match(/<calendar-home-set[^>]*>.*?<href[^>]*>([^<]+)<\/href>/s);
    if (!homeSetMatch) {
      // Fallback: try to construct URL from username
      const baseUrl = credentials.url.replace(/\/$/, '');
      return `${baseUrl}/${encodeURIComponent(credentials.username)}/calendars/`;
    }

    let calendarHomeURL = homeSetMatch[1];
    
    // Make absolute URL if relative
    if (calendarHomeURL.startsWith('/')) {
      const urlObj = new URL(credentials.url);
      calendarHomeURL = `${urlObj.protocol}//${urlObj.host}${calendarHomeURL}`;
    } else if (!calendarHomeURL.startsWith('http')) {
      const urlObj = new URL(credentials.url);
      calendarHomeURL = `${urlObj.protocol}//${urlObj.host}/${calendarHomeURL}`;
    }

    // Now discover calendars
    const calendarsResponse = await fetch(calendarHomeURL, {
      method: 'PROPFIND',
      headers: {
        'Authorization': `Basic ${btoa(`${credentials.username}:${cleanPassword}`)}`,
        'Depth': '1',
        'Content-Type': 'application/xml; charset=utf-8',
        'User-Agent': 'TaskZM-CalDAV-Client/1.0',
      },
      body: `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
  <prop>
    <displayname/>
    <resourcetype/>
    <cal:calendar-description/>
    <cal:calendar-timezone/>
  </prop>
</propfind>`,
    });

    if (!calendarsResponse.ok) {
      return calendarHomeURL; // Return home URL as fallback
    }

    const calendarsText = await calendarsResponse.text();
    
    // Parse XML to find calendars (not just any href)
    // iCloud returns multiple responses in a multistatus, we need to find ones with calendar resource type
    // Split by response blocks - handle both D:response and response (no prefix)
    const responseBlocks = calendarsText.split(/<(?:D:)?response[^>]*>/i);
    
    for (const block of responseBlocks) {
      // Skip empty blocks
      if (!block.trim()) continue;
      
      // Check if this response has a calendar resource type
      // Handle various namespace formats: D:resourcetype, resourcetype, cal:calendar, calendar
      const hasCalendar = /<(?:D:)?resourcetype[^>]*>[\s\S]*?<(?:cal:)?calendar[^>]*\/>[\s\S]*?<\/(?:D:)?resourcetype>/i.test(block) ||
                         /<(?:D:)?resourcetype[^>]*>[\s\S]*?<(?:cal:)?calendar[^>]*>[\s\S]*?<\/(?:cal:)?calendar>[\s\S]*?<\/(?:D:)?resourcetype>/i.test(block);
      
      if (hasCalendar) {
        // Extract href from this response block - handle both D:href and href
        const hrefMatch = block.match(/<(?:D:)?href[^>]*>([^<]+)<\/(?:D:)?href>/i);
        
        if (hrefMatch) {
          // Decode URL-encoded hrefs
          let calendarURL = decodeURIComponent(hrefMatch[1]);
          
          // Make absolute URL if relative
          if (calendarURL.startsWith('/')) {
            const urlObj = new URL(calendarHomeURL);
            calendarURL = `${urlObj.protocol}//${urlObj.host}${calendarURL}`;
          } else if (!calendarURL.startsWith('http')) {
            // Handle relative URLs
            if (calendarURL.startsWith('../')) {
              // Go up from calendar home
              const urlObj = new URL(calendarHomeURL);
              // Use pathname to get only the path segments (without protocol/host)
              const pathSegments = urlObj.pathname.split('/').filter(p => p);
              const upCount = (calendarURL.match(/\.\.\//g) || []).length;
              const newPathSegments = pathSegments.slice(0, -upCount);
              const remainingPath = calendarURL.replace(/\.\.\//g, '');
              const newPath = `/${newPathSegments.join('/')}${remainingPath ? '/' + remainingPath : ''}`;
              calendarURL = `${urlObj.protocol}//${urlObj.host}${newPath}`;
            } else {
              // Relative to calendar home
              const baseUrl = calendarHomeURL.endsWith('/') ? calendarHomeURL : `${calendarHomeURL}/`;
              calendarURL = `${baseUrl}${calendarURL}`;
            }
          }
          
          // Ensure URL ends with / for calendar collections
          if (!calendarURL.endsWith('/')) {
            calendarURL += '/';
          }
          
          console.log(`✅ Found calendar URL: ${calendarURL.replace(credentials.username, '***')}`);
          return calendarURL;
        }
      }
    }
    
    // Fallback: if no calendar found with resource type, try to find any href that's not the home URL
    // This handles cases where the XML structure is different
    const allHrefs = calendarsText.matchAll(/<(?:D:)?href[^>]*>([^<]+)<\/(?:D:)?href>/gi);
    for (const match of allHrefs) {
      // Decode URL-encoded hrefs
      let calendarURL = decodeURIComponent(match[1]);
      
      // Skip if it's the home URL itself
      const homePath = calendarHomeURL.replace(/^https?:\/\/[^\/]+/, '');
      if (calendarURL === calendarHomeURL || calendarURL === homePath || calendarURL.endsWith(homePath)) {
        continue;
      }
      
      // Make absolute URL if relative
      if (calendarURL.startsWith('/')) {
        const urlObj = new URL(calendarHomeURL);
        calendarURL = `${urlObj.protocol}//${urlObj.host}${calendarURL}`;
      } else if (!calendarURL.startsWith('http')) {
        const baseUrl = calendarHomeURL.endsWith('/') ? calendarHomeURL : `${calendarHomeURL}/`;
        calendarURL = `${baseUrl}${calendarURL}`;
      }
      
      // Ensure URL ends with / for calendar collections
      if (!calendarURL.endsWith('/')) {
        calendarURL += '/';
      }
      
      console.log(`✅ Found calendar URL (fallback): ${calendarURL.replace(credentials.username, '***')}`);
      return calendarURL;
    }

    // Last resort: return calendar home URL with /calendars/ appended if it's iCloud
    if (calendarHomeURL.includes('icloud.com')) {
      const fallbackURL = calendarHomeURL.endsWith('/') ? `${calendarHomeURL}calendars/` : `${calendarHomeURL}/calendars/`;
      console.log(`⚠️ Using fallback calendar URL: ${fallbackURL.replace(credentials.username, '***')}`);
      return fallbackURL;
    }

    return calendarHomeURL;
  } catch (error) {
    console.log('CalDAV calendar discovery failed:', error);
    return null;
  }
}

/**
 * Create calendar event via CalDAV
 */
export async function createCalDAVEvent(
  credentials: CalDAVCredentials,
  calendarURL: string,
  event: CalDAVEvent
): Promise<string> {
  // Clean the password
  const cleanPassword = cleanAppPassword(credentials.password);
  
  // Build iCal lines array (RFC 5545 compliant)
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TaskZM//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTART:${formatICalDate(event.dtstart)}`,
    `DTEND:${formatICalDate(event.dtend)}`,
    `DTSTAMP:${formatICalDate(new Date().toISOString())}`,
    `CREATED:${formatICalDate(new Date().toISOString())}`,
    `LAST-MODIFIED:${formatICalDate(new Date().toISOString())}`,
    `SUMMARY:${escapeICalText(event.summary || 'Untitled')}`,
  ];
  
  // Only add optional fields if they have content
  if (event.description && event.description.trim()) {
    lines.push(`DESCRIPTION:${escapeICalText(event.description)}`);
  }
  if (event.location && event.location.trim()) {
    lines.push(`LOCATION:${escapeICalText(event.location)}`);
  }
  
  lines.push(
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR'
  );
  
  // Join with CRLF as required by RFC 5545, and ensure it ends with CRLF
  const ical = lines.join('\r\n') + '\r\n';

  // Ensure calendar URL ends with /
  const baseURL = calendarURL.endsWith('/') ? calendarURL : `${calendarURL}/`;
  const eventURL = `${baseURL}${event.uid}.ics`;

  console.log('Creating CalDAV event at:', eventURL.replace(credentials.username, '***'));

  const response = await fetch(eventURL, {
    method: 'PUT',
    headers: {
      'Authorization': `Basic ${btoa(`${credentials.username}:${cleanPassword}`)}`,
      'Content-Type': 'text/calendar; charset=utf-8',
      'If-None-Match': '*', // Ensure we're creating, not updating
      'User-Agent': 'TaskZM-CalDAV-Client/1.0',
    },
    body: ical,
  });

  // Accept 201 (Created), 204 (No Content), or 200 (OK) as success
  if (!response.ok && response.status !== 201 && response.status !== 204) {
    const errorText = await response.text();
    console.error('CalDAV PUT failed:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText.substring(0, 500),
      eventURL: eventURL.replace(credentials.username, '***'),
    });
    throw new Error(`Failed to create CalDAV event: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`);
  }

  console.log('CalDAV event created successfully:', event.uid);
  return event.uid;
}

/**
 * Update calendar event via CalDAV
 */
export async function updateCalDAVEvent(
  credentials: CalDAVCredentials,
  calendarURL: string,
  eventUID: string,
  event: CalDAVEvent
): Promise<void> {
  // Clean the password
  const cleanPassword = cleanAppPassword(credentials.password);
  
  // Ensure calendar URL ends with /
  const baseURL = calendarURL.endsWith('/') ? calendarURL : `${calendarURL}/`;
  const eventURL = `${baseURL}${eventUID}.ics`;

  // Build iCal lines array (RFC 5545 compliant)
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TaskZM//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTART:${formatICalDate(event.dtstart)}`,
    `DTEND:${formatICalDate(event.dtend)}`,
    `DTSTAMP:${formatICalDate(new Date().toISOString())}`,
    `LAST-MODIFIED:${formatICalDate(new Date().toISOString())}`,
    `SUMMARY:${escapeICalText(event.summary || 'Untitled')}`,
  ];
  
  // Only add optional fields if they have content
  if (event.description && event.description.trim()) {
    lines.push(`DESCRIPTION:${escapeICalText(event.description)}`);
  }
  if (event.location && event.location.trim()) {
    lines.push(`LOCATION:${escapeICalText(event.location)}`);
  }
  
  lines.push(
    'STATUS:CONFIRMED',
    'SEQUENCE:1', // Increment sequence for updates
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR'
  );
  
  // Join with CRLF as required by RFC 5545
  const ical = lines.join('\r\n') + '\r\n';

  console.log('Updating CalDAV event at:', eventURL.replace(credentials.username, '***'));

  const response = await fetch(eventURL, {
    method: 'PUT',
    headers: {
      'Authorization': `Basic ${btoa(`${credentials.username}:${cleanPassword}`)}`,
      'Content-Type': 'text/calendar; charset=utf-8',
      'User-Agent': 'TaskZM-CalDAV-Client/1.0',
    },
    body: ical,
  });

  // Accept 201, 204, or 200 as success
  if (!response.ok && response.status !== 201 && response.status !== 204) {
    const errorText = await response.text();
    console.error('CalDAV PUT (update) failed:', {
      status: response.status,
      statusText: response.statusText,
      error: errorText.substring(0, 500),
    });
    throw new Error(`Failed to update CalDAV event: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`);
  }

  console.log('CalDAV event updated successfully:', eventUID);
}

/**
 * Delete calendar event via CalDAV
 */
export async function deleteCalDAVEvent(
  credentials: CalDAVCredentials,
  calendarURL: string,
  eventUID: string
): Promise<void> {
  // Clean the password
  const cleanPassword = cleanAppPassword(credentials.password);
  
  // Ensure calendar URL ends with /
  const baseURL = calendarURL.endsWith('/') ? calendarURL : `${calendarURL}/`;
  const eventURL = `${baseURL}${eventUID}.ics`;

  const response = await fetch(eventURL, {
    method: 'DELETE',
    headers: {
      'Authorization': `Basic ${btoa(`${credentials.username}:${cleanPassword}`)}`,
    },
  });

  // 404 is OK (already deleted), 410 is also OK (gone)
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const errorText = await response.text();
    throw new Error(`Failed to delete CalDAV event: ${response.status} ${response.statusText} - ${errorText}`);
  }
}

/**
 * Get calendar events via CalDAV
 */
export async function getCalDAVEvents(
  credentials: CalDAVCredentials,
  calendarURL: string,
  startDate: string,
  endDate: string
): Promise<CalDAVEvent[]> {
  // Clean the password
  const cleanPassword = cleanAppPassword(credentials.password);
  
  // Ensure calendar URL ends with /
  const baseURL = calendarURL.endsWith('/') ? calendarURL : `${calendarURL}/`;

  const response = await fetch(baseURL, {
    method: 'REPORT',
    headers: {
      'Authorization': `Basic ${btoa(`${credentials.username}:${cleanPassword}`)}`,
      'Content-Type': 'application/xml',
      'Depth': '1',
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
<calendar-query xmlns="urn:ietf:params:xml:ns:caldav" xmlns:cal="urn:ietf:params:xml:ns:icalendar-2.0">
  <prop>
    <getetag/>
    <calendar-data/>
  </prop>
  <filter>
    <comp-filter name="VCALENDAR">
      <comp-filter name="VEVENT">
        <time-range start="${formatICalDate(startDate)}" end="${formatICalDate(endDate)}"/>
      </comp-filter>
    </comp-filter>
  </filter>
</calendar-query>`,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to fetch CalDAV events: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const text = await response.text();
  return parseCalDAVResponse(text);
}

// Helper functions
function formatICalDate(date: string): string {
  // Convert ISO date to iCal format (YYYYMMDDTHHMMSSZ)
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hours = String(d.getUTCHours()).padStart(2, '0');
  const minutes = String(d.getUTCMinutes()).padStart(2, '0');
  const seconds = String(d.getUTCSeconds()).padStart(2, '0');
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

function escapeICalText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '');
}

function parseCalDAVResponse(xml: string): CalDAVEvent[] {
  const events: CalDAVEvent[] = [];
  
  // Extract calendar-data sections
  const calendarDataMatches = xml.matchAll(/<calendar-data[^>]*>([\s\S]*?)<\/calendar-data>/g);
  
  for (const match of calendarDataMatches) {
    const icalContent = match[1].trim();
    
    // Parse iCal content
    const uidMatch = icalContent.match(/UID:([^\r\n]+)/);
    const summaryMatch = icalContent.match(/SUMMARY:([^\r\n]+)/);
    const descriptionMatch = icalContent.match(/DESCRIPTION:([^\r\n]+)/);
    const locationMatch = icalContent.match(/LOCATION:([^\r\n]+)/);
    const dtstartMatch = icalContent.match(/DTSTART[^:]*:([^\r\n]+)/);
    const dtendMatch = icalContent.match(/DTEND[^:]*:([^\r\n]+)/);
    
    if (uidMatch && dtstartMatch && dtendMatch) {
      const uid = uidMatch[1].trim();
      const dtstart = parseICalDate(dtstartMatch[1].trim());
      const dtend = parseICalDate(dtendMatch[1].trim());
      
      events.push({
        uid,
        dtstart,
        dtend,
        summary: summaryMatch ? unescapeICalText(summaryMatch[1].trim()) : 'Untitled',
        description: descriptionMatch ? unescapeICalText(descriptionMatch[1].trim()) : undefined,
        location: locationMatch ? unescapeICalText(locationMatch[1].trim()) : undefined,
      });
    }
  }
  
  return events;
}

function parseICalDate(icalDate: string): string {
  // Convert iCal date (YYYYMMDDTHHMMSSZ) to ISO format
  if (icalDate.length === 15 && icalDate.endsWith('Z')) {
    const year = icalDate.substring(0, 4);
    const month = icalDate.substring(4, 6);
    const day = icalDate.substring(6, 8);
    const hours = icalDate.substring(9, 11);
    const minutes = icalDate.substring(11, 13);
    const seconds = icalDate.substring(13, 15);
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.000Z`;
  } else if (icalDate.length === 8) {
    // Date only (YYYYMMDD)
    const year = icalDate.substring(0, 4);
    const month = icalDate.substring(4, 6);
    const day = icalDate.substring(6, 8);
    return `${year}-${month}-${day}T00:00:00.000Z`;
  }
  return new Date().toISOString();
}

function unescapeICalText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

