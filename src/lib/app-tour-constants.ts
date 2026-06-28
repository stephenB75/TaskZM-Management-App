/**
 * App Tour copy and step metadata.
 * Used by AppTour.tsx — keep strings here, not inline in components.
 */

import { NAVIGATION_UI_TEXT } from './navigation-constants';
import { SETTINGS_PANEL_UI_TEXT } from './settings-panel-constants';
import { DASHBOARD_VIEW_HEADER_LABELS } from './layout-constants';
import { TIMING_CONSTANTS } from './timing-constants';

/** Sidebar icon tour stops (desktop) — order matches AppSidebar menuItems. */
export const APP_TOUR_SIDEBAR_ITEMS = [
  {
    id: 'dashboard',
    label: NAVIGATION_UI_TEXT.dashboard,
    description:
      'Your main workspace — 7-day Week view and Month calendar. Drag tasks, add items, and plan your schedule.',
  },
  {
    id: 'notifications',
    label: NAVIGATION_UI_TEXT.notifications,
    description:
      'Due-soon, overdue, and system alerts. Badge counts show how many need attention.',
  },
  {
    id: 'today',
    label: NAVIGATION_UI_TEXT.todayAgenda,
    description:
      'Today’s timeline — tasks and calendar events in chronological order with a visual day rail.',
  },
  {
    id: 'inbox',
    label: NAVIGATION_UI_TEXT.inbox,
    description:
      'Unscheduled tasks waiting to be planned. Capture ideas here, then schedule with AI or manually.',
  },
  {
    id: 'folders',
    label: NAVIGATION_UI_TEXT.folders,
    description: 'Organize tasks into folders for projects or areas of life.',
  },
  {
    id: 'team',
    label: NAVIGATION_UI_TEXT.team,
    description: 'Invite teammates, assign tasks, and collaborate (Pro).',
  },
  {
    id: 'analytics',
    label: NAVIGATION_UI_TEXT.analytics,
    description: 'Track completion trends, focus time, and productivity insights (Pro).',
  },
  {
    id: 'archive',
    label: NAVIGATION_UI_TEXT.archive,
    description: 'Completed and archived tasks kept out of your active views.',
  },
  {
    id: 'settings',
    label: NAVIGATION_UI_TEXT.settings,
    description: 'Profile, calendars, notifications, AI scheduling, hours, and preferences.',
  },
] as const;

/** Bottom nav tour stops (mobile/tablet). */
export const APP_TOUR_BOTTOM_NAV_ITEMS = [
  {
    id: 'today',
    label: NAVIGATION_UI_TEXT.today,
    description: 'Today Agenda — your scheduled day in timeline order.',
  },
  {
    id: 'week',
    label: NAVIGATION_UI_TEXT.week,
    description: 'Week view — scroll the 7-day board and manage task cards.',
  },
  {
    id: 'inbox',
    label: NAVIGATION_UI_TEXT.inbox,
    description: 'Unscheduled tasks ready for AI Scheduler or manual planning.',
  },
  {
    id: 'settings',
    label: NAVIGATION_UI_TEXT.settings,
    description: 'Customize calendars, notifications, AI behavior, and more.',
  },
] as const;

/** Settings accordion sections highlighted during the tour. */
export const APP_TOUR_SETTINGS_SECTIONS = [
  {
    id: 'user-profile',
    title: SETTINGS_PANEL_UI_TEXT.profile.userProfile,
    description: SETTINGS_PANEL_UI_TEXT.sections.userProfile.description,
    detail: 'Update your name, avatar, email, plan, and sign out.',
  },
  {
    id: 'calendar',
    title: 'Calendar Integrations',
    description: SETTINGS_PANEL_UI_TEXT.sections.calendar.description,
    detail: 'Connect Google, Apple, or Outlook so events block time when AI schedules.',
  },
  {
    id: 'notifications',
    title: 'Notifications',
    description: SETTINGS_PANEL_UI_TEXT.sections.notifications.description,
    detail: 'Configure due-soon reminders and overdue alerts.',
  },
  {
    id: 'tags',
    title: 'Tags',
    description: SETTINGS_PANEL_UI_TEXT.sections.tags.description,
    detail: 'Create and manage tags for filtering tasks across views.',
  },
  {
    id: 'ai-settings',
    title: 'AI Settings',
    description: SETTINGS_PANEL_UI_TEXT.sections.aiSettings.description,
    detail: 'Enable auto-scheduling, priority-based placement, and daily hour limits.',
  },
  {
    id: 'hours',
    title: 'Category Hours',
    description: SETTINGS_PANEL_UI_TEXT.sections.hours.description,
    detail: 'Set Work, Personal, and Project windows for weekdays vs weekends.',
  },
  {
    id: 'rollover',
    title: 'Task Rollover',
    description: SETTINGS_PANEL_UI_TEXT.sections.rollover.description,
    detail: 'Automatically move incomplete tasks to the next day.',
  },
  {
    id: 'datetime',
    title: 'Date & Time',
    description: SETTINGS_PANEL_UI_TEXT.sections.dateTime.description,
    detail: 'Choose 12h/24h time, week start day, and appearance.',
  },
  {
    id: 'app-tour',
    title: 'App Tour',
    description: SETTINGS_PANEL_UI_TEXT.sections.appTour.description,
    detail: 'Replay this guided walkthrough anytime.',
  },
] as const;

export const APP_TOUR_UI = {
  welcome: {
    title: 'Welcome to TaskZM!',
    description:
      'This walkthrough highlights each navigation icon, Week and Month views, AI scheduling buttons and dialogs, and key settings sections.',
  },
  sidebarIconIntro: {
    title: 'Sidebar Icons',
    description: 'Each icon opens a different part of TaskZM. We’ll highlight them one by one.',
  },
  bottomNavIntro: {
    title: 'Bottom Navigation',
    description: 'Each tab opens a different part of TaskZM. We’ll highlight them one by one.',
  },
  weekMonthToggle: {
    title: 'Week ↔ Month Toggle',
    description:
      'Use this switch to move between Week and Month. Week shows your 7-day kanban; Month shows the full calendar grid.',
    hint: 'Flip toward Month when you want the big-picture view — we’ll switch there on the next step.',
  },
  weekView: {
    title: 'Week View',
    description:
      'Seven color-coded day columns with task cards showing priority, tags, duration, and inline Pomodoro controls.',
    bullets: [
      'Drag tasks between days to reschedule',
      'Click a card to edit details and subtasks',
      'Use the play icon on a card footer to start focus time',
    ] as const,
  },
  monthView: {
    title: 'Month View',
    description:
      'The calendar grid shows scheduled tasks and synced events across the month. Click any day to inspect or add tasks.',
    bullets: [
      'Spot busy days before committing to new work',
      'Drag tasks between days when rescheduling manually',
      'Use the Week ↔ Month toggle anytime to switch back',
    ] as const,
  },
  aiSchedulerButton: {
    title: DASHBOARD_VIEW_HEADER_LABELS.aiSchedulerSuggestionsLong,
    description:
      'Click this button to run AI Scheduler. It places unscheduled Inbox tasks into open slots using priority, due dates, your hours, and calendar conflicts.',
    hint: 'On the next step you’ll see the preview dialog before anything is saved.',
  },
  aiSchedulePreview: {
    title: 'Schedule Preview Dialog',
    description:
      'Review AI’s proposed plan here. Each row shows a task, suggested date/time, and priority.',
    bullets: [
      'Select all / Deselect all to bulk choose suggestions',
      'Toggle individual tasks with the checkboxes',
      'Cancel to discard or Accept selected to apply the plan',
    ] as const,
  },
  aiReschedulerButton: {
    title: DASHBOARD_VIEW_HEADER_LABELS.reschedule,
    description:
      'Click Re-Schedule when plans change. It reshuffles tasks that already have dates into new open slots.',
    hint: 'The next step shows the dialog where you pick Day, Week, or Month and a target date.',
  },
  rescheduleDialog: {
    title: 'Re-Schedule Dialog',
    description:
      'Choose a period type and date, then confirm. Tasks in that range are unscheduled and run through AI again.',
    bullets: [
      'Day — move tasks from specific date(s)',
      'Week — redistribute an entire week',
      'Month — rebalance across a month',
      'Confirm with Re-Schedule to apply (Pro feature)',
    ] as const,
  },
  settingsIntro: {
    title: 'Settings Panel',
    description:
      'Each expandable section below controls part of TaskZM. We’ll highlight the most useful ones.',
  },
  complete: {
    title: 'You’re Ready!',
    description:
      'You’ve seen the navigation icons, Week/Month toggle, AI Scheduler & Re-Scheduler flows, and settings sections. Click Get Started to begin.',
  },
} as const;

export function sidebarNavTarget(id: string): string {
  return `[data-tour="sidebar-${id}"]`;
}

export function bottomNavTarget(id: string): string {
  return `[data-tour="bottom-nav-${id}"]`;
}

export function settingsSectionTarget(id: string): string {
  return `[data-tour="settings-${id}"]`;
}

/** Joyride `target` selectors — keep in sync with data-tour attributes in the UI. */
export const APP_TOUR_TARGETS = {
  body: 'body',
  sidebar: '[data-tour="sidebar"]',
  bottomNav: '[data-tour="bottom-nav"]',
  weekMonthToggle: '[data-tour-header-actions="desktop"] [data-tour="week-month-toggle"]',
  kanbanBoard: '[data-tour="kanban-board"]',
  kanbanMobile: '[data-tour="kanban"]',
  monthCalendar: '[data-tour="month-calendar-view"]',
  aiScheduler: '[data-tour-header-actions="desktop"] [data-tour="ai-scheduler"]',
  aiSchedulePreview: '[data-tour="dashboard-ai-schedule-preview-dialog"]',
  aiSchedulePreviewMobile: '[data-tour="ai-schedule-preview-dialog"]',
  aiReschedule: '[data-tour-header-actions="desktop"] [data-tour="re-schedule"]',
  rescheduleDialog: '[data-tour="reschedule-dialog"]',
  rescheduleDialogOptions: '[data-tour="dashboard-reschedule-dialog-options"]',
  aiRecommendationsPanel: '[data-tour="ai-recommendations-panel"]',
  aiSchedulerSection: '[data-tour="ai-scheduler-section"]',
  aiRescheduleSection: '[data-tour="ai-reschedule-section"]',
  settingsPanel: '[data-tour="settings-panel"]',
} as const;

/** Prefer a visible match when duplicate tour nodes exist (e.g. hidden mobile header copies). */
export function queryVisibleTourTarget(selector: string): HTMLElement | null {
  const nodes = document.querySelectorAll(selector);
  for (const node of nodes) {
    if (!(node instanceof HTMLElement)) continue;
    if (!isElementVisibleForTour(node)) continue;
    return node;
  }
  return null;
}

function isElementVisibleForTour(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
    return false;
  }
  if (el.getAttribute('data-slot') === 'dialog-content') {
    const state = el.getAttribute('data-state');
    if (state != null && state !== 'open') return false;
  }
  const rect = el.getBoundingClientRect();
  if (rect.width <= 4 || rect.height <= 4 || rect.bottom <= 0 || rect.right <= 0) {
    return false;
  }
  if (el.getAttribute('data-slot') === 'dialog-content' && (rect.width < 80 || rect.height < 80)) {
    return false;
  }
  let parent: HTMLElement | null = el.parentElement;
  while (parent) {
    const parentStyle = window.getComputedStyle(parent);
    if (parentStyle.display === 'none') return false;
    if (parent.getAttribute('data-state') === 'closed') return false;
    if (parent.getAttribute('aria-hidden') === 'true') return false;
    parent = parent.parentElement;
  }
  return true;
}

/** Dev helper: verify every tour step resolves to a visible DOM node on the current layout. */
export function auditTourTargets(isMobile: boolean): Array<{ stepKey: string; target: string; ok: boolean }> {
  return buildAppTourStepDefs(isMobile).map((step) => ({
    stepKey: step.stepKey,
    target: step.target,
    ok: step.target === APP_TOUR_TARGETS.body || queryVisibleTourTarget(step.target) !== null,
  }));
}

export const APP_TOUR_STEP_KEYS = {
  welcome: 'welcome',
  navIntro: 'navIntro',
  navIcon: 'navIcon',
  weekView: 'weekView',
  weekMonthToggle: 'weekMonthToggle',
  monthView: 'monthView',
  aiSchedulerButton: 'aiSchedulerButton',
  aiSchedulePreview: 'aiSchedulePreview',
  aiReschedulerButton: 'aiReschedulerButton',
  rescheduleDialog: 'rescheduleDialog',
  settingsIntro: 'settingsIntro',
  settingsSection: 'settingsSection',
  complete: 'complete',
} as const;

export type AppTourStepKey = keyof typeof APP_TOUR_STEP_KEYS;

export type AppTourStepMeta = {
  stepKey: AppTourStepKey;
  target: string;
  navId?: string;
  settingsId?: string;
  desktopOnly?: boolean;
  mobileOnly?: boolean;
  placement?: 'center' | 'auto' | 'bottom' | 'bottom-end' | 'bottom-start' | 'top' | 'left' | 'right';
  /** Fixed header targets need isFixed so Joyride positions the spotlight correctly. */
  isFixed?: boolean;
  disableBeacon?: boolean;
};

export function buildAppTourStepDefs(isMobile: boolean): AppTourStepMeta[] {
  const steps: AppTourStepMeta[] = [
    {
      stepKey: APP_TOUR_STEP_KEYS.welcome,
      target: APP_TOUR_TARGETS.body,
      placement: 'center',
      disableBeacon: true,
    },
  ];

  if (isMobile) {
    steps.push({
      stepKey: APP_TOUR_STEP_KEYS.navIntro,
      target: APP_TOUR_TARGETS.bottomNav,
      placement: 'top',
      mobileOnly: true,
    });
    for (const item of APP_TOUR_BOTTOM_NAV_ITEMS) {
      steps.push({
        stepKey: APP_TOUR_STEP_KEYS.navIcon,
        target: bottomNavTarget(item.id),
        navId: item.id,
        placement: 'top',
        mobileOnly: true,
      });
    }
  } else {
    steps.push({
      stepKey: APP_TOUR_STEP_KEYS.navIntro,
      target: APP_TOUR_TARGETS.sidebar,
      placement: 'right',
      desktopOnly: true,
    });
    for (const item of APP_TOUR_SIDEBAR_ITEMS) {
      steps.push({
        stepKey: APP_TOUR_STEP_KEYS.navIcon,
        target: sidebarNavTarget(item.id),
        navId: item.id,
        placement: 'right',
        desktopOnly: true,
      });
    }
  }

  steps.push(
    {
      stepKey: APP_TOUR_STEP_KEYS.weekView,
      target: isMobile ? APP_TOUR_TARGETS.kanbanMobile : APP_TOUR_TARGETS.kanbanBoard,
      placement: 'top',
    },
    {
      stepKey: APP_TOUR_STEP_KEYS.aiSchedulerButton,
      target: isMobile ? APP_TOUR_TARGETS.aiSchedulerSection : APP_TOUR_TARGETS.aiScheduler,
      placement: isMobile ? 'top' : 'bottom-start',
      isFixed: !isMobile,
    },
    {
      stepKey: APP_TOUR_STEP_KEYS.aiSchedulePreview,
      target: isMobile ? APP_TOUR_TARGETS.aiSchedulePreviewMobile : APP_TOUR_TARGETS.aiSchedulePreview,
      placement: 'auto',
    },
    {
      stepKey: APP_TOUR_STEP_KEYS.weekMonthToggle,
      target: APP_TOUR_TARGETS.weekMonthToggle,
      placement: 'bottom-start',
      isFixed: true,
      desktopOnly: true,
    },
    {
      stepKey: APP_TOUR_STEP_KEYS.monthView,
      target: APP_TOUR_TARGETS.monthCalendar,
      placement: 'top',
    },
    {
      stepKey: APP_TOUR_STEP_KEYS.aiReschedulerButton,
      target: isMobile ? APP_TOUR_TARGETS.aiRescheduleSection : APP_TOUR_TARGETS.aiReschedule,
      placement: isMobile ? 'top' : 'bottom-start',
      isFixed: !isMobile,
    },
    {
      stepKey: APP_TOUR_STEP_KEYS.rescheduleDialog,
      target: APP_TOUR_TARGETS.rescheduleDialog,
      placement: 'auto',
    },
    {
      stepKey: APP_TOUR_STEP_KEYS.settingsIntro,
      target: APP_TOUR_TARGETS.settingsPanel,
      placement: isMobile ? 'top' : 'left',
    },
  );

  for (const section of APP_TOUR_SETTINGS_SECTIONS) {
    steps.push({
      stepKey: APP_TOUR_STEP_KEYS.settingsSection,
      target: settingsSectionTarget(section.id),
      settingsId: section.id,
      placement: isMobile ? 'top' : 'left',
    });
  }

  steps.push({
    stepKey: APP_TOUR_STEP_KEYS.complete,
    target: APP_TOUR_TARGETS.body,
    placement: 'center',
    disableBeacon: true,
  });

  return steps.filter((step) => {
    if (isMobile && step.desktopOnly) return false;
    if (!isMobile && step.mobileOnly) return false;
    return true;
  });
}

export function getNavIconCopy(
  navId: string,
  isMobile: boolean,
): { label: string; description: string } | null {
  const items = isMobile ? APP_TOUR_BOTTOM_NAV_ITEMS : APP_TOUR_SIDEBAR_ITEMS;
  const item = items.find((entry) => entry.id === navId);
  return item ? { label: item.label, description: item.description } : null;
}

export function getSettingsSectionCopy(settingsId: string) {
  return APP_TOUR_SETTINGS_SECTIONS.find((section) => section.id === settingsId) ?? null;
}

const TOUR_DIALOG_STEP_KEYS = new Set<AppTourStepKey>([
  APP_TOUR_STEP_KEYS.aiSchedulePreview,
  APP_TOUR_STEP_KEYS.rescheduleDialog,
]);

export function isAppTourDialogStep(meta: AppTourStepMeta | undefined): boolean {
  return meta != null && TOUR_DIALOG_STEP_KEYS.has(meta.stepKey);
}

/** Sample rows for the schedule-preview dialog during the tour (no AI run). */
export const APP_TOUR_DEMO_SCHEDULE_TASKS = [
  {
    id: 'tour-demo-schedule-1',
    title: 'Review project proposal',
    priority: 'high' as const,
    reason: 'Fits your Work hours tomorrow morning',
  },
  {
    id: 'tour-demo-schedule-2',
    title: 'Prepare team standup notes',
    priority: 'medium' as const,
    reason: 'Short task before your first meeting',
  },
] as const;

const TOUR_LAZY_PANEL_STEP_KEYS = new Set<AppTourStepKey>([
  APP_TOUR_STEP_KEYS.settingsIntro,
  APP_TOUR_STEP_KEYS.settingsSection,
]);

export function getTourStepWaitTimeoutMs(
  meta: AppTourStepMeta | undefined,
  highlightDelayMs: number = TIMING_CONSTANTS.tour.highlightDelay,
): number {
  if (!meta) {
    return highlightDelayMs * TIMING_CONSTANTS.tour.targetWait.defaultMultiplier;
  }
  if (TOUR_DIALOG_STEP_KEYS.has(meta.stepKey)) {
    return highlightDelayMs * TIMING_CONSTANTS.tour.targetWait.dialogMultiplier;
  }
  if (TOUR_LAZY_PANEL_STEP_KEYS.has(meta.stepKey)) {
    return highlightDelayMs * TIMING_CONSTANTS.tour.targetWait.lazyPanelMultiplier;
  }
  if (meta.stepKey === APP_TOUR_STEP_KEYS.monthView) {
    return highlightDelayMs * TIMING_CONSTANTS.tour.targetWait.viewSwitchMultiplier;
  }
  if (meta.isFixed) {
    return highlightDelayMs * TIMING_CONSTANTS.tour.targetWait.viewSwitchMultiplier;
  }
  return highlightDelayMs * TIMING_CONSTANTS.tour.targetWait.defaultMultiplier;
}

const TOUR_DASHBOARD_PREP_STEP_KEYS = new Set<AppTourStepKey>([
  APP_TOUR_STEP_KEYS.weekView,
  APP_TOUR_STEP_KEYS.aiSchedulerButton,
  APP_TOUR_STEP_KEYS.weekMonthToggle,
  APP_TOUR_STEP_KEYS.aiReschedulerButton,
]);

export function getTourStepAdvanceDelayMs(meta: AppTourStepMeta | undefined): number {
  if (!meta) return 0;
  const { navigationComplete, advanceExtra } = TIMING_CONSTANTS.tour;
  if (meta.isFixed) {
    return navigationComplete + advanceExtra.fixedHeaderMs;
  }
  if (TOUR_DIALOG_STEP_KEYS.has(meta.stepKey)) {
    return navigationComplete + advanceExtra.dialogMs;
  }
  if (TOUR_LAZY_PANEL_STEP_KEYS.has(meta.stepKey)) {
    return navigationComplete + advanceExtra.lazyPanelMs;
  }
  if (meta.stepKey === APP_TOUR_STEP_KEYS.monthView) {
    return navigationComplete + advanceExtra.viewSwitchMs;
  }
  if (TOUR_DASHBOARD_PREP_STEP_KEYS.has(meta.stepKey)) {
    return navigationComplete;
  }
  return 0;
}
