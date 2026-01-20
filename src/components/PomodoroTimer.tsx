import React, { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
// Icons migrated to Icon component
import { Icon } from "./Icon";
import { ICON_SIZE_SM, ICON_SIZE_MD, ICON_SIZE_LG, ICON_SIZE_XS, SETTINGS_PANEL_ICON_SIZE_SMALL } from "../lib/layout-constants";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { cn } from "../lib/utils";
import { usePomodoro } from "../contexts/PomodoroContext";
import { useTheme } from "../contexts/ThemeContext";
import {
  POMODORO_WORK_DURATION,
  POMODORO_SHORT_BREAK_DURATION,
  POMODORO_LONG_BREAK_DURATION,
  SECONDS_PER_MINUTE,
  MINUTES_PER_HOUR,
  PERCENTAGE_MULTIPLIER,
} from "../lib/business-constants";

type TimerMode = "work" | "shortBreak" | "longBreak";

interface PomodoroTimerProps {
  taskId: string;
  taskTitle: string;
  onTimeUpdate: (minutes: number) => void | Promise<void>;
  compact?: boolean;
  initialTime?: number; // Initial actualTime in minutes
  estimatedTime?: number; // Task's estimated duration in minutes
  isMobile?: boolean;
}

const DURATIONS = {
  work: POMODORO_WORK_DURATION, // 25 minutes
  shortBreak: POMODORO_SHORT_BREAK_DURATION, // 5 minutes
  longBreak: POMODORO_LONG_BREAK_DURATION, // 15 minutes
};

export function PomodoroTimer({
  taskId,
  taskTitle,
  onTimeUpdate,
  compact = false,
  initialTime = 0,
  estimatedTime,
  isMobile = false,
}: PomodoroTimerProps) {
  const {
    getTimerState,
    startTimer,
    pauseTimer,
    stopTimer,
    initializeTimer,
    setWorkDuration,
    registerCallback,
    unregisterCallback,
    timers, // Subscribe to timers state to trigger re-renders when timer changes
  } = usePomodoro();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  // Get timer state - reading from state ensures components re-render when timer state changes
  const timerState = getTimerState(taskId);
  
  // Subscribe to timer state changes for this taskId to ensure re-renders
  // This ensures the component updates when timer is started/paused/stopped in other components
  React.useEffect(() => {
    // This effect ensures component re-renders when timer state changes
    // Accessing timers[taskId] in the dependency array ensures re-render when that timer changes
  }, [timers[taskId]]);

  // Initialize timer with task's actual time and estimated duration
  useEffect(() => {
    initializeTimer(taskId, initialTime, estimatedTime);
    registerCallback(taskId, onTimeUpdate, taskTitle);

    return () => {
      unregisterCallback(taskId);
    };
  }, [taskId, initialTime, estimatedTime, taskTitle, initializeTimer, registerCallback, unregisterCallback, onTimeUpdate]);
  
  // Note: Removed redundant useEffect that directly called setWorkDuration
  // initializeTimer already handles setting work duration when estimatedTime is provided

  const toggleTimer = async () => {
    if (timerState.isRunning) {
      await pauseTimer(taskId);
    } else {
      startTimer(taskId);
    }
  };

  const handleStopTimer = async () => {
    await stopTimer(taskId);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / SECONDS_PER_MINUTE);
    const secs = seconds % SECONDS_PER_MINUTE;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getProgress = () => {
    // Calculate progress based on initial timeLeft when timer started
    // We need to track the initial duration, but since we can't easily get it,
    // we'll use estimatedTime if available, otherwise default
    const initialDuration = timerState.mode === 'work' 
      ? (estimatedTime ? estimatedTime * SECONDS_PER_MINUTE : DURATIONS.work)
      : timerState.mode === 'shortBreak' 
        ? DURATIONS.shortBreak 
        : DURATIONS.longBreak;
    
    // Calculate how much time has elapsed
    const elapsed = initialDuration - timerState.timeLeft;
    return Math.min(PERCENTAGE_MULTIPLIER, Math.max(0, (elapsed / initialDuration) * PERCENTAGE_MULTIPLIER));
  };

  const getModeColor = () => {
    switch (timerState.mode) {
      case "work":
        return "bg-primary";
      case "shortBreak":
        return "bg-green-500";
      case "longBreak":
        return "bg-blue-500";
    }
  };

  const getModeIcon = () => {
    const iconSize = isMobile ? "w-1.5 h-1.5" : "w-3.5 h-3.5";
    switch (timerState.mode) {
      case "work":
        return <Icon name="timer" size={ICON_SIZE_SM} />;
      case "shortBreak":
        return <Icon name="coffee" size={ICON_SIZE_SM} />;
      case "longBreak":
        return <Icon name="coffee" size={ICON_SIZE_SM} />;
    }
  };

  const getModeLabel = () => {
    switch (timerState.mode) {
      case "work":
        return "Focus";
      case "shortBreak":
        return "Short Break";
      case "longBreak":
        return "Long Break";
    }
  };

  if (compact) {
    return (
      <div className={cn("flex items-center", isMobile ? "gap-1" : "gap-1.5")}>
        <AnimatePresence mode="wait">
          {timerState.isRunning ? (
            <motion.div
              key="running"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn("flex items-center", isMobile ? "gap-0.5" : "gap-1")}
            >
              <div
                className={cn(
                  "flex items-center rounded-full text-white font-medium",
                  getModeColor(),
                  isMobile ? "gap-0.5 px-0.5 py-0.5 text-[7px]" : "gap-1 px-2 py-0.5 text-[10px]",
                )}
              >
                {getModeIcon()}
                <span>{formatTime(timerState.timeLeft)}</span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className={cn(
                  isMobile ? "h-4 w-4 bg-transparent hover:bg-transparent border-0" : "h-6 w-6"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTimer();
                }}
              >
                <Icon name="pause" size={isMobile ? 10 : 18} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className={cn(
                  isMobile ? "h-4 w-4 bg-transparent hover:bg-transparent border-0" : "h-6 w-6"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStopTimer();
                }}
              >
                <Icon name="square" size={isMobile ? 10 : 18} />
              </Button>
            </motion.div>
          ) : (
            <motion.div
              key="stopped"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={cn("flex items-center", isMobile ? "gap-0.5" : "gap-1")}
            >
              <Button
                size="icon"
                variant="ghost"
                className={cn(
                  "rounded-full text-primary",
                  timerState.sessionsCompleted > 0 && "text-green-500 dark:text-green-400",
                  isMobile 
                    ? "h-4 w-4 bg-transparent hover:bg-transparent border-0" 
                    : "h-6 w-6 border-primary/30 dark:border-primary/40 hover:bg-primary/10 dark:hover:bg-primary/20",
                  timerState.sessionsCompleted > 0 && !isMobile && "border-green-500/30 dark:border-green-400/40 hover:bg-green-500/10 dark:hover:bg-green-400/20",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTimer();
                }}
              >
                <Icon name="play" size={isMobile ? 10 : 18} />
              </Button>
              {timerState.sessionsCompleted > 0 && (
                <span className={cn(
                  "text-green-500 dark:text-green-400 font-medium",
                  isMobile ? "text-[6px]" : "text-[10px]"
                )}>
                  {timerState.sessionsCompleted} 🍅
                </span>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div className="space-y-2 p-3 rounded-lg bg-gradient-to-br from-background/50 dark:from-card/50 to-accent/30 dark:to-accent/30 border border-primary/20 dark:border-primary/30">
      {/* Mode Indicator */}
      <div className="flex items-center justify-between">
        <div
          className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-full text-white text-xs font-medium",
            getModeColor(),
          )}
        >
          {getModeIcon()}
          <span>{getModeLabel()}</span>
        </div>
        {timerState.sessionsCompleted > 0 && (
          <div className="flex items-center gap-1 text-xs text-[#50C878] dark:text-[#5AC888]">
            <Icon name="check-circle" size={SETTINGS_PANEL_ICON_SIZE_SMALL} />
            <span>{timerState.sessionsCompleted} 🍅</span>
          </div>
        )}
      </div>

      {/* Timer Display */}
      <div className="text-center">
        <div className="text-3xl font-mono font-bold text-foreground">
          {formatTime(timerState.timeLeft)}
        </div>
      </div>

      {/* Progress Bar */}
      <Progress value={getProgress()} className="h-2" />

      {/* Controls */}
      <div className="flex items-center justify-center gap-2">
        <Button
          size="sm"
          variant={timerState.isRunning ? "outline" : "default"}
          className={cn(
            "rounded-full",
            !timerState.isRunning &&
              "bg-primary hover:bg-primary/90 dark:hover:bg-primary/80 text-primary-foreground",
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleTimer();
          }}
        >
          {timerState.isRunning ? (
            <>
              <Icon name="pause" size={ICON_SIZE_XS} className="mr-1" />
              Pause
            </>
          ) : (
            <>
              <Icon name="play" size={ICON_SIZE_XS} className="mr-1" />
              {timerState.mode === "work"
                ? "Start Focus"
                : "Start Break"}
            </>
          )}
        </Button>
        {(timerState.isRunning ||
          timerState.timeLeft !==
            (timerState.mode === 'work' 
              ? (estimatedTime ? estimatedTime * SECONDS_PER_MINUTE : DURATIONS.work)
              : timerState.mode === 'shortBreak' 
                ? DURATIONS.shortBreak 
                : DURATIONS.longBreak)) && (
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={handleStopTimer}
          >
            <Icon name="square" size={ICON_SIZE_XS} className="mr-1" />
            Reset
          </Button>
        )}
      </div>

      {/* Stats */}
      {timerState.totalTimeTracked > 0 && (
        <div className="text-center text-xs text-muted-foreground">
          Total tracked:{" "}
          {Math.floor(timerState.totalTimeTracked / MINUTES_PER_HOUR)}h{" "}
          {timerState.totalTimeTracked % MINUTES_PER_HOUR}m
        </div>
      )}
    </div>
  );
}