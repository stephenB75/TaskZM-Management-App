import { useEffect, useRef } from 'react';
import { useTasks } from '../contexts/TaskContext';
import { useAwards } from '../contexts/AwardContext';
import { buildAwardCheckSignature } from '../lib/award-evaluation';

export function useAwardChecker() {
  const { tasks } = useTasks();
  const { checkAndAwardAchievements, awardsLoaded } = useAwards();
  const previousSignature = useRef<string | null>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!awardsLoaded) return;

    const signature = buildAwardCheckSignature(tasks);

    if (!hasInitialized.current) {
      hasInitialized.current = true;
      previousSignature.current = signature;
      return;
    }

    if (previousSignature.current !== signature) {
      checkAndAwardAchievements();
      previousSignature.current = signature;
    }
  }, [tasks, checkAndAwardAchievements, awardsLoaded]);
}
