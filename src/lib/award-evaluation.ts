import type { Task, Award } from '../types';
import {
  AWARD_COMPLETION_THRESHOLDS,
  AWARD_STREAK_THRESHOLDS,
  AWARD_POMODORO_SESSION_MINUTES,
  AWARD_DAILY_COMPLETION_THRESHOLD,
  AWARD_WEEKEND_COMPLETION_THRESHOLD,
  AWARD_PERFECTIONIST_TASK_THRESHOLD,
  AWARD_POMODORO_MASTER_THRESHOLD,
  AWARD_QUICK_FINISH_MAX_MINUTES,
  AWARD_STREAK_LOOKBACK_DAYS,
  DAYS_IN_WEEK,
  TWO_WEEKS_DAYS,
  DAYS_IN_MONTH_APPROX,
  TIME_PERIODS,
  MILLISECONDS_PER_MINUTE,
  PERCENTAGE_MULTIPLIER,
} from './business-constants';
import { TIMING_CONSTANTS } from './timing-constants';
import {
  COLOR_AWARD_COMMON,
  COLOR_AWARD_RARE,
  COLOR_AWARD_EPIC,
  COLOR_AWARD_LEGENDARY,
  COLOR_AWARD_STREAK,
} from './color-theme';

/** All earnable achievements (23 total). */
export const ALL_AWARDS: Award[] = [
  {
    id: 'first_task',
    name: 'First Steps',
    description: 'Complete your first task',
    icon: 'target',
    category: 'completion',
    requirement: AWARD_COMPLETION_THRESHOLDS.FIRST,
    rarity: 'common',
    color: COLOR_AWARD_COMMON,
  },
  {
    id: 'task_master_10',
    name: 'Getting Started',
    description: 'Complete 10 tasks',
    icon: 'check-circle',
    category: 'completion',
    requirement: AWARD_COMPLETION_THRESHOLDS.BEGINNER,
    rarity: 'common',
    color: COLOR_AWARD_COMMON,
  },
  {
    id: 'task_master_25',
    name: 'Task Warrior',
    description: 'Complete 25 tasks',
    icon: 'shield',
    category: 'completion',
    requirement: AWARD_COMPLETION_THRESHOLDS.WARRIOR,
    rarity: 'rare',
    color: COLOR_AWARD_RARE,
  },
  {
    id: 'task_master_50',
    name: 'Productivity Champion',
    description: 'Complete 50 tasks',
    icon: 'zap',
    category: 'completion',
    requirement: AWARD_COMPLETION_THRESHOLDS.CHAMPION,
    rarity: 'rare',
    color: COLOR_AWARD_RARE,
  },
  {
    id: 'task_master_100',
    name: 'Century Club',
    description: 'Complete 100 tasks',
    icon: 'trophy',
    category: 'completion',
    requirement: AWARD_COMPLETION_THRESHOLDS.CENTURY,
    rarity: 'epic',
    color: COLOR_AWARD_EPIC,
  },
  {
    id: 'task_master_250',
    name: 'Elite Achiever',
    description: 'Complete 250 tasks',
    icon: 'crown',
    category: 'completion',
    requirement: AWARD_COMPLETION_THRESHOLDS.ELITE,
    rarity: 'epic',
    color: COLOR_AWARD_EPIC,
  },
  {
    id: 'task_master_500',
    name: 'Legendary',
    description: 'Complete 500 tasks',
    icon: 'star',
    category: 'completion',
    requirement: AWARD_COMPLETION_THRESHOLDS.LEGENDARY,
    rarity: 'legendary',
    color: COLOR_AWARD_LEGENDARY,
  },
  {
    id: 'streak_3',
    name: 'Building Momentum',
    description: 'Complete tasks 3 days in a row',
    icon: 'flame',
    category: 'streak',
    requirement: AWARD_STREAK_THRESHOLDS.MOMENTUM,
    rarity: 'common',
    color: COLOR_AWARD_STREAK,
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: `Complete tasks ${DAYS_IN_WEEK} days in a row`,
    icon: 'trending-up',
    category: 'streak',
    requirement: AWARD_STREAK_THRESHOLDS.WEEK,
    rarity: 'rare',
    color: COLOR_AWARD_STREAK,
  },
  {
    id: 'streak_14',
    name: 'Fortnight Focus',
    description: `Complete tasks ${TWO_WEEKS_DAYS} days in a row`,
    icon: 'activity',
    category: 'streak',
    requirement: AWARD_STREAK_THRESHOLDS.FORTNIGHT,
    rarity: 'epic',
    color: COLOR_AWARD_STREAK,
  },
  {
    id: 'streak_30',
    name: 'Unstoppable Force',
    description: `Complete tasks ${DAYS_IN_MONTH_APPROX} days in a row`,
    icon: 'award',
    category: 'streak',
    requirement: AWARD_STREAK_THRESHOLDS.MONTH,
    rarity: 'legendary',
    color: COLOR_AWARD_STREAK,
  },
  {
    id: 'streak_90',
    name: 'Quarter Champion',
    description: `Complete tasks ${AWARD_STREAK_THRESHOLDS.QUARTER} days in a row`,
    icon: 'flame',
    category: 'streak',
    requirement: AWARD_STREAK_THRESHOLDS.QUARTER,
    rarity: 'legendary',
    color: COLOR_AWARD_STREAK,
  },
  {
    id: 'streak_365',
    name: 'Year of Focus',
    description: `Complete tasks ${AWARD_STREAK_THRESHOLDS.YEAR} days in a row`,
    icon: 'crown',
    category: 'streak',
    requirement: AWARD_STREAK_THRESHOLDS.YEAR,
    rarity: 'legendary',
    color: COLOR_AWARD_LEGENDARY,
  },
  {
    id: 'pomodoro_10',
    name: 'Focus Initiate',
    description: 'Complete 10 Pomodoro sessions',
    icon: 'timer',
    category: 'focus',
    requirement: 10,
    rarity: 'common',
    color: COLOR_AWARD_LEGENDARY,
  },
  {
    id: 'pomodoro_50',
    name: 'Deep Work Practitioner',
    description: 'Complete 50 Pomodoro sessions',
    icon: 'brain',
    category: 'focus',
    requirement: 50,
    rarity: 'rare',
    color: '#7B68EE',
  },
  {
    id: 'pomodoro_100',
    name: 'Concentration Expert',
    description: 'Complete 100 Pomodoro sessions',
    icon: 'zap',
    category: 'focus',
    requirement: AWARD_COMPLETION_THRESHOLDS.CENTURY,
    rarity: 'epic',
    color: '#7B68EE',
  },
  {
    id: 'pomodoro_250',
    name: 'Focus Master',
    description: `Complete ${AWARD_POMODORO_MASTER_THRESHOLD} Pomodoro sessions`,
    icon: 'brain',
    category: 'focus',
    requirement: AWARD_POMODORO_MASTER_THRESHOLD,
    rarity: 'legendary',
    color: '#7B68EE',
  },
  {
    id: 'quick_finish',
    name: 'Quick Executor',
    description: 'Complete a task within 1 hour of creating it',
    icon: 'zap',
    category: 'speed',
    requirement: 1,
    rarity: 'rare',
    color: '#eab308',
  },
  {
    id: 'daily_dozen',
    name: 'Power Day',
    description: `Complete ${AWARD_DAILY_COMPLETION_THRESHOLD} tasks in one day`,
    icon: 'battery-charging',
    category: 'speed',
    requirement: AWARD_DAILY_COMPLETION_THRESHOLD,
    rarity: 'epic',
    color: '#eab308',
  },
  {
    id: 'early_bird',
    name: 'Early Riser',
    description: `Complete a task before ${TIME_PERIODS.DAY_END} AM`,
    icon: 'sunrise',
    category: 'special',
    requirement: 1,
    rarity: 'rare',
    color: '#ec4899',
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Complete a task after 10 PM',
    icon: 'moon',
    category: 'special',
    requirement: 1,
    rarity: 'rare',
    color: '#6366f1',
  },
  {
    id: 'weekend_warrior',
    name: 'Weekend Warrior',
    description: `Complete ${AWARD_WEEKEND_COMPLETION_THRESHOLD} tasks on weekends`,
    icon: 'calendar',
    category: 'special',
    requirement: AWARD_WEEKEND_COMPLETION_THRESHOLD,
    rarity: 'rare',
    color: '#14b8a6',
  },
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: `Complete all subtasks in ${AWARD_PERFECTIONIST_TASK_THRESHOLD} tasks`,
    icon: 'sparkles',
    category: 'special',
    requirement: AWARD_PERFECTIONIST_TASK_THRESHOLD,
    rarity: 'epic',
    color: '#a855f7',
  },
];

export function getCompletedTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => t.status === 'done');
}

export function getCurrentCompletionStreak(tasks: Task[]): number {
  const completedTasks = tasks
    .filter((t) => t.completedAt)
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());

  if (completedTasks.length === 0) return 0;

  let streak = 0;
  const currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  for (let i = 0; i < AWARD_STREAK_LOOKBACK_DAYS; i++) {
    const dayTasks = completedTasks.filter((t) => {
      const completedDate = new Date(t.completedAt!);
      completedDate.setHours(0, 0, 0, 0);
      return completedDate.getTime() === currentDate.getTime();
    });

    if (dayTasks.length > 0) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    } else if (i === 0) {
      currentDate.setDate(currentDate.getDate() - 1);
    } else {
      break;
    }
  }

  return streak;
}

export function getPomodoroSessionCount(tasks: Task[]): number {
  return tasks.reduce((total, task) => {
    if (!task.actualTime) return total;
    return total + Math.floor(task.actualTime / AWARD_POMODORO_SESSION_MINUTES);
  }, 0);
}

export function taskCompletedWithinQuickFinishWindow(task: Task): boolean {
  if (!task.completedAt || !task.createdAt) return false;
  const elapsedMs =
    new Date(task.completedAt).getTime() - new Date(task.createdAt).getTime();
  return (
    elapsedMs > 0 &&
    elapsedMs <= AWARD_QUICK_FINISH_MAX_MINUTES * MILLISECONDS_PER_MINUTE
  );
}

export function getMaxCompletionsInOneDay(completedTasks: Task[]): number {
  const tasksByDay = new Map<string, number>();
  completedTasks.forEach((t) => {
    if (!t.completedAt) return;
    const date = new Date(t.completedAt).toDateString();
    tasksByDay.set(date, (tasksByDay.get(date) || 0) + 1);
  });
  return tasksByDay.size === 0 ? 0 : Math.max(...tasksByDay.values());
}

export function getWeekendCompletionCount(completedTasks: Task[]): number {
  return completedTasks.filter((t) => {
    if (!t.completedAt) return false;
    const day = new Date(t.completedAt).getDay();
    return (
      day === TIMING_CONSTANTS.calendar.minDayOfWeek ||
      day === TIMING_CONSTANTS.calendar.maxDayOfWeek
    );
  }).length;
}

export function getPerfectionistTaskCount(completedTasks: Task[]): number {
  return completedTasks.filter(
    (t) => t.subtasks && t.subtasks.length > 0 && t.subtasks.every((st) => st.completed),
  ).length;
}

export function isAwardEarned(award: Award, tasks: Task[]): boolean {
  const completedTasks = getCompletedTasks(tasks);

  switch (award.category) {
    case 'completion':
      return completedTasks.length >= award.requirement;

    case 'streak':
      return getCurrentCompletionStreak(tasks) >= award.requirement;

    case 'focus':
      return getPomodoroSessionCount(tasks) >= award.requirement;

    case 'speed':
      if (award.id === 'quick_finish') {
        return completedTasks.some(taskCompletedWithinQuickFinishWindow);
      }
      if (award.id === 'daily_dozen') {
        return getMaxCompletionsInOneDay(completedTasks) >= AWARD_DAILY_COMPLETION_THRESHOLD;
      }
      return false;

    case 'special':
      if (award.id === 'early_bird') {
        return completedTasks.some((t) => {
          if (!t.completedAt) return false;
          return new Date(t.completedAt).getHours() < TIME_PERIODS.DAY_END;
        });
      }
      if (award.id === 'night_owl') {
        return completedTasks.some((t) => {
          if (!t.completedAt) return false;
          return new Date(t.completedAt).getHours() >= TIME_PERIODS.NIGHT_START;
        });
      }
      if (award.id === 'weekend_warrior') {
        return getWeekendCompletionCount(completedTasks) >= AWARD_WEEKEND_COMPLETION_THRESHOLD;
      }
      if (award.id === 'perfectionist') {
        return getPerfectionistTaskCount(completedTasks) >= AWARD_PERFECTIONIST_TASK_THRESHOLD;
      }
      return false;

    default:
      return false;
  }
}

export function getAwardProgressValue(award: Award, tasks: Task[]): number {
  const completedTasks = getCompletedTasks(tasks);

  switch (award.category) {
    case 'completion':
      return completedTasks.length;
    case 'streak':
      return getCurrentCompletionStreak(tasks);
    case 'focus':
      return getPomodoroSessionCount(tasks);
    case 'speed':
      if (award.id === 'quick_finish') {
        return completedTasks.some(taskCompletedWithinQuickFinishWindow) ? 1 : 0;
      }
      if (award.id === 'daily_dozen') {
        return getMaxCompletionsInOneDay(completedTasks);
      }
      return 0;
    case 'special':
      if (award.id === 'weekend_warrior') {
        return getWeekendCompletionCount(completedTasks);
      }
      if (award.id === 'perfectionist') {
        return getPerfectionistTaskCount(completedTasks);
      }
      if (award.id === 'early_bird' || award.id === 'night_owl') {
        return isAwardEarned(award, tasks) ? 1 : 0;
      }
      return 0;
    default:
      return 0;
  }
}

export function buildAwardProgress(award: Award, tasks: Task[], alreadyEarned: boolean) {
  if (alreadyEarned) {
    return {
      awardId: award.id,
      currentProgress: award.requirement,
      targetProgress: award.requirement,
      percentage: PERCENTAGE_MULTIPLIER,
    };
  }

  const currentProgress = getAwardProgressValue(award, tasks);
  return {
    awardId: award.id,
    currentProgress,
    targetProgress: award.requirement,
    percentage: Math.min(
      (currentProgress / award.requirement) * PERCENTAGE_MULTIPLIER,
      PERCENTAGE_MULTIPLIER,
    ),
  };
}

/** Fingerprint task stats that can unlock awards (not only completion count). */
export function buildAwardCheckSignature(tasks: Task[]): string {
  const completed = getCompletedTasks(tasks);
  const totalFocusMinutes = tasks.reduce((sum, t) => sum + (t.actualTime ?? 0), 0);
  const perfectionist = getPerfectionistTaskCount(completed);
  const maxDaily = getMaxCompletionsInOneDay(completed);
  const pomodoros = getPomodoroSessionCount(tasks);
  return `${completed.length}:${totalFocusMinutes}:${pomodoros}:${perfectionist}:${maxDaily}:${getCurrentCompletionStreak(tasks)}`;
}
