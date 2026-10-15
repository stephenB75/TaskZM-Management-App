import React, { useMemo } from 'react';
import { useTasks } from '../../contexts/TaskContext';
import { usePlannerChat } from '../../contexts/PlannerChatContext';
import { useSheetItem } from '../../hooks/useSheetItem';
import { isUnfinishedTask, tasksToPlace } from '../../lib/home-task-groups';
import { PLANNER_UI_TEXT } from '../../lib/navigation-constants';
import { formatPlannedWhen, startOfPlannerWeek } from '../../lib/planner-chat';
import {
  DAYS_IN_WEEK,
  MILLISECONDS_PER_DAY,
  MILLISECONDS_PER_MINUTE,
  PLANNER_TIMELINE_GROUP_LIMIT,
  PLANNER_TIMELINE_WEEKS_AHEAD,
} from '../../lib/business-constants';
import { getDateString } from '../../lib/utils';
import { TaskDialog } from '../TaskDialog';
import { PlannerTaskRow } from './PlannerTaskRow';
import type { Task } from '../../types';

const TEXT = PLANNER_UI_TEXT.timeline;

interface TimelineGroup {
  key: string;
  label: string;
  tasks: Task[];
}

function weekLabel(index: number): string {
  if (index === 0) return TEXT.thisWeek;
  if (index === 1) return TEXT.nextWeek;
  if (index > PLANNER_TIMELINE_WEEKS_AHEAD) return TEXT.later;
  return TEXT.inWeeks(index);
}

function scheduledAt(task: Task): number {
  return task.scheduledDate ? new Date(task.scheduledDate).getTime() : Number.NaN;
}

/** The task happening now, or the next one to start. */
function findUpNext(tasks: Task[], now: Date): Task | null {
  const nowMs = now.getTime();
  return (
    tasks
      .filter((task) => task.status !== 'done' && task.scheduledDate)
      .filter((task) => {
        const start = scheduledAt(task);
        const end = start + (task.estimatedTime ?? 0) * MILLISECONDS_PER_MINUTE;
        return end >= nowMs;
      })
      .sort((a, b) => scheduledAt(a) - scheduledAt(b))[0] ?? null
  );
}

function groupByWeek(tasks: Task[], now: Date): TimelineGroup[] {
  const weekStart = startOfPlannerWeek(now).getTime();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekMs = DAYS_IN_WEEK * MILLISECONDS_PER_DAY;
  const groups = new Map<number, Task[]>();

  tasks
    .filter((task) => task.scheduledDate && scheduledAt(task) >= todayStart.getTime())
    .sort((a, b) => scheduledAt(a) - scheduledAt(b))
    .forEach((task) => {
      const index = Math.min(
        Math.floor((scheduledAt(task) - weekStart) / weekMs),
        PLANNER_TIMELINE_WEEKS_AHEAD + 1,
      );
      const bucket = groups.get(index) ?? [];
      if (bucket.length < PLANNER_TIMELINE_GROUP_LIMIT) bucket.push(task);
      groups.set(index, bucket);
    });

  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([index, items]) => ({ key: `week-${index}`, label: weekLabel(index), tasks: items }));
}

export function PlannerTimeline({ className, onPlanWithAi }: { className?: string; onPlanWithAi?: () => void }) {
  const { tasks } = useTasks();
  const { scheduleInbox, busy } = usePlannerChat();
  const editor = useSheetItem<Task>();
  const now = useMemo(() => new Date(), [tasks]);

  const upNext = useMemo(() => findUpNext(tasks, now), [tasks, now]);
  const overdue = useMemo(() => tasks.filter((task) => isUnfinishedTask(task, now)), [tasks, now]);
  const needsTime = useMemo(() => tasksToPlace(tasks, overdue), [tasks, overdue]);
  const groups = useMemo(() => groupByWeek(tasks, now), [tasks, now]);
  const isEmpty = groups.length === 0 && needsTime.length === 0 && overdue.length === 0;

  const planWithAi = () => {
    void scheduleInbox();
    onPlanWithAi?.();
  };

  const metaFor = (task: Task) => (task.scheduledDate ? formatPlannedWhen(new Date(task.scheduledDate)) : '');

  return (
    <section className={`planner-panel ${className ?? ''}`} aria-label={TEXT.title}>
      <header className="planner-header">
        <div className="min-w-0">
          <span className="planner-eyebrow">{TEXT.eyebrow}</span>
          <h2 className="planner-title">{TEXT.title}</h2>
        </div>
      </header>

      <div className="planner-scroll">
        {upNext ? (
          <button type="button" className="planner-upnext taskzm-up-next" onClick={() => editor.show(upNext)}>
            <span className="planner-pulse" aria-hidden />
            <span className="min-w-0">
              <span className="planner-eyebrow" style={{ color: 'inherit' }}>{TEXT.upNext}</span>
              <strong>{upNext.title}</strong>
              <small>{metaFor(upNext)}</small>
            </span>
          </button>
        ) : isEmpty ? (
          <div className="planner-empty">
            <strong>{TEXT.empty}</strong>
            <span>{TEXT.nothingNextHint}</span>
          </div>
        ) : (
          <div className="planner-upnext" data-empty="true">
            <span className="planner-dot" style={{ background: 'currentColor' }} aria-hidden />
            <span className="min-w-0">
              <strong>{TEXT.nothingNext}</strong>
              <small>{TEXT.nothingNextHint}</small>
            </span>
          </div>
        )}

        <div data-tour="home-agenda">
          {overdue.length > 0 ? (
            <div>
              <div className="planner-group-label">
                <span className="planner-eyebrow">{TEXT.overdue}</span>
              </div>
              {overdue.slice(0, PLANNER_TIMELINE_GROUP_LIMIT).map((task) => (
                <PlannerTaskRow key={task.id} task={task} meta={metaFor(task)} onOpen={() => editor.show(task)} />
              ))}
            </div>
          ) : null}

          {groups.map((group) => (
            <div key={group.key}>
              <div className="planner-group-label">
                <span className="planner-eyebrow">{group.label}</span>
              </div>
              {group.tasks.map((task) => (
                <PlannerTaskRow key={task.id} task={task} meta={metaFor(task)} onOpen={() => editor.show(task)} />
              ))}
            </div>
          ))}

          <div>
            <div className="planner-group-label">
              <span className="planner-eyebrow">
                {TEXT.needsTime}
                {needsTime.length > 0 ? ` · ${needsTime.length}` : ''}
              </span>
              <button
                type="button"
                className="planner-pill planner-pill--lime"
                data-tour="place-tasks"
                onClick={planWithAi}
                disabled={busy || needsTime.length === 0}
              >
                {TEXT.planWithAi}
              </button>
            </div>
            {needsTime.slice(0, PLANNER_TIMELINE_GROUP_LIMIT).map((task) => (
              <PlannerTaskRow key={task.id} task={task} meta="" onOpen={() => editor.show(task)} />
            ))}
          </div>
        </div>
      </div>

      {editor.item ? (
        <TaskDialog open={editor.open} task={editor.item} onClose={editor.close} initialDate={getDateString(now)} />
      ) : null}
    </section>
  );
}
