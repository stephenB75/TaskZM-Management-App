# TaskZM App State - Version 1.0.28

**Date**: June 26, 2026  
**Version**: 1.0.28 - Today Agenda Timeline Content & Duration

## Current State Summary

### Major Features & Improvements

#### Today Agenda timeline — alignment, content visibility, and duration

- **Grid-accurate timing**: Task and event blocks use scheduled start/end on the time rail. Calendar events use parsed `end` time for slot height and end labels (not start + rounded duration only).
- **Readable cards**: Adaptive density tiers (`micro` / `compact` / `full`) with minimum row heights (48px / 92px / 110–120px) so titles and footers are not collapsed into slivers. Cards use `fitTimelineSlot` with scroll and line-clamp; tooltips show full title, duration, and location when truncated.
- **No visual overlap**: Overlapping scheduled items stack vertically at full width. Extended micro rows push the next item down via `resolveTodayAgendaVisualBlockTops`. Scheduling still uses `findNextAvailableSlot` with calendar events on manual save, drag-drop, and AI scheduler.
- **Build marker**: `data-agenda-timeline="v25"` on the timeline container for verifying fresh bundles in DevTools.

#### Task duration consistency

- **`getTaskMinutes`**: User-set `task.estimatedTime` now takes priority over cached AI Analysis minutes.
- **`getTaskSchedulingMinutes`**: Single helper applies the 15-minute scheduling floor (`MIN_TASK_DURATION_MINUTES`) for timeline blocks and `time-conflict.ts` conflict detection.
- **Today Agenda** uses `getTaskSchedulingMinutes(task, { useCachedAIAnalysis: true })` so displayed block length matches reserved slot length.

### Code Quality – No hardcode

- Timeline layout thresholds live in `TODAY_AGENDA_TIMELINE` (`layout-constants.ts`): `timelineMicroMaxSlotHeightPx`, `timelineMinVisibleRowHeightPx`, `shortItemCompactRowHeightPx`, `timelineTaskCardMinHeightPx`, `timelineEventCardMinHeightPx`.
- Duration floor and rounding from `ai-config.ts` (`MIN_TASK_DURATION_MINUTES`); no magic numbers in view or conflict logic.

### Files Modified (1.0.27 → 1.0.28)

#### Frontend – Today Agenda

- `src/components/TodayAgendaView.tsx`: Duration blocks, stacked display blocks, adaptive card presentation, tooltips via child cards.
- `src/lib/today-agenda-layout.ts`: Layout tiers, row height helpers, visual restacking, event/task time-range helpers.
- `src/components/DraggableTaskCard.tsx`: Timeline slot-fit cards with tooltips.
- `src/components/CalendarEventCard.tsx`: Timeline variant with tiers and tooltips.
- `src/components/AgendaListCard.tsx`: `fitTimelineSlot`, `hideFooter`, embedded timeline overflow/line-clamp.

#### Frontend – Duration & conflicts

- `src/lib/daily-hours-utils.ts`: `getTaskMinutes` priority fix; new `getTaskSchedulingMinutes`.
- `src/lib/time-conflict.ts`: Uses `getTaskSchedulingMinutes` for overlap blocks.

#### Constants

- `src/lib/layout-constants.ts`: Timeline visibility and tier constants.

#### Version & cache

- `package.json`, `src/package.json`: 1.0.28
- `src/lib/version.ts`: APP_VERSION, VERSION_NAME, VERSION_DATE, BUILD_NUMBER, VERSION_HISTORY
- `src/public/service-worker.js`: Cache names `taskzm-v1.0.28`, `taskzm-runtime-v1.0.28`

#### Docs

- `docs/archive/APP_STATE_1.0.28.md`: This file.

### Verification Status

#### Functionality

- Timeline start/end labels align with scheduled duration on the grid.
- Short tasks/events show readable content (compact/micro tiers); longer items show full card with footer.
- Newly scheduled tasks avoid overlapping calendar events and other tasks via existing conflict paths.
- User-edited `estimatedTime` drives timeline block length after save.

#### Code Quality

- Build passes (`npm run build`).
- Version bump triggers cache purge via existing `purgeAppCachesIfVersionChanged(APP_VERSION)` on load.

### Build & Deployment

- **Version**: 1.0.28
- **Build Number**: 20260626-1
- **Status**: Ready for deployment
- **Breaking Changes**: None
- **Migration Required**: None
