/**
 * TaskZM Version Control
 * 
 * Centralized version management for the application.
 * Update this file when releasing new versions.
 */

export const APP_VERSION = '1.0.29';
export const VERSION_NAME = 'Timeline UX & AI Prep Buffer';
export const VERSION_DATE = 'June 7, 2026';
export const BUILD_NUMBER = '20260607-1';

export const CORE_FUNCTIONS = [
  {
    id: 'tasks',
    name: 'Task & Project Management',
    description: 'Create, organize, schedule, and complete tasks across projects, folders, and views.',
    modules: [
      'TaskContext',
      'DashboardView',
      'DraggableTaskCard',
      'FolderView',
    ],
  },
  {
    id: 'calendar',
    name: 'Scheduling & Week View',
    description: 'Plan work with the 7-day Kanban, timeline agenda, and integrated calendar sync.',
    modules: [
      'SevenDayKanban',
      'DraggableTodayAgendaTask',
      'CalendarContext',
      'AnalyticsPanel',
    ],
  },
  {
    id: 'collaboration',
    name: 'Team Collaboration',
    description: 'Manage team members, invites, and shared workspaces with role-based access.',
    modules: [
      'TeamContext',
      'TeamPanel',
      'NotificationsPanel',
      'TaskContext',
    ],
  },
  {
    id: 'notifications',
    name: 'Notifications & Alerts',
    description: 'Stay informed with inbox triage, notification filters, and badge counts.',
    modules: [
      'NotificationContext',
      'InboxView',
      'NotificationsPanel',
      'AppHeader',
    ],
  },
  {
    id: 'productivity',
    name: 'Productivity & Focus Tools',
    description: 'Track focused work sessions, review analytics, and leverage AI assistance.',
    modules: [
      'PomodoroContext',
      'PomodoroTimer',
      'AnalyticsPanel',
      'AIContext',
    ],
  },
  {
    id: 'navigation',
    name: 'Adaptive UI & Navigation',
    description: 'Responsive layouts for desktop and mobile with synced headers and panels.',
    modules: [
      'BottomNav',
      'AppHeader',
      'AppSidebar',
      'App.tsx',
    ],
  },
] as const;

/**
 * Version history for reference
 */
export const VERSION_HISTORY = [
  {
    version: '1.0.29',
    date: 'June 7, 2026',
    name: 'Timeline UX & AI Prep Buffer',
    changes: [
      'Today Agenda: content-aware row heights so task/event titles, descriptions, and footers are fully visible (no line-clamp on full-tier timeline cards)',
      'Today Agenda: 30-min grid lines extend through visually stacked rows; interval labels hide when covered by extended card rows',
      'Today Agenda: removed hover tooltips and scale rollovers on timeline task and event cards',
      'Desktop sidebar: persistent panel shell with translateX slide; fast 220ms retract; sidebar icons stay clickable during close',
      'Mobile Week nav: tour overlay no longer blocks bottom nav; TodayAgendaView tier guard fixes TypeError on Week tap',
      'AI scheduler: 15-minute prep buffer between consecutive tasks and before/after calendar events (AI_SCHEDULING_PREP_BUFFER_MINUTES)',
      'Manual scheduling (TaskDialog, drag-drop) unchanged — prep buffer applies to AI scheduler only',
      'Build marker data-agenda-timeline=v26',
    ],
  },
  {
    version: '1.0.28',
    date: 'June 26, 2026',
    name: 'Today Agenda Timeline Content & Duration',
    changes: [
      'Today Agenda: grid-aligned start/end rail labels; task/event blocks sized to scheduled duration on the time scale',
      'Today Agenda: adaptive card tiers (micro / compact / full) with readable row heights so titles and footers are not clipped',
      'Today Agenda: tooltips on timeline task and event cards for full title, duration, and location when truncated',
      'Today Agenda: vertical stacking when times overlap or a short slot row extends past its grid end; build marker data-agenda-timeline=v25',
      'Task duration: user-set estimatedTime wins over cached AI in getTaskMinutes; getTaskSchedulingMinutes applies 15-min floor for timeline and conflict detection',
      'Calendar events on timeline use parsed end time for slot height and end labels (matches event end, e.g. 8:30–9:31)',
      'Scheduling unchanged: findNextAvailableSlot checks tasks and calendar events on manual save, drag-drop, and AI scheduler',
    ],
  },
  {
    version: '1.0.27',
    date: 'June 24, 2026',
    name: 'Today Agenda Cache & Card Fix',
    changes: [
      'Service worker + server: JS/CSS bundles fetched with cache no-store (fixes stale Today Agenda after deploy)',
      'App version bump auto-purges Cache Storage and unregisters old service workers',
      'Timeline cards: left accent only (removes double-border stacked look on events)',
      'Build marker data-agenda-timeline=v6 for verifying fresh bundle in DevTools',
    ],
  },
  {
    version: '1.0.26',
    date: 'June 24, 2026',
    name: 'Today Agenda Timeline Fixes',
    changes: [
      'Today Agenda sidebar: always use compact list layout (fixes label/card misalignment in narrow panel)',
      'Dedupe duplicate calendar events/blocks (fixes double cards, double dots, and overlapping time labels)',
      'Timeline rail: dots aligned to card top edge; hide duplicate time labels for same start time',
      'NEXT UP badge: show on first incomplete task when all scheduled times have passed',
      'Unscheduled events use timeline card surface; task list cards use single-layer timeline styling',
      'Service worker: version-scoped runtime cache purges stale JS chunks after deploy',
    ],
  },
  {
    version: '1.0.25',
    date: 'June 24, 2026',
    name: 'Today Agenda Timeline Polish',
    changes: [
      'Today Agenda: hybrid timeline (compact list when sparse, duration blocks when dense/overlapping)',
      'Today Agenda: single-layer timeline cards (no stacked shadow); shared AgendaListCard for tasks and events',
      'Today Agenda: NEXT UP badge on the next scheduled incomplete task',
      'Today Agenda: time labels and spine dots aligned to card tops; compact-list label overlap fix',
      'Kanban: wider week columns, increased card spacing, chronological task and event ordering',
      'PWA: service worker registers in production only; dev clears stale SW/runtime cache on load',
    ],
  },
  {
    version: '1.0.22',
    date: 'February 20, 2026',
    name: 'AI Description User Input Coordination',
    changes: [
      'Added buildTaskNameWithEnrichment helper that anchors descriptions on the user task name and enriches with domain library phrases and nouns',
      'preferUserInputFirst path now produces enriched descriptions instead of bare task name wrapping (e.g. "scheduling a doctor appointment, ensuring proper health management")',
      'Added PRIORITY 0.5 in buildElaborateContextualDescription so user input is always the foundation with domain terms as context',
      'Relaxed too-similar-to-task-name checks: descriptions containing task words plus 2+ enrichment words are no longer stripped and rebuilt',
      'Rebuild fallback now uses buildTaskNameWithEnrichment instead of domain-only sentence building',
      'Fixed AI description sentence structure: embedded required prepositions in descriptionTemplates (focuses on, deals with, relates to, etc.)',
      'Adjusted templateConnectors to secondary connectors to prevent redundant phrasing',
      'Removed ~15 ad-hoc connector insertion blocks in favor of centralized getConnectorForTemplate calls',
    ],
  },
  {
    version: '1.0.21',
    date: 'February 20, 2026',
    name: 'Task changes persist after refresh',
    changes: [
      'loadTasksFromServer: merge with localStorage by updatedAt so newer local edits are kept after refresh; include local-only tasks',
      'Persist current tasks to localStorage on pagehide/beforeunload so in-memory state survives refresh',
      'No new hardcode: reuses existing tasks key and createdBy === local pattern',
    ],
  },
  {
    version: '1.0.20',
    date: 'February 2, 2026',
    name: 'Calendar Event Time & Kanban Timezone',
    changes: [
      'Calendar event time conversion: parseCalendarEventTime() in utils.ts for correct local-time display and sorting (date-only local, ISO with Z/offset as-is, ISO without TZ treated as UTC)',
      'Kanban week view: calendar events use parseCalendarEventTime(event.start) for sort order and display so times show in user local time',
      'useCalendarEventsByDate: event grouping by day uses parseCalendarEventTime for correct local date when API returns UTC',
      'CalendarEventCard: getDurationMinutes, formatTimeAMPM, isAllDayEvent use parseCalendarEventTime; all-day label from CALENDAR_EVENT_UI_TEXT.allDay',
      'Apple CalDAV: all-day events (DATE format) converted from midnight in user timezone to UTC for correct day in all timezones',
      'Today Agenda scale: TASK_CARD_TIMELINE.scale.todayAgenda set to 0.82 (reasonable size, still visible)',
      'Confirmed no hardcode: scale in task-card-constants; calendar copy in CALENDAR_EVENT_UI_TEXT; time parsing via shared util',
    ],
  },
  {
    version: '1.0.19',
    date: 'February 2, 2026',
    name: 'Today Agenda Timeline & Timezone',
    changes: [
      'Today Agenda: One row per item [time | card] so timeline always aligns with correct task; removed estimated-height positioning',
      'Today Agenda: Tasks without scheduled time show time slot "—" (TODAY_AGENDA_TEXT.noTimeSlot) on vertical timeline',
      'Today Agenda: Chronological order and local timezone documented; agendaTimePositions removed in favor of row-per-item layout',
      'Kanban week: dateStringToLocalDate() used in getTasksForDay so column date is parsed as local (timezone-safe across browsers)',
      'TaskDialog: Removed invalid setDescriptionSource(null) call (fixes ReferenceError when opening new task)',
      'Build: Removed optimizeDeps.force, added reportCompressedSize: false and target es2020; prebuild script fixed when cache version unchanged',
      'Layout: LOADING_SCREEN_GRADIENT_CLASS and MAIN_BG_GRADIENT_CLASS in layout-constants; used in App, AppContent, AuthenticatedApp, MonthCalendarView, InviteAcceptancePage',
      'Apple CalDAV: FALLBACK_UTC_OFFSET_HOURS constant (replaced literal 5); utils.dateStringToLocalDate for YYYY-MM-DD as local',
      'Confirmed no hardcode in recent changes; all layout/copy from constants',
    ],
  },
  {
    version: '1.0.18',
    date: 'February 1, 2026',
    name: 'Calendar Events & Apple Sync',
    changes: [
      'Imported calendar events (Apple/Google/Outlook) display correctly on Kanban week view; regular and recurring events confirmed in range',
      'Apple Calendar sync fixed: CalDAV response parsing now matches namespaced calendar-data (e.g. cal:calendar-data) so events are extracted',
      'Apple sync now persists rrule, recurrence_base_id, and is_recurring so recurring events expand correctly when reading',
      'Desktop Kanban: CalendarEventCard receives isRecurring so recurring indicator (repeat icon) shows on desktop as on mobile',
      'CALENDAR_EVENTS_KANBAN_REVIEW.md added with data flow and confirmation that all event types show on week view',
    ],
  },
  {
    version: '1.0.17',
    date: 'January 23, 2026',
    name: 'Notifications, Badging & Settings Spacing',
    changes: [
      'Priority and Status badging use pill shape (rounded-full) in Task Dialog and on task cards instead of oval/rounded-xl/rounded-md',
      'In-app toast notifications appear above dialogs (z-index 9990) so messages are visible when dialogs are open',
      'Settings panel spacing increased: accordion sections, content padding, separators, form rows, profile section, panel gaps',
      'Fixed SETTINGS_PANEL_ROW_PADDING_Y ReferenceError by adding missing import in SettingsPanel.tsx',
      'Notifications section separator in Settings uses SETTINGS_PANEL_SEPARATOR_MARGIN_Y constant',
    ],
  },
  {
    version: '1.0.16',
    date: 'January 27, 2026',
    name: 'Multi-Team Support & Task Card Enhancements',
    changes: [
      'Implemented multi-team support - users can now create multiple teams with maximum 8 members per team',
      'Redesigned Team Panel with tabs to display multiple teams - Workspace Team tab always visible, additional teams shown as separate tabs',
      'Added team creation functionality - admin users can create new teams with name and optional description',
      'Enhanced team member management - admins can add members to specific teams or workspace team',
      'Updated team member invitation - supports both workspace-based and team-specific invitations',
      'Fixed team creation flow - teams now sync from server after creation to ensure complete metadata',
      'Added admin-only restrictions - only admins can create teams and add members (both single and bulk invite)',
      'Updated task card assignee display - all task cards now show member avatars instead of initials with proper fallback',
      'Enhanced assignee display across all components - TaskCard, InboxView, FolderView, DraggableTaskCard, DraggableTodayAgendaTask all use avatars',
      'Added avatar size constants - mobile (12px), desktop (16px), and large (20px) sizes for different card types',
      'Improved dark mode support - all assignee fallback displays now include dark mode gradient and text color variants',
      'Eliminated hardcoded values in task cards - replaced all hardcoded sizes, colors, and font sizes with constants',
      'Added new constants for assignee display - TASK_CARD_ASSIGNED_USER_COLORS with gradientDark and textDark variants',
      'Added assignedUserNameStandalone fontSize constant (0.75rem) for consistent name text sizing',
      'Fixed team panel header icons - Add Member and Bulk Invite buttons now restricted to admins only',
      'Updated team creation dialog - all user-facing strings now use TEAM_PANEL_UI_TEXT constants',
      'Added team creation error message constants - cannotCreateTeamNoAccess, onlyAdminsCanCreateTeams, failedToCreateTeam',
      'Enhanced team sync logic - teams sync from server after creation to ensure list is always up-to-date',
      'Improved team selection - newly created teams are automatically selected after creation',
      'Fixed team member count display - shows current/max members (e.g., "3/8") in team tabs',
      'All hardcoded values eliminated - team creation, task cards, and assignee displays use centralized constants',
    ],
  },
  {
    version: '1.0.15',
    date: 'January 26, 2026',
    name: 'UI Visibility & Icon Fixes',
    changes: [
      'Fixed user profile icon visibility in Settings Panel - replaced non-existent UserCircleCheck with UserCircle icon',
      'Fixed dark button icon visibility across the app - all buttons with dark backgrounds now use COLOR_TEXT_WHITE constant',
      'Fixed Sign Out button icon visibility - log-out icon now uses white color on red destructive background',
      'Fixed Delete Account button icon visibility - trash-2 icon now uses white color on red destructive background',
      'Fixed NotificationsPanel trash icon visibility - icon now uses COLOR_TEXT_WHITE on dark background',
      'Fixed SettingsPanel award icons visibility - all earned award icons now use COLOR_TEXT_WHITE on gradient backgrounds',
      'Fixed TaskDialog delete button icon visibility - trash icon now uses COLOR_TEXT_WHITE on destructive background',
      'Fixed TaskDialog submit button text visibility - button text now explicitly uses COLOR_TEXT_WHITE on primary background',
      'Replaced all hardcoded text-white classes and color: white values with COLOR_TEXT_WHITE constant for consistency',
      'Added COLOR_TEXT_WHITE constant usage in AuthScreen button text for gradient backgrounds',
      'Fixed dark mode gradient classes in SettingsPanel - moved hardcoded values to UI_SETTINGS_BADGE_COLORS constant',
      'Verified AI description generation flow - confirmed Local Terminology and Browser AI work together correctly',
      'Created comprehensive review documentation for AI description generation system',
      'Fixed shared_terminology table database error - created migration and improved error handling',
      'All UI visibility issues resolved - buttons, icons, and text are now properly visible on dark backgrounds',
    ],
  },
  {
    version: '1.0.14',
    date: 'January 12, 2026',
    name: 'Terminology Expansion & AI Scheduler Conflict Fix',
    changes: [
      'Expanded terminology database for all domains (Business, Home, Personal, World) with modern keywords and phrases',
      'Added SaaS and subscription terminology (ARR, MRR, churn rate, SLA, uptime, downtime, etc.) to Business domain',
      'Added modern productivity terms (async, remote, hybrid work, virtual meeting, sprint, kanban, etc.) to Business domain',
      'Added smart home and automation keywords (smart home, IoT, home automation, energy efficiency, etc.) to Home domain',
      'Added sustainability and eco-friendly terms (solar panel, renewable energy, carbon footprint, recycling, etc.) to Home domain',
      'Added personal wellness and development terms (mindfulness, meditation, yoga, nutrition tracking, etc.) to Personal domain',
      'Added global and international terms (globalization, climate change, human rights, geopolitics, etc.) to World domain',
      'Created script to save expanded terminology to shared database for all users',
      'Fixed AI Scheduler conflict detection to prevent multiple tasks from being scheduled at the same time',
      'Updated sameStartTime check in findNextAvailableSlot to use 1-minute tolerance instead of 1ms for better conflict detection',
      'Added filter to exclude tasks with midnight times from conflict detection in findNextAvailableSlot',
      'Enhanced conflict detection to catch tasks scheduled at the same time slot (e.g., both at 9:00 AM)',
      'Verified all conflict detection checks use consistent 1-minute tolerance across the scheduler',
      'Confirmed no hardcoded values were used in terminology expansion and conflict detection fixes',
    ],
  },
  {
    version: '1.0.13',
    date: 'January 9, 2026',
    name: 'AI Generator Enhancement & Description Improvements',
    changes: [
      'Enhanced AI Generator to construct complete sentences from keywords and phrases - added sentence templates for natural, contextual descriptions',
      'Improved Browser AI to write complete sentences using keywords and phrases from user input with proper grammar and punctuation',
      'Enhanced context understanding in description generation - improved semantic relevance checks and conceptual relationship mapping',
      'Improved Local Terminology to proactively provide additional keywords to assist Browser AI - now adds domain keywords that relate to extracted terms',
      'Enhanced validateAndEnhanceTermsWithDictionary to use conceptual relationships for better keyword and phrase matching',
      'Added AI Analysis function (getSuggestivePhrases) to provide suggestive phrases, keywords, verbs, and nouns for manual description writing',
      'Added variation mechanism to AI Generator - descriptions now change each time button is pressed using shuffleArray and random selection',
      'Implemented Fisher-Yates shuffle algorithm for term variation to ensure different descriptions on each generation',
      'Enhanced buildElaborateContextualDescription to use complete sentence structures with proper capitalization and punctuation',
      'Added multiple sentence templates for different term combinations (Verb+Noun+Keywords, Phrase+Context, etc.)',
      'Improved sentence construction to use keywords and phrases in complete, natural sentences rather than fragments',
      'Enhanced Local Terminology matching to check both task name words AND extracted keywords for better context alignment',
      'Fixed mobile task card dropdown - removed overlapping box background when dropdown is closed (badges only visible)',
      'Fixed analytics PDF report chart rendering - improved html2canvas configuration for better SVG capture and chart display',
      'Enhanced chart capture function with better SVG element handling, viewBox attributes, and ResponsiveContainer sizing',
      'Fixed data-chart-ref attribute matching to use ANALYTICS_PDF_CONFIG.labels constants for proper chart identification',
      'Improved chart rendering with multiple wait periods, force reflow, and better element visibility checks',
      'Fixed current day tab border removal in Kanban week view - removed ring and border styling for cleaner appearance',
      'Updated task card action plan display - 15-minute tasks now show only first action plan step for consistency across mobile and desktop',
    ],
  },
  {
    version: '1.0.12',
    date: 'January 7, 2026',
    name: 'AI Context Enhancement & Rollover Fixes',
    changes: [
      'Enhanced AI analyzer with conceptual relationship mapping - added synonym and related concept detection for better context understanding',
      'Improved word similarity calculation using Levenshtein distance algorithm for more accurate fuzzy matching',
      'Added CONCEPTUAL_RELATIONSHIPS dictionary mapping synonyms (car↔vehicle, research↔study, purchase↔buy, organize↔arrange, etc.)',
      'Enhanced semantic relevance checking with conceptual relationships - terms now match even with different wording',
      'Improved phrase, verb, and noun matching to use conceptual relationships for better domain terminology integration',
      'Fixed task rollover function to exclude recurring tasks - recurring tasks have their own scheduling mechanism and should not be rolled over',
      'Enhanced rollover function with better error handling for invalid dates and improved logging for debugging',
      'Fixed rollover to only affect tasks from past dates (before today), not tasks scheduled for today',
      'Fixed notification badge to exclude rolled-over tasks - prevents false notifications for tasks moved to inbox',
      'Fixed notification badge to exclude recurring tasks - prevents incorrect badge counts for recurring tasks',
      'Enhanced notification badge logic to prioritize scheduledDate over dueDate for more accurate counts',
      'Updated Today Agenda badge to exclude recurring tasks for consistency with notification logic',
      'Added comprehensive error handling and validation for date parsing in rollover and notification functions',
      'Improved rollover safety checks with double-validation to prevent recurring tasks from being rolled over',
    ],
  },
  {
    version: '1.0.11',
    date: 'January 6, 2026',
    name: 'AI Description & Task Rollover Improvements',
    changes: [
      'Fixed Browser AI and local terminology context mismatch - descriptions now properly match user input with keywords and phrases',
      'Enhanced domain terminology matching to check both extracted keywords AND task name words directly for better context alignment',
      'Improved phrase, verb, and noun matching to be more lenient - accepts terms if they appear in task name OR relate to keywords',
      'Fixed rollover task alerts - improved toast notifications with proper success/warning/error messages based on rollover results',
      'Enhanced rollover alert messaging - shows detailed feedback when tasks are moved, including failed task names and counts',
      'Fixed today agenda badge showing rollover tasks - badge now only counts tasks with scheduledDate (excludes rolled-over tasks)',
      'Updated badge count logic to exclude tasks with scheduledDate === null or undefined to prevent counting rolled-over tasks',
      'Changed badge calculation to only use scheduledDate (not dueDate) to ensure rolled-over tasks are never counted',
      'Added comprehensive error handling for rollover operations with proper task failure tracking and user feedback',
      'Improved logging for badge calculation to help debug rollover task exclusion',
    ],
  },
  {
    version: '1.0.10',
    date: 'January 5, 2026',
    name: 'Mobile Scroll & UI Consistency Improvements',
    changes: [
      'Fixed vertical scroll on mobile view - content bottom was being hidden by nav bar',
      'Added NAV_BAR_SCROLL_BUFFER constant (16px/1rem) to prevent hardcoded values in scroll padding calculations',
      'Updated padding-bottom calculations in App.tsx, TodayAgendaView.tsx, and SettingsPanel.tsx to use NAV_BAR_SCROLL_BUFFER_REM constant',
      'Ensured all nav bar scroll padding uses constants with full nav bar height + safe area + buffer for proper content visibility',
      'Fixed missing TASK_CARD_TIMELINE import in SevenDayKanban.tsx causing runtime errors',
      'Updated task cards on Today Agenda panel to match Kanban week view using DraggableTaskCard component',
      'Reduced magnification on Today Agenda panel for task cards using TASK_CARD_TIMELINE.scale.todayAgenda constant (0.9)',
      'Centralized task card scale values in TASK_CARD_TIMELINE.scale constants (kanban: 0.85, todayAgenda: 0.9) to remove hardcoded values',
      'Linked "Week Starts On" function with "Transition icon" to show icon at start of week based on user selection (Sunday or Monday)',
      'Added localStorage persistence for weekStart setting to maintain user preference across sessions',
    ],
  },
  {
    version: '1.0.9',
    date: 'January 15, 2025',
    name: 'TypeScript & Architecture Improvements',
    changes: [
      'Refactored calendar events cache management: moved clearCalendarEventsCache to lib/calendar-events-cache.ts to break circular dependency',
      'Resolved circular dependency between TaskContext and TeamContext by removing direct TeamContext import',
      'Resolved circular dependency between useCalendarEvents and CalendarContext by extracting cache management',
      'Enhanced TypeScript type safety with explicit type annotations in task filters and logging functions',
      'Improved AIRecommendationPanel async handling for scheduling tasks with proper Promise await',
      'Added comprehensive agent logging infrastructure across App, SettingsPanel, Calendar, Subscription, Task, and Team contexts',
      'Enhanced error handling patterns with consistent logging structure for better debugging and monitoring',
      'Improved context defaults consistency across all context providers to prevent crashes during development',
      'Fixed type guards for safe property access on union types in AppSidebar and SevenDayKanban components',
      'Updated context fallback patterns to use type-safe default factory functions',
    ],
  },
  {
    version: '1.0.8',
    date: 'December 20, 2025',
    name: 'Error Resilience & Stability Improvements',
    changes: [
      'Fixed TypeError: Cannot read properties of undefined (reading "canCreateTask") errors',
      'Enhanced usePermissions hook with comprehensive fallback handling and null checks',
      'Added component-level safety checks for permissions in InboxView, TaskDialog, DraggableTaskCard, and DraggableTodayAgendaTask',
      'Improved useTeam, useTasks, and useAuth hooks to return safe fallback objects instead of throwing errors',
      'Fixed provider hierarchy issues between TaskProvider and TeamProvider',
      'Added null safety checks for user.id access across TaskContext and usePermissions',
      'Fixed undefined! non-null assertion in TaskDialog date selection',
      'Added Array.isArray() safety checks for all array operations in FoldersPanel and TaskDialog',
      'Enhanced error resilience during React Fast Refresh and initial render edge cases',
      'Improved context provider dependency handling with graceful degradation',
      'Added defensive programming patterns to prevent runtime crashes from undefined values',
      'Fixed array filtering operations to handle null/undefined task objects safely',
    ],
  },
  {
    version: '1.0.7',
    date: 'December 15, 2025',
    name: 'Feature Tier Rebalancing & Limit Enforcement',
    changes: [
      'Rebalanced Pro Monthly vs Pro Yearly feature distribution for better value proposition',
      'Moved Recurring Tasks from Pro Yearly to Pro Monthly (with 5 active recurring tasks limit)',
      'Added recurring tasks limit enforcement: 5 active for Pro Monthly, unlimited for Pro Yearly',
      'Added calendar sync limit enforcement: 1 connection for Pro Monthly, unlimited for Pro Yearly',
      'Updated Pro Yearly to include 8 additional features: Unlimited Recurring Tasks, Unlimited Calendar Connections, Team Collaboration, Unlimited Analytics History, Task Templates, Task Dependencies, Multiple Workspaces, Priority Support',
      'Updated App Tour with new feature limits and distribution',
      'Updated Pricing Dialog to reflect new feature tiers with limit information',
      'Fixed Settings Panel feature display for mobile and desktop with proper text wrapping',
      'Updated TaskDialog to show "PRO" badge instead of "PRO YEARLY" for recurring tasks',
      'Enhanced feature gating functions to support recurringTasksLimit and calendarSyncLimit',
      'Updated SubscriptionContext to set proper limits for monthly vs yearly subscriptions',
      'Improved feature display layout with min-w-0, flex-1, and break-words for responsive text wrapping',
      'Fixed all feature items in subscription section to prevent text overflow and badge positioning issues',
    ],
  },
  {
    version: '1.0.6',
    date: 'December 15, 2025',
    name: 'Mobile Header Spacer Fix',
    changes: [
      'Fixed mobile header spacer positioning - moved from AppHeader component to App.tsx scrollable container',
      'Removed duplicate spacer from AppHeader to prevent double spacing',
      'Ensured content starts below fixed header on mobile by placing spacer as first element in scrollable container',
      'Fixed content being hidden under AppHeader when page scrolls',
      'Verified spacer uses HEADER_MOBILE_SAFE_AREA_SPACER constant (no hardcoded values)',
      'Fixed nav bar spacer height reduced to 65px to prevent excessive spacing',
    ],
  },
  {
    version: '1.0.5',
    date: 'December 15, 2025',
    name: 'Task Card Auto-Adjust',
    changes: [
      'Fixed auto-adjust boundary condition for 35-minute tasks (now includes exactly 35 minutes)',
      'Fixed height calculation for inline pomodoro timer when it\'s the only activated component',
      'Updated height calculation logic to properly account for all activated components in bottom row',
      'Verified auto-adjust functionality for task cards with duration ≤35 minutes and activated components',
      'Improved compact spacing optimization for very short tasks with multiple activated components',
    ],
  },
  {
    version: '1.0.3',
    date: 'November 24, 2025',
    name: 'Analytics Motion Sync',
    changes: [
      'Fixed AppHeader dark mode detection to apply instant background updates on theme switch',
      'Synchronized Today Agenda drag behaviour between desktop and mobile (disabled drag on mobile)',
      'Resolved demo account task status pie chart crash by reordering analytics hooks',
      'Added intersection-aware motion animation to the Analytics status card for parity with mobile',
    ],
  },
  {
    version: '1.0.2',
    date: 'November 13, 2025',
    name: 'Responsive Layout Sync',
    changes: [
      'Auto-adjusted task card borders and padding across desktop and mobile views',
      'Positioned mobile navigation indicator above icons with precise horizontal alignment',
      'Synced folder view headers with side panel layout to match desktop behaviour',
      'Documented core application functions for release tracking',
    ],
  },
  {
    version: '1.0.1',
    date: 'November 11, 2025',
    name: 'Baseline Reset',
    changes: [
      'Recorded full application state snapshot before cleanup',
      'Reset semantic versioning to 1.0.1 as the new starting point',
      'Removed redundant build artifacts and unused assets',
      'Updated notification, folder, and team modules to current stable fixes',
    ],
  },
  {
    version: '2.11.0',
    date: 'November 10, 2025',
    name: 'Stability & Polish',
    changes: [
      'Fixed 3-dots menu dropdown functionality in folder cards',
      'Fixed folder panel hover states and button interactions',
      'Improved subscription sync reliability with proper memoization',
      'Enhanced build system - fixed versioned imports and asset paths',
      'Comprehensive system and feature review completed',
      'All critical features verified and operational',
    ],
  },
  {
    version: '2.10.0',
    date: 'November 7, 2025',
    name: 'Folders & Focus Stability',
    changes: [
      'Persist folders to Supabase with full CRUD API support',
      'Brand refresh across splash and sign-in with cropped logo',
      'Resolved mobile dashboard week header overlap issues',
      'Stabilized Pomodoro timer with minute logging and refresh persistence',
      'Fixed task time picker AM/PM and minute selector behaviour',
      'Updated documentation covering data flow and sync verification',
    ],
  },
  {
    version: '2.9.0',
    date: 'November 6, 2025',
    name: 'Payment & Subscription Management',
    changes: [
      'Enhanced subscription management component in settings panel',
      'Fixed billing portal authentication with proper access token handling',
      'Added subscription refresh functionality with loading states',
      'Improved subscription information display (start date, billing dates)',
      'Enhanced subscription cancellation flow with confirmation dialog',
      'Fixed Google Calendar OAuth redirect URI mismatch issue',
      'Improved error handling and user feedback for billing operations',
      'Added subscription status loading indicators',
      'Payment system review and verification',
      'Environment variables cleanup and organization',
    ]
  },
  {
    version: '2.8.0',
    date: 'November 5, 2025',
    name: 'Notifications & UX Enhancements',
    changes: [
      'Browser notification system with permission management',
      'App icon badge notifications for due/overdue tasks',
      'Mobile navigation bar size improvements (12% larger icons)',
      'Tag management: removed "urgent" tag from available tags',
      'Demo account cleanup after 1 hour of inactivity',
      'Settings panel mobile responsiveness improvements',
      'Notification permission request on user interaction only',
      'Browser-specific instructions for enabling notifications',
    ]
  },
  {
    version: '2.7.1',
    date: 'November 1, 2025',
    name: 'Auto-Sync Enhanced',
    changes: [
      'Enhanced database sync display in Settings',
      'Removed redundant manual sync button',
      'Added auto-sync info card with 30-second interval',
      'Improved sync timestamp with relative time',
      'Mobile Kanban spacing refinements',
    ]
  },
  {
    version: '2.6.2',
    date: 'October 30, 2025',
    name: 'Production Ready',
    changes: [
      'Logo & tagline proportion fixes (21% reduction)',
      'Improved visual hierarchy across all locations',
      'Consistent spacing refinements',
      'Better logo-to-text balance',
    ]
  },
  {
    version: '2.6.1',
    date: 'October 30, 2025',
    name: 'Production Ready',
    changes: [
      'Auto tour trigger for new users',
      'Gentle award celebration sound',
      'Fixed archive panel scroll',
      'Removed all sample/demo data',
      'Production cleanup complete',
    ]
  },
  {
    version: '2.6.0',
    date: 'October 29, 2025',
    name: 'Awards & Achievements',
    changes: [
      'Comprehensive awards system (23 achievements)',
      'App tour improvements',
      'Mobile drag & drop disabled',
      'Production-ready backend validation',
    ]
  },
  {
    version: '2.5.0',
    date: 'October 28, 2025',
    name: 'Task Dependencies',
    changes: [
      'Task dependencies with blocking logic',
      'Next Up badge system',
      'Mobile scroll improvements',
      'Drag & drop enhancements',
    ]
  },
] as const;

/**
 * Get current version information
 */
export function getVersionInfo() {
  return {
    version: APP_VERSION,
    name: VERSION_NAME,
    date: VERSION_DATE,
    buildNumber: BUILD_NUMBER,
    fullVersion: `${APP_VERSION} - ${VERSION_NAME}`,
  };
}

/**
 * Compare version strings (semantic versioning)
 * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const part1 = parts1[i] || 0;
    const part2 = parts2[i] || 0;
    
    if (part1 > part2) return 1;
    if (part1 < part2) return -1;
  }
  
  return 0;
}

/**
 * Check if current version is newer than a given version
 */
export function isNewerThan(version: string): boolean {
  return compareVersions(APP_VERSION, version) > 0;
}

/**
 * Get changelog for current version
 */
export function getCurrentChangelog() {
  return VERSION_HISTORY[0];
}
