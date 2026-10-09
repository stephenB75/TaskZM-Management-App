import React from 'react';
import { formatTimeAMPM } from '../lib/utils';
import { pastelWashForTask } from '../lib/home-task-groups';
import {
  MILLISECONDS_PER_MINUTE,
} from '../lib/business-constants';
import {
  MOBILE_HOME_CARD_BAR_PX,
  MOBILE_HOME_CARD_PADDING,
  MOBILE_HOME_CARD_RADIUS,
  MOBILE_HOME_CARD_TITLE_FONT_SIZE,
  MOBILE_HOME_LABEL_GAP,
  MOBILE_HOME_PILL_RADIUS,
  MOBILE_HOME_TAB_FONT_SIZE,
  MOBILE_HOME_TIMELINE_LABEL_WIDTH,
} from '../lib/layout-constants';
import { COLOR_TEXT_PRIMARY } from '../lib/color-theme';
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
        gap: MOBILE_HOME_LABEL_GAP,
        alignItems: 'stretch',
        background: 'transparent',
        color: COLOR_TEXT_PRIMARY,
        borderRadius: MOBILE_HOME_CARD_RADIUS,
        padding: MOBILE_HOME_CARD_PADDING,
      }}
    >
      <span
        aria-hidden
        style={{
          width: MOBILE_HOME_CARD_BAR_PX,
          borderRadius: MOBILE_HOME_CARD_RADIUS,
          background: wash.bar,
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

export function TaskTimelineRow({ task, children }: { task: Task; children: React.ReactNode }) {
  const timeLabel = task.scheduledDate ? formatTimeAMPM(task.scheduledDate) : '';
  return (
    <div style={{ display: 'flex', gap: MOBILE_HOME_LABEL_GAP, alignItems: 'stretch' }}>
      <span
        style={{
          width: MOBILE_HOME_TIMELINE_LABEL_WIDTH,
          flex: 'none',
          fontSize: MOBILE_HOME_TAB_FONT_SIZE,
          color: COLOR_TEXT_PRIMARY,
          paddingTop: MOBILE_HOME_LABEL_GAP,
        }}
      >
        {timeLabel}
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </div>
  );
}
