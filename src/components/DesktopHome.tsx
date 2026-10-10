import React, { useEffect, useMemo } from 'react';
import { useSheetItem } from '../hooks/useSheetItem';
import { useDraggable } from '@dnd-kit/core';
import { useTasks } from '../contexts/TaskContext';
import { completedCountByRecentMonth, homeAgendaOn, isUnfinishedTask, tasksScheduledOn, tasksToPlace } from '../lib/home-task-groups';
import { useCalendarEvents } from '../hooks/useCalendarEvents';
import { HOME_UPCOMING_PREVIEW_COUNT } from '../lib/business-constants';
import { MOBILE_HOME_UI_TEXT } from '../lib/navigation-constants';
import { PlaceTasksButton, SummaryCard } from './HomeSummary';
import { EventTimelineRow, PastelEventCard, PastelTaskCard, TaskTimelineRow } from './PastelTaskCard';
import {
  MOBILE_HOME_BODY_FONT_SIZE,
  MOBILE_HOME_CARD_RADIUS,
  MOBILE_HOME_CHART_HEIGHT_PX,
  MOBILE_HOME_PAGE_PADDING,
  MOBILE_HOME_SECTION_GAP,
  MOBILE_HOME_TAB_FONT_SIZE,
  MOBILE_HOME_LABEL_GAP,
} from '../lib/layout-constants';
import { THEME_COLOR } from '../lib/color-theme';
import { dateStringToLocalDate, getDateString } from '../lib/utils';
import { TaskDialog } from './TaskDialog';
import { WeekBoard } from './WeekBoard';
import type { Task } from '../types';

interface DesktopHomeProps {
  onRunScheduler: () => void;
  isScheduling: boolean;
}

export function DesktopHome({ onRunScheduler, isScheduling }: DesktopHomeProps) {
  const { tasks } = useTasks();
  const editor = useSheetItem<Task>();
  const editorTask = editor.item;
  const setEditorTask = editor.show;
  const now = useMemo(() => new Date(), [tasks]);
  const unfinished = useMemo(() => tasks.filter((task) => isUnfinishedTask(task, now)), [tasks, now]);
  const toPlace = useMemo(() => tasksToPlace(tasks, unfinished), [tasks, unfinished]);
  const upcoming = useMemo(() => tasksScheduledOn(tasks, now), [tasks, now]);
  const todayKey = getDateString(now);
  const { dayStart, dayEnd } = useMemo(() => {
    const start = dateStringToLocalDate(todayKey);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setMilliseconds(-1);
    return { dayStart: start, dayEnd: end };
  }, [todayKey]);
  const { events } = useCalendarEvents(dayStart, dayEnd);
  const agenda = useMemo(() => homeAgendaOn(tasks, events, now), [tasks, events, now]);
  const doneCount = useMemo(() => tasks.filter((task) => task.status === 'done').length, [tasks]);
  const months = useMemo(() => completedCountByRecentMonth(tasks, now), [tasks, now]);
  const peak = months.reduce((best, month) => Math.max(best, month.count), 0);

  useEffect(() => {
    const showWeek = () => {
      document.getElementById('home-week')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    window.addEventListener('taskzm-show-week', showWeek);
    return () => window.removeEventListener('taskzm-show-week', showWeek);
  }, []);
  return (
    <div
      className="h-full overflow-y-auto"
      style={{
        background: THEME_COLOR.page,
        padding: MOBILE_HOME_PAGE_PADDING,
        color: THEME_COLOR.text,
      }}
    >
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
      <div className="flex flex-col items-center" style={{ marginTop: MOBILE_HOME_SECTION_GAP, gap: MOBILE_HOME_LABEL_GAP }}>
        <PlaceTasksButton busy={isScheduling} onClick={onRunScheduler} />
        <p style={{ fontSize: MOBILE_HOME_TAB_FONT_SIZE, margin: 0, textAlign: 'center' }}>
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
            background: THEME_COLOR.surface,
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
                      background: highlighted ? THEME_COLOR.highlight : THEME_COLOR.muted,
                    }}
                  />
                  <span style={{ fontSize: MOBILE_HOME_TAB_FONT_SIZE, marginTop: MOBILE_HOME_SECTION_GAP }}>{month.label}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col" data-tour="home-agenda" style={{ gap: MOBILE_HOME_SECTION_GAP }}>
          {agenda.length === 0 ? (
            <p style={{ margin: 0 }}>{MOBILE_HOME_UI_TEXT.weekEmpty}</p>
          ) : (
            agenda.slice(0, HOME_UPCOMING_PREVIEW_COUNT).map((item, index) => (
              <div key={item.key} className={index === 0 ? 'taskzm-up-next' : undefined}>
                {index === 0 ? (
                  <p className="flex items-center font-medium text-primary" style={{ fontSize: MOBILE_HOME_TAB_FONT_SIZE, margin: `0 0 ${MOBILE_HOME_LABEL_GAP}`, gap: MOBILE_HOME_LABEL_GAP }}>
                    <span aria-hidden className="taskzm-up-next-dot" />
                    {MOBILE_HOME_UI_TEXT.upNext}
                  </p>
                ) : null}
                {item.kind === 'task' ? (
                  <TaskTimelineRow task={item.task}>
                    <WeekDraggable task={item.task} hideTime onOpen={() => setEditorTask(item.task)} />
                  </TaskTimelineRow>
                ) : (
                  <EventTimelineRow event={item.event}>
                    <PastelEventCard event={item.event} hideTime />
                  </EventTimelineRow>
                )}
              </div>
            ))
          )}
        </section>
      </div>

      <div style={{ marginTop: MOBILE_HOME_SECTION_GAP }}>
        <WeekBoard embedded onOpenTask={setEditorTask} />
      </div>

      {editorTask ? (
        <TaskDialog open={editor.open} task={editorTask} onClose={editor.close} initialDate={getDateString(now)} />
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
