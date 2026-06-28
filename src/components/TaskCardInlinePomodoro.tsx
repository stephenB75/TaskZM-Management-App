import React from 'react';
import { Icon } from './Icon';
import { usePomodoro } from '../contexts/PomodoroContext';
import { cn } from '../lib/utils';
import { NOTIFICATION_POMODORO_UI, NOTIFICATION_POMODORO_ARIA } from '../lib/notification-constants';
import { SECONDS_PER_MINUTE } from '../lib/business-constants';
import {
  TASK_CARD_ICON_SIZES,
  TASK_CARD_ICON_COLORS,
} from '../lib/task-card-constants';
import { AGENDA_LIST_CARD, AGENDA_LIST_CARD_COLORS } from '../lib/agenda-list-card-constants';
import { ICON_SIZE_XS } from '../lib/layout-constants';

export type TaskCardInlinePomodoroVariant = 'footer' | 'tab';

export interface TaskCardInlinePomodoroProps {
  timerId: string;
  durationMinutes?: number | null;
  variant: TaskCardInlinePomodoroVariant;
  isMobile?: boolean;
  isDark?: boolean;
  className?: string;
}

function formatPomodoroCountdown(seconds: number) {
  const mins = Math.floor(seconds / SECONDS_PER_MINUTE);
  const secs = seconds % SECONDS_PER_MINUTE;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function TaskCardInlinePomodoro({
  timerId,
  durationMinutes,
  variant,
  isMobile = false,
  isDark = false,
  className,
}: TaskCardInlinePomodoroProps) {
  const { getTimerState, startTimer, pauseTimer, stopTimer } = usePomodoro();
  const timerState = getTimerState(timerId);

  const footerIconSize = AGENDA_LIST_CARD.footerIconSizePx;
  const tabIconSize = ICON_SIZE_XS;
  const kanbanIconSize = isMobile
    ? TASK_CARD_ICON_SIZES.playPauseStop.mobile
    : TASK_CARD_ICON_SIZES.playPauseStop.desktop;

  const iconSize = variant === 'tab' ? tabIconSize : footerIconSize;

  const footerTextClass = isDark ? 'text-gray-400' : 'text-gray-500';
  const footerButtonClass =
    'flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex-shrink-0';
  const tabButtonClass =
    'p-0.5 rounded hover:bg-white/20 dark:hover:bg-white/10 transition-colors flex-shrink-0';

  const handleStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    const mins = durationMinutes != null && durationMinutes > 0 ? durationMinutes : undefined;
    startTimer(timerId, mins != null ? { durationMinutes: mins } : undefined);
  };

  const handlePause = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await pauseTimer(timerId);
  };

  const handleStop = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await stopTimer(timerId);
  };

  if (timerState.isRunning) {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn('flex items-center gap-1 flex-shrink-0', className)}
      >
        <span
          className={cn(
            'font-mono font-medium tabular-nums whitespace-nowrap',
            variant === 'tab' ? 'text-xs text-white' : cn('text-[11px]', footerTextClass),
          )}
          aria-label={NOTIFICATION_POMODORO_ARIA.timeRemaining}
        >
          {formatPomodoroCountdown(timerState.timeLeft)}
        </span>
        <button
          type="button"
          onClick={handlePause}
          className={variant === 'tab' ? tabButtonClass : footerButtonClass}
          style={variant === 'footer' ? { width: footerIconSize + 4, height: footerIconSize + 4 } : undefined}
          aria-label={NOTIFICATION_POMODORO_ARIA.pauseTimer}
        >
          <Icon
            name="pause"
            size={iconSize}
            weight="fill"
            className={variant === 'tab' ? 'text-white' : TASK_CARD_ICON_COLORS.pomodoro}
          />
        </button>
        <button
          type="button"
          onClick={handleStop}
          className={variant === 'tab' ? tabButtonClass : footerButtonClass}
          style={variant === 'footer' ? { width: footerIconSize + 4, height: footerIconSize + 4 } : undefined}
          aria-label={NOTIFICATION_POMODORO_ARIA.stopTimer}
        >
          <Icon
            name="stop"
            size={iconSize}
            weight="fill"
            className={variant === 'tab' ? 'text-white' : TASK_CARD_ICON_COLORS.pomodoro}
          />
        </button>
      </div>
    );
  }

  if (timerState.isPaused) {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          'flex items-center gap-1 flex-shrink-0',
          variant === 'tab' &&
            'rounded px-1.5 py-0.5 border border-amber-400/60 dark:border-amber-300/60 bg-amber-500/20 dark:bg-amber-400/20',
          className,
        )}
      >
        <span
          className={cn(
            'font-mono font-medium tabular-nums whitespace-nowrap',
            variant === 'tab'
              ? 'text-xs text-amber-800 dark:text-amber-200'
              : cn(
                  'text-[11px] rounded px-1 py-0.5 border border-amber-500/50 dark:border-amber-400/50 bg-amber-500/10 dark:bg-amber-400/10 text-amber-700 dark:text-amber-300',
                ),
          )}
          aria-label={NOTIFICATION_POMODORO_ARIA.pausedTimeRemaining}
        >
          {formatPomodoroCountdown(timerState.timeLeft)} {NOTIFICATION_POMODORO_UI.pausedLabel}
        </span>
        <button
          type="button"
          onClick={handleStart}
          className={variant === 'tab' ? tabButtonClass : footerButtonClass}
          style={variant === 'footer' ? { width: footerIconSize + 4, height: footerIconSize + 4 } : undefined}
          aria-label={NOTIFICATION_POMODORO_ARIA.resumeTimer}
        >
          <Icon
            name="play"
            size={iconSize}
            weight="fill"
            className={
              variant === 'tab' ? 'text-amber-800 dark:text-amber-200' : TASK_CARD_ICON_COLORS.pomodoro
            }
          />
        </button>
        <button
          type="button"
          onClick={handleStop}
          className={variant === 'tab' ? tabButtonClass : footerButtonClass}
          style={variant === 'footer' ? { width: footerIconSize + 4, height: footerIconSize + 4 } : undefined}
          aria-label={NOTIFICATION_POMODORO_ARIA.stopTimer}
        >
          <Icon
            name="stop"
            size={iconSize}
            weight="fill"
            className={
              variant === 'tab' ? 'text-amber-800 dark:text-amber-200' : TASK_CARD_ICON_COLORS.pomodoro
            }
          />
        </button>
      </div>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()} className={cn('flex items-center flex-shrink-0', className)}>
      <button
        type="button"
        onClick={handleStart}
        className={variant === 'tab' ? tabButtonClass : footerButtonClass}
        style={variant === 'footer' ? { width: footerIconSize + 4, height: footerIconSize + 4 } : undefined}
        aria-label={NOTIFICATION_POMODORO_ARIA.startTimer}
      >
        <Icon
          name="play"
          size={variant === 'footer' ? iconSize : kanbanIconSize}
          weight="fill"
          className={variant === 'tab' ? 'text-white' : TASK_CARD_ICON_COLORS.pomodoro}
        />
      </button>
    </div>
  );
}
