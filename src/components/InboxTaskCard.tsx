import React from 'react';
import { cn, getTimeAndPeriod } from '../lib/utils';
import { Checkbox } from './ui/checkbox';
import { AgendaListCard } from './AgendaListCard';
import { AGENDA_LIST_CARD_UI } from '../lib/agenda-list-card-constants';
import { TASK_CARD_PRIORITY_COLORS } from '../lib/task-card-constants';
import { MINUTES_PER_HOUR } from '../lib/business-constants';
import type { Task } from '../types';

function formatTaskDuration(minutes: number | null): string | null {
  if (!minutes) return null;
  if (minutes >= MINUTES_PER_HOUR) {
    const hours = Math.floor(minutes / MINUTES_PER_HOUR);
    const mins = minutes % MINUTES_PER_HOUR;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }
  return `${minutes}m`;
}

function getPriorityAccentColor(priority: Task['priority']): string {
  return TASK_CARD_PRIORITY_COLORS[priority]?.line || TASK_CARD_PRIORITY_COLORS.default.line;
}

function plainDescription(description: string | undefined): string | null {
  if (!description?.trim()) return null;
  return description.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function formatDueDateLabel(dueDate: string): string {
  return new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isMidnightDueDate(dueDate: string): boolean {
  const parsed = getTimeAndPeriod(dueDate);
  return parsed?.timePart === '12:00' && parsed?.period === 'AM';
}

function getInboxFooterSource(task: Task): string {
  let label = task.tags?.[0] ?? AGENDA_LIST_CARD_UI.inboxSourceLabel;
  if (!task.tags?.length && task.dueDate) {
    label = `Due ${formatDueDateLabel(task.dueDate)}`;
  }
  if (task.status === 'in-progress') {
    label = `${label} · active`;
  } else if (task.status === 'on-hold') {
    label = `${label} · on hold`;
  }
  return label;
}

export interface InboxTaskCardProps {
  task: Task;
  selected: boolean;
  onToggleSelect: () => void;
  onClick: () => void;
  checkboxSizePx: number;
  visualSizePx: number;
  className?: string;
}

export function InboxTaskCard({
  task,
  selected,
  onToggleSelect,
  onClick,
  checkboxSizePx,
  visualSizePx,
  className,
}: InboxTaskCardProps) {
  const accentColor = getPriorityAccentColor(task.priority);
  const subtitle = plainDescription(task.description);
  const badgeLabel =
    task.priority && task.priority !== 'default'
      ? task.priority
      : AGENDA_LIST_CARD_UI.taskBadgeLabel;

  const scheduledTime = task.scheduledDate ? getTimeAndPeriod(task.scheduledDate) : null;
  const dueDateOnly =
    !task.scheduledDate && task.dueDate && isMidnightDueDate(task.dueDate);
  const dueDateHeaderLabel =
    dueDateOnly && task.dueDate ? `Due ${formatDueDateLabel(task.dueDate)}` : null;
  const timeAndPeriod =
    scheduledTime ??
    (!dueDateOnly && task.dueDate ? getTimeAndPeriod(task.dueDate) : null);

  const footerIcon = task.tags?.length ? 'tag' : task.dueDate ? 'calendar' : 'list-checks';
  const estimatedMinutes =
    typeof task.estimatedTime === 'number' ? task.estimatedTime : null;

  return (
    <div
      className={cn('flex items-start gap-2 md:gap-3 cursor-pointer transition-all', className)}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
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
          title={task.title}
          subtitle={subtitle}
          timePart={timeAndPeriod?.timePart}
          periodPart={timeAndPeriod?.period}
          allDayLabel={dueDateHeaderLabel}
          footerIcon={footerIcon}
          footerSourceLabel={getInboxFooterSource(task)}
          durationLabel={formatTaskDuration(estimatedMinutes)}
          showCommentIcon={Boolean(subtitle)}
          titleDone={task.status === 'done'}
        />
      </div>
    </div>
  );
}
