/**
 * Phone home: one scrolling column. Counts, place-open action, then today's tasks.
 */

import React, { useCallback, useMemo } from 'react';
import { useSheetItem } from '../hooks/useSheetItem';
import { useTasks } from '../contexts/TaskContext';
import { homeAgendaOn, isUnfinishedTask, tasksScheduledOn, tasksToPlace } from '../lib/home-task-groups';
import { useCalendarEvents } from '../hooks/useCalendarEvents';
import { clearEditingScrollPad, revealTaskAboveDialog } from '../lib/reveal-editing-task';
import { MOBILE_HOME_UI_TEXT } from '../lib/navigation-constants';
import { EventTimelineRow, PastelEventCard, PastelTaskCard, TaskTimelineRow } from './PastelTaskCard';
import { PlaceTasksButton, SummaryCard } from './HomeSummary';
import { SwipeToComplete } from './SwipeToComplete';
import {
  HEADER_HEIGHT,
  MOBILE_HOME_BODY_FONT_SIZE,
  MOBILE_HOME_LABEL_GAP,
  MOBILE_HOME_PAGE_PADDING,
  MOBILE_HOME_SECTION_GAP,
  MOBILE_HOME_TAB_FONT_SIZE,
} from '../lib/layout-constants';
import { THEME_COLOR } from '../lib/color-theme';
import { dateStringToLocalDate, getDateString } from '../lib/utils';
import { TaskDialog } from './TaskDialog';
import type { Task } from '../types';

interface MobileHomePagerProps {
  onRunScheduler: () => void;
  isScheduling: boolean;
}

export function MobileHomePager({ onRunScheduler, isScheduling }: MobileHomePagerProps) {
  const { tasks } = useTasks();
  const editor = useSheetItem<Task>();
  const editorTask = editor.item;
  const { show: showEditor } = editor;

  const openEditor = useCallback((task: Task) => {
    showEditor(task);
    revealTaskAboveDialog(task.id);
  }, [showEditor]);

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

  return (
    <div
      className="h-full min-h-0 overflow-y-auto overflow-x-hidden"
      style={{
        background: THEME_COLOR.page,
        padding: MOBILE_HOME_PAGE_PADDING,
      }}
    >
      <div className="flex flex-col" style={{ gap: MOBILE_HOME_SECTION_GAP }}>
        <section>
          <div className="grid grid-cols-2" style={{ gap: MOBILE_HOME_SECTION_GAP }}>
            <SummaryCard compact accent label={MOBILE_HOME_UI_TEXT.summaryUnfinished} value={unfinished.length} />
            <SummaryCard compact label={MOBILE_HOME_UI_TEXT.summaryToPlace} value={toPlace.length} />
            <SummaryCard compact label={MOBILE_HOME_UI_TEXT.summaryScheduledToday} value={upcoming.length} />
            <SummaryCard compact label={MOBILE_HOME_UI_TEXT.summaryDone} value={doneCount} />
          </div>
          <div className="flex flex-col items-center" style={{ marginTop: MOBILE_HOME_SECTION_GAP, gap: MOBILE_HOME_LABEL_GAP }}>
            <PlaceTasksButton busy={isScheduling} onClick={onRunScheduler} />
            <p style={{ fontSize: MOBILE_HOME_TAB_FONT_SIZE, margin: 0, color: THEME_COLOR.text, textAlign: 'center' }}>
              {MOBILE_HOME_UI_TEXT.scheduleHint}
            </p>
          </div>
        </section>

        <section data-tour="home-agenda">
          {agenda.length === 0 ? (
            <p style={{ fontSize: MOBILE_HOME_BODY_FONT_SIZE, margin: 0 }}>{MOBILE_HOME_UI_TEXT.weekEmpty}</p>
          ) : (
            <ul className="flex flex-col" style={{ gap: MOBILE_HOME_SECTION_GAP }}>
              {agenda.map((item, index) => (
                <li
                  key={item.key}
                  id={item.kind === 'task' ? `home-task-${item.task.id}` : undefined}
                  className={index === 0 ? 'taskzm-up-next' : undefined}
                  style={{ scrollMarginTop: HEADER_HEIGHT }}
                >
                  {index === 0 ? (
                    <p className="flex items-center font-medium text-primary" style={{ fontSize: MOBILE_HOME_TAB_FONT_SIZE, margin: `0 0 ${MOBILE_HOME_LABEL_GAP}`, gap: MOBILE_HOME_LABEL_GAP }}>
                      <span aria-hidden className="taskzm-up-next-dot" />
                      {MOBILE_HOME_UI_TEXT.upNext}
                    </p>
                  ) : null}
                  {item.kind === 'task' ? (
                    <TaskTimelineRow task={item.task}>
                      <SwipeToComplete task={item.task}>
                        <PastelTaskCard task={item.task} hideTime onOpen={() => openEditor(item.task)} />
                      </SwipeToComplete>
                    </TaskTimelineRow>
                  ) : (
                    <EventTimelineRow event={item.event}>
                      <PastelEventCard event={item.event} hideTime />
                    </EventTimelineRow>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

      </div>

      {editorTask ? (
        <TaskDialog
          open={editor.open}
          task={editorTask}
          onClose={() => {
            clearEditingScrollPad(editorTask.id);
            editor.close();
          }}
          initialDate={getDateString(now)}
        />
      ) : null}
    </div>
  );
}
