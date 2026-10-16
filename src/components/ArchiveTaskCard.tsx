import React from 'react';
import { cn, formatTimeAMPM } from '../lib/utils';
import { Checkbox } from './ui/checkbox';
import { Icon } from './Icon';
import { ARCHIVE_UI_TEXT, formatArchiveRelativeCompleted } from '../lib/archive-constants';
import { getCategoryFromTags } from '../lib/ai-config';
import { PLANNER_LAYOUT } from '../lib/layout-constants';
import { PLANNER_UI_TEXT } from '../lib/navigation-constants';
import { plannerCategoryColor } from '../lib/planner-chat';
import { PlannerPriorityPill } from './planner/PlannerPriorityPill';
import type { Task } from '../types';

function completedMeta(task: Task): string {
  if (!task.completedAt) return '';
  return [formatArchiveRelativeCompleted(task.completedAt), formatTimeAMPM(task.completedAt)].filter(Boolean).join(' · ');
}

function trackedMinutes(task: Task): number | null {
  if (typeof task.actualTime === 'number' && task.actualTime > 0) return task.actualTime;
  return typeof task.estimatedTime === 'number' && task.estimatedTime > 0 ? task.estimatedTime : null;
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

/** Archived task in the same timeline-row style as Upcoming / Inbox, plus bulk-select and restore/delete. */
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
  const meta = completedMeta(task);
  const category = getCategoryFromTags(task.tags);
  const minutes = trackedMinutes(task);
  const details = [category, minutes ? PLANNER_UI_TEXT.chat.estimate(minutes) : ''].filter(Boolean);

  return (
    <div className={cn('planner-tl-item planner-archive-item', className)} data-done="true" data-selected={selected ? 'true' : undefined}>
      <div
        className="flex items-start justify-center"
        style={{ minWidth: checkboxSizePx, minHeight: checkboxSizePx, paddingTop: PLANNER_LAYOUT.archiveSelectOffsetPx }}
      >
        <Checkbox
          checked={selected}
          onCheckedChange={onToggleSelect}
          aria-label={task.title}
          style={{ width: visualSizePx, height: visualSizePx, minWidth: visualSizePx, minHeight: visualSizePx }}
        />
      </div>
      <button type="button" className="planner-tl-body" onClick={onClick}>
        {meta ? <small>{meta}</small> : null}
        <strong>{task.title}</strong>
        <span className="planner-tl-tags">
          <PlannerPriorityPill priority={task.priority} />
          {details.length > 0 ? (
            <>
              <span className="planner-dot" style={{ background: plannerCategoryColor(category) }} />
              {details.join(' · ')}
            </>
          ) : null}
        </span>
      </button>
      <div className="planner-archive-actions">
        <button
          type="button"
          className="planner-pill"
          onClick={onRestore}
          aria-label={ARCHIVE_UI_TEXT.restoreTask}
          title={ARCHIVE_UI_TEXT.restoreTask}
        >
          <Icon name="rotate-ccw" size={PLANNER_LAYOUT.iconXsPx} />
        </button>
        <button
          type="button"
          className="planner-pill"
          onClick={onDelete}
          aria-label={ARCHIVE_UI_TEXT.deleteTask}
          title={ARCHIVE_UI_TEXT.deleteTask}
        >
          <Icon name="trash-2" size={PLANNER_LAYOUT.iconXsPx} />
        </button>
      </div>
    </div>
  );
}
