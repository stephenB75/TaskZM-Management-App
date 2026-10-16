import React from 'react';
import { Icon } from './Icon';
import { PlannerPriorityPill } from './planner/PlannerPriorityPill';
import {
  NOTIFICATION_CARD_BADGE_LABELS,
  NOTIFICATION_CARD_FOOTER_ICONS,
  NOTIFICATION_CARD_FOOTER_LABELS,
  NOTIFICATION_CARD,
  formatNotificationRelativeTime,
  type NotificationCardType,
} from '../lib/notification-constants';
import { ICON_SIZE_XS, PLANNER_LAYOUT } from '../lib/layout-constants';
import { triggerSelectionHaptic } from '../lib/native-haptics';
import type { Task } from '../types';

export interface NotificationCardItem {
  id: string;
  type: NotificationCardType;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  taskId?: string;
  priority?: Task['priority'];
  awardId?: string;
}

type NotificationCardKey = keyof typeof NOTIFICATION_CARD_BADGE_LABELS;

function getNotificationTypeKey(type: NotificationCardType): NotificationCardKey {
  switch (type) {
    case 'task-overdue':
      return 'taskOverdue';
    case 'task-due-soon':
      return 'taskDueSoon';
    case 'pomodoro-complete':
      return 'pomodoroComplete';
    case 'pomodoro-break':
      return 'pomodoroBreak';
    case 'award-earned':
      return 'awardEarned';
    case 'toast-success':
      return 'toastSuccess';
    case 'toast-error':
      return 'toastError';
    case 'toast-warning':
      return 'toastWarning';
    case 'toast-info':
      return 'toastInfo';
    default:
      return 'system';
  }
}

export interface NotificationCardProps {
  notification: NotificationCardItem;
  selected: boolean;
  onToggleSelect: () => void;
  onMarkAsRead: () => void;
  onDismiss: () => void;
  checkboxSizePx: number;
  visualSizePx: number;
  className?: string;
}

/** Notification in the same row format as timeline tasks: check, when, title, then tags. */
export function NotificationCard({
  notification,
  selected,
  onToggleSelect,
  onMarkAsRead,
  onDismiss,
  className,
}: NotificationCardProps) {
  const typeKey = getNotificationTypeKey(notification.type);
  const sourceLabel = NOTIFICATION_CARD_BADGE_LABELS[typeKey] || NOTIFICATION_CARD_FOOTER_LABELS[typeKey];
  const sourceIcon = NOTIFICATION_CARD_FOOTER_ICONS[typeKey];
  const relativeTime = formatNotificationRelativeTime(notification.timestamp);

  return (
    <div
      className={`planner-tl-item taskzm-notification-row ${className ?? ''}`}
      data-unread={notification.read ? undefined : 'true'}
    >
      <button
        type="button"
        className="planner-check"
        data-done={selected ? 'true' : undefined}
        aria-label={selected ? NOTIFICATION_CARD.deselectLabel(notification.title) : NOTIFICATION_CARD.selectLabel(notification.title)}
        aria-pressed={selected}
        onClick={() => {
          void triggerSelectionHaptic();
          onToggleSelect();
        }}
      >
        <Icon name="check" size={PLANNER_LAYOUT.iconXsPx} weight="bold" />
      </button>
      <div className="flex min-w-0 items-start" style={{ gap: PLANNER_LAYOUT.itemGapPx }}>
        <button
          type="button"
          className="planner-tl-body flex-1"
          onClick={() => {
            void triggerSelectionHaptic();
            onMarkAsRead();
          }}
        >
          <small>{relativeTime}</small>
          <strong>{notification.title}</strong>
          {notification.message ? <span className="taskzm-notification-message">{notification.message}</span> : null}
          <span className="planner-tl-tags">
            <PlannerPriorityPill priority={notification.priority} />
            <span className="inline-flex items-center" style={{ gap: PLANNER_LAYOUT.itemGapPx / 2 }}>
              <Icon name={sourceIcon} size={ICON_SIZE_XS} />
              {sourceLabel}
            </span>
          </span>
        </button>
        <div className="flex flex-shrink-0 items-center" style={{ gap: PLANNER_LAYOUT.itemGapPx / 2 }}>
          {!notification.read ? (
            <span
              className="rounded-full bg-foreground"
              style={{ width: NOTIFICATION_CARD.unreadDotSizePx, height: NOTIFICATION_CARD.unreadDotSizePx }}
              aria-label={NOTIFICATION_CARD.unreadLabel}
            />
          ) : null}
          <button
            type="button"
            data-close-button
            onClick={onDismiss}
            onPointerDown={(e) => e.stopPropagation()}
            className="flex items-center justify-center rounded-full bg-transparent p-0 text-muted-foreground hover:bg-muted hover:text-foreground"
            style={{
              width: NOTIFICATION_CARD.dismissButtonSizePx,
              height: NOTIFICATION_CARD.dismissButtonSizePx,
              minHeight: NOTIFICATION_CARD.dismissButtonSizePx,
              border: 'none',
            }}
            aria-label={NOTIFICATION_CARD.dismissLabel}
          >
            <Icon name="x" size={ICON_SIZE_XS} />
          </button>
        </div>
      </div>
    </div>
  );
}
