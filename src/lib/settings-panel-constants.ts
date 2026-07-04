/**
 * Settings Panel UI Text Constants
 * Centralized text strings for settings panel components
 */

export const SETTINGS_PANEL_UI_TEXT = {
  profile: {
    saveProfile: 'Save Profile',
    saving: 'Saving…',
    profile: 'Profile',
    userProfile: 'User Profile',
    user: 'user',
    fallbackName: '—',
    fallbackEmail: '—',
    proMember: 'Pro Member',
    freeMember: 'Free Member',
    plan: 'Plan',
    billing: 'Billing',
    pro: 'Pro',
    free: 'Free',
    role: 'Role',
    team: 'Team',
    emailLabel: 'Email',
  },
  priorityLevels: {
    sectionTitle: 'Priority Levels',
    intro: 'Tasks can be assigned one of four priority levels. These help you and the AI scheduler focus on what matters most.',
    urgent: {
      label: 'Urgent',
      description: 'Critical items that need immediate attention. Shown first in lists and by the AI when scheduling.',
    },
    high: {
      label: 'High',
      description: 'Important tasks that should be done soon. Scheduled ahead of medium and low priority.',
    },
    medium: {
      label: 'Medium',
      description: 'Standard tasks with normal importance. Balanced with the rest of your schedule.',
    },
    low: {
      label: 'Low',
      description: 'Nice-to-do or flexible items. Fitted in when time allows; can be deferred without impact.',
    },
  },
  categories: {
    account: 'Account & billing',
    integrations: 'Integrations',
    tasks: 'Tasks & organization',
    scheduling: 'Scheduling & AI',
    preferences: 'Display & preferences',
    engagement: 'Achievements & help',
  },
    sections: {
    userProfile: {
      description: 'Your name, avatar, email, and team details',
    },
    security: {
      description: 'Face ID, Touch ID, and remote notifications',
    },
    subscription: {
      description: 'Current plan, billing, and included features',
    },
    calendar: {
      description: 'Connect Google, Apple, or Outlook calendars',
    },
    notifications: {
      description: 'Due-date reminders and overdue alerts',
    },
    tags: {
      description: 'Create and manage tags for your tasks',
    },
    priorityLevels: {
      description: 'How urgent, high, medium, and low priorities work',
    },
    aiSettings: {
      description: 'Auto-scheduling, priorities, and daily hour limits',
    },
    dateTime: {
      description: 'Time format, week start, and appearance',
    },
    rollover: {
      description: 'Move incomplete tasks to the next day automatically',
    },
    hours: {
      description: 'Work, personal, and project hours by day type',
    },
    awards: {
      description: 'Track milestones and earned achievements',
    },
    appTour: {
      description: 'Replay the guided walkthrough of TaskZM',
    },
    about: {
      description: 'Version info, policies, and account actions',
    },
  },
  security: {
    sectionTitle: 'App Security',
    biometricLock: {
      label: 'Require Face ID / Touch ID',
      description: 'Lock TaskZM when you leave the app and return from the home screen.',
      unavailable: 'Biometric unlock is not available on this device.',
      enabled: 'App lock enabled',
      verifyFailed: 'Could not verify your identity. Try again.',
    },
    pushNotifications: {
      label: 'Remote push notifications',
      description: 'Receive task alerts from TaskZM even when the app is closed (requires server setup).',
      permissionDenied: 'Push permission denied. Enable notifications in iOS Settings.',
    },
  },
} as const;
