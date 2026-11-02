import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTasks } from './TaskContext';
import { useAI } from './AIContext';
import { useAuth } from './AuthContext';
import { useSubscription } from './SubscriptionContext';
import { usePomodoro } from './PomodoroContext';
import { useTeam } from './TeamContext';
import { usePermissions } from '../hooks/usePermissions';
import { useAIScheduler, type ScheduleResult } from '../hooks/useAIScheduler';
import { hasReachedLimit, incrementAIUsage } from '../lib/ai-scheduler-usage';
import { PLANNER_CHAT_CONFIG, PLANNER_ENHANCED_CONFIG, PLANNER_PROJECT_CONFIG } from '../lib/ai-config';
import { PLANNER_UI_TEXT, type PlannerRescheduleRange } from '../lib/navigation-constants';
import {
  detectPlannerIntent,
  draftToTask,
  endOfDay,
  estimateDraftMinutes,
  formatPlannedWhen,
  isProjectDraft,
  parseBrainDump,
  parseChatDrafts,
  parsePlannerDrafts,
  plannerScheduleWindow,
  plannerSummary,
  projectKind,
  startOfPlannerWeek,
  stripAssistantRequest,
  type PlannerCategory,
  type PlannerDraft,
} from '../lib/planner-chat';
import {
  findTaskByReference,
  findTeamMember,
  normalizeTag,
  parseDurationMinutes,
  parsePlannerCommand,
  parsePlannerWhen,
  splitList,
  type PlannerCommand,
} from '../lib/planner-commands';
import { getCategoryFromTags } from '../lib/ai-config';
import { cleanSteps, estimateWithSubtasks, suggestSubtasks, taskTitleKey } from '../lib/planner-analysis';
import { requestEnhancedPlanner, type EnhancedPlannerDraft, type EnhancedPlannerEdit } from '../lib/api';
import {
  MILLISECONDS_PER_MINUTE,
  POMODORO_WORK_DURATION,
  RECURRENCE_NONE_CONFIG,
  SECONDS_PER_MINUTE,
} from '../lib/business-constants';
import { generateId } from '../lib/utils';
import { DEFAULT_TASK_PRIORITY } from '../lib/task-constants';
import { logger } from '../lib/logger';
import type { Subtask, Task, TaskPriority } from '../types';

export interface PlannerMessage {
  id: string;
  role: 'user' | 'planner';
  text: string;
  createdAt: string;
  /** Task the reply is about, so the chat can offer to open it. */
  taskId?: string;
}

interface PlannerChatValue {
  messages: PlannerMessage[];
  drafts: PlannerDraft[];
  busy: boolean;
  send: (text: string) => Promise<void>;
  analyzeContext: (text: string) => void;
  acceptDraft: (id: string) => Promise<void>;
  skipDraft: (id: string) => void;
  acceptAll: () => Promise<void>;
  skipAll: () => void;
  scheduleInbox: () => Promise<void>;
  reschedule: (range: PlannerRescheduleRange) => Promise<void>;
  clear: () => void;
}

const PlannerChatContext = createContext<PlannerChatValue | null>(null);

/** A question the planner asked; the next reply answers it unless it reads like a new command. */
type PlannerPending =
  | { kind: 'projectScope'; draft: PlannerDraft; suggested: string[]; askDeadline: boolean }
  | { kind: 'projectDeadline'; draft: PlannerDraft }
  | { kind: 'taskSteps'; taskId: string };

interface StoredChat {
  messages: PlannerMessage[];
  drafts: PlannerDraft[];
  pending?: PlannerPending | null;
}

function readStoredChat(key: string): StoredChat {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { messages: [], drafts: [] };
    const parsed = JSON.parse(raw) as Partial<StoredChat>;
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      drafts: Array.isArray(parsed.drafts) ? parsed.drafts : [],
      pending: parsed.pending ?? null,
    };
  } catch {
    return { messages: [], drafts: [] };
  }
}

const PRIORITIES: readonly TaskPriority[] = ['low', 'medium', 'high', 'urgent'];
const CATEGORIES: readonly PlannerCategory[] = ['work', 'personal', 'projects'];

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function isOpenTask(task: Task): boolean {
  return task.status !== 'done';
}

/** A draft from the enhanced planner, checked and filled in with on-device defaults. */
function toPlannerDraft(raw: EnhancedPlannerDraft): PlannerDraft | null {
  const title = raw.title?.trim();
  if (!title || title.length < PLANNER_CHAT_CONFIG.minTitleLength) return null;
  const when = raw.when && !Number.isNaN(Date.parse(raw.when.date))
    ? { date: new Date(raw.when.date).toISOString(), hasTime: Boolean(raw.when.hasTime) }
    : undefined;
  const subtasks = cleanSteps(raw.subtasks ?? [], title);
  const draft: PlannerDraft = {
    id: generateId(),
    title,
    priority: PRIORITIES.includes(raw.priority as TaskPriority) ? (raw.priority as TaskPriority) : DEFAULT_TASK_PRIORITY,
    category: CATEGORIES.includes(raw.category as PlannerCategory) ? (raw.category as PlannerCategory) : null,
    estimatedMinutes: 0,
    ...(raw.notes ? { notes: raw.notes } : {}),
    ...(when ? { when } : {}),
    ...(subtasks.length > 0 ? { subtasks } : {}),
  };
  const { minEstimateMinutes, maxEstimateMinutes } = PLANNER_ENHANCED_CONFIG;
  const estimate = raw.estimatedMinutes ?? 0;
  draft.estimatedMinutes =
    estimate >= minEstimateMinutes && estimate <= maxEstimateMinutes ? estimate : estimateDraftMinutes(draft);
  return draft;
}

function listValue(value: EnhancedPlannerEdit['value']): string[] {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string' && item.trim().length > 0);
  return typeof value === 'string' ? splitList(value) : [];
}

/** An edit from the enhanced planner as a planner command on a known task. */
function editToCommand(edit: EnhancedPlannerEdit, task: Task): PlannerCommand | null {
  const ref = task.title;
  const text = typeof edit.value === 'string' ? edit.value.trim() : '';
  switch (edit.action) {
    case 'move': {
      if (!text) return null;
      if (/^\d{4}-\d{2}-\d{2}/.test(text) && !Number.isNaN(Date.parse(text))) {
        return { kind: 'move', ref, when: text, at: { date: new Date(text), hasTime: /T\d{2}:\d{2}/.test(text) } };
      }
      return { kind: 'move', ref, when: text };
    }
    case 'rename':
      return text ? { kind: 'rename', ref, title: text } : null;
    case 'priority':
      return PRIORITIES.includes(text.toLowerCase() as TaskPriority)
        ? { kind: 'priority', ref, priority: text.toLowerCase() as TaskPriority }
        : null;
    case 'duration': {
      const minutes = typeof edit.value === 'number' ? Math.round(edit.value) : parseDurationMinutes(text);
      return minutes && minutes > 0 ? { kind: 'duration', ref, minutes } : null;
    }
    case 'subtasks': {
      const items = listValue(edit.value);
      return items.length > 0 ? { kind: 'subtasks', ref, items } : null;
    }
    case 'tags': {
      const tags = listValue(edit.value);
      return tags.length > 0 ? { kind: 'tags', ref, tags } : null;
    }
    case 'notes':
      return text ? { kind: 'notes', ref, text } : null;
    case 'done':
      return { kind: 'done', ref, reported: true };
    case 'unschedule':
      return { kind: 'unschedule', ref };
    case 'pomodoro':
      return { kind: 'pomodoro', ref };
    case 'find':
      return { kind: 'find', ref };
    default:
      return null;
  }
}

function message(role: PlannerMessage['role'], text: string, taskId?: string): PlannerMessage {
  return { id: generateId(), role, text, createdAt: new Date().toISOString(), ...(taskId ? { taskId } : {}) };
}

/** Commands whose wording also reads like a new task ("Finish the report", "Schedule dentist for Friday"). */
const DRAFT_FALLBACK_KINDS = new Set<PlannerCommand['kind']>(['done', 'move', 'find', 'duplicate', 'rename', 'breakDown']);

function dayLabel(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

function taskEnd(task: Task, start: Date): number {
  return start.getTime() + (task.estimatedTime ?? 0) * MILLISECONDS_PER_MINUTE;
}

export function PlannerChatProvider({ children }: { children: React.ReactNode }) {
  const { tasks, addTask, updateTask, availableTags, addAvailableTag } = useTasks();
  const { startTimer } = usePomodoro();
  const { teamMembers } = useTeam();
  const { canEditTask, canAssignTask, canCreateTask } = usePermissions();
  const lastTaskIdRef = useRef<string | null>(null);
  const { settings: aiSettings } = useAI();
  const { user } = useAuth();
  const { hasFeature, features } = useSubscription();
  const {
    generateSchedulePlan,
    scheduleAllTasks,
    rescheduleDay,
    rescheduleWeek,
    rescheduleMonth,
    getScheduledTasksForDay,
    getScheduledTasksForWeek,
    getScheduledTasksForMonth,
    unscheduledCount,
  } = useAIScheduler();

  const storageKey = `${PLANNER_CHAT_CONFIG.storageKey}_${user?.id ?? 'guest'}`;
  const [state, setState] = useState<StoredChat>(() => readStoredChat(storageKey));
  const [busy, setBusy] = useState(false);
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    setState(readStoredChat(storageKey));
  }, [storageKey]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          messages: state.messages.slice(-PLANNER_CHAT_CONFIG.maxStoredMessages),
          drafts: state.drafts,
          pending: state.pending ?? null,
        }),
      );
    } catch {
      // Storage full or unavailable: chat still works for this session.
    }
  }, [state, storageKey]);

  const say = useCallback((...next: PlannerMessage[]) => {
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, ...next].slice(-PLANNER_CHAT_CONFIG.maxStoredMessages),
    }));
  }, []);

  const setPending = useCallback((pending: PlannerPending | null) => {
    setState((prev) => ({ ...prev, pending }));
  }, []);

  const canAutoSchedule = useCallback((): boolean => {
    if (!hasFeature('aiScheduler')) return false;
    if (!aiSettings.autoSchedulingEnabled || !aiSettings.scheduleUnscheduledTasks) return false;
    if (features.aiSchedulerLimit !== undefined && hasReachedLimit(features.aiSchedulerLimit)) return false;
    return true;
  }, [hasFeature, aiSettings.autoSchedulingEnabled, aiSettings.scheduleUnscheduledTasks, features.aiSchedulerLimit]);

  const countUsage = useCallback(() => {
    if (features.aiSchedulerLimit !== undefined) incrementAIUsage();
  }, [features.aiSchedulerLimit]);

  const run = useCallback(async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } catch (error) {
      logger.error('Planner chat action failed', error);
      say(message('planner', PLANNER_UI_TEXT.replies.failed));
    } finally {
      setBusy(false);
    }
  }, [say]);

  /** Create tasks for drafts, booking each into the slot the scheduler picks when allowed. */
  const commitDrafts = useCallback(async (toCommit: PlannerDraft[]) => {
    if (toCommit.length === 0) return;
    const ids = new Set(toCommit.map((draft) => draft.id));
    setState((prev) => ({ ...prev, drafts: prev.drafts.filter((draft) => !ids.has(draft.id)) }));

    const newTasks = toCommit.map((draft) => draftToTask(draft, user?.id));
    const slots = new Map<string, Date>();
    newTasks.forEach((task) => {
      if (task.scheduledDate) slots.set(task.id, new Date(task.scheduledDate));
    });
    const toPlace = newTasks.filter((task) => !slots.has(task.id));
    const autoSchedule = canAutoSchedule();
    if (autoSchedule && toPlace.length > 0) {
      countUsage();
      const result = await generateSchedulePlan(toPlace, plannerScheduleWindow(new Date()), { forceCategoryHours: true });
      result.scheduled.forEach((plan) => slots.set(plan.task.id, plan.scheduledDate));
    }

    for (const task of newTasks) {
      const slot = slots.get(task.id);
      await addTask({ ...task, scheduledDate: slot ? slot.toISOString() : null });
    }
    lastTaskIdRef.current = newTasks[newTasks.length - 1].id;

    const { replies } = PLANNER_UI_TEXT;
    if (newTasks.length === 1) {
      const slot = slots.get(newTasks[0].id);
      say(message('planner', slot ? replies.scheduledOne(newTasks[0].title, formatPlannedWhen(slot)) : replies.addedToInbox(newTasks[0].title), newTasks[0].id));
    } else {
      const unplaced = newTasks.length - slots.size;
      say(message('planner', [slots.size > 0 ? replies.scheduledMany(slots.size) : '', unplaced > 0 ? replies.unplaced(unplaced) : ''].filter(Boolean).join(' ')));
    }
    if (!autoSchedule && toPlace.length > 0) say(message('planner', replies.aiUnavailable));
  }, [addTask, canAutoSchedule, countUsage, generateSchedulePlan, say, user?.id]);

  const scheduleInbox = useCallback(() => run(async () => {
    const { replies } = PLANNER_UI_TEXT;
    if (unscheduledCount === 0) {
      say(message('planner', replies.inboxEmpty));
      return;
    }
    if (!canAutoSchedule()) {
      say(message('planner', replies.aiUnavailable));
      return;
    }
    countUsage();
    const result = await scheduleAllTasks({ period: 'twoWeeks', onlyWithoutDueDate: true, forceCategoryHours: true });
    say(message('planner', [
      result.scheduled.length > 0 ? replies.scheduledMany(result.scheduled.length) : '',
      result.exceedsLimit.length > 0 ? replies.unplaced(result.exceedsLimit.length) : '',
    ].filter(Boolean).join(' ') || replies.inboxEmpty));
  }), [canAutoSchedule, countUsage, run, say, scheduleAllTasks, unscheduledCount]);

  const reschedule = useCallback((range: PlannerRescheduleRange) => run(async () => {
    const { replies } = PLANNER_UI_TEXT;
    if (!hasFeature('aiScheduler')) {
      say(message('planner', replies.aiUnavailable));
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = startOfPlannerWeek(today);
    const count =
      range === 'day'
        ? getScheduledTasksForDay(today).length
        : range === 'week'
          ? getScheduledTasksForWeek(weekStart).length
          : getScheduledTasksForMonth(today).length;
    if (count === 0) {
      say(message('planner', replies.nothingToReschedule(range)));
      return;
    }
    const result: ScheduleResult =
      range === 'day' ? await rescheduleDay(today) : range === 'week' ? await rescheduleWeek(weekStart) : await rescheduleMonth(today);
    say(message('planner', [
      replies.rescheduled(result.scheduled.length || count, range),
      result.exceedsLimit.length > 0 ? replies.unplaced(result.exceedsLimit.length) : '',
    ].filter(Boolean).join(' ')));
  }), [getScheduledTasksForDay, getScheduledTasksForMonth, getScheduledTasksForWeek, hasFeature, rescheduleDay, rescheduleMonth, rescheduleWeek, run, say]);


  /** Run a command on an existing task. Returns false when the message should be handled another way. */
  const runCommand = useCallback(async (command: PlannerCommand, fallsBackToRange: boolean, resolved?: Task): Promise<boolean> => {
    const { replies } = PLANNER_UI_TEXT;
    const reply = (text: string, taskId?: string) => say(message('planner', text, taskId));

    if (command.kind === 'createTags') {
      const fresh = command.tags.filter((tag) => !availableTags.includes(tag));
      for (const tag of fresh) await addAvailableTag(tag);
      reply(fresh.length > 0 ? replies.tagsCreated(fresh) : replies.tagsExist(command.tags));
      return true;
    }

    const lookup = resolved
      ? ({ kind: 'found', task: resolved } as const)
      : findTaskByReference(tasksRef.current, command.ref, lastTaskIdRef.current);
    const reportsFinished = command.kind === 'done' && command.reported;
    if (lookup.kind === 'missing' && !reportsFinished && (fallsBackToRange || DRAFT_FALLBACK_KINDS.has(command.kind))) return false;
    if (lookup.kind !== 'found') {
      if (lookup.kind === 'ambiguous') reply(replies.ambiguous(lookup.options.map((task) => task.title)));
      else reply(lastTaskIdRef.current || command.ref ? replies.taskNotFound(command.ref) : replies.noTaskInFocus);
      return true;
    }
    const task = lookup.task;
    lastTaskIdRef.current = task.id;

    if (command.kind === 'find') {
      const when = task.scheduledDate ? formatPlannedWhen(new Date(task.scheduledDate)) : null;
      const assignees = task.assignedTo
        .map((id) => teamMembers.find((member) => member.id === id)?.name)
        .filter((name): name is string => Boolean(name));
      reply(replies.found({
        title: task.title,
        when,
        details: [
          getCategoryFromTags(task.tags) ?? '',
          task.estimatedTime ? PLANNER_UI_TEXT.chat.estimate(task.estimatedTime) : '',
          task.priority,
          task.status === 'done' ? 'done' : '',
          task.subtasks.length > 0 ? `${task.subtasks.filter((item) => item.completed).length}/${task.subtasks.length} subtasks` : '',
          assignees.length > 0 ? assignees.join(', ') : '',
        ].filter(Boolean),
      }), task.id);
      return true;
    }

    if (command.kind === 'pomodoro') {
      if (!hasFeature('pomodoroTimer')) return reply(replies.pomodoroUnavailable), true;
      if (task.status === 'done') return reply(replies.pomodoroDone(task.title), task.id), true;
      const minutes = task.estimatedTime && task.estimatedTime > 0 ? task.estimatedTime : POMODORO_WORK_DURATION / SECONDS_PER_MINUTE;
      startTimer(task.id, { durationMinutes: minutes });
      reply(replies.pomodoroStarted(task.title, minutes), task.id);
      return true;
    }

    if (command.kind === 'duplicate') {
      if (!canCreateTask) return reply(replies.noPermission), true;
      const now = new Date().toISOString();
      const copy: Task = {
        ...task,
        id: generateId(),
        status: 'todo',
        completedAt: null,
        actualTime: null,
        scheduledDate: null,
        createdAt: now,
        updatedAt: now,
        calendar_event_id: null,
        recurrence: RECURRENCE_NONE_CONFIG,
        subtasks: task.subtasks.map((item): Subtask => ({ ...item, id: generateId(), completed: false, createdAt: now })),
      };
      let slot: Date | undefined;
      if (canAutoSchedule()) {
        countUsage();
        const plan = await generateSchedulePlan([copy], plannerScheduleWindow(new Date()), { forceCategoryHours: true });
        slot = plan.scheduled[0]?.scheduledDate;
      }
      await addTask({ ...copy, scheduledDate: slot ? slot.toISOString() : null });
      lastTaskIdRef.current = copy.id;
      reply(replies.duplicated(task.title, slot ? formatPlannedWhen(slot) : null), copy.id);
      return true;
    }

    if (command.kind === 'assign') {
      if (!canAssignTask) return reply(replies.noPermission), true;
      const isSelf = PLANNER_CHAT_CONFIG.selfPattern.test(command.member);
      const member = isSelf ? null : findTeamMember(teamMembers, command.member);
      const memberId = isSelf ? user?.id : member?.id;
      const name = isSelf ? user?.name ?? command.member : member?.name ?? command.member;
      if (!memberId) return reply(teamMembers.length === 0 && !isSelf ? replies.noTeam : replies.memberNotFound(command.member)), true;
      if (task.assignedTo.includes(memberId)) return reply(replies.alreadyAssigned(task.title, name), task.id), true;
      await updateTask(task.id, { assignedTo: [...task.assignedTo, memberId] });
      reply(replies.assigned(task.title, name), task.id);
      return true;
    }

    if (!canEditTask) return reply(replies.noPermission), true;

    switch (command.kind) {
      case 'subtasks': {
        const now = new Date().toISOString();
        const added = command.items.map((title): Subtask => ({ id: generateId(), title, completed: false, createdAt: now }));
        await updateTask(task.id, { subtasks: [...task.subtasks, ...added] });
        reply(replies.subtasksAdded(added.length, task.title), task.id);
        return true;
      }
      case 'breakDown': {
        const suggestion = suggestSubtasks(`${task.title} ${task.description ?? ''}`);
        if (!suggestion) {
          setPending({ kind: 'taskSteps', taskId: task.id });
          reply(replies.taskSteps(task.title), task.id);
          return true;
        }
        const existing = new Set(task.subtasks.map((item) => item.title.trim().toLowerCase()));
        const steps = suggestion.steps.filter((step) => !existing.has(step.toLowerCase()));
        if (steps.length === 0) return reply(replies.alreadyBrokenDown(task.title), task.id), true;
        const now = new Date().toISOString();
        const added = steps.map((title): Subtask => ({ id: generateId(), title, completed: false, createdAt: now }));
        await updateTask(task.id, { subtasks: [...task.subtasks, ...added] });
        reply(replies.brokenDown(steps, task.title), task.id);
        return true;
      }
      case 'tags': {
        const tags = command.tags.map(normalizeTag);
        for (const tag of tags.filter((item) => !availableTags.includes(item))) await addAvailableTag(tag);
        await updateTask(task.id, { tags: [...new Set([...task.tags, ...tags])] });
        reply(replies.tagsAdded(tags, task.title), task.id);
        return true;
      }
      case 'notes': {
        const existing = task.description ?? '';
        const isHtml = /<\/?[a-z][^>]*>/i.test(existing);
        const addition = isHtml ? `<p>${escapeHtml(command.text)}</p>` : command.text;
        const description = !existing ? addition : isHtml ? `${existing}${addition}` : `${existing}\n${addition}`;
        await updateTask(task.id, { description });
        reply(replies.notesAdded(task.title), task.id);
        return true;
      }
      case 'unschedule':
        await updateTask(task.id, { scheduledDate: null });
        reply(replies.unscheduled(task.title), task.id);
        return true;
      case 'rename':
        await updateTask(task.id, { title: command.title });
        reply(replies.renamed(task.title, command.title), task.id);
        return true;
      case 'duration':
        await updateTask(task.id, { estimatedTime: command.minutes });
        reply(replies.durationSet(task.title, PLANNER_UI_TEXT.chat.estimate(command.minutes)), task.id);
        return true;
      case 'priority':
        await updateTask(task.id, { priority: command.priority });
        reply(replies.prioritySet(task.title, command.priority), task.id);
        return true;
      case 'done':
        if (task.status === 'done') return reply(replies.alreadyDone(task.title), task.id), true;
        await updateTask(task.id, { status: 'done', completedAt: new Date().toISOString() });
        reply(replies.completed(task.title), task.id);
        return true;
      case 'move': {
        const now = new Date();
        const when = command.at ?? parsePlannerWhen(command.when, now);
        if (!when) return false;
        let start = when.date;
        if (!when.hasTime) {
          // Only a day: let the scheduler pick a slot inside category hours, daily limits, and calendar events.
          const plan = canAutoSchedule()
            ? await generateSchedulePlan([{ ...task, scheduledDate: null }], { startDate: when.date, endDate: endOfDay(when.date) }, { forceCategoryHours: true })
            : null;
          const picked = plan?.scheduled[0]?.scheduledDate;
          if (!picked) return reply(replies.noSlotThatDay(task.title, dayLabel(when.date)), task.id), true;
          countUsage();
          start = picked;
        }
        await updateTask(task.id, { scheduledDate: start.toISOString() });
        const clash = tasksRef.current.find((other) => {
          if (other.id === task.id || other.status === 'done' || !other.scheduledDate) return false;
          const otherStart = new Date(other.scheduledDate);
          return otherStart.getTime() < taskEnd(task, start) && start.getTime() < taskEnd(other, otherStart);
        });
        reply([replies.moved(task.title, formatPlannedWhen(start)), clash ? replies.overlaps(clash.title) : ''].filter(Boolean).join(' '), task.id);
        return true;
      }
      default:
        return false;
    }
  }, [addAvailableTag, addTask, availableTags, canAssignTask, canAutoSchedule, canCreateTask, canEditTask, countUsage, generateSchedulePlan, hasFeature, say, setPending, startTimer, teamMembers, updateTask, user?.id, user?.name]);

  const addDrafts = useCallback((drafts: PlannerDraft[]) => {
    const { replies } = PLANNER_UI_TEXT;
    if (drafts.length === 0) {
      say(message('planner', replies.nothingFound));
      return;
    }
    setState((prev) => ({ ...prev, drafts: [...prev.drafts, ...drafts] }));
    say(message('planner', replies.drafted(drafts.length, drafts.filter((draft) => draft.subtasks?.length).length)));
  }, [say]);

  /** Drafts that repeat an open task are dropped; the planner points to the existing task instead. */
  const withoutExisting = useCallback((drafts: PlannerDraft[]): PlannerDraft[] => {
    const open = new Map(tasksRef.current.filter(isOpenTask).map((task) => [taskTitleKey(task.title), task]));
    return drafts.filter((draft) => {
      const existing = open.get(taskTitleKey(draft.title));
      if (!existing) return true;
      say(message('planner', PLANNER_UI_TEXT.replies.alreadyOnList(existing.title), existing.id));
      return false;
    });
  }, [say]);

  const finishProject = useCallback((draft: PlannerDraft) => {
    setState((prev) => ({ ...prev, pending: null, drafts: [...prev.drafts, draft] }));
    say(message('planner', PLANNER_UI_TEXT.replies.projectReady(draft.title, draft.subtasks?.length ?? 0)));
  }, [say]);

  /** Apply the user's answer to the planner's last question. */
  const answerPending = useCallback(async (pending: PlannerPending, text: string) => {
    const { replies } = PLANNER_UI_TEXT;
    const project = PLANNER_PROJECT_CONFIG;

    if (pending.kind === 'projectDeadline') {
      if (project.skipPattern.test(text)) return finishProject(pending.draft);
      const when = parsePlannerWhen(text, new Date());
      if (!when) return say(message('planner', replies.projectDeadlineAgain));
      return finishProject({ ...pending.draft, when: { date: when.date.toISOString(), hasTime: false } });
    }

    const wantsSuggestion = project.suggestPattern.test(text);
    if (pending.kind === 'taskSteps') {
      const task = tasksRef.current.find((item) => item.id === pending.taskId);
      setPending(null);
      if (!task) return say(message('planner', replies.taskNotFound(text)));
      const steps = cleanSteps(wantsSuggestion ? [...project.generalSteps] : splitList(text), task.title)
        .filter((step) => !task.subtasks.some((item) => taskTitleKey(item.title) === taskTitleKey(step)));
      if (steps.length === 0) return say(message('planner', replies.alreadyBrokenDown(task.title), task.id));
      if (!canEditTask) return say(message('planner', replies.noPermission));
      const now = new Date().toISOString();
      const added = steps.map((title): Subtask => ({ id: generateId(), title, completed: false, createdAt: now }));
      await updateTask(task.id, { subtasks: [...task.subtasks, ...added] });
      lastTaskIdRef.current = task.id;
      return say(message('planner', replies.subtasksAdded(added.length, task.title), task.id));
    }

    const listed = wantsSuggestion
      ? pending.suggested.length > 0 ? pending.suggested : [...project.generalSteps]
      : splitList(text);
    const steps = cleanSteps(listed, pending.draft.title);
    if (steps.length === 0) return say(message('planner', replies.projectScopeAgain));
    const draft: PlannerDraft = {
      ...pending.draft,
      subtasks: steps,
      estimatedMinutes: estimateWithSubtasks(pending.draft.estimatedMinutes, steps.length, project.minutesPerStep),
    };
    if (pending.askDeadline) {
      setPending({ kind: 'projectDeadline', draft });
      return say(message('planner', replies.projectDeadline(draft.title)));
    }
    return finishProject(draft);
  }, [canEditTask, finishProject, say, setPending, updateTask]);

  /**
   * Opt-in: let the server's AI read the message with the open tasks and recent chat for context.
   * Returns false when it is unavailable so the on-device planner can answer instead.
   */
  const runEnhanced = useCallback(async (mode: 'chat' | 'brainDump', text: string): Promise<boolean> => {
    const { maxTasksSent, maxHistorySent, maxSubtasksSent } = PLANNER_ENHANCED_CONFIG;
    setBusy(true);
    try {
      const openTasks = tasksRef.current.filter(isOpenTask).slice(0, maxTasksSent);
      const result = await requestEnhancedPlanner({
        mode,
        text,
        now: new Date().toISOString(),
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        history: mode === 'chat'
          ? stateRef.current.messages.slice(-maxHistorySent).map(({ role, text: body }) => ({ role, text: body }))
          : [],
        tasks: openTasks.map((task) => ({
          id: task.id,
          title: task.title,
          status: task.status,
          priority: task.priority,
          scheduledDate: task.scheduledDate,
          dueDate: task.dueDate,
          estimatedMinutes: task.estimatedTime,
          tags: task.tags,
          subtasks: task.subtasks.slice(0, maxSubtasksSent).map((item) => item.title),
        })),
      });

      const drafts = withoutExisting(result.drafts.map(toPlannerDraft).filter((draft): draft is PlannerDraft => draft !== null));
      const edits = mode === 'chat' ? result.edits : [];
      if (result.reply && (drafts.length > 0 || result.question || edits.length === 0)) {
        say(message('planner', result.reply));
      } else if (!result.reply && drafts.length === 0 && edits.length === 0 && !result.question) {
        say(message('planner', PLANNER_UI_TEXT.replies.nothingFound));
      }
      for (const edit of edits) {
        const task = tasksRef.current.find((item) => item.id === edit.taskId);
        const command = task ? editToCommand(edit, task) : null;
        if (task && command) await runCommand(command, false, task);
      }
      if (drafts.length > 0) setState((prev) => ({ ...prev, drafts: [...prev.drafts, ...drafts] }));
      if (result.question) say(message('planner', result.question));
      return true;
    } catch (error) {
      logger.warn('Enhanced planner unavailable, using on-device planner', error);
      return false;
    } finally {
      setBusy(false);
    }
  }, [runCommand, say, withoutExisting]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    say(message('user', trimmed));
    const { replies } = PLANNER_UI_TEXT;

    const pending = stateRef.current.pending ?? null;
    if (pending && PLANNER_PROJECT_CONFIG.cancelPattern.test(trimmed)) {
      setPending(null);
      say(message('planner', replies.projectCancelled));
      return;
    }

    const request = stripAssistantRequest(trimmed);
    const intent = detectPlannerIntent(request);
    const command = intent.kind === 'scheduleInbox' ? null : parsePlannerCommand(request);
    if (pending) {
      if (!command && intent.kind === 'drafts') {
        await run(() => answerPending(pending, trimmed));
        return;
      }
      setPending(null);
    }

    if (aiSettings.enhancedPlannerEnabled && intent.kind !== 'scheduleInbox' && intent.kind !== 'reschedule') {
      if (await runEnhanced('chat', trimmed)) return;
      say(message('planner', replies.enhancedUnavailable));
    }

    if (!command && PLANNER_CHAT_CONFIG.conversationalPattern.test(trimmed)) {
      say(message('planner', replies.smallTalk));
      return;
    }
    if (command) {
      // Stays true if the command throws, so a failed edit isn't also turned into drafts.
      let handled = true;
      await run(async () => {
        handled = await runCommand(command, intent.kind === 'reschedule');
      });
      if (handled) return;
    }
    if (intent.kind === 'question') {
      say(message('planner', plannerSummary(tasksRef.current, new Date())));
      return;
    }
    if (intent.kind === 'scheduleInbox') {
      await scheduleInbox();
      return;
    }
    if (intent.kind === 'reschedule') {
      await reschedule(intent.range);
      return;
    }

    const parsed = command?.kind === 'breakDown'
      ? { drafts: parsePlannerDrafts(command.ref), skipped: 0 }
      : parseChatDrafts(request);
    const parsedCount = parsed.drafts.length;
    const drafts = withoutExisting(parsed.drafts);
    if (drafts.length === 1 && isProjectDraft(request, drafts[0])) {
      const [draft] = drafts;
      const { subtasks, ...withoutSteps } = draft;
      setPending({ kind: 'projectScope', draft: withoutSteps, suggested: subtasks ?? [], askDeadline: !draft.when });
      say(message('planner', replies.projectScope(draft.title, projectKind(draft.title))));
      return;
    }
    if (drafts.length === 0) {
      if (parsedCount > 0) return;
      say(message('planner', parsed.skipped > 0 ? replies.contextOnly : replies.nothingFound));
      return;
    }
    addDrafts(drafts);
    if (parsed.skipped > 0) say(message('planner', replies.skippedContext(parsed.skipped)));
  }, [addDrafts, aiSettings.enhancedPlannerEnabled, answerPending, reschedule, run, runCommand, runEnhanced, say, scheduleInbox, setPending, withoutExisting]);

  // Brain dumps only ever create drafts; they never run commands or edit existing tasks.
  const analyzeContext = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const { brainDumpPreviewChars } = PLANNER_CHAT_CONFIG;
    say(message('user', trimmed.length > brainDumpPreviewChars ? `${trimmed.slice(0, brainDumpPreviewChars).trimEnd()}…` : trimmed));

    const analyzeOnDevice = () => {
      const openTitles = tasksRef.current.filter(isOpenTask).map((task) => task.title);
      const { drafts, skippedNotes, skippedDuplicates, details } = parseBrainDump(trimmed, openTitles);
      if (drafts.length > 0) setState((prev) => ({ ...prev, drafts: [...prev.drafts, ...drafts] }));
      say(message('planner', PLANNER_UI_TEXT.replies.brainDump({
        tasks: drafts.length,
        withSteps: drafts.filter((draft) => draft.subtasks?.length).length,
        notes: skippedNotes,
        duplicates: skippedDuplicates,
        details,
      })));
    };

    if (!aiSettings.enhancedPlannerEnabled) {
      analyzeOnDevice();
      return;
    }
    void runEnhanced('brainDump', trimmed).then((handled) => {
      if (handled) return;
      say(message('planner', PLANNER_UI_TEXT.replies.enhancedUnavailable));
      analyzeOnDevice();
    });
  }, [aiSettings.enhancedPlannerEnabled, runEnhanced, say]);

  const acceptDraft = useCallback((id: string) => run(async () => {
    const draft = state.drafts.find((item) => item.id === id);
    if (draft) await commitDrafts([draft]);
  }), [commitDrafts, run, state.drafts]);

  const acceptAll = useCallback(() => run(() => commitDrafts(state.drafts)), [commitDrafts, run, state.drafts]);

  const skipDraft = useCallback((id: string) => {
    setState((prev) => ({ ...prev, drafts: prev.drafts.filter((draft) => draft.id !== id) }));
  }, []);

  const skipAll = useCallback(() => {
    setState((prev) => ({ ...prev, drafts: [] }));
  }, []);

  const clear = useCallback(() => setState({ messages: [], drafts: [], pending: null }), []);

  const value = useMemo<PlannerChatValue>(() => ({
    messages: state.messages,
    drafts: state.drafts,
    busy,
    send,
    analyzeContext,
    acceptDraft,
    skipDraft,
    acceptAll,
    skipAll,
    scheduleInbox,
    reschedule,
    clear,
  }), [state, busy, send, analyzeContext, acceptDraft, skipDraft, acceptAll, skipAll, scheduleInbox, reschedule, clear]);

  return <PlannerChatContext.Provider value={value}>{children}</PlannerChatContext.Provider>;
}

export function usePlannerChat(): PlannerChatValue {
  const value = useContext(PlannerChatContext);
  if (!value) throw new Error('usePlannerChat must be used inside PlannerChatProvider');
  return value;
}
