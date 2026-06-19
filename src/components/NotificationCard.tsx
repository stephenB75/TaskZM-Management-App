import React from 'react';
import { cn, getTimeAndPeriod } from '../lib/utils';
import { Checkbox } from './ui/checkbox';
import { Icon } from './Icon';
import { AgendaListCard } from './AgendaListCard';
import {
  NOTIFICATION_CARD_ACCENT_COLORS,
  NOTIFICATION_CARD_BADGE_LABELS,
  NOTIFICATION_CARD_FOOTER_ICONS,
  NOTIFICATION_CARD_FOOTER_LABELS,
  NOTIFICATION_CARD,
  type NotificationCardType,
} from '../lib/notification-constants';
import { TASK_CARD_PRIORITY_COLORS } from '../lib/task-card-constants';
import { ICON_SIZE_XS } from '../lib/layout-constants';
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

function formatNotificationDate(timestamp: Date): string {
  return timestamp.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  checkboxSizePx,
  visualSizePx,
  className,
}: NotificationCardProps) {
  const typeKey = getNotificationTypeKey(notification.type);
  const accentColor = getNotificationAccentColor(notification);
  const badgeLabel = NOTIFICATION_CARD_BADGE_LABELS[typeKey];
  const footerSourceLabel = NOTIFICATION_CARD_FOOTER_LABELS[typeKey];
  const footerIcon = NOTIFICATION_CARD_FOOTER_ICONS[typeKey];
  const timeAndPeriod = getTimeAndPeriod(notification.timestamp.toISOString());

  const headerAction = (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      {!notification.read && (
        <span
          className="rounded-full bg-primary flex-shrink-0"
          style={{
            width: NOTIFICATION_CARD.unreadDotSizePx,
            height: NOTIFICATION_CARD.unreadDotSizePx,
          }}
          aria-label="Unread"
        />
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDismiss();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex-shrink-0 hover:opacity-70 transition-opacity flex items-center justify-center rounded-md"
        style={{
          width: NOTIFICATION_CARD.dismissButtonSizePx,
          height: NOTIFICATION_CARD.dismissButtonSizePx,
        }}
        aria-label="Dismiss notification"
      >
        <Icon name="x" size={ICON_SIZE_XS} />
      </button>
    </div>
  );

  return (
    <div
      className={cn(
        'flex items-start gap-2 md:gap-3 cursor-pointer transition-all',
        notification.read && 'opacity-60',
        className,
      )}
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
        className="mt-1 flex-shrink-0 flex items-center justify-center"
        style={{ minWidth: checkboxSizePx, minHeight: checkboxSizePx }}
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
      <div className="flex-1 min-w-0 min-h-0">
        <AgendaListCard
          accentColor={accentColor}
          badgeLabel={badgeLabel}
          title={notification.title}
          subtitle={notification.message || undefined}
          timePart={timeAndPeriod?.timePart}
          periodPart={timeAndPeriod?.period}
          footerIcon={footerIcon}
          footerSourceLabel={footerSourceLabel}
          durationLabel={formatNotificationDate(notification.timestamp)}
          headerAction={headerAction}
        />
      </div>
    </div>
  );
}
