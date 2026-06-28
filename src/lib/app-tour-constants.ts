/**
 * App Tour copy and step metadata.
 * Used by AppTour.tsx — keep strings here, not inline in components.
 */

import { NAVIGATION_UI_TEXT } from './navigation-constants';
import { SETTINGS_PANEL_UI_TEXT } from './settings-panel-constants';
import { DASHBOARD_VIEW_HEADER_LABELS } from './layout-constants';

export const APP_TOUR_UI = {
  welcome: {
    title: 'Welcome to TaskZM!',
    description:
      'This quick walkthrough shows you how to navigate the app, switch between Week and Month views, use AI scheduling, and customize settings.',
  },
  navigation: {
    title: 'Navigation',
    desktopIntro:
      'The icon sidebar on the left opens sliding panels and switches your main workspace. Tap any icon to jump there.',
    mobileIntro:
      'The bottom bar is your main navigation on phone and tablet. Each tab opens a different part of the app.',
    desktopIcons: [
      {
        label: NAVIGATION_UI_TEXT.dashboard,
        description: 'Your 7-day Week view and Month calendar — drag tasks, add items, and plan your schedule.',
      },
      {
        label: NAVIGATION_UI_TEXT.notifications,
        description: 'Due-soon, overdue, and system alerts. Badges show how many need attention.',
      },
      {
        label: NAVIGATION_UI_TEXT.todayAgenda,
        description: 'Today’s timeline — tasks and calendar events in time order with a visual day rail.',
      },
      {
        label: NAVIGATION_UI_TEXT.inbox,
        description: 'Unscheduled tasks waiting to be planned. Capture ideas here, then schedule with AI or manually.',
      },
      {
        label: NAVIGATION_UI_TEXT.folders,
        description: 'Organize tasks into folders for projects or areas of life.',
      },
      {
        label: NAVIGATION_UI_TEXT.team,
        description: 'Invite teammates, assign tasks, and collaborate (Pro).',
      },
      {
        label: NAVIGATION_UI_TEXT.analytics,
        description: 'Track completion trends, focus time, and productivity insights (Pro).',
      },
      {
        label: NAVIGATION_UI_TEXT.archive,
        description: 'Completed and archived tasks kept out of your active views.',
      },
      {
        label: NAVIGATION_UI_TEXT.settings,
        description: 'Profile, calendars, notifications, AI scheduling, hours, and preferences.',
      },
    ] as const,
    mobileTabs: [
      {
        label: NAVIGATION_UI_TEXT.today,
        description: 'Today Agenda — your scheduled day in timeline order.',
      },
      {
        label: NAVIGATION_UI_TEXT.week,
        description: 'Week view — scroll through the 7-day board and manage task cards.',
      },
      {
        label: NAVIGATION_UI_TEXT.inbox,
        description: 'Unscheduled tasks ready for AI Scheduler or manual planning.',
      },
      {
        label: NAVIGATION_UI_TEXT.settings,
        description: 'Customize calendars, notifications, AI behavior, and more.',
      },
    ] as const,
  },
  weekMonthToggle: {
    title: 'Week & Month Toggle',
    description:
      'Switch between Week and Month at any time. Week shows a detailed 7-day kanban; Month shows the full calendar grid for long-range planning.',
    hint: 'Week is best for daily execution. Month helps you spot busy days and plan ahead.',
  },
  weekView: {
    title: 'Week View',
    description:
      'Your main working board: seven color-coded day columns with task cards showing priority, tags, duration, and inline Pomodoro controls.',
    bullets: [
      'Drag tasks between days or times to reschedule',
      'Click a card to edit details, subtasks, and dependencies',
      'Use the play icon on a card footer to start a focus timer',
      'Tap + on a day to add a new task',
    ] as const,
  },
  switchToMonth: {
    title: 'Month View Next',
    description: 'Let’s switch to Month view so you can see the calendar layout.',
  },
  monthView: {
    title: 'Month View',
    description:
      'The calendar grid shows scheduled tasks and synced calendar events across the whole month. Click a day to inspect or add tasks.',
    bullets: [
      'Scan workload density before committing to new work',
      'Drag tasks between days when rescheduling manually',
      'Works alongside connected Google, Apple, or Outlook calendars',
    ] as const,
  },
  switchToWeek: {
    title: 'Back to Week View',
    description: 'Switching back to Week view for task-level detail.',
  },
  aiScheduler: {
    title: `${DASHBOARD_VIEW_HEADER_LABELS.aiSchedulerSuggestionsLong}`,
    description:
      'Schedules unscheduled Inbox tasks into open slots across the next two weeks. AI respects priority, due dates, your daily hour limits, category hours, and calendar conflicts.',
    bullets: [
      'Urgent and high-priority tasks are placed first',
      'Review the preview plan before applying',
      'Free tier has a weekly suggestion limit; Pro is unlimited',
    ] as const,
    mobileNote:
      'On mobile, open the AI panel from the dashboard to run the scheduler and review suggestions.',
  },
  aiSchedulePreview: {
    title: 'Schedule Preview',
    description:
      'Before anything is saved, review where AI placed each task. Select or deselect items, then confirm to apply the plan.',
    hint: 'You can cancel and adjust tasks manually if the plan needs tweaks.',
  },
  closeSchedulePreview: {
    title: 'Next: Re-Scheduler',
    description: 'Closing the preview. Next up — moving tasks that are already scheduled.',
  },
  aiRescheduler: {
    title: DASHBOARD_VIEW_HEADER_LABELS.reschedule,
    description:
      'Re-Scheduler reshuffles tasks that already have dates — useful when plans change. Pick a day, week, or month; AI clears and redistributes those tasks into new open slots.',
    bullets: [
      'Day — move everything from one date to a new date',
      'Week — redistribute an entire week’s tasks',
      'Month — rebalance tasks across a new month',
    ] as const,
    mobileNote:
      'On mobile, use the Day / Week / Month buttons in the AI panel to re-schedule.',
  },
  rescheduleDialog: {
    title: 'Re-Schedule Dialog',
    description:
      'Choose the period and target date, then confirm. Tasks in that range are unscheduled and run through AI slot-finding again.',
    hint: 'Pro feature — respects the same hours, categories, and calendar rules as AI Scheduler.',
  },
  openSettings: {
    title: 'Settings',
    description: 'Last stop — a quick look at where to customize TaskZM.',
  },
  settingsPanel: {
    title: 'Settings Panel',
    intro: 'Expand any section in Settings to fine-tune how TaskZM works for you. Key areas:',
    sections: [
      {
        title: SETTINGS_PANEL_UI_TEXT.sections.userProfile.description,
        detail: 'Name, avatar, plan, and sign-out.',
      },
      {
        title: SETTINGS_PANEL_UI_TEXT.sections.calendar.description,
        detail: 'Connect external calendars so events block scheduling time.',
      },
      {
        title: SETTINGS_PANEL_UI_TEXT.sections.notifications.description,
        detail: 'Due-soon reminders and overdue alerts.',
      },
      {
        title: SETTINGS_PANEL_UI_TEXT.sections.tags.description,
        detail: 'Create tags for filtering and organization.',
      },
      {
        title: SETTINGS_PANEL_UI_TEXT.sections.aiSettings.description,
        detail: 'Toggle auto-scheduling, priority-based placement, and daily limits.',
      },
      {
        title: SETTINGS_PANEL_UI_TEXT.sections.hours.description,
        detail: 'Set Work, Personal, and Project hours for weekdays vs weekends.',
      },
      {
        title: SETTINGS_PANEL_UI_TEXT.sections.rollover.description,
        detail: 'Automatically move incomplete tasks to the next day.',
      },
      {
        title: SETTINGS_PANEL_UI_TEXT.sections.dateTime.description,
        detail: '12h/24h time, week start day, and appearance.',
      },
      {
        title: SETTINGS_PANEL_UI_TEXT.sections.appTour.description,
        detail: 'Replay this walkthrough anytime.',
      },
    ] as const,
  },
  complete: {
    title: 'You’re Ready!',
    description:
      'You now know the sidebar, Week and Month views, AI Scheduler & Re-Scheduler, and where to adjust settings. Click Get Started to begin.',
  },
} as const;

/** Joyride `target` selectors — keep in sync with data-tour attributes in the UI. */
export const APP_TOUR_TARGETS = {
  body: 'body',
  sidebar: '[data-tour="sidebar"]',
  bottomNav: '[data-tour="bottom-nav"]',
  weekMonthToggle: '[data-tour="week-month-toggle"]',
  kanbanBoard: '[data-tour="kanban-board"]',
  kanbanMobile: '[data-tour="kanban"]',
  monthCalendar: '[data-tour="month-calendar-view"]',
  aiScheduler: '[data-tour="ai-scheduler"]',
  aiSchedulerSection: '[data-tour="ai-scheduler-section"]',
  aiSchedulePreview: '[data-tour="ai-schedule-preview-dialog"]',
  aiReschedule: '[data-tour="re-schedule"]',
  aiRescheduleSection: '[data-tour="ai-reschedule-section"]',
  rescheduleDialog: '[data-tour="reschedule-dialog"]',
  aiRecommendationsPanel: '[data-tour="ai-recommendations-panel"]',
  settingsPanel: '[data-tour="settings-panel"]',
} as const;

export type AppTourStepMeta = {
  target: string;
  /** When true, step is omitted on mobile/tablet layouts. */
  desktopOnly?: boolean;
  /** When true, step is omitted on desktop. */
  mobileOnly?: boolean;
  placement?: 'center' | 'bottom' | 'top' | 'left' | 'right';
  disableBeacon?: boolean;
  stepKey: keyof typeof APP_TOUR_STEP_KEYS;
};

export const APP_TOUR_STEP_KEYS = {
  welcome: 'welcome',
  navigation: 'navigation',
  weekMonthToggle: 'weekMonthToggle',
  weekView: 'weekView',
  switchToMonth: 'switchToMonth',
  monthView: 'monthView',
  switchToWeek: 'switchToWeek',
  aiScheduler: 'aiScheduler',
  aiSchedulePreview: 'aiSchedulePreview',
  closeSchedulePreview: 'closeSchedulePreview',
  aiRescheduler: 'aiRescheduler',
  rescheduleDialog: 'rescheduleDialog',
  openSettings: 'openSettings',
  settingsPanel: 'settingsPanel',
  complete: 'complete',
} as const;
