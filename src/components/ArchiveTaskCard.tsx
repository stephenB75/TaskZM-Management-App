import React from 'react';
import { cn, getTimeAndPeriod } from '../lib/utils';
import { Checkbox } from './ui/checkbox';
import { Icon } from './Icon';
import { AgendaListCard } from './AgendaListCard';
import { ARCHIVE_SECTION, ARCHIVE_UI_TEXT, formatArchiveRelativeCompleted } from '../lib/archive-constants';
import { TASK_CARD_PRIORITY_COLORS } from '../lib/task-card-constants';
import { MINUTES_PER_HOUR } from '../lib/business-constants';
import { ICON_SIZE_XS } from '../lib/layout-constants';
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

function getArchiveFooterSource(task: Task): string {
  if (task.tags?.length) return task.tags[0];
  return formatArchiveRelativeCompleted(task.completedAt);
}

export interface ArchiveTaskCardProps {
  task: Task;
  selected: boolean;
  onToggleSelect: () => void;
  onClick: () => void;
  onRestore: (e: React.MouseEvent) => void;
  onDelete: (e: React.MouseEvent) => void;
  checkboxSizePx: number;
  visualSizePx: number;
  className?: string;
}

export function ArchiveTaskCard({
  task,
  selected,
  onToggleSelect,
  onClick,
  onRestore,
  onDelete,
  checkboxSizePx,
  visualSizePx,
  className,
}: ArchiveTaskCardProps) {
  const accentColor = getPriorityAccentColor(task.priority);
  const subtitle = plainDescription(task.description);
  const badgeLabel = task.priority || ARCHIVE_UI_TEXT.doneBadge;

  const completedTime = task.completedAt ? getTimeAndPeriod(task.completedAt) : null;
  const footerIcon = task.tags?.length ? 'tag' : 'archive';
  const durationMinutes =
    typeof task.actualTime === 'number' && task.actualTime > 0
      ? task.actualTime
      : typeof task.estimatedTime === 'number'
        ? task.estimatedTime
        : null;

  const headerAction = (
    <div className="flex items-center gap-0.5 flex-shrink-0 opacity-70 group-hover/card:opacity-100 transition-opacity">
      <button
        type="button"
        onClick={onRestore}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex-shrink-0 hover:opacity-70 transition-opacity flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
        style={{
          width: ARCHIVE_SECTION.actionButtonSizePx,
          height: ARCHIVE_SECTION.actionButtonSizePx,
        }}
        aria-label={ARCHIVE_UI_TEXT.restoreTask}
        title={ARCHIVE_UI_TEXT.restoreTask}
      >
        <Icon name="rotate-ccw" size={ICON_SIZE_XS} />
      </button>
      <button
        type="button"
        onClick={onDelete}
        onPointerDown={(e) => e.stopPropagation()}
        className="flex-shrink-0 hover:opacity-70 transition-opacity flex items-center justify-center rounded-md text-destructive/80 hover:text-destructive"
        style={{
          width: ARCHIVE_SECTION.actionButtonSizePx,
          height: ARCHIVE_SECTION.actionButtonSizePx,
        }}
        aria-label={ARCHIVE_UI_TEXT.deleteTask}
        title={ARCHIVE_UI_TEXT.deleteTask}
      >
        <Icon name="trash-2" size={ICON_SIZE_XS} />
      </button>
    </div>
  );

  return (
    <div
      className={cn(
        'group/card flex items-start gap-2 md:gap-3 cursor-pointer',
        className,
      )}
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
          timePart={completedTime?.timePart}
          periodPart={completedTime?.period}
          allDayLabel={!completedTime && task.completedAt ? ARCHIVE_UI_TEXT.doneBadge : null}
          footerIcon={footerIcon}
          footerSourceLabel={getArchiveFooterSource(task)}
          durationLabel={formatTaskDuration(durationMinutes)}
          showCommentIcon={Boolean(subtitle)}
          titleDone
          headerAction={headerAction}
        />
      </div>
    </div>
  );
}
