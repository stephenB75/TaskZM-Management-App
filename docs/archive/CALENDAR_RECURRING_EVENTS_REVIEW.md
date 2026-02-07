# Calendar Recurring Events Review

## Current Status

### ✅ What's Working
1. **Recurring events ARE being imported**: The `expandRecurringEvent` function in `apple-caldav-sync.tsx` correctly parses RRULE and expands recurring events into individual instances within the sync date range.

2. **Events ARE being stored**: Each expanded instance is stored as a separate row in the `calendar_events` table.

3. **Events ARE being displayed on Kanban week view**: Calendar events are fetched via `useCalendarEventsByDate` hook and displayed using `CalendarEventCard` component in `SevenDayKanban.tsx`.

### ❌ Issues Found

1. **RRULE is NOT preserved**: The `calendar_events` table doesn't have a column to store the original RRULE pattern. When recurring events are expanded, the recurrence pattern is lost.

2. **No recurrence metadata**: The database schema (`create-calendar-events-table.sql`) doesn't include:
   - `rrule` column to store the original RRULE string
   - `recurrence_base_id` to link expanded instances to the base recurring event
   - `is_recurring` flag to identify recurring events

3. **Limited date range**: Recurring events are only expanded within the sync date range (typically 30 days). Future occurrences beyond this range won't appear until the next sync.

4. **No task conversion**: Recurring calendar events are NOT converted to tasks with recurrence properties. They remain as read-only calendar events.

## Code Locations

### Import/Sync Logic
- **File**: `supabase/functions/taskzm-database-function/apple-caldav-sync.tsx`
- **Function**: `expandRecurringEvent()` (lines 700-822)
  - Parses RRULE (FREQ, INTERVAL, COUNT, UNTIL, BYDAY, BYMONTHDAY)
  - Expands recurring events into individual instances
  - Creates unique UIDs for each instance: `${baseEvent.uid}_${timestamp}`

- **Function**: `syncCalendarsToDatabase()` (lines 1068-1230)
  - Stores expanded events in `calendar_events` table
  - Does NOT store RRULE or recurrence metadata

### Database Schema
- **File**: `scripts/create-calendar-events-table.sql`
- **Missing columns**:
  - `rrule TEXT` - Original RRULE string
  - `recurrence_base_id TEXT` - Links instances to base event
  - `is_recurring BOOLEAN` - Flag for recurring events

### Display Logic
- **File**: `src/components/SevenDayKanban.tsx`
- **Lines 1277-1328**: Calendar events are fetched and displayed alongside tasks
- Uses `useCalendarEventsByDate` hook to get events grouped by date
- Events are sorted chronologically with tasks

## Recommendations

### Option 1: Store RRULE and Preserve Recurrence Pattern (Recommended)
1. **Add columns to `calendar_events` table**:
   ```sql
   ALTER TABLE calendar_events 
   ADD COLUMN rrule TEXT,
   ADD COLUMN recurrence_base_id TEXT,
   ADD COLUMN is_recurring BOOLEAN DEFAULT false;
   ```

2. **Modify sync logic** to:
   - Store RRULE for the base event
   - Store `recurrence_base_id` for all instances
   - Set `is_recurring = true` for recurring events

3. **Create function to generate future occurrences** on-demand when viewing kanban week view

### Option 2: Convert Recurring Calendar Events to Tasks
1. **During sync**, detect recurring events (RRULE present)
2. **Create a single task** with recurrence properties instead of expanding
3. **Use existing recurrence system** (`isDateInRecurrence` function) to display on kanban view

### Option 3: Hybrid Approach
1. **Store RRULE** in database for base recurring events
2. **Display as calendar events** (read-only) on kanban view
3. **Allow user to convert** recurring calendar events to tasks if they want to manage them

## Next Steps

1. ✅ Review completed - identified that recurring events are imported and displayed
2. ⚠️ Issue: RRULE not preserved, limiting future occurrence generation
3. 🔄 Recommendation: Add RRULE storage to preserve recurrence patterns
4. 🔄 Consider: Converting recurring calendar events to tasks with recurrence for better integration
