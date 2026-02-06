# TaskZM App State - Version 1.0.20

**Date**: February 2, 2026  
**Version**: 1.0.20 - Calendar Event Time & Kanban Timezone

## Current State Summary

### Major Features & Improvements

#### Calendar Event Time Conversion
- **Issue**: Calendar event times were wrong on the Kanban week view (and elsewhere) when the API returned UTC without a trailing `Z`; JavaScript then parsed them as local time.
- **Fix**: New `parseCalendarEventTime(isoString)` in `src/lib/utils.ts`:
  - Date-only (`YYYY-MM-DD`): parsed as local midnight.
  - ISO with `Z` or timezone offset: parsed as-is (correct).
  - ISO datetime without `Z` or offset: treated as UTC (append `Z`) so display and sort use correct local time.
- **Usage**: Used in `CalendarEventCard` (formatTimeAMPM, getDurationMinutes, isAllDayEvent), `useCalendarEventsByDate` (grouping by day), and `SevenDayKanban` (event sort time for both mobile and desktop).

#### Kanban Week View – Event Times
- Calendar events now use `parseCalendarEventTime(event.start)` when building `eventStart` for sort order and when passed to `CalendarEventCard`, so times display in the user’s local timezone and order is correct.

#### All-Day Events
- **Apple CalDAV**: All-day events (iCal `DATE` format, e.g. `20231225`) are converted from “midnight on that date in user’s timezone” to UTC before storage/return, so the correct calendar day shows in all timezones.
- **Client**: `CalendarEventCard` shows “All day” when event is date-only or spans 24h from midnight (local); label comes from `CALENDAR_EVENT_UI_TEXT.allDay` in `calendar-event-constants.ts`.

#### Today Agenda Scale
- `TASK_CARD_TIMELINE.scale.todayAgenda` set to `0.82` in `task-card-constants.ts` (reasonable size, still visible); no hardcoded scale in components.

### Code Quality – No Hardcode

- **Scale**: Today Agenda card scale is `TASK_CARD_TIMELINE.scale.todayAgenda` (0.82) in `task-card-constants.ts`; components reference the constant.
- **Calendar copy**: “All day” is `CALENDAR_EVENT_UI_TEXT.allDay` in `calendar-event-constants.ts`; `CalendarEventCard` uses it.
- **Time parsing**: Single shared `parseCalendarEventTime()`; no ad-hoc date parsing or magic strings for timezone handling in calendar code.
- **Apple CalDAV**: All-day conversion uses existing `currentUserTimezone` and `DEFAULT_TIMEZONE`; no new magic numbers.

### Files Modified (1.0.19 → 1.0.20)

#### Frontend
- `src/lib/utils.ts`: Added `parseCalendarEventTime(isoString)`.
- `src/lib/calendar-event-constants.ts`: Added `CALENDAR_EVENT_UI_TEXT.allDay`.
- `src/components/CalendarEventCard.tsx`: Use `parseCalendarEventTime` for duration/time/all-day; use `CALENDAR_EVENT_UI_TEXT.allDay`.
- `src/hooks/useCalendarEvents.ts`: Import and use `parseCalendarEventTime` in `useCalendarEventsByDate` for grouping.
- `src/components/SevenDayKanban.tsx`: Import `parseCalendarEventTime`; use it for calendar event `eventStart` (mobile and desktop).
- `src/lib/task-card-constants.ts`: `TASK_CARD_TIMELINE.scale.todayAgenda` set to `0.82` (was 0.9).

#### Supabase Edge Function
- `supabase/functions/taskzm-database-function/apple-caldav-sync.tsx`: All-day DATE format (8-char) converted to UTC via user timezone (Intl loop); fallback to UTC midnight on parse failure.

#### Docs & Version
- `APP_STATE_1.0.20.md`: This file.
- `package.json`: version 1.0.19 → 1.0.20.
- `src/lib/version.ts`: APP_VERSION 1.0.20, VERSION_NAME, VERSION_DATE, BUILD_NUMBER 20260202-2, VERSION_HISTORY entry for 1.0.20.

### Verification Status

#### Functionality
- Calendar event times on Kanban week view display and sort in user’s local time.
- All-day events (Apple and date-only from APIs) show “All day” and land on the correct day.
- Today Agenda task cards use scale 0.82 from constant.

#### Code Quality
- No hardcode in recent changes: scale, calendar copy, and time parsing use constants/shared util.
- Version and build number updated in package.json and src/lib/version.ts.
- App state recorded in APP_STATE_1.0.20.md.

### Build & Deployment

- **Version**: 1.0.20
- **Build Number**: 20260202-2
- **Status**: Ready for deployment
- **Breaking Changes**: None
- **Migration Required**: None
