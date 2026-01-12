/**
 * Calendar Sync Service
 * Handles bidirectional sync between TaskZM and calendar providers
 * Supports Google Calendar, Outlook Calendar, and Apple Calendar
 */

import * as kv from "./kv_store.tsx";
import * as caldav from "./caldav-client.tsx";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Constants
const MAX_RECURRENCE_ITERATIONS = 365; // Maximum iterations for recurring event expansion (1 year)
const TOKEN_VALIDITY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes buffer for token validity check
const DEFAULT_EVENT_DURATION_MINUTES = 30; // Default duration for calendar events without end time

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
  calendarColor?: string; // Calendar color for display
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
  
  // If token is still valid (with buffer), return as-is
  if (tokens.expiresAt && tokens.expiresAt > now + TOKEN_VALIDITY_BUFFER_MS) {
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
 * Helper function to get Apple Calendar URL using SHORTCUT METHOD
 * Uses direct URL construction instead of complex CalDAV discovery
 * This is simpler and more reliable for iCloud calendars
 */
async function getAppleCalendarURL(tokens: CalendarTokens): Promise<string> {
  if (!tokens.caldavUrl || !tokens.caldavUsername || !tokens.caldavPassword) {
    throw new Error('CalDAV credentials not configured');
  }

  // SHORTCUT METHOD: Use iCloud's .well-known redirect to get the principal URL
  console.log('Using shortcut method for Apple Calendar URL...');
  
  // Clean password - remove spaces and hyphens
  const cleanPassword = tokens.caldavPassword.replace(/[\s-]/g, '');
  
  // Step 1: Hit the well-known endpoint which redirects to the user's principal URL
  const wellKnownResponse = await fetch('https://caldav.icloud.com/.well-known/caldav', {
    method: 'PROPFIND',
    headers: {
      'Authorization': `Basic ${btoa(`${tokens.caldavUsername}:${cleanPassword}`)}`,
      'Depth': '0',
      'Content-Type': 'application/xml; charset=utf-8',
      'User-Agent': 'TaskZM-CalDAV-Client/1.0',
    },
    body: `<?xml version="1.0" encoding="utf-8"?>
<propfind xmlns="DAV:" xmlns:cal="urn:ietf:params:xml:ns:caldav">
<prop>
  <cal:calendar-home-set/>
  <current-user-principal/>
</prop>
</propfind>`,
    redirect: 'follow',
  });
  
  // Check for authentication failure FIRST - don't silently fallback
  if (wellKnownResponse.status === 401 || wellKnownResponse.status === 403) {
    console.error('Apple Calendar authentication failed:', wellKnownResponse.status);
    throw new Error('Authentication failed (403). Please check your app-specific password and reconnect Apple Calendar.');
  }
  
  if (wellKnownResponse.ok || wellKnownResponse.status === 207) {
    const responseText = await wellKnownResponse.text();
    console.log('Apple Calendar discovery response length:', responseText.length);
    
    // Parse the calendar-home-set URL from response
    const homeSetMatch = responseText.match(/<cal:calendar-home-set[^>]*>[\s\S]*?<href[^>]*>([^<]+)<\/href>/i) ||
                        responseText.match(/<calendar-home-set[^>]*>[\s\S]*?<href[^>]*>([^<]+)<\/href>/i);
    
    if (homeSetMatch && homeSetMatch[1]) {
      let calendarHomeURL = homeSetMatch[1].trim();
      
      // Make it absolute if needed
      if (calendarHomeURL.startsWith('/')) {
        calendarHomeURL = `https://caldav.icloud.com${calendarHomeURL}`;
      }
      
      // Append /home/ if it's just the calendars path
      if (calendarHomeURL.endsWith('/calendars/')) {
        calendarHomeURL += 'home/';
      }
      
      console.log('Shortcut method found calendar URL:', calendarHomeURL.replace(/\/\d+\//, '/****/'));
      return calendarHomeURL;
    }
    
    // Try to extract from current-user-principal and build calendar URL
    const principalMatch = responseText.match(/<current-user-principal[^>]*>[\s\S]*?<href[^>]*>([^<]+)<\/href>/i);
    if (principalMatch && principalMatch[1]) {
      const principalURL = principalMatch[1].trim();
      // Extract DSID from principal URL (e.g., /12345678/principal/)
      const dsidMatch = principalURL.match(/\/(\d+)\//);
      if (dsidMatch && dsidMatch[1]) {
        const calendarURL = `https://caldav.icloud.com/${dsidMatch[1]}/calendars/home/`;
        console.log('Shortcut method built calendar URL from principal:', calendarURL.replace(/\/\d+\//, '/****/'));
        return calendarURL;
      }
    }
    
    // Response was OK but couldn't parse - log for debugging
    console.error('Could not parse calendar URL from Apple response:', responseText.substring(0, 500));
  }
  
  // If we get here, discovery failed for a non-auth reason
  throw new Error(`Failed to discover Apple Calendar URL (status ${wellKnownResponse.status}). Please reconnect your Apple Calendar.`);
}

/**
 * Create Apple Calendar event via CalDAV - SHORTCUT METHOD
 * Uses direct URL construction instead of complex discovery
 */
async function createAppleCalendarEvent(
  tokens: CalendarTokens,
  task: any
): Promise<CalendarEvent> {
  if (!tokens.caldavUrl || !tokens.caldavUsername || !tokens.caldavPassword) {
    throw new Error('CalDAV credentials not configured');
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
  
  // Use the discovered calendar URL (with proper DSID) instead of hardcoded patterns
  // Clean password - remove spaces and hyphens (Apple passwords are xxxx-xxxx-xxxx-xxxx format)
  const cleanPassword = tokens.caldavPassword.replace(/[\s-]/g, '');
  
  // Get the proper calendar URL using the shortcut method
  let calendarURL: string;
  try {
    calendarURL = await getAppleCalendarURL(tokens);
    if (!calendarURL.endsWith('/')) {
      calendarURL += '/';
    }
  } catch (urlError) {
    console.error('Failed to get Apple Calendar URL:', urlError);
    throw new Error('Could not discover Apple Calendar URL. Please reconnect Apple Calendar.');
  }
  
  // Build iCal content (RFC 5545 compliant)
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TaskZM//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${eventUID}`,
    `DTSTART:${formatICalDate(isoStartDate)}`,
    `DTEND:${formatICalDate(endDate)}`,
    `DTSTAMP:${formatICalDate(new Date().toISOString())}`,
    `CREATED:${formatICalDate(new Date().toISOString())}`,
    `LAST-MODIFIED:${formatICalDate(new Date().toISOString())}`,
    `SUMMARY:${escapeICalText(task.title || 'Untitled Task')}`,
  ];
  
  if (task.description && task.description.trim()) {
    lines.push(`DESCRIPTION:${escapeICalText(task.description)}`);
  }
  if (task.location && task.location.trim()) {
    lines.push(`LOCATION:${escapeICalText(task.location)}`);
  }
  
  lines.push(
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR'
  );
  
  const ical = lines.join('\r\n') + '\r\n';
  
  // Use the discovered calendar URL (with proper DSID)
  const eventURL = `${calendarURL}${eventUID}.ics`;
  
  console.log('Creating event at discovered URL:', eventURL.replace(/\/\d+\//, '/****/'));
  
  const response = await fetch(eventURL, {
    method: 'PUT',
    headers: {
      'Authorization': `Basic ${btoa(`${tokens.caldavUsername}:${cleanPassword}`)}`,
      'Content-Type': 'text/calendar; charset=utf-8',
      'If-None-Match': '*',
      'User-Agent': 'TaskZM-CalDAV-Client/1.0',
    },
    body: ical,
  });
  
  // Accept 201 (Created), 204 (No Content), or 200 (OK) as success
  if (response.ok || response.status === 201 || response.status === 204) {
    console.log('Apple Calendar event created successfully:', eventUID);
    
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
  
  // If 401/403 - authentication issue
  if (response.status === 401 || response.status === 403) {
    throw new Error(`Authentication failed (${response.status}). Please check your app-specific password and reconnect Apple Calendar.`);
  }
  
  const errorText = await response.text();
  throw new Error(`Failed to create Apple Calendar event: ${response.status} ${response.statusText} - ${errorText.substring(0, 200)}`);
}

// Helper functions for iCal formatting
function formatICalDate(date: string): string {
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

function calculateEndDate(startDate: string, estimatedMinutes?: number): string {
  if (!startDate) {
    throw new Error('startDate is required for calculateEndDate');
  }
  const start = new Date(startDate);
  if (isNaN(start.getTime())) {
    throw new Error(`Invalid startDate format: ${startDate}`);
  }
  const minutes = estimatedMinutes || DEFAULT_EVENT_DURATION_MINUTES;
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
  let calendarURL = await getAppleCalendarURL(tokens);

  if (!calendarURL.endsWith('/')) {
    calendarURL += '/';
  }

  // Validate and normalize dates the same way as createAppleCalendarEvent
  const startDate = task.scheduledDate || task.dueDate;
  if (!startDate) {
    throw new Error('Task must have a scheduledDate or dueDate to update a calendar event');
  }

  const startDateObj = new Date(startDate);
  if (isNaN(startDateObj.getTime())) {
    throw new Error(`Invalid date format: ${startDate}`);
  }

  const isoStartDate = startDateObj.toISOString();
  const endDate = calculateEndDate(isoStartDate, task.estimatedTime);
  
  const event = {
    uid: eventUID,
    dtstart: isoStartDate,
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
    start: isoStartDate,
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
  let calendarURL = await getAppleCalendarURL(tokens);

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
  // For Apple, first check if using the new CalDAV setup (credentials in KV store)
  if (provider === 'apple') {
    const newCalDavEvents = await getAppleEventsFromDatabase(userId, startDate, endDate);
    if (newCalDavEvents.length > 0) {
      return newCalDavEvents;
    }
    // If no events in database, check if new CalDAV is configured
    const credentialsJson = await kv.get(`caldav_credentials_${userId}`);
    if (credentialsJson) {
      // New CalDAV is configured but no events synced yet - return empty
      // (the sync will populate the calendar_events table)
      return [];
    }
    // Fall back to old CalDAV token approach
  }

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
 * Generate recurring event occurrences from RRULE
 */
function generateRecurringOccurrences(
  baseEvent: any,
  rangeStart: Date,
  rangeEnd: Date
): CalendarEvent[] {
  if (!baseEvent.rrule) {
    // Not a recurring event, return single occurrence if in range
    const eventStart = new Date(baseEvent.start_time);
    if (eventStart >= rangeStart && eventStart <= rangeEnd) {
      return [{
        id: baseEvent.id,
        title: baseEvent.title,
        description: baseEvent.description,
        start: baseEvent.start_time,
        end: baseEvent.end_time,
        location: baseEvent.location,
        provider: 'apple' as const,
        providerEventId: baseEvent.external_id,
        calendarColor: baseEvent.calendar_color,
      }];
    }
    return [];
  }

  const occurrences: CalendarEvent[] = [];
  
  // Parse RRULE
  const parts: Record<string, string> = {};
  baseEvent.rrule.split(';').forEach((part: string) => {
    const [key, value] = part.split('=');
    if (key && value) parts[key] = value;
  });

  const freq = parts['FREQ'];
  const interval = parseInt(parts['INTERVAL'] || '1', 10);
  const count = parts['COUNT'] ? parseInt(parts['COUNT'], 10) : undefined;
  const until = parts['UNTIL'];
  const byDay = parts['BYDAY'];
  const byMonthDay = parts['BYMONTHDAY'];

  // Parse base event times
  const baseStart = new Date(baseEvent.start_time);
  const baseEnd = new Date(baseEvent.end_time);
  const duration = baseEnd.getTime() - baseStart.getTime();
  const isUtc = baseEvent.start_time.endsWith('Z');

  // Calculate until date
  let untilDate = rangeEnd;
  if (until) {
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

  // Limit iterations
  const maxIterations = count || MAX_RECURRENCE_ITERATIONS;
  let iterations = 0;
  let currentDate = new Date(baseStart);

  while (currentDate <= untilDate && currentDate <= rangeEnd && iterations < maxIterations) {
    if (currentDate >= rangeStart && currentDate <= rangeEnd) {
      const endDate = new Date(currentDate.getTime() + duration);
      
      occurrences.push({
        id: `${baseEvent.id}_${currentDate.toISOString().replace(/[-:TZ.]/g, '').substring(0, 14)}`,
        title: baseEvent.title,
        description: baseEvent.description,
        start: isUtc ? currentDate.toISOString() : currentDate.toISOString().replace('Z', ''),
        end: isUtc ? endDate.toISOString() : endDate.toISOString().replace('Z', ''),
        location: baseEvent.location,
        provider: 'apple' as const,
        providerEventId: `${baseEvent.external_id}_${currentDate.toISOString().replace(/[-:TZ.]/g, '').substring(0, 14)}`,
        calendarColor: baseEvent.calendar_color,
      });
    }

    // Move to next occurrence
    if (isUtc) {
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
            currentDate.setUTCDate(Math.min(targetDay, new Date(currentDate.getUTCFullYear(), currentDate.getUTCMonth() + 1, 0).getUTCDate()));
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
    } else {
      switch (freq) {
        case 'DAILY':
          currentDate.setDate(currentDate.getDate() + interval);
          break;
        case 'WEEKLY':
          currentDate.setDate(currentDate.getDate() + (7 * interval));
          break;
        case 'MONTHLY':
          if (byMonthDay) {
            const targetDay = parseInt(byMonthDay, 10);
            currentDate.setMonth(currentDate.getMonth() + interval);
            currentDate.setDate(Math.min(targetDay, new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate()));
          } else {
            currentDate.setMonth(currentDate.getMonth() + interval);
          }
          break;
        case 'YEARLY':
          currentDate.setFullYear(currentDate.getFullYear() + interval);
          break;
        default:
          iterations = maxIterations;
      }
    }

    iterations++;
  }

  return occurrences;
}

/**
 * Get Apple Calendar events from the database (new CalDAV sync)
 */
async function getAppleEventsFromDatabase(
  userId: string,
  startDate: string,
  endDate: string
): Promise<CalendarEvent[]> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // Fetch all events (including base recurring events)
    // We'll expand recurring events on-demand
    // Fetch all events for this user - we'll filter and expand in code
    const { data: events, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .eq('source', 'icloud')
      .order('start_time', { ascending: true });

    if (error) {
      console.log('Error fetching Apple events from database:', error);
      return [];
    }

    const result: CalendarEvent[] = [];
    const processedBaseEvents = new Set<string>();
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    for (const event of events || []) {
      // If this is a base recurring event (has RRULE and no recurrence_base_id)
      if (event.is_recurring && event.rrule && !event.recurrence_base_id) {
        // Only process each base event once
        if (processedBaseEvents.has(event.external_id)) {
          continue;
        }
        processedBaseEvents.add(event.external_id);

        // Generate occurrences for this recurring event within the date range
        const occurrences = generateRecurringOccurrences(
          event,
          startDateObj,
          endDateObj
        );
        result.push(...occurrences);
      } else if (!event.recurrence_base_id) {
        // Regular non-recurring event - only include if within date range
        const eventStart = new Date(event.start_time);
        if (eventStart >= startDateObj && eventStart <= endDateObj) {
          result.push({
            id: event.id,
            title: event.title,
            description: event.description,
            start: event.start_time,
            end: event.end_time,
            location: event.location,
            provider: 'apple' as const,
            providerEventId: event.external_id,
            calendarColor: event.calendar_color,
          });
        }
      }
      // Skip expanded instances (they're handled by base event expansion)
    }

    // Sort by start time
    result.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    return result;
  } catch (error) {
    console.log('Failed to fetch Apple events from database:', error);
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
    calendarURL = await getAppleCalendarURL(tokens);
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
