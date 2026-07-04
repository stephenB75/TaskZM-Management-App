/**
 * Opens a task dialog when NOTIFICATION_OPEN_TASK_EVENT fires with a taskId.
 */

import { useEffect } from 'react';
import type { Task } from '../types';
import { useTasks } from '../contexts/TaskContext';
import { NOTIFICATION_OPEN_TASK_EVENT } from '../lib/notification-constants';

export function useTaskDeepLinkOpener(onOpenTask: (task: Task) => void): void {
  const { tasks } = useTasks();

  useEffect(() => {
    const handler = (event: Event) => {
      const customEvent = event as CustomEvent<{ taskId?: string }>;
      const taskId = customEvent.detail?.taskId;
      if (!taskId) return;

      const task = tasks.find((entry) => entry.id === taskId);
      if (task) {
        onOpenTask(task);
      }
    };

    window.addEventListener(NOTIFICATION_OPEN_TASK_EVENT, handler as EventListener);
    return () => {
      window.removeEventListener(NOTIFICATION_OPEN_TASK_EVENT, handler as EventListener);
    };
  }, [tasks, onOpenTask]);
}
