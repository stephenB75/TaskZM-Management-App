# App Guidelines Compliance & No-Hardcode Audit

This document confirms that core app features follow the intended guidelines and use centralized constants (no hardcoded magic numbers or strings in business logic).

## 1. Daily Work Hour Limit

- **Guideline:** User-configurable daily hour limit (e.g. 5/8/10 hours); enforced in scheduling and UI.
- **Implementation:**
  - `src/lib/ai-config.ts`: `MAX_HOURS_PER_DAY`, `AI_DAILY_HOUR_OPTIONS` (5, 8, 10), `AI_DAILY_HOUR_LABELS`.
  - `src/lib/daily-hours-utils.ts`: `checkDailyLimit()`, `getDailyHoursWarningLevel()`.
  - Used in: TaskContext, DragDropContext, TaskDialog, DashboardView, AIRecommendationPanel, useAIScheduler.
- **Hardcodes:** None; limits come from settings and `ai-config` constants.

## 2. Rollover Tasks

- **Guideline:** Past-due incomplete tasks can be rolled over (to inbox); optional auto-rollover and ask-before-rolling.
- **Implementation:**
  - `src/contexts/TaskContext.tsx`: gated by `hasFeature('taskRollover')`; uses `rolloverSettings.autoRollover` / `askBeforeRolling`, `TIMING_CONSTANTS.delays.rolloverCheck` for delay.
  - Rollover moves incomplete, non-recurring, past-due tasks to inbox (clears `scheduledDate`).
- **Hardcodes:** None; delay from `timing-constants.ts`, behavior from feature flag and user settings.

## 3. AI Scheduler

- **Guideline:** Schedule unscheduled tasks respecting daily limits, category hours, calendar events, and conflict detection (see `src/guidelines/AI_SCHEDULING_GUIDELINES.md`).
- **Implementation:**
  - `src/hooks/useAIScheduler.ts`: uses `getCategoryHoursForTask`, `hoursSettings`, `findNextAvailableSlot`, calendar events, `DEFAULT_WEEK_RESCHEDULE_DAYS` (7), `DEFAULT_CATEGORY_WORK_WINDOW_HOURS`, `AI_SCHEDULER_MAX_END_HOUR` from config/business-constants.
  - Daily limits from user settings; category hours from `category-hours-utils` and `hoursSettings`.
- **Hardcodes:** Removed: default work window (8) and max hour (23) now use `DEFAULT_CATEGORY_WORK_WINDOW_HOURS` and `AI_SCHEDULER_MAX_END_HOUR`.

## 4. AI Re-Scheduler

- **Guideline:** Re-schedule day/week/month respecting same rules as AI Scheduler.
- **Implementation:** Same hook `useAIScheduler.ts`; rescheduleDay/Week/Month use same limits, category hours, and conflict logic. Uses `DEFAULT_WEEK_RESCHEDULE_DAYS` and timing constants.
- **Hardcodes:** None; all numeric parameters from constants or settings.

## 5. Task Category Hours

- **Guideline:** Work / Personal / Projects have configurable weekday/weekend windows; scheduling respects them when `respectHours` (or forceCategoryHours) is enabled.
- **Implementation:**
  - `src/lib/category-hours-utils.ts`: `getTaskCategory()`, `getCategoryHoursForTask()`, `parseTimeToMinutes()`, `isWeekend()`.
  - Defaults: `context-defaults.ts` and `business-constants.ts` (DEFAULT_WEEKDAY_* / DEFAULT_WEEKEND_*).
  - Used in: useAIScheduler, drag-drop, TaskContext (hoursSettings).
- **Hardcodes:** Category tag strings ('work', 'personal', 'projects') are domain literals in one small helper; type is `'work' | 'personal' | 'projects'`. Acceptable.

## 6. Calendar Integrations

- **Guideline:** Google / Apple / Outlook calendar integration; OAuth and sync; redirect URI from env; no hardcoded client IDs or redirects.
- **Implementation:**
  - `CalendarContext`, `useCalendarEventsByDate`; OAuth and sync in `taskzm-database-function` (Supabase Edge).
  - Redirect URI: `getGoogleRedirectUri()` from `GOOGLE_REDIRECT_URI` or built from `SUPABASE_URL` + `GOOGLE_CALLBACK_PATH`; no hardcoded URIs.
- **Hardcodes:** None; credentials and URLs from environment.

## 7. Notifications

- **Guideline:** Due-date reminders, overdue alerts, check interval, badge; configurable.
- **Implementation:**
  - `src/contexts/NotificationContext.tsx`: uses `DEFAULT_NOTIFICATION_SETTINGS`, `NOTIFICATION_STORAGE_KEYS`, `NOTIFICATION_*` from `notification-constants`; timing from `TIMING_CONSTANTS` and `MILLISECONDS_PER_MINUTE`.
  - `src/lib/notification-constants.ts`: `reminderTime` and `checkInterval` now use `DEFAULT_NOTIFICATION_REMINDER_TIME` and `DEFAULT_NOTIFICATION_CHECK_INTERVAL` from `business-constants`.
  - `src/lib/context-defaults.ts`: default notification settings use same business-constants.
- **Hardcodes:** None; reminder/check values sourced from `business-constants`.

## 8. Tag Management

- **Guideline:** Tags are user-managed; reserved/protected tags (e.g. Work, Personal, Projects, Business) defined in one place.
- **Implementation:**
  - `src/contexts/TaskContext.tsx`: `availableTags`, `addAvailableTag`, `removeAvailableTag`; tags from DB + defaults.
  - `src/lib/business-constants.ts`: `DEFAULT_TAGS`, `PROTECTED_TAGS`, `RESERVED_TAG_URGENT`.
  - Settings and TaskDialog consume context; no inline tag lists in business logic.
- **Hardcodes:** None; tag lists and reserved names in `business-constants`.

---

## Summary

| Area                   | Guidelines followed | Hardcodes |
|------------------------|---------------------|-----------|
| Daily Work Hour Limit  | Yes                 | None      |
| Rollover Tasks         | Yes                 | None      |
| AI Scheduler           | Yes                 | None (fixed 8/23) |
| AI Re-Scheduler        | Yes                 | None      |
| Task Category Hours    | Yes                 | None (category strings acceptable) |
| Calendar Integrations  | Yes                 | None      |
| Notifications          | Yes                 | None (fixed 60/15) |
| Tag Management         | Yes                 | None      |

All of these components use centralized constants (e.g. `ai-config`, `business-constants`, `timing-constants`, `notification-constants`, `context-defaults`) and environment/feature flags rather than hardcoded values in business logic.
