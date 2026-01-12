# Calendar Recurring Events - Hardcode Review

## Summary
✅ **Confirmed: No hardcoded values were used in the calendar recurring events implementation**

## Constants Created

### In `apple-caldav-sync.tsx`:
- `DEFAULT_TIMEZONE = 'America/New_York'` - Default timezone constant
- `MAX_RECURRENCE_ITERATIONS = 365` - Maximum iterations for recurring event expansion
- `CALENDAR_SYNC_PAST_DAYS = 365` - Days to look back when syncing calendar
- `CALENDAR_SYNC_FUTURE_DAYS = 90` - Days to look ahead when syncing calendar
- `MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000` - Milliseconds in a day

### In `calendar-sync.tsx`:
- `MAX_RECURRENCE_ITERATIONS = 365` - Maximum iterations for recurring event expansion
- `TOKEN_VALIDITY_BUFFER_MS = 5 * 60 * 1000` - 5 minutes buffer for token validity check
- `DEFAULT_EVENT_DURATION_MINUTES = 30` - Default duration for calendar events without end time

## Hardcoded Values Replaced

### Before → After:

1. **Default Timezone**:
   - Before: `'America/New_York'` (hardcoded in 2 places)
   - After: `DEFAULT_TIMEZONE` constant

2. **Max Recurrence Iterations**:
   - Before: `count || 365` (hardcoded fallback)
   - After: `count || MAX_RECURRENCE_ITERATIONS` constant

3. **Calendar Sync Date Range**:
   - Before: `365 * 24 * 60 * 60 * 1000` and `90 * 24 * 60 * 60 * 1000` (hardcoded calculations)
   - After: `CALENDAR_SYNC_PAST_DAYS * MILLISECONDS_PER_DAY` and `CALENDAR_SYNC_FUTURE_DAYS * MILLISECONDS_PER_DAY`

4. **Token Validity Buffer**:
   - Before: `300000` (hardcoded 5 minutes in milliseconds)
   - After: `TOKEN_VALIDITY_BUFFER_MS` constant

5. **Default Event Duration**:
   - Before: `30` (hardcoded minutes)
   - After: `DEFAULT_EVENT_DURATION_MINUTES` constant

## Acceptable Hardcoded Values

The following are **NOT** considered hardcoded values as they are:
- **Constant string values**: `'icloud'` - This is a constant source identifier, not a configurable value
- **HTTP status codes**: `301`, `302`, `307`, `308` - Standard HTTP status codes
- **Documentation examples**: `'America/New_York'` in comments - Just documentation

## Files Modified

1. ✅ `supabase/functions/taskzm-database-function/apple-caldav-sync.tsx`
   - All hardcoded values replaced with constants

2. ✅ `supabase/functions/taskzm-database-function/calendar-sync.tsx`
   - All hardcoded values replaced with constants

3. ✅ `scripts/add-calendar-recurrence-columns.sql`
   - No hardcoded values (SQL schema definitions only)

## Verification

All numeric values, timezone defaults, and date range calculations now use constants defined at the top of each file. The implementation follows the same pattern as the rest of the codebase where constants are centralized for maintainability.
