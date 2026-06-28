# TaskZM App State - Version 1.0.30

**Date**: June 28, 2026  
**Version**: 1.0.30 - App Tour & Demo Dialogs

## Current State Summary

### Major Features & Improvements

#### App tour — AI Scheduler & Re-Schedule demo dialogs

- Schedule Preview and Re-Schedule dialogs auto-open during tour steps 14 and 18; users advance with tour **Next** only.
- `TourDemoDialogNotice` banner; dialog content wrapped with `pointer-events-none` during tour.
- `confirmScheduling` / `handleReschedule` guarded when `tourDialogsLocked`; `modal={false}` keeps Joyride Next clickable.
- Demo plan populated from `APP_TOUR_DEMO_SCHEDULE_TASKS` without running AI.

#### App tour — Settings section tooltip visibility

- Settings tour targets moved to accordion **header** rows (`SettingsSection` AccordionTrigger) instead of full expanded cards.
- `scrollSettingsTourTargetIntoView()` centers targets in the settings scroll container with tooltip clearance.
- Settings steps use `placement: 'auto'` and increased `settingsViewportPadding` floater padding.
- `disableScrollParentFix: false` on settings steps so popper respects the settings panel scroll context.

#### App tour — General stability

- Controlled Joyride step index (immediate update on Next; no double-click).
- Settings fast-path between accordion sections after panel preload.
- Reduced navigation/highlight delays; `preparedStepIndexRef` skips duplicate prepareStep.
- Tour start from Settings closes panel and navigates to dashboard first.

#### Today Agenda — calendar event duration

- `getTodayAgendaEventTimeRangeMins` uses timestamp-based duration on timeline blocks.
- Event cards receive `timelineBlockHeightPx` and `timelineDurationMinutes` aligned with displayed times.

#### Scheduling

- Manual scheduling uses `buildManualSchedulingSlotOptions` → shared slot builder (AI prep buffer remains AI-only).

### Code Quality – No hardcode

- Tour timing from `TIMING_CONSTANTS.tour`; floater padding from `TOUR_CONSTANTS.floater`.
- Demo copy in `APP_TOUR_DEMO_UI` / `APP_TOUR_UI` (`app-tour-constants.ts`).
- AI prep buffer unchanged from `AI_SCHEDULING_PREP_BUFFER_MINUTES` in `ai-config.ts`.

### Files Modified (1.0.29 → 1.0.30)

#### App tour

- `src/components/AppTour.tsx`: Floater props, settings scroll, controlled step index, demo step prepare logic.
- `src/lib/app-tour-constants.ts`: Demo UI, settings scroll helper, step placement auto, tour copy.
- `src/components/TourDemoDialogNotice.tsx`: Demo dialog banner component.
- `src/components/DashboardView.tsx`: Tour dialog lock, demo schedule/reschedule handlers.
- `src/components/AIRecommendationPanel.tsx`: Mobile tour dialog lock and demo handlers.
- `src/components/settings/SettingsSection.tsx`: `data-tour` on accordion trigger.
- `src/components/SettingsPanel.tsx`: Tour expand uses settings scroll helper.
- `src/AppContent.tsx`: Tour start closes settings panel; bottom nav tour interaction fix.

#### Today Agenda & scheduling

- `src/lib/today-agenda-layout.ts`: Timestamp-based event duration on timeline.
- `src/components/TodayAgendaView.tsx`, `src/components/CalendarEventCard.tsx`: Timeline duration props.
- `src/lib/time-conflict.ts`: Manual scheduling slot options; prep buffer stability.
- `src/hooks/useAIScheduler.ts`: Async recurrence corrections fix.

#### Version & cache

- `package.json`, `src/package.json`: 1.0.30
- `src/lib/version.ts`: APP_VERSION, VERSION_NAME, VERSION_DATE, BUILD_NUMBER, VERSION_HISTORY
- `src/public/service-worker.js`: Cache names `taskzm-v1.0.30`, `taskzm-runtime-v1.0.30`

#### Docs

- `docs/archive/APP_STATE_1.0.30.md`: This file.

### Verification Status

#### Functionality

- App tour steps 13–18 show AI/Re-Schedule examples without requiring dialog confirmation.
- Settings tour steps (Calendar Integrations, etc.) show full tooltip with Next/Back on screen.
- Today Agenda timeline event block heights match displayed start/end times.
- Build passes (`npm run build`).

#### Code Quality

- Version bump triggers cache purge via `purgeAppCachesIfVersionChanged(APP_VERSION)` on load.

### Build & Deployment

- **Version**: 1.0.30
- **Build Number**: 20260628-1
- **Status**: Ready for deployment
- **Breaking Changes**: None
- **Migration Required**: None
