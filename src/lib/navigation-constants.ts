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
  ai: 'Scheduler',
  timeline: 'Timeline',
  calendar: 'Calendar',
  aiPlan: 'Schedule',
} as const;

export const AI_PANEL_OPEN_EVENT = 'taskzm-open-ai';
/** Focus the planner chat composer (desktop chat column). */
export const PLANNER_COMPOSER_FOCUS_EVENT = 'taskzm-planner-focus';

export const AI_PANEL_UI_TEXT = {
  sheetDescription: 'Auto-schedule new tasks or re-plan existing ones.',
  prompt: 'What should the scheduler do?',
  schedule: {
    title: 'Schedule new tasks',
    description: (count: number) =>
      `${count} open task${count === 1 ? '' : 's'} without a time. The scheduler finds a slot for each one.`,
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
    `Auto scheduling is off. Turn it on in Settings to plan your ${count} open task${count === 1 ? '' : 's'}.`,
  footnote: 'The scheduler uses priority, due dates, your working hours, and calendar events.',
  periods: { day: 'Today', week: 'Week', twoWeeks: '2 weeks', month: 'Month' },
  rescheduleRanges: { day: 'A day', week: 'A week', month: 'A month' },
} as const;

export const SCHEDULE_RESULT_UI_TEXT = {
  title: (count: number) =>
    count > 0 ? `Scheduled ${count} task${count === 1 ? '' : 's'}` : 'No tasks could be scheduled',
  description: 'Times follow your category hours, daily hour limit, and calendar events.',
  unscheduledHeading: (count: number) => `${count} task${count === 1 ? '' : 's'} still need a time`,
  reasons: {
    dailyLimit: (hours: number) => `Adding it would go over your ${hours}h daily limit on every allowed day.`,
    noCategorySlot: (category: string | null) =>
      category
        ? `No free time inside ${category} hours on the days allowed for ${category} tasks.`
        : 'No free time on any day in the next two weeks.',
  },
  fixHint: 'To fit more, raise the daily hour limit or widen category hours in Settings, or schedule these by hand.',
  done: 'Done',
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
  aiPro: 'Auto Scheduling is a Pro feature',
  aiDisabled: 'Auto Scheduling is disabled',
  aiDisabledDetail: 'Enable auto scheduling in Settings to use this feature.',
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
    planWithAi: 'Auto-schedule',
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
    title: 'Auto Scheduler',
    plannerName: 'Auto Scheduler',
    you: 'You',
    reschedule: 'Reschedule',
    rescheduleOptions: {
      day: { label: 'Day', hint: "Optimize today's blocks" },
      week: { label: 'Week', hint: 'Balance this week' },
      month: { label: 'Month', hint: 'Balance the next 4 weeks' },
    } as Record<PlannerRescheduleRange, { label: string; hint: string }>,
    emptyTitle: 'What do you need to get done?',
    emptyHint:
      'Describe what you need to do, update a task ("push the report to Friday"), or plan a bigger project.',
    suggestions: [
      'What is on today?',
      'Schedule my inbox',
      'Rebalance my week',
    ],
    openTask: 'Open task',
    draftsTitle: 'Draft tasks to confirm',
    draftSubtasks: 'Subtasks',
    accept: 'Accept',
    skip: 'Skip',
    acceptAll: 'Accept all',
    skipAll: 'Skip all',
    composerPlaceholder: 'Add tasks or ask the planner…',
    addContext: 'Idea & Suggestive Tasks Dropbox',
    contextHint: 'Paste raw notes, an email, or everything on your mind. The planner pulls out the real action items, keeps facts as details on the task they belong to, groups steps into subtasks, and skips anything already on your list. Nothing is saved until you accept it.',
    contextPlaceholder: 'Notes, an email, or everything on your mind…',
    analyzeContext: 'Turn into tasks',
    send: 'Send',
    voiceStart: 'Dictate',
    voiceStop: 'Stop dictation',
    footer: 'On-device planner',
    footerEnhanced: 'Enhanced AI planner',
    thinking: 'Planning…',
    clear: 'Clear chat',
    dueOn: (day: string) => `Due ${day}`,
    estimate: (minutes: number) =>
      minutes >= MINUTES_PER_HOUR ? `${Number((minutes / MINUTES_PER_HOUR).toFixed(1))}h` : `${minutes}m`,
  },
  replies: {
    drafted: (count: number, withSteps = 0) =>
      [
        count === 1
          ? "I drafted 1 task. Accept it and I'll find it a time."
          : `I drafted ${plural(count, 'task')}. Accept the ones you want and I'll find each a time.`,
        withSteps === 0
          ? ''
          : count === 1
            ? 'It was big, so I broke it into subtasks.'
            : `${plural(withSteps, 'bigger task')} ${withSteps === 1 ? 'is' : 'are'} broken into subtasks.`,
      ]
        .filter(Boolean)
        .join(' '),
    nothingFound: "I couldn't find any tasks in that. Try one task per line.",
    smallTalk: 'I\'m here. Tell me what you need to get done, or ask me to change a task, like "move the report to Friday" or "I finished the invoice".',
    contextOnly:
      "That reads like context rather than a task, so I didn't add anything. Tell me what you want to do about it, or paste your notes into the Idea & Suggestive Tasks Dropbox and I'll pull out the tasks.",
    skippedContext: (count: number) => `I left out ${plural(count, 'line')} that read like context, not tasks.`,
    alreadyOnList: (title: string) => `"${title}" is already on your list, so I didn't add it again.`,
    projectScope: (title: string, kind: 'build' | 'event' | 'launch' | 'move' | 'general') =>
      `Let's plan "${title}". ${
        kind === 'build'
          ? 'What pages, features or parts does it need?'
          : kind === 'event'
            ? 'What needs sorting out: venue, guests, travel, food, anything else?'
            : kind === 'launch'
              ? 'What are you launching, and what has to be ready before it goes out?'
              : kind === 'move'
                ? 'Which rooms or areas are involved, and is anyone helping?'
                : 'What are the main pieces of work or deliverables?'
      } List them and I'll make each one a subtask, or say "suggest" and I'll use typical steps.`,
    projectScopeAgain: 'List the steps separated by commas or new lines, say "suggest" for typical steps, or "cancel" to stop.',
    projectDeadline: (title: string) => `When does "${title}" need to be done? Give me a date like "Nov 15" or "next Friday", or say "no deadline".`,
    projectDeadlineAgain: 'I didn\'t catch a date. Try "Nov 15", "next Friday" or "in 10 days", or say "no deadline".',
    projectReady: (title: string, steps: number) =>
      `Here's "${title}" with ${plural(steps, 'subtask')}. Accept it below and I'll find it time before the deadline.`,
    projectCancelled: "Okay, I've dropped that plan.",
    taskSteps: (title: string) =>
      `"${title}" doesn't match a plan I know. What are the steps? List them and I'll add them as subtasks, or say "suggest" for general project steps.`,
    notesAdded: (title: string) => `Added that note to "${title}".`,
    enhancedUnavailable: "Enhanced AI isn't reachable right now, so I used the on-device planner.",
    brainDump: ({ tasks, withSteps, notes, duplicates, details = 0 }: { tasks: number; withSteps: number; notes: number; duplicates: number; details?: number }) =>
      [
        tasks === 0
          ? "I couldn't find tasks in that. Try listing actions, like \"Email Sam about the invoice\"."
          : `I turned that into ${plural(tasks, 'clean task')}.`,
        withSteps === 0
          ? ''
          : withSteps === 1
            ? '1 bigger task is broken into subtasks.'
            : `${withSteps} bigger tasks are broken into subtasks.`,
        details === 0 ? '' : `I kept ${plural(details, 'fact')} from your notes as ${details === 1 ? 'a detail' : 'details'} on the matching task.`,
        notes === 0 ? '' : `I left out ${plural(notes, 'line')} that read like notes, not tasks.`,
        duplicates === 0 ? '' : `${plural(duplicates, 'task')} ${duplicates === 1 ? 'was' : 'were'} already on your list, so I skipped ${duplicates === 1 ? 'it' : 'them'}.`,
        tasks === 0 ? '' : "Review the drafts below and accept the ones you want. I'll find each a time.",
      ]
        .filter(Boolean)
        .join(' '),
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
    aiUnavailable: 'Auto scheduling is off or not on your plan, so new tasks go to the Inbox.',
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
    brokenDown: (steps: string[], title: string) =>
      `Broke "${title}" into ${plural(steps.length, 'subtask')}: ${steps.join(', ')}.`,
    noBreakdown: (title: string) =>
      `"${title}" reads like a single step. To split it, list the steps: "break ${title} into step one, step two".`,
    alreadyBrokenDown: (title: string) => `"${title}" already has those subtasks.`,
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
  settings: {
    enhancedTitle: 'Enhanced AI planner',
    enhancedDescription:
      'Use a cloud AI model to understand planner messages and brain dumps. When on, what you type there, plus the titles, dates and subtasks of your open tasks, is sent to our AI provider (currently Groq) to work out what you mean. Off by default.',
    enhancedNotConfigured: 'Not available on this server yet.',
  },
} as const;
