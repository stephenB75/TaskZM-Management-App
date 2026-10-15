import React from 'react';
import { TASK_CARD_PRIORITY_COLORS } from '../../lib/task-card-constants';
import { COLOR_PRIORITY_LOW } from '../../lib/color-theme';
import type { TaskPriority } from '../../types';

export function plannerPriorityColor(priority?: TaskPriority | null): string {
  if (!priority || priority === 'low') return COLOR_PRIORITY_LOW;
  return TASK_CARD_PRIORITY_COLORS[priority].line;
}

/** Solid priority tag so urgency reads at a glance on the neutral canvas. */
export function PlannerPriorityPill({ priority }: { priority?: TaskPriority | null }) {
  if (!priority) return null;
  return (
    <span
      className="planner-priority"
      data-priority={priority}
      style={{ '--planner-priority': plannerPriorityColor(priority) } as React.CSSProperties}
    >
      {priority}
    </span>
  );
}
