/**
 * App Tour copy and step metadata.
 * Used by AppTour.tsx — keep strings here, not inline in components.
 */

import { NAVIGATION_UI_TEXT } from './navigation-constants';
import { SETTINGS_PANEL_UI_TEXT } from './settings-panel-constants';
import { DASHBOARD_VIEW_HEADER_LABELS, TOUR_CONSTANTS } from './layout-constants';
import { TIMING_CONSTANTS } from './timing-constants';

/** Sidebar icon tour stops (desktop) — order matches AppSidebar menuItems. */
export const APP_TOUR_SIDEBAR_ITEMS = [
  {
    id: 'today',
    label: NAVIGATION_UI_TEXT.today,
    description:
      'Your day at a glance — counts, the next thing to do, and tasks with calendar events in time order.',
  },
  {
    id: 'dashboard',
    label: NAVIGATION_UI_TEXT.week,
    description:
      'The 7-day board. Drag tasks between days to reschedule; calendar events show alongside them.',
  },
  {
    id: 'notifications',
    label: NAVIGATION_UI_TEXT.notifications,
    description:
      'Due-soon, overdue, and system alerts. Badge counts show how many need attention.',
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
    description: 'Your day — tasks and calendar events in time order, with what is up next.',
  },
  {
    id: 'week',
    label: NAVIGATION_UI_TEXT.week,
    description: 'The 7-day board. Pick a day to see its tasks and events.',
  },
  {
    id: 'inbox',
    label: NAVIGATION_UI_TEXT.inbox,
    description: 'Tasks without a time yet, ready for AI scheduling or manual planning.',
  },
  {
    id: 'ai',
    label: NAVIGATION_UI_TEXT.ai,
    description: 'AI scheduling and rescheduling suggestions. Settings now live in the menu.',
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
      'A quick look at navigation, your Today list, the Week board, AI scheduling, and key settings.',
  },
  headerBell: {
    title: 'Notifications',
    description: 'Tap the bell to open your notifications. The badge shows how many need attention.',
  },
  todayAgenda: {
    title: 'Today',
    description: 'Tasks and calendar events for today, in time order. The first one is marked Up next.',
    bullets: [
      'Swipe a task right to mark it done',
      'Tap a task to edit it',
      'Items tagged Calendar come from your connected calendars',
    ] as const,
  },
  placeTasks: {
    title: 'Place open tasks',
    description: 'Gives a time to tasks that are not on the calendar yet, around your hours and calendar events.',
  },
  sidebarIconIntro: {
    title: 'Sidebar Icons',
    description: 'Each icon opens a different part of TaskZM. We’ll highlight them one by one.',
  },
  bottomNavIntro: {
    title: 'Bottom Navigation',
    description: 'Each tab opens a different part of TaskZM. We’ll highlight them one by one.',
  },
  weekView: {
    title: 'Week',
    description:
      'Seven days of tasks and calendar events. Move between weeks or jump back to today.',
    bullets: [
      'Drag tasks between days to reschedule',
      'Tap a card to edit details and subtasks',
      'Calendar events are read-only and tagged Calendar',
    ] as const,
  },
  aiSchedulerButton: {
    title: DASHBOARD_VIEW_HEADER_LABELS.aiSchedulerSuggestionsLong,
    description:
      'Places unscheduled Inbox tasks into open slots using priority, due dates, your hours, and calendar conflicts.',
    hint: 'You don’t need to click this button now — the next step opens an example preview automatically.',
  },
  aiSchedulePreview: {
    title: 'Schedule Preview Dialog',
    description:
      'After AI Scheduler runs, this dialog lets you review suggestions before anything is saved. Below is an example.',
    bullets: [
      'Each row shows a task, suggested time, and reason',
      'In the real app you select which suggestions to keep',
      'Use Next on the tour to continue — nothing is applied here',
    ] as const,
  },
  aiReschedulerButton: {
    title: DASHBOARD_VIEW_HEADER_LABELS.reschedule,
    description:
      'Re-Schedule reshuffles tasks that already have dates into new open slots when plans change.',
    hint: 'You don’t need to click this button now — the next step opens an example dialog automatically.',
  },
  rescheduleDialog: {
    title: 'Re-Schedule Dialog',
    description:
      'Choose Day, Week, or Month and a target date, then confirm to run AI again on those tasks. An example is shown below.',
    bullets: [
      'Day — move tasks from specific date(s)',
      'Week — redistribute an entire week',
      'Month — rebalance across a month',
      'Use Next on the tour to continue — no confirmation needed here',
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
      'You’ve seen navigation, Today, the Week board, AI scheduling, and settings. Click Get Started to begin.',
  },
} as const;

/** In-dialog notice while the app tour shows AI scheduler / re-scheduler examples. */
export const APP_TOUR_DEMO_UI = {
  dialogNotice: 'Example preview only — click Next on the tour to continue. Nothing is saved or changed.',
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
  headerBell: '[data-tour="header-notifications"]',
  homeAgenda: '[data-tour="home-agenda"]',
  placeTasks: '[data-tour="place-tasks"]',
  weekBoard: '[data-tour="week-board"]',
  aiSchedulePreview: '[data-tour="ai-schedule-preview-dialog"]',
  rescheduleDialog: '[data-tour="reschedule-dialog"]',
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

/** Scroll a settings accordion target into view with room for the tour tooltip above or below. */
export function scrollSettingsTourTargetIntoView(
  target: string,
  delayMs: number = TIMING_CONSTANTS.tour.navigationComplete,
): void {
  window.setTimeout(() => {
    const el = queryVisibleTourTarget(target);
    if (!el) return;

    const container = document.querySelector(APP_TOUR_TARGETS.settingsPanel);
    const clearance = TOUR_CONSTANTS.tooltip.footerReservePx;
    const edgePadding = TOUR_CONSTANTS.floater.settingsViewportPadding;

    const ensureTooltipClearance = () => {
      const rect = el.getBoundingClientRect();
      const viewportBottom = window.innerHeight - edgePadding;
      const viewportTop = edgePadding;

      const spaceBelow = viewportBottom - rect.bottom;
      if (spaceBelow < clearance && container instanceof HTMLElement) {
        container.scrollTop += clearance - spaceBelow;
        return;
      }

      const spaceAbove = rect.top - viewportTop;
      if (spaceAbove < clearance && container instanceof HTMLElement) {
        container.scrollTop -= clearance - spaceAbove;
      }
    };

    if (!(container instanceof HTMLElement)) {
      el.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
      window.requestAnimationFrame(ensureTooltipClearance);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const visibleTop = Math.max(containerRect.top, 0);
    const visibleBottom = Math.min(containerRect.bottom, window.innerHeight);
    const visibleMid = (visibleTop + visibleBottom) / 2;
    const elRect = el.getBoundingClientRect();
    const elMid = elRect.top + elRect.height / 2;

    container.scrollTop += elMid - visibleMid;
    window.requestAnimationFrame(() => {
      ensureTooltipClearance();
      window.requestAnimationFrame(ensureTooltipClearance);
    });
  }, delayMs);
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
  headerBell: 'headerBell',
  todayAgenda: 'todayAgenda',
  placeTasks: 'placeTasks',
  weekView: 'weekView',
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
      stepKey: APP_TOUR_STEP_KEYS.headerBell,
      target: APP_TOUR_TARGETS.headerBell,
      placement: 'bottom-end',
      isFixed: true,
      mobileOnly: true,
    },
    {
      stepKey: APP_TOUR_STEP_KEYS.todayAgenda,
      target: APP_TOUR_TARGETS.homeAgenda,
      placement: 'top',
    },
    {
      stepKey: APP_TOUR_STEP_KEYS.placeTasks,
      target: APP_TOUR_TARGETS.placeTasks,
      placement: 'bottom',
    },
    {
      stepKey: APP_TOUR_STEP_KEYS.weekView,
      target: APP_TOUR_TARGETS.weekBoard,
      placement: 'top',
    },
    {
      stepKey: APP_TOUR_STEP_KEYS.aiSchedulerButton,
      target: APP_TOUR_TARGETS.aiSchedulerSection,
      placement: isMobile ? 'top' : 'left',
    },
    {
      stepKey: APP_TOUR_STEP_KEYS.aiSchedulePreview,
      target: APP_TOUR_TARGETS.aiSchedulePreview,
      placement: 'auto',
    },
    {
      stepKey: APP_TOUR_STEP_KEYS.aiReschedulerButton,
      target: APP_TOUR_TARGETS.aiRescheduleSection,
      placement: isMobile ? 'top' : 'left',
    },
    {
      stepKey: APP_TOUR_STEP_KEYS.rescheduleDialog,
      target: APP_TOUR_TARGETS.rescheduleDialog,
      placement: 'auto',
    },
    {
      stepKey: APP_TOUR_STEP_KEYS.settingsIntro,
      target: APP_TOUR_TARGETS.settingsPanel,
      placement: 'auto',
    },
  );

  for (const section of APP_TOUR_SETTINGS_SECTIONS) {
    steps.push({
      stepKey: APP_TOUR_STEP_KEYS.settingsSection,
      target: settingsSectionTarget(section.id),
      settingsId: section.id,
      placement: 'auto',
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
]);

export function isAppTourSettingsIntroStep(meta: AppTourStepMeta | undefined): boolean {
  return meta?.stepKey === APP_TOUR_STEP_KEYS.settingsIntro;
}

export function isAppTourSettingsSectionStep(meta: AppTourStepMeta | undefined): boolean {
  return meta?.stepKey === APP_TOUR_STEP_KEYS.settingsSection;
}

export function isAppTourSettingsStep(meta: AppTourStepMeta | undefined): boolean {
  return isAppTourSettingsIntroStep(meta) || isAppTourSettingsSectionStep(meta);
}

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
  if (isAppTourSettingsSectionStep(meta)) {
    return highlightDelayMs * TIMING_CONSTANTS.tour.targetWait.defaultMultiplier;
  }
  if (meta.stepKey === APP_TOUR_STEP_KEYS.weekView) {
    return highlightDelayMs * TIMING_CONSTANTS.tour.targetWait.viewSwitchMultiplier;
  }
  if (meta.isFixed) {
    return highlightDelayMs * TIMING_CONSTANTS.tour.targetWait.viewSwitchMultiplier;
  }
  return highlightDelayMs * TIMING_CONSTANTS.tour.targetWait.defaultMultiplier;
}

const TOUR_DASHBOARD_PREP_STEP_KEYS = new Set<AppTourStepKey>([
  APP_TOUR_STEP_KEYS.todayAgenda,
  APP_TOUR_STEP_KEYS.placeTasks,
  APP_TOUR_STEP_KEYS.weekView,
  APP_TOUR_STEP_KEYS.aiSchedulerButton,
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
  if (meta.stepKey === APP_TOUR_STEP_KEYS.weekView) {
    return navigationComplete + advanceExtra.viewSwitchMs;
  }
  if (TOUR_DASHBOARD_PREP_STEP_KEYS.has(meta.stepKey)) {
    return navigationComplete;
  }
  return 0;
}
