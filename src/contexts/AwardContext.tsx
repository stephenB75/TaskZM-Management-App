import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getFromLocalStorage, saveToLocalStorage } from '../lib/utils';
import { useTasks } from './TaskContext';
import { useAuth } from './AuthContext';
import type { Award, UserAward, AwardProgress } from '../types';
import {
  COLOR_AWARD_COMMON,
  COLOR_AWARD_RARE,
  COLOR_AWARD_EPIC,
  COLOR_AWARD_LEGENDARY,
  COLOR_AWARD_STREAK,
} from '../lib/color-theme';
import {
  DAYS_IN_WEEK,
  TWO_WEEKS_DAYS,
  DAYS_IN_MONTH_APPROX,
  TIME_PERIODS,
  AWARD_COMPLETION_THRESHOLDS,
  PERCENTAGE_MULTIPLIER,
  MINUTES_PER_HOUR,
} from '../lib/business-constants';
import { TIMING_CONSTANTS } from '../lib/timing-constants';
import { createDefaultAwardContext } from '../lib/context-defaults';

interface AwardContextType {
  awards: Award[];
  earnedAwards: UserAward[];
  checkAndAwardAchievements: () => Promise<Award[]>;
  getAwardProgress: (awardId: string) => AwardProgress | null;
  celebrationQueue: Award[];
  dismissCelebration: () => void;
}

const AwardContext = createContext<AwardContextType | undefined>(undefined);

// Define all available awards
const ALL_AWARDS: Award[] = [
  // Completion Awards
  {
    id: 'first_task',
    name: 'First Steps',
    description: 'Complete your first task',
    icon: 'target',
    category: 'completion',
    requirement: 1,
    rarity: 'common',
    color: COLOR_AWARD_COMMON,
  },
  {
    id: 'task_master_10',
    name: 'Getting Started',
    description: 'Complete 10 tasks',
    icon: 'check-circle',
    category: 'completion',
    requirement: 10,
    rarity: 'common',
    color: COLOR_AWARD_COMMON,
  },
  {
    id: 'task_master_25',
    name: 'Task Warrior',
    description: 'Complete 25 tasks',
    icon: 'shield',
    category: 'completion',
    requirement: 25,
    rarity: 'rare',
    color: COLOR_AWARD_RARE,
  },
  {
    id: 'task_master_50',
    name: 'Productivity Champion',
    description: 'Complete 50 tasks',
    icon: 'zap',
    category: 'completion',
    requirement: 50,
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
    requirement: 250,
    rarity: 'epic',
    color: COLOR_AWARD_EPIC,
  },
  {
    id: 'task_master_500',
    name: 'Legendary',
    description: 'Complete 500 tasks',
    icon: 'star',
    category: 'completion',
    requirement: 500,
    rarity: 'legendary',
    color: COLOR_AWARD_LEGENDARY,
  },
  
  // Streak Awards
  {
    id: 'streak_3',
    name: 'Building Momentum',
    description: 'Complete tasks 3 days in a row',
    icon: 'flame',
    category: 'streak',
    requirement: 3,
    rarity: 'common',
    color: COLOR_AWARD_STREAK,
  },
  {
    id: 'streak_7',
    name: 'Week Warrior',
    description: `Complete tasks ${DAYS_IN_WEEK} days in a row`,
    icon: 'trending-up',
    category: 'streak',
    requirement: DAYS_IN_WEEK,
    rarity: 'rare',
    color: COLOR_AWARD_STREAK,
  },
  {
    id: 'streak_14',
    name: 'Fortnight Focus',
    description: `Complete tasks ${TWO_WEEKS_DAYS} days in a row`,
    icon: 'activity',
    category: 'streak',
    requirement: TWO_WEEKS_DAYS,
    rarity: 'epic',
    color: COLOR_AWARD_STREAK,
  },
  {
    id: 'streak_30',
    name: 'Unstoppable Force',
    description: `Complete tasks ${DAYS_IN_MONTH_APPROX} days in a row`,
    icon: 'award',
    category: 'streak',
    requirement: DAYS_IN_MONTH_APPROX,
    rarity: 'legendary',
    color: COLOR_AWARD_STREAK,
  },
  
  // Focus Awards (Pomodoro-based)
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
  
  // Speed Awards
  {
    id: 'quick_finish',
    name: 'Quick Executor',
    description: 'Complete a task in under 1 hour',
    icon: 'zap',
    category: 'speed',
    requirement: 1,
    rarity: 'rare',
    color: '#eab308',
  },
  {
    id: 'daily_dozen',
    name: 'Power Day',
    description: 'Complete 12 tasks in one day',
    icon: 'battery-charging',
    category: 'speed',
    requirement: 12,
    rarity: 'epic',
    color: '#eab308',
  },
  
  // Special Awards
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
    description: 'Complete 10 tasks on weekends',
    icon: 'calendar',
    category: 'special',
    requirement: 10,
    rarity: 'rare',
    color: '#14b8a6',
  },
  {
    id: 'perfectionist',
    name: 'Perfectionist',
    description: 'Complete all subtasks in 10 tasks',
    icon: 'sparkles',
    category: 'special',
    requirement: 10,
    rarity: 'epic',
    color: '#a855f7',
  },
];

export function AwardProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { tasks } = useTasks();
  const [earnedAwards, setEarnedAwards] = useState<UserAward[]>([]);
  const [celebrationQueue, setCelebrationQueue] = useState<Award[]>([]);

  // Load earned awards from localStorage
  useEffect(() => {
    if (user) {
      const saved = getFromLocalStorage<UserAward[]>(`awards_${user.id}`, []);
      setEarnedAwards(saved);
      // Clear celebration queue on load to prevent re-showing awards on refresh
      setCelebrationQueue([]);
    } else {
      // Clear awards when user logs out
      setEarnedAwards([]);
      setCelebrationQueue([]);
    }
  }, [user]);

  // Save earned awards to localStorage
  const saveEarnedAwards = useCallback((awards: UserAward[]) => {
    if (user) {
      saveToLocalStorage(`awards_${user.id}`, awards);
      setEarnedAwards(awards);
    }
  }, [user]);

  // Calculate current streak
  const getCurrentStreak = useCallback(() => {
    const completedTasks = tasks
      .filter(t => t.completedAt)
      .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());

    if (completedTasks.length === 0) return 0;

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < 365; i++) {
      const dayTasks = completedTasks.filter(t => {
        const completedDate = new Date(t.completedAt!);
        completedDate.setHours(0, 0, 0, 0);
        return completedDate.getTime() === currentDate.getTime();
      });

      if (dayTasks.length > 0) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        // Allow one day gap if it's today and we're checking yesterday
        if (i === 0) {
          currentDate.setDate(currentDate.getDate() - 1);
          continue;
        }
        break;
      }
    }

    return streak;
  }, [tasks]);

  // Get Pomodoro session count
  const getPomodoroCount = useCallback(() => {
    return tasks.reduce((total, task) => {
      const sessions = task.actualTime ? Math.floor(task.actualTime / 25) : 0;
      return total + sessions;
    }, 0);
  }, [tasks]);

  // Check and award achievements
  const checkAndAwardAchievements = useCallback(async (): Promise<Award[]> => {
    const completedTasks = tasks.filter(t => t.status === 'done');
    const newlyEarnedAwards: Award[] = [];
    const updatedEarnedAwards = [...earnedAwards];

    // Check each award
    for (const award of ALL_AWARDS) {
      // Skip if already earned
      if (earnedAwards.some(ea => ea.awardId === award.id)) {
        continue;
      }

      let earned = false;

      switch (award.category) {
        case 'completion':
          earned = completedTasks.length >= award.requirement;
          break;

        case 'streak':
          const streak = getCurrentStreak();
          earned = streak >= award.requirement;
          break;

        case 'focus':
          const pomodoroCount = getPomodoroCount();
          earned = pomodoroCount >= award.requirement;
          break;

        case 'speed':
          if (award.id === 'quick_finish') {
            // Check if any task was completed in under 1 hour
            earned = completedTasks.some(t => {
              if (!t.actualTime) return false;
              return t.actualTime < MINUTES_PER_HOUR;
            });
          } else if (award.id === 'daily_dozen') {
            // Check if 12 tasks completed in one day
            const tasksByDay = new Map<string, number>();
            completedTasks.forEach(t => {
              if (t.completedAt) {
                const date = new Date(t.completedAt).toDateString();
                tasksByDay.set(date, (tasksByDay.get(date) || 0) + 1);
              }
            });
            earned = Array.from(tasksByDay.values()).some(count => count >= 12);
          }
          break;

        case 'special':
          if (award.id === 'early_bird') {
            earned = completedTasks.some(t => {
              if (!t.completedAt) return false;
              const hour = new Date(t.completedAt).getHours();
              return hour < TIME_PERIODS.DAY_END;
            });
          } else if (award.id === 'night_owl') {
            earned = completedTasks.some(t => {
              if (!t.completedAt) return false;
              const hour = new Date(t.completedAt).getHours();
              return hour >= 22;
            });
          } else if (award.id === 'weekend_warrior') {
            const weekendTasks = completedTasks.filter(t => {
              if (!t.completedAt) return false;
              const day = new Date(t.completedAt).getDay();
              // Check if day is Sunday (0) or Saturday (6) using timing constants
              return day === TIMING_CONSTANTS.calendar.minDayOfWeek || day === TIMING_CONSTANTS.calendar.maxDayOfWeek;
            });
            earned = weekendTasks.length >= 10;
          } else if (award.id === 'perfectionist') {
            const tasksWithAllSubtasks = completedTasks.filter(t => {
              if (!t.subtasks || t.subtasks.length === 0) return false;
              return t.subtasks.every(st => st.completed);
            });
            earned = tasksWithAllSubtasks.length >= 10;
          }
          break;
      }

      if (earned) {
        const userAward: UserAward = {
          awardId: award.id,
          earnedAt: new Date().toISOString(),
        };
        updatedEarnedAwards.push(userAward);
        newlyEarnedAwards.push(award);
      }
    }

    if (newlyEarnedAwards.length > 0) {
      saveEarnedAwards(updatedEarnedAwards);
      setCelebrationQueue(prev => [...prev, ...newlyEarnedAwards]);
    }

    return newlyEarnedAwards;
  }, [tasks, earnedAwards, saveEarnedAwards, getCurrentStreak, getPomodoroCount]);

  // Get progress for an award
  const getAwardProgress = useCallback((awardId: string): AwardProgress | null => {
    const award = ALL_AWARDS.find(a => a.id === awardId);
    if (!award) return null;

    // Skip if already earned
    if (earnedAwards.some(ea => ea.awardId === awardId)) {
      return {
        awardId,
        currentProgress: award.requirement,
        targetProgress: award.requirement,
        percentage: PERCENTAGE_MULTIPLIER,
      };
    }

    const completedTasks = tasks.filter(t => t.status === 'done');
    let currentProgress = 0;

    switch (award.category) {
      case 'completion':
        currentProgress = completedTasks.length;
        break;
      case 'streak':
        currentProgress = getCurrentStreak();
        break;
      case 'focus':
        currentProgress = getPomodoroCount();
        break;
      default:
        return null;
    }

    return {
      awardId,
      currentProgress,
      targetProgress: award.requirement,
      percentage: Math.min((currentProgress / award.requirement) * PERCENTAGE_MULTIPLIER, PERCENTAGE_MULTIPLIER),
    };
  }, [tasks, earnedAwards, getCurrentStreak, getPomodoroCount]);

  const dismissCelebration = useCallback(() => {
    setCelebrationQueue(prev => prev.slice(1));
  }, []);

  const value: AwardContextType = {
    awards: ALL_AWARDS,
    earnedAwards,
    checkAndAwardAchievements,
    getAwardProgress,
    celebrationQueue,
    dismissCelebration,
  };

  return (
    <AwardContext.Provider value={value}>
      {children}
    </AwardContext.Provider>
  );
}

export function useAwards() {
  const context = useContext(AwardContext);
  if (!context) {
    // During React Fast Refresh (HMR), providers can temporarily unmount
    // Return a safe default instead of throwing to prevent crashes
    if (import.meta.env.DEV) {
      console.warn('useAwards called outside AwardProvider (likely HMR issue), returning default');
      return createDefaultAwardContext();
    }
    throw new Error('useAwards must be used within AwardProvider');
  }
  return context;
}
