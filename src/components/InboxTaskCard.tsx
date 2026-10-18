import React from 'react';
import { cn, getDisplayTimeAndPeriod, getTimeAndPeriod } from '../lib/utils';
import { Checkbox } from './ui/checkbox';
import { AGENDA_LIST_CARD_UI } from '../lib/agenda-list-card-constants';
import { getCategoryFromTags } from '../lib/ai-config';
import { PLANNER_UI_TEXT } from '../lib/navigation-constants';
import { plannerCategoryColor } from '../lib/planner-chat';
import { PlannerPriorityPill } from './planner/PlannerPriorityPill';
import type { Task } from '../types';

function formatDueDateLabel(dueDate: string): string {
  return new Date(dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isMidnightDueDate(dueDate: string): boolean {
  const parsed = getTimeAndPeriod(dueDate);
  return parsed?.timePart === '12:00' && parsed?.period === 'AM';
}

function getInboxMeta(task: Task): string {
  const parts: string[] = [];
  const when = task.scheduledDate ?? task.dueDate;
  if (when) {
    const time = getDisplayTimeAndPeriod(when);
    if (!task.scheduledDate && task.dueDate && isMidnightDueDate(task.dueDate)) {
      parts.push(`Due ${formatDueDateLabel(task.dueDate)}`);
    } else if (time) {
      const clock = time.period ? `${time.timePart} ${time.period}` : time.timePart;
      parts.push(task.scheduledDate ? clock : `Due ${formatDueDateLabel(when)} · ${clock}`);
    }
  }
  if (task.status === 'in-progress') parts.push('Active');
  else if (task.status === 'on-hold') parts.push('On hold');
  return parts.join(' · ');
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

/** Inbox row in the same compact format as the timeline: meta, wrapping title, priority tag and details. */
export function InboxTaskCard({
  task,
  selected,
  onToggleSelect,
  onClick,
  checkboxSizePx,
  visualSizePx,
  className,
}: InboxTaskCardProps) {
  const category = getCategoryFromTags(task.tags);
  const meta = getInboxMeta(task);
  const extraTag = task.tags?.find((tag) => tag.toLowerCase() !== category);
  const details = [
    category ?? (task.tags?.length ? null : AGENDA_LIST_CARD_UI.inboxSourceLabel),
    typeof task.estimatedTime === 'number' && task.estimatedTime > 0
      ? PLANNER_UI_TEXT.chat.estimate(task.estimatedTime)
      : null,
  ].filter(Boolean);

  return (
    <div
      className={cn('planner-inbox-item', className)}
      data-done={task.status === 'done' ? 'true' : undefined}
      data-selected={selected ? 'true' : undefined}
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
        className="flex items-center justify-center"
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
      <div className="planner-tl-body">
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
          {extraTag ? <span className="planner-tag-name">#{extraTag}</span> : null}
        </span>
      </div>
    </div>
  );
}
