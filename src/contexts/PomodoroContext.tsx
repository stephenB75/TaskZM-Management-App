import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { logger } from '../lib/logger';
import { getFromLocalStorage, saveToLocalStorage } from '../lib/utils';
import {
  POMODORO_WORK_DURATION,
  POMODORO_SHORT_BREAK_DURATION,
  POMODORO_LONG_BREAK_DURATION,
  STORAGE_KEY_POMODORO,
} from '../lib/business-constants';
import { NOTIFICATION_TITLES, NOTIFICATION_MESSAGES } from '../lib/notification-constants';
import { useTasks } from './TaskContext';

type TimerMode = 'work' | 'shortBreak' | 'longBreak';

interface TimerState {
  mode: TimerMode;
  timeLeft: number;
  isRunning: boolean;
  sessionsCompleted: number;
  totalTimeTracked: number;
}

interface PomodoroContextType {
  getTimerState: (taskId: string) => TimerState;
  startTimer: (taskId: string) => void;
  pauseTimer: (taskId: string) => Promise<void>;
  stopTimer: (taskId: string) => Promise<void>;
  initializeTimer: (taskId: string, initialTime: number, estimatedTime?: number) => void;
  setWorkDuration: (taskId: string, durationMinutes: number) => void;
  registerCallback: (taskId: string, callback: (minutes: number) => void | Promise<void>, taskTitle: string) => void;
  unregisterCallback: (taskId: string) => Promise<void>;
}

const PomodoroContext = createContext<PomodoroContextType | null>(null);

const DURATIONS = {
  work: POMODORO_WORK_DURATION,
  shortBreak: POMODORO_SHORT_BREAK_DURATION,
  longBreak: POMODORO_LONG_BREAK_DURATION,
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
  const intervalsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const onTimeUpdateCallbacksRef = useRef<Record<string, (minutes: number) => void | Promise<void>>>({});
  const taskTitlesRef = useRef<Record<string, string>>({});
  const lastUpdateTimeRef = useRef<Record<string, number>>({}); // Track last update time for periodic saves
  const sessionStartTimeRef = useRef<Record<string, number>>({}); // Track when work session started
  const elapsedSecondsRef = useRef<Record<string, number>>({}); // Track elapsed seconds in current work session
  const baseTimeTrackedRef = useRef<Record<string, number>>({}); // Track base time that's been saved to server (prevents double counting)
  const timersRef = useRef<Record<string, TimerState>>({});
  const workDurationsRef = useRef<Record<string, number>>({}); // Custom work durations per task (in seconds)

  // Cleanup intervals on unmount
  useEffect(() => {
    return () => {
      Object.values(intervalsRef.current).forEach(interval => {
        if (interval) clearInterval(interval);
      });
    };
  }, []);

  useEffect(() => {
    timersRef.current = timers;
  }, [timers]);

  const getTimerState = (taskId: string): TimerState => {
    return timersRef.current[taskId] || DEFAULT_TIMER_STATE;
  };

  const getWorkDuration = (taskId: string): number => {
    // Return custom duration if set, otherwise default to 25 minutes
    return workDurationsRef.current[taskId] || DURATIONS.work;
  };

  const setWorkDuration = (taskId: string, durationMinutes: number) => {
    // Clamp duration between 5 minutes and 120 minutes (2 hours)
    const clampedMinutes = Math.max(5, Math.min(120, durationMinutes));
    const durationSeconds = clampedMinutes * 60;
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
  };

  const initializeTimer = (taskId: string, initialTime: number, estimatedTime?: number) => {
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
  };

  const startTimer = (taskId: string) => {
    setTimers(prev => {
      const current = prev[taskId] || DEFAULT_TIMER_STATE;
      return {
        ...prev,
        [taskId]: {
          ...current,
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

    runTimer(taskId, { resetElapsed: true });
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

    runTimer(taskId, { resetElapsed: false });
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
      };

      let totalElapsed = savedElapsed;

      if (state.isRunning) {
        const savedAt = data.savedAt ?? Date.now();
        const elapsedSinceSaved = Math.max(0, Math.floor((Date.now() - savedAt) / 1000));
        totalElapsed += elapsedSinceSaved;

        // Use custom work duration if available, otherwise use default
        const duration = state.mode === 'work' 
          ? (workDurationsRef.current[taskId] || DURATIONS.work)
          : DURATIONS[state.mode];

        if (totalElapsed >= duration) {
          newState = {
            ...newState,
            timeLeft: 0,
            isRunning: false,
          };
          elapsedSecondsRef.current[taskId] = duration;
          lastUpdateTimeRef.current[taskId] = Math.floor(duration / 60);
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
          sessionStartTimeRef.current[taskId] = savedSessionStart > 0 ? savedSessionStart : Date.now() - totalElapsed * 1000;
          resumeQueue.push(taskId);
        }
      } else {
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
      const elapsedMinutes = Math.floor(elapsedSeconds / 60);
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

    if (intervalsRef.current[taskId]) {
      clearInterval(intervalsRef.current[taskId]);
      delete intervalsRef.current[taskId];
    }
  };

  const stopTimer = async (taskId: string) => {
    const current = timersRef.current[taskId];
    
    // Save elapsed time when stopping a work session
    if (current && current.mode === 'work' && elapsedSecondsRef.current[taskId] > 0) {
      const elapsedSeconds = elapsedSecondsRef.current[taskId];
      const elapsedMinutes = Math.floor(elapsedSeconds / 60);
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
        timeLeft: workDuration, // Use custom duration
        isRunning: false,
      }
    }));

    if (intervalsRef.current[taskId]) {
      clearInterval(intervalsRef.current[taskId]);
      delete intervalsRef.current[taskId];
    }
  };

  async function handleTimerComplete(taskId: string) {
    const current = timersRef.current[taskId];
    if (!current) return;

    // Stop the timer
    if (intervalsRef.current[taskId]) {
      clearInterval(intervalsRef.current[taskId]);
      delete intervalsRef.current[taskId];
    }

    const taskTitle = taskTitlesRef.current[taskId] || NOTIFICATION_MESSAGES.defaultTaskTitle;

    if (current.mode === 'work') {
      // Calculate total time: existing tracked time + elapsed time in this session
      // Use elapsedSecondsRef to get accurate time (handles pause/resume cases)
      const elapsedSeconds = elapsedSecondsRef.current[taskId] || 0;
      const elapsedMinutes = Math.floor(elapsedSeconds / 60);
      // Ensure we account for at least the full work duration if timer completed
      const workDurationMinutes = Math.floor(getWorkDuration(taskId) / 60);
      const sessionMinutes = Math.max(elapsedMinutes, workDurationMinutes);
      const newSessions = current.sessionsCompleted + 1;
      // Use baseTimeTrackedRef to get the actual saved time (prevents double counting)
      const baseTime = baseTimeTrackedRef.current[taskId] || 0;
      const newTotal = baseTime + sessionMinutes;

      // Update tracked time via callback
      const callback = onTimeUpdateCallbacksRef.current[taskId];
      if (callback) {
        try {
          await callback(newTotal);
          // Update base time ref to reflect what was saved
          baseTimeTrackedRef.current[taskId] = newTotal;
          // Update state to reflect saved time
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

      // Reset elapsed time tracking for next session
      elapsedSecondsRef.current[taskId] = 0;
      lastUpdateTimeRef.current[taskId] = 0;
      sessionStartTimeRef.current[taskId] = 0;

      // Show notification
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(NOTIFICATION_TITLES.pomodoroComplete, {
          body: NOTIFICATION_MESSAGES.pomodoroComplete(taskTitle),
          icon: '/favicon.ico',
        });
      }

      // Auto-switch to break
      // After every 4 completed work sessions, take a long break
      // Otherwise, take a short break
      const nextMode = newSessions % 4 === 0 ? 'longBreak' : 'shortBreak';
      setTimers(prev => ({
        ...prev,
        [taskId]: {
          ...current,
          mode: nextMode,
          timeLeft: DURATIONS[nextMode],
          sessionsCompleted: newSessions,
          totalTimeTracked: newTotal,
          isRunning: false,
        }
      }));
    } else {
      // Break finished, switch back to work
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(NOTIFICATION_TITLES.pomodoroBreak, {
          body: NOTIFICATION_MESSAGES.pomodoroBreakOver(taskTitle),
          icon: '/favicon.ico',
        });
      }

      // Reset elapsed time tracking for next work session
      elapsedSecondsRef.current[taskId] = 0;
      lastUpdateTimeRef.current[taskId] = 0;
      sessionStartTimeRef.current[taskId] = 0;

      const workDuration = getWorkDuration(taskId);
      setTimers(prev => ({
        ...prev,
        [taskId]: {
          ...current,
          mode: 'work',
          timeLeft: workDuration, // Use custom duration
          isRunning: false,
        }
      }));
    }
  }

  const runTimer = (taskId: string, { resetElapsed }: { resetElapsed: boolean }) => {
    if (intervalsRef.current[taskId]) {
      clearInterval(intervalsRef.current[taskId]);
    }

    const now = Date.now();
    const currentState = timersRef.current[taskId] || DEFAULT_TIMER_STATE;

    if (resetElapsed && currentState.mode === 'work') {
      sessionStartTimeRef.current[taskId] = now;
      elapsedSecondsRef.current[taskId] = 0;
      lastUpdateTimeRef.current[taskId] = 0;
    } else if (!resetElapsed && currentState.mode === 'work' && !sessionStartTimeRef.current[taskId]) {
      sessionStartTimeRef.current[taskId] = now;
    }

    intervalsRef.current[taskId] = setInterval(() => {
      setTimers(prev => {
        const current = prev[taskId];
        if (!current || !current.isRunning) {
          return prev;
        }

        if (current.mode === 'work') {
          elapsedSecondsRef.current[taskId] = (elapsedSecondsRef.current[taskId] || 0) + 1;
        }

        if (current.timeLeft <= 1) {
          // Timer complete
          handleTimerComplete(taskId);
          return prev;
        }

        const updated = {
          ...prev,
          [taskId]: {
            ...current,
            timeLeft: current.timeLeft - 1,
          }
        };

        if (current.mode === 'work') {
          const elapsed = elapsedSecondsRef.current[taskId] || 0;
          const elapsedMinutes = Math.floor(elapsed / 60);
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
                  const remainingSeconds = elapsed % 60;
                  elapsedSecondsRef.current[taskId] = remainingSeconds;
                  lastUpdateTimeRef.current[taskId] = 0;
                  setTimers(prevTimers => ({
                    ...prevTimers,
                    [taskId]: {
                      ...(prevTimers[taskId] || DEFAULT_TIMER_STATE),
                      totalTimeTracked: totalMinutes,
                    }
                  }));
                })
                .catch(err => {
                  logger.error('Time update callback error:', err);
                });
            }
          }
        }

        return updated;
      });
    }, 1000);
  };

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

  // Public method to register callbacks
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
      const elapsedMinutes = Math.floor(elapsedSeconds / 60);
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
    throw new Error('usePomodoro must be used within PomodoroProvider');
  }
  return context;
}
