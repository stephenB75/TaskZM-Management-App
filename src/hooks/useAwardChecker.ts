import { useEffect, useRef } from 'react';
import { useTasks } from '../contexts/TaskContext';
import { useAwards } from '../contexts/AwardContext';

export function useAwardChecker() {
  const { tasks } = useTasks();
  const { checkAndAwardAchievements, earnedAwards } = useAwards();
  const previousCompletedCount = useRef(0);
  const hasInitialized = useRef(false);

  useEffect(() => {
    const completedTasks = tasks.filter(t => t.status === 'done');
    const currentCompletedCount = completedTasks.length;

    // Wait for earnedAwards to be loaded before checking (prevents re-showing awards on refresh)
    // Only initialize and check if we have tasks AND earnedAwards is loaded (empty array means loaded)
    if (!hasInitialized.current && tasks.length > 0 && earnedAwards !== undefined) {
      hasInitialized.current = true;
      // Don't check on initial load - only check when tasks actually change
      previousCompletedCount.current = currentCompletedCount;
      return;
    }

    // Only check for awards if completed count increased (new tasks completed)
    // This prevents re-checking already-earned awards on app refresh
    if (hasInitialized.current && currentCompletedCount > previousCompletedCount.current) {
      checkAndAwardAchievements();
    }

    // Update the count even if we didn't check (to track changes)
    if (hasInitialized.current) {
      previousCompletedCount.current = currentCompletedCount;
    }
  }, [tasks, checkAndAwardAchievements, earnedAwards]);
}
