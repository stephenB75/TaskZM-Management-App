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
  const data = await kv.get(`user_${userId}_calendar_${provider}_tokens`);
  if (!data) return null;
  return JSON.parse(data);
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
  // Get and refresh tokens if needed
  let tokens = await getCalendarTokens(userId, provider);
  if (!tokens) {
    throw new Error(`No tokens found for ${provider}`);
  }
  
  // Apple Calendar doesn't use refresh tokens (app-specific passwords don't expire)
  if (provider !== 'apple') {
    tokens = await refreshAccessToken(userId, provider, tokens);
  }

  // Create event based on provider
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
 * Create Apple Calendar event via CalDAV
 */
async function createAppleCalendarEvent(
  tokens: CalendarTokens,
  task: any
): Promise<CalendarEvent> {
  if (!tokens.caldavUrl || !tokens.caldavUsername || !tokens.caldavPassword) {
    throw new Error('CalDAV credentials not configured');
  }

  // Get or discover calendar URL
  let calendarURL = await kv.get(`user_calendar_url_${tokens.caldavUsername}`);
  if (!calendarURL) {
    calendarURL = await caldav.discoverCalendarURL({
      url: tokens.caldavUrl,
      username: tokens.caldavUsername,
      password: tokens.caldavPassword,
    });
    
    if (!calendarURL) {
      throw new Error('Failed to discover calendar URL');
    }
    
    // Cache calendar URL
    await kv.set(`user_calendar_url_${tokens.caldavUsername}`, calendarURL);
  }

  // Ensure calendar URL ends with /
  if (!calendarURL.endsWith('/')) {
    calendarURL += '/';
  }

  const eventUID = `taskzm-${task.id}-${Date.now()}`;
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

  await caldav.createCalDAVEvent(
    {
      url: tokens.caldavUrl,
      username: tokens.caldavUsername,
      password: tokens.caldavPassword,
    },
    calendarURL,
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

function calculateEndDate(startDate: string, estimatedMinutes?: number): string {
  const start = new Date(startDate);
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

  // Get calendar URL
  let calendarURL = await kv.get(`user_calendar_url_${tokens.caldavUsername}`);
  if (!calendarURL) {
    calendarURL = await caldav.discoverCalendarURL({
      url: tokens.caldavUrl,
      username: tokens.caldavUsername,
      password: tokens.caldavPassword,
    });
    
    if (!calendarURL) {
      throw new Error('Failed to discover calendar URL');
    }
    
    await kv.set(`user_calendar_url_${tokens.caldavUsername}`, calendarURL);
  }

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

  // Get calendar URL
  let calendarURL = await kv.get(`user_calendar_url_${tokens.caldavUsername}`);
  if (!calendarURL) {
    calendarURL = await caldav.discoverCalendarURL({
      url: tokens.caldavUrl,
      username: tokens.caldavUsername,
      password: tokens.caldavPassword,
    });
    
    if (!calendarURL) {
      throw new Error('Failed to discover calendar URL');
    }
    
    await kv.set(`user_calendar_url_${tokens.caldavUsername}`, calendarURL);
  }

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

  // Get calendar URL
  let calendarURL = await kv.get(`user_calendar_url_${tokens.caldavUsername}`);
  if (!calendarURL) {
    calendarURL = await caldav.discoverCalendarURL({
      url: tokens.caldavUrl,
      username: tokens.caldavUsername,
      password: tokens.caldavPassword,
    });
    
    if (!calendarURL) {
      return [];
    }
    
    await kv.set(`user_calendar_url_${tokens.caldavUsername}`, calendarURL);
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
