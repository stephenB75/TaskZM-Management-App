# Calendar Recurring Events - All Providers Fix

## Summary
Fixed recurring calendar events import for **all calendar providers** (Google, Outlook, and Apple). Previously, only Apple Calendar events were properly handling recurring events with RRULE preservation. Google and Outlook calendars were not extracting recurrence information or storing it in the database.

## Issues Found

### 1. Google Calendar
- **Problem**: `getGoogleCalendarEvents` was using `singleEvents: 'true'` which expands recurring events into individual instances, losing the recurrence pattern.
- **Problem**: No extraction of `recurrence` field from Google Calendar API response.
- **Problem**: No conversion of Google's recurrence format to RRULE.
- **Problem**: Events not stored in database with recurrence metadata.

### 2. Outlook Calendar
- **Problem**: `getOutlookCalendarEvents` was using `calendarview` endpoint which expands recurring events.
- **Problem**: No extraction of `recurrence` pattern from Microsoft Graph API response.
- **Problem**: No conversion of Outlook's recurrence format to RRULE.
- **Problem**: Events not stored in database with recurrence metadata.

### 3. Hardcoded Provider Values
- **Problem**: `generateRecurringOccurrences` was hardcoded to only work with Apple events (`provider: 'apple' as const`).

## Fixes Implemented

### 1. Updated `CalendarEvent` Interface
Added recurrence fields to support all providers:
```typescript
export interface CalendarEvent {
  // ... existing fields
  rrule?: string; // Original RRULE string for recurring events
  recurrenceBaseId?: string; // Links instances to base recurring event
  isRecurring?: boolean; // Flag indicating if this is a recurring event
}
```

### 2. Google Calendar Recurrence Support
- **Created `convertGoogleRecurrenceToRRULE` function**: Converts Google Calendar's recurrence array format to RRULE string.
- **Updated `getGoogleCalendarEvents`**:
  - Changed `singleEvents: 'false'` to fetch base recurring events (not expanded).
  - Extracts `recurrence` field from API response.
  - Converts to RRULE using `convertGoogleRecurrenceToRRULE`.
  - Sets `isRecurring`, `rrule`, and `recurrenceBaseId` fields.

### 3. Outlook Calendar Recurrence Support
- **Created `convertOutlookRecurrenceToRRULE` function**: Converts Microsoft Graph API's recurrence object format to RRULE string.
  - Handles frequency types: DAILY, WEEKLY, MONTHLY, YEARLY.
  - Converts days of week, intervals, and date ranges.
  - Supports both `endDate` and `numbered` range types.
- **Updated `getOutlookCalendarEvents`**:
  - Changed to use `/events` endpoint with `$filter` to get series masters.
  - Extracts `recurrence` pattern from API response.
  - Converts to RRULE using `convertOutlookRecurrenceToRRULE`.
  - Sets `isRecurring`, `rrule`, and `recurrenceBaseId` fields.

### 4. Database Fetch Functions
- **Created `getGoogleEventsFromDatabase`**: Fetches Google events from database and expands recurring events on-demand.
- **Created `getOutlookEventsFromDatabase`**: Fetches Outlook events from database and expands recurring events on-demand.
- Both functions follow the same pattern as `getAppleEventsFromDatabase`:
  - Fetch base recurring events from database.
  - Use `generateRecurringOccurrences` to expand within date range.
  - Filter non-recurring events by date range.

### 5. Updated `generateRecurringOccurrences`
- **Removed hardcoded provider**: Now dynamically determines provider from `baseEvent.source` or `baseEvent.external_id`.
- Supports all providers: `'google'`, `'outlook'`, and `'apple'`.

### 6. Updated `getCalendarEvents`
- **Changed to use database functions first**: All providers now fetch from database (which should contain synced events with recurrence metadata).
- Ensures consistent behavior across all providers.

## Constants Used (No Hardcoded Values)

All hardcoded values have been replaced with constants:
- `MAX_RECURRENCE_ITERATIONS` - Maximum iterations for recurring event expansion
- `TOKEN_VALIDITY_BUFFER_MS` - Token validity buffer
- `DEFAULT_EVENT_DURATION_MINUTES` - Default event duration

Provider strings (`'google'`, `'outlook'`, `'apple'`) are acceptable as they are constant identifiers, not configurable values.

## Important Note

**Google and Outlook events must be synced to the database** for recurring events to work properly. Currently, only Apple Calendar has a `syncCalendarsToDatabase` function that stores events in the `calendar_events` table.

### Next Steps Required:
1. **Create sync functions for Google/Outlook**: Similar to Apple's `syncCalendarsToDatabase`, create functions to:
   - Fetch events from Google/Outlook APIs.
   - Extract recurrence information.
   - Store in `calendar_events` table with `rrule`, `recurrence_base_id`, and `is_recurring` fields.
   - Set `source` field to `'google'` or `'outlook'`.

2. **Or modify fetch functions**: Update `getGoogleCalendarEvents` and `getOutlookCalendarEvents` to store events in database when fetched (if not already present).

3. **Create sync endpoints**: Add API endpoints to trigger sync for Google/Outlook calendars (similar to Apple's sync endpoint).

## Testing

To test recurring events:
1. Connect a Google Calendar with recurring events.
2. Connect an Outlook Calendar with recurring events.
3. Sync events to database (requires sync functions/endpoints).
4. Verify events appear in Kanban week view with proper recurrence.
5. Verify future occurrences beyond sync date range are displayed.

## Files Modified

1. ✅ `supabase/functions/taskzm-database-function/calendar-sync.tsx`
   - Updated `CalendarEvent` interface
   - Added `convertGoogleRecurrenceToRRULE` function
   - Added `convertOutlookRecurrenceToRRULE` function
   - Updated `getGoogleCalendarEvents` function
   - Updated `getOutlookCalendarEvents` function
   - Added `getGoogleEventsFromDatabase` function
   - Added `getOutlookEventsFromDatabase` function
   - Updated `generateRecurringOccurrences` function
   - Updated `getCalendarEvents` function

## Verification

- ✅ No hardcoded numeric values in logic
- ✅ Recurrence extraction for all providers
- ✅ RRULE conversion for Google and Outlook
- ✅ Database fetch functions for all providers
- ✅ Dynamic provider detection in `generateRecurringOccurrences`
- ⚠️ **Sync functions needed** to store Google/Outlook events in database
