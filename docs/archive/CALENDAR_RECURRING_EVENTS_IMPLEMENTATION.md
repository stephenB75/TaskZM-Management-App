# Calendar Recurring Events Implementation

## Summary

Implemented RRULE preservation and proper recurring schedule support for calendar events imported from Apple iCloud Calendar.

## Changes Made

### 1. Database Schema Updates
**File**: `scripts/add-calendar-recurrence-columns.sql`
- Added `rrule TEXT` column to store original RRULE string
- Added `recurrence_base_id TEXT` column to link expanded instances to base events
- Added `is_recurring BOOLEAN` column to flag recurring events
- Added indexes for efficient querying

### 2. CalendarEvent Interface Updates
**File**: `supabase/functions/taskzm-database-function/apple-caldav-sync.tsx`
- Added `rrule?: string` to CalendarEvent interface
- Added `recurrenceBaseId?: string` to link instances
- Added `isRecurring?: boolean` flag

### 3. Sync Logic Updates
**File**: `supabase/functions/taskzm-database-function/apple-caldav-sync.tsx`

#### parseVEvent Function
- Now preserves RRULE in baseEvent when recurring
- Sets `recurrenceBaseId` for expanded instances
- Sets `isRecurring` flag appropriately

#### expandRecurringEvent Function
- Updated signature to accept `recurrenceBaseId` parameter
- Preserves RRULE in all expanded instances
- Links all instances to base event via `recurrenceBaseId`
- Sets `isRecurring: true` for all instances

#### syncCalendarsToDatabase Function
- Updated INSERT to store `rrule`, `recurrence_base_id`, and `is_recurring`
- Updated UPDATE to preserve recurrence metadata

### 4. Event Fetching Updates
**File**: `supabase/functions/taskzm-database-function/calendar-sync.tsx`

#### getAppleEventsFromDatabase Function
- Now fetches base recurring events (those with RRULE)
- Calls `generateRecurringOccurrences` to expand recurring events on-demand
- Generates occurrences within the requested date range
- Handles both recurring and non-recurring events properly

#### generateRecurringOccurrences Function (NEW)
- Parses RRULE (FREQ, INTERVAL, COUNT, UNTIL, BYDAY, BYMONTHDAY)
- Generates occurrences within the specified date range
- Supports DAILY, WEEKLY, MONTHLY, YEARLY frequencies
- Handles timezone properly (UTC vs local time)
- Limits iterations to prevent infinite loops

## How It Works

### During Sync
1. **Parse VEVENT**: RRULE is extracted from iCalendar data
2. **Create Base Event**: Base event is created with RRULE preserved
3. **Expand Instances**: Recurring events are expanded into instances within sync range
4. **Store Metadata**: All instances store:
   - `rrule`: Original RRULE string
   - `recurrence_base_id`: Links to base event
   - `is_recurring`: Flag set to true

### During Display (Kanban Week View)
1. **Fetch Events**: Base recurring events are fetched from database
2. **Generate Occurrences**: `generateRecurringOccurrences` expands events on-demand
3. **Filter by Date**: Only occurrences within the visible date range are included
4. **Display**: Events appear on kanban week view following their recurring schedule

## Benefits

1. **RRULE Preserved**: Original recurrence pattern is never lost
2. **Future Occurrences**: Events beyond sync range are generated on-demand
3. **Efficient Storage**: Only base events stored, instances generated when needed
4. **Proper Scheduling**: Recurring events follow their schedule correctly on kanban view
5. **No Duplicates**: Base events processed only once, instances linked properly

## Testing Checklist

- [ ] Run database migration: `scripts/add-calendar-recurrence-columns.sql`
- [ ] Sync calendar with recurring events
- [ ] Verify RRULE is stored in database
- [ ] Verify recurring events appear on kanban week view
- [ ] Verify future occurrences beyond sync range appear
- [ ] Verify recurring schedule is followed correctly
- [ ] Verify no duplicate events appear

## Next Steps

1. Run the database migration script
2. Test with a calendar containing recurring events
3. Verify events appear correctly on kanban week view
4. Monitor for any edge cases in RRULE parsing
