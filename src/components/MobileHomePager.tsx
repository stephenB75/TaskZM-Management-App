/**
 * Mobile home: swipe or tap between Schedule, Unfinished, and To place.
 */

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { lazyWithRetry } from '../lib/lazy-with-retry';

const TodayAgendaView = lazyWithRetry(() =>
  import('./TodayAgendaView').then((module) => ({ default: module.TodayAgendaView })),
);
import { useTasks } from '../contexts/TaskContext';
import { useAI } from '../contexts/AIContext';
import { useSubscription } from '../contexts/SubscriptionContext';
import { useAIScheduler } from '../hooks/useAIScheduler';
import { toast } from '../lib/toast-wrapper';
import { cn } from '../lib/utils';
import { isSameCalendarDay, isTaskOverdue } from '../lib/notification-task-filters';
import { MOBILE_HOME_UI_TEXT } from '../lib/navigation-constants';
import {
  MOBILE_HOME_BODY_FONT_SIZE,
  MOBILE_HOME_CARD_RADIUS,
  MOBILE_HOME_PAGE_PADDING,
  MOBILE_HOME_PAGER_TRANSITION_MS,
  MOBILE_HOME_PILL_RADIUS,
  MOBILE_HOME_SECTION_GAP,
  MOBILE_HOME_TAB_FONT_SIZE,
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
import type { Task } from '../types';

const PAGES = [
  { id: 'schedule', label: MOBILE_HOME_UI_TEXT.tabs.schedule },
  { id: 'unfinished', label: MOBILE_HOME_UI_TEXT.tabs.unfinished },
  { id: 'to-place', label: MOBILE_HOME_UI_TEXT.tabs.toPlace },
] as const;

interface MobileHomePagerProps {
  onRunScheduler: () => void;
  isScheduling: boolean;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function workStartTodayIso(): string {
  const [hourText, minuteText] = DEFAULT_WEEKDAY_WORK_START.split(':');
  const date = new Date();
  date.setHours(Number(hourText), Number(minuteText), 0, 0);
  return date.toISOString();
}

function unfinishedStatus(task: Task, now: Date): string {
  if (!task.scheduledDate) return MOBILE_HOME_UI_TEXT.statusRolled;
  const target = task.scheduledDate ? new Date(task.scheduledDate) : null;
  if (target && isSameCalendarDay(target, now)) return MOBILE_HOME_UI_TEXT.statusPastSlot;
  return MOBILE_HOME_UI_TEXT.statusOverdue;
}

export function MobileHomePager({ onRunScheduler, isScheduling }: MobileHomePagerProps) {
  const { tasks, updateTask } = useTasks();
  const { settings: aiSettings } = useAI();
  const { hasFeature } = useSubscription();
  const { generateSchedulePlan, applySchedulePlan } = useAIScheduler();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReducedMotion(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const now = useMemo(() => new Date(), [tasks]);

  const unfinished = useMemo(
    () =>
      tasks.filter((task) => {
        if (task.status === 'done') return false;
        if (task.recurrence && task.recurrence.type !== 'none') return false;
        return isTaskOverdue(task, now);
      }),
    [tasks, now],
  );

  const toPlace = useMemo(() => {
    const unfinishedIds = new Set(unfinished.map((task) => task.id));
    return tasks.filter(
      (task) => task.status !== 'done' && !task.scheduledDate && !unfinishedIds.has(task.id),
    );
  }, [tasks, unfinished]);

  const goToPage = useCallback(
    (index: number) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      scroller.scrollTo({
        left: scroller.clientWidth * index,
        behavior: reducedMotion ? 'auto' : 'smooth',
      });
      setPage(index);
    },
    [reducedMotion],
  );

  const handleScroll = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller || scroller.clientWidth === 0) return;
    const index = Math.round(scroller.scrollLeft / scroller.clientWidth);
    setPage(Math.min(PAGES.length - 1, Math.max(0, index)));
  }, []);

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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        className="flex shrink-0"
        role="tablist"
        aria-label="Home"
        style={{
          gap: MOBILE_HOME_SECTION_GAP,
          padding: MOBILE_HOME_PAGE_PADDING,
          paddingBottom: 0,
        }}
      >
        {PAGES.map((item, index) => {
          const selected = page === index;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={selected}
              className={cn(
                'min-w-0 flex-1 font-semibold',
                selected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground',
              )}
              style={{
                minHeight: MOBILE_HOME_TAP_TARGET_PX,
                borderRadius: MOBILE_HOME_PILL_RADIUS,
                fontSize: MOBILE_HOME_TAB_FONT_SIZE,
              }}
              onClick={() => goToPage(index)}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div
        ref={scrollerRef}
        className="flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden"
        style={{
          scrollSnapType: 'x mandatory',
          scrollBehavior: reducedMotion ? 'auto' : 'smooth',
          scrollbarWidth: 'none',
          transitionDuration: `${MOBILE_HOME_PAGER_TRANSITION_MS}ms`,
        }}
        onScroll={handleScroll}
      >
        <section
          className="h-full min-h-0 shrink-0 overflow-y-auto"
          style={{ flex: '0 0 100%', scrollSnapAlign: 'start', padding: MOBILE_HOME_PAGE_PADDING }}
          aria-label={MOBILE_HOME_UI_TEXT.tabs.schedule}
        >
          <p className="text-foreground" style={{ fontSize: MOBILE_HOME_BODY_FONT_SIZE, marginBottom: MOBILE_HOME_SECTION_GAP }}>
            {MOBILE_HOME_UI_TEXT.scheduleHint}
          </p>
          <button
            type="button"
            className="mb-3 w-full bg-primary font-semibold text-primary-foreground disabled:opacity-60"
            style={{
              minHeight: MOBILE_HOME_TAP_TARGET_PX,
              borderRadius: MOBILE_HOME_CARD_RADIUS,
              fontSize: MOBILE_HOME_BODY_FONT_SIZE,
            }}
            disabled={isScheduling}
            onClick={onRunScheduler}
          >
            {isScheduling ? MOBILE_HOME_UI_TEXT.scheduling : MOBILE_HOME_UI_TEXT.scheduleAction}
          </button>
          <Suspense fallback={null}>
            <TodayAgendaView hideHeader />
          </Suspense>
        </section>

        <section
          className="h-full min-h-0 shrink-0 overflow-y-auto"
          style={{ flex: '0 0 100%', scrollSnapAlign: 'start', padding: MOBILE_HOME_PAGE_PADDING }}
          aria-label={MOBILE_HOME_UI_TEXT.tabs.unfinished}
        >
          <h2 className="font-semibold text-foreground" style={{ fontSize: MOBILE_HOME_BODY_FONT_SIZE }}>
            {MOBILE_HOME_UI_TEXT.unfinishedTitle}
          </h2>
          <p className="text-foreground" style={{ fontSize: MOBILE_HOME_TAB_FONT_SIZE, marginTop: '0.25rem', marginBottom: MOBILE_HOME_SECTION_GAP }}>
            {MOBILE_HOME_UI_TEXT.unfinishedHint}
          </p>
          {unfinished.length === 0 ? (
            <p className="text-foreground" style={{ fontSize: MOBILE_HOME_BODY_FONT_SIZE }}>
              {MOBILE_HOME_UI_TEXT.unfinishedEmpty}
            </p>
          ) : (
            <ul className="flex flex-col" style={{ gap: MOBILE_HOME_SECTION_GAP }}>
              {unfinished.map((task) => (
                <li
                  key={task.id}
                  className="border border-border bg-card text-card-foreground"
                  style={{ borderRadius: MOBILE_HOME_CARD_RADIUS, padding: MOBILE_HOME_PAGE_PADDING }}
                >
                  <p className="font-semibold" style={{ fontSize: MOBILE_HOME_BODY_FONT_SIZE }}>
                    {task.title}
                  </p>
                  <p className="mt-1 font-medium text-foreground" style={{ fontSize: MOBILE_HOME_TAB_FONT_SIZE }}>
                    {unfinishedStatus(task, now)}
                  </p>
                  <div className="mt-3 flex flex-col" style={{ gap: '0.5rem' }}>
                    <ActionButton
                      label={MOBILE_HOME_UI_TEXT.actionReschedule}
                      disabled={busyTaskId === task.id}
                      primary
                      onClick={() => void rescheduleTask(task)}
                    />
                    <ActionButton
                      label={MOBILE_HOME_UI_TEXT.actionToday}
                      disabled={busyTaskId === task.id}
                      onClick={() => void moveToToday(task)}
                    />
                    <ActionButton
                      label={MOBILE_HOME_UI_TEXT.actionDone}
                      disabled={busyTaskId === task.id}
                      onClick={() => void markDone(task)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section
          className="h-full min-h-0 shrink-0 overflow-y-auto"
          style={{ flex: '0 0 100%', scrollSnapAlign: 'start', padding: MOBILE_HOME_PAGE_PADDING }}
          aria-label={MOBILE_HOME_UI_TEXT.tabs.toPlace}
        >
          <p className="text-foreground" style={{ fontSize: MOBILE_HOME_BODY_FONT_SIZE, marginBottom: MOBILE_HOME_SECTION_GAP }}>
            {MOBILE_HOME_UI_TEXT.toPlaceHint}
          </p>
          <button
            type="button"
            className="mb-3 w-full bg-primary font-semibold text-primary-foreground disabled:opacity-60"
            style={{
              minHeight: MOBILE_HOME_TAP_TARGET_PX,
              borderRadius: MOBILE_HOME_CARD_RADIUS,
              fontSize: MOBILE_HOME_BODY_FONT_SIZE,
            }}
            disabled={isScheduling || toPlace.length === 0}
            onClick={onRunScheduler}
          >
            {isScheduling ? MOBILE_HOME_UI_TEXT.scheduling : MOBILE_HOME_UI_TEXT.toPlaceAction}
          </button>
          {toPlace.length === 0 ? (
            <p className="text-foreground" style={{ fontSize: MOBILE_HOME_BODY_FONT_SIZE }}>
              {MOBILE_HOME_UI_TEXT.toPlaceEmpty}
            </p>
          ) : (
            <ul className="flex flex-col" style={{ gap: MOBILE_HOME_SECTION_GAP }}>
              {toPlace.map((task) => (
                <li
                  key={task.id}
                  className="border border-border bg-card text-card-foreground"
                  style={{ borderRadius: MOBILE_HOME_CARD_RADIUS, padding: MOBILE_HOME_PAGE_PADDING }}
                >
                  <p className="font-semibold" style={{ fontSize: MOBILE_HOME_BODY_FONT_SIZE }}>
                    {task.title}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  disabled,
  primary = false,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'w-full font-semibold disabled:opacity-60',
        primary ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
      )}
      style={{
        minHeight: MOBILE_HOME_TAP_TARGET_PX,
        borderRadius: MOBILE_HOME_CARD_RADIUS,
        fontSize: MOBILE_HOME_BODY_FONT_SIZE,
      }}
    >
      {label}
    </button>
  );
}
