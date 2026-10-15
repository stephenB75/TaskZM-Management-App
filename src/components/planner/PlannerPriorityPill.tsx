import React from 'react';
import { TASK_CARD_PRIORITY_COLORS } from '../../lib/task-card-constants';
import type { TaskPriority } from '../../types';

/** Solid priority tag so urgency reads at a glance on the neutral canvas. */
export function PlannerPriorityPill({ priority }: { priority?: TaskPriority | null }) {
  if (!priority) return null;
  return (
    <span
      className="planner-priority"
      data-priority={priority}
      style={{ '--planner-priority': TASK_CARD_PRIORITY_COLORS[priority].line } as React.CSSProperties}
    >
      {priority}
    </span>
  );
}
