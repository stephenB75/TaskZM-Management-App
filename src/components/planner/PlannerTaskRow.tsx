import React from 'react';
import { Icon } from '../Icon';
import { useTasks } from '../../contexts/TaskContext';
import { usePermissions } from '../../hooks/usePermissions';
import { getCategoryFromTags } from '../../lib/ai-config';
import { PLANNER_LAYOUT } from '../../lib/layout-constants';
import { PLANNER_UI_TEXT } from '../../lib/navigation-constants';
import { plannerCategoryColor } from '../../lib/planner-chat';
import { triggerSelectionHaptic, triggerSuccessHaptic } from '../../lib/native-haptics';
import type { Task } from '../../types';

interface PlannerTaskRowProps {
  task: Task;
  meta: string;
  onOpen: () => void;
}

/** Timeline-style task row: completion check, when, title, and category · duration · priority. */
export function PlannerTaskRow({ task, meta, onOpen }: PlannerTaskRowProps) {
  const { updateTask } = useTasks();
  const { canEditTask } = usePermissions();
  const done = task.status === 'done';
  const category = getCategoryFromTags(task.tags);
  const details = [
    category,
    task.estimatedTime ? PLANNER_UI_TEXT.chat.estimate(task.estimatedTime) : '',
    task.priority,
  ].filter(Boolean);

  const toggle = () => {
    if (!canEditTask) return;
    if (done) {
      void triggerSelectionHaptic();
      void updateTask(task.id, { status: 'todo', completedAt: null });
      return;
    }
    void triggerSuccessHaptic();
    void updateTask(task.id, { status: 'done', completedAt: new Date().toISOString() });
  };

  return (
    <div className="planner-tl-item" data-done={done ? 'true' : undefined}>
      <button
        type="button"
        className="planner-check"
        data-done={done ? 'true' : undefined}
        aria-label={done ? PLANNER_UI_TEXT.timeline.markOpen(task.title) : PLANNER_UI_TEXT.timeline.markDone(task.title)}
        aria-pressed={done}
        disabled={!canEditTask}
        onClick={toggle}
      >
        <Icon name="check" size={PLANNER_LAYOUT.iconXsPx} weight="bold" />
      </button>
      <button
        type="button"
        className="planner-tl-body"
        onClick={() => {
          void triggerSelectionHaptic();
          onOpen();
        }}
      >
        {meta ? <small>{meta}</small> : null}
        <strong>{task.title}</strong>
        {details.length > 0 ? (
          <span className="planner-tl-tags">
            <span className="planner-dot" style={{ background: plannerCategoryColor(category) }} />
            {details.join(' · ')}
          </span>
        ) : null}
      </button>
    </div>
  );
}
