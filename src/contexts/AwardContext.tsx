import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { getFromLocalStorage, saveToLocalStorage } from '../lib/utils';
import { useTasks } from './TaskContext';
import { useAuth } from './AuthContext';
import type { Award, UserAward, AwardProgress } from '../types';
import { getUserAwards, saveUserAwards, saveUserAward } from '../lib/api';
import {
  ALL_AWARDS,
  isAwardEarned,
  buildAwardProgress,
} from '../lib/award-evaluation';
import { NOTIFICATION_STORAGE_KEYS } from '../lib/notification-constants';
import { createDefaultAwardContext } from '../lib/context-defaults';

interface AwardContextType {
  awards: Award[];
  earnedAwards: UserAward[];
  awardsLoaded: boolean;
  checkAndAwardAchievements: () => Promise<Award[]>;
  getAwardProgress: (awardId: string) => AwardProgress | null;
  celebrationQueue: Award[];
  dismissCelebration: () => void;
}

const AwardContext = createContext<AwardContextType | undefined>(undefined);

function seedLastSeenAwardsIfNeeded(earned: UserAward[]): void {
  if (earned.length === 0) return;
  const lastSeen = getFromLocalStorage<string[]>(NOTIFICATION_STORAGE_KEYS.lastSeenAwards, []);
  if (lastSeen.length > 0) return;
  saveToLocalStorage(
    NOTIFICATION_STORAGE_KEYS.lastSeenAwards,
    earned.map((entry) => entry.awardId),
  );
}

export function AwardProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { tasks } = useTasks();
  const [earnedAwards, setEarnedAwards] = useState<UserAward[]>([]);
  const [celebrationQueue, setCelebrationQueue] = useState<Award[]>([]);
  const [awardsLoaded, setAwardsLoaded] = useState(false);

  useEffect(() => {
    const loadAwards = async () => {
      setAwardsLoaded(false);

      if (!user) {
        setEarnedAwards([]);
        setCelebrationQueue([]);
        setAwardsLoaded(true);
        return;
      }

      try {
        const dbAwards = await getUserAwards();
        if (dbAwards && dbAwards.length > 0) {
          setEarnedAwards(dbAwards);
          saveToLocalStorage(`awards_${user.id}`, dbAwards);
          seedLastSeenAwardsIfNeeded(dbAwards);
        } else {
          const saved = getFromLocalStorage<UserAward[]>(`awards_${user.id}`, []);
          if (saved.length > 0) {
            setEarnedAwards(saved);
            await saveUserAwards(saved);
            seedLastSeenAwardsIfNeeded(saved);
          } else {
            setEarnedAwards([]);
          }
        }
        setCelebrationQueue([]);
      } catch (error) {
        console.error('Error loading awards:', error);
        const saved = getFromLocalStorage<UserAward[]>(`awards_${user.id}`, []);
        setEarnedAwards(saved);
        seedLastSeenAwardsIfNeeded(saved);
        setCelebrationQueue([]);
      } finally {
        setAwardsLoaded(true);
      }
    };

    loadAwards();
  }, [user]);

  const saveEarnedAwards = useCallback(async (awards: UserAward[]) => {
    if (!user) return;

    saveToLocalStorage(`awards_${user.id}`, awards);
    setEarnedAwards(awards);

    try {
      await saveUserAwards(awards);
    } catch (error) {
      console.error('Error saving awards to database:', error);
    }
  }, [user]);

  const checkAndAwardAchievements = useCallback(async (): Promise<Award[]> => {
    const newlyEarnedAwards: Award[] = [];
    const updatedEarnedAwards = [...earnedAwards];
    const earnedIds = new Set(earnedAwards.map((entry) => entry.awardId));

    for (const award of ALL_AWARDS) {
      if (earnedIds.has(award.id)) continue;
      if (!isAwardEarned(award, tasks)) continue;

      const userAward: UserAward = {
        awardId: award.id,
        earnedAt: new Date().toISOString(),
      };
      updatedEarnedAwards.push(userAward);
      newlyEarnedAwards.push(award);
      earnedIds.add(award.id);
    }

    if (newlyEarnedAwards.length > 0) {
      await saveEarnedAwards(updatedEarnedAwards);
      for (const newAward of newlyEarnedAwards) {
        const userAward = updatedEarnedAwards.find((entry) => entry.awardId === newAward.id);
        if (userAward) {
          saveUserAward(userAward).catch((err) =>
            console.error(`Error saving award ${userAward.awardId}:`, err),
          );
        }
      }
      setCelebrationQueue((prev) => [...prev, ...newlyEarnedAwards]);
    }

    return newlyEarnedAwards;
  }, [tasks, earnedAwards, saveEarnedAwards]);

  const getAwardProgress = useCallback((awardId: string): AwardProgress | null => {
    const award = ALL_AWARDS.find((entry) => entry.id === awardId);
    if (!award) return null;

    const alreadyEarned = earnedAwards.some((entry) => entry.awardId === awardId);
    return buildAwardProgress(award, tasks, alreadyEarned);
  }, [tasks, earnedAwards]);

  const dismissCelebration = useCallback(() => {
    setCelebrationQueue((prev) => prev.slice(1));
  }, []);

  const value: AwardContextType = {
    awards: ALL_AWARDS,
    earnedAwards,
    awardsLoaded,
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
    if (import.meta.env.DEV) {
      console.warn('useAwards called outside AwardProvider (likely HMR issue), returning default');
      return createDefaultAwardContext();
    }
    throw new Error('useAwards must be used within AwardProvider');
  }
  return context;
}
