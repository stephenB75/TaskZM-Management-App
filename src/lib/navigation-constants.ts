/**
 * Navigation UI Text Constants
 * Centralized text strings for navigation components (BottomNav, AppSidebar)
 */

export const NAVIGATION_UI_TEXT = {
  today: 'Today',
  home: 'Home',
  week: 'Week',
  inbox: 'Inbox',
  settings: 'Settings',
  dashboard: 'Dashboard',
  notifications: 'Notifications',
  todayAgenda: 'Today Agenda',
  folders: 'Folders',
  team: 'Team',
  analytics: 'Analytics',
  archive: 'Archive',
} as const;

export const MOBILE_HOME_UI_TEXT = {
  tabs: {
    schedule: 'Schedule',
    unfinished: 'Unfinished',
    toPlace: 'To place',
  },
  scheduleAction: 'Place open tasks',
  scheduleHint: 'Today’s placed tasks. Swipe for work that still needs a time.',
  unfinishedTitle: 'Still open',
  unfinishedEmpty: 'Nothing unfinished. Completed work stays off this page.',
  unfinishedHint: 'These tasks were not finished. Pick one next step.',
  statusOverdue: 'Overdue',
  statusPastSlot: 'Past its time',
  statusRolled: 'Rolled over',
  actionDone: 'Done',
  actionToday: 'Today',
  actionReschedule: 'Reschedule',
  toPlaceEmpty: 'Nothing waiting to be placed.',
  toPlaceHint: 'Tasks with no time yet. Place them with the scheduler.',
  toPlaceAction: 'Place these tasks',
  scheduling: 'Placing…',
  rescheduled: 'Placed on your schedule',
  movedToday: 'Moved to today',
  markedDone: 'Marked done',
  noSlot: 'No open time was found. Try again from Settings hours.',
  aiPro: 'AI Scheduling is a Pro feature',
  aiDisabled: 'AI Scheduling is disabled',
  aiDisabledDetail: 'Enable AI scheduling in Settings to use this feature.',
} as const;
