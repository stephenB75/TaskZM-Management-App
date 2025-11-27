import type { Task } from '../types';
import { TASK_CARD_HEIGHT_CONFIG, TASK_CARD_LAYOUT_METRICS } from './task-card-constants';
import { TASK_CALCULATION_CONSTANTS } from './task-calculation-constants';

const DEFAULT_DAY_START_MINUTES = TASK_CALCULATION_CONSTANTS.dragDrop.hourMin * 60;

export interface TaskLayoutSpacing {
  task: Task;
  marginTop: number;
}

export function buildTaskLayouts(tasks: Task[], minGapOverride?: number): TaskLayoutSpacing[] {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return [];
  }

  const pixelsPerMinute = TASK_CARD_LAYOUT_METRICS.pixelsPerMinute;
  const minGapPx = typeof minGapOverride === 'number' ? minGapOverride : TASK_CARD_LAYOUT_METRICS.minGapPx;

  const firstStartMinutes = getStartMinutes(tasks[0]);
  let previousEndMinutes = firstStartMinutes ?? DEFAULT_DAY_START_MINUTES;

  return tasks.map((task, index) => {
    const startMinutes = getStartMinutes(task);
    const duration = getDurationMinutes(task);

    let marginTop = index === 0 ? 0 : minGapPx;

    if (startMinutes !== null) {
      if (index === 0) {
        previousEndMinutes = startMinutes;
      }
      const gapMinutes = Math.max(0, startMinutes - previousEndMinutes);
      const gapPixels = gapMinutes * pixelsPerMinute;
      marginTop = index === 0 ? Math.max(gapPixels, 0) : Math.max(gapPixels, minGapPx);
      previousEndMinutes = Math.max(previousEndMinutes, startMinutes + duration);
    } else {
      previousEndMinutes += duration;
    }

    return {
      task,
      marginTop,
    };
  });
}

function getStartMinutes(task: Task): number | null {
  if (!task || !task.scheduledDate) return null;
  const date = new Date(task.scheduledDate);
  if (Number.isNaN(date.getTime())) return null;
  return date.getHours() * 60 + date.getMinutes();
}

function getDurationMinutes(task: Task): number {
  return typeof task.estimatedTime === 'number' && task.estimatedTime > 0
    ? task.estimatedTime
    : TASK_CARD_HEIGHT_CONFIG.defaultDuration;
}

