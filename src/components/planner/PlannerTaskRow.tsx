import React from 'react';
import { Icon } from '../Icon';
import { useTasks } from '../../contexts/TaskContext';
import { usePomodoro } from '../../contexts/PomodoroContext';
import { TaskCardInlinePomodoro } from '../TaskCardInlinePomodoro';
import { usePermissions } from '../../hooks/usePermissions';
import { getCategoryFromTags } from '../../lib/ai-config';
import { PLANNER_LAYOUT } from '../../lib/layout-constants';
import { PLANNER_UI_TEXT } from '../../lib/navigation-constants';
import { plannerCategoryColor } from '../../lib/planner-chat';
import { PlannerPriorityPill } from './PlannerPriorityPill';
import { triggerSelectionHaptic, triggerSuccessHaptic } from '../../lib/native-haptics';
import type { Task } from '../../types';

interface PlannerTaskRowProps {
  task: Task;
  meta: string;
  onOpen: () => void;
}

/** Timeline-style task row: completion check, when, title, then priority tag and category · duration. */
export function PlannerTaskRow({ task, meta, onOpen }: PlannerTaskRowProps) {
  const { updateTask } = useTasks();
  const { canEditTask } = usePermissions();
  const { getTimerState } = usePomodoro();
  const timer = getTimerState(task.id);
  const done = task.status === 'done';
  const focusActive = !done && (timer.isRunning || timer.isPaused);
  const category = getCategoryFromTags(task.tags);
  const details = [
    category,
    task.estimatedTime ? PLANNER_UI_TEXT.chat.estimate(task.estimatedTime) : '',
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
      <div className="min-w-0">
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
        {focusActive ? (
          <TaskCardInlinePomodoro
            timerId={task.id}
            durationMinutes={task.estimatedTime}
            variant="footer"
            isMobile
            className="planner-tl-focus"
          />
        ) : null}
      </div>
    </div>
  );
}
