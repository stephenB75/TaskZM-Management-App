import React from 'react';
import { cn } from '../lib/utils';
import { Checkbox } from './ui/checkbox';
import { Icon } from './Icon';
import {
  NOTIFICATION_CARD_ACCENT_COLORS,
  NOTIFICATION_CARD_BADGE_LABELS,
  NOTIFICATION_CARD_FOOTER_ICONS,
  NOTIFICATION_CARD_FOOTER_LABELS,
  NOTIFICATION_CARD,
  formatNotificationRelativeTime,
  type NotificationCardType,
} from '../lib/notification-constants';
import { TASK_CARD_PRIORITY_COLORS } from '../lib/task-card-constants';
import {
  ICON_SIZE_XS,
  MOBILE_HOME_CARD_PADDING,
  MOBILE_HOME_CARD_RADIUS,
  MOBILE_HOME_CARD_TITLE_FONT_SIZE,
  MOBILE_HOME_LABEL_GAP,
  MOBILE_HOME_SECTION_GAP,
  MOBILE_HOME_TAB_FONT_SIZE,
  MOBILE_HOME_TASK_BAR_GAP,
  MOBILE_HOME_TASK_BAR_PX,
} from '../lib/layout-constants';
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

type NotificationCardKey = keyof typeof NOTIFICATION_CARD_ACCENT_COLORS;

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

function getNotificationAccentColor(notification: NotificationCardItem): string {
  if (notification.priority) {
    return (
      TASK_CARD_PRIORITY_COLORS[notification.priority]?.line
      ?? TASK_CARD_PRIORITY_COLORS.default.line
    );
  }
  const key = getNotificationTypeKey(notification.type);
  return NOTIFICATION_CARD_ACCENT_COLORS[key];
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

export function NotificationCard({
  notification,
  selected,
  onToggleSelect,
  onMarkAsRead,
  onDismiss,
  visualSizePx,
  className,
}: NotificationCardProps) {
  const typeKey = getNotificationTypeKey(notification.type);
  const accentColor = getNotificationAccentColor(notification);
  const badgeLabel = NOTIFICATION_CARD_BADGE_LABELS[typeKey];
  const footerSourceLabel = NOTIFICATION_CARD_FOOTER_LABELS[typeKey];
  const footerIcon = NOTIFICATION_CARD_FOOTER_ICONS[typeKey];
  const relativeTime = formatNotificationRelativeTime(notification.timestamp);

  return (
    <div
      className={cn(
        'group/card flex items-start cursor-pointer bg-card',
        className,
      )}
      style={{
        gap: MOBILE_HOME_SECTION_GAP,
        padding: MOBILE_HOME_CARD_PADDING,
        borderRadius: MOBILE_HOME_CARD_RADIUS,
      }}
      onClick={onMarkAsRead}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onMarkAsRead();
        }
      }}
    >
      <div
        className="flex-shrink-0 flex items-center justify-center"
        style={{ minWidth: visualSizePx, minHeight: visualSizePx }}
        onClick={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0"
          style={{
            width: visualSizePx,
            height: visualSizePx,
            minWidth: visualSizePx,
            minHeight: visualSizePx,
          }}
        />
      </div>
      <span
        aria-hidden
        className="self-stretch flex-none"
        style={{
          width: MOBILE_HOME_TASK_BAR_PX,
          borderRadius: MOBILE_HOME_CARD_RADIUS,
          background: accentColor,
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col" style={{ gap: MOBILE_HOME_LABEL_GAP, marginLeft: `calc(${MOBILE_HOME_TASK_BAR_GAP} - ${MOBILE_HOME_SECTION_GAP})` }}>
        <div className="flex items-start justify-between" style={{ gap: MOBILE_HOME_LABEL_GAP }}>
          <p
            className={cn('m-0 min-w-0 flex-1 text-foreground', notification.read ? 'font-medium' : 'font-semibold')}
            style={{ fontSize: MOBILE_HOME_CARD_TITLE_FONT_SIZE, lineHeight: 1.3 }}
          >
            {notification.title}
          </p>
          <div className="flex flex-shrink-0 items-center" style={{ gap: MOBILE_HOME_LABEL_GAP }}>
            {!notification.read && (
              <span
                className="rounded-full bg-primary"
                style={{ width: NOTIFICATION_CARD.unreadDotSizePx, height: NOTIFICATION_CARD.unreadDotSizePx }}
                aria-label="Unread"
              />
            )}
            <button
              type="button"
              data-close-button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              className="flex items-center justify-center bg-transparent p-0 text-muted-foreground hover:text-foreground"
              style={{
                width: NOTIFICATION_CARD.dismissButtonSizePx,
                height: NOTIFICATION_CARD.dismissButtonSizePx,
                minHeight: NOTIFICATION_CARD.dismissButtonSizePx,
                border: 'none',
              }}
              aria-label="Dismiss notification"
            >
              <Icon name="x" size={ICON_SIZE_XS} />
            </button>
          </div>
        </div>
        {notification.message ? (
          <p
            className="m-0 line-clamp-2 text-muted-foreground"
            style={{ fontSize: MOBILE_HOME_TAB_FONT_SIZE, lineHeight: 1.35 }}
          >
            {notification.message}
          </p>
        ) : null}
        <p
          className="m-0 flex flex-wrap items-center text-muted-foreground"
          style={{ fontSize: MOBILE_HOME_TAB_FONT_SIZE, gap: MOBILE_HOME_LABEL_GAP }}
        >
          <Icon name={footerIcon} size={ICON_SIZE_XS} />
          <span>{badgeLabel || footerSourceLabel}</span>
          <span aria-hidden>·</span>
          <span>{relativeTime}</span>
        </p>
      </div>
    </div>
  );
}
