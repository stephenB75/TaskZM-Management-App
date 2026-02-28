import React, { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
// Icons migrated to Icon component
import { Icon } from "./Icon";
import { ICON_SIZE_SM, ICON_SIZE_MD, ICON_SIZE_LG, ICON_SIZE_XS, SETTINGS_PANEL_ICON_SIZE_SMALL } from "../lib/layout-constants";
import { TASK_CARD_ICON_SIZES } from "../lib/task-card-constants";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { cn } from "../lib/utils";
import { usePomodoro } from "../contexts/PomodoroContext";
import { useTheme } from "../contexts/ThemeContext";
import {
  POMODORO_WORK_DURATION,
  SECONDS_PER_MINUTE,
  MINUTES_PER_HOUR,
  PERCENTAGE_MULTIPLIER,
} from "../lib/business-constants";
import { NOTIFICATION_POMODORO_UI } from "../lib/notification-constants";

type TimerMode = "work";

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
  work: POMODORO_WORK_DURATION,
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
    timers,
    timerTick,
  } = usePomodoro();
  const { actualTheme } = useTheme();
  const isDark = actualTheme === 'dark';
  const timerState = getTimerState(taskId);

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
      // Pass task duration when starting so timer uses accurate duration (from dialog form or card getTaskMinutes)
      startTimer(taskId, estimatedTime != null && estimatedTime > 0 ? { durationMinutes: estimatedTime } : undefined);
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

  const getTotalDurationSeconds = () =>
    estimatedTime ? estimatedTime * SECONDS_PER_MINUTE : DURATIONS.work;

  const getProgress = () => {
    const initialDuration = getTotalDurationSeconds();
    const elapsed = initialDuration - timerState.timeLeft;
    return Math.min(PERCENTAGE_MULTIPLIER, Math.max(0, (elapsed / initialDuration) * PERCENTAGE_MULTIPLIER));
  };

  const getModeColor = () => "bg-primary";

  const getModeIcon = () => <Icon name="timer" size={ICON_SIZE_SM} />;

  const getModeLabel = () => NOTIFICATION_POMODORO_UI.modeLabel;

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
                <Icon name="pause" size={isMobile ? TASK_CARD_ICON_SIZES.pomodoroCompact.mobile : TASK_CARD_ICON_SIZES.pomodoroCompact.desktop} />
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
                <Icon name="square" size={isMobile ? TASK_CARD_ICON_SIZES.pomodoroCompact.mobile : TASK_CARD_ICON_SIZES.pomodoroCompact.desktop} />
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
                <Icon name="play" size={isMobile ? TASK_CARD_ICON_SIZES.pomodoroCompact.mobile : TASK_CARD_ICON_SIZES.pomodoroCompact.desktop} />
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
          <div className="flex items-center gap-1 text-xs text-green-500 dark:text-green-400">
            <Icon name="check-circle" size={SETTINGS_PANEL_ICON_SIZE_SMALL} />
            <span>{timerState.sessionsCompleted} 🍅</span>
          </div>
        )}
      </div>

      {/* Timer Display - countdown and total duration */}
      <div className="text-center">
        <div className="text-3xl font-mono font-bold text-foreground tabular-nums">
          {formatTime(timerState.timeLeft)}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {NOTIFICATION_POMODORO_UI.durationOf(formatTime(getTotalDurationSeconds()))}
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
              {NOTIFICATION_POMODORO_UI.pause}
            </>
          ) : (
            <>
              <Icon name="play" size={ICON_SIZE_XS} className="mr-1" />
              {NOTIFICATION_POMODORO_UI.startFocus}
            </>
          )}
        </Button>
        {(timerState.isRunning ||
          timerState.timeLeft !== (estimatedTime ? estimatedTime * SECONDS_PER_MINUTE : DURATIONS.work)) && (
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={handleStopTimer}
          >
            <Icon name="square" size={ICON_SIZE_XS} className="mr-1" />
            {NOTIFICATION_POMODORO_UI.reset}
          </Button>
        )}
      </div>

      {/* Stats */}
      {timerState.totalTimeTracked > 0 && (
        <div className="text-center text-xs text-muted-foreground">
          {NOTIFICATION_POMODORO_UI.totalTracked}{" "}
          {Math.floor(timerState.totalTimeTracked / MINUTES_PER_HOUR)}h{" "}
          {timerState.totalTimeTracked % MINUTES_PER_HOUR}m
        </div>
      )}
    </div>
  );
}