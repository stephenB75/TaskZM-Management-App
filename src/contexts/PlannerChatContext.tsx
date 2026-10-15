import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useTasks } from './TaskContext';
import { useAI } from './AIContext';
import { useAuth } from './AuthContext';
import { useSubscription } from './SubscriptionContext';
import { useAIScheduler, type ScheduleResult } from '../hooks/useAIScheduler';
import { hasReachedLimit, incrementAIUsage } from '../lib/ai-scheduler-usage';
import { PLANNER_CHAT_CONFIG } from '../lib/ai-config';
import { PLANNER_UI_TEXT, type PlannerRescheduleRange } from '../lib/navigation-constants';
import {
  detectPlannerIntent,
  draftToTask,
  formatPlannedWhen,
  parsePlannerDrafts,
  plannerScheduleWindow,
  plannerSummary,
  startOfPlannerWeek,
  type PlannerDraft,
} from '../lib/planner-chat';
import { generateId } from '../lib/utils';
import { logger } from '../lib/logger';

export interface PlannerMessage {
  id: string;
  role: 'user' | 'planner';
  text: string;
  createdAt: string;
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

function message(role: PlannerMessage['role'], text: string): PlannerMessage {
  return { id: generateId(), role, text, createdAt: new Date().toISOString() };
}

export function PlannerChatProvider({ children }: { children: React.ReactNode }) {
  const { tasks, addTask } = useTasks();
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
    const autoSchedule = canAutoSchedule();
    if (autoSchedule) {
      countUsage();
      const result = await generateSchedulePlan(newTasks, plannerScheduleWindow(new Date()), { forceCategoryHours: true });
      result.scheduled.forEach((plan) => slots.set(plan.task.id, plan.scheduledDate));
    }

    for (const task of newTasks) {
      const slot = slots.get(task.id);
      await addTask({ ...task, scheduledDate: slot ? slot.toISOString() : null });
    }

    const { replies } = PLANNER_UI_TEXT;
    if (newTasks.length === 1) {
      const slot = slots.get(newTasks[0].id);
      say(message('planner', slot ? replies.scheduledOne(newTasks[0].title, formatPlannedWhen(slot)) : replies.addedToInbox(newTasks[0].title)));
    } else {
      const unplaced = newTasks.length - slots.size;
      say(message('planner', [slots.size > 0 ? replies.scheduledMany(slots.size) : '', unplaced > 0 ? replies.unplaced(unplaced) : ''].filter(Boolean).join(' ')));
    }
    if (!autoSchedule) say(message('planner', replies.aiUnavailable));
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
  }, [addDrafts, reschedule, say, scheduleInbox]);

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
