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
  ai: 'AI',
} as const;

export const AI_PANEL_OPEN_EVENT = 'taskzm-open-ai';

export const AI_PANEL_UI_TEXT = {
  sheetDescription: 'Let AI plan new tasks or re-plan existing ones.',
  prompt: 'What should AI do?',
  schedule: {
    title: 'Schedule new tasks',
    description: (count: number) =>
      `${count} open task${count === 1 ? '' : 's'} without a time. AI finds a slot for each one.`,
    byPriority: 'Urgent tasks are placed first.',
    nothingToSchedule: 'Every open task already has a time.',
    settingOff: 'Scheduling open tasks is turned off in Settings.',
    periodLabel: 'Plan across',
    action: (count: number) => `Schedule ${count} task${count === 1 ? '' : 's'}`,
  },
  reschedule: {
    title: 'Reschedule planned tasks',
    description: 'Move tasks that already have a time to better slots, for example after a busy day.',
    rangeLabel: 'Pick what to re-plan',
  },
  disabled: (count: number) =>
    `AI scheduling is off. Turn it on in Settings to plan your ${count} open task${count === 1 ? '' : 's'}.`,
  footnote: 'AI uses priority, due dates, your working hours, and calendar events.',
  periods: { day: 'Today', week: 'Week', twoWeeks: '2 weeks', month: 'Month' },
  rescheduleRanges: { day: 'A day', week: 'A week', month: 'A month' },
} as const;

export const MOBILE_HOME_UI_TEXT = {
  tabs: {
    schedule: 'Schedule',
    unfinished: 'Unfinished',
    toPlace: 'To place',
    overview: 'Overview',
    upcoming: 'Upcoming',
    open: 'Open',
  },
  greetingHello: 'Hello',
  greetingMorning: 'Good morning',
  greetingAfternoon: 'Good afternoon',
  greetingEvening: 'Good evening',
  summaryUnfinished: 'Unfinished',
  summaryToPlace: 'To place',
  summaryScheduledToday: 'Scheduled today',
  summaryDone: 'Done',
  activityTitle: 'Activity',
  upcomingTitle: 'Upcoming',
  upNext: 'Up next',
  calendarTag: 'Calendar',
  allDay: 'All day',
  needsTime: 'Needs a time',
  notScheduled: 'Not scheduled',
  previousDay: 'Previous day',
  nextDay: 'Next day',
  today: 'Today',
  previousWeek: 'Previous week',
  nextWeek: 'Next week',
  currentWeek: 'Current week',
  upcomingWeek: 'Upcoming week',
  weekEmpty: 'Nothing scheduled.',
  scheduleAction: 'Place open tasks',
  scheduleHint: 'Gives a time to tasks that are not on the calendar yet.',
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
