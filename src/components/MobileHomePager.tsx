/**
 * Phone home: one scrolling column. Greeting and counts, then today's tasks, then open work.
 */

import React, { useCallback, useMemo, useState } from 'react';
import { useTasks } from '../contexts/TaskContext';
import { useAI } from '../contexts/AIContext';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAIScheduler } from '../hooks/useAIScheduler';
import { toast } from '../lib/toast-wrapper';
import { isSameCalendarDay } from '../lib/notification-task-filters';
import { isUnfinishedTask, tasksScheduledOn, tasksToPlace } from '../lib/home-task-groups';
import { clearEditingScrollPad, revealTaskAboveDialog } from '../lib/reveal-editing-task';
import { MOBILE_HOME_UI_TEXT } from '../lib/navigation-constants';
import { PastelTaskCard } from './PastelTaskCard';
import { greetingLine, PlaceTasksButton, SummaryCard } from './HomeSummary';
import {
  HEADER_HEIGHT,
  MOBILE_HOME_BODY_FONT_SIZE,
  MOBILE_HOME_CARD_RADIUS,
  MOBILE_HOME_PILL_RADIUS,
  MOBILE_HOME_PAGE_PADDING,
  MOBILE_HOME_SECTION_GAP,
  MOBILE_HOME_TAB_FONT_SIZE,
  MOBILE_HOME_LABEL_GAP,
  MOBILE_HOME_TAP_TARGET_PX,
  TOAST_DURATION_MEDIUM_MS,
  TOAST_DURATION_SHORT_MS,
} from '../lib/layout-constants';
import {
  DEFAULT_WEEKDAY_WORK_START,
  END_OF_DAY_HOUR,
  END_OF_DAY_MILLISECOND,
  END_OF_DAY_MINUTE,
  END_OF_DAY_SECOND,
  TWO_WEEKS_DAYS,
} from '../lib/business-constants';
import { COLOR_BACKGROUND_GRAY, COLOR_TEXT_PRIMARY } from '../lib/color-theme';
import { getDateString } from '../lib/utils';
import { TaskDialog } from './TaskDialog';
import type { Task } from '../types';

interface MobileHomePagerProps {
  onRunScheduler: () => void;
  isScheduling: boolean;
}

function workStartTodayIso(): string {
  const [hourText, minuteText] = DEFAULT_WEEKDAY_WORK_START.split(':');
  const date = new Date();
  date.setHours(Number(hourText), Number(minuteText), 0, 0);
  return date.toISOString();
}

function unfinishedStatus(task: Task, now: Date): string {
  if (!task.scheduledDate) return MOBILE_HOME_UI_TEXT.statusRolled;
  const target = new Date(task.scheduledDate);
  if (isSameCalendarDay(target, now)) return MOBILE_HOME_UI_TEXT.statusPastSlot;
  return MOBILE_HOME_UI_TEXT.statusOverdue;
}

export function MobileHomePager({ onRunScheduler, isScheduling }: MobileHomePagerProps) {
  const { tasks, updateTask } = useTasks();
  const { user } = useAuth();
  const { settings: aiSettings } = useAI();
  const { hasFeature } = useSubscription();
  const { generateSchedulePlan, applySchedulePlan } = useAIScheduler();
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [editorTask, setEditorTask] = useState<Task | null>(null);

  const openEditor = useCallback((task: Task) => {
    setEditorTask(task);
    revealTaskAboveDialog(task.id);
  }, []);

  const now = useMemo(() => new Date(), [tasks]);
  const unfinished = useMemo(() => tasks.filter((task) => isUnfinishedTask(task, now)), [tasks, now]);
  const toPlace = useMemo(() => tasksToPlace(tasks, unfinished), [tasks, unfinished]);
  const upcoming = useMemo(() => tasksScheduledOn(tasks, now), [tasks, now]);
  const doneCount = useMemo(() => tasks.filter((task) => task.status === 'done').length, [tasks]);

  const markDone = useCallback(
    async (task: Task) => {
      setBusyTaskId(task.id);
      try {
        await updateTask(task.id, {
          status: 'done',
          completedAt: new Date().toISOString(),
        });
        toast.success(MOBILE_HOME_UI_TEXT.markedDone, { duration: TOAST_DURATION_SHORT_MS });
      } finally {
        setBusyTaskId(null);
      }
    },
    [updateTask],
  );

  const moveToToday = useCallback(
    async (task: Task) => {
      setBusyTaskId(task.id);
      try {
        await updateTask(task.id, { scheduledDate: workStartTodayIso() });
        toast.success(MOBILE_HOME_UI_TEXT.movedToday, { duration: TOAST_DURATION_SHORT_MS });
      } finally {
        setBusyTaskId(null);
      }
    },
    [updateTask],
  );

  const rescheduleTask = useCallback(
    async (task: Task) => {
      if (!hasFeature('aiScheduler')) {
        toast.error(MOBILE_HOME_UI_TEXT.aiPro, { duration: TOAST_DURATION_MEDIUM_MS });
        return;
      }
      if (!aiSettings.autoSchedulingEnabled) {
        toast.error(MOBILE_HOME_UI_TEXT.aiDisabled, {
          description: MOBILE_HOME_UI_TEXT.aiDisabledDetail,
          duration: TOAST_DURATION_MEDIUM_MS,
        });
        return;
      }

      setBusyTaskId(task.id);
      try {
        await updateTask(task.id, { scheduledDate: null });
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setDate(end.getDate() + (TWO_WEEKS_DAYS - 1));
        end.setHours(END_OF_DAY_HOUR, END_OF_DAY_MINUTE, END_OF_DAY_SECOND, END_OF_DAY_MILLISECOND);
        const result = await generateSchedulePlan([{ ...task, scheduledDate: null }], {
          startDate: start,
          endDate: end,
        });
        if (result.scheduled.length === 0) {
          toast.warning(MOBILE_HOME_UI_TEXT.noSlot, { duration: TOAST_DURATION_MEDIUM_MS });
          return;
        }
        await applySchedulePlan(result.scheduled);
        toast.success(MOBILE_HOME_UI_TEXT.rescheduled, { duration: TOAST_DURATION_SHORT_MS });
      } finally {
        setBusyTaskId(null);
      }
    },
    [aiSettings.autoSchedulingEnabled, applySchedulePlan, generateSchedulePlan, hasFeature, updateTask],
  );

  const name = user?.name || '';

  return (
    <div
      className="h-full min-h-0 overflow-y-auto overflow-x-hidden"
      style={{
        background: COLOR_BACKGROUND_GRAY,
        padding: MOBILE_HOME_PAGE_PADDING,
      }}
    >
      <div className="flex flex-col" style={{ gap: MOBILE_HOME_SECTION_GAP }}>
        <section>
          <p style={{ fontSize: MOBILE_HOME_BODY_FONT_SIZE, color: COLOR_TEXT_PRIMARY, margin: 0 }}>
            {MOBILE_HOME_UI_TEXT.greetingHello}
          </p>
          <h2 style={{ fontSize: MOBILE_HOME_BODY_FONT_SIZE, fontWeight: 500, margin: 0 }}>
            {greetingLine(now)}{name ? `, ${name}` : ''}
          </h2>
          <div className="grid grid-cols-2" style={{ gap: MOBILE_HOME_SECTION_GAP, marginTop: MOBILE_HOME_SECTION_GAP }}>
            <SummaryCard compact accent label={MOBILE_HOME_UI_TEXT.summaryUnfinished} value={unfinished.length} />
            <SummaryCard compact label={MOBILE_HOME_UI_TEXT.summaryToPlace} value={toPlace.length} />
            <SummaryCard compact label={MOBILE_HOME_UI_TEXT.summaryScheduledToday} value={upcoming.length} />
            <SummaryCard compact label={MOBILE_HOME_UI_TEXT.summaryDone} value={doneCount} />
          </div>
          <div style={{ marginTop: MOBILE_HOME_SECTION_GAP }}>
            <PlaceTasksButton busy={isScheduling} onClick={onRunScheduler} />
            <p style={{ fontSize: MOBILE_HOME_TAB_FONT_SIZE, margin: `${MOBILE_HOME_LABEL_GAP} 0 0`, color: COLOR_TEXT_PRIMARY }}>
              {MOBILE_HOME_UI_TEXT.scheduleHint}
            </p>
          </div>
        </section>

        <section>
          <h2 style={{ fontSize: MOBILE_HOME_BODY_FONT_SIZE, fontWeight: 500, margin: 0 }}>
            {MOBILE_HOME_UI_TEXT.upcomingTitle}
          </h2>
          {upcoming.length === 0 ? (
            <p style={{ fontSize: MOBILE_HOME_BODY_FONT_SIZE, marginTop: MOBILE_HOME_SECTION_GAP }}>{MOBILE_HOME_UI_TEXT.weekEmpty}</p>
          ) : (
            <ul className="flex flex-col" style={{ gap: MOBILE_HOME_SECTION_GAP, marginTop: MOBILE_HOME_SECTION_GAP }}>
              {upcoming.map((task) => (
                <li key={task.id} id={`home-task-${task.id}`} style={{ scrollMarginTop: HEADER_HEIGHT }}>
                  <PastelTaskCard task={task} onOpen={() => openEditor(task)} />
                </li>
              ))}
            </ul>
          )}
        </section>

        {(unfinished.length > 0 || toPlace.length > 0) && (
        <section>
          <h2 style={{ fontSize: MOBILE_HOME_BODY_FONT_SIZE, fontWeight: 500, margin: 0 }}>
            {MOBILE_HOME_UI_TEXT.tabs.open}
          </h2>
          <ul className="flex flex-col" style={{ gap: MOBILE_HOME_SECTION_GAP, marginTop: MOBILE_HOME_SECTION_GAP }}>
              {unfinished.map((task) => (
                <li key={task.id}>
                  <PastelTaskCard
                    task={task}
                    unfinished
                    detail={unfinishedStatus(task, now)}
                    onOpen={() => setOpenTaskId((current) => (current === task.id ? null : task.id))}
                  >
                    {openTaskId === task.id ? (
                      <span className="mt-3 flex flex-col" style={{ gap: MOBILE_HOME_SECTION_GAP }}>
                        <OpenAction
                          label={MOBILE_HOME_UI_TEXT.actionReschedule}
                          disabled={busyTaskId === task.id}
                          onClick={() => void rescheduleTask(task)}
                        />
                        <OpenAction
                          label={MOBILE_HOME_UI_TEXT.actionToday}
                          disabled={busyTaskId === task.id}
                          onClick={() => void moveToToday(task)}
                        />
                        <OpenAction
                          label={MOBILE_HOME_UI_TEXT.actionDone}
                          disabled={busyTaskId === task.id}
                          onClick={() => void markDone(task)}
                        />
                      </span>
                    ) : null}
                  </PastelTaskCard>
                </li>
              ))}
              {toPlace.map((task) => (
                <li key={task.id} id={`home-task-${task.id}`} style={{ scrollMarginTop: HEADER_HEIGHT }}>
                  <PastelTaskCard
                    task={task}
                    detail={MOBILE_HOME_UI_TEXT.needsTime}
                    onOpen={() => openEditor(task)}
                  />
                </li>
              ))}
            </ul>
        </section>
        )}

      </div>

      {editorTask ? (
        <TaskDialog
          open
          task={editorTask}
          onClose={() => {
            clearEditingScrollPad(editorTask.id);
            setEditorTask(null);
          }}
          initialDate={getDateString(now)}
        />
      ) : null}
    </div>
  );
}

function OpenAction({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className="w-full bg-white font-semibold text-foreground disabled:opacity-60"
      style={{
        minHeight: MOBILE_HOME_TAP_TARGET_PX,
        borderRadius: MOBILE_HOME_PILL_RADIUS,
        fontSize: MOBILE_HOME_BODY_FONT_SIZE,
        border: 'none',
      }}
    >
      {label}
    </button>
  );
}
