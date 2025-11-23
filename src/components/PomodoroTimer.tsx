import React, { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Play,
  Pause,
  Square,
  Timer,
  Coffee,
  CheckCircle2,
} from "lucide-react";
import { Button } from "./ui/button";
import { Progress } from "./ui/progress";
import { cn } from "../lib/utils";
import { usePomodoro } from "../contexts/PomodoroContext";
import { useTheme } from "../contexts/ThemeContext";

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
  work: 25 * 60, // 25 minutes
  shortBreak: 5 * 60, // 5 minutes
  longBreak: 15 * 60, // 15 minutes
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
  }, [taskId, initialTime, estimatedTime, taskTitle, initializeTimer, registerCallback, unregisterCallback]);

  // Update work duration when estimatedTime changes
  useEffect(() => {
    if (estimatedTime && estimatedTime > 0) {
      setWorkDuration(taskId, estimatedTime);
    }
  }, [taskId, estimatedTime, setWorkDuration]);

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
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const getProgress = () => {
    // Calculate progress based on initial timeLeft when timer started
    // We need to track the initial duration, but since we can't easily get it,
    // we'll use estimatedTime if available, otherwise default
    const initialDuration = timerState.mode === 'work' 
      ? (estimatedTime ? estimatedTime * 60 : DURATIONS.work)
      : DURATIONS[timerState.mode];
    
    // Calculate how much time has elapsed
    const elapsed = initialDuration - timerState.timeLeft;
    return Math.min(100, Math.max(0, (elapsed / initialDuration) * 100));
  };

  const getModeColor = () => {
    switch (timerState.mode) {
      case "work":
        return "bg-[#7B68EE]";
      case "shortBreak":
        return "bg-[#50C878]";
      case "longBreak":
        return "bg-[#4A90E2]";
    }
  };

  const getModeIcon = () => {
    const iconSize = isMobile ? "w-1.5 h-1.5" : "w-3.5 h-3.5";
    switch (timerState.mode) {
      case "work":
        return <Timer className={iconSize} />;
      case "shortBreak":
        return <Coffee className={iconSize} />;
      case "longBreak":
        return <Coffee className={iconSize} />;
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
                  isMobile ? "h-2.5 w-2.5 bg-transparent hover:bg-transparent border-0" : "h-5 w-5"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTimer();
                }}
              >
                <Pause className={cn(isMobile ? "w-1.5 h-1.5" : "w-3 h-3")} />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className={cn(
                  isMobile ? "h-2.5 w-2.5 bg-transparent hover:bg-transparent border-0" : "h-5 w-5"
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStopTimer();
                }}
              >
                <Square className={cn(isMobile ? "w-1.5 h-1.5" : "w-3 h-3")} />
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
                  "rounded-full text-[#7B68EE] dark:text-[#9B87E8]",
                  timerState.sessionsCompleted > 0 && "text-[#50C878] dark:text-[#5AC888]",
                  isMobile 
                    ? "h-2.5 w-2.5 bg-transparent hover:bg-transparent border-0" 
                    : "h-5 w-5 border-[#7B68EE]/30 dark:border-[#9B87E8]/40 hover:bg-[#7B68EE]/10 dark:hover:bg-[#9B87E8]/20",
                  timerState.sessionsCompleted > 0 && !isMobile && "border-[#50C878]/30 dark:border-[#5AC888]/40 hover:bg-[#50C878]/10 dark:hover:bg-[#5AC888]/20",
                )}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleTimer();
                }}
              >
                <Play className={cn(isMobile ? "w-1.5 h-1.5" : "w-3 h-3")} />
              </Button>
              {timerState.sessionsCompleted > 0 && (
                <span className={cn(
                  "text-[#50C878] dark:text-[#5AC888] font-medium",
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
    <div className="space-y-2 p-3 rounded-lg bg-gradient-to-br from-white/50 dark:from-gray-800/50 to-[#F3E8FF]/30 dark:to-purple-900/30 border border-[#7B68EE]/20 dark:border-[#9B87E8]/30">
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
            <CheckCircle2 className="w-3.5 h-3.5" />
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
              "bg-[#7B68EE] dark:bg-[#9B87E8] hover:bg-[#6A5ACD] dark:hover:bg-[#8A77D8] text-white",
          )}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleTimer();
          }}
        >
          {timerState.isRunning ? (
            <>
              <Pause className="w-4 h-4 mr-1" />
              Pause
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-1" />
              {timerState.mode === "work"
                ? "Start Focus"
                : "Start Break"}
            </>
          )}
        </Button>
        {(timerState.isRunning ||
          timerState.timeLeft !==
            (timerState.mode === 'work' 
              ? (estimatedTime ? estimatedTime * 60 : DURATIONS.work)
              : DURATIONS[timerState.mode])) && (
          <Button
            size="sm"
            variant="outline"
            className="rounded-full"
            onClick={handleStopTimer}
          >
            <Square className="w-4 h-4 mr-1" />
            Reset
          </Button>
        )}
      </div>

      {/* Stats */}
      {timerState.totalTimeTracked > 0 && (
        <div className="text-center text-xs text-muted-foreground">
          Total tracked:{" "}
          {Math.floor(timerState.totalTimeTracked / 60)}h{" "}
          {timerState.totalTimeTracked % 60}m
        </div>
      )}
    </div>
  );
}