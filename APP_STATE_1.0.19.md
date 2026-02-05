# TaskZM App State - Version 1.0.19

**Date**: February 2, 2026  
**Version**: 1.0.19 - Today Agenda Timeline & Timezone

## Current State Summary

### Major Features & Improvements

#### Today Agenda – Timeline Alignment (Row-per-Item)
- **Layout**: Each agenda item is a single row `[time | card]` so the timeline always aligns with the correct task. No estimated heights or cumulative marginTop.
- **Implementation**: `agendaListRows` (useMemo) renders one flex row per item; timeline cell uses `TODAY_AGENDA_TIMELINE.rowPaddingTopPx` + `nextUpBadgeOffsetPx` when next-up so the time label aligns with the card below the badge.
- **Result**: Time labels stay with their task cards regardless of card height (e.g. expanded AI suggestions). All four layout variants (mobile/desktop) use `{agendaListRows}`; `agendaTimePositions` removed.

#### Today Agenda – Time Slot for Tasks Without Time
- **Display**: Tasks without `scheduledDate` show `TODAY_AGENDA_TEXT.noTimeSlot` ("—") on the vertical timeline so every task has a visible slot.
- **Constant**: `today-agenda-constants.ts`: `noTimeSlot: "—"`; `getTaskTime` returns it when task has no or invalid scheduled date.

#### Timezone & Chronological Order
- **Today Agenda**: Today and filtering use local timezone via `getDateString` / `isDateInRecurrence`. Tasks and combined items sorted chronologically (earliest first); items without time go to end.
- **Kanban week**: Column dates and task–day matching use local date. `getTasksForDay` now uses `dateStringToLocalDate(dateString)` from `utils.ts` so YYYY-MM-DD is parsed as local midnight (not UTC), consistent across browsers.
- **Utils**: New `dateStringToLocalDate(dateString)` parses YYYY-MM-DD as local; used in SevenDayKanban and available for other views.

#### TaskDialog ReferenceError Fix
- **Issue**: `setDescriptionSource(null)` was called in the new-task reset path but `setDescriptionSource` was never defined.
- **Fix**: Removed the stray call; no `descriptionSource` state exists in TaskDialog.

#### Build & Constants
- **Vite**: Removed `optimizeDeps.force: true`; added `build.target: 'es2020'` and `build.reportCompressedSize: false` for faster builds. Prebuild script fixed so it does not fail when service worker cache version is already correct.
- **Gradients**: `LOADING_SCREEN_GRADIENT_CLASS` and `MAIN_BG_GRADIENT_CLASS` in `layout-constants.ts`; used in App, AppContent, AuthenticatedApp, MonthCalendarView, InviteAcceptancePage (no inline gradient hex in those components).
- **Apple CalDAV**: `FALLBACK_UTC_OFFSET_HOURS = 5` named constant in `apple-caldav-sync.tsx` (replaced literal 5).

### Code Quality

- No hardcode in recent changes: layout, spacing, colors, and copy come from `layout-constants`, `today-agenda-constants`, `task-card-constants`, or named constants in the same file.
- Animation keyframe literals (e.g. scale, rotate, opacity) remain as standard motion values.

### Files Modified (1.0.18 → 1.0.19)

#### Frontend
- `src/components/TodayAgendaView.tsx`: Row-per-item layout (`agendaListRows`), `getTaskTime` returns `TODAY_AGENDA_TEXT.noTimeSlot` when no time, chronological/local comments; `agendaTimePositions` removed.
- `src/components/SevenDayKanban.tsx`: Import and use `dateStringToLocalDate` in `getTasksForDay`; chronological comment.
- `src/components/TaskDialog.tsx`: Removed `setDescriptionSource(null)`.
- `src/App.tsx`, `src/AppContent.tsx`, `src/AuthenticatedApp.tsx`: Use `LOADING_SCREEN_GRADIENT_CLASS`.
- `src/components/MonthCalendarView.tsx`, `src/components/InviteAcceptancePage.tsx`: Use `MAIN_BG_GRADIENT_CLASS`.
- `src/lib/layout-constants.ts`: `LOADING_SCREEN_GRADIENT_CLASS`, `MAIN_BG_GRADIENT_CLASS`, `TODAY_AGENDA_TIMELINE.cardContentTopOffsetPx` (documented; not used in row margin after row-per-item change).
- `src/lib/today-agenda-constants.ts`: `noTimeSlot: "—"`.
- `src/lib/utils.ts`: `dateStringToLocalDate(dateString)`.
- `src/vite.config.ts`: Removed `optimizeDeps.force`; added `build.target`, `build.reportCompressedSize: false`.
- `scripts/update-service-worker-cache.js`: Fail only when CACHE_NAME pattern missing (not when version unchanged).

#### Supabase Edge Function
- `supabase/functions/taskzm-database-function/apple-caldav-sync.tsx`: `FALLBACK_UTC_OFFSET_HOURS` constant; use it instead of literal 5.

#### Docs & Version
- `APP_STATE_1.0.19.md`: This file.
- `package.json`: version 1.0.18 → 1.0.19.
- `src/lib/version.ts`: APP_VERSION, VERSION_NAME, VERSION_DATE, BUILD_NUMBER, VERSION_HISTORY entry for 1.0.19.

### Verification Status

#### Functionality
- Today Agenda timeline aligns with correct task cards (one row per item).
- Tasks without time show "—" on the timeline.
- Today Agenda and Kanban use local timezone and chronological order.
- TaskDialog opens for new task without ReferenceError.
- Build and prebuild complete; service worker cache script succeeds when version unchanged.

#### Code Quality
- Version and build number updated in package.json and src/lib/version.ts.
- App state recorded in APP_STATE_1.0.19.md.
- No hardcode introduced in layout/theme/copy.

### Build & Deployment

- **Version**: 1.0.19
- **Build Number**: 20260202-1
- **Status**: Ready for deployment
- **Breaking Changes**: None
- **Migration Required**: None
