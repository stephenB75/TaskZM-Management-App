# TaskZM App State - Version 1.0.18

**Date**: February 1, 2026  
**Version**: 1.0.18 - Calendar Events & Apple Sync

## Current State Summary

### Major Features & Improvements

#### Imported Calendar Events on Kanban Week View
- **Display**: Imported calendar events (Apple iCloud, Google Calendar, Outlook) appear on the Kanban week view alongside tasks; grouped by local date and merged with tasks per column, sorted by time.
- **Data flow**: Events fetched via `useCalendarEventsByDate(startDate, endDate)`; API `GET /calendar/events/:provider`; backend returns events in range; frontend groups by `getDateString()` (YYYY-MM-DD) and column keys use same convention.
- **Recurring vs regular**: Backend includes regular events in range and expands recurring events (RRULE) into occurrences in range; frontend does not filter by type; both show as `CalendarEventCard` per day.
- **Documentation**: `CALENDAR_EVENTS_KANBAN_REVIEW.md` documents flow, fix applied (desktop `isRecurring`), and confirmation that all event types show.

#### Apple Calendar Sync Fixes (Events Not Syncing)
- **CalDAV response parsing**: iCloud (and other CalDAV servers) often return `<cal:calendar-data>` (or other namespace prefix). The regex only matched `<calendar-data>`, so no events were parsed. Updated to `<(?:[a-zA-Z0-9]+:)?calendar-data[^>]*>…<\/(?:[a-zA-Z0-9]+:)?calendar-data>` so namespaced elements are matched and events are extracted.
- **Recurrence persistence**: Insert and update in `syncCalendarsToDatabase` now set `rrule`, `recurrence_base_id`, and `is_recurring` so recurring events are stored with RRULE and expand correctly when read by `getAppleEventsFromDatabase`.
- **Diagnostic**: When response has body but no calendar-data blocks parsed, a warning is logged with a short sample to aid debugging.

#### Kanban Desktop – Recurring Event Indicator
- **CalendarEventCard**: Desktop column previously did not pass `isRecurring` to `CalendarEventCard`; mobile did. Desktop now passes `isRecurring={item.event.isRecurring}` so the repeat icon shows for recurring imported events on both mobile and desktop.

### Code Quality

- No new hardcodes; recurrence/ID conventions and colors remain in constants or type system.
- Apple sync: regex and DB fields in `apple-caldav-sync.tsx`; calendar-sync read path unchanged.

### Files Modified (1.0.17 → 1.0.18)

#### Supabase Edge Function
- `supabase/functions/taskzm-database-function/apple-caldav-sync.tsx`: CalDAV calendar-data regex (optional namespace prefix); insert/update include `rrule`, `recurrence_base_id`, `is_recurring`; warning when no blocks parsed.

#### Frontend
- `src/components/SevenDayKanban.tsx`: Desktop branch passes `isRecurring={item.event.isRecurring}` to `CalendarEventCard`.

#### Docs & Version
- `CALENDAR_EVENTS_KANBAN_REVIEW.md`: New; data flow, confirmation all events show, code refs.
- `APP_STATE_1.0.18.md`: This file.
- `package.json`: version 1.0.17 → 1.0.18.
- `src/lib/version.ts`: APP_VERSION, VERSION_NAME, VERSION_DATE, BUILD_NUMBER, VERSION_HISTORY entry for 1.0.18.

### Verification Status

#### Functionality
- ✅ Imported calendar events (regular and recurring) show on Kanban week view in correct day column.
- ✅ Apple Calendar sync extracts events from CalDAV response (namespaced calendar-data).
- ✅ Recurring Apple events persist with rrule and expand when fetching.
- ✅ Desktop Kanban shows recurring indicator on calendar event cards.

#### Code Quality
- ✅ Version and build number updated in package.json and src/lib/version.ts.
- ✅ App state recorded in APP_STATE_1.0.18.md.

### Build & Deployment

- **Version**: 1.0.18
- **Build Number**: 20260201-1
- **Status**: Ready for deployment
- **Breaking Changes**: None
- **Migration Required**: None
- **Note**: Redeploy Supabase edge function `taskzm-database-function` so Apple sync fixes are live.
