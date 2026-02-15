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
} as const;
