import React, { useEffect, useMemo, useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { useTasks } from '../contexts/TaskContext';
import { useAuth } from '../contexts/AuthContext';
import { completedCountByRecentMonth, isUnfinishedTask, tasksScheduledOn, tasksToPlace } from '../lib/home-task-groups';
import { MOBILE_HOME_UI_TEXT } from '../lib/navigation-constants';
import { greetingLine, PlaceTasksButton, SummaryCard } from './HomeSummary';
import { PastelTaskCard, TaskTimelineRow } from './PastelTaskCard';
import {
  MOBILE_HOME_BODY_FONT_SIZE,
  MOBILE_HOME_CARD_RADIUS,
  MOBILE_HOME_CHART_HEIGHT_PX,
  MOBILE_HOME_PAGE_PADDING,
  MOBILE_HOME_SECTION_GAP,
  MOBILE_HOME_TAB_FONT_SIZE,
  MOBILE_HOME_LABEL_GAP,
} from '../lib/layout-constants';
import { COLOR_BACKGROUND_GRAY, COLOR_BACKGROUND_WHITE, COLOR_PASTEL_YELLOW, COLOR_TEXT_PRIMARY } from '../lib/color-theme';
import { getDateString } from '../lib/utils';
import { TaskDialog } from './TaskDialog';
import { WeekBoard } from './WeekBoard';
import type { Task } from '../types';

interface DesktopHomeProps {
  onRunScheduler: () => void;
  isScheduling: boolean;
}

export function DesktopHome({ onRunScheduler, isScheduling }: DesktopHomeProps) {
  const { tasks } = useTasks();
  const { user } = useAuth();
  const [editorTask, setEditorTask] = useState<Task | null>(null);
  const now = useMemo(() => new Date(), [tasks]);
  const unfinished = useMemo(() => tasks.filter((task) => isUnfinishedTask(task, now)), [tasks, now]);
  const toPlace = useMemo(() => tasksToPlace(tasks, unfinished), [tasks, unfinished]);
  const upcoming = useMemo(() => tasksScheduledOn(tasks, now), [tasks, now]);
  const doneCount = useMemo(() => tasks.filter((task) => task.status === 'done').length, [tasks]);
  const months = useMemo(() => completedCountByRecentMonth(tasks, now), [tasks, now]);
  const peak = months.reduce((best, month) => Math.max(best, month.count), 0);
  const name = user?.name || '';

  useEffect(() => {
    const showWeek = () => {
      document.getElementById('home-week')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    window.addEventListener('taskzm-show-week', showWeek);
    return () => window.removeEventListener('taskzm-show-week', showWeek);
  }, []);
  const nextUnfinished = unfinished[0];
  const nextToPlace = toPlace[0];

  return (
    <div
      className="h-full overflow-y-auto"
      style={{
        background: COLOR_BACKGROUND_GRAY,
        padding: MOBILE_HOME_PAGE_PADDING,
        color: COLOR_TEXT_PRIMARY,
      }}
    >
      <h2 style={{ margin: 0, fontSize: MOBILE_HOME_BODY_FONT_SIZE, fontWeight: 500 }}>
        {MOBILE_HOME_UI_TEXT.greetingHello} {greetingLine(now)}{name ? `, ${name}` : ''}
      </h2>

      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: MOBILE_HOME_SECTION_GAP,
          marginTop: MOBILE_HOME_SECTION_GAP,
        }}
      >
        <SummaryCard compact accent label={MOBILE_HOME_UI_TEXT.summaryUnfinished} value={unfinished.length} />
        <SummaryCard compact label={MOBILE_HOME_UI_TEXT.summaryToPlace} value={toPlace.length} />
        <SummaryCard compact label={MOBILE_HOME_UI_TEXT.summaryScheduledToday} value={upcoming.length} />
        <SummaryCard compact label={MOBILE_HOME_UI_TEXT.summaryDone} value={doneCount} />
      </div>
      <div style={{ marginTop: MOBILE_HOME_SECTION_GAP }}>
        <PlaceTasksButton busy={isScheduling} onClick={onRunScheduler} />
        <p style={{ fontSize: MOBILE_HOME_TAB_FONT_SIZE, margin: `${MOBILE_HOME_LABEL_GAP} 0 0` }}>
          {MOBILE_HOME_UI_TEXT.scheduleHint}
        </p>
      </div>

      <div
        className="grid"
        style={{
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)',
          gap: MOBILE_HOME_SECTION_GAP,
          marginTop: MOBILE_HOME_SECTION_GAP,
        }}
      >
        <section
          style={{
            background: COLOR_BACKGROUND_WHITE,
            borderRadius: MOBILE_HOME_CARD_RADIUS,
            padding: MOBILE_HOME_PAGE_PADDING,
          }}
        >
          <h2 style={{ margin: 0, fontSize: MOBILE_HOME_BODY_FONT_SIZE, fontWeight: 500 }}>
            {MOBILE_HOME_UI_TEXT.activityTitle}
          </h2>
          <div
            className="flex items-end"
            style={{ height: MOBILE_HOME_CHART_HEIGHT_PX, gap: MOBILE_HOME_SECTION_GAP, marginTop: MOBILE_HOME_SECTION_GAP }}
            role="img"
            aria-label={MOBILE_HOME_UI_TEXT.activityTitle}
          >
            {months.map((month) => {
              const height = peak === 0 ? 0 : (month.count / peak) * MOBILE_HOME_CHART_HEIGHT_PX;
              const highlighted = peak > 0 && month.count === peak;
              return (
                <div key={month.label} className="flex min-w-0 flex-1 flex-col items-center justify-end" style={{ height: '100%' }}>
                  <div
                    style={{
                      width: '100%',
                      height,
                      borderRadius: MOBILE_HOME_CARD_RADIUS,
                      background: highlighted ? COLOR_PASTEL_YELLOW : COLOR_BACKGROUND_GRAY,
                    }}
                  />
                  <span style={{ fontSize: MOBILE_HOME_TAB_FONT_SIZE, marginTop: MOBILE_HOME_SECTION_GAP }}>{month.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col" style={{ gap: MOBILE_HOME_SECTION_GAP }}>
          <h2 style={{ margin: 0, fontSize: MOBILE_HOME_BODY_FONT_SIZE, fontWeight: 500 }}>
            {MOBILE_HOME_UI_TEXT.upcomingTitle}
          </h2>
          {upcoming.length === 0 ? (
            <p style={{ margin: 0 }}>{MOBILE_HOME_UI_TEXT.weekEmpty}</p>
          ) : (
            upcoming.slice(0, 4).map((task) => (
              <TaskTimelineRow key={task.id} task={task}>
                <WeekDraggable task={task} hideTime onOpen={() => setEditorTask(task)} />
              </TaskTimelineRow>
            ))
          )}
        </section>
      </div>

      <div
        className="grid"
        style={{
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: MOBILE_HOME_SECTION_GAP,
          marginTop: MOBILE_HOME_SECTION_GAP,
        }}
      >
        {nextUnfinished ? (
          <button
            type="button"
            className="text-left"
            style={{
              background: COLOR_BACKGROUND_WHITE,
              borderRadius: MOBILE_HOME_CARD_RADIUS,
              padding: MOBILE_HOME_PAGE_PADDING,
              border: 'none',
              color: COLOR_TEXT_PRIMARY,
            }}
            onClick={() => setEditorTask(nextUnfinished)}
          >
            <p style={{ margin: 0, fontSize: MOBILE_HOME_TAB_FONT_SIZE }}>{MOBILE_HOME_UI_TEXT.summaryUnfinished}</p>
            <p style={{ margin: 0, fontWeight: 500 }}>{nextUnfinished.title}</p>
          </button>
        ) : null}
        {nextToPlace ? (
          <button
            type="button"
            className="text-left"
            style={{
              background: COLOR_BACKGROUND_WHITE,
              borderRadius: MOBILE_HOME_CARD_RADIUS,
              padding: MOBILE_HOME_PAGE_PADDING,
              border: 'none',
              color: COLOR_TEXT_PRIMARY,
            }}
            onClick={() => setEditorTask(nextToPlace)}
          >
            <p style={{ margin: 0, fontSize: MOBILE_HOME_TAB_FONT_SIZE }}>{MOBILE_HOME_UI_TEXT.needsTime}</p>
            <p style={{ margin: 0, fontWeight: 500 }}>{nextToPlace.title}</p>
          </button>
        ) : null}
      </div>

      <div style={{ marginTop: MOBILE_HOME_SECTION_GAP }}>
        <WeekBoard embedded onOpenTask={setEditorTask} />
      </div>

      {editorTask ? (
        <TaskDialog open task={editorTask} onClose={() => setEditorTask(null)} initialDate={getDateString(now)} />
      ) : null}
    </div>
  );
}

function WeekDraggable({ task, onOpen, hideTime }: { task: Task; onOpen: () => void; hideTime?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <PastelTaskCard task={task} hideTime={hideTime} onOpen={onOpen} />
    </div>
  );
}
