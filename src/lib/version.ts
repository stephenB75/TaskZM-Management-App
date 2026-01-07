/**
 * TaskZM Version Control
 * 
 * Centralized version management for the application.
 * Update this file when releasing new versions.
 */

export const APP_VERSION = '1.0.11';
export const VERSION_NAME = 'AI Description & Task Rollover Improvements';
export const VERSION_DATE = 'January 6, 2026';
export const BUILD_NUMBER = '20260106-1';

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
