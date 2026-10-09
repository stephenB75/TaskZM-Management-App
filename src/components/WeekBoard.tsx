import React, { useMemo, useState } from 'react';
import { useTasks } from '../contexts/TaskContext';
import { DroppableColumn } from './DroppableColumn';
import { PastelTaskCard } from './PastelTaskCard';
import { TaskDialog } from './TaskDialog';
import { tasksScheduledOn } from '../lib/home-task-groups';
import { MOBILE_HOME_UI_TEXT } from '../lib/navigation-constants';
import { DAYS_IN_WEEK } from '../lib/business-constants';
import {
  HEADER_HEIGHT,
  MOBILE_HOME_BODY_FONT_SIZE,
  MOBILE_HOME_DAY_RULE_PX,
  MOBILE_HOME_DOT_SIZE_PX,
  MOBILE_HOME_LABEL_GAP,
  MOBILE_HOME_PAGE_PADDING,
  MOBILE_HOME_PILL_RADIUS,
  MOBILE_HOME_SECTION_GAP,
  MOBILE_HOME_TAB_FONT_SIZE,
  MOBILE_HOME_TAP_TARGET_PX,
} from '../lib/layout-constants';
import { KANBAN_COLUMN_DIMENSIONS } from '../lib/kanban-constants';
import { COLOR_PRIMARY, COLOR_TEXT_PRIMARY } from '../lib/color-theme';
import { getDateString, getWeekStart } from '../lib/utils';
import { clearEditingScrollPad, revealTaskAboveDialog } from '../lib/reveal-editing-task';
import { useDraggable } from '@dnd-kit/core';
import type { Task } from '../types';

function startOfDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function weekDates(anchor: Date): Date[] {
  const start = startOfDay(anchor);
  const weekStartsMonday = getWeekStart() === 'monday';
  const day = start.getDay();
  const offset = weekStartsMonday ? (day === 0 ? DAYS_IN_WEEK - 1 : day - 1) : day;
  start.setDate(start.getDate() - offset);
  return Array.from({ length: DAYS_IN_WEEK }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
}

export function WeekBoard({
  embedded = false,
  onOpenTask,
}: {
  embedded?: boolean;
  onOpenTask?: (task: Task) => void;
}) {
  const { tasks } = useTasks();
  const [anchor, setAnchor] = useState(() => startOfDay(new Date()));
  const [localTask, setLocalTask] = useState<Task | null>(null);
  const days = useMemo(() => weekDates(anchor), [anchor]);
  const today = startOfDay(new Date());
  const todayKey = getDateString(today);
  const [selectedKey, setSelectedKey] = useState(todayKey);
  const currentWeekStart = weekDates(today)[0].getTime();
  const showingCurrentWeek = days[0].getTime() === currentWeekStart;

  const showDesktopWeek = (upcoming: boolean) => {
    const next = new Date(today);
    if (upcoming) next.setDate(next.getDate() + DAYS_IN_WEEK);
    setAnchor(startOfDay(next));
  };
  const selected = days.find((day) => getDateString(day) === selectedKey) ?? days[0];
  const selectedTasks = tasksScheduledOn(tasks, selected);

  const shiftWeek = (amount: number) => {
    setAnchor((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + amount);
      return next;
    });
  };

  const openTask = (task: Task) => {
    if (onOpenTask) onOpenTask(task);
    else setLocalTask(task);
    revealTaskAboveDialog(task.id);
  };

  return (
    <section
      id="home-week"
      className={embedded ? 'min-w-0' : 'flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-white'}
      style={{ padding: embedded ? 0 : MOBILE_HOME_PAGE_PADDING, color: COLOR_TEXT_PRIMARY }}
    >
      <div className="flex items-center" style={{ gap: MOBILE_HOME_SECTION_GAP, marginBottom: MOBILE_HOME_SECTION_GAP }}>
        {embedded ? (
          <>
            <button
              type="button"
              className="font-semibold text-foreground"
              style={{ ...weekChoiceStyle(false), opacity: showingCurrentWeek ? 0.4 : 1 }}
              disabled={showingCurrentWeek}
              onClick={() => showDesktopWeek(false)}
            >
              {MOBILE_HOME_UI_TEXT.previousWeek}
            </button>
            <button
              type="button"
              className="font-semibold text-foreground"
              style={{ ...weekChoiceStyle(false), opacity: showingCurrentWeek ? 1 : 0.4 }}
              disabled={!showingCurrentWeek}
              onClick={() => showDesktopWeek(true)}
            >
              {MOBILE_HOME_UI_TEXT.nextWeek}
            </button>
          </>
        ) : (
          <>
            <button type="button" className="font-semibold text-foreground" style={dayButtonStyle} onClick={() => shiftWeek(-DAYS_IN_WEEK)}>
              {MOBILE_HOME_UI_TEXT.previousWeek}
            </button>
            <button type="button" className="font-semibold text-foreground" style={dayButtonStyle} onClick={() => shiftWeek(DAYS_IN_WEEK)}>
              {MOBILE_HOME_UI_TEXT.nextWeek}
            </button>
          </>
        )}
        <span className="min-w-0 truncate font-medium" style={{ fontSize: MOBILE_HOME_BODY_FONT_SIZE }}>
          {days[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          {' – '}
          {days[days.length - 1].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
      </div>
      {embedded ? (
        <div className="min-w-0 overflow-x-auto">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${DAYS_IN_WEEK}, max-content)`,
            gap: MOBILE_HOME_SECTION_GAP,
            width: 'max-content',
          }}
        >
          {days.map((day) => {
            const dayTasks = tasksScheduledOn(tasks, day);
            return (
              <div key={getDateString(day)} style={{ minWidth: KANBAN_COLUMN_DIMENSIONS.width.desktop }}>
              <DroppableColumn id={getDateString(day)}>
                <h2 style={{ margin: 0, fontSize: MOBILE_HOME_TAB_FONT_SIZE, fontWeight: 500 }}>
                  {day.toLocaleDateString(undefined, { weekday: 'short' })} {day.getDate()}
                </h2>
                <ul className="flex flex-col" style={{ gap: MOBILE_HOME_SECTION_GAP, marginTop: MOBILE_HOME_SECTION_GAP }}>
                  {dayTasks.length === 0 ? (
                    <li style={{ color: COLOR_TEXT_PRIMARY, fontSize: MOBILE_HOME_TAB_FONT_SIZE }}>{MOBILE_HOME_UI_TEXT.weekEmpty}</li>
                  ) : (
                    dayTasks.map((task) => (
                      <li key={task.id} id={`home-task-${task.id}`} style={{ scrollMarginTop: HEADER_HEIGHT }}>
                        <DraggableWeekCard task={task} fullTitle onOpen={() => openTask(task)} />
                      </li>
                    ))
                  )}
                </ul>
              </DroppableColumn>
              </div>
            );
          })}
        </div>
        </div>
      ) : (
        <>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${DAYS_IN_WEEK}, minmax(0, 1fr))`, marginBottom: MOBILE_HOME_SECTION_GAP }}>
            {days.map((day) => {
              const dateKey = getDateString(day);
              const isSelected = dateKey === getDateString(selected);
              const hasTasks = tasksScheduledOn(tasks, day).length > 0;
              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => setSelectedKey(dateKey)}
                  className="bg-transparent font-medium"
                  style={{
                    border: 'none',
                    padding: 0,
                    color: isSelected ? undefined : COLOR_TEXT_PRIMARY,
                  }}
                >
                  <span className="block" style={{ fontSize: MOBILE_HOME_TAB_FONT_SIZE }}>
                    {day.toLocaleDateString(undefined, { weekday: 'narrow' })}
                  </span>
                  <span
                    aria-hidden
                    style={{
                      display: 'block',
                      height: MOBILE_HOME_DAY_RULE_PX,
                      margin: `${MOBILE_HOME_LABEL_GAP} 0`,
                      background: isSelected ? COLOR_PRIMARY : 'transparent',
                    }}
                  />
                  <span className={isSelected ? 'text-primary' : undefined} style={{ fontSize: MOBILE_HOME_BODY_FONT_SIZE }}>
                    {day.getDate()}
                  </span>
                  <span
                    aria-hidden
                    style={{
                      display: 'block',
                      width: MOBILE_HOME_DOT_SIZE_PX,
                      height: MOBILE_HOME_DOT_SIZE_PX,
                      margin: `${MOBILE_HOME_LABEL_GAP} auto 0`,
                      borderRadius: MOBILE_HOME_PILL_RADIUS,
                      background: hasTasks ? COLOR_PRIMARY : 'transparent',
                    }}
                  />
                </button>
              );
            })}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            <DroppableColumn id={getDateString(selected)} fillHeight className="h-full min-h-0">
              <h2 style={{ margin: 0, fontSize: MOBILE_HOME_BODY_FONT_SIZE, fontWeight: 500 }}>
                {selected.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
              </h2>
              <ul className="flex flex-col" style={{ gap: MOBILE_HOME_SECTION_GAP, marginTop: MOBILE_HOME_SECTION_GAP }}>
                {selectedTasks.length === 0 ? (
                  <li style={{ color: COLOR_TEXT_PRIMARY }}>{MOBILE_HOME_UI_TEXT.weekEmpty}</li>
                ) : (
                  selectedTasks.map((task) => (
                    <li key={task.id} id={`home-task-${task.id}`} style={{ scrollMarginTop: HEADER_HEIGHT }}>
                      <DraggableWeekCard task={task} onOpen={() => openTask(task)} />
                    </li>
                  ))
                )}
              </ul>
            </DroppableColumn>
          </div>
        </>
      )}
      {localTask ? (
        <TaskDialog
          open
          task={localTask}
          onClose={() => {
            clearEditingScrollPad(localTask.id);
            setLocalTask(null);
          }}
          initialDate={getDateString(selected)}
        />
      ) : null}
    </section>
  );
}

function weekChoiceStyle(selected: boolean): React.CSSProperties {
  return {
    borderRadius: MOBILE_HOME_PILL_RADIUS,
    border: 'none',
    paddingLeft: MOBILE_HOME_PAGE_PADDING,
    paddingRight: MOBILE_HOME_PAGE_PADDING,
    paddingTop: MOBILE_HOME_LABEL_GAP,
    paddingBottom: MOBILE_HOME_LABEL_GAP,
    background: 'transparent',
    color: selected ? undefined : COLOR_TEXT_PRIMARY,
    boxShadow: selected ? 'inset 0 -2px 0 currentColor' : undefined,
  };
}

const dayButtonStyle: React.CSSProperties = {
  minHeight: MOBILE_HOME_TAP_TARGET_PX,
  borderRadius: MOBILE_HOME_PILL_RADIUS,
  border: 'none',
  paddingLeft: MOBILE_HOME_PAGE_PADDING,
  paddingRight: MOBILE_HOME_PAGE_PADDING,
  background: 'transparent',
};

function DraggableWeekCard({ task, onOpen, fullTitle = false }: { task: Task; onOpen: () => void; fullTitle?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <PastelTaskCard task={task} onOpen={onOpen} fullTitle={fullTitle} />
    </div>
  );
}
