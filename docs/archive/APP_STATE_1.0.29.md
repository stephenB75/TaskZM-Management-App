# TaskZM App State - Version 1.0.29

**Date**: June 7, 2026  
**Version**: 1.0.29 - Timeline UX & AI Prep Buffer

## Current State Summary

### Major Features & Improvements

#### Today Agenda timeline — full content & stamp alignment

- **Content-aware row heights**: `estimateTodayAgendaTimelineContentHeightPx()` sizes rows from title, subtitle, and footer so cards are not clipped; footers always show for non-micro tiers.
- **No truncation on full cards**: Embedded timeline cards use natural text wrap (no line-clamp) for compact/full tiers; row `minHeight` instead of fixed `height: 100%` chains.
- **30-minute grid**: Grid lines extend through visually stacked content; interval labels suppress when a tick falls inside a block’s visual row (scheduled or extended).
- **Rail labels**: Start/end stamps stay grid-accurate when unstacked; move with stacked card rows; no background tint on labels.
- **Interaction**: Hover tooltips and scale rollovers removed from timeline task and event cards (click-to-open unchanged).
- **Build marker**: `data-agenda-timeline="v26"` on the timeline container.

#### Desktop sidebar panel animation

- Persistent panel shell with content crossfade on panel switch (no remount flicker).
- `translateX` slide in/out from sidebar; fast 220ms retract (`DESKTOP_SIDE_PANEL_EXIT_SECONDS`).
- Sidebar icon column stays above panel during close so icons remain tappable.

#### Mobile navigation & Week view

- App tour: `disableOverlay` on mobile; nav tap dismisses tour so Week/Today/Inbox stay tappable.
- `TodayAgendaView` in sidebar only when not mobile layout (avoids hidden compact-list tier TypeError).
- Week press sets dashboard + week view together; `cardPresentation` fallback in timeline render.

#### AI scheduler prep buffer

- **15-minute windows** between consecutive AI-scheduled tasks and before/after calendar events.
- Constants: `AI_SCHEDULING_PREP_BUFFER_MINUTES` (15), `AI_SCHEDULING_PREP_BUFFER_MIN_MINUTES` (10) in `ai-config.ts`.
- Implemented via `buildAISchedulerSlotOptions()` → `findNextAvailableSlot()` with expanded task/calendar conflict blocks.
- Manual scheduling (TaskDialog, drag-drop) does **not** apply prep buffer.

### Code Quality – No hardcode

- Timeline content estimation constants in `TODAY_AGENDA_TIMELINE` (`layout-constants.ts`).
- Panel animation from `DESKTOP_SIDE_PANEL_SPRING_ENTER`, `DESKTOP_SIDE_PANEL_EXIT_*`, `SIDEBAR_Z_INDEX`.
- AI prep buffer from `ai-config.ts`; no magic numbers in scheduler or conflict logic.

### Files Modified (1.0.28 → 1.0.29)

#### Frontend – Today Agenda

- `src/components/TodayAgendaView.tsx`: Content-aware display blocks, visual interval/grid helpers, no card rollovers, v26 marker.
- `src/lib/today-agenda-layout.ts`: Content height estimation, visual minute occupation, grid label end helper.
- `src/components/AgendaListCard.tsx`: Full embedded timeline content, overflow-visible.
- `src/components/DraggableTaskCard.tsx`: Timeline cards without tooltips; flexible minHeight.
- `src/components/CalendarEventCard.tsx`: Timeline variant without tooltips.

#### Frontend – Navigation & shell

- `src/AppContent.tsx`: Persistent desktop side panel shell, synced header motion.
- `src/components/AppHeader.tsx`: Panel width animation aligned with shell.
- `src/components/AppSidebar.tsx`: Z-index above panel during retract.
- `src/components/BottomNav.tsx`, `src/components/AppTour.tsx`: Mobile nav / tour fixes.
- `src/components/DashboardView.tsx`: Mobile week index, conditional sidebar agenda mount.

#### AI scheduling

- `src/lib/time-conflict.ts`: `schedulingPrepBufferMinutes`, `buildAISchedulerSlotOptions`, block expansion helpers.
- `src/hooks/useAIScheduler.ts`: All AI slot calls use prep buffer; gap and direct conflict checks updated.
- `src/lib/ai-config.ts`: Prep buffer constants.

#### Constants & layout

- `src/lib/layout-constants.ts`: Timeline content estimation px; desktop panel exit timing.

#### Version & cache

- `package.json`, `src/package.json`: 1.0.29
- `src/lib/version.ts`: APP_VERSION, VERSION_NAME, VERSION_DATE, BUILD_NUMBER, VERSION_HISTORY
- `src/public/service-worker.js`: Cache names `taskzm-v1.0.29`, `taskzm-runtime-v1.0.29`

#### Docs

- `docs/archive/APP_STATE_1.0.29.md`: This file.

### Verification Status

#### Functionality

- Timeline cards show full title, description, and footer when content exceeds slot height; adjacent blocks stack with gap.
- 30-min ticks appear in open gaps; per-item start/end labels align with scheduled times.
- AI scheduler leaves ≥15 min between tasks and around calendar events; manual scheduling unchanged.
- Desktop sidebar opens/closes smoothly; mobile Week icon responsive with tour dismissed.

#### Code Quality

- Build passes (`npm run build`).
- Version bump triggers cache purge via `purgeAppCachesIfVersionChanged(APP_VERSION)` on load.

### Build & Deployment

- **Version**: 1.0.29
- **Build Number**: 20260607-1
- **Status**: Ready for deployment
- **Breaking Changes**: None
- **Migration Required**: None
