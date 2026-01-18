/**
 * Google Calendar Sync
 * Syncs Google Calendar events to the database (similar to Apple Calendar CalDAV sync)
 * Stores base recurring events with RRULE for on-demand expansion
 */

import * as calendarSync from './calendar-sync.tsx';

// Import CalendarEvent type
type CalendarEvent = calendarSync.CalendarEvent;

const DEFAULT_TIMEZONE = 'America/New_York';
const CALENDAR_SYNC_PAST_DAYS = 365; // Days to look back when syncing calendar (to capture recurring events)
const CALENDAR_SYNC_FUTURE_DAYS = 90; // Days to look ahead when syncing calendar
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000; // 86400000 ms
const GOOGLE_CALENDAR_MAX_RESULTS = 2500; // Google Calendar API max results limit
const GOOGLE_CALENDAR_PRIMARY = 'primary'; // Google Calendar default calendar identifier
const TOKEN_EXPIRY_ASSUMPTION_MS = 3600 * 1000; // 1 hour in milliseconds - assumed token expiry (will refresh if needed) - using calculation for clarity (3600 seconds * 1000 ms)

export interface SyncResult {
  success: boolean;
  created: number;
  updated: number;
  deleted: number;
  errors: string[];
}

/**
 * Sync Google Calendar events to database
 * Similar to Apple Calendar sync - stores base recurring events with RRULE
 */
export async function syncGoogleCalendarsToDatabase(
  supabase: any,
  userId: string,
  workspaceId: string,
  userTimezone: string = DEFAULT_TIMEZONE
): Promise<SyncResult> {
  console.log(`[Google Calendar Sync] Syncing with user timezone: ${userTimezone}`);
  
  const result: SyncResult = {
    success: true,
    created: 0,
    updated: 0,
    deleted: 0,
    errors: [],
  };

  try {
    // Get Google Calendar tokens
    const tokens = await calendarSync.getCalendarTokens(userId, 'google');
    if (!tokens) {
      result.success = false;
      result.errors.push('Google Calendar not connected. Please connect your Google Calendar first.');
      return result;
    }

    // Refresh tokens if needed
    const refreshedTokens = await calendarSync.refreshAccessToken(userId, 'google', tokens);

    // Calculate date range for sync
    const startDate = new Date(Date.now() - (CALENDAR_SYNC_PAST_DAYS * MILLISECONDS_PER_DAY));
    const endDate = new Date(Date.now() + (CALENDAR_SYNC_FUTURE_DAYS * MILLISECONDS_PER_DAY));
    
    console.log(`[Google Calendar Sync] Fetching events from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Fetch events from Google Calendar API
    // Use singleEvents=false to get base recurring events with RRULE
    const baseUrl = new URL('https://www.googleapis.com/calendar/v3/calendars/primary/events');
    baseUrl.searchParams.set('timeMin', startDate.toISOString());
    baseUrl.searchParams.set('timeMax', endDate.toISOString());
    baseUrl.searchParams.set('singleEvents', 'false'); // Get base recurring events
    baseUrl.searchParams.set('orderBy', 'startTime');
    baseUrl.searchParams.set('maxResults', GOOGLE_CALENDAR_MAX_RESULTS.toString());

    const response = await fetch(baseUrl.toString(), {
      headers: {
        'Authorization': `Bearer ${refreshedTokens.accessToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch Google Calendar events: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    const googleEvents = data.items || [];
    
    console.log(`[Google Calendar Sync] Fetched ${googleEvents.length} events from Google Calendar`);

    // Convert Google events to our CalendarEvent format
    const allEvents: CalendarEvent[] = [];
    
    for (const event of googleEvents) {
      try {
        const isRecurring = !!(event.recurrence && event.recurrence.length > 0);
        const rrule = isRecurring ? calendarSync.convertGoogleRecurrenceToRRULE(event.recurrence) : undefined;
        
        // Skip if event is missing required fields
        if (!event.id || !event.summary) {
          console.warn('[Google Calendar Sync] Skipping event with missing required fields:', {
            hasId: !!event.id,
            hasSummary: !!event.summary,
            eventId: event.id,
          });
          continue;
        }

        allEvents.push({
          id: `google_${event.id}`,
          title: event.summary || 'Untitled Event',
          description: event.description,
          start: event.start?.dateTime || event.start?.date || new Date().toISOString(),
          end: event.end?.dateTime || event.end?.date || new Date().toISOString(),
          location: event.location,
          provider: 'google' as const,
          providerEventId: event.id,
          calendarColor: event.colorId ? `#${event.colorId}` : undefined,
          rrule,
          recurrenceBaseId: event.recurringEventId || (isRecurring ? event.id : undefined),
          isRecurring,
        });
      } catch (error) {
        const message = `Failed to process event ${event.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(message);
        console.error(`[Google Calendar Sync] ${message}`, error);
      }
    }

    console.log(`[Google Calendar Sync] Processed ${allEvents.length} events for database sync`);

    // Get existing synced events for this user
    const { data: existingEvents, error: fetchError } = await supabase
      .from('calendar_events')
      .select('id, external_id, external_updated_at, calendar_href')
      .eq('user_id', userId)
      .eq('source', 'google');

    if (fetchError) {
      result.errors.push(`Failed to fetch existing events: ${fetchError.message}`);
      result.success = false;
      return result;
    }

    // Build map of existing events by external_id
    const existingMap = new Map(
      (existingEvents || []).map((e: any) => [e.external_id, e])
    );
    
    // For fetched events, use base UID for recurring events (same format as external_id)
    const fetchedUids = new Set(allEvents.map(e => {
      // For base recurring events, use the event providerEventId (which is stored as external_id)
      // For instances, use base UID
      return e.recurrenceBaseId || e.providerEventId;
    }));

    // Process each fetched event
    console.log(`[Google Calendar Sync] Processing ${allEvents.length} events for database sync...`);
    for (const event of allEvents) {
      // Validate event has required fields before processing
      if (!event.providerEventId || !event.title || !event.start || !event.end) {
        console.warn('[Google Calendar Sync] Skipping event with missing required fields:', {
          hasProviderEventId: !!event.providerEventId,
          hasTitle: !!event.title,
          hasStart: !!event.start,
          hasEnd: !!event.end,
          eventId: event.providerEventId,
        });
        result.errors.push(`Event missing required fields: ${event.providerEventId || 'unknown'}`);
        continue;
      }
      
      // For recurring events, match by base UID (the event.providerEventId for base events)
      // For non-recurring events, match by event.providerEventId
      const matchKey = event.recurrenceBaseId || event.providerEventId;
      const existing = existingMap.get(matchKey);
      
      if (existing) {
        // Always update to ensure latest data is applied
        const { error: updateError } = await supabase
          .from('calendar_events')
          .update({
            title: event.title,
            description: event.description,
            start_time: event.start,
            end_time: event.end,
            location: event.location,
            calendar_color: event.calendarColor,
            external_updated_at: event.start, // Use start time as updated_at since Google doesn't provide lastModified
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateError) {
          console.error(`[Google Calendar Sync] Failed to update event ${event.providerEventId}:`, updateError);
          result.errors.push(`Failed to update event ${event.providerEventId}: ${updateError.message}`);
        } else {
          result.updated++;
          console.debug(`[Google Calendar Sync] Updated event: ${event.providerEventId} - ${event.title}`);
        }
      } else {
        // Create new event
        // For base recurring events, use event.providerEventId as external_id
        // For instances (shouldn't happen now), use base UID
        const externalId = event.recurrenceBaseId || event.providerEventId;
        const { error: insertError } = await supabase
          .from('calendar_events')
          .insert({
            user_id: userId,
            workspace_id: workspaceId,
            external_id: externalId,
            title: event.title,
            description: event.description,
            start_time: event.start,
            end_time: event.end,
            location: event.location,
            source: 'google',
            calendar_href: GOOGLE_CALENDAR_PRIMARY, // Google Calendar uses 'primary' as the default calendar
            calendar_color: event.calendarColor,
            external_updated_at: event.start, // Use start time as updated_at
            is_readonly: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error(`[Google Calendar Sync] Failed to create event ${event.providerEventId}:`, insertError);
          result.errors.push(`Failed to create event ${event.providerEventId}: ${insertError.message}`);
        } else {
          result.created++;
          console.debug(`[Google Calendar Sync] Created event: ${event.providerEventId} - ${event.title}`);
        }
      }
    }

    // Handle deletions - events that exist in DB but not in Google Calendar
    const syncedCalendarHrefs = new Set([GOOGLE_CALENDAR_PRIMARY]); // Google Calendar uses 'primary' as default
    
    // Compare external_id from DB with fetched event UIDs
    for (const [externalId, existing] of existingMap) {
      // Check if this external_id exists in the fetched events
      if (!fetchedUids.has(externalId)) {
        // Only delete if this event is from a synced calendar
        if (existing.calendar_href && syncedCalendarHrefs.has(existing.calendar_href)) {
          // Event was deleted from Google Calendar - remove from database
          const { error: deleteError } = await supabase
            .from('calendar_events')
            .delete()
            .eq('id', existing.id);

          if (deleteError) {
            result.errors.push(`Failed to delete event ${externalId}: ${deleteError.message}`);
          } else {
            result.deleted++;
            console.log(`[Google Calendar Sync] Deleted event ${externalId} from calendar ${existing.calendar_href} (no longer in Google Calendar)`);
          }
        } else {
          // Event is from a calendar that wasn't synced - skip deletion
          console.debug(`[Google Calendar Sync] Skipping deletion of event ${externalId} - not from synced calendar (href: ${existing.calendar_href})`);
        }
      }
    }

    if (result.errors.length > 0) {
      result.success = false;
    }

    // Log sync result
    console.log('[Google Calendar Sync] Sync completed:', {
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
    console.error('[Google Calendar Sync] Sync error:', error);
    return result;
  }
}
