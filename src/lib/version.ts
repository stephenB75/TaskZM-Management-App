/**
 * TaskZM Version Control
 * 
 * Centralized version management for the application.
 * Update this file when releasing new versions.
 */

export const APP_VERSION = '1.0.2';
export const VERSION_NAME = 'Responsive Layout Sync';
export const VERSION_DATE = 'November 13, 2025';
export const BUILD_NUMBER = '20251113-1';

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
