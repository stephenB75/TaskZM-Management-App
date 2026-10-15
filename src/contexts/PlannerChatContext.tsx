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
import { PLANNER_CHAT_CONFIG } from '../lib/ai-config';
import { PLANNER_UI_TEXT, type PlannerRescheduleRange } from '../lib/navigation-constants';
import {
  detectPlannerIntent,
  draftToTask,
  endOfDay,
  formatPlannedWhen,
  parsePlannerDrafts,
  plannerScheduleWindow,
  plannerSummary,
  startOfPlannerWeek,
  type PlannerDraft,
} from '../lib/planner-chat';
import {
  findTaskByReference,
  findTeamMember,
  normalizeTag,
  parsePlannerCommand,
  parsePlannerWhen,
  type PlannerCommand,
} from '../lib/planner-commands';
import { getCategoryFromTags } from '../lib/ai-config';
import {
  MILLISECONDS_PER_MINUTE,
  POMODORO_WORK_DURATION,
  RECURRENCE_NONE_CONFIG,
  SECONDS_PER_MINUTE,
} from '../lib/business-constants';
import { generateId } from '../lib/utils';
import { logger } from '../lib/logger';
import type { Subtask, Task } from '../types';

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

interface StoredChat {
  messages: PlannerMessage[];
  drafts: PlannerDraft[];
}

function readStoredChat(key: string): StoredChat {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { messages: [], drafts: [] };
    const parsed = JSON.parse(raw) as Partial<StoredChat>;
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      drafts: Array.isArray(parsed.drafts) ? parsed.drafts : [],
    };
  } catch {
    return { messages: [], drafts: [] };
  }
}

function message(role: PlannerMessage['role'], text: string, taskId?: string): PlannerMessage {
  return { id: generateId(), role, text, createdAt: new Date().toISOString(), ...(taskId ? { taskId } : {}) };
}

/** Commands whose wording also reads like a new task ("Finish the report", "Schedule dentist for Friday"). */
const DRAFT_FALLBACK_KINDS = new Set<PlannerCommand['kind']>(['done', 'move', 'find', 'duplicate', 'rename']);

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
  const runCommand = useCallback(async (command: PlannerCommand, fallsBackToRange: boolean): Promise<boolean> => {
    const { replies } = PLANNER_UI_TEXT;
    const reply = (text: string, taskId?: string) => say(message('planner', text, taskId));

    if (command.kind === 'createTags') {
      const fresh = command.tags.filter((tag) => !availableTags.includes(tag));
      for (const tag of fresh) await addAvailableTag(tag);
      reply(fresh.length > 0 ? replies.tagsCreated(fresh) : replies.tagsExist(command.tags));
      return true;
    }

    const lookup = findTaskByReference(tasksRef.current, command.ref, lastTaskIdRef.current);
    if (lookup.kind === 'missing' && (fallsBackToRange || DRAFT_FALLBACK_KINDS.has(command.kind))) return false;
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
      case 'tags': {
        const tags = command.tags.map(normalizeTag);
        for (const tag of tags.filter((item) => !availableTags.includes(item))) await addAvailableTag(tag);
        await updateTask(task.id, { tags: [...new Set([...task.tags, ...tags])] });
        reply(replies.tagsAdded(tags, task.title), task.id);
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
        const when = parsePlannerWhen(command.when, now);
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
  }, [addAvailableTag, addTask, availableTags, canAssignTask, canAutoSchedule, canCreateTask, canEditTask, countUsage, generateSchedulePlan, hasFeature, say, startTimer, teamMembers, updateTask, user?.id, user?.name]);

  const addDrafts = useCallback((drafts: PlannerDraft[]) => {
    const { replies } = PLANNER_UI_TEXT;
    if (drafts.length === 0) {
      say(message('planner', replies.nothingFound));
      return;
    }
    setState((prev) => ({ ...prev, drafts: [...prev.drafts, ...drafts] }));
    say(message('planner', replies.drafted(drafts.length)));
  }, [say]);

  const send = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    say(message('user', trimmed));
    const intent = detectPlannerIntent(trimmed);
    const command = intent.kind === 'scheduleInbox' ? null : parsePlannerCommand(trimmed);
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
    addDrafts(intent.drafts);
  }, [addDrafts, reschedule, run, runCommand, say, scheduleInbox]);

  const analyzeContext = useCallback((text: string) => {
    if (!text.trim()) return;
    addDrafts(parsePlannerDrafts(text));
  }, [addDrafts]);

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

  const clear = useCallback(() => setState({ messages: [], drafts: [] }), []);

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
