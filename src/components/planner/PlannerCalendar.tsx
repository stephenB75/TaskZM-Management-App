import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { Icon } from '../Icon';
import { useTasks } from '../../contexts/TaskContext';
import { useSheetItem } from '../../hooks/useSheetItem';
import { useCalendarEvents, type CalendarEvent } from '../../hooks/useCalendarEvents';
import { useMobileLayout } from '../../hooks/useMobileLayout';
import { homeAgendaOn, isAllDayCalendarEvent, type HomeAgendaItem } from '../../lib/home-task-groups';
import { MOBILE_HOME_UI_TEXT, PLANNER_UI_TEXT } from '../../lib/navigation-constants';
import { PLANNER_LAYOUT } from '../../lib/layout-constants';
import {
  DAYS_IN_WEEK,
  MILLISECONDS_PER_MINUTE,
  MINUTES_PER_HOUR,
  PLANNER_GRID_END_HOUR,
  PLANNER_GRID_MIN_BLOCK_MINUTES,
  PLANNER_GRID_START_HOUR,
} from '../../lib/business-constants';
import { formatTimeAMPM, getDateString, parseCalendarEventTime } from '../../lib/utils';
import { startOfPlannerWeek } from '../../lib/planner-chat';
import { revealTaskAboveDialog } from '../../lib/reveal-editing-task';
import { triggerSelectionHaptic } from '../../lib/native-haptics';
import { TaskDialog } from '../TaskDialog';
import { MonthCalendarView } from '../MonthCalendarView';
import { SwipeToComplete } from '../SwipeToComplete';
import { PlannerTaskRow } from './PlannerTaskRow';
import { PlannerPriorityPill, plannerPriorityColor } from './PlannerPriorityPill';
import type { Task } from '../../types';

const TEXT = PLANNER_UI_TEXT.calendar;
type CalendarMode = 'week' | 'month';

function addDays(date: Date, amount: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function weekOf(anchor: Date): Date[] {
  const start = startOfPlannerWeek(anchor);
  return Array.from({ length: DAYS_IN_WEEK }, (_, index) => addDays(start, index));
}

function minutesIntoDay(date: Date): number {
  return date.getHours() * MINUTES_PER_HOUR + date.getMinutes();
}

function taskStart(task: Task): Date | null {
  if (!task.scheduledDate) return null;
  const start = new Date(task.scheduledDate);
  return Number.isNaN(start.getTime()) ? null : start;
}

function taskMeta(task: Task): string {
  return task.scheduledDate ? formatTimeAMPM(task.scheduledDate) ?? '' : '';
}

function eventTimeLabel(event: CalendarEvent): string {
  if (isAllDayCalendarEvent(event)) return MOBILE_HOME_UI_TEXT.allDay;
  return formatTimeAMPM(parseCalendarEventTime(event.start).toISOString()) ?? '';
}

function CalendarHeader({
  mode,
  anchor,
  onShift,
  onToday,
}: {
  mode: CalendarMode;
  anchor: Date;
  onShift: (direction: 1 | -1) => void;
  onToday: () => void;
}) {
  return (
    <header className="planner-header planner-calendar-header">
      <div className="min-w-0">
        <span className="planner-eyebrow">{mode === 'week' ? TEXT.eyebrowWeek : TEXT.eyebrowMonth}</span>
        <h2 className="planner-title">{anchor.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2>
      </div>
      {mode === 'week' ? (
        <div className="flex flex-none items-center gap-1">
          <button type="button" className="planner-icon-btn" aria-label={TEXT.previous} onClick={() => onShift(-1)}>
            <Icon name="chevron-left" size={PLANNER_LAYOUT.iconPx} />
          </button>
          <button type="button" className="planner-pill" onClick={onToday}>
            {TEXT.today}
          </button>
          <button type="button" className="planner-icon-btn" aria-label={TEXT.next} onClick={() => onShift(1)}>
            <Icon name="chevron-right" size={PLANNER_LAYOUT.iconPx} />
          </button>
        </div>
      ) : null}
    </header>
  );
}

function AgendaEventRow({ event }: { event: CalendarEvent }) {
  return (
    <div className="planner-tl-item">
      <span className="planner-dot planner-event-dot" style={{ background: event.calendarColor || 'var(--muted-foreground)' }} aria-hidden />
      <div className="planner-tl-body" style={{ cursor: 'default' }}>
        <small>{eventTimeLabel(event)}</small>
        <strong>{event.title}</strong>
        <span className="planner-tl-tags">
          <Icon name="calendar" size={PLANNER_LAYOUT.iconXsPx} />
          {[MOBILE_HOME_UI_TEXT.calendarTag, event.location].filter(Boolean).join(' · ')}
        </span>
      </div>
    </div>
  );
}

function MobileWeek({ anchor, onOpenTask }: { anchor: Date; onOpenTask: (task: Task) => void }) {
  const { tasks } = useTasks();
  const days = useMemo(() => weekOf(anchor), [anchor]);
  const todayKey = getDateString(new Date());
  const [selectedKey, setSelectedKey] = useState(() =>
    days.some((day) => getDateString(day) === todayKey) ? todayKey : getDateString(days[0]),
  );
  useEffect(() => {
    if (!days.some((day) => getDateString(day) === selectedKey)) {
      setSelectedKey(days.some((day) => getDateString(day) === todayKey) ? todayKey : getDateString(days[0]));
    }
  }, [days, selectedKey, todayKey]);

  const weekEnd = useMemo(() => {
    const end = addDays(days[days.length - 1], 1);
    end.setMilliseconds(-1);
    return end;
  }, [days]);
  const { events } = useCalendarEvents(days[0], weekEnd);
  const selected = days.find((day) => getDateString(day) === selectedKey) ?? days[0];
  const agenda: HomeAgendaItem[] = homeAgendaOn(tasks, events, selected);

  return (
    <>
      <div className="planner-daystrip" role="tablist">
        {days.map((day) => {
          const key = getDateString(day);
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={key === selectedKey}
              data-active={key === selectedKey ? 'true' : undefined}
              data-has-items={homeAgendaOn(tasks, events, day).length > 0 ? 'true' : undefined}
              onClick={() => {
                void triggerSelectionHaptic();
                setSelectedKey(key);
              }}
            >
              <span>{day.toLocaleDateString(undefined, { weekday: 'short' })}</span>
              <strong>{day.getDate()}</strong>
              <i aria-hidden />
            </button>
          );
        })}
      </div>
      <div className="planner-scroll">
        <div className="planner-agenda-heading">
          <div>
            <span className="planner-eyebrow">{TEXT.agendaEyebrow(selectedKey === todayKey)}</span>
            <h3 className="planner-title" style={{ fontSize: PLANNER_LAYOUT.agendaTitleFontPx }}>
              {selected.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </h3>
          </div>
          <b>{TEXT.taskCount(agenda.length)}</b>
        </div>
        {agenda.length === 0 ? (
          <div className="planner-empty">
            <Icon name="calendar-blank" size={PLANNER_LAYOUT.emptyIconPx} />
            <strong>{TEXT.emptyTitle}</strong>
            <span>{TEXT.emptyHint}</span>
          </div>
        ) : (
          <div className="planner-agenda-list">
            {agenda.map((item) =>
              item.kind === 'task' ? (
                <div key={item.key} id={`home-task-${item.task.id}`}>
                  <SwipeToComplete task={item.task}>
                    <PlannerTaskRow task={item.task} meta={taskMeta(item.task)} onOpen={() => onOpenTask(item.task)} />
                  </SwipeToComplete>
                </div>
              ) : (
                <AgendaEventRow key={item.key} event={item.event} />
              ),
            )}
          </div>
        )}
      </div>
    </>
  );
}

interface PositionedBlock {
  key: string;
  top: number;
  height: number;
  lane: number;
  lanes: number;
  task?: Task;
  event?: CalendarEvent;
}

/** Stack overlapping blocks side by side so none hide each other. */
function layoutBlocks(blocks: Omit<PositionedBlock, 'lane' | 'lanes'>[]): PositionedBlock[] {
  const sorted = [...blocks].sort((a, b) => a.top - b.top);
  const result: PositionedBlock[] = [];
  let cluster: PositionedBlock[] = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const lanes = cluster.reduce((max, block) => Math.max(max, block.lane + 1), 1);
    cluster.forEach((block) => result.push({ ...block, lanes }));
    cluster = [];
  };
  for (const block of sorted) {
    if (block.top >= clusterEnd) {
      flush();
      clusterEnd = -Infinity;
    }
    const used = new Set(cluster.filter((other) => other.top + other.height > block.top).map((other) => other.lane));
    let lane = 0;
    while (used.has(lane)) lane += 1;
    cluster.push({ ...block, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, block.top + block.height);
  }
  flush();
  return result;
}

function WeekTaskBlock({ block, onOpen }: { block: PositionedBlock; onOpen: () => void }) {
  const task = block.task as Task;
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const width = `calc((100% - ${PLANNER_LAYOUT.blockInsetPx * 2}px) / ${block.lanes})`;
  return (
    <button
      ref={setNodeRef}
      type="button"
      className="planner-block"
      data-task-id={task.id}
      data-done={task.status === 'done' ? 'true' : undefined}
      data-dragging={isDragging ? 'true' : undefined}
      onClick={onOpen}
      {...listeners}
      {...attributes}
      style={{
        top: block.top,
        height: block.height,
        left: `calc(${PLANNER_LAYOUT.blockInsetPx}px + ${width} * ${block.lane})`,
        width,
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        ['--planner-bar' as string]: plannerPriorityColor(task.priority),
      }}
    >
      <strong>{task.title}</strong>
      <small>
        {taskMeta(task)}
        <PlannerPriorityPill priority={task.priority} />
      </small>
    </button>
  );
}

function WeekDayColumn({
  day,
  startHour,
  hours,
  blocks,
  isToday,
  onOpenTask,
}: {
  day: Date;
  startHour: number;
  hours: number;
  blocks: PositionedBlock[];
  isToday: boolean;
  onOpenTask: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: getDateString(day) });
  const pxPerMinute = PLANNER_LAYOUT.hourHeightPx / MINUTES_PER_HOUR;
  const now = new Date();
  const nowTop = (minutesIntoDay(now) - startHour * MINUTES_PER_HOUR) * pxPerMinute;
  return (
    <div
      ref={setNodeRef}
      className="planner-week-col"
      data-today={isToday ? 'true' : undefined}
      data-over={isOver ? 'true' : undefined}
      style={{ height: hours * PLANNER_LAYOUT.hourHeightPx }}
    >
      {blocks.map((block) =>
        block.task ? (
          <WeekTaskBlock key={block.key} block={block} onOpen={() => onOpenTask(block.task as Task)} />
        ) : (
          <div
            key={block.key}
            className="planner-block"
            data-event="true"
            style={{
              top: block.top,
              height: block.height,
              left: `calc(${PLANNER_LAYOUT.blockInsetPx}px + (100% - ${PLANNER_LAYOUT.blockInsetPx * 2}px) / ${block.lanes} * ${block.lane})`,
              width: `calc((100% - ${PLANNER_LAYOUT.blockInsetPx * 2}px) / ${block.lanes})`,
              ['--planner-bar' as string]: block.event?.calendarColor || 'var(--muted-foreground)',
            }}
          >
            <strong>{block.event?.title}</strong>
            <small>{block.event ? eventTimeLabel(block.event) : ''}</small>
          </div>
        ),
      )}
      {isToday && nowTop >= 0 && nowTop <= hours * PLANNER_LAYOUT.hourHeightPx ? (
        <div className="planner-now-line" style={{ top: nowTop }} aria-hidden />
      ) : null}
    </div>
  );
}

function DesktopWeek({ anchor, onOpenTask }: { anchor: Date; onOpenTask: (task: Task) => void }) {
  const { tasks } = useTasks();
  const scrollRef = useRef<HTMLDivElement>(null);
  const days = useMemo(() => weekOf(anchor), [anchor]);
  const weekEnd = useMemo(() => {
    const end = addDays(days[days.length - 1], 1);
    end.setMilliseconds(-1);
    return end;
  }, [days]);
  const { events } = useCalendarEvents(days[0], weekEnd);
  const todayKey = getDateString(new Date());

  const perDay = useMemo(
    () =>
      days.map((day) => {
        const agenda = homeAgendaOn(tasks, events, day);
        const allDay = agenda.filter(
          (item): item is Extract<HomeAgendaItem, { kind: 'event' }> => item.kind === 'event' && isAllDayCalendarEvent(item.event),
        );
        const timed = agenda.filter((item) => !(item.kind === 'event' && isAllDayCalendarEvent(item.event)));
        return { day, allDay, timed };
      }),
    [days, tasks, events],
  );

  const { startHour, endHour } = useMemo(() => {
    let start = PLANNER_GRID_START_HOUR;
    let end = PLANNER_GRID_END_HOUR;
    perDay.forEach(({ timed }) =>
      timed.forEach((item) => {
        const at = item.kind === 'task' ? taskStart(item.task) : parseCalendarEventTime(item.event.start);
        if (!at) return;
        start = Math.min(start, at.getHours());
        end = Math.max(end, at.getHours() + 1);
      }),
    );
    return { startHour: start, endHour: end };
  }, [perDay]);
  const hours = endHour - startHour;
  const pxPerMinute = PLANNER_LAYOUT.hourHeightPx / MINUTES_PER_HOUR;

  const blocksFor = (timed: HomeAgendaItem[]): PositionedBlock[] =>
    layoutBlocks(
      timed.flatMap((item): Omit<PositionedBlock, 'lane' | 'lanes'>[] => {
        if (item.kind === 'task') {
          const start = taskStart(item.task);
          if (!start) return [];
          const minutes = Math.max(item.task.estimatedTime ?? 0, PLANNER_GRID_MIN_BLOCK_MINUTES);
          return [{
            key: item.key,
            top: (minutesIntoDay(start) - startHour * MINUTES_PER_HOUR) * pxPerMinute,
            height: minutes * pxPerMinute,
            task: item.task,
          }];
        }
        const start = parseCalendarEventTime(item.event.start);
        const end = parseCalendarEventTime(item.event.end || item.event.start);
        const minutes = Math.max(
          (end.getTime() - start.getTime()) / MILLISECONDS_PER_MINUTE,
          PLANNER_GRID_MIN_BLOCK_MINUTES,
        );
        return [{
          key: item.key,
          top: (minutesIntoDay(start) - startHour * MINUTES_PER_HOUR) * pxPerMinute,
          height: minutes * pxPerMinute,
          event: item.event,
        }];
      }),
    );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const now = new Date();
    el.scrollTop = Math.max(0, (now.getHours() - startHour - 1) * PLANNER_LAYOUT.hourHeightPx);
  }, [startHour]);

  const columns = `${PLANNER_LAYOUT.timeGutterPx}px repeat(${DAYS_IN_WEEK}, minmax(${PLANNER_LAYOUT.dayColumnMinPx}px, 1fr))`;
  const hasAllDay = perDay.some(({ allDay }) => allDay.length > 0);

  return (
    <div ref={scrollRef} className="planner-scroll" style={{ overflowX: 'auto' }}>
      <div
        className="planner-week"
        style={{ gridTemplateColumns: columns, ['--planner-hour' as string]: `${PLANNER_LAYOUT.hourHeightPx}px` }}
      >
        <div className="planner-week-head">
          <div aria-hidden />
          {days.map((day) => (
            <div key={getDateString(day)} data-today={getDateString(day) === todayKey ? 'true' : undefined}>
              <span>{day.toLocaleDateString(undefined, { weekday: 'short' })}</span>
              <strong>{day.getDate()}</strong>
            </div>
          ))}
        </div>
        {hasAllDay ? (
          <>
            <div aria-hidden style={{ minHeight: PLANNER_LAYOUT.allDayRowMinPx, borderBottom: '1px solid var(--border)' }} />
            {perDay.map(({ day, allDay }) => (
              <div key={`allday-${getDateString(day)}`} className="planner-week-allday">
                {allDay.map((item) => (
                  <span key={item.key} title={item.event.title}>
                    {item.event.title}
                  </span>
                ))}
              </div>
            ))}
          </>
        ) : null}
        <div className="planner-week-gutter" style={{ height: hours * PLANNER_LAYOUT.hourHeightPx }} aria-hidden>
          {Array.from({ length: hours }, (_, index) => {
            const label = new Date();
            label.setHours(startHour + index, 0, 0, 0);
            return (
              <span key={index} style={{ top: index * PLANNER_LAYOUT.hourHeightPx }}>
                {index === 0 ? '' : label.toLocaleTimeString(undefined, { hour: 'numeric' })}
              </span>
            );
          })}
        </div>
        {perDay.map(({ day, timed }) => (
          <WeekDayColumn
            key={getDateString(day)}
            day={day}
            startHour={startHour}
            hours={hours}
            blocks={blocksFor(timed)}
            isToday={getDateString(day) === todayKey}
            onOpenTask={onOpenTask}
          />
        ))}
      </div>
    </div>
  );
}

export function PlannerCalendar({ className, mode: requestedMode = 'week' }: { className?: string; mode?: CalendarMode }) {
  const isMobile = useMobileLayout();
  const editor = useSheetItem<Task>();
  const mode: CalendarMode = isMobile ? 'week' : requestedMode;
  const [anchor, setAnchor] = useState(() => new Date());

  const openTask = (task: Task) => {
    editor.show(task);
    revealTaskAboveDialog(task.id);
  };

  return (
    <section className={`planner-panel ${className ?? ''}`} aria-label={TEXT.week} id="home-week" data-tour="week-board">
      <CalendarHeader
        mode={mode}
        anchor={anchor}
        onShift={(direction) => setAnchor((current) => addDays(current, direction * DAYS_IN_WEEK))}
        onToday={() => setAnchor(new Date())}
      />
      {mode === 'month' ? (
        <div className="planner-scroll">
          <MonthCalendarView mobileMode={isMobile} />
        </div>
      ) : isMobile ? (
        <MobileWeek anchor={anchor} onOpenTask={openTask} />
      ) : (
        <DesktopWeek anchor={anchor} onOpenTask={openTask} />
      )}
      {editor.item ? (
        <TaskDialog open={editor.open} task={editor.item} onClose={editor.close} initialDate={getDateString(new Date())} />
      ) : null}
    </section>
  );
}
