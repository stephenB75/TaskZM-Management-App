import { MINUTES_PER_HOUR } from './business-constants';
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
  timeline: 'Timeline',
  calendar: 'Calendar',
  aiPlan: 'AI plan',
} as const;

export const AI_PANEL_OPEN_EVENT = 'taskzm-open-ai';
/** Focus the planner chat composer (desktop chat column). */
export const PLANNER_COMPOSER_FOCUS_EVENT = 'taskzm-planner-focus';

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

export type PlannerRescheduleRange = 'day' | 'week' | 'month';

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

/** Copy for the AI-first planner (timeline, calendar, and chat columns). */
export const PLANNER_UI_TEXT = {
  timeline: {
    eyebrow: 'My workspace',
    title: 'Upcoming',
    upNext: 'Up next',
    nothingNext: 'Nothing scheduled next',
    nothingNextHint: 'Tell the planner what you need to do.',
    thisWeek: 'This week',
    nextWeek: 'Next week',
    inWeeks: (weeks: number) => `In ${weeks} weeks`,
    needsTime: 'Needs a time',
    overdue: 'Overdue',
    later: 'Later',
    planWithAi: 'Plan with AI',
    empty: 'Your timeline is clear.',
    markDone: (title: string) => `Mark "${title}" done`,
    markOpen: (title: string) => `Mark "${title}" not done`,
  },
  calendar: {
    eyebrowWeek: 'This week',
    eyebrowMonth: '30-day focus',
    previous: 'Previous',
    next: 'Next',
    today: 'Today',
    week: 'Week',
    month: 'Month',
    agendaEyebrow: (isToday: boolean) => (isToday ? 'Today' : 'Agenda'),
    taskCount: (count: number) => plural(count, 'item'),
    emptyTitle: 'Nothing planned',
    emptyHint: 'Ask the planner to fill this day.',
  },
  chat: {
    eyebrow: 'Smart inbox',
    title: 'Plan with AI',
    plannerName: 'Planner AI',
    you: 'You',
    reschedule: 'Reschedule',
    rescheduleOptions: {
      day: { label: 'Day', hint: "Optimize today's blocks" },
      week: { label: 'Week', hint: 'Balance this week' },
      month: { label: 'Month', hint: 'Balance the next 4 weeks' },
    } as Record<PlannerRescheduleRange, { label: string; hint: string }>,
    emptyTitle: 'What do you need to get done?',
    emptyHint:
      'Type or dictate tasks, one per line. The planner estimates each one and finds a time. You can also ask it to move, rename, tag, assign, duplicate, break down, or focus on a task.',
    suggestions: [
      'What is on today?',
      'Schedule my inbox',
      'Rebalance my week',
    ],
    openTask: 'Open task',
    draftsTitle: 'Draft tasks to confirm',
    accept: 'Accept',
    skip: 'Skip',
    acceptAll: 'Accept all',
    skipAll: 'Skip all',
    composerPlaceholder: 'Add tasks or ask the planner…',
    addContext: 'Add context',
    contextPlaceholder: 'Paste notes, an email, or a brain dump…',
    analyzeContext: 'Analyze context',
    send: 'Send',
    voiceStart: 'Dictate',
    voiceStop: 'Stop dictation',
    footer: 'Planner agent · AI scheduling',
    thinking: 'Planning…',
    clear: 'Clear chat',
    estimate: (minutes: number) =>
      minutes >= MINUTES_PER_HOUR ? `${Number((minutes / MINUTES_PER_HOUR).toFixed(1))}h` : `${minutes}m`,
  },
  replies: {
    drafted: (count: number) =>
      count === 1
        ? "I drafted 1 task. Accept it and I'll find it a time."
        : `I drafted ${plural(count, 'task')}. Accept the ones you want and I'll find each a time.`,
    nothingFound: "I couldn't find any tasks in that. Try one task per line.",
    scheduledOne: (title: string, when: string) => `Booked "${title}" for ${when}.`,
    addedToInbox: (title: string) => `Added "${title}" to your Inbox. It needs a time.`,
    scheduledMany: (count: number) => `Booked ${plural(count, 'task')} into open slots.`,
    unplaced: (count: number) =>
      `${plural(count, 'task')} didn't fit inside your daily hours and stayed in the Inbox.`,
    inboxEmpty: 'Every open task already has a time.',
    rescheduled: (count: number, range: PlannerRescheduleRange) =>
      `Rebalanced ${plural(count, 'task')} across the ${range === 'day' ? 'day' : range === 'week' ? 'week' : 'month'}.`,
    nothingToReschedule: (range: PlannerRescheduleRange) =>
      `There's nothing scheduled this ${range} to move.`,
    aiUnavailable: 'AI scheduling is off or not on your plan, so new tasks go to the Inbox.',
    failed: 'Something went wrong while planning. Please try again.',
    taskNotFound: (ref: string) => `I couldn't find a task matching "${ref}".`,
    noTaskInFocus: 'Which task? Tell me its name.',
    ambiguous: (titles: string[]) => `Which one did you mean: ${titles.map((title) => `"${title}"`).join(', ')}?`,
    noPermission: "You don't have permission to edit tasks here.",
    found: (parts: { title: string; when: string | null; details: string[] }) =>
      [`Found "${parts.title}".`, parts.when ? `It's planned for ${parts.when}.` : 'It needs a time.', parts.details.join(' · ')]
        .filter(Boolean)
        .join(' '),
    pomodoroStarted: (title: string, minutes: number) => `Focus timer started for "${title}" (${minutes} min).`,
    pomodoroUnavailable: 'The focus timer is not on your plan.',
    pomodoroDone: (title: string) => `"${title}" is already done. Reopen it first to focus on it.`,
    subtasksAdded: (count: number, title: string) => `Added ${plural(count, 'subtask')} to "${title}".`,
    tagsAdded: (tags: string[], title: string) => `Tagged "${title}" with ${tags.map((tag) => `#${tag}`).join(', ')}.`,
    tagsCreated: (tags: string[]) => `Created ${tags.map((tag) => `#${tag}`).join(', ')}.`,
    tagsExist: (tags: string[]) => `${tags.map((tag) => `#${tag}`).join(', ')} already exist.`,
    assigned: (title: string, name: string) => `Assigned "${title}" to ${name}.`,
    alreadyAssigned: (title: string, name: string) => `"${title}" is already assigned to ${name}.`,
    memberNotFound: (name: string) => `I couldn't find a team member called "${name}".`,
    noTeam: 'Add people in Team first, then I can assign tasks to them.',
    duplicated: (title: string, when: string | null) =>
      when ? `Duplicated "${title}" and booked the copy for ${when}.` : `Duplicated "${title}". The copy is in your Inbox.`,
    unscheduled: (title: string) => `Moved "${title}" back to the Inbox.`,
    renamed: (from: string, to: string) => `Renamed "${from}" to "${to}".`,
    durationSet: (title: string, estimate: string) => `"${title}" now takes ${estimate}.`,
    prioritySet: (title: string, priority: string) => `Set "${title}" to ${priority} priority.`,
    completed: (title: string) => `Marked "${title}" done.`,
    alreadyDone: (title: string) => `"${title}" is already done.`,
    moved: (title: string, when: string) => `Moved "${title}" to ${when}.`,
    overlaps: (title: string) => `Heads up: that overlaps "${title}".`,
    noSlotThatDay: (title: string, day: string) =>
      `There's no open time for "${title}" on ${day} within your hours. Give me a time, like "${day} 4pm".`,
    summary: (parts: { today: number; next: string | null; inbox: number; weekHours: number }) =>
      [
        parts.today === 0 ? 'Nothing is scheduled for today.' : `You have ${plural(parts.today, 'task')} today.`,
        parts.next ? `Up next: ${parts.next}.` : '',
        parts.inbox > 0 ? `${plural(parts.inbox, 'task')} in the Inbox still need a time.` : 'Your Inbox is clear.',
        `About ${parts.weekHours}h planned this week.`,
      ].filter(Boolean).join(' '),
  },
} as const;
