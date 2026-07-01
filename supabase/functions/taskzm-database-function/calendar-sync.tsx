/**
 * Calendar Sync Service
 * Handles bidirectional sync between TaskZM and calendar providers
 * Supports Google Calendar, Outlook Calendar, and Apple Calendar
 */

import * as kv from "./kv_store.tsx";
import * as caldav from "./caldav-client.tsx";
import { getGoogleOAuthConfig } from "./google-oauth-config.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  addCalendarDays,
  addCalendarMonths,
  addCalendarYears,
  getWallClockInTimeZone,
  wallClockPartsToUtcDate,
} from './calendar-timezone-utils.ts';

// Constants
const MAX_RECURRENCE_ITERATIONS = 365; // Maximum iterations for recurring event expansion (1 year)
const TOKEN_VALIDITY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes buffer for token validity check
const DEFAULT_EVENT_DURATION_MINUTES = 30; // Default duration for calendar events without end time
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000; // 86400000 ms - milliseconds in one day
const DAYS_PER_WEEK = 7; // Number of days in a week
const MIDNIGHT_HOUR = 0; // Hour for midnight normalization
const MIDNIGHT_MINUTE = 0; // Minute for midnight normalization
const MIDNIGHT_SECOND = 0; // Second for midnight normalization
const MIDNIGHT_MILLISECOND = 0; // Millisecond for midnight normalization
const END_OF_DAY_HOUR = 23; // Hour for end of day normalization
const END_OF_DAY_MINUTE = 59; // Minute for end of day normalization
const END_OF_DAY_SECOND = 59; // Second for end of day normalization
const END_OF_DAY_MILLISECOND = 999; // Millisecond for end of day normalization
const DEFAULT_CALENDAR_TIMEZONE = 'America/New_York';

function resolveUserTimezone(userTimezone?: string): string {
  const candidate = (userTimezone || '').trim();
  if (!candidate) return DEFAULT_CALENDAR_TIMEZONE;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: candidate });
    return candidate;
  } catch {
    return DEFAULT_CALENDAR_TIMEZONE;
  }
}

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
  rrule?: string; // Original RRULE string for recurring events
  recurrenceBaseId?: string; // Links instances to base recurring event
  isRecurring?: boolean; // Flag indicating if this is a recurring event
  recurrenceAnchorStart?: string; // Base series start (for client DST correction)
  recurrenceAnchorEnd?: string; // Base series end (for duration)
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
  const oauthConfig = getGoogleOAuthConfig();

  if (!oauthConfig) {
    throw new Error('Google OAuth credentials not configured');
  }

  if (!tokens.refreshToken) {
    throw new Error('No refresh token available. Please reconnect your Google Calendar.');
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: oauthConfig.clientId,
      client_secret: oauthConfig.clientSecret,
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
      scope: 'https://graph.microsoft.com/Calendars.Read offline_access',
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
  endDate: string,
  userTimezone?: string
): Promise<CalendarEvent[]> {
  const resolvedTimezone = resolveUserTimezone(userTimezone);

  // For Apple, always use database (events are synced via CalDAV)
  if (provider === 'apple') {
    return await getAppleEventsFromDatabase(userId, startDate, endDate, resolvedTimezone);
  }

  // For Google and Outlook, try database first, then fall back to API
  let events: CalendarEvent[] = [];
  
  if (provider === 'google') {
    events = await getGoogleEventsFromDatabase(userId, startDate, endDate, resolvedTimezone);
    // If no events in database, fetch from API
    if (events.length === 0) {
      const tokens = await getCalendarTokens(userId, provider);
      if (tokens) {
        const refreshedTokens = await refreshAccessToken(userId, provider, tokens);
        events = await getGoogleCalendarEvents(refreshedTokens, startDate, endDate, resolvedTimezone);
      }
    }
  } else if (provider === 'outlook') {
    events = await getOutlookEventsFromDatabase(userId, startDate, endDate, resolvedTimezone);
    // If no events in database, fetch from API
    if (events.length === 0) {
      const tokens = await getCalendarTokens(userId, provider);
      if (tokens) {
        const refreshedTokens = await refreshAccessToken(userId, provider, tokens);
        events = await getOutlookCalendarEvents(refreshedTokens, startDate, endDate, resolvedTimezone);
      }
    }
  }

  return events;
}

/**
 * Generate recurring event occurrences from RRULE.
 * Preserves wall-clock time in `timeZone` across DST (iCalendar semantics).
 */
function generateRecurringOccurrences(
  baseEvent: any,
  rangeStart: Date,
  rangeEnd: Date,
  timeZone: string,
): CalendarEvent[] {
  const normalizeStart = (ts: string) => new Date(ts).toISOString();
  const normalizeEnd = (ts: string) => new Date(ts).toISOString();

  if (!baseEvent.rrule) {
    // Not a recurring event, return single occurrence if in range
    if (eventOverlapsQueryRange(baseEvent.start_time, baseEvent.end_time, rangeStart, rangeEnd)) {
      // Determine provider from source or external_id format
      let provider: CalendarProvider = 'apple';
      if (baseEvent.source === 'google' || baseEvent.external_id?.startsWith('google_')) {
        provider = 'google';
      } else if (baseEvent.source === 'outlook' || baseEvent.external_id?.startsWith('outlook_')) {
        provider = 'outlook';
      }
      
      return [{
        id: baseEvent.id,
        title: baseEvent.title,
        description: baseEvent.description,
        start: normalizeStart(baseEvent.start_time),
        end: normalizeEnd(ensureEventEndTime(baseEvent.start_time, baseEvent.end_time)),
        location: baseEvent.location,
        provider,
        providerEventId: baseEvent.external_id,
        calendarColor: baseEvent.calendar_color,
        rrule: baseEvent.rrule,
        recurrenceBaseId: undefined,
        isRecurring: !!baseEvent.rrule,
      }];
    }
    return [];
  }

  const occurrences: CalendarEvent[] = [];
  
  let provider: CalendarProvider = 'apple';
  if (baseEvent.source === 'google' || baseEvent.external_id?.startsWith('google_')) {
    provider = 'google';
  } else if (baseEvent.source === 'outlook' || baseEvent.external_id?.startsWith('outlook_')) {
    provider = 'outlook';
  }
  
  const parts: Record<string, string> = {};
  baseEvent.rrule.split(';').forEach((part: string) => {
    const [key, value] = part.split('=');
    if (key && value) parts[key] = value;
  });

  const freq = parts['FREQ'];
  const interval = parseInt(parts['INTERVAL'] || '1', 10);
  const count = parts['COUNT'] ? parseInt(parts['COUNT'], 10) : undefined;
  const until = parts['UNTIL'];
  const byMonthDay = parts['BYMONTHDAY'] ? parseInt(parts['BYMONTHDAY'], 10) : undefined;

  const baseStart = new Date(baseEvent.start_time);
  const baseEnd = new Date(baseEvent.end_time);
  const duration = baseEnd.getTime() - baseStart.getTime();

  let untilDate = rangeEnd;
  if (until && until.length >= 8) {
    const year = parseInt(until.substring(0, 4), 10);
    const month = parseInt(until.substring(4, 6), 10) - 1;
    const day = parseInt(until.substring(6, 8), 10);
    let hour = 23, minute = 59, second = 59;
    if (until.length >= 15) {
      hour = parseInt(until.substring(9, 11), 10);
      minute = parseInt(until.substring(11, 13), 10);
      second = parseInt(until.substring(13, 15), 10);
    }
    untilDate = wallClockPartsToUtcDate(
      { year, monthIndex: month, day, hour, minute, second },
      timeZone,
    );
  }

  const maxIterations = count || MAX_RECURRENCE_ITERATIONS;
  let iterations = 0;

  // Preserve local wall-clock time from the base event (handles DST on each occurrence)
  let wall = getWallClockInTimeZone(baseStart, timeZone);
  let currentInstant = wallClockPartsToUtcDate(wall, timeZone);

  // Fast-forward to first occurrence near rangeStart
  if (currentInstant < rangeStart) {
    if (freq === 'DAILY') {
      const daysDiff = Math.floor((rangeStart.getTime() - currentInstant.getTime()) / MILLISECONDS_PER_DAY);
      const intervalsToSkip = Math.floor(daysDiff / interval);
      wall = addCalendarDays(wall, intervalsToSkip * interval);
    } else if (freq === 'WEEKLY') {
      const daysDiff = Math.floor((rangeStart.getTime() - currentInstant.getTime()) / MILLISECONDS_PER_DAY);
      const weeksToSkip = Math.floor(daysDiff / (DAYS_PER_WEEK * interval));
      wall = addCalendarDays(wall, weeksToSkip * DAYS_PER_WEEK * interval);
    } else {
      let skipGuard = 0;
      while (wallClockPartsToUtcDate(wall, timeZone) < rangeStart && skipGuard < maxIterations) {
        if (freq === 'MONTHLY') {
          wall = addCalendarMonths(wall, interval, byMonthDay);
        } else if (freq === 'YEARLY') {
          wall = addCalendarYears(wall, interval, byMonthDay);
        } else {
          break;
        }
        skipGuard++;
      }
    }
    currentInstant = wallClockPartsToUtcDate(wall, timeZone);
  }

  while (currentInstant <= untilDate && currentInstant <= rangeEnd && iterations < maxIterations) {
    if (currentInstant >= rangeStart && currentInstant <= rangeEnd) {
      const endInstant = new Date(currentInstant.getTime() + duration);
      occurrences.push({
        id: `${baseEvent.id}_${currentInstant.toISOString().replace(/[-:TZ.]/g, '').substring(0, 14)}`,
        title: baseEvent.title,
        description: baseEvent.description,
        start: currentInstant.toISOString(),
        end: endInstant.toISOString(),
        location: baseEvent.location,
        provider: provider as CalendarProvider,
        providerEventId: `${baseEvent.external_id}_${currentInstant.toISOString().replace(/[-:TZ.]/g, '').substring(0, 14)}`,
        calendarColor: baseEvent.calendar_color,
        rrule: baseEvent.rrule,
        recurrenceBaseId: baseEvent.external_id,
        isRecurring: true,
        recurrenceAnchorStart: new Date(baseEvent.start_time).toISOString(),
        recurrenceAnchorEnd: new Date(baseEvent.end_time).toISOString(),
      });
    }

    switch (freq) {
      case 'DAILY':
        wall = addCalendarDays(wall, interval);
        break;
      case 'WEEKLY':
        wall = addCalendarDays(wall, DAYS_PER_WEEK * interval);
        break;
      case 'MONTHLY':
        wall = addCalendarMonths(wall, interval, byMonthDay);
        break;
      case 'YEARLY':
        wall = addCalendarYears(wall, interval, byMonthDay);
        break;
      default:
        iterations = maxIterations;
        break;
    }

    currentInstant = wallClockPartsToUtcDate(wall, timeZone);
    iterations++;
  }

  return occurrences;
}

/** True when an event interval overlaps the query range (inclusive), not only when start is inside. */
function eventOverlapsQueryRange(
  startTime: string,
  endTime: string | null | undefined,
  rangeStart: Date,
  rangeEnd: Date,
): boolean {
  const eventStart = new Date(startTime);
  if (isNaN(eventStart.getTime())) return false;

  let eventEnd = endTime ? new Date(endTime) : eventStart;
  if (isNaN(eventEnd.getTime())) {
    eventEnd = eventStart;
  }
  if (eventEnd.getTime() < eventStart.getTime()) {
    eventEnd = eventStart;
  }

  return eventStart <= rangeEnd && eventEnd >= rangeStart;
}

function ensureEventEndTime(startTime: string, endTime: string | null | undefined): string {
  if (endTime) return endTime;
  const start = new Date(startTime);
  if (isNaN(start.getTime())) return startTime;
  return new Date(start.getTime() + DEFAULT_EVENT_DURATION_MINUTES * 60 * 1000).toISOString();
}

/**
 * Get Apple Calendar events from the database (new CalDAV sync)
 */
async function getAppleEventsFromDatabase(
  userId: string,
  startDate: string,
  endDate: string,
  timeZone: string,
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
      console.warn('Apple events fetch failed (table may not exist or RLS):', error.message);
      return [];
    }

    const result: CalendarEvent[] = [];
    const processedBaseEvents = new Set<string>();
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
      console.warn('Apple events: invalid startDate or endDate', { startDate, endDate });
      return [];
    }

    for (const event of events || []) {
      // If this is a base recurring event (has RRULE)
      if (event.rrule) {
        // Only process each base event once
        if (processedBaseEvents.has(event.external_id)) {
          continue;
        }
        processedBaseEvents.add(event.external_id);

        // Generate occurrences for this recurring event within the date range
        const occurrences = generateRecurringOccurrences(
          event,
          startDateObj,
          endDateObj,
          timeZone,
        );
        result.push(...occurrences);
      } else {
        // Regular non-recurring event - include if it overlaps the date range
        if (eventOverlapsQueryRange(event.start_time, event.end_time, startDateObj, endDateObj)) {
          result.push({
            id: event.id,
            title: event.title,
            description: event.description,
            start: event.start_time,
            end: ensureEventEndTime(event.start_time, event.end_time),
            location: event.location,
            provider: 'apple' as CalendarProvider,
            providerEventId: event.external_id,
            calendarColor: event.calendar_color,
            // Include recurrence metadata
            rrule: event.rrule,
            recurrenceBaseId: undefined, // Not storing instances, so no base ID
            isRecurring: !!event.rrule,
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
 * Get Google Calendar events from the database
 */
async function getGoogleEventsFromDatabase(
  userId: string,
  startDate: string,
  endDate: string,
  timeZone: string,
): Promise<CalendarEvent[]> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // Fetch all events (including base recurring events)
    const { data: events, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .eq('source', 'google')
      .order('start_time', { ascending: true });

    if (error) {
      console.log('Error fetching Google events from database:', error);
      return [];
    }

    const result: CalendarEvent[] = [];
    const processedBaseEvents = new Set<string>();
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    for (const event of events || []) {
      // If this is a base recurring event (has RRULE)
      if (event.rrule) {
        // Only process each base event once
        if (processedBaseEvents.has(event.external_id)) {
          continue;
        }
        processedBaseEvents.add(event.external_id);

        // Generate occurrences for this recurring event within the date range
        const occurrences = generateRecurringOccurrences(
          event,
          startDateObj,
          endDateObj,
          timeZone,
        );
        result.push(...occurrences);
      } else {
        // Regular non-recurring event - include if it overlaps the date range
        if (eventOverlapsQueryRange(event.start_time, event.end_time, startDateObj, endDateObj)) {
          result.push({
            id: event.id,
            title: event.title,
            description: event.description,
            start: event.start_time,
            end: ensureEventEndTime(event.start_time, event.end_time),
            location: event.location,
            provider: 'google' as const,
            providerEventId: event.external_id,
            calendarColor: event.calendar_color,
            // Include recurrence metadata
            rrule: event.rrule,
            recurrenceBaseId: undefined, // Not storing instances, so no base ID
            isRecurring: !!event.rrule,
          });
        }
      }
      // Skip expanded instances (they're handled by base event expansion)
    }

    // Sort by start time
    result.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    return result;
  } catch (error) {
    console.log('Failed to fetch Google events from database:', error);
    return [];
  }
}

/**
 * Get Outlook Calendar events from the database
 */
async function getOutlookEventsFromDatabase(
  userId: string,
  startDate: string,
  endDate: string,
  timeZone: string,
): Promise<CalendarEvent[]> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    );

    // Fetch all events (including base recurring events)
    const { data: events, error } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', userId)
      .eq('source', 'outlook')
      .order('start_time', { ascending: true });

    if (error) {
      console.log('Error fetching Outlook events from database:', error);
      return [];
    }

    const result: CalendarEvent[] = [];
    const processedBaseEvents = new Set<string>();
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);

    for (const event of events || []) {
      // If this is a base recurring event (has RRULE)
      if (event.rrule) {
        // Only process each base event once
        if (processedBaseEvents.has(event.external_id)) {
          continue;
        }
        processedBaseEvents.add(event.external_id);

        // Generate occurrences for this recurring event within the date range
        const occurrences = generateRecurringOccurrences(
          event,
          startDateObj,
          endDateObj,
          timeZone,
        );
        result.push(...occurrences);
      } else {
        // Regular non-recurring event - include if it overlaps the date range
        if (eventOverlapsQueryRange(event.start_time, event.end_time, startDateObj, endDateObj)) {
          result.push({
            id: event.id,
            title: event.title,
            description: event.description,
            start: event.start_time,
            end: ensureEventEndTime(event.start_time, event.end_time),
            location: event.location,
            provider: 'outlook' as const,
            providerEventId: event.external_id,
            calendarColor: event.calendar_color,
            // Include recurrence metadata
            rrule: event.rrule,
            recurrenceBaseId: undefined, // Not storing instances, so no base ID
            isRecurring: !!event.rrule,
          });
        }
      }
      // Skip expanded instances (they're handled by base event expansion)
    }

    // Sort by start time
    result.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    return result;
  } catch (error) {
    console.log('Failed to fetch Outlook events from database:', error);
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
 * Convert Google Calendar recurrence to RRULE
 */
export function convertGoogleRecurrenceToRRULE(recurrence: string[]): string | undefined {
  if (!recurrence || recurrence.length === 0) {
    return undefined;
  }
  
  // Google Calendar returns RRULE strings directly in the recurrence array
  // Format: "RRULE:FREQ=WEEKLY;BYDAY=MO;UNTIL=20231231T235959Z"
  const rruleString = recurrence.find((r: string) => r.startsWith('RRULE:'));
  if (rruleString) {
    // Remove "RRULE:" prefix
    return rruleString.substring(6);
  }
  
  return undefined;
}

// Google Calendar event colorId 1-11 to hex (predefined palette)
const GOOGLE_EVENT_COLOR_ID_TO_HEX: Record<string, string> = {
  '1': '#A4BDFC',   // Lavender
  '2': '#7AE7BF',   // Sage
  '3': '#DBADFF',   // Grape
  '4': '#FF887C',   // Flamingo
  '5': '#FBD75B',   // Banana
  '6': '#FFB878',   // Tangerine
  '7': '#46D6DB',   // Peacock
  '8': '#E1E1E1',   // Graphite
  '9': '#5484ED',   // Blueberry
  '10': '#51B749',  // Basil
  '11': '#DC2127',  // Tomato
};

function googleColorIdToHex(colorId: string | number | undefined): string | undefined {
  if (colorId == null || colorId === '') return undefined;
  return GOOGLE_EVENT_COLOR_ID_TO_HEX[String(colorId)];
}

/**
 * Get Google Calendar events
 */
async function getGoogleCalendarEvents(
  tokens: CalendarTokens,
  startDate: string,
  endDate: string,
  userTimezone: string = DEFAULT_CALENDAR_TIMEZONE
): Promise<CalendarEvent[]> {
  const resolvedTimezone = resolveUserTimezone(userTimezone);
  // Fetch base recurring events (not expanded)
  const baseUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
  baseUrl.searchParams.set('timeMin', startDate);
  baseUrl.searchParams.set('timeMax', endDate);
  baseUrl.searchParams.set('singleEvents', 'false'); // Get base recurring events
  baseUrl.searchParams.set('orderBy', 'startTime');
  baseUrl.searchParams.set('timeZone', resolvedTimezone);

  const response = await fetch(baseUrl.toString(), {
    headers: {
      'Authorization': `Bearer ${tokens.accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Google Calendar events');
  }

  const data = await response.json();
  
  return (data.items || []).map((event: any) => {
    const isRecurring = !!(event.recurrence && event.recurrence.length > 0);
    const rrule = isRecurring ? convertGoogleRecurrenceToRRULE(event.recurrence) : undefined;
    const recurrenceBaseId = event.recurringEventId || (isRecurring ? event.id : undefined);
    
    return {
      id: `google_${event.id}`,
      title: event.summary,
      description: event.description,
      start: event.start.dateTime || event.start.date,
      end: event.end.dateTime || event.end.date,
      location: event.location,
      provider: 'google',
      providerEventId: event.id,
      calendarColor: googleColorIdToHex(event.colorId),
      rrule,
      recurrenceBaseId,
      isRecurring,
    };
  });
}

/**
 * Convert Outlook Calendar recurrence pattern to RRULE
 */
function convertOutlookRecurrenceToRRULE(recurrence: any): string | undefined {
  if (!recurrence || !recurrence.pattern) {
    return undefined;
  }
  
  const pattern = recurrence.pattern;
  const range = recurrence.range;
  
  let rrule = '';
  
  // Frequency
  const freq = pattern.type?.toUpperCase();
  if (!freq) return undefined;
  
  // Map Outlook frequency to RRULE frequency
  let rruleFreq: string;
  switch (freq) {
    case 'DAILY':
      rruleFreq = 'DAILY';
      break;
    case 'WEEKLY':
      rruleFreq = 'WEEKLY';
      break;
    case 'ABSOLUTEMONTHLY':
    case 'RELATIVEMONTHLY':
      rruleFreq = 'MONTHLY';
      break;
    case 'ABSOLUTEYEARLY':
    case 'RELATIVEYEARLY':
      rruleFreq = 'YEARLY';
      break;
    default:
      return undefined;
  }
  
  rrule = `FREQ=${rruleFreq}`;
  
  // Interval
  if (pattern.interval && pattern.interval > 1) {
    rrule += `;INTERVAL=${pattern.interval}`;
  }
  
  // Days of week (for weekly/monthly/yearly)
  if (pattern.daysOfWeek && pattern.daysOfWeek.length > 0) {
    const dayMap: Record<string, string> = {
      'sunday': 'SU',
      'monday': 'MO',
      'tuesday': 'TU',
      'wednesday': 'WE',
      'thursday': 'TH',
      'friday': 'FR',
      'saturday': 'SA',
    };
    const days = pattern.daysOfWeek.map((d: string) => dayMap[d.toLowerCase()]).filter(Boolean);
    if (days.length > 0) {
      rrule += `;BYDAY=${days.join(',')}`;
    }
  }
  
  // Day of month (for monthly/yearly)
  if (pattern.dayOfMonth) {
    rrule += `;BYMONTHDAY=${pattern.dayOfMonth}`;
  }
  
  // Month (for yearly)
  if (pattern.month) {
    rrule += `;BYMONTH=${pattern.month}`;
  }
  
  // Range
  if (range) {
    if (range.type === 'endDate' && range.endDate) {
      // Convert date to UNTIL format (YYYYMMDDTHHMMSSZ)
      const endDate = new Date(range.endDate);
      const year = endDate.getUTCFullYear();
      const month = String(endDate.getUTCMonth() + 1).padStart(2, '0');
      const day = String(endDate.getUTCDate()).padStart(2, '0');
      const hour = String(endDate.getUTCHours()).padStart(2, '0');
      const minute = String(endDate.getUTCMinutes()).padStart(2, '0');
      const second = String(endDate.getUTCSeconds()).padStart(2, '0');
      rrule += `;UNTIL=${year}${month}${day}T${hour}${minute}${second}Z`;
    } else if (range.type === 'numbered' && range.numberOfOccurrences) {
      rrule += `;COUNT=${range.numberOfOccurrences}`;
    }
  }
  
  return rrule;
}

/**
 * Get Outlook Calendar events
 */
async function getOutlookCalendarEvents(
  tokens: CalendarTokens,
  startDate: string,
  endDate: string,
  userTimezone: string = DEFAULT_CALENDAR_TIMEZONE
): Promise<CalendarEvent[]> {
  const resolvedTimezone = resolveUserTimezone(userTimezone);
  // Fetch base recurring events (not expanded instances)
  // Use /events endpoint with $filter to get series masters
  const url = new URL('https://graph.microsoft.com/v1.0/me/calendar/events');
  url.searchParams.set('$filter', `start/dateTime ge '${startDate}' and end/dateTime le '${endDate}'`);
  url.searchParams.set('$select', 'id,subject,body,start,end,location,recurrence,seriesMasterId,type');
  url.searchParams.set('$orderby', 'start/dateTime');

  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Bearer ${tokens.accessToken}`,
      'Prefer': `outlook.timezone="${resolvedTimezone}"`,
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch Outlook Calendar events');
  }

  const data = await response.json();
  
  // Default Outlook/Microsoft 365 calendar color (no per-event color in Graph)
  const OUTLOOK_DEFAULT_CALENDAR_COLOR = '#0078D4';

  return (data.value || []).map((event: any) => {
    // Only process series masters (base recurring events) or single events
    const isRecurring = event.type === 'seriesMaster' || !!event.recurrence;
    const rrule = isRecurring ? convertOutlookRecurrenceToRRULE(event.recurrence) : undefined;
    const recurrenceBaseId = event.seriesMasterId || (isRecurring ? event.id : undefined);
    
    return {
      id: `outlook_${event.id}`,
      title: event.subject,
      description: event.body?.content,
      start: event.start.dateTime,
      end: event.end.dateTime,
      location: event.location?.displayName,
      provider: 'outlook',
      providerEventId: event.id,
      calendarColor: OUTLOOK_DEFAULT_CALENDAR_COLOR,
      rrule,
      recurrenceBaseId,
      isRecurring,
    };
  });
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
