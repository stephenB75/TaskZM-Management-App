import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { logger } from '../lib/logger';
import { getFromLocalStorage, saveToLocalStorage } from '../lib/utils';
import {
  POMODORO_WORK_DURATION,
  POMODORO_MIN_WORK_MINUTES,
  POMODORO_MAX_WORK_MINUTES,
  STORAGE_KEY_POMODORO,
  SECONDS_PER_MINUTE,
  MILLISECONDS_PER_SECOND,
} from '../lib/business-constants';
import { NOTIFICATION_TITLES, NOTIFICATION_MESSAGES } from '../lib/notification-constants';
import { useTasks } from './TaskContext';
import { createDefaultPomodoroContext } from '../lib/context-defaults';

/** Focus-only timer (no break mode). */
type TimerMode = 'work';

interface TimerState {
  mode: TimerMode;
  timeLeft: number;
  isRunning: boolean;
  sessionsCompleted: number;
  totalTimeTracked: number;
}

export interface StartTimerOptions {
  /** When starting from a card that doesn't mount PomodoroTimer, pass the task's duration so the timer runs for the exact task time. */
  durationMinutes?: number;
}

interface PomodoroContextType {
  getTimerState: (taskId: string) => TimerState;
  startTimer: (taskId: string, options?: StartTimerOptions) => void;
  pauseTimer: (taskId: string) => Promise<void>;
  stopTimer: (taskId: string) => Promise<void>;
  initializeTimer: (taskId: string, initialTime: number, estimatedTime?: number) => void;
  setWorkDuration: (taskId: string, durationMinutes: number) => void;
  registerCallback: (taskId: string, callback: (minutes: number) => void | Promise<void>, taskTitle: string) => void;
  unregisterCallback: (taskId: string) => Promise<void>;
  timers: Record<string, TimerState>;
  /** Increments every second while any timer is running; use so all timer UIs re-render and show countdown. */
  timerTick: number;
}

const PomodoroContext = createContext<PomodoroContextType | null>(null);

const DURATIONS = {
  work: POMODORO_WORK_DURATION,
};

const DEFAULT_TIMER_STATE: TimerState = {
  mode: 'work',
  timeLeft: DURATIONS.work,
  isRunning: false,
  sessionsCompleted: 0,
  totalTimeTracked: 0,
};

interface PersistedTimerState {
  state: TimerState;
  sessionStartTime?: number;
  elapsedSeconds?: number;
  lastUpdateMinutes?: number;
  baseTimeTracked?: number;
  savedAt?: number;
}

const STORAGE_KEY = STORAGE_KEY_POMODORO;

export function PomodoroProvider({ children }: { children: React.ReactNode }) {
  const { updateTask } = useTasks();
  const [timers, setTimers] = useState<Record<string, TimerState>>({});
  const [timerTick, setTimerTick] = useState(0);
  const globalIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTimeUpdateCallbacksRef = useRef<Record<string, (minutes: number) => void | Promise<void>>>({});
  const taskTitlesRef = useRef<Record<string, string>>({});
  const lastUpdateTimeRef = useRef<Record<string, number>>({});
  const sessionStartTimeRef = useRef<Record<string, number>>({});
  const elapsedSecondsRef = useRef<Record<string, number>>({});
  const baseTimeTrackedRef = useRef<Record<string, number>>({});
  const timersRef = useRef<Record<string, TimerState>>({});
  const workDurationsRef = useRef<Record<string, number>>({});
  const handleTimerCompleteRef = useRef<(taskId: string) => void>(() => {});

  // Cleanup global interval on unmount
  useEffect(() => {
    return () => {
      if (globalIntervalRef.current) {
        clearInterval(globalIntervalRef.current);
        globalIntervalRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    timersRef.current = timers;
  }, [timers]);

  const getTimerState = (taskId: string): TimerState => {
    // Read from state (not ref) to ensure components re-render when timer state changes
    // This ensures timer sync across all components
    return timers[taskId] || DEFAULT_TIMER_STATE;
  };

  const getWorkDuration = (taskId: string): number => {
    // Return custom duration if set, otherwise default to 25 minutes
    return workDurationsRef.current[taskId] || DURATIONS.work;
  };

  const setWorkDuration = useCallback((taskId: string, durationMinutes: number) => {
    const clampedMinutes = Math.max(POMODORO_MIN_WORK_MINUTES, Math.min(POMODORO_MAX_WORK_MINUTES, durationMinutes));
    const durationSeconds = clampedMinutes * SECONDS_PER_MINUTE;
    workDurationsRef.current[taskId] = durationSeconds;

    // Update timer state if it exists and is in work mode
    setTimers(prev => {
      const current = prev[taskId];
      if (!current) return prev;

      // If timer is in work mode and not running, update timeLeft
      if (current.mode === 'work' && !current.isRunning) {
        return {
          ...prev,
          [taskId]: {
            ...current,
            timeLeft: durationSeconds,
          }
        };
      }
      return prev;
    });
  }, []); // setTimers is stable from useState, refs are stable

  const initializeTimer = useCallback((taskId: string, initialTime: number, estimatedTime?: number) => {
    // Set custom work duration if estimated time is provided
    if (estimatedTime && estimatedTime > 0) {
      setWorkDuration(taskId, estimatedTime);
    }

    setTimers(prev => {
      const current = prev[taskId];
      const workDuration = getWorkDuration(taskId);
      
      // If timer doesn't exist, initialize it
      if (!current) {
        // Initialize base time ref to match initial time
        baseTimeTrackedRef.current[taskId] = initialTime;
        return {
          ...prev,
          [taskId]: {
            ...DEFAULT_TIMER_STATE,
            timeLeft: workDuration, // Use custom duration
            totalTimeTracked: initialTime,
          }
        };
      }
      // If timer exists and is not running, sync with task's actualTime
      // This ensures the timer state stays in sync with the task after server reload
      if (!current.isRunning) {
        // Update base time ref to match the task's actualTime
        baseTimeTrackedRef.current[taskId] = initialTime;
        if (current.totalTimeTracked !== initialTime || current.timeLeft !== workDuration) {
          return {
            ...prev,
            [taskId]: {
              ...current,
              timeLeft: workDuration, // Update to custom duration
              totalTimeTracked: initialTime,
            }
          };
        }
      }
      // If timer is running, don't reset - it will sync after completion/pause
      return prev;
    });
  }, [setWorkDuration]); // setWorkDuration is stable (uses refs), so this should be stable

  const startTimer = (taskId: string, options?: StartTimerOptions) => {
    // If duration provided (e.g. from card that doesn't mount PomodoroTimer), set work duration to task's exact time
    if (options?.durationMinutes != null && options.durationMinutes > 0) {
      setWorkDuration(taskId, options.durationMinutes);
    }

    setTimers(prev => {
      const current = prev[taskId] || DEFAULT_TIMER_STATE;
      const workDuration = getWorkDuration(taskId);
      return {
        ...prev,
        [taskId]: {
          ...current,
          timeLeft: workDuration,
          isRunning: true,
        }
      };
    });

    // Update task status to "in-progress" when timer starts
    updateTask(taskId, { status: 'in-progress' }).catch(err => {
      logger.error('Failed to update task status to in-progress:', err);
    });

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    runGlobalTick(taskId, true);
  };

  const resumeTimer = (taskId: string) => {
    setTimers(prev => {
      const current = prev[taskId] || DEFAULT_TIMER_STATE;
      if (!current.isRunning) {
        return {
          ...prev,
          [taskId]: {
            ...current,
            isRunning: true,
          }
        };
      }
      return prev;
    });

    // Update task status to "in-progress" when timer resumes
    updateTask(taskId, { status: 'in-progress' }).catch(err => {
      logger.error('Failed to update task status to in-progress:', err);
    });

    runGlobalTick(taskId, false);
  };

  const globalTickCallback = useCallback(() => {
    const currentTimers = timersRef.current;
    const completionQueue: string[] = [];
    let hasUpdates = false;
    const updates: Record<string, TimerState> = {};

    Object.entries(currentTimers).forEach(([taskId, current]) => {
      if (!current.isRunning) return;

      const sessionStart = sessionStartTimeRef.current[taskId];
      const workDuration = getWorkDuration(taskId);

      if (!sessionStart) return;

      const elapsedSeconds = Math.floor((Date.now() - sessionStart) / MILLISECONDS_PER_SECOND);
      elapsedSecondsRef.current[taskId] = elapsedSeconds;
      const timeLeft = Math.max(0, workDuration - elapsedSeconds);

      if (timeLeft <= 0) {
        completionQueue.push(taskId);
        return;
      }

      hasUpdates = true;
      updates[taskId] = { ...current, timeLeft };

      const elapsedMinutes = Math.floor(elapsedSeconds / SECONDS_PER_MINUTE);
      const lastUpdate = lastUpdateTimeRef.current[taskId] || 0;
      if (elapsedMinutes > lastUpdate && elapsedMinutes > 0) {
        lastUpdateTimeRef.current[taskId] = elapsedMinutes;
        const callback = onTimeUpdateCallbacksRef.current[taskId];
        if (callback) {
          const baseTime = baseTimeTrackedRef.current[taskId] || 0;
          const totalMinutes = baseTime + elapsedMinutes;
          callback(totalMinutes)
            .then(() => {
              baseTimeTrackedRef.current[taskId] = totalMinutes;
              const remainingSeconds = elapsedSeconds % SECONDS_PER_MINUTE;
              elapsedSecondsRef.current[taskId] = remainingSeconds;
              sessionStartTimeRef.current[taskId] = Date.now() - remainingSeconds * MILLISECONDS_PER_SECOND;
              lastUpdateTimeRef.current[taskId] = 0;
              setTimers(prevTimers => ({
                ...prevTimers,
                [taskId]: {
                  ...(prevTimers[taskId] || DEFAULT_TIMER_STATE),
                  totalTimeTracked: totalMinutes,
                }
              }));
            })
            .catch(err => logger.error('Time update callback error:', err));
        }
      }
    });

    if (hasUpdates) {
      setTimers(prev => {
        let next = prev;
        Object.entries(updates).forEach(([id, state]) => {
          next = { ...next, [id]: state };
        });
        return next;
      });
    }

    setTimerTick(t => t + 1);

    completionQueue.forEach(taskId => {
      handleTimerCompleteRef.current(taskId);
    });

    const stillRunning = Object.entries(timersRef.current).some(
      ([id, t]) => !completionQueue.includes(id) && t.isRunning
    );
    if (!stillRunning && globalIntervalRef.current) {
      clearInterval(globalIntervalRef.current);
      globalIntervalRef.current = null;
    }
  }, []);

  const ensureGlobalTickRunning = useCallback(() => {
    if (globalIntervalRef.current) return;
    globalIntervalRef.current = setInterval(globalTickCallback, MILLISECONDS_PER_SECOND);
  }, [globalTickCallback]);

  const runGlobalTick = (taskId: string, resetElapsed: boolean) => {
    const now = Date.now();
    if (resetElapsed) {
      sessionStartTimeRef.current[taskId] = now;
      elapsedSecondsRef.current[taskId] = 0;
      lastUpdateTimeRef.current[taskId] = 0;
    } else if (!sessionStartTimeRef.current[taskId]) {
      sessionStartTimeRef.current[taskId] = now;
    }
    ensureGlobalTickRunning();
  };

  useEffect(() => {
    const savedTimers = getFromLocalStorage<Record<string, PersistedTimerState>>(STORAGE_KEY, {});
    if (!savedTimers || Object.keys(savedTimers).length === 0) return;

    const restored: Record<string, TimerState> = {};
    const resumeQueue: string[] = [];
    const completionQueue: string[] = [];

    Object.entries(savedTimers).forEach(([taskId, data]) => {
      const state = data.state;
      if (!state) return;

      const baseTime = data.baseTimeTracked ?? state.totalTimeTracked;
      baseTimeTrackedRef.current[taskId] = baseTime;

      const savedElapsed = data.elapsedSeconds ?? 0;
      const savedSessionStart = data.sessionStartTime ?? 0;
      const savedLastUpdate = data.lastUpdateMinutes ?? 0;

      let newState: TimerState = {
        ...DEFAULT_TIMER_STATE,
        ...state,
        mode: 'work',
      };

      let totalElapsed = savedElapsed;

      if (state.isRunning) {
        const savedAt = data.savedAt ?? Date.now();
        const elapsedSinceSaved = Math.max(0, Math.floor((Date.now() - savedAt) / MILLISECONDS_PER_SECOND));
        totalElapsed += elapsedSinceSaved;

        const duration = workDurationsRef.current[taskId] || DURATIONS.work;

        if (totalElapsed >= duration) {
          newState = {
            ...newState,
            timeLeft: 0,
            isRunning: false,
          };
          elapsedSecondsRef.current[taskId] = duration;
          lastUpdateTimeRef.current[taskId] = Math.floor(duration / SECONDS_PER_MINUTE);
          sessionStartTimeRef.current[taskId] = 0;
          completionQueue.push(taskId);
        } else {
          const remaining = duration - totalElapsed;
          newState = {
            ...newState,
            timeLeft: remaining,
            isRunning: true,
          };
          elapsedSecondsRef.current[taskId] = totalElapsed;
          lastUpdateTimeRef.current[taskId] = savedLastUpdate;
          sessionStartTimeRef.current[taskId] = savedSessionStart > 0 ? savedSessionStart : Date.now() - totalElapsed * MILLISECONDS_PER_SECOND;
          resumeQueue.push(taskId);
        }
      } else {
        newState.timeLeft = workDurationsRef.current[taskId] || DURATIONS.work;
        elapsedSecondsRef.current[taskId] = savedElapsed;
        lastUpdateTimeRef.current[taskId] = savedLastUpdate;
        sessionStartTimeRef.current[taskId] = savedSessionStart;
      }

      restored[taskId] = newState;
    });

    if (Object.keys(restored).length > 0) {
      setTimers(prev => ({ ...prev, ...restored }));
    }

    resumeQueue.forEach(taskId => {
      setTimeout(() => resumeTimer(taskId), 0);
    });

    completionQueue.forEach(taskId => {
      setTimeout(() => handleTimerComplete(taskId), 0);
    });
  }, []);

  const pauseTimer = async (taskId: string) => {
    const current = timersRef.current[taskId];
    if (!current) return;

    // Save elapsed time when pausing a work session
    if (current.mode === 'work' && elapsedSecondsRef.current[taskId] > 0) {
      const elapsedSeconds = elapsedSecondsRef.current[taskId];
      // So resume continues from the same point (task card or dialog)
      sessionStartTimeRef.current[taskId] = Date.now() - elapsedSeconds * MILLISECONDS_PER_SECOND;

      const elapsedMinutes = Math.floor(elapsedSeconds / SECONDS_PER_MINUTE);
      if (elapsedMinutes > 0) {
        // Use baseTimeTrackedRef to get the actual saved time (prevents double counting)
        const baseTime = baseTimeTrackedRef.current[taskId] || 0;
        const newTotal = baseTime + elapsedMinutes;
        const callback = onTimeUpdateCallbacksRef.current[taskId];
        if (callback) {
          try {
            await callback(newTotal);
            // Update base time ref to reflect what was saved
            baseTimeTrackedRef.current[taskId] = newTotal;
            // Update totalTimeTracked after successful save to reflect the new base
            setTimers(prev => ({
              ...prev,
              [taskId]: {
                ...(prev[taskId] || DEFAULT_TIMER_STATE),
                totalTimeTracked: newTotal,
              }
            }));
          } catch (err) {
            logger.error('Failed to save time on pause:', err);
          }
        }
        // Reset elapsed seconds for next session (all time has been saved)
        elapsedSecondsRef.current[taskId] = 0;
        lastUpdateTimeRef.current[taskId] = 0;
      }
    }

    setTimers(prev => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || DEFAULT_TIMER_STATE),
        isRunning: false,
      }
    }));

    const anyOtherRunning = Object.entries(timersRef.current).some(([id, t]) => id !== taskId && t.isRunning);
    if (!anyOtherRunning && globalIntervalRef.current) {
      clearInterval(globalIntervalRef.current);
      globalIntervalRef.current = null;
    }
  };

  const stopTimer = async (taskId: string) => {
    const current = timersRef.current[taskId];
    
    // Save elapsed time when stopping a work session
    if (current && current.mode === 'work' && elapsedSecondsRef.current[taskId] > 0) {
      const elapsedSeconds = elapsedSecondsRef.current[taskId];
      const elapsedMinutes = Math.floor(elapsedSeconds / SECONDS_PER_MINUTE);
      if (elapsedMinutes > 0) {
        // Use baseTimeTrackedRef to get the actual saved time (prevents double counting)
        const baseTime = baseTimeTrackedRef.current[taskId] || 0;
        const newTotal = baseTime + elapsedMinutes;
        const callback = onTimeUpdateCallbacksRef.current[taskId];
        if (callback) {
          try {
            await callback(newTotal);
            // Update base time ref to reflect what was saved
            baseTimeTrackedRef.current[taskId] = newTotal;
            // Update totalTimeTracked to reflect saved time
            setTimers(prev => ({
              ...prev,
              [taskId]: {
                ...(prev[taskId] || DEFAULT_TIMER_STATE),
                totalTimeTracked: newTotal,
              }
            }));
          } catch (err) {
            logger.error('Failed to save time on stop:', err);
          }
        }
      }
    }

    // Reset elapsed time tracking
    elapsedSecondsRef.current[taskId] = 0;
    lastUpdateTimeRef.current[taskId] = 0;
    sessionStartTimeRef.current[taskId] = 0;

    const workDuration = getWorkDuration(taskId);
    setTimers(prev => ({
      ...prev,
      [taskId]: {
        ...(prev[taskId] || DEFAULT_TIMER_STATE),
        mode: 'work',
        timeLeft: workDuration,
        isRunning: false,
      }
    }));

    const anyOtherRunning = Object.entries(timersRef.current).some(([id, t]) => id !== taskId && t.isRunning);
    if (!anyOtherRunning && globalIntervalRef.current) {
      clearInterval(globalIntervalRef.current);
      globalIntervalRef.current = null;
    }
  };

  async function handleTimerComplete(taskId: string) {
    const current = timersRef.current[taskId];
    if (!current) return;

    const taskTitle = taskTitlesRef.current[taskId] || NOTIFICATION_MESSAGES.defaultTaskTitle;

    if (current.mode === 'work') {
      const elapsedSeconds = elapsedSecondsRef.current[taskId] || 0;
      const elapsedMinutes = Math.floor(elapsedSeconds / SECONDS_PER_MINUTE);
      const workDurationMinutes = Math.floor(getWorkDuration(taskId) / SECONDS_PER_MINUTE);
      const sessionMinutes = Math.max(elapsedMinutes, workDurationMinutes);
      const newSessions = current.sessionsCompleted + 1;
      const baseTime = baseTimeTrackedRef.current[taskId] || 0;
      const newTotal = baseTime + sessionMinutes;

      const callback = onTimeUpdateCallbacksRef.current[taskId];
      if (callback) {
        try {
          await callback(newTotal);
          baseTimeTrackedRef.current[taskId] = newTotal;
          setTimers(prev => ({
            ...prev,
            [taskId]: {
              ...current,
              totalTimeTracked: newTotal,
            }
          }));
        } catch (err) {
          logger.error('Failed to save time on completion:', err);
        }
      }

      elapsedSecondsRef.current[taskId] = 0;
      lastUpdateTimeRef.current[taskId] = 0;
      sessionStartTimeRef.current[taskId] = 0;

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(NOTIFICATION_TITLES.pomodoroComplete, {
          body: NOTIFICATION_MESSAGES.pomodoroComplete(taskTitle),
          icon: '/favicon.ico',
        });
      }

      toast.success(NOTIFICATION_TITLES.pomodoroComplete, {
        description: NOTIFICATION_MESSAGES.pomodoroComplete(taskTitle),
        duration: 10_000,
        action: {
          label: 'Mark task complete',
          onClick: () => {
            updateTask(taskId, { status: 'done', completedAt: new Date().toISOString() }).catch(err => {
              logger.error('Failed to mark task complete after Pomodoro:', err);
              toast.error('Could not mark task complete');
            });
          },
        },
      });

      const workDuration = getWorkDuration(taskId);
      setTimers(prev => ({
        ...prev,
        [taskId]: {
          ...current,
          mode: 'work',
          timeLeft: workDuration,
          sessionsCompleted: newSessions,
          totalTimeTracked: newTotal,
          isRunning: false,
        }
      }));

      const anyOtherRunning = Object.entries(timersRef.current).some(([id, t]) => id !== taskId && t.isRunning);
      if (!anyOtherRunning && globalIntervalRef.current) {
        clearInterval(globalIntervalRef.current);
        globalIntervalRef.current = null;
      }
    }
  }

  useEffect(() => {
    handleTimerCompleteRef.current = handleTimerComplete;
  });

  // Persist timers to local storage for refresh resilience
  useEffect(() => {
    const persisted: Record<string, PersistedTimerState> = {};
    const timestamp = Date.now();

    Object.entries(timers).forEach(([taskId, state]) => {
      persisted[taskId] = {
        state,
        sessionStartTime: sessionStartTimeRef.current[taskId] || 0,
        elapsedSeconds: elapsedSecondsRef.current[taskId] || 0,
        lastUpdateMinutes: lastUpdateTimeRef.current[taskId] || 0,
        baseTimeTracked: baseTimeTrackedRef.current[taskId] || state.totalTimeTracked,
        savedAt: timestamp,
      };
    });

    saveToLocalStorage(STORAGE_KEY, persisted);
  }, [timers]);

  // Public method to register callbacks. Callbacks persist total minutes to task.actualTime via updateTask.
  // That data flows to: Analytics (total/weekly time tracked, time-tracking trend); AwardContext (Pomodoro session count = actualTime/25).
  const registerCallback = (taskId: string, callback: (minutes: number) => void | Promise<void>, taskTitle: string) => {
    onTimeUpdateCallbacksRef.current[taskId] = callback;
    taskTitlesRef.current[taskId] = taskTitle;
  };

  // Public method to unregister callbacks
  const unregisterCallback = async (taskId: string) => {
    // Save any remaining time before unregistering
    const current = timers[taskId];
    if (current && current.mode === 'work' && elapsedSecondsRef.current[taskId] > 0) {
      const elapsedSeconds = elapsedSecondsRef.current[taskId];
      const elapsedMinutes = Math.floor(elapsedSeconds / SECONDS_PER_MINUTE);
      if (elapsedMinutes > 0) {
        // Use baseTimeTrackedRef to get the actual saved time (prevents double counting)
        const baseTime = baseTimeTrackedRef.current[taskId] || 0;
        const newTotal = baseTime + elapsedMinutes;
        const callback = onTimeUpdateCallbacksRef.current[taskId];
        if (callback) {
          try {
            await callback(newTotal);
            // Update base time ref to reflect what was saved
            baseTimeTrackedRef.current[taskId] = newTotal;
          } catch (err) {
            logger.error('Failed to save time on unregister:', err);
          }
        }
      }
    }

    delete onTimeUpdateCallbacksRef.current[taskId];
    delete taskTitlesRef.current[taskId];
    delete elapsedSecondsRef.current[taskId];
    delete lastUpdateTimeRef.current[taskId];
    delete sessionStartTimeRef.current[taskId];
    delete baseTimeTrackedRef.current[taskId];
    delete workDurationsRef.current[taskId];
  };

  const value: PomodoroContextType = {
    getTimerState,
    startTimer,
    pauseTimer,
    stopTimer,
    initializeTimer,
    setWorkDuration,
    registerCallback,
    unregisterCallback,
    timers,
    timerTick,
  };

  return (
    <PomodoroContext.Provider value={value}>
      {children}
    </PomodoroContext.Provider>
  );
}

export function usePomodoro() {
  const context = useContext(PomodoroContext);
  if (!context) {
    // During React Fast Refresh (HMR), providers can temporarily unmount
    // Return a safe default instead of throwing to prevent crashes
    if (import.meta.env.DEV) {
      console.warn('usePomodoro called outside PomodoroProvider (likely HMR issue), returning default');
      return createDefaultPomodoroContext();
    }
    throw new Error('usePomodoro must be used within PomodoroProvider');
  }
  return context;
}
