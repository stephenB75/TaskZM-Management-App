# Calendar Recurring Events Duplication Fix

## Problem
Recurring calendar events from Apple Calendar (iCloud) were appearing as duplicates in the UI. The same event occurrence was being displayed multiple times instead of following the recurrence pattern correctly.

## Root Cause
The issue was in `supabase/functions/taskzm-database-function/apple-caldav-sync.tsx`:

1. **Double Addition of Base Event**: When expanding recurring events, the `parseVEvent` function was:
   - Expanding the recurring event (which already includes the base event in the first iteration)
   - Then also adding the base event separately if it fell within the date range
   - This caused the base event to appear twice

2. **No Deduplication**: There was no deduplication logic to filter out duplicate events that might occur from:
   - Overlapping date ranges
   - Multiple calendar sources
   - Server-side expansion issues

## Solution

### 1. Removed Duplicate Base Event Addition
**File**: `supabase/functions/taskzm-database-function/apple-caldav-sync.tsx`

**Before**:
```typescript
if (rrule && rangeStart && rangeEnd && !recurrenceId) {
  const expandedEvents = expandRecurringEvent(baseEvent, rrule, rangeStart, rangeEnd);
  // Also include the base event if it falls within range
  const baseDate = new Date(parsedDtstart);
  if (baseDate >= rangeStart && baseDate <= rangeEnd) {
    return [baseEvent, ...expandedEvents.filter(e => e.uid !== baseEvent.uid)];
  }
  return expandedEvents;
}
```

**After**:
```typescript
if (rrule && rangeStart && rangeEnd && !recurrenceId) {
  const expandedEvents = expandRecurringEvent(baseEvent, rrule, rangeStart, rangeEnd);
  // expandRecurringEvent already includes the base event if it's in range,
  // so we don't need to add it separately. Just return the expanded events.
  // Deduplicate by start time and title to prevent duplicates
  const deduplicated = deduplicateEvents(expandedEvents);
  return deduplicated;
}
```

### 2. Added Deduplication Function
**File**: `supabase/functions/taskzm-database-function/apple-caldav-sync.tsx`

Added a new `deduplicateEvents` function that:
- Creates a unique key from start time, end time, and title
- Filters out duplicate events based on this key
- Preserves the first occurrence of each unique event

```typescript
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
```

### 3. Applied Deduplication at Multiple Levels

1. **At parseVEvent level**: Deduplicates expanded recurring events before returning
2. **At fetchCalendarEvents level**: Deduplicates all events from a calendar before returning
3. **At syncCalendarsToDatabase level**: Deduplicates events before syncing to database

## How Recurring Events Work Now

1. **RRULE Parsing**: The `expandRecurringEvent` function parses RRULE (recurrence rule) from iCalendar format
2. **Expansion**: It expands the recurring event into individual occurrences based on:
   - Frequency (DAILY, WEEKLY, MONTHLY, YEARLY)
   - Interval
   - BYDAY, BYMONTHDAY modifiers
   - UNTIL or COUNT limits
3. **Unique UIDs**: Each expanded occurrence gets a unique UID: `${baseEvent.uid}_${timestamp}`
4. **Deduplication**: Events with the same start time, end time, and title are deduplicated
5. **Display**: Only unique occurrences are displayed in the UI

## Testing

To verify the fix:
1. Create a recurring event in Apple Calendar (e.g., daily, weekly)
2. Sync the calendar in TaskZM
3. View the calendar in Today Agenda, Week View, or Month View
4. Verify that each occurrence appears only once
5. Verify that the recurrence pattern is followed correctly (e.g., daily events appear every day, weekly events appear on the correct day of week)

## Notes

- **Google Calendar**: Already uses `singleEvents: 'true'` parameter which automatically expands recurring events, so no changes needed
- **Outlook Calendar**: Uses Microsoft Graph API which also handles recurring events automatically
- **Apple Calendar (CalDAV)**: Requires manual expansion and deduplication, which is now implemented

## Files Modified

1. `supabase/functions/taskzm-database-function/apple-caldav-sync.tsx`:
   - Added `deduplicateEvents()` function
   - Modified `parseVEvent()` to remove duplicate base event addition
   - Added deduplication in `fetchCalendarEvents()`
   - Added deduplication in `syncCalendarsToDatabase()`

