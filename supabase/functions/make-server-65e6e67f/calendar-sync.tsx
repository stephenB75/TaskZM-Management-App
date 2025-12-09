/**
 * Calendar Sync Service
 * Handles bidirectional sync between TaskZM and calendar providers
 * Supports Google Calendar, Outlook Calendar, and Apple Calendar
 */

import * as kv from "./kv_store.tsx";
import * as caldav from "./caldav-client.tsx";

// Calendar provider types
export type CalendarProvider = 'google' | 'outlook' | 'apple';

// Token storage structure
export interface CalendarTokens {
  accessToken: string;
  refreshToken?: string; // Optional for CalDAV
  expiresAt?: number; // Optional for CalDAV (Unix timestamp)
  provider: CalendarProvider;
  email?: string;
  // CalDAV-specific fields
  caldavUrl?: string; // e.g., https://caldav.icloud.com
  caldavUsername?: string; // iCloud email
  caldavPassword?: string; // App-specific password
}

// Calendar event structure
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  start: string; // ISO date string
  end: string; // ISO date string
  location?: string;
  provider: CalendarProvider;
  providerEventId: string;
}

/**
 * Store calendar tokens for a user
 */
export async function storeCalendarTokens(
  userId: string,
  provider: CalendarProvider,
  tokens: CalendarTokens
): Promise<void> {
  await kv.set(
    `user_${userId}_calendar_${provider}_tokens`,
    JSON.stringify(tokens)
  );
}

/**
 * Get calendar tokens for a user
 */
export async function getCalendarTokens(
  userId: string,
  provider: CalendarProvider
): Promise<CalendarTokens | null> {
  try {
    const data = await kv.get(`user_${userId}_calendar_${provider}_tokens`);
    if (!data) {
      console.log(`No calendar tokens found for user ${userId}, provider ${provider}`);
      return null;
    }
    
    // Handle case where data might already be an object
    if (typeof data === 'object' && data !== null) {
      return data as CalendarTokens;
    }
    
    // Handle case where data is a string
    if (typeof data === 'string') {
      // Skip if it's "[object Object]"
      if (data === '[object Object]' || data.trim() === '[object Object]') {
        console.error(`Invalid token data format for user ${userId}, provider ${provider}: "[object Object]"`);
        return null;
      }
      try {
        const parsed = JSON.parse(data);
        // Validate that parsed data has required fields
        if (parsed && typeof parsed === 'object') {
          return parsed as CalendarTokens;
        }
      } catch (parseError) {
        console.error(`Error parsing calendar tokens for user ${userId}, provider ${provider}:`, parseError);
        console.error(`Token data (first 200 chars):`, data.substring(0, 200));
        return null;
      }
    }
    
    console.error(`Unexpected token data type for user ${userId}, provider ${provider}:`, typeof data);
    return null;
  } catch (error) {
    console.error(`Error retrieving calendar tokens for user ${userId}, provider ${provider}:`, error);
    return null;
  }
}

/**
 * Refresh access token if expired
 */
export async function refreshAccessToken(
  userId: string,
  provider: CalendarProvider,
  tokens: CalendarTokens
): Promise<CalendarTokens> {
  // Apple Calendar doesn't use refresh tokens (app-specific passwords don't expire)
  if (provider === 'apple') {
    return tokens;
  }

  const now = Date.now();
  
  // If token is still valid (with 5 minute buffer), return as-is
  if (tokens.expiresAt && tokens.expiresAt > now + 300000) {
    return tokens;
  }

  // Refresh token based on provider
  let newTokens: CalendarTokens;
  
  switch (provider) {
    case 'google':
      newTokens = await refreshGoogleToken(tokens);
      break;
    case 'outlook':
      newTokens = await refreshOutlookToken(tokens);
      break;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  // Store new tokens
  await storeCalendarTokens(userId, provider, newTokens);
  
  return newTokens;
}

/**
 * Refresh Google Calendar access token
 */
async function refreshGoogleToken(tokens: CalendarTokens): Promise<CalendarTokens> {
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth credentials not configured');
  }

  if (!tokens.refreshToken) {
    throw new Error('No refresh token available. Please reconnect your Google Calendar.');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to refresh Google token: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  
  // Preserve existing refresh token if new one not provided (Google typically doesn't return new refresh_token on refresh)
  // But use new one if provided
  return {
    ...tokens,
    accessToken: data.access_token,
    refreshToken: data.refresh_token || tokens.refreshToken, // Use new refresh token if provided, otherwise keep existing
    expiresAt: Date.now() + (data.expires_in * 1000),
  };
}

/**
 * Refresh Outlook access token
 */
async function refreshOutlookToken(tokens: CalendarTokens): Promise<CalendarTokens> {
  const clientId = Deno.env.get('OUTLOOK_CLIENT_ID');
  const clientSecret = Deno.env.get('OUTLOOK_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Outlook OAuth credentials not configured');
  }

  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: tokens.refreshToken,
      grant_type: 'refresh_token',
      scope: 'https://graph.microsoft.com/Calendars.ReadWrite offline_access',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to refresh Outlook token: ${response.statusText}`);
  }

  const data = await response.json();
  
  return {
    ...tokens,
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };
}

/**
 * Create calendar event from task
 */
export async function createCalendarEvent(
  userId: string,
  provider: CalendarProvider,
  task: any
): Promise<CalendarEvent | null> {
  console.log(`Creating calendar event for user ${userId}, provider ${provider}, task ${task.id}`);
  
  // Get and refresh tokens if needed
  let tokens = await getCalendarTokens(userId, provider);
  if (!tokens) {
    const errorMsg = `No calendar tokens found for ${provider}. Please connect your ${provider} calendar first.`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }
  
  // Validate tokens have required fields
  if (provider === 'apple') {
    if (!tokens.caldavUrl || !tokens.caldavUsername || !tokens.caldavPassword) {
      const errorMsg = `Apple Calendar credentials incomplete. Please reconnect your Apple Calendar.`;
      console.error(errorMsg, {
        hasCaldavUrl: !!tokens.caldavUrl,
        hasCaldavUsername: !!tokens.caldavUsername,
        hasCaldavPassword: !!tokens.caldavPassword,
      });
      throw new Error(errorMsg);
    }
  } else {
    if (!tokens.accessToken) {
      const errorMsg = `Invalid tokens for ${provider}. Please reconnect your calendar.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }
  }
  
  // Apple Calendar doesn't use refresh tokens (app-specific passwords don't expire)
  if (provider !== 'apple') {
    tokens = await refreshAccessToken(userId, provider, tokens);
  }

  // Create event based on provider
  try {
    switch (provider) {
      case 'google':
        return await createGoogleCalendarEvent(tokens, task);
      case 'outlook':
        return await createOutlookCalendarEvent(tokens, task);
      case 'apple':
        return await createAppleCalendarEvent(tokens, task);
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  } catch (error) {
    console.error(`Error in createCalendarEvent for ${provider}:`, error);
    throw error;
  }
}

/**
 * Create Google Calendar event
 */
async function createGoogleCalendarEvent(
  tokens: CalendarTokens,
  task: any
): Promise<CalendarEvent> {
  const startDate = task.scheduledDate || task.dueDate;
  const endDate = calculateEndDate(startDate, task.estimatedTime);
  
  const event = {
    summary: task.title,
    description: task.description || '',
    start: {
      dateTime: startDate,
      timeZone: 'UTC',
    },
    end: {
      dateTime: endDate,
      timeZone: 'UTC',
    },
    extendedProperties: {
      private: {
        taskzmTaskId: task.id,
      },
    },
  };

  const response = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create Google Calendar event: ${error}`);
  }

  const data = await response.json();
  
  return {
    id: `google_${data.id}`,
    title: data.summary,
    description: data.description,
    start: data.start.dateTime || data.start.date,
    end: data.end.dateTime || data.end.date,
    provider: 'google',
    providerEventId: data.id,
  };
}

/**
 * Create Outlook Calendar event
 */
async function createOutlookCalendarEvent(
  tokens: CalendarTokens,
  task: any
): Promise<CalendarEvent> {
  const startDate = task.scheduledDate || task.dueDate;
  const endDate = calculateEndDate(startDate, task.estimatedTime);
  
  const event = {
    subject: task.title,
    body: {
      contentType: 'Text',
      content: task.description || '',
    },
    start: {
      dateTime: startDate,
      timeZone: 'UTC',
    },
    end: {
      dateTime: endDate,
      timeZone: 'UTC',
    },
    singleValueExtendedProperties: [
      {
        id: 'String {66f5a359-4659-4830-9070-00047ec6ac6e} Name taskzmTaskId',
        value: task.id,
      },
    ],
  };

  const response = await fetch(
    'https://graph.microsoft.com/v1.0/me/calendar/events',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to create Outlook Calendar event: ${error}`);
  }

  const data = await response.json();
  
  return {
    id: `outlook_${data.id}`,
    title: data.subject,
    description: data.body?.content,
    start: data.start.dateTime,
    end: data.end.dateTime,
    provider: 'outlook',
    providerEventId: data.id,
  };
}

/**
 * Helper function to get or discover Apple Calendar URL
 * Uses shortcut URL fallback if discovery fails
 */
async function getOrDiscoverAppleCalendarURL(tokens: CalendarTokens): Promise<string> {
  if (!tokens.caldavUrl || !tokens.caldavUsername || !tokens.caldavPassword) {
    throw new Error('CalDAV credentials not configured');
  }

  // Check cache first
  let calendarURL = await kv.get(`user_calendar_url_${tokens.caldavUsername}`);
  if (calendarURL) {
    return calendarURL;
  }

  console.log('Discovering calendar URL for Apple Calendar...', {
    caldavUrl: tokens.caldavUrl?.replace(tokens.caldavUsername || '', '***'),
    username: tokens.caldavUsername,
  });
  
  // Try discovery first
  calendarURL = await caldav.discoverCalendarURL({
    url: tokens.caldavUrl,
    username: tokens.caldavUsername,
    password: tokens.caldavPassword,
  });
  
  if (!calendarURL) {
    // Fallback: Try using the shortcut URL format directly as calendar URL
    // For iCloud, the calendar URL is often the CalDAV URL + 'calendars/' or the CalDAV URL itself
    console.log('Calendar discovery failed, trying shortcut URL fallback...');
    if (tokens.caldavUrl && tokens.caldavUrl.includes('caldav.icloud.com')) {
      // Try common iCloud calendar URL formats
      const fallbackUrls = [
        `${tokens.caldavUrl}calendars/`,
        `${tokens.caldavUrl.replace(/\/$/, '')}/calendars/`,
        tokens.caldavUrl, // Use CalDAV URL directly as fallback
      ];
      
      // Test which fallback URL works
      for (const fallbackUrl of fallbackUrls) {
        try {
          const cleanPassword = tokens.caldavPassword.replace(/\s+/g, '');
          const testResponse = await fetch(fallbackUrl, {
            method: 'PROPFIND',
            headers: {
              'Authorization': `Basic ${btoa(`${tokens.caldavUsername}:${cleanPassword}`)}`,
              'Depth': '0',
              'Content-Type': 'application/xml; charset=utf-8',
            },
            body: `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:">
  <prop>
    <resourcetype/>
  </prop>
</propfind>`,
          });
          
          if (testResponse.ok || testResponse.status === 207) {
            console.log('Fallback calendar URL works:', fallbackUrl.replace(tokens.caldavUsername || '', '***'));
            calendarURL = fallbackUrl;
            break;
          }
        } catch (testError) {
          // Continue to next fallback
          console.log('Fallback URL test failed:', fallbackUrl.replace(tokens.caldavUsername || '', '***'));
        }
      }
    }
    
    if (!calendarURL) {
      throw new Error('Failed to discover calendar URL. Please check your Apple Calendar credentials and try reconnecting.');
    }
  }
  
  // Cache calendar URL for future use
  if (calendarURL) {
    await kv.set(`user_calendar_url_${tokens.caldavUsername}`, calendarURL);
    console.log('Calendar URL cached successfully');
  }
  
  return calendarURL;
}

/**
 * Create Apple Calendar event via CalDAV
 */
async function createAppleCalendarEvent(
  tokens: CalendarTokens,
  task: any
): Promise<CalendarEvent> {
  if (!tokens.caldavUrl || !tokens.caldavUsername || !tokens.caldavPassword) {
    throw new Error('CalDAV credentials not configured');
  }

  // Get or discover calendar URL using helper function
  let calendarURL = await getOrDiscoverAppleCalendarURL(tokens);

  // Ensure calendar URL ends with /
  if (!calendarURL.endsWith('/')) {
    calendarURL += '/';
  }

  // Validate that we have a valid date
  const startDate = task.scheduledDate || task.dueDate;
  if (!startDate) {
    throw new Error('Task must have a scheduledDate or dueDate to create a calendar event');
  }
  
  // Validate date format
  const dateObj = new Date(startDate);
  if (isNaN(dateObj.getTime())) {
    throw new Error(`Invalid date format: ${startDate}`);
  }
  
  // Ensure date is in ISO format
  const isoStartDate = dateObj.toISOString();
  
  const eventUID = `taskzm-${task.id}-${Date.now()}`;
  const endDate = calculateEndDate(isoStartDate, task.estimatedTime);
  
  const event = {
    uid: eventUID,
    dtstart: isoStartDate,
    dtend: endDate,
    summary: task.title || 'Untitled Task',
    description: task.description || '',
    location: task.location || '',
  };

  try {
    console.log('Creating CalDAV event:', {
      calendarURL: calendarURL.replace(tokens.caldavUsername || '', '***'),
      eventUID,
      startDate,
      endDate,
    });
    
    await caldav.createCalDAVEvent(
      {
        url: tokens.caldavUrl,
        username: tokens.caldavUsername,
        password: tokens.caldavPassword,
      },
      calendarURL,
      event
    );
    
    console.log('CalDAV event created successfully:', eventUID);
  } catch (caldavError) {
    console.error('CalDAV event creation failed:', caldavError);
    console.error('CalDAV error details:', {
      errorType: typeof caldavError,
      errorMessage: caldavError instanceof Error ? caldavError.message : String(caldavError),
      errorStack: caldavError instanceof Error ? caldavError.stack : undefined,
    });
    throw new Error(`Failed to create Apple Calendar event: ${caldavError instanceof Error ? caldavError.message : String(caldavError)}`);
  }

  return {
    id: `apple_${eventUID}`,
    title: task.title || 'Untitled Task',
    description: task.description,
    start: isoStartDate,
    end: endDate,
    provider: 'apple',
    providerEventId: eventUID,
  };
}

function calculateEndDate(startDate: string, estimatedMinutes?: number): string {
  if (!startDate) {
    throw new Error('startDate is required for calculateEndDate');
  }
  const start = new Date(startDate);
  if (isNaN(start.getTime())) {
    throw new Error(`Invalid startDate format: ${startDate}`);
  }
  const minutes = estimatedMinutes || 30;
  const end = new Date(start.getTime() + minutes * 60000);
  return end.toISOString();
}

/**
 * Update calendar event
 */
export async function updateCalendarEvent(
  userId: string,
  provider: CalendarProvider,
  eventId: string,
  task: any
): Promise<CalendarEvent | null> {
  let tokens = await getCalendarTokens(userId, provider);
  if (!tokens) {
    throw new Error(`No tokens found for ${provider}`);
  }

  // Extract provider event ID (remove prefix if present)
  const providerEventId = eventId.startsWith(`${provider}_`) 
    ? eventId.substring(provider.length + 1) 
    : eventId;

  switch (provider) {
    case 'google':
      tokens = await refreshAccessToken(userId, provider, tokens);
      return await updateGoogleCalendarEvent(tokens, providerEventId, task);
    case 'outlook':
      tokens = await refreshAccessToken(userId, provider, tokens);
      return await updateOutlookCalendarEvent(tokens, providerEventId, task);
    case 'apple':
      return await updateAppleCalendarEvent(tokens, providerEventId, task);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Update Apple Calendar event via CalDAV
 */
async function updateAppleCalendarEvent(
  tokens: CalendarTokens,
  eventUID: string,
  task: any
): Promise<CalendarEvent> {
  if (!tokens.caldavUrl || !tokens.caldavUsername || !tokens.caldavPassword) {
    throw new Error('CalDAV credentials not configured');
  }

  // Get or discover calendar URL using helper function
  let calendarURL = await getOrDiscoverAppleCalendarURL(tokens);

  if (!calendarURL.endsWith('/')) {
    calendarURL += '/';
  }

  const startDate = task.scheduledDate || task.dueDate;
  const endDate = calculateEndDate(startDate, task.estimatedTime);
  
  const event = {
    uid: eventUID,
    dtstart: startDate,
    dtend: endDate,
    summary: task.title,
    description: task.description || '',
    location: task.location || '',
  };

  await caldav.updateCalDAVEvent(
    {
      url: tokens.caldavUrl,
      username: tokens.caldavUsername,
      password: tokens.caldavPassword,
    },
    calendarURL,
    eventUID,
    event
  );

  return {
    id: `apple_${eventUID}`,
    title: task.title,
    description: task.description,
    start: startDate,
    end: endDate,
    provider: 'apple',
    providerEventId: eventUID,
  };
}

/**
 * Update Google Calendar event
 */
async function updateGoogleCalendarEvent(
  tokens: CalendarTokens,
  eventId: string,
  task: any
): Promise<CalendarEvent> {
  const startDate = task.scheduledDate || task.dueDate;
  const endDate = calculateEndDate(startDate, task.estimatedTime);
  
  const event = {
    summary: task.title,
    description: task.description || '',
    start: {
      dateTime: startDate,
      timeZone: 'UTC',
    },
    end: {
      dateTime: endDate,
      timeZone: 'UTC',
    },
  };

  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to update Google Calendar event');
  }

  const data = await response.json();
  
  return {
    id: `google_${data.id}`,
    title: data.summary,
    description: data.description,
    start: data.start.dateTime || data.start.date,
    end: data.end.dateTime || data.end.date,
    provider: 'google',
    providerEventId: data.id,
  };
}

/**
 * Update Outlook Calendar event
 */
async function updateOutlookCalendarEvent(
  tokens: CalendarTokens,
  eventId: string,
  task: any
): Promise<CalendarEvent> {
  const startDate = task.scheduledDate || task.dueDate;
  const endDate = calculateEndDate(startDate, task.estimatedTime);
  
  const event = {
    subject: task.title,
    body: {
      contentType: 'Text',
      content: task.description || '',
    },
    start: {
      dateTime: startDate,
      timeZone: 'UTC',
    },
    end: {
      dateTime: endDate,
      timeZone: 'UTC',
    },
  };

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendar/events/${eventId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  if (!response.ok) {
    throw new Error('Failed to update Outlook Calendar event');
  }

  const data = await response.json();
  
  return {
    id: `outlook_${data.id}`,
    title: data.subject,
    description: data.body?.content,
    start: data.start.dateTime,
    end: data.end.dateTime,
    provider: 'outlook',
    providerEventId: data.id,
  };
}

/**
 * Delete calendar event
 */
export async function deleteCalendarEvent(
  userId: string,
  provider: CalendarProvider,
  eventId: string
): Promise<void> {
  let tokens = await getCalendarTokens(userId, provider);
  if (!tokens) {
    throw new Error(`No tokens found for ${provider}`);
  }

  // Extract provider event ID (remove prefix if present)
  const providerEventId = eventId.startsWith(`${provider}_`) 
    ? eventId.substring(provider.length + 1) 
    : eventId;

  switch (provider) {
    case 'google':
      tokens = await refreshAccessToken(userId, provider, tokens);
      await deleteGoogleCalendarEvent(tokens, providerEventId);
      break;
    case 'outlook':
      tokens = await refreshAccessToken(userId, provider, tokens);
      await deleteOutlookCalendarEvent(tokens, providerEventId);
      break;
    case 'apple':
      await deleteAppleCalendarEvent(tokens, providerEventId);
      break;
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Delete Google Calendar event
 */
async function deleteGoogleCalendarEvent(
  tokens: CalendarTokens,
  eventId: string
): Promise<void> {
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
      },
    }
  );

  if (!response.ok && response.status !== 410) { // 410 = already deleted
    throw new Error('Failed to delete Google Calendar event');
  }
}

/**
 * Delete Outlook Calendar event
 */
async function deleteOutlookCalendarEvent(
  tokens: CalendarTokens,
  eventId: string
): Promise<void> {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/me/calendar/events/${eventId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${tokens.accessToken}`,
      },
    }
  );

  if (!response.ok && response.status !== 404) { // 404 = not found
    throw new Error('Failed to delete Outlook Calendar event');
  }
}

/**
 * Delete Apple Calendar event via CalDAV
 */
async function deleteAppleCalendarEvent(
  tokens: CalendarTokens,
  eventUID: string
): Promise<void> {
  if (!tokens.caldavUrl || !tokens.caldavUsername || !tokens.caldavPassword) {
    throw new Error('CalDAV credentials not configured');
  }

  // Get or discover calendar URL using helper function
  let calendarURL = await getOrDiscoverAppleCalendarURL(tokens);

  if (!calendarURL.endsWith('/')) {
    calendarURL += '/';
  }

  await caldav.deleteCalDAVEvent(
    {
      url: tokens.caldavUrl,
      username: tokens.caldavUsername,
      password: tokens.caldavPassword,
    },
    calendarURL,
    eventUID
  );
}

/**
 * Get all calendar events for a user
 */
export async function getCalendarEvents(
  userId: string,
  provider: CalendarProvider,
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
  let tokens = await getCalendarTokens(userId, provider);
  if (!tokens) {
    return [];
  }

  switch (provider) {
    case 'google':
      tokens = await refreshAccessToken(userId, provider, tokens);
      return await getGoogleCalendarEvents(tokens, startDate, endDate);
    case 'outlook':
      tokens = await refreshAccessToken(userId, provider, tokens);
      return await getOutlookCalendarEvents(tokens, startDate, endDate);
    case 'apple':
      return await getAppleCalendarEvents(tokens, startDate, endDate);
    default:
      return [];
  }
}

/**
 * Get Apple Calendar events via CalDAV
 */
async function getAppleCalendarEvents(
  tokens: CalendarTokens,
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
  if (!tokens.caldavUrl || !tokens.caldavUsername || !tokens.caldavPassword) {
    return [];
  }

  // Get or discover calendar URL using helper function
  let calendarURL: string;
  try {
    calendarURL = await getOrDiscoverAppleCalendarURL(tokens);
  } catch (error) {
    console.log('Failed to get calendar URL for fetching events:', error);
    return [];
  }

  const events = await caldav.getCalDAVEvents(
    {
      url: tokens.caldavUrl,
      username: tokens.caldavUsername,
      password: tokens.caldavPassword,
    },
    calendarURL,
    startDate,
    endDate
  );

  return events.map(event => ({
    id: `apple_${event.uid}`,
    title: event.summary,
    description: event.description,
    start: event.dtstart,
    end: event.dtend,
    location: event.location,
    provider: 'apple',
    providerEventId: event.uid,
  }));
}

/**
 * Get Google Calendar events
 */
async function getGoogleCalendarEvents(
  tokens: CalendarTokens,
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
  const url = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  url.searchParams.set('timeMin', startDate);
  url.searchParams.set('timeMax', endDate);
  url.searchParams.set('singleEvents', 'true');
  url.searchParams.set('orderBy', 'startTime');

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${tokens.accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Google Calendar events');
  }

  const data = await response.json();
  
  return (data.items || []).map((event: any) => ({
    id: `google_${event.id}`,
    title: event.summary,
    description: event.description,
    start: event.start.dateTime || event.start.date,
    end: event.end.dateTime || event.end.date,
    provider: 'google',
    providerEventId: event.id,
  }));
}

/**
 * Get Outlook Calendar events
 */
async function getOutlookCalendarEvents(
  tokens: CalendarTokens,
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
  const url = new URL('https://graph.microsoft.com/v1.0/me/calendarview');
  url.searchParams.set('startDateTime', startDate);
  url.searchParams.set('endDateTime', endDate);

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${tokens.accessToken}`,
      'Prefer': 'outlook.timezone="UTC"',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Outlook Calendar events');
  }

  const data = await response.json();
  
  return (data.value || []).map((event: any) => ({
    id: `outlook_${event.id}`,
    title: event.subject,
    description: event.body?.content,
    start: event.start.dateTime,
    end: event.end.dateTime,
    provider: 'outlook',
    providerEventId: event.id,
  }));
}

/**
 * Store task-to-event mapping
 */
export async function storeTaskEventMapping(
  userId: string,
  taskId: string,
  provider: CalendarProvider,
  eventId: string
): Promise<void> {
  await kv.set(
    `user_${userId}_task_${taskId}_event_${provider}`,
    eventId
  );
}

/**
 * Get event ID for a task
 */
export async function getTaskEventMapping(
  userId: string,
  taskId: string,
  provider: CalendarProvider
): Promise<string | null> {
  return await kv.get(`user_${userId}_task_${taskId}_event_${provider}`);
}

/**
 * Remove task-to-event mapping
 */
export async function removeTaskEventMapping(
  userId: string,
  taskId: string,
  provider: CalendarProvider
): Promise<void> {
  await kv.del(`user_${userId}_task_${taskId}_event_${provider}`);
}
