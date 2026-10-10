import React from 'react';
import { Icon } from './Icon';
import { formatTimeAMPM, parseCalendarEventTime } from '../lib/utils';
import { isAllDayCalendarEvent, pastelWashForTask } from '../lib/home-task-groups';
import { MOBILE_HOME_UI_TEXT } from '../lib/navigation-constants';
import type { CalendarEvent } from '../hooks/useCalendarEvents';
import {
  MILLISECONDS_PER_MINUTE,
} from '../lib/business-constants';
import {
  ICON_SIZE_XS,
  MOBILE_HOME_CARD_PADDING,
  MOBILE_HOME_CARD_RADIUS,
  MOBILE_HOME_CARD_TITLE_FONT_SIZE,
  MOBILE_HOME_LABEL_GAP,
  MOBILE_HOME_PILL_RADIUS,
  MOBILE_HOME_TAB_FONT_SIZE,
  MOBILE_HOME_TASK_BAR_GAP,
  MOBILE_HOME_TASK_BAR_PX,
  MOBILE_HOME_TIMELINE_LABEL_WIDTH,
} from '../lib/layout-constants';
import { COLOR_PRIMARY, THEME_COLOR } from '../lib/color-theme';
import { getTaskDialogPriorityAccent } from '../lib/task-dialog-constants';
import { AGENDA_LIST_CARD, getAgendaCardBadgeStyles } from '../lib/agenda-list-card-constants';
import { triggerSelectionHaptic } from '../lib/native-haptics';
import type { Task } from '../types';

export function taskTimeRange(task: Task): string {
  if (!task.scheduledDate) return '';
  const startLabel = formatTimeAMPM(task.scheduledDate);
  if (!startLabel) return '';
  if (!task.estimatedTime) return startLabel;
  const end = new Date(new Date(task.scheduledDate).getTime() + task.estimatedTime * MILLISECONDS_PER_MINUTE);
  const endLabel = formatTimeAMPM(end.toISOString());
  if (!endLabel) return startLabel;
  return `${startLabel}–${endLabel}`;
}

interface PastelTaskCardProps {
  task: Task;
  detail?: string;
  unfinished?: boolean;
  onOpen?: () => void;
  /** Timeline rows show the time beside the card. */
  hideTime?: boolean;
  fullTitle?: boolean;
  children?: React.ReactNode;
}

export function PastelTaskCard({ task, detail, unfinished, onOpen, hideTime, fullTitle, children }: PastelTaskCardProps) {
  const wash = pastelWashForTask(task, { unfinished, done: task.status === 'done' });
  const timeLabel = hideTime ? (detail || '') : (detail || taskTimeRange(task));
  const badgeLabel = task.priority && task.priority !== 'default' ? task.priority : '';
  const badge = getAgendaCardBadgeStyles(wash.bar);

  return (
    <div
      style={{
        display: 'flex',
        gap: MOBILE_HOME_TASK_BAR_GAP,
        alignItems: 'stretch',
        background: 'transparent',
        color: THEME_COLOR.text,
        borderRadius: MOBILE_HOME_CARD_RADIUS,
        padding: MOBILE_HOME_CARD_PADDING,
      }}
    >
      <span
        aria-hidden
        style={{
          width: MOBILE_HOME_TASK_BAR_PX,
          borderRadius: MOBILE_HOME_CARD_RADIUS,
          background: getTaskDialogPriorityAccent(task.priority),
          flex: 'none',
        }}
      />
      <span className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => {
            void triggerSelectionHaptic();
            onOpen?.();
          }}
          className="w-full text-left"
          style={{ background: 'transparent', border: 'none', color: 'inherit', padding: 0 }}
        >
          <span className="flex items-start justify-between gap-2">
            <span className="block font-medium" style={{ fontSize: MOBILE_HOME_CARD_TITLE_FONT_SIZE, whiteSpace: fullTitle ? 'nowrap' : undefined }}>
              {task.title}
            </span>
            {badgeLabel ? (
              <span
                className="shrink-0 font-semibold capitalize"
                style={{
                  fontSize: AGENDA_LIST_CARD.badgeFontSizePx,
                  paddingLeft: AGENDA_LIST_CARD.badgePaddingXPx,
                  paddingRight: AGENDA_LIST_CARD.badgePaddingXPx,
                  paddingTop: AGENDA_LIST_CARD.badgePaddingYPx,
                  paddingBottom: AGENDA_LIST_CARD.badgePaddingYPx,
                  borderRadius: MOBILE_HOME_PILL_RADIUS,
                  background: badge.badgeBackground,
                  color: badge.badgeText,
                }}
              >
                {badgeLabel}
              </span>
            ) : null}
          </span>
          {timeLabel ? (
            <span className="block" style={{ fontSize: MOBILE_HOME_TAB_FONT_SIZE, marginTop: MOBILE_HOME_LABEL_GAP }}>
              {timeLabel}
            </span>
          ) : null}
        </button>
        {children}
      </span>
    </div>
  );
}

function eventTimeLabel(event: CalendarEvent): string {
  if (isAllDayCalendarEvent(event)) return MOBILE_HOME_UI_TEXT.allDay;
  return formatTimeAMPM(parseCalendarEventTime(event.start).toISOString()) ?? '';
}

function eventTimeRange(event: CalendarEvent): string {
  if (isAllDayCalendarEvent(event)) return MOBILE_HOME_UI_TEXT.allDay;
  const start = eventTimeLabel(event);
  const end = event.end ? formatTimeAMPM(parseCalendarEventTime(event.end).toISOString()) ?? '' : '';
  return end && end !== start ? `${start}–${end}` : start;
}

/** Read-only calendar event shown in the same shape as a task card, tagged as a calendar event. */
export function PastelEventCard({ event, hideTime, fullTitle }: { event: CalendarEvent; hideTime?: boolean; fullTitle?: boolean }) {
  const accent = event.calendarColor || COLOR_PRIMARY;
  const detail = [hideTime ? '' : eventTimeRange(event), event.location ?? ''].filter(Boolean).join(' · ');
  return (
    <div
      data-calendar-event
      style={{
        display: 'flex',
        gap: MOBILE_HOME_TASK_BAR_GAP,
        alignItems: 'stretch',
        background: 'transparent',
        color: THEME_COLOR.text,
        borderRadius: MOBILE_HOME_CARD_RADIUS,
        padding: MOBILE_HOME_CARD_PADDING,
      }}
    >
      <span
        aria-hidden
        style={{
          width: MOBILE_HOME_TASK_BAR_PX,
          borderRadius: MOBILE_HOME_CARD_RADIUS,
          background: accent,
          flex: 'none',
        }}
      />
      <span className="min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="block font-medium" style={{ fontSize: MOBILE_HOME_CARD_TITLE_FONT_SIZE, whiteSpace: fullTitle ? 'nowrap' : undefined }}>
            {event.title}
          </span>
          <span
            className="inline-flex shrink-0 items-center font-semibold bg-primary/10 text-primary"
            style={{
              gap: MOBILE_HOME_LABEL_GAP,
              fontSize: AGENDA_LIST_CARD.badgeFontSizePx,
              paddingLeft: AGENDA_LIST_CARD.badgePaddingXPx,
              paddingRight: AGENDA_LIST_CARD.badgePaddingXPx,
              paddingTop: AGENDA_LIST_CARD.badgePaddingYPx,
              paddingBottom: AGENDA_LIST_CARD.badgePaddingYPx,
              borderRadius: MOBILE_HOME_PILL_RADIUS,
            }}
          >
            <Icon name="calendar" size={ICON_SIZE_XS} />
            {MOBILE_HOME_UI_TEXT.calendarTag}
          </span>
        </span>
        {detail ? (
          <span className="block truncate" style={{ fontSize: MOBILE_HOME_TAB_FONT_SIZE, marginTop: MOBILE_HOME_LABEL_GAP }}>
            {detail}
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function EventTimelineRow({ event, children }: { event: CalendarEvent; children: React.ReactNode }) {
  return <TimelineRow label={eventTimeLabel(event)}>{children}</TimelineRow>;
}

export function TaskTimelineRow({ task, children }: { task: Task; children: React.ReactNode }) {
  const timeLabel = task.scheduledDate ? formatTimeAMPM(task.scheduledDate) ?? '' : '';
  return <TimelineRow label={timeLabel}>{children}</TimelineRow>;
}

function TimelineRow({ label: timeLabel, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: MOBILE_HOME_LABEL_GAP, alignItems: 'stretch' }}>
      <span
        style={{
          width: MOBILE_HOME_TIMELINE_LABEL_WIDTH,
          flex: 'none',
          fontSize: MOBILE_HOME_TAB_FONT_SIZE,
          color: THEME_COLOR.text,
          paddingTop: MOBILE_HOME_LABEL_GAP,
        }}
      >
        {timeLabel}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}
